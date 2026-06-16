// =========================================================================
// 1. CONFIGURATION, ENDPOINTS & UTILITIES
// =========================================================================
const SILICON_FLOW_KEY = process.env.SILICON_FLOW_KEY;

const TEXT_API_URL = "https://api.siliconflow.com/v1/chat/completions";
const IMAGE_API_URL = "https://api.siliconflow.com/v1/images/generations";

const SVG_XMLNS_URI = "http://www.w3.org/2000/svg";

function getRequestBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return req.body;
}

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

// Style variations mapped automatically
const FRAMING_LAYOUT_ROUTER = {
  vibrant_playful: { borderColor: "#FF4A75", accentColor: "#FFD166", strokeWidth: "16", overlayOpacity: "0.08", fontStyleDescription: "bold bubble colorful festive typography" },
  classic_elegant: { borderColor: "#D4AF37", accentColor: "#2C3E50", strokeWidth: "8", overlayOpacity: "0.15", fontStyleDescription: "luxurious gold script copperplate calligraphy text" },
  retro_vintage: { borderColor: "#FF8C42", accentColor: "#FFF2D7", strokeWidth: "12", overlayOpacity: "0.12", fontStyleDescription: "1970s distressed retro bold pop-art lettering" },
  modern_minimal: { borderColor: "#38bdf8", accentColor: "#ffffff", strokeWidth: "4", overlayOpacity: "0.03", fontStyleDescription: "sleek modernist crisp sans-serif geometric clean typeface" }
};

// =========================================================================
// 2. AI COGNITION LAYER (Llama-3-8B)
// =========================================================================
async function callLLMProvider(promptText) {
  if (!SILICON_FLOW_KEY) throw new Error("Missing SILICON_FLOW_KEY.");

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

  if (!response.ok) throw new Error(`LLM Error: ${response.status}`);
  const data = await response.json();
  return cleanAndParseJSON(data.choices[0].message.content);
}

// =========================================================================
// 3. IMAGE GENERATION LAYER (FLUX)
// =========================================================================
async function generatePrimaryAIImageBase64(expandedPrompt, uniqueSeed) {
  if (!SILICON_FLOW_KEY) throw new Error("Missing API Key.");
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

  if (!response.ok) throw new Error(`FLUX Error: ${response.status}`);
  const data = await response.json();
  const asset = data.images[0];
  let piece = typeof asset === 'string' ? asset : (asset.b64_json || asset.url);
  
  if (piece && !piece.startsWith('data:') && !piece.startsWith('http')) {
    return `data:image/png;base64,${piece}`;
  }
  return piece;
}

function generateSafeLocalFallbackBackground() {
  const rawVectorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" fill="#1e293b" /></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(rawVectorSvg).toString('base64')}`;
}

// =========================================================================
// BACKEND ROUTE HANDLER
// =========================================================================
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = getRequestBody(req);
  
  // -----------------------------------------------------------------------
  // VERCEL LIVE LOG STREAM: This shows the frontend fields arriving!
  // -----------------------------------------------------------------------
  console.log("=========================================================");
  console.log("📥 SHOPIFY FRONTEND FIELDS DETECTED:");
  console.log(JSON.stringify(body, null, 2));
  console.log("=========================================================");

  const { occasion, recipient, tone, message, userSelectedTheme } = body;

  if (!occasion || !recipient) {
    return res.status(400).json({ status: "error", message: "Missing required fields." });
  }

  try {
    // 1. Text Generation Step
    const copywritingDirectivePrompt = `Analyze this request: Occasion: "${occasion}", Recipient: "${recipient}", Tone: "${tone || 'festive'}", Message: "${message || ''}".
    Return a strict JSON object structure:
    {
      "style_key": "vibrant_playful", or "classic_elegant", or "retro_vintage", or "modern_minimal",
      "headline_greeting": "Short 2-3 word greeting title phrase (e.g. HAPPY BIRTHDAY)"
    }`;

    let cardTextDetails;
    try {
      cardTextDetails = await callLLMProvider(copywritingDirectivePrompt);
    } catch (err) {
      cardTextDetails = { style_key: "modern_minimal", headline_greeting: `${occasion.toUpperCase()}!` };
    }

    const activeRouteKey = userSelectedTheme || cardTextDetails.style_key;
    const layoutConfig = FRAMING_LAYOUT_ROUTER[activeRouteKey] || FRAMING_LAYOUT_ROUTER.modern_minimal;

    // 2. Profound Prompt Expansion Step (Incorporate User's Input + Native Text Request)
    const promptExpanderPrompt = `You are an art director. Create an explicit graphic design layout prompt for an image engine based on:
    Occasion context: "${occasion}"
    User design idea details: "${message || occasion}"
    
    CRITICAL DIRECTION: The rendering engine MUST physically print the exact text string "${cardTextDetails.headline_greeting}" directly onto the visual design canvas. The text style must look like a clean, beautiful ${layoutConfig.fontStyleDescription}. Ensure beautiful centering, absolute legibility, and correct spelling.
    
    Return strict JSON: {"expanded_prompt": "your long expanded layout illustration prompt rules here"}`;

    let expandedPromptPayload;
    try {
      const expansionData = await callLLMProvider(promptExpanderPrompt);
      expandedPromptPayload = expansionData.expanded_prompt;
      console.log(`🚀 EXPANDED ART PROMPT: "${expandedPromptPayload}"`);
    } catch (err) {
      expandedPromptPayload = `A beautiful greeting card background artwork layout for ${occasion} featuring the words "${cardTextDetails.headline_greeting}" cleanly integrated.`;
    }

    const uniqueSeed = Math.floor(Math.random() * 99999) + 1;

    // 3. Generate FLUX Art with Text Baked In
    let finalInlineImageSource;
    try {
      finalInlineImageSource = await generatePrimaryAIImageBase64(expandedPromptPayload, uniqueSeed);
    } catch (primaryErr) {
      finalInlineImageSource = generateSafeLocalFallbackBackground();
    }

    const sanitizedImageUrl = sanitizeForXML(finalInlineImageSource);

    // 4. Wrap with Dynamic Borders
    const hybridSvgDocument = `<svg xmlns="${SVG_XMLNS_URI}" viewBox="0 0 800 800" width="100%" height="100%">
      <rect width="800" height="800" fill="${layoutConfig.accentColor}" />
      <image href="${sanitizedImageUrl}" x="0" y="0" width="800" height="800" preserveAspectRatio="xMidYMid slice" />
      <rect width="800" height="800" fill="${layoutConfig.borderColor}" opacity="${layoutConfig.overlayOpacity}" />
      <rect width="800" height="800" fill="none" stroke="${layoutConfig.borderColor}" stroke-width="${layoutConfig.strokeWidth}" />
    </svg>`.trim();

    const base64Content = Buffer.from(hybridSvgDocument).toString('base64');
    const finalStoredImageUrl = `data:image/svg+xml;base64,${base64Content}`;

    return res.status(200).json({
      status: "success",
      recipient,
      print_configuration: { stored_image_url: finalStoredImageUrl }
    });

  } catch (error) {
    return res.status(500).json({ status: "error", error: error.message });
  }
}
