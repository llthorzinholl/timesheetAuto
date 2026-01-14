
export interface TimesheetData {
  description: string;
  client: string;
  contactNumber: string;
  address: string;
  jobId: string;
  date: string;
  supervisorName: string;
  clientRepName: string;
  startTime: string;
  finishTime: string;
  travelTime: string;
  totalTime: string;
  notes: string;
  items: TimesheetItem[];
}

export interface TimesheetItem {
  id: string;
  description: string;
  quantity: string;
  unit?: string;
}

export enum AppState {
  IDLE = 'IDLE',
  SCANNING = 'SCANNING',
  EDITING = 'EDITING',
  SIGNING = 'SIGNING',
  COMPLETED = 'COMPLETED'
}
