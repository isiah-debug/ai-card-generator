import fetch from 'node-fetch';

// CONFIGURATION VARIABLES
const GEMINI_API_KEY = "AQ.Ab8RN6KLX9CMmNr0xeMOpItRqAwnUGpT6IaqqPRbZOYN07vR3Q";
const SILICON_FLOW_KEY = "sk-aqnelyloqupavmquzwptcigvzzurzmqodkdrrcrfgjxlmybq";

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
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user_prompt = req.body?.user_prompt || "birthday cake";
  const sender_name = req.body?.sender_name || "Uncle Jimmy";

  try {
    // 1. Generate text details utilizing the Gemini connection wrapper
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

    // ==========================================
    // 2. PRIVATELY AUTHENTICATED AI IMAGE PIPELINE
    // ==========================================
    let secureImageUrl;
    try {
      const cleanPromptInput = user_prompt.replace(/[^a-zA-Z0-9 ]/g, "").trim();
      const advancedArtPrompt = `${cleanPromptInput}, vibrant colorful birthday card design, vector illustration, highly detailed digital art, crisp clean focus`;

      // Structured OpenAI-compliant image generation fetch call
      const aiResponse = await fetch("[https://api.siliconflow.cn/v1/images/generations](https://api.siliconflow.cn/v1/images/generations)", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SILICON_FLOW_KEY}`
        },
        body: JSON.stringify({
          model: "stabilityai/stable-diffusion-xl-base-1.0",
          prompt: advancedArtPrompt,
          image_size: "1024x1024"
        })
      });

      const aiData = await aiResponse.json();

      // Debug mapping hook to print runtime errors inside your Vercel panel logs
      if (!aiResponse.ok) {
        console.error("SiliconFlow API Error Payload:", aiData);
        throw new Error(aiData?.message || "SiliconFlow server exception");
      }

      if (aiData?.data && aiData.data.length > 0 && aiData.data[0].url) {
        secureImageUrl = aiData.data[0].url;
      } else if (aiData?.images && aiData.images.length > 0) {
        secureImageUrl = aiData.images[0].url;
      } else {
        throw new Error("Unexpected response structural layout from SiliconFlow image object tree");
      }

    } catch (imgErr) {
      console.error("Caught Image Exception:", imgErr.message);
      // Emergency dynamic placeholder asset backup stream
      const randomSig = Math.floor(Math.random() * 9999);
      secureImageUrl = `https://images.unsplash.com/photo-1513201099705-a9746e1e201f?auto=format&fit=crop&w=800&h=800&q=80&sig=${randomSig}`;
    }

    // 3. Deliver payload parameters back to your front-end components
    return res.status(200).json({
      status: "success",
      card_type: "Custom Birthday Greeting Card",
      from: sender_name,
      card_text: cardTextDetails,
      print_configuration: {
        physical_dimensions: "4x4 inches",
        stored_image_url: secureImageUrl
      }
    });

  } catch (error) {
    return res.status(500).json({ status: "error", error: error.message });
  }
}
