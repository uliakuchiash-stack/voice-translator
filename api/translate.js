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

    const audienceRules = {
      friend: `
Audience: Friend.
- Make it friendly, natural and suitable for a friend.
- Casual wording is allowed.
- Do not add swearing unless the original clearly uses it and slang mode allows it.
`,
      family: `
Audience: Family.
- Make it warm, caring and natural.
- Suitable for relatives or close people.
- Keep it soft and human.
`,
      boss: `
Audience: Boss.
- Make it respectful, professional and clear.
- Avoid overly casual words like "hey" unless the user clearly asks for casual style.
- Prefer "Hello" or "Dear" in email.
`,
      client_official: `
Audience: Client / Official.
- Make it formal, polite and safe for clients, companies, landlords, HR, support, official requests and services.
- Avoid slang, jokes and overly casual wording.
`
    };

    const slangRules = {
      soften: `
Slang and bad words: No bad words.
- If the source contains slang, rude words, or swearing, soften it naturally.
- Keep the meaning and emotion, but avoid harsh profanity.
`,
      keep: `
Slang and bad words: Keep original.
- Preserve slang and swearing when it matters.
- Translate profanity naturally, not literally.
- Do not invent weird insults.
`,
      strong: `
Slang and bad words: Strong slang.
- Keep strong emotional force.
- Use natural English slang or profanity if the source uses it.
- Do not translate Polish "kurwa" as "bastard" unless the context truly means bastard.
- Polish "kurwa" may mean "fuck", "shit", "damn", "for fuck's sake", or "bitch" depending on context.
`
    };

    const refineRules = {
      shorter: "Make the result shorter and more concise.",
      professional: "Make the result more professional, polished and work-appropriate.",
      friendlier: "Make the result friendlier, warmer and more natural.",
      regenerate: "Regenerate a better, more natural version."
    };

    const defaultRules = `
Default behaviour:
- If no English level is selected, use natural clear English.
- If no audience is selected, infer the best audience from context.
- If no slang option is selected, do not force slang into the result.
- For professional, boss, client or official contexts, avoid "Hi" unless the source clearly asks for casual tone.
- Prefer "Hello" or "Dear" in professional emails.
- For friend/family contexts, relaxed wording is allowed.
`;

    const systemPrompt = `
You are an expert multilingual AI communication assistant.

Your task:
Transform the user's text from ${sourceLanguage} into high-quality English.

${variantRule}

${resultRules[resultType] || resultRules.message}

${englishStyle ? styleRules[englishStyle] || "" : ""}
${audience ? audienceRules[audience] || "" : ""}
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
