import { GoogleGenAI } from '@google/genai';
import axios from 'axios';

// Initialize the Google Gen AI SDK
const ai = new GoogleGenAI({ apiKey: "AQ.Ab8RN6KLX9CMmNr0xeMOpItRqAwnUGpT6IaqqPRbZOYN07vR3Q" });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get your raw input parameters safely
  const user_prompt = req.body.user_prompt || "A boy surrounded by family with birthday cake";
  const card_type = req.body.card_type || "Monster";
  const style_tone = req.body.style_tone || "Anime Art";

  const SUPABASE_URL = "https://pwaziqkamplowuywamik.supabase.co"; 
  const SUPABASE_ANON_KEY = "sb_publishable_5AXCyf6PWiAeahNJXSEz7Q_pA78tHqm";

  try {
    // STEP A: Request structured JSON properties from Gemini
    const textPrompt = `Create a trading card game asset based on the theme: "${user_prompt}". The card type is "${card_type}" and the visual tone is "${style_tone}". Return raw JSON ONLY with these exact keys: "title", "description", "attack", "defense". Do not include markdown formatting or backticks.`;
    
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
      console.warn("Gemini payload parsing issue, running structural override:", apiErr.message);
      // Clean fallback text formatting
      cardTextDetails = {
        title: user_prompt,
        description: `A unique card asset designed around the theme: "${user_prompt}" in an immersive environment.`,
        attack: Math.floor(Math.random() * 500) + 1000,
        defense: Math.floor(Math.random() * 500) + 1000
      };
    }

    // STEP B: Generate customized artwork directly from your original input prompt!
    let imageBuffer;
    try {
      // Using your raw user_prompt here ensures Pollinations AI draws exactly what you typed
      const artworkPrompt = `${user_prompt}, full detailed scene, ${style_tone} style, clean digital trading card illustration, vibrant colors`;
      const encodedPrompt = encodeURIComponent(artworkPrompt);
      
      const imageApiUrl = `https://image.pollinations.ai/p/${encodedPrompt}?width=1200&height=1200&nologo=true`;
      
      const imageResponse = await axios.get(imageApiUrl, { responseType: 'arraybuffer' });
      imageBuffer = Buffer.from(imageResponse.data);
    } catch (imgErr) {
      console.warn("Image engine error, pulling safe canvas backup:", imgErr.message);
      const fallbackResponse = await axios.get(`https://picsum.photos/1200/1200`, { responseType: 'arraybuffer' });
      imageBuffer = Buffer.from(fallbackResponse.data);
    }

    // STEP C: Push the custom generated image buffer directly to Supabase storage
    const fileName = `card-${Date.now()}.png`;
    const supabaseUploadUrl = `${SUPABASE_URL}/storage/v1/object/card-art/${fileName}`;

    await axios.post(supabaseUploadUrl, imageBuffer, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'image/png'
      }
    });

    const permanentImageUrl = `${SUPABASE_URL}/storage/v1/object/public/card-art/${fileName}`;

    // STEP D: Output the unified, complete success package
    return res.status(200).json({
      status: "success",
      card_details: cardTextDetails,
      print_configuration: {
        physical_dimensions: "4x4 inches",
        stored_image_url: permanentImageUrl
      }
    });

  } catch (error) {
    console.error("Pipeline Failure:", error.message);
    return res.status(500).json({ status: "error", error: error.message });
  }
}
