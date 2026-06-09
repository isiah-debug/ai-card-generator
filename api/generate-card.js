import { GoogleGenAI } from '@google/genai';
import axios from 'axios';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_prompt, card_type, style_tone } = req.body;

  try {
    // 1. Text Generation via Gemini
    const textPrompt = `Create a trading card game asset based on the theme: "${user_prompt}". The card type is "${card_type}" and the visual tone is "${style_tone}". Return raw JSON ONLY with these exact keys: "title", "description", "attack", "defense". Do not include markdown or block quotes.`;
    
    const textResponse = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: textPrompt,
    });

    const cardTextDetails = JSON.parse(textResponse.text.trim());

    // 2. Image Generation - Enforcing strict 4"x4" (1200x1200px) dimensions
    const encodedPrompt = encodeURIComponent(`${user_prompt}, ${style_tone} style, clean trading card artwork`);
    const imageApiUrl = `https://image.pollinations.ai/p/${encodedPrompt}?width=1200&height=1200&seed=42`;

    const imageResponse = await axios.get(imageApiUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(imageResponse.data);

    // 3. Save directly to your permanent storage bucket
    const fileName = `card-${Date.now()}.png`;
    const supabaseUploadUrl = `${process.env.SUPABASE_URL}/storage/v1/object/card-art/${fileName}`;

    await axios.post(supabaseUploadUrl, imageBuffer, {
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        'Content-Type': 'image/png'
      }
    });

    const permanentImageUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/card-art/${fileName}`;

    return res.status(200).json({
      status: "success",
      card_details: cardTextDetails,
      print_configuration: {
        physical_dimensions: "4x4 inches",
        stored_image_url: permanentImageUrl
      }
    });

  } catch (error) {
    return res.status(500).json({ status: "error", error: error.message });
  }
}
