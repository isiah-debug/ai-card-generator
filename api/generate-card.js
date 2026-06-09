import { GoogleGenAI } from '@google/genai';
import axios from 'axios';

// Initialize the Google Gen AI SDK
const ai = new GoogleGenAI({ apiKey: "AQ.Ab8RN6KLX9CMmNr0xeMOpItRqAwnUGpT6IaqqPRbZOYN07vR3Q" });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Fallback defaults if fields are missing
  const user_prompt = req.body.user_prompt || "A young boy smiling surrounded by family blowing out candles on a birthday cake";
  const style_tone = req.body.style_tone || "Anime Art";
  const sender_name = req.body.sender_name || "Mom and Dad";

  const SUPABASE_URL = "https://pwaziqkamplowuywamik.supabase.co"; 
  const SUPABASE_ANON_KEY = "sb_publishable_5AXCyf6PWiAeahNJXSEz7Q_pA78tHqm";

  try {
    // STEP A: Ask Gemini to generate heartwarming birthday card text
    const textPrompt = `Create custom birthday card text based on the theme: "${user_prompt}". The visual style is "${style_tone}". Return raw JSON ONLY with these exact keys: "headline_greeting", "inside_message", "wishing_tone". Do NOT include gaming terminology, attack stats, markdown formatting, or backticks.`;
    
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

    // STEP B: Fetch a dynamic image generated exactly from your prompt using Hugging Face's open AI router
    let imageBuffer;
    
    // Build an ultra-descriptive prompt for the generator to get exactly what you want
    const finalImageDescription = `A beautiful, clean illustration of ${user_prompt}, ${style_tone} style, bright happy celebratory colors, detailed graphic design, vector poster art style, 4x4 ratio square aspect`;
    
    // We target the stable dynamic model pipeline hosted publicly by HuggingFace
    const publicHfApiUrl = `https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell`;

    try {
      const hfResponse = await axios.post(
        publicHfApiUrl,
        { inputs: finalImageDescription },
        { responseType: 'arraybuffer', timeout: 15000 }
      );
      imageBuffer = Buffer.from(hfResponse.data);
    } catch (imgErr) {
      console.warn("Primary AI generator busy, pulling dynamic fallback engine...");
      // Fallback to a fast public text-to-image mirror to ensure it never returns generic landscape/balloons
      const mirrorUrl = `https://image.pollinations.ai/p/${encodeURIComponent(finalImageDescription)}?width=1200&height=1200&nologo=true`;
      const mirrorResponse = await axios.get(mirrorUrl, { responseType: 'arraybuffer' });
      imageBuffer = Buffer.from(mirrorResponse.data);
    }

    // STEP C: Push the custom generated birthday image directly to Supabase storage
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

    // STEP D: Output the unified, complete success package
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
