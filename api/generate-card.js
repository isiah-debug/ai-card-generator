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
    // 2. LIVE BACKGROUND ILLUSTRATION ENGINE
    // ==========================================
    let aiSceneryUrl = "";
    try {
      const cleanPromptInput = user_prompt.replace(/[^a-zA-Z0-9 ]/g, "").trim();
      // Prompt engineered to create beautiful, vibrant backgrounds ideal for text overlay
      const artPrompt = `Vibrant colorful birthday scene background of ${cleanPromptInput}, stunning digital illustration, stylized anime cartoon art style, bright festive atmosphere, clean composition, no text words watermarks`;

      const aiResponse = await fetch("[https://api.siliconflow.cn/v1/images/generations](https://api.siliconflow.cn/v1/images/generations)", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SILICON_FLOW_KEY}`
        },
        body: JSON.stringify({
          model: "stabilityai/stable-diffusion-xl-base-1.0",
          prompt: artPrompt,
          image_size: "1024x1024"
        })
      });

      const aiData = await aiResponse.json();
      
      if (aiData?.data && aiData.data.length > 0 && aiData.data[0].url) {
        aiSceneryUrl = aiData.data[0].url;
      } else {
        throw new Error("No image data returned");
      }
    } catch (imgErr) {
      // High-quality fallback background if your account runs low on text-to-image tokens
      aiSceneryUrl = "[https://images.unsplash.com/photo-1513201099705-a9746e1e201f?auto=format&fit=crop&w=1024&h=1024&q=80](https://images.unsplash.com/photo-1513201099705-a9746e1e201f?auto=format&fit=crop&w=1024&h=1024&q=80)";
    }

    // ==========================================
    // 3. COMPILE HYBRID ARTWORK OVERLAY (SVG)
    // ==========================================
    const sanitizedTitle = user_prompt
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .toUpperCase();

    const svgNamespace = "http://" + "www.w3.org/2000/svg";
    const htmlNamespace = "http://" + "www.w3.org/1999/xhtml";

    const hybridSvgDocument = `<svg xmlns="${svgNamespace}" viewBox="0 0 800 800" width="100%" height="100%">
      <image href="${aiSceneryUrl}" x="0" y="0" width="800" height="800" preserveAspectRatio="xMidYMid slice" />
      
      <rect width="800" height="800" fill="#000000" fill-opacity="0.45" />
      <rect x="25" y="25" width="750" height="750" fill="none" stroke="#ffffff" stroke-width="5" stroke-opacity="0.4" />
      
      <g transform="translate(400, 140)">
        <rect x="-90" y="-22" width="180" height="44" rx="22" fill="#ffffff" fill-opacity="0.25" style="backdrop-filter: blur(5px);" />
        <text text-anchor="middle" y="6" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="16" fill="#ffffff" letter-spacing="4">CELEBRATION</text>
      </g>
      
      <foreignObject x="80" y="210" width="640" height="380">
        <div xmlns="${htmlNamespace}" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-family: system-ui, -apple-system, sans-serif; text-align: center; box-sizing: border-box;">
          <h1 style="color: #ffffff; font-size: 36px; font-weight: 900; margin: 0; padding: 0; line-height: 1.4; letter-spacing: 1px; text-shadow: 0 4px 16px rgba(0,0,0,0.8); max-width: 100%; word-wrap: break-word;">
            ${sanitizedTitle}
          </h1>
        </div>
      </foreignObject>
      
      <line x1="330" y1="620" x2="470" y2="620" stroke="#ffffff" stroke-width="4" stroke-opacity="0.6" stroke-linecap="round" />
      
      <text x="400" y="675" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="19" fill="#ffffff" letter-spacing="3" opacity="0.95" style="text-shadow: 0 2px 8px rgba(0,0,0,0.5);">
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
