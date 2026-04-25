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

Read all visible text from the image.

Translation direction rules:
- If a text fragment is English, translate that fragment into ${sourceLanguage}.
- If a text fragment is NOT English, translate that fragment into ${targetEnglish}.
- If the image contains mixed languages, translate EACH line or block separately using the rules above.
- Do not decide direction based on the whole image only.
- Preserve the original order of the text blocks.
- Keep names, brands, addresses, emails, phone numbers and codes unchanged unless they are part of a normal sentence.
- If the image has no readable text, return detectedText as empty and translation as "No readable text found."

User selected:
Main language: ${sourceLanguage}
English variant: ${targetEnglish}

Style context:
Result type: ${resultType}
English level: ${englishStyle || "default"}
Audience: ${audience || "infer from context"}
Slang setting: ${slang || "default"}

Return ONLY valid JSON.

JSON format:
{
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
        temperature: 0.15,
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
