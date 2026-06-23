const SILICON_FLOW_KEY = process.env.SILICONFLOW_API_KEY;
const TEXT_API_URL = "https://api.siliconflow.com/v1/chat/completions";
const IMAGE_API_URL = "https://api.siliconflow.com/v1/images/generations";

function cleanAndParseJSON(rawString) {
  let cleanStr = rawString.trim();
  if (cleanStr.includes("```")) {
    cleanStr = cleanStr.split("\n").filter(line => !line.trim().startsWith("```")).join("\n").trim();
  }
  const startIdx = cleanStr.indexOf("{");
  const endIdx = cleanStr.lastIndexOf("}");
  if (startIdx === -1 || endIdx === -1) throw new Error("JSON missing.");
  return JSON.parse(cleanStr.substring(startIdx, endIdx + 1));
}

async function callLLMProvider(promptText) {
  if (!SILICON_FLOW_KEY) throw new Error("Missing Key.");
  const response = await fetch(TEXT_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SILICON_FLOW_KEY.trim()}` },
    body: JSON.stringify({ model: "meta-llama/Meta-Llama-3-8B-Instruct", messages: [{ role: "user", content: promptText }], temperature: 0.7 })
  });
  const data = await response.json();
  return cleanAndParseJSON(data.choices[0].message.content);
}

// 🎯 FIX: Downloads the image server-side and turns it into a bulletproof base64 data string
async function generatePrimaryAIImageBase64(expandedPrompt) {
  let cleanKey = SILICON_FLOW_KEY.trim().replace(/^bearer\s+/i, '');
  const response = await fetch(IMAGE_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cleanKey}` },
    body: JSON.stringify({ model: "black-forest-labs/FLUX.1-schnell", prompt: expandedPrompt, image_size: "768x1024" })
  });
  
  const data = await response.json();
  if (!data.images || data.images.length === 0) throw new Error("No images array returned from provider.");
  
  const imageUrl = data.images[0].url || data.images[0].b64_json;
  if (!imageUrl) throw new Error("No image data paths found in payload.");
  if (imageUrl.startsWith('data:')) return imageUrl;

  // Fetch the remote asset securely server-to-server (bypassing browser CORS)
  const imgResponse = await fetch(imageUrl);
  if (!imgResponse.ok) throw new Error(`Failed to download asset from image server: ${imgResponse.status}`);
  
  const arrayBuffer = await imgResponse.arrayBuffer();
  const base64String = Buffer.from(arrayBuffer).toString('base64');
  return `data:image/png;base64,${base64String}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const customMessage = req.body?.custom_message;
    const recipient = req.body?.recipient || "Someone Special";
    const occasion = req.body?.occasion || "Celebration";

    const designContext = customMessage || `A dynamic card themed around ${recipient} for a ${occasion} occasion`;

    const textPrompt = `Generate a short 2-3 word greeting title for a greeting card matching this context: "${designContext}". Return strict JSON: {"headline_greeting": "HAPPY BIRTHDAY"}`;
    let cardText = { headline_greeting: "FOR YOU!" };
    try { cardText = await callLLMProvider(textPrompt); } catch (e) {}
    
    // Fetch and compress into a clean Base64 data string
    const finalBase64Image = await generatePrimaryAIImageBase64(designContext);

    return res.status(200).json({
      status: "success",
      file_url: finalBase64Image,
      headline_greeting: cardText.headline_greeting
    });
  } catch (error) {
    console.error("Backend runtime crash:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
}
