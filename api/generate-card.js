// =========================================================================
// 1. UTILITY CONFIGURATION & CLEAN XML NAMESPACES
// =========================================================================
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

// =========================================================================
// 2. HIGH-PERFORMANCE LOCAL DESIGN ENGINES
// =========================================================================
function generateLocalCardText(user_prompt) {
  const lower = (user_prompt || "").toLowerCase();
  
  if (lower.includes("mine") || lower.includes("block") || lower.includes("craft") || lower.includes("skyblock")) {
    return {
      headline_greeting: "BLOCK-TASTIC DAY!",
      inside_message: "Wishing you an awesome adventure on your birthday! May your day be filled with rare discoveries, grand creations, and endless exploration across your world!"
    };
  }
  
  if (lower.includes("royale") || lower.includes("fortnite") || lower.includes("victory") || lower.includes("game")) {
    return {
      headline_greeting: "VICTORY ROYALE!",
      inside_message: "Wishing you an incredible birthday filled with epic wins, legendary loot, and non-stop celebrations with your squad!"
    };
  }

  // Beautiful universal default if no specific keyword matches
  return {
    headline_greeting: "HAPPY BIRTHDAY!",
    inside_message: "May this brand new year bring endless joy, spectacular achievements, and unforgettable memories. Keep leveling up!"
  };
}

function generateLocalVectorBackground(user_prompt) {
  const lower = (user_prompt || "").toLowerCase();
  
  // Crimson to Violet-Blue Gaming Gradient
  if (lower.includes("mine") || lower.includes("block") || lower.includes("craft") || lower.includes("skyblock") || lower.includes("royale") || lower.includes("game")) {
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23ff007f"/><stop offset="50%" stop-color="%237928ca"/><stop offset="100%" stop-color="%2300dfd8"/></linearGradient></defs><rect width="800" height="800" fill="url(%23bg)"/><g stroke="rgba(255,255,255,0.15)" stroke-width="2"><line x1="0" y1="400" x2="800" y2="400"/><line x1="400" y1="0" x2="400" y2="800"/><circle cx="400" cy="400" r="200" fill="none"/><circle cx="400" cy="400" r="300" fill="none"/><polygon points="400,150 450,350 650,400 450,450 400,650 350,450 150,400 350,350" fill="rgba(255,255,255,0.1)"/></g></svg>`;
  }
  
  // Premium Gold / Midnight Celebration Gradient
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%231e3c72"/><stop offset="100%" stop-color="%232a5298"/></linearGradient></defs><rect width="800" height="800" fill="url(%23bg)"/><g stroke="rgba(255,255,255,0.08)" stroke-width="1"><circle cx="800" cy="0" r="400" fill="none"/><circle cx="0" cy="800" r="400" fill="none"/><circle cx="400" cy="400" r="150" fill="none"/></g></svg>`;
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
  const user_prompt = body.user_prompt || "Minecraft skyblock island adventure";
  const sender_name = body.sender_name || "Sarah";

  try {
    // 1. Fast Local Resolution Engine Execution
    const cardTextDetails = generateLocalCardText(user_prompt);
    const finalInlineImageSource = generateLocalVectorBackground(user_prompt);

    // 2. XML Isolation Processing 
    const sanitizedHeadline = sanitizeForXML(cardTextDetails.headline_greeting).toUpperCase();
    const sanitizedBodyMessage = sanitizeForXML(cardTextDetails.inside_message);
    const sanitizedSender = sanitizeForXML(sender_name);
    const sanitizedImageUrl = sanitizeForXML(finalInlineImageSource);

    // 3. Assemble Clean SVG Blueprint Document
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
      <text x="400" y="700" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="18" fill="#ffffff" letter-spacing="3" opacity="0.75">SPECIALLY CREATED FOR YOU</text>
    </svg>`.trim();

    // 4. Wrap Output to Base64 String 
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
