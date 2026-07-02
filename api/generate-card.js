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

// ... keeping your existing callLLMProvider, generateDalle3ImageBase64, and generateFluxImageBase64 code exactly the same ...

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const customMessage = req.body?.custom_message;
    const recipient = req.body?.recipient || "Someone Special";
    const occasion = req.body?.occasion || "Celebration";

    let designContext = customMessage || `A dynamic card themed around ${recipient} for a ${occasion} occasion`;

    // ⏰ CHECK FOR 24-HOUR TIME RESET (86400000 milliseconds = 1 day)
    const currentTime = Date.now();
    if (currentTime - lastResetTime > 86400000) {
      globalDailyCount = 0;
      lastResetTime = currentTime;
      console.log("[Reset] 24-hour window elapsed. Counter reset to 0.");
    }

    // Increment global count
    globalDailyCount++;
    
    const PREMIUM_DAILY_LIMIT = 5; 
    let finalBase64Image = "";

    if (globalDailyCount <= PREMIUM_DAILY_LIMIT) {
      try {
        designContext += ". Clean layout graphic vector design. No printed word elements or text typography over image.";
        finalBase64Image = await generateDalle3ImageBase64(designContext);
        console.log(`[Premium DALL-E] Running image request ${globalDailyCount}/${PREMIUM_DAILY_LIMIT}`);
      } catch (dalleError) {
        console.error("DALL-E failed. Dropping to FLUX fallback: ", dalleError);
        finalBase64Image = await generateFluxImageBase64(designContext);
      }
    } else {
      // 🔄 LIMIT HIT! Swap to cheap FLUX pipeline silently
      console.log(`[Limit Swapped] Daily limit reached (${globalDailyCount - 1} spent). Routing directly to FLUX.`);
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
