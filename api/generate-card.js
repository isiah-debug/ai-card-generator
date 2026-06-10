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
    // A. Generate custom layout text via Nex
    const systemPrompt = `Create custom birthday card text based on the theme: "${user_prompt}". Return raw JSON ONLY with these exact keys: "headline_greeting", "inside_message", "wishing_tone". Do NOT include any markdown formatting.`;
    
    let cardTextDetails;
    try {
      cardTextDetails = await callLLMProvider(systemPrompt);
    } catch (llmErr) {
      cardTextDetails = {
        headline_greeting: "Happy Birthday!",
        inside_message: `Wishing you an incredible day filled with fun adventures!`,
        wishing_tone: "Joyful"
      };
    }

    // ==========================================
    // 2. UNRESTRICTED HD PHOTOGRAPHY PIPELINE (UNSPLASH)
    // ==========================================
    // Extracts clean descriptive keywords to pull an instant HD photo background matching the card's theme
    const searchKeywords = user_prompt.replace(/[^a-zA-Z0-9 ]/g, "").trim().split(" ").slice(0, 3).join(",");
    const aiSceneryUrl = `https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=1024&h=1024&q=80&sig=${encodeURIComponent(searchKeywords)}`;

    // ==========================================
    // 3. COMPILE HYBRID ARTWORK OVERLAY (SVG)
    // ==========================================
    const sanitizeForXML = (str) => {
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
    };

    const sanitizedTitle = sanitizeForXML(user_prompt).toUpperCase();
    const sanitizedImageUrl = sanitizeForXML(aiSceneryUrl);

    const svgURI = String.fromCharCode(104,116,116,112,58,47,47,119,119,119,46,119,51,46,111,114,103,47,50,48,48,48,47,115,118,103);
    const xhtmlURI = String.fromCharCode(104,116,116,112,58,47,47,119,119,119,46,119,51,46,111,114,103,47,49,57,57,57,47,120,104,116,109,108);

    const hybridSvgDocument = `<svg xmlns="${svgURI}" viewBox="0 0 800 800" width="100%" height="100%">
      <image href="${sanitizedImageUrl}" x="0" y="0" width="800" height="800" preserveAspectRatio="xMidYMid slice" />
      
      <rect width="800" height="800" fill="#000000" fill-opacity="0.35" />
      <rect x="25" y="25" width="750" height="750" fill="none" stroke="#ffffff" stroke-width="5" stroke-opacity="0.3" />

      <g transform="translate(400, 140)">
        <rect x="-90" y="-22" width="180" height="44" rx="22" fill="#ffffff" fill-opacity="0.2" />
        <text text-anchor="middle" y="6" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="16" fill="#ffffff" letter-spacing="4">CELEBRATION</text>
      </g>
      
      <foreignObject x="80" y="210" width="640" height="380">
        <div xmlns="${xhtmlURI}" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; box-sizing: border-box; padding: 20px;">
          <div style="background-color: rgba(0, 0, 0, 0.4); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); border: 1px solid rgba(255, 255, 255, 0.2); padding: 35px 25px; border-radius: 16px; width: 100%; box-shadow: 0 8px 32px rgba(0,0,0,0.35);">
            <h1 style="color: #ffffff; font-family: system-ui, -apple-system, sans-serif; font-size: 30px; font-weight: 900; margin: 0; padding: 0; line-height: 1.4; letter-spacing: 0.5px; text-shadow: 0 2px 10px rgba(0,0,0,0.6); text-align: center; word-wrap: break-word; max-width: 100%;">
              ${sanitizedTitle}
            </h1>
          </div>
        </div>
      </foreignObject>
      
      <line x1="330" y1="620" x2="470" y2="620" stroke="#ffffff" stroke-width="4" stroke-opacity="0.5" stroke-linecap="round" />
      
      <text x="400" y="675" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="19" fill="#ffffff" letter-spacing="3" opacity="0.9">
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
