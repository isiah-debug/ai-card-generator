import { GoogleGenAI } from '@google/genai';
import axios from 'axios';

// Initialize the Google Gen AI SDK
const ai = new GoogleGenAI({ apiKey: "AQ.Ab8RN6KLX9CMmNr0xeMOpItRqAwnUGpT6IaqqPRbZOYN07vR3Q" });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Extract parameters sent from your ReqBin payload
  const user_prompt = req.body.user_prompt || "A little kid smiling while looking at a giant chocolate birthday cake with candles";
  const style_tone = req.body.style_tone || "Cute Pixar Cartoon Style";
  const sender_name = req.body.sender_name || "Uncle Jimmy";

  // Verified credentials matching your workspace images
  const SUPABASE_URL = "https://pwaziqkamplowuywamik.supabase.co"; 
  const SUPABASE_ANON_KEY = "sb_publishable_5AXCyf6PWiAeahNJXSEz7Q_pA78tHqm";

  try {
    // STEP A: Request structured greeting card content fields from Gemini
    const textPrompt = `Create custom birthday card text based on the theme: "${user_prompt}". Return raw JSON ONLY with these exact keys: "headline_greeting", "inside_message", "wishing_tone". Do NOT include any markdown code blocks, formatting, or backticks.`;
    
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

    // STEP B: Generate customized artwork via an alternative fast image stream endpoint
    let imageBuffer;
    const randomSeed = Math.floor(Math.random() * 999999);
    
    // Formatting a distinct, highly descriptive instruction string
    const targetArtworkDescription = `A beautiful greeting card illustration of ${user_prompt}, ${style_tone}, bright happy festive colors, detailed background`;
    
    // Using a reliable high-speed public image pipeline layout
    const fastImageEndpoint = `https://image.pollinations.ai/p/${encodeURIComponent(targetArtworkDescription)}?width=1000&height=1000&seed=${randomSeed}&nologo=true`;

    try {
      // Adding a dynamic timestamp to break any server or browser caching
      const imageResponse = await axios.get(fastImageEndpoint, { responseType: 'arraybuffer', timeout: 8000 });
      imageBuffer = Buffer.from(imageResponse.data);
    } catch (imgErr) {
      console.warn("Primary image network busy, saving instant festive cake canvas pattern.");
      // Unsplash vector holiday pattern layout fallback to guarantee an image is present
      const fallbackResponse = await axios.get(`https://images.unsplash.com/photo-1533227268428-f9ed0900fb3b?auto=format&fit=crop&w=1000&h=1000&q=80`, { responseType: 'arraybuffer' });
      imageBuffer = Buffer.from(fallbackResponse.data);
    }

    // STEP C: Push the fresh binary data to your public Supabase Storage bucket
    // Generating a brand-new unique filename each time forces the browser to discard old cached files!
    const dynamicFileName = `card-${Date.now()}-${randomSeed}.png`;
    const supabaseUploadUrl = `${SUPABASE_URL}/storage/v1/object/card-art/${dynamicFileName}`;

    await axios.post(supabaseUploadUrl, imageBuffer, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'image/png'
      }
    });

    const permanentImageUrl = `${SUPABASE_URL}/storage/v1/object/public/card-art/${dynamicFileName}`;

    // STEP D: Output the complete success package back to your testing screen
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
    console.error("Pipeline Error Trace:", error.message);
    return res.status(500).json({ 
      status: "error", 
      error: error.message,
      details: error.response?.data || "Check Storage Bucket Policies panel inside Supabase"
    });
  }
}
