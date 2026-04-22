export default async function handler(req, res) {
  const { text, target } = req.body;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": Bearer ${process.env.OPENAI_API_KEY},
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a professional translator. Translate naturally, fluently, and with correct grammar. Avoid literal translation."
        },
        {
          role: "user",
          content: Translate this text to ${target}: ${text}
        }
      ]
    })
  });

  const data = await response.json();

  res.status(200).json({
    translation: data.choices[0].message.content
  });
}
