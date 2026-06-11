# AI Birthday Card Generator 


## How It Works

1. **Frontend Integration:** The API extracts exact form matching variables: `occasion`, `recipient`, `tone`, and `message`.
2. **Input Validation:** The backend strictly verifies that an `occasion` and a `recipient` are present. If missing, it safely blocks execution with a clear error structure.
3. **AI Text Phrase:** It uses SiliconFlow AI to formulate an ultra-short 2-4 word greeting title based on your chosen theme.
4. **Textless AI Image Layer:** It dispatches an aggressive anti-typography prompt matrix to the FLUX model, ensuring the generated image backdrop is completely free of messy, duplicated AI letters.
5. **Clean SVG Assembly:** It compiles a clean, transparent SVG layout that elevates your custom dynamic headline high up (`translate y=180`) and keeps the rest of the canvas open.

## Environment Setup

Ensure the following secret variable is active inside your Vercel Project Dashboard:

* **Key:** `SILICON_FLOW_KEY`
* **Value:** Your private account token string (`sk_...`)

### Endpoint Routing
`POST /api/generate-card`

### Request Headers
`Content-Type: application/json`

### Production Testing Parameters (Paste into ReqBin Content panel)

Use this updated JSON payload structure matching your new form layout schema:

```json
{
  "occasion": "Birthday",
  "recipient": "Isaiah",
  "tone": "excited, blocky skyblock gaming style",
  "message": "This user text block is retained safely inside the API data payload for the client-side templates!"
}
