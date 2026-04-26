export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      text,
      userLanguage = "Ukrainian",
      englishVariant = "English UK"
    } = req.body || {};

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "No text provided" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing API key" });
    }

    const cleanText = text.trim();

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
            role: "system",
            content: `
You are a two-way live conversation translator.

User language: ${userLanguage}
English variant: ${englishVariant}

Your job:
- If the phrase is English, translate it into ${userLanguage}.
- If the phrase is NOT English, translate it into ${englishVariant}.

Important:
- Do not answer the phrase as a chatbot.
- Do not continue the conversation.
- Only translate what was said.
- Keep the meaning natural and conversational.
- Do not invent names.
- If the phrase is unclear, translate the most likely meaning.
- Return ONLY valid JSON.

JSON format:
{
  "translation": "...",
  "speakLang": "en" or "user"
}

speakLang rules:
- If translation is English, use "en".
- If translation is ${userLanguage}, use "user".
`
          },
          {
            role: "user",
            content: cleanText
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Dialogue translation failed"
      });
    }

    const content = data?.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return res.status(500).json({ error: "Empty dialogue response" });
    }

    let parsed;

    try {
      parsed = JSON.parse(content);
    } catch {
      return res.status(500).json({ error: "Invalid JSON from dialogue translator" });
    }

    return res.status(200).json({
      translation: parsed.translation || "",
      speakLang: parsed.speakLang || "en"
    });

  } catch (error) {
    return res.status(500).json({ error: "Dialogue backend error" });
  }
}
