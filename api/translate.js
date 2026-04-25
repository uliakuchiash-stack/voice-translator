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
      tone = "",
      slang = "",
      refine = ""
    } = req.body || {};

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "No text provided" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing API key" });
    }

    const variantRule =
      targetVariant === "en-US"
        ? "Use natural American English."
        : "Use natural British English.";

    const resultRules = {
      message: `
Result type: Message.
- Create a ready-to-send chat/message translation.
- No email subject.
- No email signature.
- Suitable for SMS, WhatsApp, Telegram, social messages, or chat.
`,
      email: `
Result type: Email.
- Convert the user's text into a properly structured English email.
- Do NOT include a subject line.
- Start directly with a greeting, such as "Dear [Name]," or "Hello,".
- Include clear body paragraphs.
- End with a polite closing such as "Kind regards," or "Best regards," and "(your name)".
- Do not add "Subject:".
`,
      plain: `
Result type: Plain Translate.
- Translate clearly and naturally.
- Do not format as a message or email.
- Do not add greetings, closings, emojis, or extra structure.
`
    };

    const styleRules = {
      elementary: `
English level: Elementary.
- Use very simple English.
- Short clear sentences.
- Avoid idioms and difficult words.
`,
      everyday: `
English level: Everyday.
- Use natural everyday English.
- Clear, relaxed and easy to understand.
`,
      professional: `
English level: Professional.
- Use polished, professional English.
- Suitable for work, clients, landlords, HR, and official communication.
`,
      native: `
English level: Native-like.
- Sound fluent, natural and idiomatic.
- Use native rhythm and phrasing where appropriate.
`
    };

    const toneRules = {
      casual: `
Tone: Casual.
- Relaxed, simple, conversational.
- Use casual phrasing only when appropriate.
`,
      warm: `
Tone: Warm.
- Friendly, kind, soft and polite.
- Good for friends, family and gentle messages.
`,
      professional: `
Tone: Professional.
- Respectful, clear, businesslike.
- Avoid slang and overly casual greetings.
- Prefer "Hello" or "Dear" in email.
`,
      direct: `
Tone: Direct.
- Clear, concise and straight to the point.
- No unnecessary softness.
`
    };

    const slangRules = {
      soften: `
Slang and swearing: Soften.
- If the source contains slang or swearing, soften it naturally.
- Keep the meaning and emotion, but avoid harsh profanity.
`,
      keep: `
Slang and swearing: Keep.
- Preserve slang and swearing when it matters.
- Translate profanity naturally, not literally.
- Do not invent weird insults.
`,
      strong: `
Slang and swearing: Strong.
- Keep strong emotional force.
- Use natural English slang or profanity if the source uses it.
- Do not translate Polish "kurwa" as "bastard" unless the context truly means bastard.
- Polish "kurwa" may mean "fuck", "shit", "damn", "for fuck's sake", or "bitch" depending on context.
`
    };

    const refineRules = {
      shorter: "Make the result shorter and more concise.",
      warmer: "Make the result warmer and friendlier.",
      professional: "Make the result more professional, polished and work-appropriate.",
      soften: "Soften rude, aggressive or too emotional wording.",
      regenerate: "Regenerate a better, more natural version."
    };

    const defaultRules = `
Default behaviour:
- If no English level is selected, use natural clear English.
- If no tone is selected, choose the tone that best fits the context.
- If no slang option is selected, do not force slang into the result.
- For professional or email contexts, avoid "Hi" unless the source clearly asks for a casual tone.
- Prefer "Hello" or "Dear" in professional emails.
`;

    const systemPrompt = `
You are an expert multilingual AI communication assistant.

Your task:
Transform the user's text from ${sourceLanguage} into high-quality English.

${variantRule}

${resultRules[resultType] || resultRules.message}

${englishStyle ? styleRules[englishStyle] || "" : ""}
${tone ? toneRules[tone] || "" : ""}
${slang ? slangRules[slang] || "" : ""}

${defaultRules}

Refine instruction:
${refine ? refineRules[refine] || refine : "No extra refine instruction."}

Important:
- Preserve the user's meaning, context, emotion and intent.
- Do not translate word-for-word if it sounds unnatural.
- Do not add explanations.
- Do not say you are an AI.
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
