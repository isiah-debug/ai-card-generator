import { GoogleGenAI } from '@google/genai';
import axios from 'axios';


const ai = new GoogleGenAI({ apiKey: "AQ.Ab8RN6KLX9CMmNr0xeMOpItRqAwnUGpT6IaqqPRbZOYNO7vR3Q" });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_prompt, card_type, style_tone } = req.body;

  
  const SUPABASE_URL = "https://pwaziqkamplowuywamik.supabase.co"; 
  const SUPABASE_ANON_KEY = "sb_publishable_5AXCyf6PWiAeahNJXSEz7Q_pA78tHqm";

  try {
    // STEP A: Ask Gemini to make the card text stats
    const textPrompt = `Create a trading card game asset based on the theme: "${user_prompt}". The card type is "${card_type}" and the visual tone is "${style_tone}". Return raw JSON ONLY with these exact keys: "title", "description", "attack", "defense". Do not include markdown or block quotes.`;
    
    let cardTextDetails;
    try {
      const textResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: textPrompt,
      });
      cardTextDetails = JSON.parse(textResponse.text.trim());
    } catch (apiErr) {
      cardTextDetails = {
        title: `${user_prompt || "Alpha"} Vanguard`,
        description: `A powerful custom entity forged in a ${style_tone || "Classic"} environment.`,
        attack: Math.floor(Math.random() * 40) + 50,
        defense: Math.floor(Math.random() * 40) + 45
      };
    }

    // STEP B: Fetch image backup (forcing 1200x1200px square format)
    let imageBuffer;
    try {
      const fallbackUrl = `https://picsum.photos/1200/1200`;
      const fallbackResponse = await axios.get(fallbackUrl, { responseType: 'arraybuffer' });
      imageBuffer = Buffer.from(fallbackResponse.data);
    } catch (imgErr) {
      return res.status(500).json({ status: "error", error: "Failed to grab sample image canvas" });
    }

    // STEP C: Send that square picture directly into your Supabase folder
    const fileName = `card-${Date.now()}.png`;
    const supabaseUploadUrl = `${SUPABASE_URL}/storage/v1/object/card-art/${fileName}`;

    await axios.post(supabaseUploadUrl, imageBuffer, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY, // Sending BOTH required authorization headers clears the 400 error!
        'Content-Type': 'image/png'
      }
    });

    const permanentImageUrl = `${SUPABASE_URL}/storage/v1/object/public/card-art/${fileName}`;

    // STEP D: Return final successful response
    return res.status(200).json({
      status: "success",
      card_details: cardTextDetails,
      print_configuration: {
        physical_dimensions: "4x4 inches",
        stored_image_url: permanentImageUrl
      }
    });

  } catch (error) {
    console.error("Pipeline Error:", error.message);
    return res.status(500).json({ status: "error", error: error.message });
  }
}
