export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { image, targetLanguage, sourceLanguage } = req.body || {};
    const finalTargetLanguage = targetLanguage || sourceLanguage || "Ukrainian";

    if (!image) return res.status(400).json({ error: "No image provided" });
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "Missing API key" });

    async function ask(messages) {
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
          messages
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error?.message || "OpenAI error");
      }

      return JSON.parse(data.choices[0].message.content);
    }

    const ocr = await ask([
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Read ALL visible text from this image exactly as it appears.
Keep the order and line breaks.
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
    ]);

    const detectedText = (ocr.detectedText || "").trim();

    if (!detectedText) {
      return res.status(200).json({
        detectedText: "",
        translation: "No readable text found."
      });
    }

    const firstTranslation = await ask([
      {
        role: "system",
        content: `You are a strict mixed-language photo translator.

Target language: ${finalTargetLanguage}

Translate EVERYTHING into ${finalTargetLanguage}.

Rules:
- Translate ALL readable words.
- Mixed text must be fully translated.
- If the text contains Ukrainian/Russian + English, translate the English too.
- If the text contains Japanese/Chinese/Polish/Turkish + English, translate the English too.
- Do NOT leave English words like Dialogue Mode, Hi, how are you, I am fine, thank you, Delete history, Street Slang, page, exercise, unit unchanged.
- Keep only numbers, punctuation, names, brands, emails, addresses, phone numbers, and special codes unchanged.
- Preserve line order.
- Return ONLY JSON:
{
  "translation": "..."
}`
      },
      {
        role: "user",
        content: detectedText
      }
    ]);

    const draftTranslation = firstTranslation.translation || "";

    const finalCheck = await ask([
      {
        role: "system",
        content: `You are a translation quality checker.

Target language: ${finalTargetLanguage}

Check this translation. If there are ANY leftover English words or phrases, translate them into ${finalTargetLanguage}.

Especially translate:
Dialogue Mode, Hi, how are you, I am fine, thank you, Delete history, Street Slang, page, unit, exercise, task, question, answer, choose, complete.

Keep only:
numbers, punctuation, names, brands, emails, phone numbers, addresses, special codes.

Return ONLY JSON:
{
  "translation": "fully corrected translation in ${finalTargetLanguage}"
}`
      },
      {
        role: "user",
        content: draftTranslation
      }
    ]);

    return res.status(200).json({
      detectedText,
      translation: finalCheck.translation || draftTranslation
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message || "Photo backend error"
    });
  }
}
