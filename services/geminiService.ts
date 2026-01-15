import { GoogleGenAI, Type } from "@google/genai";
import { TimesheetData } from "../types";

// ✅ 1 request por vez (evita spam e 429)
let inFlight = false;

const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

function isRateLimitError(err: any) {
  const msg = String(err?.message || "");
  return err?.status === 429 || msg.includes("429") || msg.toLowerCase().includes("too many requests");
}

// ✅ Retry com backoff exponencial (para 429)
async function generateContentWithRetry(ai: GoogleGenAI, payload: any, maxRetries = 4) {
  let attempt = 0;

  while (true) {
    try {
      return await ai.models.generateContent(payload);
    } catch (err: any) {
      if (!isRateLimitError(err) || attempt >= maxRetries) {
        throw err;
      }

      // backoff exponencial + jitter
      const wait = Math.min(12000, 900 * Math.pow(2, attempt)) + Math.floor(Math.random() * 400);
      await sleep(wait);

      attempt++;
    }
  }
}

export const extractTimesheetData = async (base64Image: string): Promise<TimesheetData> => {
  if (inFlight) {
    throw new Error("Aguarde: já existe um processamento em andamento.");
  }

  inFlight = true;

  try {
    // ✅ Para Vite (front-end):
    const apiKey =
      (import.meta as any).env?.VITE_GEMINI_API_KEY ||
      (import.meta as any).env?.VITE_API_KEY ||
      "";

    if (!apiKey) {
      throw new Error("API Key não encontrada. Configure VITE_GEMINI_API_KEY no .env");
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Extract job and timesheet information from this "Absolute Environmental Services" print. 
    
Note: There is a numbering and location name at the top of the print. 
The numbering before the location/date is the "Job No".

CRITICAL INSTRUCTION FOR CONTACT NAME:
The "Contact Name" is usually written inside the "Notes" or "Variations" section of the print. 
Identify any person's name mentioned in the notes section and assign it to the "contactName" field.

Identify fields: 
- Client
- Contact Name (Search within the notes/variations text in the print)
- Contact Number (Telephone/Mobile)
- Job No (Look at the very top for a number before the location)
- Job Site Address
- Task Description

Also scan items used and quantities in the material grid.
Return valid JSON. 
Important: Return notes as empty string if not explicitly asked to keep, but definitely extract the person name from there for the contactName field.`;

    const mimeType = base64Image.includes("image/png") ? "image/png" : "image/jpeg";
    const pureBase64 = base64Image.includes(",") ? base64Image.split(",")[1] : base64Image;

    const payload = {
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { inlineData: { mimeType, data: pureBase64 } },
            { text: prompt }
          ]
        }
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
                  quantity: { type: Type.STRING }
                },
                required: ["description", "quantity"]
              }
            }
          },
          required: ["description", "client"]
        }
      }
    };

    const response = await generateContentWithRetry(ai, payload, 4);

    if (!response?.text) throw new Error("Failed to extract timesheet data");

    const parsed = JSON.parse(response.text);

    const today = new Date().toLocaleDateString("pt-BR");

    return {
      ...parsed,
      date: today,
      supervisorName: "GABRIEL HENRIQUE DA SILVA",
      clientRepName: parsed.client || "",
      startTime: "08:00",
      finishTime: "18:30",
      travelTime: "00:00",
      totalTime: "10:30",
      notes: ""
    };
  } finally {
    inFlight = false;
  }
};
