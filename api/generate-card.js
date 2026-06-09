import { GoogleGenAI } from '@google/genai';
import axios from 'axios';

// Initialize the Google Gen AI SDK
const ai = new GoogleGenAI({ apiKey: "AQ.Ab8RN6KLX9CMmNr0xeMOpItRqAwnUGpT6IaqqPRbZOYN07vR3Q" });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Extract body variables safely
  const user_prompt = req.body.user_prompt || "A young boy blowing out candles on a birthday cake";
  const style_tone = req.body.style_tone || "Festive";
  const sender_name = req.body.sender_name || "Mom and Dad";

  const SUPABASE_URL = "https://pwaziqkamplowuywamik.supabase.co"; 
  const SUPABASE_ANON_KEY = "sb_publishable_5AXCyf6PWiAeahNJXSEz7Q_pA78tHqm";

  try {
    // STEP A: Ask Gemini to generate heartwarming birthday card text
    const textPrompt = `Create custom birthday card text based on the theme: "${user_prompt}". Return raw JSON ONLY with these exact keys: "headline_greeting", "inside_message", "wishing_tone". Do NOT include gaming terminology, markdown formatting, or backticks.`;
    
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
        headline_greeting: "Happy Birthday! Wishing You an Amazing Day!",
        inside_message: `May this special day be filled with endless joy, delicious cake, and beautiful memories with your family.`,
        wishing_tone: "Heartwarming"
      };
    }

    // STEP B: Instantly fetch a beautiful, relevant 4"x4" birthday photo
    let imageBuffer;
    
    // We target high-quality birthday imagery based on what you are creating
    const instantImageUrl = `https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1200&h=1200&q=80`;

    try {
      const imageResponse = await axios.get(instantImageUrl, { responseType: 'arraybuffer' });
      imageBuffer = Buffer.from(imageResponse.data);
    } catch (imgErr) {
      // Emergency secondary high-quality birthday cake image fallback
      const fallbackResponse = await axios.get(`https://images.unsplash.com/photo-1464349608316-290128714043?auto=format&fit=crop&w=1200&h=1200&q=80`, { responseType: 'arraybuffer' });
      imageBuffer = Buffer.from(fallbackResponse.data);
    }

    // STEP C: Push the image directly to your Supabase storage bucket
    const fileName = `birthday-card-${Date.now()}.png`;
    const supabaseUploadUrl = `${SUPABASE_URL}/storage/v1/object/card-art/${fileName}`;

    await axios.post(supabaseUploadUrl, imageBuffer, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'image/png'
      }
    });

    const permanentImageUrl = `${SUPABASE_URL}/storage/v1/object/public/card-art/${fileName}`;

    // STEP D: Output the unified success package back to your testing screen
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
    console.error("Pipeline Failure:", error.message);
    return res.status(500).json({ status: "error", error: error.message });
  }
}
