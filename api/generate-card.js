// =========================================================================
// 1. GLOBAL ENGINE CONFIGURATION & UTILITIES
// =========================================================================
const SILICON_FLOW_KEY = process.env.SILICONFLOW_API_KEY;

const TEXT_API_URL = "https://api.siliconflow.com/v1/chat/completions";
const IMAGE_API_URL = "https://api.siliconflow.com/v1/images/generations";

// Let us manually handle incoming chunk data streams
export const config = {
  api: {
    bodyParser: false,
  },
};

const sanitizeForXML = (str) => {
  return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
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

// 4-Tier Aesthetic Theme Router Map Dictionary
const FRAMING_LAYOUT_ROUTER = {
  vibrant_playful: { borderColor: "#FF4A75", accentColor: "#FFD166", strokeWidth: "16", overlayOpacity: "0.08", fontStyleDescription: "bold bubble colorful festive typography artwork styled seamlessly into the background canvas" },
  classic_elegant: { borderColor: "#D4AF37", accentColor: "#2C3E50", strokeWidth: "8", overlayOpacity: "0.15", fontStyleDescription: "luxurious premium gold cursive copperplate calligraphy text cleanly written on the card scenery" },
  retro_vintage: { borderColor: "#FF8C42", accentColor: "#FFF2D7", strokeWidth: "12", overlayOpacity: "0.12", fontStyleDescription: "1970s distressed retro bold pop-art lettering embedded into the art composition" },
  modern_minimal: { borderColor: "#38bdf8", accentColor: "#ffffff", strokeWidth: "4", overlayOpacity: "0.03", fontStyleDescription: "sleek modernist crisp sans-serif geometric clean typeface drawn natively on the artwork background" }
};

// Helper utility to pull text values out of multipart form boundary data chunks
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

async function generatePrimaryAIImageBase64(expandedPrompt, uniqueSeed) {
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
      image_size: "1024x1024"
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
  const rawVectorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" fill="#1e293b" /><text x="400" y="400" font-family="sans-serif" font-size="22" fill="#64748b" text-anchor="middle">Artwork Pipeline Refresh Active...</text></svg>`;
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

    // 1. Core Text Prompts - Safely captures cross-platform parameter fields
    const occasion = extractValueFromMultipart(rawPayloadString, 'occasion') || "Celebration";
    const recipient = extractValueFromMultipart(rawPayloadString, 'recipient') || extractValueFromMultipart(rawPayloadString, 'prompt') || "Someone Special";
    const tone = extractValueFromMultipart(rawPayloadString, 'tone') || "festive";
    const message = extractValueFromMultipart(rawPayloadString, 'message') || occasion;

    console.log("=========================================================");
    console.log("📥 PIPELINE DISPATCH LOG:");
    console.log(` -> Prompt Raw Target: ${recipient}`);
    console.log(` -> Occasion Context: ${occasion}`);
    console.log("=========================================================");

    // 2. LLM Pipeline Stage A: Formulate Copywriting Styles
    const copywritingDirectivePrompt = `Analyze this custom card asset parameters:
    Occasion context: "${occasion}", Recipient target: "${recipient}", Desired Tone: "${tone}".
    Select exactly one mapping string: "vibrant_playful", "classic_elegant", "retro_vintage", "modern_minimal".
    Write a 2-3 word cover headline greeting (e.g. HAPPY BIRTHDAY, YOU DID IT).
    Return strict clean JSON: {"style_key": "string_here", "headline_greeting": "phrase_here"}`;

    let cardTextDetails;
    try {
      cardTextDetails = await callLLMProvider(copywritingDirectivePrompt);
    } catch (err) {
      cardTextDetails = { style_key: "modern_minimal", headline_greeting: `${occasion.toUpperCase()}!` };
    }

    const layoutConfig = FRAMING_LAYOUT_ROUTER[cardTextDetails.style_key] || FRAMING_LAYOUT_ROUTER.modern_minimal;

    // 3. LLM Pipeline Stage B: Expand prompt parameters with detailed image generation rules
    const promptExpanderPrompt = `You are an expert card designer. Turn this request into a high-quality 1:1 image generation prompt description for an greeting card cover background design.
    Occasion Theme: "${occasion}"
    Design Topic Context: "${recipient}"
    Tone Vibe: "${tone}"
    
    CRITICAL VISUAL REQUISITE: The card graphic artwork must explicitly capture themes relating to "${recipient}". It must look custom, graphic, modern, vibrant, and tailored for a greeting card cover layout. Do not generate a generic floral card template unless specifically requested.
    
    Return strict JSON: {"expanded_prompt": "your long expanded detailed prompt description layout rules here"}`;

    let expandedPromptPayload;
    try {
      const expansionData = await callLLMProvider(promptExpanderPrompt);
      expandedPromptPayload = expansionData.expanded_prompt;
    } catch (err) {
      expandedPromptPayload = `A beautiful custom greeting card vector illustration cover background for ${occasion}, themed specifically around ${recipient}. Clean graphic design art style.`;
    }

    // Force injection of priority design constraints to make sure the AI updates its scenery
    const highlyEngineeredArtPrompt = `Greeting card graphic illustration art, beautiful vector design layout, vivid composition, focused center design, high definition artwork canvas. Visual theme topic: ${expandedPromptPayload}`.trim();

    const uniqueSeed = Math.floor(Math.random() * 99999) + 1;

    // 4. Trigger FLUX to generate image
    let finalInlineImageSource;
    try {
      console.log("🎨 Sending Live Prompt to Flux:", highlyEngineeredArtPrompt);
      finalInlineImageSource = await generatePrimaryAIImageBase64(highlyEngineeredArtPrompt, uniqueSeed);
    } catch (primaryErr) {
      console.error("❌ DOWNSTREAM FALLBACK ACTIVE:", primaryErr.message);
      finalInlineImageSource = generateSafeLocalFallbackBackground();
    }

    // =========================================================================
    // 5. BYPASS RECTANGLE SPREAD & STREAM THE AI ARTWORK SOURCE DIRECTLY
    // =========================================================================
    // Streams the raw full-scale AI illustration url straight back to Shopify
    const finalStoredImageUrl = finalInlineImageSource;

    return res.status(200).json({
      status: "success",
      file_url: finalStoredImageUrl,
      recipient_context: recipient,
      style_route_confirmed: cardTextDetails.style_key
    });

  } catch (error) {
    console.error("💥 CORE INTEGRATION CRASH OCCURRENCE:", error.message);
    return res.status(200).json({ 
      status: "success", 
      file_url: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MDAiIGhlaWdodD0iODAwIj48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjgwMCIgZmlsbD0iI2Y4ZmFmYyIvPjx0ZXh0IHg9IjQwMCIgeT0iNDAwIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZmlsbD0iIzY0NzQ4YiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+R2VuZXJhdGluZyB5b3VyIEFpIEFydHdvcmsuLi48L3RleHQ+PC9zdmc+" 
    });
  }
}
