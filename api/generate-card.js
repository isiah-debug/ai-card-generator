import fetch from 'node-fetch';

const GEMINI_API_KEY = "AQ.Ab8RN6KLX9CMmNr0xeMOpItRqAwnUGpT6IaqqPRbZOYN07vR3Q";

export default async function handler(req, res) {
  // Clear any edge caching across serverless environments
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
    // STEP 1: RESILIENT DATA GENERATION (GEMINI)
    // ==========================================
    // Explicitly instructs Gemini to output clean string patterns without library schema dependencies
    const generationPrompt = `Create a custom birthday card layout based on this theme: "${user_prompt}". 
    Return a raw JSON object ONLY with these exact keys:
    "headline_greeting": "A short, catchy card front title",
    "inside_message": "An elegant, heartwarming birthday paragraph",
    "wishing_tone": "The general mood of the card",
    "svg_graphic_code": "Write a beautifully designed raw XML SVG element (width='800' height='800') containing vector paths, gradients, rectangles, or shapes representing the theme: '${user_prompt}'. Make sure it uses modern, vibrant colors matching a birthday theme and has a clear colored background."
    
    Do NOT include any markdown codeblocks, backticks, or text outside the JSON object. Return raw JSON only.`;
    
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: generationPrompt }] }]
      })
    });

    const geminiData = await geminiResponse.json();

    // Catch clear API authorization issues upfront
    if (geminiData.error) {
      return res.status(401).json({ status: "error", error: geminiData.error.message });
    }

    let rawText = geminiData.candidates[0].content.parts[0].text.trim();
    
    // Extracted sanitization layer to pull out valid JSON even if markdown backticks creep in
    if (rawText.includes("```")) {
      const openIndex = rawText.indexOf("{");
      const closeIndex = rawText.lastIndexOf("}");
      if (openIndex !== -1 && closeIndex !== -1) {
        rawText = rawText.substring(openIndex, closeIndex + 1);
      }
    }
    
    const parsedData = JSON.parse(rawText);

    // ==========================================
    // STEP 2: COMPOSE CACHE-PROOF DATA URL
    // ==========================================
    // Conversions handle text characters cleanly without breaking image sources
    const base64Svg = Buffer.from(parsedData.svg_graphic_code).toString('base64');
    const secureDataImageUrl = `data:image/svg+xml;base64,${base64Svg}`;

    // ==========================================
    // STEP 3: OUTPUT CLEAN WEBSITE PAYLOAD
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
