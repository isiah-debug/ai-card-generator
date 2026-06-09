import { GoogleGenAI } from '@google/genai';
import axios from 'axios';

// Initializing the master Google AI ecosystem controller
const ai = new GoogleGenAI({ apiKey: "AQ.Ab8RN6KLX9CMmNr0xeMOpItRqAwnUGpT6IaqqPRbZOYN07vR3Q" });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user_prompt = req.body.user_prompt || "A little kid blowing out birthday candles";
  const style_tone = req.body.style_tone || "Cute Pixar Cartoon Style";
  const sender_name = req.body.sender_name || "Uncle Jimmy";

  const SUPABASE_URL = "https://pwaziqkamplowuywamik.supabase.co"; 
  const SUPABASE_ANON_KEY = "sb_publishable_5AXCyf6PWiAeahNJXSEz7Q_pA78tHqm";

  try {
    // ==========================================
    // STEP 1: GENERATE CUSTOM TEXT LAYOUT (AI TEXT)
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
    // STEP 2: GENERATE REAL IMAGE WITH AI (IMAGEN)
    // ==========================================
    let imageBuffer;
    try {
      // Combined prompt engineering to feed the image model model
      const finalVisualPrompt = `A high-quality birthday card design representing: ${user_prompt}. Artistic style: ${style_tone}. Vibrant colors, festive theme.`;
      
      const imageResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image', // Google's image generation target model
        contents: finalVisualPrompt,
      });

      // Extract the raw binary image data directly from the generated AI response parts
      let imagePart = imageResponse.candidates[0].content.parts.find(part => part.inlineData);
      
      if (imagePart && imagePart.inlineData) {
        imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
      } else {
        throw new Error("No inline image stream returned from Google model.");
      }
    } catch (imageGenError) {
      // Hardcoded rescue image buffer path if your key hits structural model limits
      const fallbackResponse = await axios.get('[https://i.imgur.com/8Z6B6W2.png](https://i.imgur.com/8Z6B6W2.png)', { responseType: 'arraybuffer' });
      imageBuffer = Buffer.from(fallbackResponse.data);
    }

    // ==========================================
    // STEP 3: UPLOAD RAW IMAGE BUFFER TO SUPABASE
    // ==========================================
    const uniqueFileName = `birthday-card-${Date.now()}.png`;
    const supabaseUploadUrl = `${SUPABASE_URL}/storage/v1/object/card-art/${uniqueFileName}`;

    await axios.post(supabaseUploadUrl, imageBuffer, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'image/png'
      }
    });

    // The live authenticated public reference string url
    const permanentImageUrl = `${SUPABASE_URL}/storage/v1/object/public/card-art/${uniqueFileName}`;

    // ==========================================
    // STEP 4: RETURN THE SUCCESS DATA OBJECT
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
