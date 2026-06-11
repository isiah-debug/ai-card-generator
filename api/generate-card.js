// =========================================================================
// 1. CONFIGURATION & CLEAN XML NAMESPACES
// =========================================================================
const SILICON_FLOW_KEY = process.env.SILICON_FLOW_KEY;

const TEXT_API_URL = "https://api.siliconflow.com/v1/chat/completions";
const IMAGE_API_URL = "https://api.siliconflow.com/v1/images/generations";

const SVG_XMLNS_URI = "http://www.w3.org/2000/svg";
const XHTML_XMLNS_URI = "http://www.w3.org/1999/xhtml";

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

// =========================================================================
// 2. TEXT COGNITION LAYER (NEX-N2-PRO)
// =========================================================================
async function callLLMProvider(promptText) {
  if (!SILICON_FLOW_KEY) {
    throw new Error("Missing SILICON_FLOW_KEY configuration variable layout.");
  }

  const response = await fetch(TEXT_API_URL, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SILICON_FLOW_KEY.trim()}`
    },
    body: JSON.stringify({
      model: "nex-agi/Nex-N2-Pro",
      messages: [{ role: "user", content: promptText }],
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LLM Response Error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  if (!data.choices || data.choices.length === 0) {
    throw new Error("Returned content block collection is completely empty.");
  }
  return cleanAndParseJSON(data.choices[0].message.content);
}

// =========================================================================
// 3. IMAGE GENERATION (DYNAMIC PIPELINE WITH FLUX)
// =========================================================================
async function generatePrimaryAIImageBase64(occasion, tone, uniqueSeed) {
  if (!SILICON_FLOW_KEY) {
    throw new Error("Invalid key format structure configuration layout.");
  }

  let cleanKey = SILICON_FLOW_KEY.trim();
  if (cleanKey.toLowerCase().startsWith("bearer ")) {
    cleanKey = cleanKey.slice(7).trim();
  }

  // Uses occasion and tone properties to construct a customized thematic asset backdrop
  const optimizedPrompt = `Artistic background illustration for a celebration card, theme context: ${occasion}, stylistic aesthetic vibe: ${tone}, cinematic lighting, flat vector layout design elements, no text, masterpiece painting`;

  const response = await fetch(IMAGE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cleanKey}`
    },
    body: JSON.stringify({
      model: "black-forest-labs/FLUX.1-schnell",
      prompt: optimizedPrompt,
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
  if (!data.images || data.images.length === 0) {
    throw new Error("Empty image asset block return vector matrix array.");
  }
  
  const asset = data.images[0];
  let piece = typeof asset === 'string' ? asset : (asset.b64_json || asset.url);
  
  if (piece && !piece.startsWith('data:') && !piece.startsWith('http')) {
    return `data:image/png;base64,${piece}`;
  }
  return piece;
}

function generateSafeLocalFallbackBackground() {
  const rawVectorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800"><rect width="800" height="800" fill="#1e293b" /><circle cx="400" cy="400" r="300" fill="#38bdf8" fill-opacity="0.1" /><rect width="800" height="800" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="20" /></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(rawVectorSvg.trim()).toString('base64')}`;
}

// =========================================================================
// MAIN SERVERLESS ENDPOINT ROUTE
// =========================================================================
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = getRequestBody(req);
  
  // EXTRACTION & REQUIREMENT 1: Dynamic mapping to new frontend fields
  const { occasion, recipient, tone, message } = body;

  // REQUIREMENT 2: Basic Input Validation Layer
  if (!occasion || !recipient) {
    return res.status(400).json({
      status: "error",
      message: "Validation Error: 'occasion' and 'recipient' parameters are required data fields."
    });
  }

  try {
    // REQUIREMENT 3: Instructs LLM to formulate short expressions instead of full paragraphs
    const systemPrompt = `Create an ultra-short, punchy greeting title text block for a greeting card design based on the celebration occasion: "${occasion}" and tone: "${tone}".
    Return a clean JSON object structure with this exact key:
    "headline_greeting": "A short basic 2-4 word milestone title phrase (e.g. HAPPY BIRTHDAY, CONGRATULATIONS CHAMP! etc.)"`;
    
    let cardTextDetails;
    try {
      cardTextDetails = await callLLMProvider(systemPrompt);
      if (!cardTextDetails.headline_greeting) {
        throw new Error("Key fields parsed out empty.");
      }
    } catch (err) {
      cardTextDetails = {
        headline_greeting: `${occasion.toUpperCase()}!`
      };
    }

    const uniqueSeed = Math.floor(Math.random() * 99999) + 1;

    let finalInlineImageSource;
    try {
      finalInlineImageSource = await generatePrimaryAIImageBase64(occasion, tone || "festive", uniqueSeed);
    } catch (primaryErr) {
      console.error("=== IMAGE PIPELINE FAILURE ===", primaryErr.message);
      finalInlineImageSource = generateSafeLocalFallbackBackground();
    }

    const sanitizedHeadline = sanitizeForXML(cardTextDetails.headline_greeting).toUpperCase();
    const sanitizedRecipient = sanitizeForXML(recipient).toUpperCase();
    const sanitizedImageUrl = sanitizeForXML(finalInlineImageSource);

    // Dynamic clean SVG structure omitting paragraph card frames
    const hybridSvgDocument = `<svg xmlns="${SVG_XMLNS_URI}" viewBox="0 0 800 800" width="100%" height="100%">
      <rect width="800" height="800" fill="#151c2c" />
      <image href="${sanitizedImageUrl}" x="0" y="0" width="800" height="800" preserveAspectRatio="xMidYMid slice" />
      
      <rect width="800" height="800" fill="#0b0f19" fill-opacity="0.4" />
      <rect x="25" y="25" width="750" height="750" fill="none" stroke="#ffffff" stroke-width="5" stroke-opacity="0.2" />

      <g transform="translate(400, 260)">
        <rect x="-90" y="-22" width="180" height="44" rx="22" fill="#ffffff" fill-opacity="0.15" />
        <text text-anchor="middle" y="6" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="15" fill="#ffffff" letter-spacing="4">CELEBRATION</text>
      </g>
      
      <foreignObject x="80" y="320" width="640" height="300">
        <div xmlns="${XHTML_XMLNS_URI}" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; box-sizing: border-box; padding: 10px;">
          <div style="background-color: rgba(11, 15, 25, 0.8); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.2); padding: 35px 30px; border-radius: 20px; width: 100%; box-shadow: 0 20px 50px rgba(0,0,0,0.6); text-align: center;">
            <h1 style="color: #ffffff; font-family: system-ui, -apple-system, sans-serif; font-size: 32px; font-weight: 900; margin: 0 0 12px 0; line-height: 1.2; letter-spacing: 1px; text-shadow: 0 2px 8px rgba(0,0,0,0.8);">${sanitizedHeadline}</h1>
            <div style="width: 60px; height: 3px; background-color: #38bdf8; margin: 0 auto 15px auto; border-radius: 2px;"></div>
            <p style="color: #38bdf8; font-family: system-ui, -apple-system, sans-serif; font-size: 18px; font-weight: 800; letter-spacing: 2px; margin: 0; text-transform: uppercase;">FOR: ${sanitizedRecipient}</p>
          </div>
        </div>
      </foreignObject>
      
      <text x="400" y="720" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="16" fill="#ffffff" letter-spacing="3" opacity="0.7">SPECIALLY CREATED FOR YOU</text>
    </svg>`.trim();

    const base64Content = Buffer.from(hybridSvgDocument).toString('base64');
    const finalStoredImageUrl = `data:image/svg+xml;base64,${base64Content}`;

    return res.status(200).json({
      status: "success",
      card_type: "Custom Simplified Greeting Card",
      recipient: recipient,
      tone_context: tone || "default",
      user_message_retained: message || "",
      card_text: cardTextDetails,
      print_configuration: {
        physical_dimensions: "4x4 inches",
        stored_image_url: finalStoredImageUrl
      }
    });

  } catch (error) {
    return res.status(500).json({ status: "error", error: error.message });
  }
}
