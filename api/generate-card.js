import fetch from 'node-fetch';

const GEMINI_API_KEY = "AQ.Ab8RN6KLX9CMmNr0xeMOpItRqAwnUGpT6IaqqPRbZOYN07vR3Q";

export default async function handler(req, res) {
  // Clear any edge network caching configurations permanently
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
      cardTextDetails = {
        headline_greeting: "Happy Birthday!",
        inside_message: `Wishing you an incredible day filled with fun adventures, great memories, and lots of smiles!`,
        wishing_tone: "Joyful"
      };
    }

    // ==========================================
    // STEP 2: 100% OPEN DYNAMIC GRAPHIC STREAM
    // ==========================================
    // Extracts clean, comma-separated search tags for the LoremFlickr processing engine
    const cleanTags = user_prompt
      .toLowerCase()
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .trim()
      .split(/\s+/)
      .join(",");

    // Appending a random buster breaks browser memory hooks and forces a live keyword match evaluation
    const cacheBuster = Math.floor(Math.random() * 99999);
    const modernLiveUrl = `https://loremflickr.com/800/800/${encodeURIComponent(cleanTags)}?lock=${cacheBuster}`;

    // ==========================================
    // STEP 3: OUTPUT CLEAN PRODUCTION PAYLOAD
    // ==========================================
    return res.status(200).json({
      status: "success",
      card_type: "Custom Birthday Greeting Card",
      from: sender_name,
      card_text: cardTextDetails,
      print_configuration: {
        physical_dimensions: "4x4 inches",
        stored_image_url: modernLiveUrl
      }
    });

  } catch (error) {
    return res.status(500).json({ status: "error", error: error.message });
  }
}
