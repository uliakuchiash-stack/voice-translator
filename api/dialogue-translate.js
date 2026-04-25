export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { text, userLanguage = "Ukrainian", englishVariant = "English UK" } = req.body || {};
    if (!text?.trim()) return res.status(400).json({ error: "No text provided" });
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "Missing API key" });

    const cleanText = text.trim();

    const hasLatin = /[A-Za-z]/.test(cleanText);
    const hasCyrillic = /[А-Яа-яЁёІіЇїЄєҐґ]/.test(cleanText);

    const isEnglish = hasLatin && !hasCyrillic;

    const targetLanguage = isEnglish ? userLanguage : englishVariant;
    const speakLang = isEnglish ? "user" : "en";

    const prompt = `
You are a live two-way conversation translator.

Translate the user's phrase into ${targetLanguage}.

Important:
- If the phrase is already in ${targetLanguage}, still rewrite it naturally in ${targetLanguage}.
- Do not return the original text unchanged.
- Do not explain.
- Return ONLY JSON.

JSON:
{
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
          { role: "system", content: prompt },
          { role: "user", content: cleanText }
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
      speakLang
    });

  } catch {
    return res.status(500).json({ error: "Dialogue backend error" });
  }
}
