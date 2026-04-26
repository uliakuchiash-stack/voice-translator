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
        ? "natural American English"
        : "natural British English";

    const resultRules = {
      message: `
Create a ready-to-send message.
No email subject.
No email signature.
Natural for chat, WhatsApp, Telegram or SMS.
`,
      email: `
Create a proper English email.
Do NOT include Subject.
Start directly with Dear / Hello.
Use clear paragraphs.
End politely with Best regards / Kind regards.
`,
      plain: `
Translate only.
No greetings.
No email formatting.
No extra explanation.
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
Suitable for work, clients, HR, landlord, official communication.
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
Polite mode:
- Remove or soften rude language.
- Avoid profanity.
- Keep the meaning but make it safe and respectful.
`,
      street: `
Street Slang mode:
- Preserve rude language, slang and emotional force when the source contains it.
- Do NOT make rude phrases polite.
- Do NOT over-soften insults.
- Translate natural profanity into real English profanity when appropriate.
- For Russian/Ukrainian "сука" depending on context, use natural options like "bitch", "damn", "fuck", "you bitch", "that bitch", or "asshole" when context fits.
- Do NOT translate "сука" as "cheeky bugger".
- Do NOT translate Polish "kurwa" as "bastard" unless context truly means bastard.
- Polish "kurwa" may mean "fuck", "shit", "damn", "for fuck's sake", or "bitch" depending on context.
- Keep it natural, not theatrical and not cartoonish.
`
    };

    const refineRules = {
      shorter: "Make it shorter and more concise.",
      professional: "Make it more professional and polished.",
      friendlier: "Make it warmer, friendlier and more human.",
      regenerate: "Create a better, more natural version."
    };

    const prompt = `
You are an expert AI translator and communication assistant.

Task:
Transform the user's text from ${sourceLanguage} into ${englishVariant}.

${resultRules[resultType] || resultRules.message}

${englishStyle ? styleRules[englishStyle] || "" : ""}
${audience ? audienceRules[audience] || "" : ""}
${slang ? slangRules[slang] || "" : ""}

Refine instruction:
${refine ? refineRules[refine] || refine : "No refine instruction."}

Important:
- Preserve the original meaning, emotion and intent.
- Translate naturally, not word-for-word.
- Do not invent facts.
- Do not add explanations.
- Return ONLY valid JSON.

JSON format:
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
        temperature: 0.45,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: text.trim() }
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
      return res.status(500).json({ error: "Empty model response" });
    }

    let parsed;

    try {
      parsed = JSON.parse(content);
    } catch {
      return res.status(500).json({ error: "Invalid JSON returned" });
    }

    return res.status(200).json({
      translation: parsed.translation || ""
    });

  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
}
