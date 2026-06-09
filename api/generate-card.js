const { GoogleGenAI } = require('@google/genai');
const http = require('https');

// Initialize the core text layout generation client
const ai = new GoogleGenAI({ apiKey: "AQ.Ab8RN6KLX9CMmNr0xeMOpItRqAwnUGpT6IaqqPRbZOYN07vR3Q" });

module.exports = async (req, res) => {
  // Clear any existing cache configurations explicitly via response headers
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user_prompt = req.body?.user_prompt || "A little kid blowing out birthday candles";
  const style_tone = req.body?.style_tone || "Cute Pixar Cartoon Style";
  const sender_name = req.body?.sender_name || "Uncle Jimmy";

  try {
    // ==========================================
    // STEP 1: GENERATE CARD TEXT LAYOUT
    // ==========================================
    const textPrompt = `Create custom birthday card text based on the theme: "${user_prompt}". Return raw JSON ONLY with these exact keys: "headline_greeting", "inside_message", "wishing_tone". Do NOT include any markdown codeblocks or backticks.`;
    
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

    // ==========================================
    // STEP 2: GENERATE REAL-TIME DYNAMIC AI LINK
    // ==========================================
    // Generates a unique, real-time AI image url based strictly on your text inputs.
    // Zero dependencies, zero third-party upload servers, zero quota risks.
    const uniqueSeed = Math.floor(Math.random() * 1000000);
    const sanitizedPrompt = encodeURIComponent(`${user_prompt}, ${style_tone}, high resolution vector illustration, holiday greeting card`);
    const dynamicAiUrl = `https://image.pollinations.ai/p/${sanitizedPrompt}?width=800&height=800&seed=${uniqueSeed}&nologo=true`;

    return res.status(200).json({
      status: "success",
      card_type: "Custom Birthday Greeting Card",
      from: sender_name,
      card_text: cardTextDetails,
      print_configuration: {
        physical_dimensions: "4x4 inches",
        stored_image_url: dynamicAiUrl
      }
    });

  } catch (error) {
    return res.status(500).json({ status: "error", error: error.message });
  }
};
