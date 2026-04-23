export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      text,
      mode = "natural",
      sourceLanguage = "Ukrainian",
      targetVariant = "en-US"
    } = req.body || {};

    if (!text) {
      return res.status(400).json({ error: "No text provided" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing API key" });
    }

    const targetInstruction =
      targetVariant === "en-GB"
        ? "Translate into natural British English. Prefer British vocabulary, spelling, and phrasing."
        : "Translate into natural American English. Prefer American vocabulary, spelling, and phrasing.";

    const modeInstruction = {
      natural: "Use natural, fluent everyday speech.",
      street: "Use natural spoken English with slang where appropriate. Preserve profanity and emotional force. Do not censor.",
      written: "Use polished, natural written English. Clean, elegant, and grammatically strong, but not robotic.",
      formal: "Use formal, respectful, professional English."
    }[mode] || "Use natural, fluent everyday speech.";

    const systemPrompt = `
You are an expert multilingual-to-English translator and source-text normalizer.

The source language is: ${sourceLanguage}.
The target language is: ${targetVariant}.

You must do TWO things:
1. Rewrite the source text into clean, natural ${sourceLanguage} with proper punctuation, sentence boundaries, and capitalization.
2. Translate it into high-quality English.

Rules for the cleaned source text:
- Fix punctuation naturally.
- Fix capitalization naturally.
- Preserve meaning, tone, slang, profanity, and emotional force.
- Make it read like a real human wrote it.
- If the source language uses pronouns that should normally stay lowercase in the middle of a sentence, keep them lowercase unless they start a sentence.

Rules for English:
- ${targetInstruction}
- ${modeInstruction}
- Avoid literal translation.
- Preserve tone, emotion, humor, sarcasm, slang, and profanity naturally.
- Do not censor profanity unless absolutely necessary.
- Return natural, idiomatic English, not textbook English unless the selected mode requires it.

Return ONLY valid JSON in exactly this format:
{
  "polished_source": "...",
  "translation": "..."
}
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: text
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "OpenAI error"
      });
    }

    const content = data?.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return res.status(500).json({
        error: "Empty model response"
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return res.status(500).json({
        error: "Invalid JSON returned by model"
      });
    }

    return res.status(200).json({
      polished_source: parsed.polished_source || "",
      translation: parsed.translation || ""
    });

  } catch (error) {
    return res.status(500).json({
      error: "Server error"
    });
  }
}
