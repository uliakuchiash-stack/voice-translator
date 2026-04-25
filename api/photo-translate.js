export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      image,
      sourceLanguage = "Ukrainian",
      targetVariant = "en-GB"
    } = req.body || {};

    if (!image) {
      return res.status(400).json({ error: "No image provided" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing API key" });
    }

    const targetEnglish = targetVariant === "en-US" ? "American English" : "British English";

    const prompt = `
You are a photo text translator.

Read the text in the image and TRANSLATE it.

Do NOT just copy the original text.

Rules:
- If a line is in English, translate it into ${sourceLanguage}.
- If a line is in ${sourceLanguage} or any non-English language, translate it into ${targetEnglish}.
- If the image has mixed English and non-English text, translate every line separately.
- Never return the same text unchanged unless it is a name, brand, email, phone number, address, or code.
- Keep the original order.
- If there is no readable text, return "No readable text found."

Return ONLY JSON:

{
  "detectedText": "original text from image",
  "translation": "translated text only"
}
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: image } }
            ]
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Photo translation failed"
      });
    }

    const content = data?.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return res.status(500).json({ error: "Empty model response" });
    }

    let parsed;

    try {
      parsed = JSON.parse(content);
    } catch {
      return res.status(500).json({ error: "Invalid JSON returned by model" });
    }

    return res.status(200).json({
      detectedText: parsed.detectedText || "",
      translation: parsed.translation || ""
    });

  } catch (error) {
    return res.status(500).json({ error: "Photo backend error" });
  }
}
