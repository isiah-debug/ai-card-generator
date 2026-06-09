import fetch from 'node-fetch';

const GEMINI_API_KEY = "AQ.Ab8RN6KLX9CMmNr0xeMOpItRqAwnUGpT6IaqqPRbZOYN07vR3Q";

export default async function handler(req, res) {
  // Prevent any caching across live web routers
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
    const generationPrompt = `Create a custom birthday card layout based on this theme: "${user_prompt}". 
    Provide values for headline_greeting, inside_message, wishing_tone, and svg_graphic_code.
    For svg_graphic_code, generate a beautifully designed raw XML SVG element (width='800' height='800') containing vector paths, shapes, or text representing the theme: '${user_prompt}'. Ensure it has a vibrant colored background matching a birthday theme.`;
    
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: generationPrompt }] }],
        // Enforce native JSON output matching our blueprint structure
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              headline_greeting: { type: "STRING" },
              inside_message: { type: "STRING" },
              wishing_tone: { type: "STRING" },
              svg_graphic_code: { type: "STRING" }
            },
            required: ["headline_greeting", "inside_message", "wishing_tone", "svg_graphic_code"]
          }
        }
      })
    });

    const geminiData = await geminiResponse.json();

    // Catch any upstream errors returned directly by the Google API
    if (geminiData.error) {
      return res.status(400).json({ status: "error", error: geminiData.error.message });
    }

    // Defensive check to ensure the payload structure exists
    if (!geminiData.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error("Invalid or empty response structure from Gemini API.");
    }

    const parsedData = JSON.parse(geminiData.candidates[0].content.parts[0].text.trim());

    // ==========================================
    // STEP 2: COMPOSE CACHE-PROOF DATA URL
    // ==========================================
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
