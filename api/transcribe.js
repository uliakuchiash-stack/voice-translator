export const config = {
  api: {
    bodyParser: false,
  },
};

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OpenAI API Key" });
    }

    const language = req.headers["x-source-language"] || "";
    const mimeType = req.headers["content-type"] || "audio/webm";

    const audioBuffer = await getRawBody(req);

    if (!audioBuffer || !audioBuffer.length) {
      return res.status(400).json({ error: "No audio received" });
    }

    const form = new FormData();

    const audioBlob = new Blob([audioBuffer], { type: mimeType });
    form.append("file", audioBlob, "speech.webm");
    form.append("model", "gpt-4o-mini-transcribe");
    form.append("response_format", "json");

    if (language) {
      form.append("language", language);
    }

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: form,
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Transcription failed",
      });
    }

    return res.status(200).json({
      text: data.text || "",
      raw: data,
    });
  } catch (error) {
    console.error("Transcription error:", error);
    return res.status(500).json({
      error: "Transcription failed",
    });
  }
}
