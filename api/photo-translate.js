export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    return res.status(200).json({
      success: true,
      text: "Photo translation backend connected successfully. OCR upgrade will be added next step."
    });
  } catch (error) {
    return res.status(500).json({
      error: "Photo translate failed",
      details: error.message
    });
  }
}
