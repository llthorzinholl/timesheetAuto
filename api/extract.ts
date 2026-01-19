import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing GEMINI_API_KEY on server" });

    const { base64Image } = req.body || {};
    if (!base64Image || typeof base64Image !== "string") {
      return res.status(400).json({ error: "base64Image is required" });
    }

    const mimeType = base64Image.includes("image/png") ? "image/png" : "image/jpeg";

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Extract job and timesheet information from this "Absolute Environmental Services" print.

Identify fields:
- Client
- Contact Name (Search within the notes/variations text in the print)
- Contact Number (Telephone/Mobile)
- Job No
- Job Site Address
- Task Description
Also scan items used and quantities in the material grid.
Return valid JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { inlineData: { mimeType, data: base64Image.split(",")[1] } },
            { text: prompt },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            client: { type: Type.STRING },
            contactName: { type: Type.STRING },
            contactNumber: { type: Type.STRING },
            address: { type: Type.STRING },
            jobId: { type: Type.STRING },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING },
                  quantity: { type: Type.STRING },
                },
                required: ["description", "quantity"],
              },
            },
          },
          required: ["description", "client"],
        },
      },
    });

    if (!response.text) return res.status(500).json({ error: "Empty model response" });

    const parsed = JSON.parse(response.text);
    return res.status(200).json(parsed);
  } catch (err: any) {
    console.error("API /extract error:", err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
