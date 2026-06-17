const SILICON_FLOW_KEY = process.env.SILICONFLOW_API_KEY;
const TEXT_API_URL = "https://api.siliconflow.com/v1/chat/completions";
const IMAGE_API_URL = "https://api.siliconflow.com/v1/images/generations";

export const config = { api: { bodyParser: false } };

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

function extractValueFromMultipart(bodyStr, fieldName) {
  const match = new RegExp(`name="${fieldName}"[\\r\\n\\s]+([^\\r\\n\\-]+)`, 'i').exec(bodyStr);
  return match ? match[1].trim() : null;
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

async function generatePrimaryAIImageBase64(expandedPrompt) {
  let cleanKey = SILICON_FLOW_KEY.trim().replace(/^bearer\s+/i, '');
  const response = await fetch(IMAGE_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cleanKey}` },
    body: JSON.stringify({ model: "black-forest-labs/FLUX.1-schnell", prompt: expandedPrompt, image_size: "768x1024" })
  });
  const data = await response.json();
  let piece = data.images[0].url || data.images[0].b64_json;
  return (piece && !piece.startsWith('data:') && !piece.startsWith('http')) ? `data:image/png;base64,${piece}` : piece;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const chunks = [];
    for await (const chunk of req) { chunks.push(chunk); }
    const rawPayloadString = Buffer.concat(chunks).toString('utf-8');

    const occasion = extractValueFromMultipart(rawPayloadString, 'occasion') || "Celebration";
    const recipient = extractValueFromMultipart(rawPayloadString, 'recipient') || extractValueFromMultipart(rawPayloadString, 'prompt') || "Someone Special";
    const tone = extractValueFromMultipart(rawPayloadString, 'tone') || "festive";

    // Step 1: Generate clean text greeting using Llama
    const textPrompt = `Generate a short 2-3 word greeting title for an occasion: "${occasion}" for "${recipient}" with a "${tone}" tone. Return strict JSON: {"headline_greeting": "HAPPY BIRTHDAY"}`;
    let cardText = { headline_greeting: `${occasion.toUpperCase()}!` };
    try { cardText = await callLLMProvider(textPrompt); } catch (e) {}

    // Step 2: Generate background illustration WITHOUT letting AI generate embedded text pixels
    const imagePrompt = `A high-quality vertical portrait greeting card graphic background illustration themed around "${recipient}" for a "${occasion}" event. Clean vibrant modern composition, poster vector art, sharp details. DO NOT add any words, text, typography, or lettering inside the image graphics. Keep it a clean backdrop scenery.`;
    
    let finalImage;
    try {
      finalImage = await generatePrimaryAIImageBase64(imagePrompt);
    } catch (err) {
      finalImage = `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="768" height="1024"><rect width="100%" height="100%" fill="#1e293b"/></svg>`).toString('base64')}`;
    }

    return res.status(200).json({
      status: "success",
      file_url: finalImage,
      headline_greeting: cardText.headline_greeting // 👈 Send text cleanly to the frontend
    });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
}
