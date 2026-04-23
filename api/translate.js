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
- Use very simple, clear vocabulary.
- Use short, easy sentences.
- Avoid idioms, advanced phrasal verbs, and difficult expressions.
- Make the result easy for a beginner to understand.
- Example style: "Hello. How are you?"
`,
      everyday: `
English Level: Everyday (B1–B2).
- Use normal daily English.
- Make it natural and easy to understand.
- Moderate vocabulary is okay, but keep it practical and conversational.
- Example style: "Hey, how are you doing?"
`,
      advanced: `
English Level: Advanced (C1–C2).
- Use polished, fluent, expressive English.
- More nuance and stronger phrasing are welcome.
- Sound confident and natural, but still clear.
- Example style: "Hi, how have you been?"
`,
      native: `
English Level: Native.
- Use fully natural, fluent, idiomatic English.
- Sound like a real native speaker would.
- It can be more relaxed, idiomatic, and instinctively phrased.
- Example style: "Hey, how's it going?"
`
    };

    const modeRules = {
      friendly: `
Style: Friendly Talk.
- Sound warm, natural, easygoing, and human.
- Preserve emotional tone.
- If rude words are used casually for emotional colour, soften them naturally but keep the attitude or subtext.
- Do not flatten the message into something bland.
- If the original says "hey man", "buddy", "mate", etc., preserve a friendly equivalent when natural.
`,
      street: `
Style: Real Talk: Slang & Swearing.
- Sound rawer, more casual, more street, and more alive.
- Use slang naturally where it fits.
- If the original has swearing, preserve the force and vibe.
- This mode should sound noticeably more casual and street-like than Friendly Talk.
- Examples may include natural forms like "yo", "bro", "man", "damn", etc., when appropriate.
`,
      formal: `
Style: Formal & Professional.
- Sound polite, respectful, professional, and composed.
- Remove slang, swearing, and rude phrasing.
- Never use "hey man", "bro", "yo", or any profanity in this mode.
- Prefer greetings like "Hello" instead of "Hey".
- This mode should sound clearly more formal than Friendly Talk.
`
    };

    const formatRules = {
      chat: `
Output Format: Chat Version.
- Output a natural message, not an email.
- No greeting line and no sign-off.
- Keep it message-ready and conversational.
`,
      email: `
Output Format: Email Version.
- Output a properly structured email.
- Do NOT include a subject line.
- Use this exact structure:

Greeting

Body paragraph(s)

Closing
Name line

- For greeting, prefer:
  "Hello,"
  or, if the addressee is clearly known, "Hello [Name],"
  or in more formal cases "Dear [Name],"
- Avoid "Hi there" unless the context is clearly casual.
- Use natural paragraphs and visible line breaks.
- Use a proper closing such as:
  "Best regards,"
  "Kind regards,"
  "Many thanks,"
- If the sender's name is clearly stated in the source, use it on the final line.
- If the sender's name is not clearly stated, use "(your name)" on the final line.
- The email must be ready to copy as-is.
`
    };

    const systemPrompt = `
You are an expert multilingual-to-English communication assistant.

Your tasks:
1. Clean and normalize the source text in its original language.
2. Translate it into English according to the chosen English variant, English level, style, and output format.

You must return ONLY valid JSON in this exact format:
{
  "polished_source": "...",
  "translation": "..."
}

Rules for polished_source:
- Keep it in the original source language.
- Fix punctuation, capitalization, sentence boundaries, spacing, and obvious speech-to-text mess.
- Make it read like a normal human wrote it.
- Preserve meaning, tone, and emotional intent.
- If speech recognition created awkward fragments, lightly repair them intelligently without changing meaning.
- Add punctuation naturally.
- Do not leave awkward random capital letters in the middle of sentences.

Rules for translation:
${targetInstruction}
${levelRules[level] || levelRules.elementary}
${modeRules[mode] || modeRules.friendly}
${formatRules[format] || formatRules.chat}

Very important:
- The chosen style must make a noticeable difference.
- The chosen level must make a noticeable difference.
- Do NOT produce nearly identical output across Friendly / Street / Formal.
- Do NOT produce nearly identical output across Elementary / Everyday / Advanced / Native.
- Prioritise natural meaning over literal wording.
- Preserve context, tone, intent, and subtext.
- If the original is ambiguous, choose the most natural human interpretation from context.
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
        temperature: 0.45,
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
