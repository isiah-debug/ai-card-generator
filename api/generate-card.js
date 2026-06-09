import fetch from 'node-fetch';

const GEMINI_API_KEY = "AQ.Ab8RN6KLX9CMmNr0xeMOpItRqAwnUGpT6IaqqPRbZOYN07vR3Q";
// Open public infrastructure key for instant dynamic card graphic delivery
const PIXABAY_API_KEY = "44415512-c2b4cbaef994eec1ffbcda1a3"; 

export default async function handler(req, res) {
  // Prevent aggressive edge network caching on Vercel or Heroku
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
    // STEP 2: DYNAMIC GRAPHIC MATCH (PIXABAY)
    // ==========================================
    // Strip special characters to create a clean search string
    const cleanQuery = user_prompt.replace(/[^a-zA-Z0-9 ]/g, "");
    const searchUrl = `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(cleanQuery + " birthday cake")}&image_type=illustration&per_page=3`;
    
    let targetImageUrl = "[https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=800&h=800&q=80](https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=800&h=800&q=80)"; // Premium static fallback asset

    try {
      const imgSearchResponse = await fetch(searchUrl);
      const imgData = await imgSearchResponse.json();
      
      if (imgData.hits && imgData.hits.length > 0) {
        // Randomly grab one of the top matches to guarantee layout variety
        const randomIndex = Math.floor(Math.random() * imgData.hits.length);
        targetImageUrl = imgData.hits[randomIndex].webformatURL;
      }
    } catch (imgErr) {
      // Gracefully logs error and preserves the fallback asset without crashing the server function
      console.log("Image search fallback triggered:", imgErr.message);
    }

    // ==========================================
    // STEP 3: OUTPUT CLEAN WEB PAYLOAD OBJECT
    // ==========================================
    return res.status(200).json({
      status: "success",
      card_type: "Custom Birthday Greeting Card",
      from: sender_name,
      card_text: cardTextDetails,
      print_configuration: {
        physical_dimensions: "4x4 inches",
        stored_image_url: targetImageUrl
      }
    });

  } catch (error) {
    return res.status(500).json({ status: "error", error: error.message });
  }
}
