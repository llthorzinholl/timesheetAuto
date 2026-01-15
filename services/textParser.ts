import { TimesheetData } from '../types';

function firstMatch(regex: RegExp, text: string) {
  const m = text.match(regex);
  return m ? m[1].trim() : '';
}

function parsePhone(text: string) {
  // look for labels first
  const labelled = text.match(/(?:Phone|Tel|Telephone|Mobile|M:|T:|Cell)[:\s]*([+\d][\d\s\-().]{6,}\d)/i);
  if (labelled) return labelled[1].replace(/\s+/g, '');
  // fallback generic
  const generic = text.match(/([+]?\d{1,3}[\s\-().]*\d{2,4}[\s\-().]*\d{2,4}[\s\-().]*\d{2,4})/);
  return generic ? generic[1].replace(/\s+/g, '') : '';
}

function parseDate(text: string) {
  // common formats: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, DD Month YYYY
  const d1 = text.match(/(\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b)/);
  if (d1) return d1[1];
  const d2 = text.match(/(\b\d{4}-\d{1,2}-\d{1,2}\b)/);
  if (d2) return d2[1];
  const monthName = text.match(/(\b\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\b)/i);
  if (monthName) return monthName[1];
  return '';
}

function parseItemsFromLines(lines: string[]) {
  const items: Array<{ id: string; description: string; quantity: string }> = [];
  for (const l of lines) {
    // ignore lines that look like headers
    if (/^(client|contact|address|job|date|description|notes|supervisor|telephone|phone)[:\s]/i.test(l)) continue;

    // pattern: "10kg Material name"
    let m = l.match(/^(\d+[.,]?\d*)\s*(kg|kgs|KG|KGs)\b[\s\-:]*(.+)$/i);
    if (m) {
      items.push({ id: Math.random().toString(36).slice(2,9), description: (m[3] || '').trim(), quantity: `${m[1]} kg` });
      continue;
    }

    // pattern: "Material name 10 kg"
    m = l.match(/^(.+?)\s+[\-:]*\s*(\d+[.,]?\d*)\s*(kg|kgs)\b$/i);
    if (m) {
      items.push({ id: Math.random().toString(36).slice(2,9), description: m[1].trim(), quantity: `${m[2]} kg` });
      continue;
    }

    // pattern: "10 x Item" or "10x Item"
    m = l.match(/^(\d+)\s*[xX]\s*(.+)$/i);
    if (m) {
      items.push({ id: Math.random().toString(36).slice(2,9), description: m[2].trim(), quantity: m[1].trim() });
      continue;
    }

    // pattern: "Item - 5" or "Item: 5 qty"
    m = l.match(/^(.+?)[:\-]\s*(\d+[.,]?\d*)\s*(qty|QTY|pcs|each)?$/i);
    if (m) {
      items.push({ id: Math.random().toString(36).slice(2,9), description: m[1].trim(), quantity: m[2].trim() });
      continue;
    }

    // pattern: "Qty 5 ItemName" or "QTY: 5 Item"
    m = l.match(/\bQty[:\s]*(\d+)\b\s*(.+)?/i);
    if (m && m[1]) {
      items.push({ id: Math.random().toString(36).slice(2,9), description: (m[2] || '').trim() || 'Item', quantity: m[1].trim() });
      continue;
    }

    // simple fallback: lines ending with a number -> assume qty
    m = l.match(/^(.+?)\s+(\d+[.,]?\d*)$/);
    if (m) {
      items.push({ id: Math.random().toString(36).slice(2,9), description: m[1].trim(), quantity: m[2].trim() });
      continue;
    }
  }
  return items;
}

export function parseTimesheetFromText(text: string): TimesheetData {
  const normalized = text.replace(/\r/g, '\n');
  const lines = normalized.split(/\n+/).map(l => l.trim()).filter(Boolean);

  const client = firstMatch(/Client[:\-\s]+(.+)/i, text) || firstMatch(/Client\s+Name[:\-\s]+(.+)/i, text) || lines[0] || '';
  const jobId = firstMatch(/Job\s*No[:\-\s]*([A-Za-z0-9\-\/]+)/i, text) || firstMatch(/Job[:\-\s]*([A-Za-z0-9\-\/]+)/i, text) || '';
  const contactName = firstMatch(/Contact\s*Name[:\-\s]+(.+)/i, text) || firstMatch(/Contact[:\-\s]+(.+)/i, text) || '';
  const contactNumber = parsePhone(text) || '';
  const address = firstMatch(/Address[:\-\s]+(.+)/i, text) || lines.find(l => /\d+\s+\w+\s+(Road|Rd|St|Street|Ave|Avenue|Drive|Dr|Lane|Ln|Mitchell|Brookvale)/i) || '';
  const description = firstMatch(/Description[:\-\s]+(.+)/i, text) || lines.slice(1,3).join(' ') || '';

  const date = firstMatch(/Date[:\-\s]+(.+)/i, text) || parseDate(text) || new Date().toLocaleDateString('pt-BR');

  const notesIndex = lines.findIndex(l => /notes|variations/i.test(l));
  const notes = notesIndex >= 0 ? lines.slice(notesIndex + 1, notesIndex + 6).join(' ') : '';

  const items = parseItemsFromLines(lines);

  const result: TimesheetData = {
    description: description || (lines.slice(0,2).join(' ')).substring(0, 240),
    client: client || '',
    contactName: contactName || '',
    contactNumber: contactNumber || '',
    address: address || '',
    jobId: jobId || '',
    items,
    date,
    supervisorName: '',
    clientRepName: '',
    startTime: '',
    finishTime: '',
    travelTime: '',
    totalTime: '',
    notes: notes || text.substring(0, 300)
  };

  return result;
}
