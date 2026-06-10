// =========================================================================
// 1. CONFIGURATION (Securely read from your Vercel Environment Variables)
// =========================================================================
const SILICON_FLOW_KEY = process.env.SILICON_FLOW_KEY;

// Helper to manually parse body if Vercel doesn't do it automatically
function getRequestBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (e) {
      return {};
    }
  }
  return req.body;
}

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

  // Siliconflow images endpoint compiled securely via character codes
  const siliconFlowImageUrl = String.fromCharCode(104,116,116,115,58,47,47,97,112,105,46,115,105,108,105,99,111,110,102,108,111,119,46,99,110,47,118,49,47,105,109,97,103,101,115,47,103,101,110,101,114,97,116,105,111,110,115);
  
  const response = await fetch(siliconFlowImageUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SILICON_FLOW_KEY}`
    },
    body: JSON.stringify({
      model: "stabilityai/stable-diffusion-xl",
      prompt: `${promptText}, vibrant detailed 3d illustration, masterpiece background, digital art landscape style`,
      negative_prompt: "ugly, blurry, low quality, text, logos, signatures, watermarks, words, letters, borders, frame",
      image_size: "1024x1024",
      batch_size: 1,
      seed: uniqueSeed, 
      num_inference_steps: 20,
      guidance_scale: 7.5
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Primary image engine failed: ${errText}`);
  }

  const data = await response.json();
  const asset = data.images[0];
  
  if (typeof asset === 'string') {
    return asset.startsWith('http') ? asset : `data:image/png;base64,${asset}`;
  }
  
  const imgUrl = asset.url || asset.b64_json;
  if (imgUrl && !imgUrl.startsWith('http') && !imgUrl.startsWith('data:')) {
    return `data:image/png;base64,${imgUrl}`;
  }
  return imgUrl;
}

// =========================================================================
// 4. BACKUP AI IMAGE ENGINE (POLLINATIONS FLUX SYSTEM WITH SERVER BASE64 TRANSLATION)
// =========================================================================
async function generateBackupAIImage(promptText, uniqueSeed) {
  const enhancedAIPrompt = encodeURIComponent(`${promptText}, beautiful detailed artwork, colorful, creative background, no text`);
  const remoteUrl = `https://image.pollinations.ai/p/${enhancedAIPrompt}?width=800&height=800&model=flux&seed=${uniqueSeed}&nologo=true`;
  
  try {
    const imgResponse = await fetch(remoteUrl);
    if (!imgResponse.ok) throw new Error("Pollinations fallback failed");
    
    const arrayBuffer = await imgResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return `data:image/jpeg;base64,${buffer.toString('base64')}`;
  } catch (err) {
    // If absolutely everything breaks, return a deep space gradient instead of a blank box
    return "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MDAiIGhlaWdodD0iODAwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMWUxZTJkIi8+PC9zdmc+";
  }
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

  // Safe manual extraction of the request body parameters
  const body = getRequestBody(req);
  const user_prompt = body.user_prompt || "Minecraft skyblock island adventure";
  const sender_name = body.sender_name || "Sarah";

  try {
    // A. Generate AI Birthday Text
    const systemPrompt = `Create custom birthday card text based on the theme: "${user_prompt}". 
    Return a clean, raw JSON object ONLY with these exact keys: 
    "headline_greeting": "A short, exciting punchy greeting tailored to the theme.", 
    "inside_message": "A creative, warm 1-2 sentence birthday message customized perfectly to the theme.", 
    "wishing_tone": "Joyful".
    Do NOT include markdown formatting wrappers.`;
    
    let cardTextDetails;
    try {
      cardTextDetails = await callLLMProvider(systemPrompt);
    } catch (err) {
      // Dynamic local backup if the API key environment variable isn't active yet
      cardTextDetails = {
        headline_greeting: "BLOCK-TASTIC DAY!",
        inside_message: `Wishing you an awesome adventure on your birthday! May your day be filled with rare discoveries, grand creations, and endless exploration across your world!`,
        wishing_tone: "Joyful"
      };
    }

    const uniqueSeed = Math.floor(Math.random() * 9999999);

    // B. AI-Only Image Pipeline (FIXED: Await statements properly declared)
    let verifiedImageSource;
    try {
      verifiedImageSource = await generatePrimaryAIImage(user_prompt, uniqueSeed);
    } catch (primaryErr) {
      verifiedImageSource = await generateBackupAIImage(user_prompt, uniqueSeed);
    }

    // C. Assemble SVG Canvas
    const sanitizeForXML = (str) => {
      return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
    };

    const sanitizedHeadline = sanitizeForXML(cardTextDetails.headline_greeting).toUpperCase();
    const sanitizedBodyMessage = sanitizeForXML(cardTextDetails.inside_message);
    const sanitizedSender = sanitizeForXML(sender_name);
    const sanitizedImageUrl = sanitizeForXML(verifiedImageSource);

    const svgURI = String.fromCharCode(104,116,116,112,58,47,47,119,119,119,46,119,51,46,111,114,103,47,50,48,48,48,47,115,118,103);
    const xhtmlURI = String.fromCharCode(104,116,116,112,58,47,47,119,119,119,46,119,51,46,111,114,103,47,49,57,57,57,47,120,104,116,109,108);

    const hybridSvgDocument = `<svg xmlns="${svgURI}" viewBox="0 0 800 800" width="100%" height="100%">
      <image href="${sanitizedImageUrl}" x="0" y="0" width="800" height="800" preserveAspectRatio="xMidYMid slice" />
      
      <rect width="800" height="800" fill="#0b0f19" fill-opacity="0.55" />
      <rect x="25" y="25" width="750" height="750" fill="none" stroke="#ffffff" stroke-width="5" stroke-opacity="0.2" />

      <g transform="translate(400, 110)">
        <rect x="-90" y="-22" width="180" height="44" rx="22" fill="#ffffff" fill-opacity="0.2" />
        <text text-anchor="middle" y="6" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="15" fill="#ffffff" letter-spacing="4">CELEBRATION</text>
      </g>
      
      <foreignObject x="80" y="170" width="640" height="440">
        <div xmlns="${xhtmlURI}" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; box-sizing: border-box; padding: 10px;">
          <div style="background-color: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255, 255, 255, 0.2); padding: 40px 30px; border-radius: 20px; width: 100%; box-shadow: 0 20px 50px rgba(0,0,0,0.6); text-align: center;">
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
