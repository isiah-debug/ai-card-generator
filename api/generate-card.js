// =========================================================================
// 1. CONFIGURATION, PARSING & PROTECTED STRINGS
// =========================================================================
const SILICON_FLOW_KEY = process.env.SILICON_FLOW_KEY;

const TEXT_API_URL = String.fromCharCode(104,116,116,112,115,58,47,47,97,112,105,46,115,105,108,105,99,111,110,102,108,111,119,46,99,110,47,118,49,47,99,104,97,116,47,99,111,110,112,108,101,116,105,111,110,115);
const IMAGE_API_URL = String.fromCharCode(104,116,116,115,58,47,47,97,112,105,46,115,105,108,105,99,111,110,102,108,111,119,46,99,110,47,118,49,47,105,109,97,103,101,115,47,103,101,110,101,114,97,116,105,111,110,115);
const BACKUP_BASE_URL = String.fromCharCode(104,116,116,115,58,47,47,105,109,97,103,101,46,112,111,108,108,105,110,97,116,105,111,110,115,46,97,105,47,112,47);

const SVG_XMLNS_URI = String.fromCharCode(104,116,116,112,58,47,47,119,119,119,46,119,51,46,111,114,103,47,50,48,48,48,47,115,118,103);
const XHTML_XMLNS_URI = String.fromCharCode(104,116,116,112,58,47,47,119,119,119,46,119,51,46,111,114,103,47,49,57,57,57,47,120,104,116,109,108);

function getRequestBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return req.body;
}

// Helper function to safely convert any external URL image into a secure Base64 Data URI
async function convertUrlToBase64(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'image/png';
    const base64String = Buffer.from(arrayBuffer).toString('base64');
    return `data:${contentType};base64,${base64String}`;
  } catch (e) {
    return null;
  }
}

// =========================================================================
// 2. SILICONFLOW TEXT ENGINE (NEX-N2-PRO)
// =========================================================================
async function callLLMProvider(promptText) {
  if (!SILICON_FLOW_KEY || !SILICON_FLOW_KEY.startsWith("sk-")) {
    throw new Error("Missing or invalid SILICON_FLOW_KEY configuration.");
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
      response_format: { type: "json_object" }, 
      temperature: 0.8
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LLM Error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  let rawText = data.choices[0].message.content.trim();
  
  if (rawText.startsWith("```json")) rawText = rawText.replace(/```json|```/g, "").trim();
  if (rawText.startsWith("```")) rawText = rawText.replace(/```/g, "").trim();
  
  return JSON.parse(rawText);
}

// =========================================================================
// 3. PRIMARY AI IMAGE ENGINE (SILICONFLOW SDXL)
// =========================================================================
async function generatePrimaryAIImage(promptText, uniqueSeed) {
  if (!SILICON_FLOW_KEY || !SILICON_FLOW_KEY.startsWith("sk-")) {
    throw new Error("Invalid API key configuration layout.");
  }

  const response = await fetch(IMAGE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SILICON_FLOW_KEY.trim()}`
    },
    body: JSON.stringify({
      model: "stabilityai/stable-diffusion-xl",
      prompt: `${promptText.trim()}, vibrant colors, clean digital illustration, gaming presentation wallpaper backdrop, masterpiece art background, no text`,
      negative_prompt: "ugly, blurry, low quality, text, words, logos, watermark, signatures, letters, frame, border, interface, UI",
      image_size: "1024x1024",
      seed: uniqueSeed,
      num_inference_steps: 20
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Primary image generation error: ${errText}`);
  }

  const data = await response.json();
  if (!data.images || data.images.length === 0) {
    throw new Error("Empty image payload from cluster.");
  }
  
  const asset = data.images[0];
  let imgUrl = typeof asset === 'string' ? asset : (asset.url || asset.b64_json);

  if (imgUrl.startsWith('http')) {
    const base64Data = await convertUrlToBase64(imgUrl);
    if (base64Data) return base64Data;
  }
  
  if (imgUrl && !imgUrl.startsWith('data:')) {
    return `data:image/png;base64,${imgUrl}`;
  }
  return imgUrl;
}

// =========================================================================
// 4. BACKUP AI IMAGE ENGINE (POLLINATIONS FLUX SYSTEM)
// =========================================================================
async function generateBackupAIImage(promptText, uniqueSeed) {
  const enhancedAIPrompt = encodeURIComponent(`${promptText}, stylized fantasy vector backdrop illustration, no text`);
  const remoteUrl = `${BACKUP_BASE_URL}${enhancedAIPrompt}?width=800&height=800&model=flux&seed=${uniqueSeed}&nologo=true`;
  
  const base64Data = await convertUrlToBase64(remoteUrl);
  if (base64Data) return base64Data;

  // Fallback structural layout if both networks throw exceptions
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800"><rect width="800" height="800" fill="%23111827"/><path d="M0 500 L200 350 L450 600 L650 400 L800 550 L800 800 L0 800 Z" fill="%231f2937" opacity="0.5"/><path d="M0 600 L300 450 L550 700 L800 520 L800 800 L0 800 Z" fill="%23374151" opacity="0.3"/></svg>`;
}

// =========================================================================
// MAIN SERVERLESS ROUTE HANDLER
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
    // A. Generate Custom AI Wording Content
    const systemPrompt = `Create custom birthday card text based on the theme: "${user_prompt}". 
    Return a clean, raw JSON object ONLY with these exact keys: 
    "headline_greeting": "A short, exciting punchy greeting matching the theme context.", 
    "inside_message": "A creative, warm 1-2 sentence birthday message customized perfectly to the theme.", 
    "wishing_tone": "Joyful".
    Do NOT include markdown formatting wrappers.`;
    
    let cardTextDetails;
    try {
      cardTextDetails = await callLLMProvider(systemPrompt);
    } catch (err) {
      const lower = user_prompt.toLowerCase();
      if (lower.includes("mine") || lower.includes("block") || lower.includes("craft")) {
        cardTextDetails = {
          headline_greeting: "BLOCK-TASTIC DAY!",
          inside_message: `Wishing you an awesome adventure on your birthday! May your day be filled with rare discoveries, grand creations, and endless exploration across your world!`,
          wishing_tone: "Joyful"
        };
      } else {
        cardTextDetails = {
          headline_greeting: "VICTORY ROYALE!",
          inside_message: `Wishing you an incredible birthday filled with epic wins, legendary loot, and non-stop celebrations!`,
          wishing_tone: "Joyful"
        };
      }
    }

    const uniqueSeed = Math.floor(Math.random() * 9999999);

    // B. AI-Powered Image Generation Pipeline
    let verifiedImageSource;
    try {
      verifiedImageSource = await generatePrimaryAIImage(user_prompt, uniqueSeed);
    } catch (primaryErr) {
      verifiedImageSource = await generateBackupAIImage(user_prompt, uniqueSeed);
    }

    // C. Clean XML Safety Map Sanitize
    const sanitizeForXML = (str) => {
      return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
    };

    const sanitizedHeadline = sanitizeForXML(cardTextDetails.headline_greeting).toUpperCase();
    const sanitizedBodyMessage = sanitizeForXML(cardTextDetails.inside_message);
    const sanitizedSender = sanitizeForXML(sender_name);
    const sanitizedImageUrl = sanitizeForXML(verifiedImageSource);

    // D. Assemble Structured SVG Blueprint
    const hybridSvgDocument = `<svg xmlns="${SVG_XMLNS_URI}" viewBox="0 0 800 800" width="100%" height="100%">
      <rect width="800" height="800" fill="#151c2c" />
      <image href="${sanitizedImageUrl}" x="0" y="0" width="800" height="800" preserveAspectRatio="xMidYMid slice" />
      
      <rect width="800" height="800" fill="#0b0f19" fill-opacity="0.45" />
      <rect x="25" y="25" width="750" height="750" fill="none" stroke="#ffffff" stroke-width="5" stroke-opacity="0.15" />

      <g transform="translate(400, 110)">
        <rect x="-90" y="-22" width="180" height="44" rx="22" fill="#ffffff" fill-opacity="0.15" />
        <text text-anchor="middle" y="6" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="15" fill="#ffffff" letter-spacing="4">CELEBRATION</text>
      </g>
      
      <foreignObject x="80" y="170" width="640" height="440">
        <div xmlns="${XHTML_XMLNS_URI}" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; box-sizing: border-box; padding: 10px;">
          <div style="background-color: rgba(15, 23, 42, 0.9); border: 1px solid rgba(255, 255, 255, 0.15); padding: 40px 30px; border-radius: 20px; width: 100%; box-shadow: 0 20px 50px rgba(0,0,0,0.5); text-align: center;">
            <h1 style="color: #ffffff; font-family: system-ui, -apple-system, sans-serif; font-size: 28px; font-weight: 900; margin: 0 0 18px 0; line-height: 1.3; letter-spacing: 0.5px; text-shadow: 0 2px 8px rgba(0,0,0,0.7); word-wrap: break-word;">${sanitizedHeadline}</h1>
            <div style="width: 50px; height: 3px; background-color: rgba(255, 255, 255, 0.3); margin: 0 auto 20px auto; border-radius: 2px;"></div>
            <p style="color: rgba(255, 255, 255, 0.95); font-family: system-ui, -apple-system, sans-serif; font-size: 18px; font-weight: 500; line-height: 1.6; margin: 0 0 25px 0; text-shadow: 0 1px 4px rgba(0,0,0,0.4); word-wrap: break-word;">${sanitizedBodyMessage}</p>
            <p style="color: #38bdf8; font-family: system-ui, -apple-system, sans-serif; font-size: 16px; font-weight: 700; letter-spacing: 1px; margin: 0; text-transform: uppercase;">With Love, ${sanitizedSender}</p>
          </div>
        </div>
      </foreignObject>
      
      <line x1="330" y1="650" x2="470" y2="650" stroke="#ffffff" stroke-width="4" stroke-opacity="0.3" stroke-linecap="round" />
      <text x="400" y="700" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="18" fill="#ffffff" letter-spacing="3" opacity="0.75">SPECIALLY CREATED FOR YOU</text>
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
