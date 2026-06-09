import { GoogleGenAI } from '@google/genai';

// Authenticates BOTH text and true AI image generation using your API key
const ai = new GoogleGenAI({ apiKey: "AQ.Ab8RN6KLX9CMmNr0xeMOpItRqAwnUGpT6IaqqPRbZOYN07vR3Q" });

export default async function handler(req, res) {
  // Prevent any edge caching across live web routers
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
    // STEP 1: GENERATE CUSTOM TEXT (GEMINI)
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
    // STEP 2: STABLE NATIVE AI IMAGE (IMAGEN 3)
    // ==========================================
    // Generates genuine custom AI art directly on your authenticated plan
    const imagePrompt = `${user_prompt}, ${style_tone}, high resolution vibrant greeting card graphic, vector illustration style`;
    
    const imageResponse = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: imagePrompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '1:1',
      },
    });

    // Capture the secure base64 image data string directly from Google's response
    const base64ImageBytes = imageResponse.generatedImages[0].image.imageBytes;
    const dataUrlImage = `data:image/jpeg;base64,${base64ImageBytes}`;

    // ==========================================
    // STEP 3: RETURN SECURE PRODUCTION PAYLOAD
    // ==========================================
    // Returning a Data URL allows your web frontend to render the image instantly 
    // inside an <img src=""> tag without needing external hosting storage buckets.
    return res.status(200).json({
      status: "success",
      card_type: "Custom Birthday Greeting Card",
      from: sender_name,
      card_text: cardTextDetails,
      print_configuration: {
        physical_dimensions: "4x4 inches",
        stored_image_url: dataUrlImage
      }
    });

  } catch (error) {
    return res.status(500).json({ status: "error", error: error.message });
  }
}
