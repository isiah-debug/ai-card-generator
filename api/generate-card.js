const SILICON_FLOW_KEY = process.env.SILICONFLOW_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const TEXT_API_URL = "https://api.siliconflow.com/v1/chat/completions";
const SILICONFLOW_IMAGE_URL = "https://api.siliconflow.com/v1/images/generations";
const DALLE3_API_URL = "https://api.openai.com/v1/images/generations";

// 🛡️ FREE IN-MEMORY TRACKING GLOBALS
let globalDailyCount = 0;
let lastResetTime = Date.now();

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
  if (!SILICON_FLOW_KEY) throw new Error("Missing SiliconFlow Key for text.");
  const response = await fetch(TEXT_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SILICON_FLOW_KEY.trim()}` },
    body: JSON.stringify({ model: "meta-llama/Meta-Llama-3-8B-Instruct", messages: [{ role: "user", content: promptText }], temperature: 0.7 })
  });
  const data = await response.json();
  return cleanAndParseJSON(data.choices[0].message.content);
}

// 🎨 PIPELINE A: PREMIUM DALL-E 3 ENGINE
async function generateDalle3ImageBase64(expandedPrompt) {
  if (!OPENAI_API_KEY) throw new Error("Missing OpenAI Key.");
  const response = await fetch(DALLE3_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY.trim()}` },
    body: JSON.stringify({ model: "dall-e-3", prompt: expandedPrompt, n: 1, size: "1024x1792", quality: "standard" })
  });
  const data = await response.json();
  if (data.error) throw new Error(`DALL-E 3 Error: ${data.error.message}`);
  if (!data.data || data.data.length === 0) throw new Error("No data back from OpenAI.");
  
  const imageUrl = data.data[0].url;
  const imgResponse = await fetch(imageUrl);
  const arrayBuffer = await imgResponse.arrayBuffer();
  return `data:image/png;base64,${Buffer.from(arrayBuffer).toString('base64')}`;
}

// ⚡ PIPELINE B: ECO-FALLBACK FLUX ENGINE
async function generateFluxImageBase64(expandedPrompt) {
  if (!SILICON_FLOW_KEY) throw new Error("Missing SiliconFlow Key.");
  let cleanKey = SILICON_FLOW_KEY.trim().replace(/^bearer\s+/i, '');
  const response = await fetch(SILICONFLOW_IMAGE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cleanKey}` },
    body: JSON.stringify({ model: "black-forest-labs/FLUX.1-schnell", prompt: expandedPrompt, image_size: "768x1024" })
  });
  const data = await response.json();
  if (!data.images || data.images.length === 0) throw new Error("FLUX array blank.");
  
  const imageUrl = data.images[0].url || data.images[0].b64_json;
  const imgResponse = await fetch(imageUrl);
  const arrayBuffer = await imgResponse.arrayBuffer();
  return `data:image/png;base64,${Buffer.from(arrayBuffer).toString('base64')}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // 100% Matches your original parameter readers
    const customMessage = req.body?.custom_message;
    const recipient = req.body?.recipient || "Someone Special";
    const occasion = req.body?.occasion || "Celebration";

    let designContext = customMessage || `A dynamic card themed around ${recipient} for a ${occasion} occasion`;

    // ⏰ CHECK FOR TIME RESET 
    const currentTime = Date.now();
    if (currentTime - lastResetTime > 86400000) {
      globalDailyCount = 0;
      lastResetTime = currentTime;
    }

    globalDailyCount++;
    const PREMIUM_DAILY_LIMIT = 5; 
    let finalBase64Image = "";

    if (globalDailyCount <= PREMIUM_DAILY_LIMIT) {
      try {
        // Run DALL-E 3
        let dallePrompt = designContext + ". Clean layout graphic vector design. No printed word elements or text typography over image.";
        finalBase64Image = await generateDalle3ImageBase64(dallePrompt);
        console.log(`[Premium DALL-E] Request running successfully: ${globalDailyCount}/${PREMIUM_DAILY_LIMIT}`);
      } catch (dalleError) {
        console.error("DALL-E failed or budget empty. Safely swapping to FLUX: ", dalleError);
        finalBase64Image = await generateFluxImageBase64(designContext);
      }
    } else {
      // 🔄 LIMIT HIT! Swap straight to FLUX 1-schnell
      console.log(`[Limit Swapped] Custom cap hit (${globalDailyCount - 1} spent). Routing directly to FLUX.`);
      finalBase64Image = await generateFluxImageBase64(designContext);
    }

    const textPrompt = `Generate a short 2-3 word greeting title for a greeting card matching this context: "${designContext}". Return strict JSON: {"headline_greeting": "HAPPY BIRTHDAY"}`;
    let cardText = { headline_greeting: "FOR YOU!" };
    try { cardText = await callLLMProvider(textPrompt); } catch (e) {}

    return res.status(200).json({
      status: "success",
      file_url: finalBase64Image,
      headline_greeting: cardText.headline_greeting
    });
  } catch (error) {
    console.error("Backend runtime failure:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
}
