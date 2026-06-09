import { GoogleGenAI } from '@google/genai';

// Initialize Google Gen AI
const ai = new GoogleGenAI({ apiKey: "AQ.Ab8RN6KLX9CMmNr0xeMOpItRqAwnUGpT6IaqqPRbZOYN07vR3Q" });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Safely grab user parameters from your ReqBin workspace payload
  const user_prompt = req.body.user_prompt || "A young boy blowing out candles on a birthday cake";
  const style_tone = req.body.style_tone || "Anime Art";
  const sender_name = req.body.sender_name || "Mom and Dad";

  try {
    // STEP A: Request structured greeting card content fields from Gemini
    const textPrompt = `Create custom birthday card text based on the theme: "${user_prompt}". Return raw JSON ONLY with these exact keys: "headline_greeting", "inside_message", "wishing_tone". Do NOT include any gaming terms, markdown codeblocks, or backticks.`;
    
    let cardTextDetails;
    try {
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

    // STEP B: Generate a completely unique, prompt-matched live AI rendering link
    const uniqueSeed = Math.floor(Math.random() * 9999999);
    const artworkPrompt = `vibrant birthday greeting card design, ${user_prompt}, ${style_tone} style, festive atmosphere, detailed digital art canvas`;
    
    // We pass the dynamic text prompt and seed directly to the public live delivery engine
    const directLiveAiUrl = `https://image.pollinations.ai/p/${encodeURIComponent(artworkPrompt)}?width=1000&height=1000&seed=${uniqueSeed}&nologo=true`;

    // STEP C: Return the clean success object back to your testing panel instantly
    return res.status(200).json({
      status: "success",
      card_type: "Custom Birthday Greeting Card",
      from: sender_name,
      card_text: cardTextDetails,
      print_configuration: {
        physical_dimensions: "4x4 inches",
        stored_image_url: directLiveAiUrl
      }
    });

  } catch (error) {
    return res.status(500).json({ status: "error", error: error.message });
  }
}
