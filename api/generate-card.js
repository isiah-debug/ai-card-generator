import fetch from 'node-fetch';

const GEMINI_API_KEY = "AQ.Ab8RN6KLX9CMmNr0xeMOpItRqAwnUGpT6IaqqPRbZOYN07vR3Q";

export default async function handler(req, res) {
  // Hard break caching layers across all browsers and CDN edge networks
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
    // STEP 1: CONSOLIDATED DATA GENERATION (GEMINI)
    // ==========================================
    // Commands Gemini to simultaneously draft custom text copy and render a beautifully styled vector design layout
    const generationPrompt = `Create a custom birthday card layout based on this theme: "${user_prompt}". 
    Return a raw JSON object ONLY with these exact keys:
    "headline_greeting": "A short, catchy card front title",
    "inside_message": "An elegant, heartwarming birthday paragraph",
    "wishing_tone": "The general mood of the card",
    "svg_graphic_code": "Write a highly detailed, beautifully designed raw XML SVG element (width='800' height='800') containing vector paths, gradients, rectangles, or shapes representing the theme: '${user_prompt}'. Make sure it uses modern, vibrant colors matching a birthday theme and has a clear colored background."
    
    Do NOT wrap the output in markdown codeblocks, backticks, or any trailing text. Output raw JSON only.`;
    
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: generationPrompt }] }]
      })
    });

    const geminiData = await geminiResponse.json();
    let rawText = geminiData.candidates[0].content.parts[0].text.trim();
    
    // Clean up any potential markdown syntax artifacts
    if (rawText.startsWith("```json")) rawText = rawText.replace(/```json|```/g, "").trim();
    if (rawText.startsWith("```")) rawText = rawText.replace(/```/g, "").trim();
    
    const parsedData = JSON.parse(rawText);

    // ==========================================
    // STEP 2: COMPOSE CACHE-PROOF DATA URL
    // ==========================================
    // Converts the live, custom-drawn SVG code directly into a browser-safe Base64 image link
    const base64Svg = Buffer.from(parsedData.svg_graphic_code).toString('base64');
    const secureDataImageUrl = `data:image/svg+xml;base64,${base64Svg}`;

    // ==========================================
    // STEP 3: OUTPUT CLEAN PRODUCTION PAYLOAD
    // ==========================================
    return res.status(200).json({
      status: "success",
      card_type: "Custom Birthday Greeting Card",
      from: sender_name,
      card_text: {
        headline_greeting: parsedData.headline_greeting,
        inside_message: parsedData.inside_message,
        wishing_tone: parsedData.wishing_tone
      },
      print_configuration: {
        physical_dimensions: "4x4 inches",
        stored_image_url: secureDataImageUrl
      }
    });

  } catch (error) {
    return res.status(500).json({ status: "error", error: error.message });
  }
}
