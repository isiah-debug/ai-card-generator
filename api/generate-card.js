import { GoogleGenAI } from '@google/genai';
import axios from 'axios';

// 1. Initialize your Gemini text creator using your free key
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
    
    const textResponse = await ai.models.generateContent({
      model: 'gemini-1.5-flash', // Fast free-tier model
      contents: textPrompt,
    });

    // Clean up and read the text data from Gemini
    const cardTextDetails = JSON.parse(textResponse.text.trim());

    // STEP B: Force Pollinations AI to make a perfect 4"x4" (1200x1200px) square image
    const encodedPrompt = encodeURIComponent(`${user_prompt}, ${style_tone} style, clean trading card artwork`);
    const imageApiUrl = `https://image.pollinations.ai/p/${encodedPrompt}?width=1200&height=1200&seed=42`;

    // Download the image as raw binary data stream
    const imageResponse = await axios.get(imageApiUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(imageResponse.data);

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
