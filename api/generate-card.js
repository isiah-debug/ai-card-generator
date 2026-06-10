import fetch from 'node-fetch';

// CONFIGURATION VARIABLES
const GEMINI_API_KEY = "AQ.Ab8RN6KLX9CMmNr0xeMOpItRqAwnUGpT6IaqqPRbZOYN07vR3Q";

// ==========================================
// THE TEXT LLM WRAPPER ENGINE
// ==========================================
async function callLLMProvider(promptText) {
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const response = await fetch(geminiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }]
    })
  });

  if (!response.ok) {
    throw new Error(`LLM Provider API error: ${response.statusText}`);
  }

  const data = await response.json();
  let rawText = data.candidates[0].content.parts[0].text.trim();
  
  if (rawText.startsWith("```json")) rawText = rawText.replace(/```json|```/g, "").trim();
  if (rawText.startsWith("```")) rawText = rawText.replace(/```/g, "").trim();
  
  return JSON.parse(rawText);
}

// ==========================================
// MAIN SERVERLESS ROUTE HANDLER
// ==========================================
export default async function handler(req, res) {
  // Clear any serverless network or browser memory caching permanently
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user_prompt = req.body?.user_prompt || "birthday cake";
  const sender_name = req.body?.sender_name || "Uncle Jimmy";

  try {
    // 1. Generate text using our Gemini wrapper
    const systemPrompt = `Create custom birthday card text based on the theme: "${user_prompt}". Return raw JSON ONLY with these exact keys: "headline_greeting", "inside_message", "wishing_tone". Do NOT include any markdown formatting or backticks.`;
    
    let cardTextDetails;
    try {
      cardTextDetails = await callLLMProvider(systemPrompt);
    } catch (llmErr) {
      cardTextDetails = {
        headline_greeting: "Happy Birthday!",
        inside_message: `Wishing you an incredible day filled with fun adventures and great memories!`,
        wishing_tone: "Joyful"
      };
    }

    // 2. TRUE AI IMAGE GENERATION (Hugging Face / Stable Diffusion XL)
    let secureDataImageUrl;
    try {
      const stableDiffusionModelUrl = "[https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0](https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0)";
      const refinedAIPrompt = `${user_prompt}, beautiful vibrant greeting card design, vector graphic illustration, 8k resolution, crisp detail`;

      const imageEngineResponse = await fetch(stableDiffusionModelUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: refinedAIPrompt }),
      });

      // If Hugging Face is heavily loaded, automatically drop back to a reliable backup link
      if (!imageEngineResponse.ok) {
        throw new Error("Hugging Face engine busy");
      }

      // Convert the raw image binary buffer array into a totally un-throttled base64 source link
      const imageBuffer = await imageEngineResponse.arrayBuffer();
      const base64Image = Buffer.from(imageBuffer).toString('base64');
      secureDataImageUrl = `data:image/jpeg;base64,${base64Image}`;

    } catch (imgErr) {
      // Flawless, vibrant stock backup fallback if any external networks timeout
      secureDataImageUrl = "[https://images.unsplash.com/photo-1513201099705-a9746e1e201f?auto=format&fit=crop&w=800&h=800&q=80](https://images.unsplash.com/photo-1513201099705-a9746e1e201f?auto=format&fit=crop&w=800&h=800&q=80)";
    }

    // 3. Send payload object directly back to your frontend template
    return res.status(200).json({
      status: "success",
      card_type: "Custom Birthday Greeting Card",
      from: sender_name,
      card_text: cardTextDetails,
      print_configuration: {
        physical_dimensions: "4x4 inches",
        stored_image_url: secureDataImageUrl
      }
    });

  } catch (error) {
    return res.status(500).json({ status: "error", error: error.message });
  }
}
