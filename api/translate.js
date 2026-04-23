export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      text,
      sourceLanguage = "Ukrainian",
      targetVariant = "en-GB",
      level = "elementary",
      mode = "friendly",
      format = "chat"
    } = req.body || {};

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "No text provided" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing API key" });
    }

    const targetInstruction =
      targetVariant === "en-US"
        ? `
Translate into natural American English.
Prefer American vocabulary, spelling, punctuation, and phrasing.
`
        : `
Translate into natural British English.
Prefer British vocabulary, spelling, punctuation, and phrasing.
`;

    const levelRules = {
      elementary: `
English Level: Elementary (A1–A2).
- Use very simple words and short sentences.
- Keep grammar easy and clear.
- Avoid idioms, slang, phrasal verbs, and difficult vocabulary unless absolutely necessary.
- Prioritise clarity over style.
- Output should feel beginner-friendly.
`,
      everyday: `
English Level: Everyday (B1–B2).
- Use natural daily English.
- Easy to understand, but more natural than beginner English.
- Moderate vocabulary is okay.
- Sound like a normal person in everyday life.
`,
      advanced: `
English Level: Advanced (C1–C2).
- Use fluent, expressive, polished English.
- More nuanced phrasing is welcome.
- Sound educated and natural, but not stiff.
`,
      native: `
English Level: Native.
- Sound fully fluent, idiomatic, and natural.
- Use the most human, natural phrasing a native speaker would actually use.
- Contractions, rhythm, and phrasing should feel genuinely native.
`
    };

    const modeRules = {
      friendly: `
Style: Friendly Talk.
- Translate into warm, natural, everyday English.
- Preserve emotion and context.
- If the source contains rude words used casually, soften them naturally but keep the attitude and subtext.
- Do not flatten the meaning.
- This style should sound clearly different from Formal & Professional and from Real Talk.
- Friendly does NOT mean formal.
`,
      street: `
Style: Real Talk: Slang & Swearing.
- Translate into natural spoken English with slang where appropriate.
- Preserve profanity, swearing, emotional force, and attitude.
- Do not censor unless absolutely necessary.
- This style must sound clearly more casual, raw, and street-like than Friendly Talk.
- If the source uses profanity, translate it into the closest natural English profanity for the context.
- Do not use weird or outdated insults if they sound unnatural.
`,
      formal: `
Style: Formal & Professional.
- Translate into polite, respectful, professional English.
- Never use raw profanity, slang, bro, man, yo, or rude wording.
- If the source contains swearing, insults, or rude speech, fully reframe it into clean professional English.
- This style must sound clearly more formal than the other modes.
- If format is email, make it sound like a proper email.
`
    };

    const formatRules = {
      chat: `
Output Format: Chat Version.
- Output natural chat-style English.
- No subject line.
- No email greeting or sign-off.
- Keep it concise and ready to paste into chat.
`,
      email: `
Output Format: Email Version.
- Output a properly structured email in English.
- Do NOT include a subject line.
- Use this exact structure:

Greeting

Body paragraph(s)

Closing
(your name)

- Use natural line breaks.
- Avoid "Hi there" unless the source is clearly very casual.
- For formal tone, prefer greetings such as "Hello," or "Dear [Name],".
- Never end with "bye".
- Use closings like "Best regards," or "Kind regards," depending on context.
- Always put "(your name)" on the final line.
- Make it ready to copy into email.
`
    };

    const sourceCleanupRules = `
Rules for polished_source:
- Keep the text in the original source language.
- Preserve the same language and script as the user originally spoke or typed.
- Fix punctuation, sentence boundaries, capitalization, and spacing.
- Make it clearly cleaner than raw speech-to-text.
- If the user speaks several thoughts, separate them properly.
- Do not leave awkward random capital letters in the middle of sentences.
- If the raw text is clumsy because of speech recognition, lightly repair it based on likely meaning.
- Preserve meaning and tone.
- Do not over-rewrite.
`;

    const translationCoreRules = `
Additional translation rules:
- Prioritise natural meaning over literal wording.
- Preserve context, tone, intent, and subtext.
- If the wording is ambiguous, choose the most natural human interpretation from context.
- The selected style must be clearly visible in the final output.
- The selected level must also be clearly visible in the final output.
- If outputs across styles or levels are too similar, push the differences more.
- Example contrast:
  Friendly: "Hey, how are you doing?"
  Street: "Yo, how you doin'?" / "Hey bro, what's up?"
  Formal: "Hello, how are you?" / "I hope you're doing well."
- Never output explanations or notes.
- Return JSON only.
`;

    const systemPrompt = `
You are an expert multilingual-to-English communication assistant.

Your task:
1. Clean and normalise the source text in its original language.
2. Translate it into English according to the selected English variant, level, style, and format.

Return ONLY valid JSON in this exact format:
{
  "polished_source": "...",
  "translation": "..."
}

Source language: ${sourceLanguage}
Target English variant: ${targetVariant}

${sourceCleanupRules}

Rules for translation:
${targetInstruction}
${levelRules[level] || levelRules.elementary}
${modeRules[mode] || modeRules.friendly}
${formatRules[format] || formatRules.chat}
${translationCoreRules}
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.6,
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
    } catch (error) {
      return res.status(500).json({ error: "Invalid JSON returned by model" });
    }

    return res.status(200).json({
      polished_source: parsed.polished_source || "",
      translation: parsed.translation || ""
    });
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
}
