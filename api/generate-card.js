import fetch from 'node-fetch';

const GEMINI_API_KEY = "AQ.Ab8RN6KLX9CMmNr0xeMOpItRqAwnUGpT6IaqqPRbZOYN07vR3Q";

export default async function handler(req, res) {
  // Force strict cache destruction across all serverless routers and browsers
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
    // STEP 1: NATIVE GEMINI TEXT GENERATION
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
        inside_message: `Wishing you a fantastic day filled with fun, laughter, and great memories!`,
        wishing_tone: "Joyful"
      };
    }

    // ==========================================
    // STEP 2: CACHE-PROOF IMAGE DIRECTORY PATH
    // ==========================================
    // Extracts descriptive elements and filters out small connecting words
    const cleanKeywords = user_prompt
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .split(" ")
      .filter(word => word.length > 2 && !["with", "and", "the", "for", "from", "cute"].includes(word));

    // Force strict visual card modifiers into the keyword array
    cleanKeywords.push("birthday", "illustration", "vector");

    // Joining keywords with commas creates a unique path identifier that bypasses all network caches
    const uniquelyMappedPath = encodeURIComponent(cleanKeywords.join(","));
    const uniqueBuster = Math.floor(Math.random() * 999999);

    // Dynamic path-based routing engine
    const permanentImageUrl = `https://images.unsplash.com/featured/800x800/?${uniquelyMappedPath}&sig=${uniqueBuster}`;

    // ==========================================
    // STEP 3: OUTPUT LIVE WEB PAYLOAD
    // ==========================================
    return res.status(200).json({
      status: "success",
      card_type: "Custom Birthday Greeting Card",
      from: sender_name,
      card_text: cardTextDetails,
      print_configuration: {
        physical_dimensions: "4x4 inches",
        stored_image_url: permanentImageUrl
      }
    });

  } catch (error) {
    return res.status(500).json({ status: "error", error: error.message });
  }
}
