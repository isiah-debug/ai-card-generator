import { GoogleGenAI } from '@google/genai';
import axios from 'axios';

// Initialize the Google Gen AI SDK with your actual API key snippet
const ai = new GoogleGenAI({ apiKey: "AQ.Ab8RN6KLX9CMmNr0xeMOpItRqAwnUGpT6IaqqPRbZOYN07vR3Q" });

export default async function handler(req, res) {
  // Only accept POST requests containing payload structures
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Fallback values provided in case fields are missing from the testing request
  const user_prompt = req.body.user_prompt || "Cybernetic Space Cat";
  const card_type = req.body.card_type || "Monster";
  const style_tone = req.body.style_tone || "Anime Art";

  // Hardcoded project paths pulled straight from your database snippets
  const SUPABASE_URL = "https://pwaziqkamplowuywamik.supabase.co"; 
  const SUPABASE_ANON_KEY = "sb_publishable_5AXCyf6PWiAeahNJXSEz7Q_pA78tHqm";

  try {
    // STEP A: Ask Gemini to generate the structured JSON card profile
    const textPrompt = `Create a trading card game asset based on the theme: "${user_prompt}". The card type is "${card_type}" and the visual tone is "${style_tone}". Return raw JSON ONLY with these exact keys: "title", "description", "attack", "defense". Do not include markdown formatting or backticks.`;
    
    let cardTextDetails;
    try {
      const textResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: textPrompt,
      });
      
      // Strip away any unexpected string wrappers if present
      let cleanText = textResponse.text.trim();
      if (cleanText.startsWith("```json")) cleanText = cleanText.replace(/```json|```/g, "").trim();
      if (cleanText.startsWith("```")) cleanText = cleanText.replace(/```/g, "").trim();
      
      cardTextDetails = JSON.parse(cleanText);
    } catch (apiErr) {
      console.warn("Gemini payload parsing issue, running structural override:", apiErr.message);
      cardTextDetails = {
        title: `${user_prompt} Vanguard`,
        description: `A powerful custom entity forged matching the ${style_tone} aesthetic.`,
        attack: Math.floor(Math.random() * 500) + 1000,
        defense: Math.floor(Math.random() * 500) + 1000
      };
    }

    // STEP B: Dynamically draw unique artwork from Pollinations matching the title!
    let imageBuffer;
    try {
      const artworkPrompt = `${cardTextDetails.title}, a high quality trading card character, ${style_tone} style, fantasy illustration, crisp details, standalone profile portrait`;
      const encodedPrompt = encodeURIComponent(artworkPrompt);
      
      // Forces a 4"x4" (1200x1200px) square rendering canvas
      const imageApiUrl = `https://image.pollinations.ai/p/${encodedPrompt}?width=1200&height=1200&nologo=true`;
      
      const imageResponse = await axios.get(imageApiUrl, { responseType: 'arraybuffer' });
      imageBuffer = Buffer.from(imageResponse.data);
    } catch (imgErr) {
      console.warn("Pollinations busy, using geometric placeholder asset:", imgErr.message);
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

    // STEP D: Output the unified, complete 200 OK success package
    return res.status(200).json({
      status: "success",
      card_details: cardTextDetails,
      print_configuration: {
        physical_dimensions: "4x4 inches",
        stored_image_url: permanentImageUrl
      }
    });

  } catch (error) {
    console.error("Pipeline Failure:", error.response?.data || error.message);
    return res.status(500).json({ 
      status: "error", 
      error: error.message,
      details: error.response?.data || "Verify bucket policy is set to true" 
    });
  }
}
