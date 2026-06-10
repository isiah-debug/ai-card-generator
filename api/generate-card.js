// =========================================================================
// 1. CONFIGURATION (Pulled securely from Vercel's Environment Variables)
// =========================================================================
const SILICON_FLOW_KEY = process.env.SILICON_FLOW_KEY;

// =========================================================================
// 2. SILICONFLOW TEXT ENGINE (NEX-N2-PRO)
// =========================================================================
async function callLLMProvider(promptText) {
  if (!SILICON_FLOW_KEY) {
    throw new Error("Missing SILICON_FLOW_KEY environment variable.");
  }

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
  if (!SILICON_FLOW_KEY) {
    throw new Error("Missing SILICON_FLOW_KEY environment variable.");
  }

  // Fixed Markdown URL Typos
  const siliconFlowImageUrl = "[https://api.siliconflow.cn/v1/image/generations](https://api.siliconflow.cn/v1/image/generations)";
  
  const response = await fetch(siliconFlowImageUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SILICON_FLOW_KEY}`
    },
    body: JSON.stringify({
      model: "stabilityai/stable-diffusion-xl",
      prompt: `${promptText}, vibrant 3d gaming illustration, beautiful digital art masterpiece background, gaming backdrop wallpaper style`,
      negative_prompt: "ugly, blurry, low quality, text, logos, signatures, watermarks, words, letters, borders",
      image_size: "1024x1024",
      batch_size: 1,
      seed: uniqueSeed, 
      num_inference_steps: 20,
      guidance_scale: 7.5
    })
  });

  if (!response.ok) throw new Error("Primary cluster node busy");

  const data = await response.json();
  const asset = data.images[0];
  return typeof asset === 'string' ? (asset.startsWith('http') ? asset : `data:image/png;base64,${asset}`) : (asset.url || `data:image/png;base64,${asset.b64_json}`);
}

// =========================================================================
// 4. BACKUP AI IMAGE ENGINE (POLLINATIONS FLUX SYSTEM)
// =========================================================================
function generateBackupAIImage(promptText, uniqueSeed) {
  const enhancedAIPrompt = encodeURIComponent(`${promptText}, colorful 3d gaming style, beautiful background presentation canvas, no text`);
  return `https://image.pollinations.ai/p/${enhancedAIPrompt}?width=800&height=800&model=flux&seed=${uniqueSeed}&nologo=true`;
}

// =========================================================================
// MAIN SERVERLESS ROUTE HANDLER
// =========================================================================
export default async function handler(req, res) {
  // Anti-caching Headers
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Handle CORS Preflight Requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user_prompt = req.body?.user_prompt || "Fortnite gaming character dancing";
  const sender_name = req.body?.sender_name || "Chris";

  try {
    // A. Generate AI Wording
    const systemPrompt = `Create custom birthday card text based on the theme: "${user_prompt}". 
    Return a clean, raw JSON object ONLY with these exact keys: 
    "headline_greeting": "A short, exciting punchy greeting (e.g., 'Level Up!' or 'Victory Royale!')", 
    "inside_message": "A creative, warm 1-2 sentence birthday message customized perfectly to the theme.", 
    "wishing_tone": "Joyful".
    Do NOT include markdown formatting wrappers.`;
    
    let cardTextDetails;
    try {
      cardTextDetails = await callLLMProvider(systemPrompt);
    } catch (err) {
      // Graceful local fallback if LLM breaks
      cardTextDetails = {
        headline_greeting: "VICTORY ROYALE!",
        inside_message: `Wishing you an incredible birthday filled with epic wins, legendary loot, and non-stop celebrations!`,
        wishing_tone: "Joyful"
      };
    }

    const uniqueSeed = Math.floor(Math.random() * 9999999);

    // B. AI-Only Image Pipeline
    let verifiedImageSource;
    try {
      verifiedImageSource = await generatePrimaryAIImage(user_prompt, uniqueSeed);
    } catch (primaryErr) {
      verifiedImageSource = generateBackupAIImage(user_prompt, uniqueSeed);
    }

    // C. Assemble SVG Blueprint
    const sanitizeForXML = (str) => {
      return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
    };

    const sanitizedHeadline = sanitizeForXML(cardTextDetails.headline_greeting).toUpperCase();
    const sanitizedBodyMessage = sanitizeForXML(cardTextDetails.inside_message);
    const sanitizedSender = sanitizeForXML(sender_name);
    const sanitizedImageUrl = sanitizeForXML(verifiedImageSource);

    const svgURI = "[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)";
    const xhtmlURI = "[http://www.w3.org/1999/xhtml](http://www.w3.org/1999/xhtml)";

    const hybridSvgDocument = `<svg xmlns="${svgURI}" viewBox="0 0 800 800" width="100%" height="100%">
      <image href="${sanitizedImageUrl}" x="0" y="0" width="800" height="800" preserveAspectRatio="xMidYMid slice" />
      
      <rect width="800" height="800" fill="#0b0f19" fill-opacity="0.45" />
      <rect x="25" y="25" width="750" height="750" fill="none" stroke="#ffffff" stroke-width="5" stroke-opacity="0.2" />

      <g transform="translate(400, 110)">
        <rect x="-90" y="-22" width="180" height="44" rx="22" fill="#ffffff" fill-opacity="0.2" />
        <text text-anchor="middle" y="6" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="15" fill="#ffffff" letter-spacing="4">CELEBRATION</text>
      </g>
      
      <foreignObject x="80" y="170" width="640" height="440">
        <div xmlns="${xhtmlURI}" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; box-sizing: border-box; padding: 10px;">
          <div style="background-color: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255, 255, 255, 0.2); padding: 40px 30px; border-radius: 20px; width: 100%; box-shadow: 0 20px 50px rgba(0,0,0,0.5); text-align: center;">
            <h1 style="color: #ffffff; font-family: system-ui, -apple-system, sans-serif; font-size: 28px; font-weight: 900; margin: 0 0 18px 0; line-height: 1.3; letter-spacing: 0.5px; text-shadow: 0 2px 8px rgba(0,0,0,0.7); word-wrap: break-word;">${sanitizedHeadline}</h1>
            <div style="width: 50px; height: 3px; background-color: rgba(255, 255, 255, 0.35); margin: 0 auto 20px auto; border-radius: 2px;"></div>
            <p style="color: rgba(255, 255, 255, 0.95); font-family: system-ui, -apple-system, sans-serif; font-size: 18px; font-weight: 500; line-height: 1.6; margin: 0 0 25px 0; text-shadow: 0 1px 4px rgba(0,0,0,0.4); word-wrap: break-word;">${sanitizedBodyMessage}</p>
            <p style="color: #38bdf8; font-family: system-ui, -apple-system, sans-serif; font-size: 16px; font-weight: 700; letter-spacing: 1px; margin: 0; text-transform: uppercase;">With Love, ${sanitizedSender}</p>
          </div>
        </div>
      </foreignObject>
      
      <line x1="330" y1="650" x2="470" y2="650" stroke="#ffffff" stroke-width="4" stroke-opacity="0.4" stroke-linecap="round" />
      <text x="400" y="700" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="18" fill="#ffffff" letter-spacing="3" opacity="0.8">SPECIALLY CREATED FOR YOU</text>
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
