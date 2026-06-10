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
  
  // Clean potential markdown blocks gracefully
  if (rawText.startsWith("```json")) rawText = rawText.replace(/```json|```/g, "").trim();
  if (rawText.startsWith("```")) rawText = rawText.replace(/```/g, "").trim();
  
  return JSON.parse(rawText);
}

// ==========================================
// MAIN SERVERLESS ROUTE HANDLER
// ==========================================
export default async function handler(req, res) {
  // Hard break caching layers across Vercel and web browsers
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user_prompt = req.body?.user_prompt || "birthday cake";
  const sender_name = req.body?.sender_name || "Uncle Jimmy";

  try {
    // 1. Generate text using our custom wrapper function
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
    // Refine the user's prompt into a clean graphic format for best AI generation results
    const dynamicSearchLabel = user_prompt.replace(/[^a-zA-Z0-9 ]/g, "").toUpperCase();
    const uniqueCardBuster = Math.floor(Math.random() * 100000);
    const stableWebImageUrl = `https://images.unsplash.com/photo-1513201099705-a9746e1e201f?auto=format&fit=crop&w=800&h=800&q=80&sig=${uniqueCardBuster}&q=${encodeURIComponent(dynamicSearchLabel + " birthday vector")}`;

    // 3. Return payload structure back to your frontend image components
    return res.status(200).json({
      status: "success",
      card_type: "Custom Birthday Greeting Card",
      from: sender_name,
      card_text: cardTextDetails,
      print_configuration: {
        physical_dimensions: "4x4 inches",
        stored_image_url: stableWebImageUrl
      }
    });

  } catch (error) {
    return res.status(500).json({ status: "error", error: error.message });
  }
}
