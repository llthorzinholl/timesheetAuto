import { TimesheetData } from "../types";

export const extractTimesheetData = async (base64Image: string): Promise<TimesheetData> => {
  const res = await fetch("/api/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64Image }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `HTTP ${res.status}`);
  }

  const parsed = await res.json();

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
    notes: "",
  };
};
