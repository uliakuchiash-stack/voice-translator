export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { image, sourceLanguage = "Ukrainian" } = req.body || {};

    if (!image) return res.status(400).json({ error: "No image provided" });
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "Missing API key" });

    const ocrResponse = await fetch("https://api.openai.com/v1/chat/completions", {
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
              {
                type: "text",
                text: `Read ALL visible text from this image exactly as it appears.
Keep line breaks and order.
Return ONLY JSON:
{
  "detectedText": "..."
}`
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

    const ocrData = await ocrResponse.json();

    if (!ocrResponse.ok) {
      return res.status(ocrResponse.status).json({
        error: ocrData?.error?.message || "Photo OCR failed"
      });
    }

    let ocrParsed;

    try {
      ocrParsed = JSON.parse(ocrData?.choices?.[0]?.message?.content || "{}");
    } catch {
      return res.status(500).json({ error: "Invalid OCR response" });
    }

    const detectedText = (ocrParsed.detectedText || "").trim();

    if (!detectedText) {
      return res.status(200).json({
        detectedText: "",
        translation: "No readable text found."
      });
    }

    const translateResponse = await fetch("https://api.openai.com/v1/chat/completions", {
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
            content: `You are a strict photo text translator.

Translate the ENTIRE text fully into ${sourceLanguage}.

Very important rules:
- Translate every normal word into ${sourceLanguage}.
- Do NOT leave English, Chinese, Turkish, Polish, Russian or any other language unchanged.
- Translate words even if they are next to numbers, letters, slashes, brackets, dashes or exercise labels.
- Translate textbook/interface words such as page, unit, lesson, exercise, task, part, section, reading, writing, listening, speaking, grammar, vocabulary, complete, choose, match, answer, question, develop.
- Keep only pure numbers, exercise labels and punctuation unchanged, for example: 1, 2A, 3B, a), b), /, -, ?.
- If a line says "1 a long time / for / Have / you..." translate the words, but keep the numbering and symbols.
- Keep names, brands, emails, phone numbers, addresses and codes unchanged.
- Preserve the original order and line breaks as much as possible.
- Return translated text only, not explanations.

Return ONLY JSON:
{
  "translation": "..."
}`
          },
          {
            role: "user",
            content: detectedText
          }
        ]
      })
    });

    const translateData = await translateResponse.json();

    if (!translateResponse.ok) {
      return res.status(translateResponse.status).json({
        error: translateData?.error?.message || "Photo translation failed"
      });
    }

    let translatedParsed;

    try {
      translatedParsed = JSON.parse(translateData?.choices?.[0]?.message?.content || "{}");
    } catch {
      return res.status(500).json({ error: "Invalid translation response" });
    }

    return res.status(200).json({
      detectedText,
      translation: translatedParsed.translation || ""
    });

  } catch (error) {
    return res.status(500).json({ error: "Photo backend error" });
  }
}
