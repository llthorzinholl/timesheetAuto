
import { GoogleGenAI, Type } from "@google/genai";
import { TimesheetData } from "../types";

export const extractTimesheetData = async (base64Image: string): Promise<TimesheetData> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
  
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

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          { inlineData: { mimeType, data: base64Image.split(',')[1] } },
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
  });

  if (!response.text) throw new Error("Failed to extract timesheet data");
  
  const parsed = JSON.parse(response.text);
  const today = new Date().toLocaleDateString('pt-BR');
  
  return {
    ...parsed,
    date: today,
    supervisorName: "GABRIEL HENRIQUE DA SILVA",
    clientRepName: parsed.client || "",
    startTime: "08:00",
    finishTime: "18:30",
    travelTime: "00:00",
    totalTime: "10:30",
    notes: "",
  };
};
