const SILICON_FLOW_KEY = process.env.SILICONFLOW_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY; 

const TEXT_API_URL = "https://api.siliconflow.com/v1/chat/completions";
const DALLE3_API_URL = "https://api.openai.com/v1/images/generations";

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


async function generatePrimaryAIImageBase64(expandedPrompt) {
  if (!OPENAI_API_KEY) throw new Error("Missing OpenAI API Key Configuration.");
  
  const response = await fetch(DALLE3_API_URL, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json', 
      'Authorization': `Bearer ${OPENAI_API_KEY.trim()}` 
    },
    body: JSON.stringify({ 
      model: "dall-e-3", 
      prompt: expandedPrompt, 
      n: 1,
      size: "1024x1792", 
      quality: "standard" 
    })
  });
  
  const data = await response.json();
  
  if (data.error) {
    throw new Error(`OpenAI DALL-E 3 API Error: ${data.error.message}`);
  }
  
  if (!data.data || data.data.length === 0) {
    throw new Error("No image objects returned from DALL-E payload structure.");
  }
  

  const imageUrl = data.data[0].url;
  if (!imageUrl) throw new Error("No image data paths found in OpenAI payload.");

  const imgResponse = await fetch(imageUrl);
  if (!imgResponse.ok) throw new Error(`Failed to download asset from DALL-E image server: ${imgResponse.status}`);
  
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

    let designContext = customMessage || `A dynamic card themed around ${recipient} for a ${occasion} occasion`;
    
    
    designContext += ". Please present this as a clean graphic layout design illustration background. Do not add text phrases, quotes, or letters printed over the card layout image.";

    const textPrompt = `Generate a short 2-3 word greeting title for a greeting card matching this context: "${designContext}". Return strict JSON: {"headline_greeting": "HAPPY BIRTHDAY"}`;
    let cardText = { headline_greeting: "FOR YOU!" };
    try { cardText = await callLLMProvider(textPrompt); } catch (e) {
      console.error("Text headline generator failed, dropping down to default fallback: ", e);
    }
    
    
    const finalBase64Image = await generatePrimaryAIImageBase64(designContext);

    return res.status(200).json({
      status: "success",
      file_url: finalBase64Image,
      headline_greeting: cardText.headline_greeting
    });
  } catch (error) {
    console.error("Backend runtime crash under OpenAI architecture:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
}
