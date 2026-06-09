import fetch from 'node-fetch';

const GEMINI_API_KEY = "AQ.Ab8RN6KLX9CMmNr0xeMOpItRqAwnUGpT6IaqqPRbZOYN07vR3Q";

export default async function handler(req, res) {
  // Enforce absolute cache destruction across all serverless routers and live web browsers
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
        inside_message: `Wishing you an incredible day filled with sweet moments, laughter, and your favorite treats!`,
        wishing_tone: "Joyful"
      };
    }

    // ==========================================
    // STEP 2: STABLE HIGH-RES IMAGE MATCHING ENGINE
    // ==========================================
    const normalPrompt = user_prompt.toLowerCase();
    
    // Fallback dictionary linking key platform terms to permanent, premium photographic assets
    let chosenPhotoId = "photo-1530103862676-de8c9debad1d"; // Universal Premium Festive Balloons Background

    if (normalPrompt.includes("fortnite") || normalPrompt.includes("gaming") || normalPrompt.includes("game")) {
      chosenPhotoId = "photo-1542751371-adc38448a05e"; // High-res neon gaming/controller setup
    } else if (normalPrompt.includes("dinosaur") || normalPrompt.includes("dino") || normalPrompt.includes("animal")) {
      chosenPhotoId = "photo-1569336415962-a4bd9f69cd83"; // Creative stylized art/dinosaur graphics
    } else if (normalPrompt.includes("space") || normalPrompt.includes("rocket") || normalPrompt.includes("galaxy")) {
      chosenPhotoId = "photo-1506703719100-a0f3a48c0f86"; // Majestic colorful nebula space canvas
    } else if (normalPrompt.includes("cake") || normalPrompt.includes("cupcake") || normalPrompt.includes("candle")) {
      chosenPhotoId = "photo-1533782654613-826a072dd6f3"; // Gourmet birthday cake with glowing candles
    }

    const uniqueBuster = Math.floor(Math.random() * 999999);
    const stableWebImageUrl = `https://images.unsplash.com/${chosenPhotoId}?auto=format&fit=crop&w=800&h=800&q=80&sig=${uniqueBuster}`;

    // ==========================================
    // STEP 3: OUTPUT THE COMPLETE PERFECT PAYLOAD
    // ==========================================
    return res.status(200).json({
      status: "success",
      card_type: "Custom Birthday Greeting Card",
      from: sender_name,
      card_text: cardTextDetails,
      print_configuration: {
        physical_dimensions: "4x4 inches",
        stored_image_url: stableWebImageUrl
      }
    });

  } catch (error) {
    return res.status(500).json({ status: "error", error: error.message });
  }
}
