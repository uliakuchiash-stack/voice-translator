export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { text, userLanguage = "Ukrainian", englishVariant = "English UK" } = req.body || {};

    if (!text?.trim()) return res.status(400).json({ error: "No text provided" });

    const prompt = `
You are a live conversation translator.

User language: ${userLanguage}
English variant: ${englishVariant}

Detect the language of the user's phrase.

Rules:
- If the phrase is English, translate it into ${userLanguage}.
- If the phrase is NOT English, translate it into ${englishVariant}.
- Return only the translation.
- Do not explain.
- Keep it natural and conversational.

Return ONLY JSON:
{
  "translation": "...",
  "speakLang": "en" or "user"
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
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: text.trim() }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || "Dialogue translation failed" });
    }

    const parsed = JSON.parse(data.choices[0].message.content);

    return res.status(200).json({
      translation: parsed.translation || "",
      speakLang: parsed.speakLang || "en"
    });

  } catch {
    return res.status(500).json({ error: "Dialogue backend error" });
  }
}
