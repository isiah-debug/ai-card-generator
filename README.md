# AI Birthday Card Generator

A simple backend API that generates custom, theme-based birthday cards.
It automatically creates unique message text and an AI-generated background image, then packages them together into a beautiful card layout.

## How It Works

1. **Your Input:** The API takes a `user_prompt` (the theme of the card) and a `sender_name`.
2. **AI Text:** It uses SiliconFlow AI to write a unique headline and inside message matching your theme.
3. **AI Image:** It uses the FLUX model to generate a custom 1024x1024 background illustration.
4. **Final Card:** It combines the text and image into an SVG card design and encodes it as a Base64 string for easy display.

## Environment Setup

To run this project, you must add the following environment variable to your Vercel project settings:

* **Key:** `SILICON_FLOW_KEY`
* **Value:** Your active SiliconFlow API Key (`sk_...`)

### Endpoint URL
`POST /api/generate-card`

### Request Header
`Content-Type: application/json`

### Test Parameters (Paste into ReqBin Content tab)

#### Option A: Minecraft Skyblock Theme
```json
{
  "user_prompt": "Minecraft skyblock island adventure",
  "sender_name": "Sarah"
}
