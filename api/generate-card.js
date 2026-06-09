import { GoogleGenAI } from '@google/genai';
import axios from 'axios';

// Initialize the Google Gen AI SDK
const ai = new GoogleGenAI({ apiKey: "AQ.Ab8RN6KLX9CMmNr0xeMOpItRqAwnUGpT6IaqqPRbZOYN07vR3Q" });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Grab user input parameters
  const user_prompt = req.body.user_prompt || "A young boy smiling surrounded by family blowing out candles on a birthday cake";
  const style_tone = req.body.style_tone || "Anime Art";
  const sender_name = req.body.sender_name || "Mom and Dad";

  const SUPABASE_URL = "https://pwaziqkamplowuywamik.supabase.co"; 
  const SUPABASE_ANON_KEY = "sb_publishable_5AXCyf6PWiAeahNJXSEz7Q_pA78tHqm";

  try {
    // STEP A: Ask Gemini to generate custom greeting text
    const textPrompt = `Create custom birthday card text based on the theme: "${user_prompt}". Return raw JSON ONLY with these exact keys: "headline_greeting", "inside_message", "wishing_tone". Do NOT include gaming stats, markdown formatting, or backticks.`;
    
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

    // STEP B: Generate customized artwork directly matching your text description
    let imageBuffer;
    const randomSeed = Math.floor(Math.random() * 999999);
    
    // Combine prompt and style into a single instruction string
    const dynamicPromptString = `A custom birthday greeting card illustration showing ${user_prompt}, ${style_tone} style, bright happy colors, festive celebratory detailed design`;
    
    // This public AI endpoint reads the text string and generates a dynamic 1200x1200px square asset instantly
    const rapidAiUrl = `https://image.pollinations.ai/p/${encodeURIComponent(dynamicPromptString)}?width=1200&height=1200&seed=${randomSeed}&nologo=true`;

    try {
      // Fetching from a fast-response streaming buffer to make sure it runs before Vercel times out
      const imageResponse = await axios.get(rapidAiUrl, { responseType: 'arraybuffer', timeout: 9000 });
      imageBuffer = Buffer.from(imageResponse.data);
    } catch (imgErr) {
      console.warn("Primary path traffic busy, drawing default high-quality birthday cake graphic.");
      // Standard colorful birthday cake backup image if streaming hits a brief bottleneck
      const fallbackResponse = await axios.get(`https://images.unsplash.com/photo-1533227268428-f9ed0900fb3b?auto=format&fit=crop&w=1200&h=1200&q=80`, { responseType: 'arraybuffer' });
      imageBuffer = Buffer.from(fallbackResponse.data);
    }

    // STEP C: Upload the generated image straight into your open Supabase bucket folder
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

    // STEP D: Output the successful card response structure
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
