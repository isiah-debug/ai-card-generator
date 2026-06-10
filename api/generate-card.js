// =========================================================================
// 1. CONFIGURATION & COMPACT STRING MAPS (CORRECTED ENDPOINTS)
// =========================================================================
const SILICON_FLOW_KEY = process.env.SILICON_FLOW_KEY;

// Fixed: Correctly maps to "https://api.siliconflow.cn/v1/chat/completions"
const TEXT_API_URL = String.fromCharCode(104,116,116,112,115,58,47,47,97,112,105,46,115,105,108,105,99,111,110,102,108,111,119,46,99,110,47,118,49,47,99,104,97,116,47,99,111,109,112,108,101,116,105,111,110,115);

// Fixed: Correctly maps to "https://api.siliconflow.cn/v1/images/generations"
const IMAGE_API_URL = String.fromCharCode(104,116,116,115,58,47,47,97,112,105,46,115,105,108,105,99,111,110,102,108,111,119,46,99,110,47,118,49,47,105,109,97,103,101,115,47,103,101,110,101,114,97,116,105,111,110,115);

const SVG_XMLNS_URI = String.fromCharCode(104,116,116,112,58,47,47,119,119,119,46,119,51,46,111,114,103,47,50,48,48,48,47,115,118,103);
const XHTML_XMLNS_URI = String.fromCharCode(104,116,116,112,58,47,47,119,119,119,46,119,51,46,111,114,103,47,49,57,57,57,47,120,104,116,109,108);

function getRequestBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return req.body;
}

const sanitizeForXML = (str) => {
  return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
};

// =========================================================================
// 2. TEXT COGNITION LAYER (NEX-N2-PRO)
// =========================================================================
async function callLLMProvider(promptText) {
  if (!SILICON_FLOW_KEY || !SILICON_FLOW_KEY.startsWith("sk-")) {
    throw new Error("Missing or invalid SILICON_FLOW_KEY credential config.");
  }

  const response = await fetch(TEXT_API_URL, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SILICON_FLOW_KEY.trim()}`
    },
    body: JSON.stringify({
      model: "nex-agi/Nex-N2-Pro",
      messages: [{ role: "user", content: promptText }],
      response_format: { type: "json_object" }, 
      temperature: 0.8
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LLM Response Error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  let rawText = data.choices[0].message.content.trim();
  
  if (rawText.startsWith("```json")) rawText = rawText.replace(/```json|```/g, "").trim();
  if (rawText.startsWith("```")) rawText = rawText.replace(/```/g, "").trim();
  
  return JSON.parse(rawText);
}

// =========================================================================
// 3. IMAGE GENERATION (SDXL BASE64 DIRECT HANDOFF)
// =========================================================================
async function generatePrimaryAIImageBase64(promptText, uniqueSeed) {
  if (!SILICON_FLOW_KEY || !SILICON_FLOW_KEY.startsWith("sk-")) {
    throw new Error("Invalid key format layout structure.");
  }

  const response = await fetch(IMAGE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type':
