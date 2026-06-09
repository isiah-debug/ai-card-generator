import { GoogleGenAI } from '@google/genai';
import axios from 'axios';

const ai = new GoogleGenAI({ apiKey: "AQ.Ab8RN6KLX9CMmNr0xeMOpItRqAwnUGpT6IaqqPRbZOYN07vR3Q" });

export default async function handler(req, res) {
  // Completely disable Vercel and browser caching
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user_prompt = req.body?.user_prompt || "A little kid blowing out birthday candles";
  const style_tone = req.body?.style_tone || "Cute Pixar Cartoon Style";
  const sender_name = req.body?.sender_name || "Uncle Jimmy";

  try {
    // ==========================================
    // STEP 1: GENERATE CUSTOM CARD TEXT (GEMINI)
    // ==========================================
    let cardTextDetails;
    try {
      const textPrompt = `Create custom birthday card text based on the theme: "${user_prompt}". Return raw JSON ONLY with these exact keys: "headline_greeting", "inside_message", "wishing_tone". Do NOT include any markdown codeblocks or backticks.`;
      
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
    // STEP 2: HIGH-SPEED DYNAMIC AI IMAGE ROUTE
    // ==========================================
    // Using a fast, high-availability cluster endpoint that doesn't rate-limit IP subnets
    const searchParams = encodeURIComponent(`${user_prompt}, ${style_tone}, celebration greeting card graphic, vector art style`);
    const dynamicAiUrl = `https://image.pollinations.ai/p/${searchParams}?width=512&height=512&nologo=true&private=true`;

    // ==========================================
    // STEP 3: OUTPUT SANITIZED SUCCESS PAYLOAD
    // ==========================================
    return res.status(200).json({
      status: "success",
      card_type: "Custom Birthday Greeting Card",
      from: sender_name,
      card_text: cardTextDetails,
      print_configuration: {
        physical_dimensions: "4x4 inches",
        stored_image_url: dynamicAiUrl
      }
    });

  } catch (error) {
    return res.status(500).json({ status: "error", error: error.message });
  }
}
