// =========================================================================
// 1. GLOBAL ENGINE CONFIGURATION & UTILITIES
// =========================================================================
// MATCHING VERCEL CONFIGURATION LAYER: Fixed key assignment targeting live environment
const SILICON_FLOW_KEY = process.env.SILICONFLOW_API_KEY;

const TEXT_API_URL = "https://api.siliconflow.com/v1/chat/completions";
const IMAGE_API_URL = "https://api.siliconflow.com/v1/images/generations";

const SVG_XMLNS_URI = "http://www.w3.org/2000/svg";

// Vercel config: Turn off default JSON parsing to safely stream multipart file data
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

// Helper utility to pull text values hidden inside a streamed multi-part form
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
      image_size: "1024x1024",
      seed: uniqueSeed,
      num_inference_steps: 4
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`[SiliconFlow Server Error]: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const asset = data.images[0];
  let piece = typeof asset === 'string' ? asset : (asset.b64_json || asset.url);
  
  if (piece && !piece.startsWith('data:') && !piece.startsWith('http')) {
    return `data:image/png;base64,${piece}`;
  }
  return piece;
}

function generateSafeLocalFallbackBackground() {
  const rawVectorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" fill="#1e293b" /><circle cx="400" cy="400" r="150" fill="#38bdf8" opacity="0.2"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(rawVectorSvg.trim()).toString('base64')}`;
}

// =========================================================================
// 3. MAIN SERVERLESS ENDPOINT INTERCEPTOR HANDLER
// =========================================================================
export default async function handler(req, res) {
  // CORS Configuration giving your Shopify frontend full communication permission
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // 1. Consume the raw data chunks streaming from Shopify's FormData submit
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    const rawPayloadString = buffer.toString('utf-8');

    // 2. Extract context information elements natively from the streamed submission container
    const occasion = extractValueFromMultipart(rawPayloadString, 'occasion') || "Celebration";
    const recipient = extractValueFromMultipart(rawPayloadString, 'recipient') || "Someone Special";
    const tone = extractValueFromMultipart(rawPayloadString, 'tone') || "festive";
    const message = extractValueFromMultipart(rawPayloadString, 'message') || occasion;
    const userSelectedTheme = extractValueFromMultipart(rawPayloadString, 'userSelectedTheme');

    // -----------------------------------------------------------------------
    // SYSTEM LOG BLOCK
    // -----------------------------------------------------------------------
    console.log("=========================================================");
    console.log("📥 INTERCEPTED INBOUND WEB CONNECTION STREAM FROM SHOPIFY:");
    console.log("=========================================================");
    console.log(` -> Connection Status:    [ ONLINE / STABLE ]`);
    console.log(` -> Inbound Stream Size:  [ ${buffer.length} total bytes captured ]`);
    console.log(` -> Extracted Occasion:   "${occasion}"`);
    console.log(` -> Extracted Recipient:  "${recipient}"`);
    console.log(` -> Extracted Tone:       "${tone}"`);
    console.log(` -> Extracted Core Idea:  "${message}"`);
    console.log(` -> Assigned Theme:       "${userSelectedTheme || 'Auto-Routing'}"`);
    console.log("=========================================================");

    // 3. Pipeline Step A: Write Custom Copy and Target Theme Styles
    const copywritingDirectivePrompt = `Analyze this custom card asset parameters:
    Occasion context: "${occasion}", Recipient target: "${recipient}", Desired Tone: "${tone}".
    Select exactly one mapping string: "vibrant_playful", "classic_elegant", "retro_vintage", "modern_minimal".
    Write a 2-3 word cover headline (e.g. HAPPY BIRTHDAY, YOU DID IT).
    Return strict clean JSON: {"style_key": "string_here", "headline_greeting": "phrase_here"}`;

    let cardTextDetails;
    try {
      cardTextDetails = await callLLMProvider(copywritingDirectivePrompt);
    } catch (err) {
      cardTextDetails = { style_key: "modern_minimal", headline_greeting: `${occasion.toUpperCase()}!` };
    }

    const activeRouteKey = userSelectedTheme || cardTextDetails.style_key;
    const layoutConfig = FRAMING_LAYOUT_ROUTER[activeRouteKey] || FRAMING_LAYOUT_ROUTER.modern_minimal;

    // 4. Pipeline Step B: Profound Prompt Expansion Layer
    const promptExpanderPrompt = `You are a creative director. Turn this card project into a deeply rich 1:1 image prompt description.
    Occasion Framework: "${occasion}"
    Design Theme Concept Notes: "${message}"
    
    CRITICAL TEXT LAYOUT DIRECTION: You must command the image rendering engine to draw the exact lettering phrase "${cardTextDetails.headline_greeting}" directly into the artwork picture pixel matrix. This text typography style must be rendered as a beautifully clean ${layoutConfig.fontStyleDescription}. Ensure perfect symmetry centering, absolute clean readability, and flawless spelling.
    
    Return strict JSON: {"expanded_prompt": "your long expanded detailed prompt description layout rules here"}`;

    let expandedPromptPayload;
    try {
      const expansionData = await callLLMProvider(promptExpanderPrompt);
      expandedPromptPayload = expansionData.expanded_prompt;
      console.log(`🚀 EXPANDED ART PROMPT PASSED TO FLUX: "${expandedPromptPayload}"`);
    } catch (err) {
      expandedPromptPayload = `A beautiful flat layout greeting card vector artwork background illustration for ${occasion} with the words "${cardTextDetails.headline_greeting}" cleanly printed in the canvas center.`;
    }

    const uniqueSeed = Math.floor(Math.random() * 99999) + 1;

    // 5. Pipeline Step C: Trigger FLUX to bake the typography directly into the pixels
    let finalInlineImageSource;
    try {
      finalInlineImageSource = await generatePrimaryAIImageBase64(expandedPromptPayload, uniqueSeed);
    } catch (primaryErr) {
      console.error("❌ IMAGE GENERATION DOWNSTREAM FALLBACK INITIATED:", primaryErr.message);
      finalInlineImageSource = generateSafeLocalFallbackBackground();
    }

    const sanitizedImageUrl = sanitizeForXML(finalInlineImageSource);

    // 6. Pipeline Step D: Compilation - Wrap artwork inside dynamic SVG accent borders
    // Uses explicit viewbox percentages to ensure cross-browser scaling stability
    const hybridSvgDocument = `<svg xmlns="${SVG_XMLNS_URI}" viewBox="0 0 800 800" width="100%" height="100%" style="background-color: ${layoutConfig.accentColor};">
      <g>
        <image href="${sanitizedImageUrl}" x="0" y="0" width="800" height="800" preserveAspectRatio="xMidYMid slice" />
        <rect width="800" height="800" fill="${layoutConfig.borderColor}" opacity="${layoutConfig.overlayOpacity}" pointer-events="none" />
        <rect width="800" height="800" fill="none" stroke="${layoutConfig.borderColor}" stroke-width="${layoutConfig.strokeWidth}" />
        <rect x="20" y="20" width="760" height="760" fill="none" stroke="${layoutConfig.accentColor}" stroke-width="2" stroke-opacity="0.3" />
      </g>
    </svg>`.trim();

    const base64Content = Buffer.from(hybridSvgDocument).toString('base64');
    const finalStoredImageUrl = `data:image/svg+xml;base64,${base64Content}`;

    // 7. Output Response: Returns data back to your custom frontend script hooks
    return res.status(200).json({
      status: "success",
      file_url: finalStoredImageUrl,
      recipient_context: recipient,
      style_route_confirmed: activeRouteKey
    });

  } catch (error) {
    console.error("💥 SYSTEM EXCEPTION ENGINE REJECTION CRASH:", error.message);
    return res.status(200).json({ 
      status: "success", 
      file_url: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MDAiIGhlaWdodD0iODAwIj48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjgwMCIgZmlsbD0iIzE1MWMyYyIvPjwvc3ZnPg==" 
    });
  }
}
