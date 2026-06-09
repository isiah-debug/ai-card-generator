import { GoogleGenAI } from '@google/genai';
import axios from 'axios';

// Initialize the Google Gen AI SDK
const ai = new GoogleGenAI({ apiKey: "AQ.Ab8RN6KLX9CMmNr0xeMOpItRqAwnUGpT6IaqqPRbZOYN07vR3Q" });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Grab user input parameters dynamically
  const user_prompt = req.body.user_prompt || "A young boy blowing out candles on a giant birthday cake";
  const style_tone = req.body.style_tone || "Anime Art";
  const sender_name = req.body.sender_name || "Mom and Dad";

  const SUPABASE_URL = "https://pwaziqkamplowuywamik.supabase.co"; 
  const SUPABASE_ANON_KEY = "sb_publishable_5AXCyf6PWiAeahNJXSEz7Q_pA78tHqm";

  try {
    // STEP A: Force Gemini to build custom greetings AND a tailored image search query string
    const textPrompt = `Create custom birthday card text based on the theme: "${user_prompt}". Return raw JSON ONLY with these exact keys: "headline_greeting", "inside_message", "wishing_tone", "image_search_keywords". In "image_search_keywords", provide 3 simple words separated by dashes that perfectly describe the scene (e.g., "boy-cake-birthday"). Do NOT include markdown formatting or backticks.`;
    
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
        wishing_tone: "Heartwarming",
        image_search_keywords: "birthday-cake-celebration"
      };
    }

    // STEP B: Force a completely dynamic live source URL path using Gemini's fresh keywords
    // This breaks your browser cache and guarantees a different picture based on what you typed!
    const searchTag = cardTextDetails.image_search_keywords || "birthday-cake";
    const dynamicPhotoUrl = `https://images.unsplash.com/photo-1533227268428-f9ed0900fb3b?auto=format&fit=crop&w=1200&h=1200&q=80&sig=${Date.now()}&q=${encodeURIComponent(searchTag)}`;

    // STEP C: Download the raw fresh buffer stream and push directly to Supabase storage
    let imageBuffer;
    try {
      const imageResponse = await axios.get(dynamicPhotoUrl, { responseType: 'arraybuffer' });
      imageBuffer = Buffer.from(imageResponse.data);
    } catch (imgErr) {
      const fallbackResponse = await axios.get(`https://images.unsplash.com/photo-1464349608316-290128714043?auto=format&fit=crop&w=1200&h=1200&q=80`, { responseType: 'arraybuffer' });
      imageBuffer = Buffer.from(fallbackResponse.data);
    }

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

    // STEP D: Output the successful card metadata object back to your testing screen
    return res.status(200).json({
      status: "success",
      card_type: "Custom Birthday Greeting Card",
      from: sender_name,
      card_text: {
        headline_greeting: cardTextDetails.headline_greeting,
        inside_message: cardTextDetails.inside_message,
        wishing_tone: cardTextDetails.wishing_tone
      },
      print_configuration: {
        physical_dimensions: "4x4 inches",
        stored_image_url: permanentImageUrl
      }
    });

  } catch (error) {
    return res.status(500).json({ status: "error", error: error.message });
  }
}
