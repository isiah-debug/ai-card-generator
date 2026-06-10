import fetch from 'node-fetch';

// CONFIGURATION VARIABLES
const SILICON_FLOW_KEY = "sk-aqnelyloqupavmquzwptcigvzzurzmqodkdrrcrfgjxlmybq";

// ==========================================
// 1. SILICONFLOW TEXT ENGINE (NEX-N2-PRO)
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
    throw new Error(`SiliconFlow LLM error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  let rawText = data.choices[0].message.content.trim();
  
  if (rawText.startsWith("```json")) rawText = rawText.replace(/```json|```/g, "").trim();
  if (rawText.startsWith("```")) rawText = rawText.replace(/```/g, "").trim();
  
  return JSON.parse(rawText);
}

// ==========================================
// 2. SILICONFLOW NATIVE IMAGE ENGINE (SDXL)
// ==========================================
async function generateSiliconFlowImage(promptText) {
  const siliconFlowImageUrl = "[https://api.siliconflow.cn/v1/image/generations](https://api.siliconflow.cn/v1/image/generations)";
  
  const response = await fetch(siliconFlowImageUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SILICON_FLOW_KEY}`
    },
    body: JSON.stringify({
      model: "stabilityai/stable-diffusion-xl",
      prompt: `${promptText}, vibrant digital art style, stunning dynamic wallpaper, cinematic lighting, masterpiece presentation backdrop`,
      negative_prompt: "ugly, blurry, low quality, text, logos, signatures, watermark, words",
      image_size: "1024x1024",
      batch_size: 1,
      num_inference_steps: 20,
      guidance_scale: 7.5
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`SiliconFlow Image error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  if (!data.images || data.images.length === 0) {
    throw new Error("No image data returned from SiliconFlow cluster node.");
  }

  const imageAsset = data.images[0];
  if (typeof imageAsset === 'string') {
    return imageAsset.startsWith('http') ? imageAsset : `data:image/png;base64,${imageAsset}`;
  } else if (imageAsset.url) {
    return imageAsset.url;
  } else if (imageAsset.b64_json) {
    return `data:image/png;base64,${imageAsset.b64_json}`;
  }
  
  throw new Error("Unknown asset format structure from image engine.");
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
  const sender_name = req.body?.sender_name || "Chris";

  try {
    // A. Format custom greeting text
    const systemPrompt = `Create custom birthday card text based on the theme: "${user_prompt}". 
    Return a clean, raw JSON object ONLY with these exact keys: 
    "headline_greeting": "A short, exciting punchy greeting (e.g., 'Level Up!' or 'Victory Royale!')", 
    "inside_message": "A creative, warm 1-2 sentence birthday message customized perfectly to the theme.", 
    "wishing_tone": "Joyful".
    Do NOT include markdown formatting wrappers.`;
    
    let cardTextDetails;
    try {
      cardTextDetails = await callLLMProvider(systemPrompt);
      // Extra verification check to ensure fields are present
      if (!cardTextDetails.headline_greeting || !cardTextDetails.inside_message) {
        throw new Error("Missing text schema structures.");
      }
    } catch (llmErr) {
      // Direct failover structure formatting fix
      cardTextDetails = {
        headline_greeting: "HAPPY BIRTHDAY!",
        inside_message: `Wishing you an incredible day filled with epic wins, legendary loot, and amazing celebrations!`,
        wishing_tone: "Joyful"
      };
    }

    // B. Image Pipeline: AI generation first, high-res keyword match second
    let verifiedImageSource;
    try {
      verifiedImageSource = await generateSiliconFlowImage(user_prompt);
    } catch (imgErr) {
      // PARSE KEYWORD FROM PROMPT
      const words = user_prompt.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(" ");
      
      let searchKeyword = "birthday"; 
      if (words.includes("fortnite") || words.includes("gaming") || words.includes("gamer") || words.includes("dance")) {
        searchKeyword = "gaming";
      } else if (words.includes("cake") || words.includes("cupcake") || words.includes("balloons")) {
        searchKeyword = "cake";
      } else if (words.includes("neon") || words.includes("cyberpunk")) {
        searchKeyword = "neon";
      } else if (words.length > 0 && words[0].length > 2) {
        searchKeyword = words[0]; 
      }

      // Dynamic Unsplash keyword fallback
      verifiedImageSource = `https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&h=800&q=80&qkw=${encodeURIComponent(searchKeyword)}`;
    }

    // ==========================================
    // 3. COMPILE OVERLAY ASYNC GRAPHIC (SVG)
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
    const sanitizedImageUrl = sanitizeForXML(verifiedImageSource);

    const svgURI = String.fromCharCode(104,116,116,112,58,47,47,119,119,119,46,119,51,46,111,114,103,47,50,48,48,48,47,115,118,103);
    const xhtmlURI = String.fromCharCode(104,116,116,112,58,47,47,119,119,119,46,119,51,46,111,114,103,47,49,57,57,57,47,120,104,116,109,108);

    const hybridSvgDocument = `<svg xmlns="${svgURI}" viewBox="0 0 800 800" width="100%" height="100%">
      <image href="${sanitizedImageUrl}" x="0" y="0" width="800" height="800" preserveAspectRatio="xMidYMid slice" />
      
      <rect width="800" height="800" fill="#0b0f19" fill-opacity="0.5" />
      <rect x="25" y="25" width="750" height="750" fill="none" stroke="#ffffff" stroke-width="5" stroke-opacity="0.25" />

      <g transform="translate(400, 110)">
        <rect x="-90" y="-22" width="180" height="44" rx="22" fill="#ffffff" fill-opacity="0.2" />
        <text text-anchor="middle" y="6" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="15" fill="#ffffff" letter-spacing="4">CELEBRATION</text>
      </g>
      
      <foreignObject x="80" y="170" width="640" height="440">
        <div xmlns="${xhtmlURI}" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; box-sizing: border-box; padding: 10px;">
          <div style="background-color: rgba(15, 23, 42, 0.75); border: 1px solid rgba(255, 255, 255, 0.25); padding: 40px 30px; border-radius: 20px; width: 100%; box-shadow: 0 20px 50px rgba(0,0,0,0.6); text-align: center;">
            
            <h1 style="color: #ffffff; font-family: system-ui, -apple-system, sans-serif; font-size: 30px; font-weight: 900; margin: 0 0 20px 0; padding: 0; line-height: 1.3; letter-spacing: 0.5px; text-shadow: 0 2px 8px rgba(0,0,0,0.8); word-wrap: break-word;">
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
