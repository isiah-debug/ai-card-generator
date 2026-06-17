// =========================================================================
// 1. GLOBAL ENGINE CONFIGURATION & UTILITIES
// =========================================================================
const SILICON_FLOW_KEY = process.env.SILICONFLOW_API_KEY;

const TEXT_API_URL = "https://api.siliconflow.com/v1/chat/completions";
const IMAGE_API_URL = "https://api.siliconflow.com/v1/images/generations";

// Handle incoming chunk data streams manually
export const config = {
  api: {
    bodyParser: false,
  },
};

function cleanAndParseJSON(rawString) {
  let cleanStr = rawString.trim();
  if (cleanStr.includes("```")) {
    const lines = cleanStr.split("\n");
    const filtered = lines.filter(line => !line.trim().startsWith("```"));
    cleanStr = filtered.join("\n").trim();
  }
  const startIdx = cleanStr.indexOf("{");
  const endIdx = cleanStr.lastIndexOf("}");
  if (startIdx === -1 || endIdx === -1) {
    throw new Error("Target JSON block symbols missing from stream profile.");
  }
  cleanStr = cleanStr.substring(startIdx, endIdx + 1);
  return JSON.parse(cleanStr);
}

// Helper utility to pull text values out of multipart form boundary data chunks safely
function extractValueFromMultipart(bodyStr, fieldName) {
  const match = new RegExp(`name="${fieldName}"[\\r\\n\\s]+([^\\r\\n\\-]+)`, 'i').exec(bodyStr);
  return match ? match[1].trim() : null;
}

// =========================================================================
// 2. BACKEND LAYER CONNECTIONS (LLAMA-3 & FLUX)
// =========================================================================
async function callLLMProvider(promptText) {
  if (!SILICON_FLOW_KEY) throw new Error("Missing SILICONFLOW_API_KEY configuration.");

  const response = await fetch(TEXT_API_URL, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SILICON_FLOW_KEY.trim()}`
    },
    body: JSON.stringify({
      model: "meta-llama/Meta-Llama-3-8B-Instruct", 
      messages: [{ role: "user", content: promptText }],
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LLM Error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  return cleanAndParseJSON(data.choices[0].message.content);
}

async function generatePrimaryAIImageBase64(expandedPrompt) {
  if (!SILICON_FLOW_KEY) throw new Error("Invalid API key configuration layout.");
  let cleanKey = SILICON_FLOW_KEY.trim().replace(/^bearer\s+/i, '');

  const response = await fetch(IMAGE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cleanKey}`
    },
    body: JSON.stringify({
      model: "black-forest-labs/FLUX.1-schnell",
      prompt: expandedPrompt,
      image_size: "768x1024" // Native Portrait Mode layout framework
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`[SiliconFlow Server Error]: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const asset = data.images[0];
  let piece = typeof asset === 'string' ? asset : (asset.url || asset.b64_json);
   
  if (piece && !piece.startsWith('data:') && !piece.startsWith('http')) {
    return `data:image/png;base64,${piece}`;
  }
  return piece;
}

function generateSafeLocalFallbackBackground() {
  const rawVectorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="1024"><rect width="768" height="1024" fill="#1e293b" /><text x="384" y="512" font-family="sans-serif" font-size="24" fill="#64748b" text-anchor="middle">Loading Card Canvas Art...</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(rawVectorSvg.trim()).toString('base64')}`;
}

// =========================================================================
// 3. MAIN SERVERLESS ENDPOINT INTERCEPTOR HANDLER
// =========================================================================
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const chunks = [];
    for await (const chunk of req) { chunks.push(chunk); }
    const buffer = Buffer.concat(chunks);
    const rawPayloadString = buffer.toString('utf-8');

    // 1. CORE FIX: Intercept cross-platform message parameters from Shopify input fields
    const occasion = extractValueFromMultipart(rawPayloadString, 'occasion') || "Celebration";
    const recipient = extractValueFromMultipart(rawPayloadString, 'recipient') || "Someone Special";
    const tone = extractValueFromMultipart(rawPayloadString, 'tone') || "festive";
    
    // Grabs what they type inside the textarea boxes (message, prompt, description, etc.)
    const customerMessage = extractValueFromMultipart(rawPayloadString, 'message') || 
                            extractValueFromMultipart(rawPayloadString, 'prompt') || 
                            extractValueFromMultipart(rawPayloadString, 'description') || 
                            recipient;

    console.log("=========================================================");
    console.log("📥 PORTRAIT AI PROCESSING LOG:");
    console.log(` -> Occasion Context: ${occasion}`);
    console.log(` -> Recipient Target: ${recipient}`);
    console.log(` -> CUSTOMER MESSAGE INPUT: ${customerMessage}`);
    console.log("=========================================================");

    // 2. LLM Pipeline Stage A: Formulate Copywriting Heading Styles
    const copywritingDirectivePrompt = `Analyze these greeting card parameters:
    Occasion context: "${occasion}", Recipient target: "${recipient}", Desired Tone: "${tone}". Custom instructions: "${customerMessage}".
    Write a 2-3 word upper-case headline cover greeting (e.g. HAPPY BIRTHDAY, YOU DID IT, CONGRATS CHIEF).
    Return strict clean JSON: {"headline_greeting": "phrase_here"}`;

    let cardTextDetails;
    try {
      cardTextDetails = await callLLMProvider(copywritingDirectivePrompt);
    } catch (err) {
      cardTextDetails = { headline_greeting: `${occasion.toUpperCase()}!` };
    }

    // 3. LLM Pipeline Stage B: Inject the Customer's Message into Image Generation Rules
    const promptExpanderPrompt = `You are an expert card designer. Turn this user design request into a deep, visually rich 1:1 description prompt for an image generation engine.
    
    Occasion Framework: "${occasion}"
    Vibe Tone: "${tone}"
    Core Visual Subject Request: "${customerMessage}"
    
    CRITICAL DESIGN REQUISITE: The card artwork must be explicitly designed and customized around the details in this specific scene description: "${customerMessage}". Translate this into a beautiful portrait vector graphic illustration style suitable for a modern greeting card cover. 
    
    DO NOT write any words, texts, logos, tags, or alphabet characters inside the image graphics. Keep the visual layout a clean canvas background.
    
    Return strict JSON: {"expanded_prompt": "your long expanded detailed prompt description layout rules here"}`;

    let expandedPromptPayload;
    try {
      const expansionData = await callLLMProvider(promptExpanderPrompt);
      expandedPromptPayload = expansionData.expanded_prompt;
    } catch (err) {
      expandedPromptPayload = `A beautiful custom portrait greeting card background vector graphic illustration for ${occasion}, themed perfectly around details: ${customerMessage}. Clean illustration art style.`;
    }

    // Mix priority aesthetic overrides into the expanded prompt stack
    const highlyEngineeredArtPrompt = `Greeting card graphic illustration art background, beautiful portrait vector design layout, vertical composition, vivid focused center layout design, high definition artwork canvas, absolute clean design context. Core theme topic description: ${expandedPromptPayload}`.trim();

    // 4. Trigger FLUX to generate image
    let finalInlineImageSource;
    try {
      console.log("🎨 Dispatching Customer Prompt to Flux:", highlyEngineeredArtPrompt);
      finalInlineImageSource = await generatePrimaryAIImageBase64(highlyEngineeredArtPrompt);
    } catch (primaryErr) {
      console.error("❌ DOWNSTREAM FALLBACK ACTIVE:", primaryErr.message);
      finalInlineImageSource = generateSafeLocalFallbackBackground();
    }

    // =========================================================================
    // 5. DELIVERY STREAM
    // =========================================================================
    return res.status(200).json({
      status: "success",
      file_url: finalInlineImageSource,
      headline_greeting: cardTextDetails.headline_greeting
    });

  } catch (error) {
    console.error("💥 CORE INTEGRATION CRASH OCCURRENCE:", error.message);
    return res.status(200).json({ 
      status: "success", 
      file_url: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI3NjgiIGhlaWdodD0iMTAyNCI+PHJlY3Qgd2lkdGg9Ijc2OCIgaGVpZ2h0PSIxMDI0IiBmaWxsPSIjZjhmYWZjIi8+PHRleHQgeD0iMzg0IiB5PSI1MTIiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjI0IiBmaWxsPSIjNjQ3NDhiIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5HZW5lcmF0aW5nIHlvdXIgQWkgQXJ0d29yay4uLjwvdGV4dD48L3N2Zz4=" 
    });
  }
}
