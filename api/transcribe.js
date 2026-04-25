export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "Missing OPENAI_API_KEY"
      });
    }

    const contentType = req.headers["content-type"] || "audio/webm";
    const sourceLanguage = req.headers["x-source-language"] || "auto";

    const chunks = [];

    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const audioBuffer = Buffer.concat(chunks);

    if (!audioBuffer || audioBuffer.length === 0) {
      return res.status(400).json({
        error: "No audio received"
      });
    }

    const formData = new FormData();

    const audioBlob = new Blob([audioBuffer], {
      type: contentType
    });

    formData.append(
      "file",
      audioBlob,
      contentType.includes("mp4") ? "audio.mp4" : "audio.webm"
    );

    formData.append("model", "whisper-1");

    if (sourceLanguage && sourceLanguage !== "auto") {
      const languageMap = {
        uk: "uk",
        ru: "ru",
        pl: "pl",
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
        bg: "bg",
        en: "en"
      };

      if (languageMap[sourceLanguage]) {
        formData.append("language", languageMap[sourceLanguage]);
      }
    }

    formData.append(
      "prompt",
      "Transcribe clearly and accurately. Keep natural punctuation. Preserve slang and real speech naturally."
    );

    formData.append("response_format", "json");
    formData.append("temperature", "0");

    const response = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: formData
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "Transcription failed"
      });
    }

    const text = (data?.text || "").trim();

    if (!text) {
      return res.status(200).json({
        text: "",
        warning: "No speech detected"
      });
    }

    return res.status(200).json({
      text
    });
  } catch (error) {
    return res.status(500).json({
      error: "Server transcription error"
    });
  }
}
