// =========================================================================
// 1. CONFIGURATION & CLEAN XML NAMESPACES
// =========================================================================
const SILICON_FLOW_KEY = process.env.SILICON_FLOW_KEY;

const TEXT_API_URL = "https://api.siliconflow.cn/v1/chat/completions";
const IMAGE_API_URL = "https://api.siliconflow.cn/v1/images/generations";

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
  if (!SILICON_FLOW_KEY || !SILICON_FLOW_KEY.startsWith("sk-")) {
    throw new Error("Missing or invalid SILICON_FLOW_KEY configuration variable layout.");
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
async function generatePrimaryAIImageBase64(promptText, uniqueSeed) {
  if (!SILICON_FLOW_KEY || !SILICON_FLOW_KEY.startsWith("sk-")) {
    throw new Error("Invalid key format structure configuration layout.");
  }

  const optimizedPrompt = `${promptText.trim()}, retro cubic block landscape voxel artwork, pixel art style, blue sky, cinematic lighting, no text, masterpiece painting`;

  const response = await fetch(IMAGE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SILICON_FLOW_KEY.trim()}`
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

// Fallback vector graphic
function generateSafeLocalFallbackBackground() {
  const rawVectorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800"><rect width="800" height="800" fill="#5cafff" /><rect x="550" y="80" width="90" height="90" fill="#fffebd" /><rect x="540" y="70" width="110" height="110" fill="#ffffd6" fill-opacity="0.3" /><g fill="#ffffff" fill-opacity="0.85"><rect x="60" y="120" width="220" height="40" /><rect x="100" y="100" width="140" height="20" /><rect x="420" y="160" width="180" height="30" /></g><g fill="#2b593f"><rect x="0" y="380" width="200" height="420" /><rect x="150" y="340" width="160" height="460" /><rect x="280" y="400" width="120" height="400" /><rect x="360" y="320" width="220" height="480" /><rect x="540" y="360" width="260" height="440" /></g><g fill="#4a852c"><rect x="0" y="460" width="800" height="340" /></g><g fill="#376620"><rect x="80" y="460" width="60" height="40" /><rect x="240" y="460" width="80" height="30" /><rect x="480" y="460" width="100" height="50" /><rect x="680" y="460" width="70" height="40" /></g><g fill="#40542a"><rect x="100" y="500" width="600" height="240" /><rect x="140" y="480" width="520" height="20" /></g><g fill="#1d61a1" fill-opacity="0.9"><rect x="120" y="510" width="560" height="210" /><rect x="150" y="490" width="500" height="20" /></g><g fill="#3782c9" fill-opacity="0.6"><rect x="180" y="530" width="80" height="20" /><rect x="440" y="520" width="120" height="20" /><rect x="260" y="600" width="140" height="30" /><rect x="480" y="640" width="90" height="20" /><rect x="160" y="660" width="110" height="25" /></g><rect width="800" height="800" fill="none" stroke="rgba(0,0,0,0.15)" stroke-width="20" /></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(rawVectorSvg.trim()).toString('base64')}`;
}

// =========================================================================
// MAIN SERVERLESS ENDPOINT ROUTE (DIAGNOSTIC MODE)
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
  const user_prompt = body.user_prompt || "Minecraft skyblock island adventure";
  const sender_name = body.sender_name || "Sarah";

  try {
    const systemPrompt = `Create custom birthday card text based on the theme: "${user_prompt}".
    Return a clean JSON object code structure with these exact keys:
    "headline_greeting": "A short, exciting greeting matching the theme context.",
    "inside_message": "A creative, warm 1-2 sentence birthday message customized to the theme."`;
    
    let cardTextDetails;
    try {
      cardTextDetails = await callLLMProvider(systemPrompt);
      if (!cardTextDetails.headline_greeting || !cardTextDetails.inside_message) {
        throw new Error("Key fields parsed out empty.");
      }
    } catch (err) {
      cardTextDetails = {
        headline_greeting: "BLOCK-TASTIC DAY!",
        inside_message: `Wishing you an awesome adventure on your birthday! May your day be filled with rare discoveries, grand creations, and endless exploration across your world!`
      };
    }

    const uniqueSeed = Math.floor(Math.random() * 99999) + 1;

    let finalInlineImageSource;
    try {
      finalInlineImageSource = await generatePrimaryAIImageBase64(user_prompt, uniqueSeed);
    } catch (primaryErr) {
      // STOP HIDING THE ERROR: This sends the real reason straight back to ReqBin!
      return res.status(500).json({
        status: "error",
        error_phase: "SiliconFlow Image Generation Pipeline",
        message: primaryErr.message,
        suggestion: "Check your SiliconFlow console for billing issues, model configurations, or token limits."
      });
    }

    // Forces sender name to uppercase capitals automatically
    const sanitizedHeadline = sanitizeForXML(cardTextDetails.headline_greeting).toUpperCase();
    const sanitizedBodyMessage = sanitizeForXML(cardTextDetails.inside_message);
    const sanitizedSender = sanitizeForXML(sender_name).toUpperCase(); 
    const sanitizedImageUrl = sanitizeForXML(finalInlineImageSource);

    const hybridSvgDocument = `<svg xmlns="${SVG_XMLNS_URI}" viewBox="0 0 800 800" width="100%" height="100%">
      <rect width="800" height="800" fill="#151c2c" />
      <image href="${sanitizedImageUrl}" x="0" y="0" width="800" height="800" preserveAspectRatio="xMidYMid slice" />
      
      <rect width="800" height="800" fill="#0b0f19" fill-opacity="0.3" />
      <rect x="25" y="25" width="750" height="750" fill="none" stroke="#ffffff" stroke-width="5" stroke-opacity="0.2" />

      <g transform="translate(400, 110)">
        <rect x="-90" y="-22" width="180" height="44" rx="22" fill="#ffffff" fill-opacity="0.15" />
        <text text-anchor="middle" y="6" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="15" fill="#ffffff" letter-spacing="4">CELEBRATION</text>
      </g>
      
      <foreignObject x="80" y="170" width="640" height="440">
        <div xmlns="${XHTML_XMLNS_URI}" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; box-sizing: border-box; padding: 10px;">
          <div style="background-color: rgba(11, 15, 25, 0.75); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.2); padding: 40px 30px; border-radius: 20px; width: 100%; box-shadow: 0 20px 50px rgba(0,0,0,0.6); text-align: center;">
            <h1 style="color: #ffffff; font-family: system-ui, -apple-system, sans-serif; font-size: 28px; font-weight: 900; margin: 0 0 18px 0; line-height: 1.3; letter-spacing: 0.5px; text-shadow: 0 2px 8px rgba(0,0,0,0.8); word-wrap: break-word;">${sanitizedHeadline}</h1>
            <div style="width: 50px; height: 3px; background-color: #38bdf8; margin: 0 auto 20px auto; border-radius: 2px;"></div>
            <p style="color: rgba(255, 255, 255, 0.95); font-family: system-ui, -apple-system, sans-serif; font-size: 18px; font-weight: 500; line-height: 1.6; margin: 0 0 25px 0; text-shadow: 0 1px 4px rgba(0,0,0,0.5); word-wrap: break-word;">${sanitizedBodyMessage}</p>
            <p style="color: #38bdf8; font-family: system-ui, -apple-system, sans-serif; font-size: 16px; font-weight: 700; letter-spacing: 1px; margin: 0; text-transform: uppercase;">With Love, ${sanitizedSender}</p>
          </div>
        </div>
      </foreignObject>
      
      <line x1="330" y1="650" x2="470" y2="650" stroke="#ffffff" stroke-width="4" stroke-opacity="0.3" stroke-linecap="round" />
      <text x="400" y="700" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="18" fill="#ffffff" letter-spacing="3" opacity="1">SPECIALLY CREATED FOR YOU</text>
    </svg>`.trim();

    const base64Content = Buffer.from(hybridSvgDocument).toString('base64');
    const finalStoredImageUrl = `data:image/svg+xml;base64,${base64Content}`;

    return res.status(200).json({
      status: "success",
      card_type: "Custom Birthday Greeting Card",
      from: sender_name,
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
