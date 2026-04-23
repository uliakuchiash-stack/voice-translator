export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      text,
      mode = "friendly",
      format = "chat"
    } = req.body || {};

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "No text provided" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing API key" });
    }

    const modeRules = {
      friendly: `
Style: Friendly Talk.
- Translate into natural, warm, everyday English.
- Preserve emotional intent, including irritation, frustration, teasing, affection, or sarcasm.
- If the source contains swearing or rude words, DO NOT translate them literally unless the tone clearly requires it.
- Instead, soften them into natural, conversational English while preserving the emotional force.
- Important: do not erase the attitude. Keep the subtext.
- Example: if someone says something rude in a casual way, the English should still sound annoyed / sarcastic / sharp, just not vulgar unless necessary.
- Sound like real human conversation between friends or acquaintances.
`,
      street: `
Style: Real Talk: Slang & Swearing.
- Translate into natural spoken English with slang where appropriate.
- Preserve profanity, swearing, emotional force, and attitude.
- Do not censor unless absolutely necessary.
- Sound like real speech, not textbook English.
`,
      formal: `
Style: Formal & Professional.
- Translate into polite, professional, respectful English.
- If the source includes swearing, insults, or rude language, soften and reframe it professionally.
- Never output raw profanity in this mode.
- Sound suitable for work, services, landlords, doctors, officials, or formal requests.
`
    };

    const formatRules = {
      chat: `
Output Format: Chat Version.
- Output natural chat-style English.
- Keep it concise, natural, and copy-paste ready for messages.
- No email greeting or sign-off unless clearly needed.
`,
      email: `
Output Format: Email Version.
- Output a properly structured email in English.
- Use this structure exactly:

Greeting line

Main message paragraph(s)

Closing line
(your name)

- Use a natural greeting such as:
  Hello [Name],
  Dear [Name],
  Hello,
  Dear Sir/Madam,
  depending on the context.
- If the source suggests a name or addressee, use it naturally.
- Never end with "bye".
- Use a proper closing such as:
  Best regards,
  Kind regards,
  Many thanks,
  depending on context.
- Always put "(your name)" on the final line.
- Keep the email realistic and ready to copy.
`
    };

    const systemPrompt = `
You are an expert multilingual communication assistant.

Your task:
1. Clean and normalize the user's source text.
2. Translate it into high-quality English.

You must return ONLY valid JSON in exactly this format:
{
  "polished_source": "...",
  "translation": "..."
}

Rules for polished_source:
- Preserve the original language.
- Fix punctuation, sentence boundaries, spacing, and capitalization naturally.
- Make it look like a human wrote it correctly.
- If speech recognition made the source look clumsy, repair it intelligently based on context.
- Do not invent new meaning.
- If the text is clearly spoken and lacks punctuation, add proper punctuation.
- Do not capitalize random words in the middle of a sentence.

Rules for translation:
${modeRules[mode] || modeRules.friendly}
${formatRules[format] || formatRules.chat}

Additional translation rules:
- Avoid literal translation when it sounds unnatural.
- Preserve meaning, intent, tone, and subtext.
- Important: emotional meaning matters more than word-for-word translation.
- If a rude word is used as emotional color rather than a literal insult, translate the feeling naturally, not mechanically.
- If the source is ambiguous, choose the most natural human interpretation from context.
- In formal mode, convert rude or messy speech into clean professional English.
- In email mode, format the translation with line breaks exactly like a real email.
- If a spoken addressee is awkwardly recognized, infer the most natural English greeting from context.
- Never output explanations or notes.
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
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: text.trim()
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
