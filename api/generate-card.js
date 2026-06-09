import { GoogleGenAI } from '@google/genai';
import axios from 'axios';

// Initialize Google Gen AI
const ai = new GoogleGenAI({ apiKey: "AQ.Ab8RN6KLX9CMmNr0xeMOpItRqAwnUGpT6IaqqPRbZOYN07vR3Q" });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Read input parameters dynamically from the request body
  const user_prompt = req.body.user_prompt || "A young boy smiling surrounded by family blowing out candles on a giant birthday cake";
  const style_tone = req.body.style_tone || "Anime Art";
  const sender_name = req.body.sender_name || "Mom and Dad";

  const SUPABASE_URL = "https://pwaziqkamplowuywamik.supabase.co"; 
  const SUPABASE_ANON_KEY = "sb_publishable_5AXCyf6PWiAeahNJXSEz7Q_pA78tHqm";

  try {
    // STEP A: Request structured greeting card JSON fields from Gemini
    const textPrompt = `Create custom birthday card text based on the theme: "${user_prompt}". Return raw JSON ONLY with these exact keys: "headline_greeting", "inside_message", "wishing_tone". Do NOT include any markdown formatting, code blocks, or backticks.`;
    
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

    // STEP B: Generate unique, prompt-matched artwork using Pollinations AI
    let imageBuffer;
    const uniqueSeed = Math.floor(Math.random() * 1000000);
    
    // Build an explicit illustration prompt matching your greeting criteria
    const artworkPrompt = `vibrant birthday greeting card illustration, ${user_prompt}, ${style_tone} style, festive atmosphere, highly detailed digital art`;
    
    // The seed query parameter forces the generator to ignore old browser caches
    const dynamicGeneratorUrl = `https://image.pollinations.ai/p/${encodeURIComponent(artworkPrompt)}?width=1000&height=1000&seed=${uniqueSeed}&nologo=true`;

    try {
      const imageResponse = await axios.get(dynamicGeneratorUrl, { responseType: 'arraybuffer', timeout: 9000 });
      imageBuffer = Buffer.from(imageResponse.data);
    } catch (imgErr) {
      console.warn("Generation engine delayed, substituting high-quality fallback vector art asset.");
      const fallbackResponse = await axios.get(`https://images.unsplash.com/photo-1533227268428-f9ed0900fb3b?auto=format&fit=crop&w=1000&h=1000&q=80`, { responseType: 'arraybuffer' });
      imageBuffer = Buffer.from(fallbackResponse.data);
    }

    // STEP C: Upload file to Supabase using a unique timestamped filename
    const uniqueFileName = `birthday-${Date.now()}-${uniqueSeed}.png`;
    const supabaseUploadUrl = `${SUPABASE_URL}/storage/v1/object/card-art/${uniqueFileName}`;

    await axios.post(supabaseUploadUrl, imageBuffer, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'image/png'
      }
    });

    const permanentImageUrl = `${SUPABASE_URL}/storage/v1/object/public/card-art/${uniqueFileName}`;

    // STEP D: Send response back to ReqBin
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
    return res.status(500).json({ 
      status: "error", 
      error: error.message,
      details: error.response?.data || "Check Supabase Storage Policies panel" 
    });
  }
}
