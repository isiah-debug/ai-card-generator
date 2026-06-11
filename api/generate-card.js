// =========================================================================
// 1. CONFIGURATION & CLEAN XML NAMESPACES
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

  const optimizedPrompt = `Artistic background illustration for a celebration card canvas, theme context: ${occasion}, stylistic aesthetic vibe: ${tone}, cinematic lighting, flat vector layout design elements, no text, masterpiece painting`;

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
  
  const { occasion, recipient, tone, message } = body;

  // Mandatory input validation layer
  if (!occasion || !recipient) {
    return res.status(400).json({
      status: "error",
      message: "Validation Error: 'occasion' and 'recipient' parameters are required data fields."
    });
  }

  try {
    // Request an ultra-short phrase matching the milestone occasion
    const systemPrompt = `Create an ultra-short, punchy greeting title phrase for a card design based on the celebration occasion: "${occasion}" and tone: "${tone}".
    Return a clean JSON object structure with this exact key:
    "headline_greeting": "A short basic 2-3 word milestone title phrase (e.g. HAPPY BIRTHDAY, CONGRATULATIONS CHAMP! etc.)"`;
    
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
    const sanitizedImageUrl = sanitizeForXML(finalInlineImageSource);

    // Completely clean layout: Recipient and footer text removed, occasion title pushed high up (translate y=180)
    const hybridSvgDocument = `<svg xmlns="${SVG_XMLNS_URI}" viewBox="0 0 800 800" width="100%" height="100%">
      <defs>
        <filter id="drop-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.8"/>
        </filter>
      </defs>

      <rect width="800" height="800" fill="#151c2c" />
      <image href="${sanitizedImageUrl}" x="0" y="0" width="800" height="800" preserveAspectRatio="xMidYMid slice" />
      
      <rect width="800" height="800" fill="none" stroke="#0b0f19" stroke-width="40" stroke-opacity="0.15" />
      <rect x="25" y="25" width="750" height="750" fill="none" stroke="#ffffff" stroke-width="2" stroke-opacity="0.25" />

      <g transform="translate(400, 180)" filter="url(#drop-shadow)">
        <text text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="46" fill="#ffffff" letter-spacing="2" text-transform="uppercase">${sanitizedHeadline}</text>
        <line x1="-60" y1="20" x2="60" y2="20" stroke="#38bdf8" stroke-width="5" stroke-linecap="round" />
      </g>
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
