export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { image, targetLanguage, sourceLanguage } = req.body || {};

    const finalTargetLanguage = targetLanguage || sourceLanguage || "Ukrainian";

    if (!image) {
      return res.status(400).json({ error: "No image provided" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing API key" });
    }

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
            role: "system",
            content: `You are a strict OCR and photo translator.

Your task:
1. Read ALL visible text from the image.
2. Translate the ENTIRE readable text into ${finalTargetLanguage}.

Important rules:
- Output translation MUST be in ${finalTargetLanguage}.
- Do NOT translate into English unless ${finalTargetLanguage} is English.
- Do NOT leave English unchanged.
- Do NOT leave Chinese, Japanese, Turkish, Polish, Ukrainian, Russian or any other language unchanged unless it is already ${finalTargetLanguage}.
- Translate normal words even if they are near numbers, letters, slashes, brackets, dashes, page numbers or exercise labels.
- Keep only pure numbers, punctuation, emails, phone numbers, addresses, names, brands and special codes unchanged.
- Preserve order and line breaks as much as possible.
- Do not explain anything.

Return ONLY valid JSON:
{
  "detectedText": "original text from the image",
  "translation": "full translation into ${finalTargetLanguage}"
}`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Translate this photo fully into ${finalTargetLanguage}.`
              },
              {
                type: "image_url",
                image_url: { url: image }
              }
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
      return res.status(500).json({ error: "Empty photo translation response" });
    }

    let parsed;

    try {
      parsed = JSON.parse(content);
    } catch {
      return res.status(500).json({ error: "Invalid JSON from photo translator" });
    }

    return res.status(200).json({
      detectedText: parsed.detectedText || "",
      translation: parsed.translation || ""
    });

  } catch (error) {
    return res.status(500).json({ error: "Photo backend error" });
  }
}
