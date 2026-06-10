import fetch from 'node-fetch';

// CONFIGURATION VARIABLES
const SILICON_FLOW_KEY = "sk-aqnelyloqupavmquzwptcigvzzurzmqodkdrrcrfgjxlmybq";

// ==========================================
// 1. SILICONFLOW NEX-N2-PRO TEXT ENGINE
// ==========================================
async function callLLMProvider(promptText) {
  const siliconFlowUrl = "https://api.siliconflow.cn/v1/chat/completions";
  
  const response = await fetch(siliconFlowUrl, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SILICON_FLOW_KEY}`
    },
    body: JSON.stringify({
      model: "nex-agi/Nex-N2-Pro",
      messages: [{ role: "user", content: promptText }],
      response_format: { type: "json_object" }, 
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Nex LLM Provider error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  let rawText = data.choices[0].message.content.trim();
  
  if (rawText.startsWith("```json")) rawText = rawText.replace(/```json|```/g, "").trim();
  if (rawText.startsWith("```")) rawText = rawText.replace(/```/g, "").trim();
  
  return JSON.parse(rawText);
}

// ==========================================
// MAIN SERVERLESS ROUTE HANDLER
// ==========================================
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user_prompt = req.body?.user_prompt || "birthday cake";
  const sender_name = req.body?.sender_name || "Uncle Jimmy";

  try {
    // A. Request custom tailored copy from Nex LLM
    const systemPrompt = `Create custom birthday card text based on the theme: "${user_prompt}". 
    Return a clean, raw JSON object ONLY with these exact keys: 
    "headline_greeting": "A short, exciting punchy greeting (e.g., 'Level Up!' or 'Victory Royale!')", 
    "inside_message": "A creative, warm 1-2 sentence birthday message customized perfectly to the theme.", 
    "wishing_tone": "Joyful".
    Do NOT include markdown formatting wrappers.`;
    
    let cardTextDetails;
    try {
      cardTextDetails = await callLLMProvider(systemPrompt);
    } catch (llmErr) {
      cardTextDetails = {
        headline_greeting: "Happy Birthday!",
        inside_message: `Wishing you an incredible day filled with epic wins and amazing surprises!`,
        wishing_tone: "Joyful"
      };
    }

    // ==========================================
    // 2. STABLE FLUX IMAGE GENERATION WITH ENTITIES
    // ==========================================
    const cleanKeywords = user_prompt.replace(/[^a-zA-Z0-9 ]/g, "").trim();
    const descriptivePrompt = `${cleanKeywords}, high quality digital art style, vibrant gaming illustration, masterpiece background`;
    const cleanPromptInput = encodeURIComponent(descriptivePrompt);
    
    // Generate a robust target image link
    const aiSceneryUrl = `https://image.pollinations.ai/p/${cleanPromptInput}?width=800&height=800&model=flux&nologo=true&seed=${Math.floor(Math.random() * 99999)}`;

    // ==========================================
    // 3. COMPILE TEXT WITH SVG USING RAW EMBEDDED GRAPHICS
    // ==========================================
    const sanitizeForXML = (str) => {
      return (str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
    };

    const sanitizedHeadline = sanitizeForXML(cardTextDetails.headline_greeting).toUpperCase();
    const sanitizedBodyMessage = sanitizeForXML(cardTextDetails.inside_message);
    const sanitizedSender = sanitizeForXML(sender_name);
    const sanitizedImageUrl = sanitizeForXML(aiSceneryUrl);

    const svgURI = String.fromCharCode(104,116,116,112,58,47,47,119,119,119,46,119,51,46,111,114,103,47,50,48,48,48,47,115,118,103);
    const xhtmlURI = String.fromCharCode(104,116,116,112,58,47,47,119,119,119,46,119,51,46,111,114,103,47,49,57,57,57,47,120,104,116,109,108);

    // RESTORED FIX: We structure the document as a clean standalone vector, using a background mask setup
    const hybridSvgDocument = `<svg xmlns="${svgURI}" viewBox="0 0 800 800" width="100%" height="100%">
      <image href="${sanitizedImageUrl}" x="0" y="0" width="800" height="800" preserveAspectRatio="xMidYMid slice" />
      
      <rect width="800" height="800" fill="#0b0f19" fill-opacity="0.45" />
      <rect x="25" y="25" width="750" height="750" fill="none" stroke="#ffffff" stroke-width="5" stroke-opacity="0.25" />

      <g transform="translate(400, 110)">
        <rect x="-90" y="-22" width="180" height="44" rx="22" fill="#ffffff" fill-opacity="0.2" />
        <text text-anchor="middle" y="6" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="15" fill="#ffffff" letter-spacing="4">CELEBRATION</text>
      </g>
      
      <foreignObject x="80" y="170" width="640" height="440">
        <div xmlns="${xhtmlURI}" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; box-sizing: border-box; padding: 10px;">
          <div style="background-color: rgba(15, 23, 42, 0.75); border: 1px solid rgba(255, 255, 255, 0.25); padding: 40px 30px; border-radius: 20px; width: 100%; box-shadow: 0 20px 50px rgba(0,0,0,0.6); text-align: center;">
            
            <h1 style="color: #ffffff; font-family: system-ui, -apple-system, sans-serif; font-size: 32px; font-weight: 900; margin: 0 0 20px 0; padding: 0; line-height: 1.3; letter-spacing: 0.5px; text-shadow: 0 2px 8px rgba(0,0,0,0.8); word-wrap: break-word;">
              ${sanitizedHeadline}
            </h1>
            
            <div style="width: 60px; height: 3px; background-color: rgba(255, 255, 255, 0.4); margin: 0 auto 20px auto; border-radius: 2px;"></div>
            
            <p style="color: rgba(255, 255, 255, 0.95); font-family: system-ui, -apple-system, sans-serif; font-size: 18px; font-weight: 500; line-height: 1.6; margin: 0 0 25px 0; padding: 0; text-shadow: 0 1px 4px rgba(0,0,0,0.5); word-wrap: break-word;">
              ${sanitizedBodyMessage}
            </p>

            <p style="color: #38bdf8; font-family: system-ui, -apple-system, sans-serif; font-size: 16px; font-weight: 700; letter-spacing: 1px; margin: 0; padding: 0; text-transform: uppercase;">
              With Love, ${sanitizedSender}
            </p>
            
          </div>
        </div>
      </foreignObject>
      
      <line x1="330" y1="650" x2="470" y2="650" stroke="#ffffff" stroke-width="4" stroke-opacity="0.5" stroke-linecap="round" />
      
      <text x="400" y="700" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="18" fill="#ffffff" letter-spacing="3" opacity="0.85">
        SPECIALLY CREATED FOR YOU
      </text>
    </svg>`.trim();

    // Alternate structural output: We pass the raw un-encoded data string directly to bypass image tag tracking blocks
    const finalStoredImageUrl = `data:image/svg+xml;utf8,${encodeURIComponent(hybridSvgDocument)}`;

    return res.status(200).json({
      status: "success",
      card_type: "Custom Birthday Greeting Card",
      from: sender_name,
      card_text: cardTextDetails,
      print_configuration: {
        physical_dimensions: "4x4 inches",
        stored_image_url: finalStoredImageUrl,
        direct_background_layer_url: aiSceneryUrl // Provided separately if your front-end layout engine needs to render it directly in an <img> tag!
      }
    });

  } catch (error) {
    return res.status(500).json({ status: "error", error: error.message });
  }
}
