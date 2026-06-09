import fetch from 'node-fetch';

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
    // ==========================================
    // STEP 1: OPENROUTER AUTHENTICATED PIPELINE
    // ==========================================
    const generationPrompt = `Create a custom birthday card layout based on this theme: "${user_prompt}". 
    Return a raw JSON object ONLY with these exact keys:
    "headline_greeting": "A short, catchy card front title",
    "inside_message": "An elegant, heartwarming birthday paragraph",
    "wishing_tone": "The general mood of the card",
    "svg_graphic_code": "Write a beautifully designed raw XML SVG element (width='800' height='800') containing vector paths, gradients, rectangles, or shapes representing the theme: '${user_prompt}'. Make sure it uses modern, vibrant colors matching a birthday theme and has a clear colored background."
    
    Do NOT include any markdown codeblocks, backticks, or text outside the JSON object. Return raw JSON only.`;

    // Accessing an unthrottled global edge route for Gemini 2.5 Flash
    const openRouterUrl = "https://openrouter.ai/api/v1/chat/completions";
    
    const apiResponse = await fetch(openRouterUrl, {
      method: "POST",
      headers: {
        "Authorization": "Bearer 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",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: generationPrompt }]
      })
    });

    const responseData = await apiResponse.json();

    if (responseData.error) {
      return res.status(400).json({ status: "error", error: responseData.error.message });
    }

    let rawText = responseData.choices[0].message.content.trim();
    
    // Self-sanitizing regex layer to extract raw JSON if markdown blocks crawl in
    if (rawText.includes("```")) {
      const openIndex = rawText.indexOf("{");
      const closeIndex = rawText.lastIndexOf("}");
      if (openIndex !== -1 && closeIndex !== -1) {
        rawText = rawText.substring(openIndex, closeIndex + 1);
      }
    }
    
    const parsedData = JSON.parse(rawText);

    // ==========================================
    // STEP 2: COMPOSE DATA IMAGE LINK
    // ==========================================
    const base64Svg = Buffer.from(parsedData.svg_graphic_code).toString('base64');
    const secureDataImageUrl = `data:image/svg+xml;base64,${base64Svg}`;

    // ==========================================
    // STEP 3: OUTPUT CLEAN WEBSITE PAYLOAD
    // ==========================================
    return res.status(200).json({
      status: "success",
      card_type: "Custom Birthday Greeting Card",
      from: sender_name,
      card_text: {
        headline_greeting: parsedData.headline_greeting,
        inside_message: parsedData.inside_message,
        wishing_tone: parsedData.wishing_tone
      },
      print_configuration: {
        physical_dimensions: "4x4 inches",
        stored_image_url: secureDataImageUrl
      }
    });

  } catch (error) {
    return res.status(500).json({ status: "error", error: error.message });
  }
}
