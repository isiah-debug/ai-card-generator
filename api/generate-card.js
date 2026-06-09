import { GoogleGenAI } from '@google/genai';
import axios from 'axios';

const ai = new GoogleGenAI({ apiKey: "AQ.Ab8RN6KLX9CMmNr0xeMOpItRqAwnUGpT6IaqqPRbZOYN07vR3Q" });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Cache buster variable to force Vercel to rebuild the function completely
  const _forceVercelRebuildTime = "2026-06-09T22:57:00"; 

  const user_prompt = req.body.user_prompt || "A little kid blowing out birthday candles";
  const style_tone = req.body.style_tone || "Cute Pixar Cartoon Style";
  const sender_name = req.body.sender_name || "Uncle Jimmy";

  try {
    // ==========================================
    // STEP 1: GENERATE CUSTOM CARD TEXT (GEMINI)
    // ==========================================
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

    // ==========================================
    // STEP 2: FETCH NEW AI IMAGE IN BINARY
    // ==========================================
    const sanitizedPrompt = encodeURIComponent(`${user_prompt}, ${style_tone}, vibrant celebration colors, high resolution greeting card`);
    const aiImageGenerationUrl = `https://image.pollinations.ai/p/${sanitizedPrompt}?width=800&height=800&seed=${Date.now()}&nologo=true`;

    const aiResponse = await axios({
      method: 'get',
      url: aiImageGenerationUrl,
      responseType: 'arraybuffer'
    });

    const imageBuffer = Buffer.from(aiResponse.data);

    // ==========================================
    // STEP 3: UPLOAD RAW IMAGE BUFFER TO IMGUR
    // ==========================================
    const base64Image = imageBuffer.toString('base64');
    
    const imgurResponse = await axios({
      method: 'post',
      url: '[https://api.imgur.com/3/image](https://api.imgur.com/3/image)',
      headers: {
        'Authorization': 'Client-ID fc130c24cb3cd79'
      },
      data: {
        image: base64Image,
        type: 'base64'
      }
    });

    const permanentImageUrl = imgurResponse.data.data.link;

    // ==========================================
    // STEP 4: RETURN THE SUCCESS DATA OBJECT
    // ==========================================
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
