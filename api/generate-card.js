import fetch from 'node-fetch';

// CONFIGURATION VARIABLES
// Your private authenticated SiliconFlow API key handles both the Nex text generation and the layout configurations
const SILICON_FLOW_KEY = "sk-aqnelyloqupavmquzwptcigvzzurzmqodkdrrcrfgjxlmybq";

// ==========================================
// NEW: NEX-N2-PRO TEXT LLM WRAPPER ENGINE
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
      model: "nex-agi/Nex-N2-Pro", // Using the zero-cost reasoning model hosted on SiliconFlow
      messages: [
        { role: "user", content: promptText }
      ],
      response_format: { type: "json_object" }, // Ensures native raw JSON adherence 
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Nex LLM Provider API error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  let rawText = data.choices[0].message.content.trim();
  
  // Clean off accidental LLM markdown wrapper backticks if they appear
  if (rawText.startsWith("```json")) rawText = rawText.replace(/```json|```/g, "").trim();
  if (rawText.startsWith("```")) rawText = rawText.replace(/```/g, "").trim();
  
  return JSON.parse(rawText);
}

// ==========================================
// MAIN SERVERLESS ROUTE HANDLER
// ==========================================
export default async function handler(req, res) {
  // Shatter all edge CDN caching distribution paths
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user_prompt = req.body?.user_prompt || "birthday cake";
  const sender_name = req.body?.sender_name || "Uncle Jimmy";

  try {
    // 1. Fetch text assets using the newly configured Nex-N2-Pro wrapper engine
    const systemPrompt = `Create custom birthday card text based on the theme: "${user_prompt}". Return raw JSON ONLY with these exact keys: "headline_greeting", "inside_message", "wishing_tone". Do NOT include any markdown formatting or surrounding explanation.`;
    
    let cardTextDetails;
    try {
      cardTextDetails = await callLLMProvider(systemPrompt);
    } catch (llmErr) {
      console.error("Nex generation encountered an issue, falling back:", llmErr.message);
      cardTextDetails = {
        headline_greeting: "Happy Birthday!",
        inside_message: `Wishing you an incredible day filled with fun adventures and great memories!`,
        wishing_tone: "Joyful"
      };
    }

    // ==========================================
    // 2. SELF-CONTAINED NATIVE SVG VECTOR ENGINE
    // ==========================================
    const aestheticPalettes = [
      { start: "#FF6B6B", end: "#FF8E53" }, // Energetic Coral Neon
      { start: "#4E65FF", end: "#92EFFD" }, // Cyber Blue/Teal Gradient
      { start: "#7F00FF", end: "#E100FF" }, // Deep Vivid Electric Purple
      { start: "#11998E", end: "#38EF7D" }  // Fresh High-Contrast Mint
    ];
    const pickedTheme = aestheticPalettes[user_prompt.length % aestheticPalettes.length];

    // Sanitize user inputs safely to completely protect strict XML structure tags
    const sanitizedTitle = user_prompt
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .toUpperCase();

    // Isolated namespace constants block markdown auto-linking side effects
    const svgNamespace = "http://" + "www.w3.org/2000/svg";
    const htmlNamespace = "http://" + "www.w3.org/1999/xhtml";

    const strictSvgDocument = `<svg xmlns="${svgNamespace}" viewBox="0 0 800 800" width="100%" height="100%">
      <defs>
        <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${pickedTheme.start}" />
          <stop offset="100%" stop-color="${pickedTheme.end}" />
        </linearGradient>
      </defs>
      
      <rect width="800" height="800" fill="url(#cardGrad)" />
      <rect x="25" y="25" width="750" height="750" fill="none" stroke="#ffffff" stroke-width="5" stroke-opacity="0.25" />
      
      <circle cx="720" cy="80" r="220" fill="#ffffff" fill-opacity="0.07" />
      <circle cx="80" cy="720" r="180" fill="#ffffff" fill-opacity="0.04" />
      
      <g transform="translate(400, 140)">
        <rect x="-90" y="-22" width="180" height="44" rx="22" fill="#ffffff" fill-opacity="0.18" />
        <text text-anchor="middle" y="6" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="16" fill="#ffffff" letter-spacing="4">CELEBRATION</text>
      </g>
      
      <foreignObject x="80" y="210" width="640" height="380">
        <div xmlns="${htmlNamespace}" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-family: system-ui, -apple-system, sans-serif; text-align: center; box-sizing: border-box;">
          <h1 style="color: #ffffff; font-size: 36px; font-weight: 900; margin: 0; padding: 0; line-height: 1.4; letter-spacing: 1px; text-shadow: 0 4px 14px rgba(0,0,0,0.12); max-width: 100%; word-wrap: break-word;">
            ${sanitizedTitle}
          </h1>
        </div>
      </foreignObject>
      
      <line x1="330" y1="620" x2="470" y2="620" stroke="#ffffff" stroke-width="4" stroke-opacity="0.5" stroke-linecap="round" />
      
      <text x="400" y="675" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="19" fill="#ffffff" letter-spacing="3" opacity="0.85">
        SPECIALLY CREATED FOR YOU
      </text>
    </svg>`.trim();

    // Turn our clean vector design asset blueprint link straight into an unthrottled base64 delivery stream
    const base64Content = Buffer.from(strictSvgDocument).toString('base64');
    const secureDynamicVectorStream = `data:image/svg+xml;base64,${base64Content}`;

    // 3. Deliver perfect response structures back to your frontend components
    return res.status(200).json({
      status: "success",
      card_type: "Custom Birthday Greeting Card",
      from: sender_name,
      card_text: cardTextDetails,
      print_configuration: {
        physical_dimensions: "4x4 inches",
        stored_image_url: secureDynamicVectorStream
      }
    });

  } catch (error) {
    return res.status(500).json({ status: "error", error: error.message });
  }
}
