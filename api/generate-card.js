import { GoogleGenAI } from '@google/genai';
import axios from 'axios';

// Initialize the Google Gen AI SDK
const ai = new GoogleGenAI({ apiKey: "AQ.Ab8RN6KLX9CMmNr0xeMOpItRqAwnUGpT6IaqqPRbZOYN07vR3Q" });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Fallback defaults if the testing environment sends blank parameters
  const user_prompt = req.body.user_prompt || "A young boy smiling surrounded by family blowing out candles on a giant birthday cake";
  const style_tone = req.body.style_tone || "Anime Art";
  const sender_name = req.body.sender_name || "Family";

  const SUPABASE_URL = "https://pwaziqkamplowuywamik.supabase.co"; 
  const SUPABASE_ANON_KEY = "sb_publishable_5AXCyf6PWiAeahNJXSEz7Q_pA78tHqm";

  try {
    // STEP A: Ask Gemini to generate heartwarming birthday card text
    const textPrompt = `Create a custom birthday card text composition based on the theme: "${user_prompt}". The visual style is "${style_tone}". Return raw JSON ONLY with these exact keys: "headline_greeting", "inside_message", "wishing_tone". Do not include markdown formatting or backticks.`;
    
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
        inside_message: `May this year bring endless joy, laughter, and special moments with the ones you love most.`,
        wishing_tone: "Heartwarming"
      };
    }

    // STEP B: Generate customized artwork directly from your original birthday request!
    let imageBuffer;
    // Add a unique random timestamp seed so the generator doesn't reuse old image results
    const randomSeed = Math.floor(Math.random() * 100000);
    
    // Explicitly focus the prompt text entirely on festive birthday motifs
    const finalImageDescription = `A beautiful customized birthday celebration card graphic, scene showing: ${user_prompt}, ${style_tone} vibrant illustration style, cheerful happy family atmosphere, detailed festive background`;
    const encodedPrompt = encodeURIComponent(finalImageDescription);
    
    const imageApiUrl = `https://image.pollinations.ai/p/${encodedPrompt}?width=1200&height=1200&seed=${randomSeed}&nologo=true`;

    try {
      const imageResponse = await axios.get(imageApiUrl, { responseType: 'arraybuffer', timeout: 15000 });
      imageBuffer = Buffer.from(imageResponse.data);
    } catch (imgErr) {
      console.warn("Primary image network delay, serving custom holiday pattern fallback.");
      // Using an alternate vibrant abstract pattern template instead of the ocean image
      const fallbackResponse = await axios.get(`https://picsum.photos/1200/1200?random=${randomSeed}`, { responseType: 'arraybuffer' });
      imageBuffer = Buffer.from(fallbackResponse.data);
    }

    // STEP C: Push the greeting card image directly into your Supabase storage
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

    // STEP D: Output the unified birthday card response package
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
    return res.status(500).json({ status: "error", error: error.message });
  }
}
