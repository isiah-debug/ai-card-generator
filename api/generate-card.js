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
  // Shatter all edge CDN caching loops completely
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user_prompt = req.body?.user_prompt || "birthday cake";
  const sender_name = req.body?.sender_name || "Uncle Jimmy";

  try {
    // 1. Generate custom greeting card text utilizing Gemini
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
    // 2. STABLE HTML VECTOR IMAGE ENGINE
    // ==========================================
    // Dynamically rotate vibrant gradients to provide visual diversity per theme length
    const designPalettes = [
      { bg: "linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)", secondary: "#FFF" },
      { bg: "linear-gradient(135deg, #4E65FF 0%, #92EFFD 100%)", secondary: "#FFF" },
      { bg: "linear-gradient(135deg, #11998E 0%, #38EF7D 100%)", secondary: "#FFF" },
      { bg: "linear-gradient(135deg, #7F00FF 0%, #E100FF 100%)", secondary: "#FFF" }
    ];
    const activePalette = designPalettes[user_prompt.length % designPalettes.length];
    
    // Clean up input characters to build a clean title string banner
    const cleanDisplayTitle = user_prompt.replace(/[^a-zA-Z0-9 ]/g, "").toUpperCase();

    // Pure standalone inline HTML graphic template layout
    const embeddedGraphicTemplate = `<div style="width:800px;height:800px;background:${activePalette.bg};display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'Segoe UI',system-ui,sans-serif;position:relative;box-sizing:border-box;padding:60px;overflow:hidden;border:16px solid rgba(255,255,255,0.25);">
      <div style="position:absolute;width:500px;height:500px;background:rgba(255,255,255,0.08);border-radius:50%;top:-150px;right:-150px;"></div>
      <div style="position:absolute;width:400px;height:400px;background:rgba(255,255,255,0.04);border-radius:50%;bottom:-100px;left:-100px;"></div>
      <div style="background:rgba(255,255,255,0.2);padding:14px 32px;border-radius:50px;color:#FFF;font-weight:bold;font-size:20px;letter-spacing:6px;margin-bottom:40px;backdrop-filter:blur(10px);box-shadow:0 10px 30px rgba(0,0,0,0.05);">CELEBRATION</div>
      <h1 style="color:#FFF;font-size:48px;margin:0 0 20px 0;text-align:center;letter-spacing:2px;line-height:1.3;font-weight:900;text-shadow:0 6px 15px rgba(0,0,0,0.15);max-width:680px;">${cleanDisplayTitle}</h1>
      <div style="width:120px;height:4px;background:#FFF;opacity:0.6;margin-bottom:25px;border-radius:2px;"></div>
      <p style="color:#FFF;font-size:22px;margin:0;opacity:0.95;font-weight:600;letter-spacing:3px;text-align:center;">SPECIALLY CREATED FOR YOU</p>
    </div>`;

    // Encode our dynamic card layout directly into a stable Base64 Image URL string
    const compiledBase64 = Buffer.from(embeddedGraphicTemplate).toString('base64');
    const locallyGeneratedImageStream = `data:text/html;base64,${compiledBase64}`;

    // 3. Return the payload safely back to your front-end components
    return res.status(200).json({
      status: "success",
      card_type: "Custom Birthday Greeting Card",
      from: sender_name,
      card_text: cardTextDetails,
      print_configuration: {
        physical_dimensions: "4x4 inches",
        stored_image_url: locallyGeneratedImageStream
      }
    });

  } catch (error) {
    return res.status(500).json({ status: "error", error: error.message });
  }
}
