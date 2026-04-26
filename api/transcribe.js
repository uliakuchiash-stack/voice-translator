export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing API key" });
    }

    const chunks = [];

    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const audioBuffer = Buffer.concat(chunks);

    if (!audioBuffer || audioBuffer.length < 1000) {
      return res.status(400).json({ error: "No audio received" });
    }

    const sourceLanguage = req.headers["x-source-language"] || "uk";

    const languageMap = {
      uk: "uk",
      ru: "ru",
      pl: "pl",
      en: "en",
      fr: "fr",
      es: "es",
      de: "de",
      it: "it",
      ro: "ro",
      hu: "hu",
      pt: "pt",
      tr: "tr",
      ar: "ar",
      hi: "hi",
      zh: "zh",
      ja: "ja",
      ko: "ko",
      cs: "cs",
      bg: "bg"
    };

    const language = languageMap[sourceLanguage] || "uk";

    const file = new File([audioBuffer], "speech.webm", {
      type: req.headers["content-type"] || "audio/webm"
    });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("model", "whisper-1");
    formData.append("language", language);
    formData.append(
      "prompt",
      "This is a short spoken phrase for a translator app. Transcribe clearly and accurately. Common examples: Привіт, як справи? Як справи? Добрий день. Дякую. I am fine, thank you."
    );

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Transcription failed"
      });
    }

    return res.status(200).json({
      text: data.text || ""
    });
  } catch (error) {
    return res.status(500).json({
      error: "Transcription backend error"
    });
  }
}

export const config = {
  api: {
    bodyParser: false
  }
};
