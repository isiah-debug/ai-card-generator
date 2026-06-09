import { GoogleGenAI } from '@google/genai';
import axios from 'axios';

// Initialize your Gemini text creator using your free key
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req, res) {
  // Only allow POST requests (sending info to the back-end)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get the fields sent by the user prompt
  const { user_prompt, card_type, style_tone } = req.body;

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
      console.warn("Gemini limit reached, applying fallback text structure:", apiErr.message);
      cardTextDetails = {
        title: `${user_prompt || "Alpha"} Vanguard`,
        description: `A powerful custom entity forged in a ${style_tone || "Classic"} environment.`,
        attack: Math.floor(Math.random() * 40) + 50,
        defense: Math.floor(Math.random() * 40) + 45
      };
    }

    // STEP B: Fetch image forcing perfect 4"x4" (1200x1200px) square dimensions
    let imageBuffer;
    const encodedPrompt = encodeURIComponent(`${user_prompt}, ${style_tone} style, clean trading card artwork`);
    const imageApiUrl = `https://image.pollinations.ai/p/${encodedPrompt}?width=1200&height=1200&seed=42`;

    try {
      // Primary Route: Attempt to get the image from Pollinations AI
      const imageResponse = await axios.get(imageApiUrl, { responseType: 'arraybuffer' });
      imageBuffer = Buffer.from(imageResponse.data);
    } catch (imgErr) {
      console.warn("Image generator busy or rate limited (402), pulling 4x4 asset backup:", imgErr.message);
      
      // Fallback Route: Grab a reliable, high-resolution square graphic from Picsum
      // This ensures your backend pipeline never fails to deliver a valid file to storage!
      const fallbackUrl = `https://picsum.photos/1200/1200`;
      const fallbackResponse = await axios.get(fallbackUrl, { responseType: 'arraybuffer' });
      imageBuffer = Buffer.from(fallbackResponse.data);
    }

    // STEP C: Send that square picture directly into your Supabase folder
    const fileName = `card-${Date.now()}.png`;
    const supabaseUploadUrl = `${process.env.SUPABASE_URL}/storage/v1/object/card-art/${fileName}`;

    await axios.post(supabaseUploadUrl, imageBuffer, {
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        'Content-Type': 'image/png'
      }
    });

    // Create the permanent internet link where the image is stored safely
    const permanentImageUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/card-art/${fileName}`;

    // STEP D: Send the combined result package back to the screen
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
