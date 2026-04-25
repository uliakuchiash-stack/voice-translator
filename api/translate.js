export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      text,
      sourceLanguage = "Ukrainian",
      targetVariant = "en-GB",
      resultType = "message",
      englishStyle = "",
      audience = "",
      slang = "",
      refine = ""
    } = req.body || {};

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "No text provided" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing API key" });
    }

    const englishVariant =
      targetVariant === "en-US"
        ? "Use natural American English."
        : "Use natural British English.";

    const resultRules = {
      message: `
Create a ready-to-send message.
No email formatting.
No subject line.
Natural for chat, WhatsApp, Telegram, SMS.
`,
      email: `
Create a proper English email.
Do NOT include Subject.
Start directly with Dear / Hello.
End politely with Best regards / Kind regards.
`,
      plain: `
Translate only.
No greetings.
No email formatting.
No extra text.
`
    };

    const styleRules = {
      elementary: `
Use simple easy English.
Short sentences.
No difficult vocabulary.
`,
      everyday: `
Use natural everyday English.
Clear and relaxed.
`,
      professional: `
Use professional polished English.
Suitable for work and formal use.
`,
      native: `
Use fluent native-like English.
Natural phrasing and rhythm.
`
    };

    const audienceRules = {
      friend: `
Writing to a friend.
Friendly, relaxed, natural.
`,
      family: `
Writing to family.
Warm, soft, caring.
`,
      boss: `
Writing to a boss.
Respectful, clear, professional.
Avoid overly casual style.
`,
      client_official: `
Writing to client / official context.
Formal, polite, safe.
Suitable for landlord, embassy, HR, customer service, official requests.
`
    };

    const slangRules = {
      polite: `
Use polite safe language.
Avoid swearing.
Soften rude expressions naturally.
`,
      street: `
Use real street slang naturally.
Keep slang alive and authentic.
Do not sound robotic.
`
    };

    const refineRules = {
      shorter: "Make it shorter and more concise.",
      professional: "Make it more professional.",
      friendlier: "Make it warmer and friendlier.",
      regenerate: "Create a better improved version."
    };

    const prompt = `
You are an expert AI translator and communication assistant.

Task:
Transform the user's text from ${sourceLanguage} into excellent English.

${englishVariant}

${resultRules[resultType] || resultRules.message}

${englishStyle ? styleRules[englishStyle] || "" : ""}
${audience ? audienceRules[audience] || "" : ""}
${slang ? slangRules[slang] || "" : ""}

Refine instruction:
${refine ? refineRules[refine] || refine : "No refine instruction"}

Important:
- Keep original meaning and emotion
- Sound natural
- Do not explain
- Return ONLY JSON

Format:
{
  "translation": "..."
}
`;

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.5,
          response_format: {
            type: "json_object"
          },
          messages: [
            {
              role: "system",
              content: prompt
            },
            {
              role: "user",
              content: text.trim()
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "OpenAI error"
      });
    }

    const content =
      data?.choices?.[0]?.message?.content?.trim();

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
        error: "Invalid JSON returned"
      });
    }

    return res.status(200).json({
      translation: parsed.translation || ""
    });

  } catch (error) {
    return res.status(500).json({
      error: "Server error"
    });
  }
}
