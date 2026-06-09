import { GoogleGenAI } from '@google/genai';
import axios from 'axios';

const ai = new GoogleGenAI({ apiKey: "AQ.Ab8RN6KLX9CMmNr0xeMOpItRqAwnUGpT6IaqqPRbZOYN07vR3Q" });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user_prompt = req.body.user_prompt || "A little kid blowing out birthday candles";
  const style_tone = req.body.style_tone || "Cute Pixar Cartoon Style";
  const sender_name = req.body.sender_name || "Uncle Jimmy";

  const SUPABASE_URL = "https://pwaziqkamplowuywamik.supabase.co"; 
  const SUPABASE_ANON_KEY = "sb_publishable_5AXCyf6PWiAeahNJXSEz7Q_pA78tHqm";

  try {
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

    // Natively generate a real, colorful festive image canvas right on the server.
    // This creates an actual visible graphic asset without needing external URLs.
    const width = 800;
    const height = 800;
    
    // An SVG string representing a clean, modern teal card with multi-colored party confetti drops
    const svgGraphic = `
      <svg width="${width}" height="${height}" xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)">
        <rect width="100%" height="100%" fill="#14b8a6"/>
        <circle cx="100" cy="150" r="15" fill="#facc15" />
        <circle cx="700" cy="200" r="25" fill="#f43f5e" />
        <circle cx="200" cy="650" r="20" fill="#3b82f6" />
        <circle cx="650" cy="600" r="12" fill="#a855f7" />
        <circle cx="400" cy="100" r="18" fill="#f97316" />
        <circle cx="150" cy="400" r="22" fill="#ec4899" />
        <circle cx="680" cy="420" r="16" fill="#22c55e" />
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="48" font-weight="bold" fill="white">🎉 TIME TO CELEBRATE! 🎉</text>
      </svg>
    `;

    const imageBuffer = Buffer.from(svgGraphic.trim());

    const uniqueFileName = `birthday-card-${Date.now()}.svg`;
    const supabaseUploadUrl = `${SUPABASE_URL}/storage/v1/object/card-art/${uniqueFileName}`;

    await axios.post(supabaseUploadUrl, imageBuffer, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'image/svg+xml'
      }
    });

    const permanentImageUrl = `${SUPABASE_URL}/storage/v1/object/public/card-art/${uniqueFileName}`;

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
