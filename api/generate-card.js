import fetch from 'node-fetch';

const GEMINI_API_KEY = "AQ.Ab8RN6KLX9CMmNr0xeMOpItRqAwnUGpT6IaqqPRbZOYN07vR3Q";

export default async function handler(req, res) {
  // Prevent aggressive edge network caching across all serverless routers
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
    // STEP 2: LIVE OPEN-SOURCE GRAPHIC PIPELINE
    // ==========================================
    // Extracts clean, pure search tokens from the prompt to avoid API route parsing errors
    const isolatedSearchTokens = user_prompt
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .split(" ")
      .filter(word => word.length > 2 && !["with", "and", "the", "for", "from"].includes(word));

    // Force context modifiers to get beautiful results
    isolatedSearchTokens.push("birthday");
    const formattedSearchString = encodeURIComponent(isolatedSearchTokens.slice(0, 3).join("+"));

    // Uses Pixabay's open public developer infrastructure to completely bypass auth blocks
    const pixabayDiscoveryUrl = `https://pixabay.com/api/?key=44415512-c2b4cbaef994eec1ffbcda1a3&q=${formattedSearchString}&image_type=photo&orientation=square&per_page=3`;
    
    // Rock-solid high-resolution background asset fallback
    let finalLiveImageUrl = "[https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=800&h=800&q=80](https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=800&h=800&q=80)";

    try {
      const imgFetchResponse = await fetch(pixabayDiscoveryUrl);
      const imgResultData = await imgFetchResponse.json();
      
      if (imgResultData.hits && imgResultData.hits.length > 0) {
        // Grab a high-match hit dynamically
        finalLiveImageUrl = imgResultData.hits[0].largeImageURL;
      }
    } catch (imgErr) {
      console.log("Using primary backup layout layer:", imgErr.message);
    }

    // ==========================================
    // STEP 3: OUTPUT THE COMPLETE SUCCESS PAYLOAD
    // ==========================================
    return res.status(200).json({
      status: "success",
      card_type: "Custom Birthday Greeting Card",
      from: sender_name,
      card_text: cardTextDetails,
      print_configuration: {
        physical_dimensions: "4x4 inches",
        stored_image_url: finalLiveImageUrl
      }
    });

  } catch (error) {
    return res.status(500).json({ status: "error", error: error.message });
  }
}
