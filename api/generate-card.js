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
    // A. Ask Nex to write custom tailored headline and inside messaging
    const systemPrompt = `Create custom birthday card text based on the theme: "${user_prompt}". 
    Return a clean, raw JSON object ONLY with these exact keys: 
    "headline_greeting": "A short, exciting punchy greeting (e.g., 'Level Up, Gamer!' or 'Victory Royale!')", 
    "inside_message": "A creative, warm 1-2 sentence birthday message customized perfectly to the theme.", 
    "wishing_tone": "Joyful".
    Do NOT include markdown formatting wrappers.`;
    
    let cardTextDetails;
    try {
      cardTextDetails = await callLLMProvider(systemPrompt);
    } catch (llmErr) {
      cardTextDetails = {
        headline_greeting: "Happy Birthday!",
        inside_message: `Wishing you an incredible day filled with epic adventures and amazing surprises!`,
        wishing_tone: "Joyful"
      };
    }

    // ==========================================
    // 2. HIGH-FIDELITY FREE FLUX IMAGE BACKDROP
    // ==========================================
    const graphicKeywords = user_prompt.replace(/[^a-zA-Z0-9 ]/g, "").trim();
    const descriptivePrompt = `${graphicKeywords}, digital art style, vibrant gaming illustration, glowing neon accents, 4k background wallpaper`;
    const cleanPromptInput = encodeURIComponent(descriptivePrompt);
    
    // Using XML-safe ampersand tokens (&amp;) to ensure flawless browser asset parsing
    const aiSceneryUrl = `https://image.pollinations.ai/p/${cleanPromptInput}?width=800&amp;height=800&amp;model=flux&amp;nologo=true&amp;seed=${Math.floor(Math.random() * 50000)}`;

    // ==========================================
    // 3. COMPILE HYBRID ARTWORK OVERLAY (SVG)
    // ==========================================
    const sanitizeForXML = (str) => {
      return (str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
    };

    // Grab both custom AI text outputs and pass them safely into the XML template
    const sanitizedHeadline = sanitizeForXML(cardTextDetails.headline_greeting).toUpperCase();
    const sanitizedBodyMessage = sanitizeForXML(cardTextDetails.inside_message);
    const sanitizedSender = sanitizeForXML(sender_name);

    const svgURI = String.fromCharCode(104,116,116,112,58,47,47,119,119,119,46,119,51,46,111,114,103,47,50,48,48,48,47,115,118,103);
    const xhtmlURI = String.fromCharCode(104,116,116,112,58,47,47,119,119,119,46,119,51,46,111,114,103,47,49,57,57,57,47,120,104,116,109,108);

    const hybridSvgDocument = `<svg xmlns="${svgURI}" viewBox="0 0 800 800" width="100%" height="100%">
      <image href="${aiSceneryUrl}" x="0" y="0" width="800" height="800" preserveAspectRatio="xMidYMid slice" />
      
      <rect width="800" height="800" fill="#000000" fill-opacity="0.4" />
      <rect x="25" y="25" width="750" height="750" fill="none" stroke="#ffffff" stroke-width="5" stroke-opacity="0.25" />

      <g transform="translate(400, 110)">
        <rect x="-90" y="-22" width="180" height="44" rx="22" fill="#ffffff" fill-opacity="0.2" />
        <text text-anchor="middle" y="6" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="15" fill="#ffffff" letter-spacing="4">CELEBRATION</text>
      </g>
      
      <foreignObject x="80" y="170" width="640" height="440">
        <div xmlns="${xhtmlURI}" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; box-sizing: border-box; padding: 10px;">
          <div style="background-color: rgba(15, 23, 42, 0.65); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.25); padding: 40px 30px; border-radius: 20px; width: 100%; box-shadow: 0 20px 50px rgba(0,0,0,0.6); text-align: center;">
            
            <h1 style="color: #ffffff; font-family: system-ui, -apple-system, sans-serif; font-size: 32px; font-weight: 900; margin: 0 0 20px 0; padding: 0; line-height: 1.3; letter-spacing: 0.5px; text-shadow: 0 2px 8px rgba(0,0,0,0.8); word-wrap: break-word;">
              ${sanitizedHeadline}
            </h1>
            
            <div style="width: 60px; height: 3px; background-color: rgba(255, 255, 255, 0.4); margin: 0 auto 20px auto; border-radius: 2px;"></div>
            
            <p style="color: rgba(255, 255, 255, 0.9); font-family: system-ui, -apple-system, sans-serif; font-size: 18px; font-weight: 500; line-height: 1.6; margin: 0 0 25px 0; padding: 0; text-shadow: 0 1px 4px rgba(0,0,0,0.5); word-wrap: break-word;">
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
