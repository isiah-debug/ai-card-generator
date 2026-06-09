import { GoogleGenAI } from '@google/genai';
import axios from 'axios';

// Initialize the Google Gen AI SDK
const ai = new GoogleGenAI({ apiKey: "AQ.Ab8RN6KLX9CMmNr0xeMOpItRqAwnUGpT6IaqqPRbZOYN07vR3Q" });

export async function handler(event, context) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Safely parse body variables sent from your ReqBin panel
  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    body = {};
  }

  const user_prompt = body.user_prompt || "A little kid blowing out birthday candles";
  const style_tone = body.style_tone || "Cute Pixar Cartoon Style";
  const sender_name = body.sender_name || "Uncle Jimmy";

  const SUPABASE_URL = "https://pwaziqkamplowuywamik.supabase.co"; 
  const SUPABASE_ANON_KEY = "sb_publishable_5AXCyf6PWiAeahNJXSEz7Q_pA78tHqm";

  try {
    // STEP A: Ask Gemini to generate heartwarming birthday card text
    const textPrompt = `Create custom birthday card text based on the theme: "${user_prompt}". Return raw JSON ONLY with these exact keys: "headline_greeting", "inside_message", "wishing_tone". Do NOT include any markdown codeblocks or backticks.`;
    
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

    // STEP B: Fetch a vibrant, guaranteed Birthday Cake photo instantly
    let imageBuffer;
    const guaranteedCakeUrl = `https://images.unsplash.com/photo-1533227268428-f9ed0900fb3b?auto=format&fit=crop&w=1200&h=1200&q=80`;

    try {
      const imageResponse = await axios.get(guaranteedCakeUrl, { responseType: 'arraybuffer' });
      imageBuffer = Buffer.from(imageResponse.data);
    } catch (imgErr) {
      const fallbackResponse = await axios.get('[https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=1200&h=1200&q=80](https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=1200&h=1200&q=80)', { responseType: 'arraybuffer' });
      imageBuffer = Buffer.from(fallbackResponse.data);
    }

    // STEP C: Push the image straight to your Supabase Storage bucket with a unique filename
    const uniqueFileName = `birthday-card-${Date.now()}.png`;
    const supabaseUploadUrl = `${SUPABASE_URL}/storage/v1/object/card-art/${uniqueFileName}`;

    await axios.post(supabaseUploadUrl, imageBuffer, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'image/png'
      }
    });

    const permanentImageUrl = `${SUPABASE_URL}/storage/v1/object/public/card-art/${uniqueFileName}`;

    // STEP D: Output successful Netlify standard response package
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "success",
        card_type: "Custom Birthday Greeting Card",
        from: sender_name,
        card_text: cardTextDetails,
        print_configuration: {
          physical_dimensions: "4x4 inches",
          stored_image_url: permanentImageUrl
        }
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "error", error: error.message })
    };
  }
}
