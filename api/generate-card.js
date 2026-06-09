import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: "AQ.Ab8RN6KLX9CMmNr0xeMOpItRqAwnUGpT6IaqqPRbZOYN07vR3Q" });

export default async function handler(req, res) {
  // Hard-destroy caching across Vercel and browser states
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
    // STEP 1: GENERATE CUSTOM CARD TEXT (GEMINI)
    // ==========================================
    let cardTextDetails;
    try {
      const textPrompt = `Create custom birthday card text based on the theme: "${user_prompt}". Return raw JSON ONLY with these exact keys: "headline_greeting", "inside_message", "wishing_tone". Do NOT include any markdown codeblocks or backticks.`;
      
      const textResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: textPrompt,
      });
      
      let cleanText = textResponse.text.trim();
      if (cleanText.startsWith("```json")) cleanText = cleanText.replace(/```json|```/g, "").trim();
      if (cleanText.startsWith("```")) cleanText = cleanText.replace(/```/g, "").trim();
      
      cardTextDetails = JSON.parse(cleanText);
    } catch (apiErr) {
      cardTextDetails = {
        headline_greeting: "Happy Birthday!",
        inside_message: `May your day be filled with cake, laughter, and your favorite people.`,
        wishing_tone: "Joyful"
      };
    }

    // ==========================================
    // STEP 2: TRUE DYNAMIC GRAPHIC REDIRECT
    // ==========================================
    // Combines user prompt with card graphic identifiers to hit the open Unsplash keyword engine
    const searchTerms = encodeURIComponent(`${user_prompt} birthday greeting card illustration vector`);
    const uniqueSig = Math.floor(Math.random() * 999999);
    
    // Using the flexible source keyword redirect endpoint with a cache-buster signature
    const permanentImageUrl = `https://source.unsplash.com/featured/800x800/?${searchTerms}&sig=${uniqueSig}`;

    // ==========================================
    // STEP 3: OUTPUT PAYLOAD OBJECT
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
