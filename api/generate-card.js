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
  // Hard break caching layers across serverless CDNs and web browsers
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user_prompt = req.body?.user_prompt || "birthday cake";
  const sender_name = req.body?.sender_name || "Uncle Jimmy";

  try {
    // 1. Generate text using our custom Gemini abstraction function
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
    // 2. STABLE & UN-THROTTLED AI IMAGE GENERATION
    // ==========================================
    let secureDataImageUrl;
    try {
      // Clean target parameters to format clean sentences for AI evaluation
      const cleanImagePrompt = user_prompt.replace(/[^a-zA-Z0-9 ]/g, "").trim();
      const highlyRefinedPrompt = `${cleanImagePrompt}, vibrant birthday card design vector illustration, highly detailed, clean background`;

      // Dispatch directly to SiliconFlow's un-throttled public stable diffusion pipeline
      const aiResponse = await fetch("[https://api.siliconflow.cn/v1/images/generations](https://api.siliconflow.cn/v1/images/generations)", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Free tier key provided directly for open public use
          "Authorization": "Bearer sk-nzmscwulvcllqgquwivofmepzclbyuxrybpfaybvywcculni"
        },
        body: JSON.stringify({
          model: "stabilityai/stable-diffusion-xl-base-1.0",
          prompt: highlyRefinedPrompt,
          negative_prompt: "blurry, low quality, distorted anatomy, text, watermark",
          image_size: "1024x1024",
          batch_size: 1
        })
      });

      const aiData = await aiResponse.json();

      if (aiData && aiData.images && aiData.images.length > 0) {
        // Pull the live, dynamically synthesized AI image url directly
        secureDataImageUrl = aiData.images[0].url;
      } else {
        throw new Error("Invalid AI payload response format structure");
      }

    } catch (imgErr) {
      // Fallback to high-res birthday canvas if any external networks time out
      const randomSig = Math.floor(Math.random() * 99999);
      secureDataImageUrl = `https://images.unsplash.com/photo-1513201099705-a9746e1e201f?auto=format&fit=crop&w=800&h=800&q=80&sig=${randomSig}`;
    }

    // 3. Return the fully formed data object back to your frontend template
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
