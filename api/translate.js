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
      englishStyle = "simple",
      tone = "casual",
      slang = "soften",
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
Result type: Message.
- Output a natural ready-to-send message.
- No subject line.
- No email signature.
- Keep it suitable for chat, WhatsApp, SMS, or social messages.
`,
      email: `
Result type: Email.
- Convert the user's message into a properly structured English email.
- Do not invent a totally new request, but you may expand slightly to make it sound natural and professional.
- Include a short subject line only if it is useful.
- Use this structure:

Subject: ...

Greeting

Body

Closing
(your name)

- Use professional formatting and line breaks.
`,
      clean: `
Result type: Clean.
- Clean and improve the text without making it too emotional or too formal.
- Make it clear, correct, natural, and easy to understand.
`
    };

    const styleRules = {
      simple: `
English style: Simple.
- Use easy words and short sentences.
- Suitable for beginner or intermediate English.
`,
      natural: `
English style: Natural.
- Use normal everyday English.
- Sound human, clear, and not robotic.
`,
      polished: `
English style: Polished.
- Make the output smooth, confident, and well-written.
- Suitable for work, emails, and serious communication.
`,
      native: `
English style: Native-like.
- Sound fluent, idiomatic, and natural, like a native speaker.
- Use contractions and natural rhythm where appropriate.
`
    };

    const toneRules = {
      casual: `
Tone: Casual.
- Relaxed, simple, conversational.
`,
      warm: `
Tone: Warm.
- Friendly, kind, emotionally soft, polite.
`,
      professional: `
Tone: Professional.
- Respectful, businesslike, clear, and appropriate for work.
`,
      direct: `
Tone: Direct.
- Clear, concise, confident, and straight to the point.
`
    };

    const slangRules = {
      soften: `
Slang and swearing: Soften.
- If the original contains slang, rude words, or swearing, soften it.
- Keep the emotional meaning, but avoid harsh profanity.
`,
      keep: `
Slang and swearing: Keep.
- Preserve slang and swearing when it is important to the meaning.
- Translate profanity naturally, not literally.
- Avoid weird wrong insults.
`,
      strong: `
Slang and swearing: Strong.
- Keep the raw emotional force.
- Use natural English slang or profanity if the source uses it.
- Do not translate "kurwa" as "bastard" unless the context truly means bastard.
- Polish "kurwa" may mean "fuck", "shit", "damn", "for fuck's sake", or "bitch" depending on context.
`
    };

    const refineRules = {
      shorter: "Make the result shorter and more concise.",
      warmer: "Make the result warmer and friendlier.",
      professional: "Make the result more professional and polished.",
      soften: "Soften rude, aggressive, or too emotional wording.",
      regenerate: "Regenerate the result with a better, more natural version."
    };

    const systemPrompt = `
You are an expert multilingual AI communication assistant.

Your job:
Transform the user's text from ${sourceLanguage} into high-quality English.

Important:
- This is not only literal translation.
- Preserve meaning, context, emotion, and intent.
- Make the result useful for real communication.
- Return ONLY valid JSON.

JSON format:
{
  "translation": "..."
}

Target:
${englishVariant}

Rules:
${resultRules[resultType] || resultRules.message}
${styleRules[englishStyle] || styleRules.simple}
${toneRules[tone] || toneRules.casual}
${slangRules[slang] || slangRules.soften}

Refine instruction:
${refine ? refineRules[refine] || refine : "No extra refine instruction."}

Extra rules:
- Do not explain.
- Do not add notes.
- Do not say you are an AI.
- If the user asks to write an email, you may format it as an email.
- If the user provides a simple rough request, improve it into natural English.
- If result type is Email, make it ready to send.
- If result type is Message, make it ready to paste into chat.
- If result type is Clean, make it clean and clear.
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.55,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
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
      return res.status(500).json({ error: "Invalid JSON returned by model" });
    }

    return res.status(200).json({
      translation: parsed.translation || ""
    });
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
}
