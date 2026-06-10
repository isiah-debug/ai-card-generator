import fetch from 'node-fetch';

// CONFIGURATION VARIABLES
const GEMINI_API_KEY = "AQ.Ab8RN6KLX9CMmNr0xeMOpItRqAwnUGpT6IaqqPRbZOYN07vR3Q";

// ==========================================
// THE TEXT LLM WRAPPER ENGINE
// ==========================================
async function callLLMProvider(promptText) {
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const response = await fetch(geminiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }]
    })
  });

  if (!response.ok) {
    throw new Error(`LLM Provider API error: ${response.statusText}`);
  }

  const data = await response.json();
  let rawText = data.candidates[0].content.parts[0].text.trim();
  
  if (rawText.startsWith("```json")) rawText = rawText.replace(/```json|```/g, "").trim();
  if (rawText.startsWith("```")) rawText = rawText.replace(/```/g, "").trim();
  
  return JSON.parse(rawText);
}

// ==========================================
// MAIN SERVERLESS ROUTE HANDLER
// ==========================================
export default async function handler(req, res) {
  // Prevent any edge network caching layers from serving stale data
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user_prompt = req.body?.user_prompt || "birthday cake";
  const sender_name = req.body?.sender_name || "Uncle Jimmy";

  try {
    // 1. Generate text data parameters utilizing Gemini
    const systemPrompt = `Create custom birthday card text based on the theme: "${user_prompt}". Return raw JSON ONLY with these exact keys: "headline_greeting", "inside_message", "wishing_tone". Do NOT include any markdown formatting or backticks.`;
    
    let cardTextDetails;
    try {
      cardTextDetails = await callLLMProvider(systemPrompt);
    } catch (llmErr) {
      cardTextDetails = {
        headline_greeting: "Happy Birthday!",
        inside_message: `Wishing you an incredible day filled with fun adventures and great memories!`,
        wishing_tone: "Joyful"
      };
    }

    // ==========================================
    // 2. CRASH-PROOF NATIVE SVG GENERATION ENGINE
    // ==========================================
    // Rotate color themes based on prompt parameters to guarantee visual variation
    const colorThemes = [
      { start: "#4E65FF", end: "#92EFFD" }, // Cyan/Blue Gradient
      { start: "#FF6B6B", end: "#FF8E53" }, // Coral Orange Gradient
      { start: "#7F00FF", end: "#E100FF" }, // Cyber Purple Gradient
      { start: "#11998E", end: "#38EF7D" }  // Mint Green Gradient
    ];
    const chosenTheme = colorThemes[user_prompt.length % colorThemes.length];

    // Sanitize user text inputs to conform with XML structural requirements
    const sanitizedTitle = user_prompt
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .toUpperCase();

    // Plain, strictly compliant inline XML markup with clean namespace variables
    const cleanSvgDocument = `<svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" viewBox="0 0 800 800" width="100%" height="100%">
      <defs>
        <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${chosenTheme.start}" />
          <stop offset="100%" stop-color="${chosenTheme.end}" />
        </linearGradient>
      </defs>
      
      <rect width="800" height="800" fill="url(#cardGrad)" />
      <rect x="20" y="20" width="760" height="760" fill="none" stroke="#ffffff" stroke-width="6" stroke-opacity="0.3" />
      
      <circle cx="700" cy="100" r="250" fill="#ffffff" fill-opacity="0.08" />
      <circle cx="100" cy="700" r="200" fill="#ffffff" fill-opacity="0.05" />
      
      <g transform="translate(400, 260)">
        <rect x="-90" y="-25" width="180" height="50" rx="25" fill="#ffffff" fill-opacity="0.2" />
        <text text-anchor="middle" y="7" font-family="system-ui, -apple-system, sans-serif" font-weight="bold" font-size="18" fill="#ffffff" letter-spacing="4">CELEBRATION</text>
      </g>
      
      <text x="400" y="420" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="36" fill="#ffffff" letter-spacing="2">
        ${sanitizedTitle}
      </text>
      
      <line x1="340" y1="470" x2="460" y2="470" stroke="#ffffff" stroke-width="4" stroke-opacity="0.6" stroke-linecap="round" />
      
      <text x="400" y="530" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="600" font-size="20" fill="#ffffff" letter-spacing="3" opacity="0.9">
        SPECIALLY CREATED FOR YOU
      </text>
    </svg>`.trim();

    // Bundle the SVG directly into an un-throttled base64 URL wrapper data string
    const base64Content = Buffer.from(cleanSvgDocument).toString('base64');
    const secureDynamicVectorStream = `data:image/svg+xml;base64,${base64Content}`;

    // 3. Return the fully formed payload data to the client frontend
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
