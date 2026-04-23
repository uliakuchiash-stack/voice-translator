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
        ? "Translate into natural American English. Prefer American vocabulary, spelling, and phrasing."
        : "Translate into natural British English. Prefer British vocabulary, spelling, and phrasing.";

    const levelRules = {
      elementary: `
English Level: Elementary (A1–A2).
- Use very simple words and short sentences.
- Keep grammar easy and clear.
- Avoid idioms, phrasal verbs, and difficult vocabulary unless absolutely necessary.
`,
      everyday: `
English Level: Everyday (B1–B2).
- Use natural daily English.
- Make it easy to understand but more natural than beginner English.
- Moderate vocabulary is okay.
`,
      advanced: `
English Level: Advanced (C1–C2).
- Use strong, natural, expressive English.
- More nuanced phrasing is welcome.
- Sound fluent and educated, but still human.
`,
      native: `
English Level: Native.
- Sound fully fluent, natural, idiomatic, and native-like.
- Use the most natural phrasing a native speaker would use.
`
    };

    const modeRules = {
      friendly: `
Style: Friendly Talk.
- Translate into warm, natural, everyday English.
- Preserve emotion and context.
- If rude words are used casually for emotional color, soften them naturally but preserve the feeling.
- Do not flatten the meaning.
`,
      street: `
Style: Real Talk: Slang & Swearing.
- Preserve slang, swearing, profanity, emotional force, and raw real-life tone.
- Sound natural, not theatrical.
- Do not censor unless absolutely necessary.
`,
      formal: `
Style: Formal & Professional.
- Translate into polite, respectful, professional English.
- If the source contains swearing, insults, or rude speech, fully reframe it into clean professional language.
- Never use raw profanity in this mode.
`
    };

    const formatRules = {
      chat: `
Output Format: Chat Version.
- Output natural message-style English.
- Keep line structure simple.
- No email greeting or sign-off.
`,
      email: `
Output Format: Email Version.
- Output a properly structured email.
- Use this structure exactly:

Greeting

Body paragraph(s)

Closing
(your name)

- Use natural line breaks.
- Never use "bye".
- Use endings like "Best regards," / "Kind regards," / "Many thanks," depending on context.
- Make it ready to copy into email.
`
    };

    const systemPrompt = `
You are an expert multilingual-to-English communication assistant.

Your task:
1. Clean and normalize the source text in its original language.
2. Translate it into English according to the requested variant, level, style, and format.

Return ONLY valid JSON in this exact format:
{
  "polished_source": "...",
  "translation": "..."
}

Rules for polished_source:
- Keep it in the original source language.
- Fix punctuation, capitalization, sentence boundaries, and spacing.
- If speech recognition created messy text, repair it intelligently.
- Add punctuation naturally.
- Make it read like a normal human message in that language.
- Preserve meaning and tone.
- If the user says multiple thoughts, separate them properly.
- Do not leave awkward random capital letters in the middle of sentences.
- If context strongly suggests a more natural phrasing than the raw speech-to-text output, lightly normalize it without changing meaning.

Rules for translation:
${targetInstruction}
${levelRules[level] || levelRules.elementary}
${modeRules[mode] || modeRules.friendly}
${formatRules[format] || formatRules.chat}

Additional rules:
- Prioritize natural meaning over literal wording.
- Preserve context, tone, intent, and subtext.
- If the text is ambiguous, choose the most human and contextually natural interpretation.
- If a sentence in the original is messy because of voice input, infer the likely intended meaning carefully.
- Never output notes or explanations.
- Return JSON only.
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.35,
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
      polished_source: parsed.polished_source || "",
      translation: parsed.translation || ""
    });

  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
}
