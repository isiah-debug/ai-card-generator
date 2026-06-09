import fetch from 'node-fetch';

const GEMINI_API_KEY = "AQ.Ab8RN6KLX9CMmNr0xeMOpItRqAwnUGpT6IaqqPRbZOYN07vR3Q";

export default async function handler(req, res) {
  // Hard break caching layers across Vercel and web browsers
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user_prompt = req.body?.user_prompt || "birthday cake";
  const sender_name = req.body?.sender_name || "Uncle Jimmy";

  try {
    // ==========================================
    // STEP 1: REST CUSTOM TEXT GENERATION (GEMINI)
    // ==========================================
    const textPrompt = `Create custom birthday card text based on the theme: "${user_prompt}". Return raw JSON ONLY with these exact keys: "headline_greeting", "inside_message", "wishing_tone". Do NOT include any markdown codeblocks, formatting, or backticks.`;
    
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    let cardTextDetails;
    try {
      const geminiResponse = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: textPrompt }] }]
        })
      });

      const geminiData = await geminiResponse.json();
      let rawText = geminiData.candidates[0].content.parts[0].text.trim();
      
      if (rawText.startsWith("```json")) rawText = rawText.replace(/```json|```/g, "").trim();
      if (rawText.startsWith("```")) rawText = rawText.replace(/```/g, "").trim();
      
      cardTextDetails = JSON.parse(rawText);
    } catch (apiErr) {
      // Flawless baseline backup if text formatting hiccups
      cardTextDetails = {
        headline_greeting: "Happy Birthday!",
        inside_message: `Wishing you an incredible day filled with sweet moments, laughter, and your favorite treats!`,
        wishing_tone: "Joyful"
      };
    }

    // ==========================================
    // STEP 2: NATIVE DYNAMIC SVG GENERATOR
    // ==========================================
    // Dynamically selects festive modern color combinations based on the theme length to ensure variety
    const colorPalettes = [
      { bg: "#FF6B6B", accent: "#4D96FF", text: "#FFF" },
      { bg: "#6BCB77", accent: "#FFD93D", text: "#FFF" },
      { bg: "#4D96FF", accent: "#FF6B6B", text: "#FFF" },
      { bg: "#9B5DE5", accent: "#F15BB5", text: "#FFF" }
    ];
    const chosenPalette = colorPalettes[user_prompt.length % colorPalettes.length];

    // Safely escapes text inputs to prevent character break exceptions in SVG rendering
    const cleanGraphicLabel = user_prompt.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 35);

    // Self-generating standard greeting card layout vector
    const svgCode = `<svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" viewBox="0 0 800 800" width="800" height="800">
      <defs>
        <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${chosenPalette.bg}" />
          <stop offset="100%" stop-color="${chosenPalette.accent}" />
        </linearGradient>
      </defs>
      <rect width="800" height="800" fill="url(#cardGrad)" />
      <circle cx="400" cy="350" r="180" fill="#FFFFFF" opacity="0.15" />
      
      <circle cx="150" cy="150" r="15" fill="#FFF" opacity="0.6" />
      <circle cx="650" cy="200" r="10" fill="#FFF" opacity="0.4" />
      <circle cx="200" cy="600" r="12" fill="#FFF" opacity="0.5" />
      <circle cx="600" cy="650" r="18" fill="#FFF" opacity="0.7" />
      
      <text x="50%" y="420" font-family="'Segoe UI', Helvetica, Arial, sans-serif" font-weight="bold" font-size="34" fill="${chosenPalette.text}" text-anchor="middle" letter-spacing="2">
        ${cleanGraphicLabel.toUpperCase()}
      </text>
      <text x="50%" y="480" font-family="'Segoe UI', Helvetica, Arial, sans-serif" font-size="22" fill="${chosenPalette.text}" opacity="0.85" text-anchor="middle">
        SPECIALLY CREATED FOR YOU
      </text>
    </svg>`;

    // Encodes the dynamic vector directly into an optimized web-safe Data Image URL string
    const base64Svg = Buffer.from(svgCode).toString('base64');
    const secureDataImageUrl = `data:image/svg+xml;base64,${base64Svg}`;

    // ==========================================
    // STEP 3: OUTPUT THE COMPLETE VALID PAYLOAD
    // ==========================================
    return res.status(200).json({
      status: "success",
      card_type: "Custom Birthday Greeting Card",
      from: sender_name,
      card_text: cardTextDetails,
      print_configuration: {
        physical_dimensions: "4x4 inches",
        stored_image_url: secureDataImageUrl
      }
    });

  } catch (error) {
    return res.status(500).json({ status: "error", error: error.message });
  }
}
