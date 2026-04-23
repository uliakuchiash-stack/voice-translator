export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { text } = req.body || {};

    if (!text) {
      return res.status(400).json({ error: "No text provided" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing API key" });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Translate Ukrainian to natural English.
Keep slang, tone, emotions, profanity and meaning natural.
Do not explain anything.
Return only translation text.`
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.3
      })
    });

    const data = await response.json();

    const translation =
      data?.choices?.[0]?.message?.content?.trim();

    if (!translation) {
      return res.status(500).json({
        error: data?.error?.message || "Translation failed"
      });
    }

    return res.status(200).json({
      translation
    });

  } catch (error) {
    return res.status(500).json({
      error: "Server error"
    });
  }
}
