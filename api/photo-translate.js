export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      image,
      sourceLanguage = "Ukrainian",
      targetVariant = "en-GB",
      resultType = "plain",
      englishStyle = "",
      audience = "",
      slang = ""
    } = req.body || {};

    if (!image) {
      return res.status(400).json({ error: "No image provided" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing API key" });
    }

    const targetEnglish =
      targetVariant === "en-US" ? "English US" : "English UK";

    const prompt = `
You are an OCR and translation assistant.

Task:
1. Read all visible text from the image.
2. Detect the language of the text in the image.
3. Translate it using this direction logic:

- If the detected image text is English, translate it into ${sourceLanguage}.
- If the detected image text is NOT English, translate it into ${targetEnglish}.

User selected:
Main language: ${sourceLanguage}
English variant: ${targetEnglish}

Result type: ${resultType}
English level: ${englishStyle || "default"}
Audience: ${audience || "infer from context"}
Slang setting: ${slang || "default"}

Important:
- Preserve meaning and context.
- If the image contains no readable text, return detectedText as empty and translation as "No readable text found."
- Do not add explanations.
- Return ONLY valid JSON.

JSON format:
{
  "detectedLanguage": "...",
  "detectedText": "...",
  "translation": "..."
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
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
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
      return res.status(500).json({ error: "Empty model response" });
    }

    let parsed;

    try {
      parsed = JSON.parse(content);
    } catch {
      return res.status(500).json({ error: "Invalid JSON returned by model" });
    }

    return res.status(200).json({
      detectedLanguage: parsed.detectedLanguage || "",
      detectedText: parsed.detectedText || "",
      translation: parsed.translation || ""
    });

  } catch (error) {
    return res.status(500).json({ error: "Photo backend error" });
  }
}
