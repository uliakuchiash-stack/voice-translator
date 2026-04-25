export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { image, sourceLanguage = "Ukrainian" } = req.body || {};

    if (!image) return res.status(400).json({ error: "No image provided" });
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "Missing API key" });

    const prompt = `
You are a photo OCR translator.

Read ALL visible text from the image.

Translate ALL readable text into ${sourceLanguage}.

Important:
- Do not keep English text in English.
- Do not keep Ukrainian/Russian/Polish/etc. unchanged unless it is already ${sourceLanguage}.
- Translate the full photo text into ${sourceLanguage}.
- Keep names, brands, emails, phone numbers, addresses and codes unchanged.
- Return ONLY JSON.

JSON format:
{
  "detectedText": "original text from the image",
  "translation": "full translation into ${sourceLanguage}"
}
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
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
    if (!content) return res.status(500).json({ error: "Empty model response" });

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
