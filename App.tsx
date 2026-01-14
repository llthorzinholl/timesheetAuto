
import React, { useState, useRef, useEffect } from 'react';
import { extractTimesheetData } from './services/geminiService';
import { TimesheetData, AppState, TimesheetItem } from './types';
import { SignaturePad } from './components/SignaturePad';
import html2canvas from 'html2canvas';
import logoUrl from './assets/AES-Logo.png';

const SUPERVISOR_FIXED = "GABRIEL HENRIQUE DA SILVA";
const LOGO_URL = logoUrl;

interface SavedTimesheet {
  id: string;
  serial: number;
  data: TimesheetData;
  timestamp: number;
  mySignature: string | null;
  supervisorSignature: string | null;
}

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [data, setData] = useState<TimesheetData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mySignature, setMySignature] = useState<string | null>(null);
  const [supervisorSignature, setSupervisorSignature] = useState<string | null>(null);
  const [serialNumber, setSerialNumber] = useState<number>(21215);
  const [history, setHistory] = useState<SavedTimesheet[]>([]);
  const timesheetRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [slideIndex, setSlideIndex] = useState<number>(0);
  const [collapsed, setCollapsed] = useState({
    basicInfo: false,
    labour: false,
    resources: false,
    tipping: false,
    notes: false,
  });

  useEffect(() => {
    const savedSerial = localStorage.getItem('aes_timesheet_serial');
    if (savedSerial) setSerialNumber(parseInt(savedSerial, 10));

    const savedHistory = localStorage.getItem('aes_timesheet_history');
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    const onResize = () => setIsMobile(window.innerWidth < 640);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    // collapse sections by default on mobile for a cleaner view
    setCollapsed({
      basicInfo: isMobile,
      labour: isMobile,
      resources: isMobile,
      tipping: isMobile,
      notes: isMobile,
    });
  }, [isMobile]);

  const toggleSection = (key: keyof typeof collapsed) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const saveToHistory = () => {
    if (!data) return;
    const newEntry: SavedTimesheet = {
      id: Math.random().toString(36).substr(2, 9),
      serial: serialNumber,
      data,
      timestamp: Date.now(),
      mySignature,
      supervisorSignature
    };
    const updatedHistory = [newEntry, ...history];
    setHistory(updatedHistory);
    localStorage.setItem('aes_timesheet_history', JSON.stringify(updatedHistory));
  };

  const deleteFromHistory = (id: string) => {
    const updatedHistory = history.filter(item => item.id !== id);
    setHistory(updatedHistory);
    localStorage.setItem('aes_timesheet_history', JSON.stringify(updatedHistory));
  };

  const loadFromHistory = (entry: SavedTimesheet) => {
    setData(entry.data);
    setSerialNumber(entry.serial);
    setMySignature(entry.mySignature);
    setSupervisorSignature(entry.supervisorSignature);
    setAppState(AppState.EDITING);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setAppState(AppState.SCANNING);
    setError(null);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        try {
          const result = await extractTimesheetData(base64);
          setData({ ...result, supervisorName: SUPERVISOR_FIXED });
          setAppState(AppState.EDITING);
        } catch (err) {
          setError("Erro na captura do print. Verifique a imagem.");
          setAppState(AppState.IDLE);
        } finally {
          setLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setLoading(false);
      setError("Falha ao ler o arquivo.");
    }
  };

  const updateField = (field: keyof TimesheetData, value: any) => {
    if (!data) return;
    setData({ ...data, [field]: value });
  };

  const updateItemQty = (desc: string, qty: string) => {
    if (!data) return;
    const newItems = [...data.items];
    const index = newItems.findIndex(i => i.description === desc);
    if (index > -1) {
      newItems[index].quantity = qty;
    } else {
      newItems.push({ id: Math.random().toString(), description: desc, quantity: qty });
    }
    setData({ ...data, items: newItems });
  };

  const getItemQty = (desc: string) => {
    return data?.items.find(i => i.description === desc)?.quantity || "";
  };

  const exportAsJPG = async () => {
    if (!timesheetRef.current) return;
    setLoading(true);
    try {
      saveToHistory();
      const canvas = await html2canvas(timesheetRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      const link = document.createElement('a');
      link.download = `AES-Timesheet-${serialNumber}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();
      const nextSerial = serialNumber + 1;
      setSerialNumber(nextSerial);
      localStorage.setItem('aes_timesheet_serial', nextSerial.toString());
    } catch (err) {
      setError("Falha ao exportar imagem.");
    } finally {
      setLoading(false);
    }
  };

  const EditableField = ({ value, onChange, className = "", uppercase = false }: any) => (
    <input 
      type="text" 
      value={value || ""} 
      onChange={(e) => onChange(e.target.value)}
      className={`formal-text border-none focus:ring-0 focus:outline-none bg-transparent w-full ${uppercase ? 'uppercase' : ''} ${className}`}
    />
  );

  const toggleCheck = (id: string) => {
    const current = getItemQty(id);
    updateItemQty(id, current === 'X' ? '' : 'X');
  };

  return (
    <div className="timesheet-container pb-20 px-3 sm:px-4">
      <header className="w-full max-w-[820px] mb-8 flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-slate-200 no-print">
        <div className="flex items-center gap-3">
          <img src={LOGO_URL} alt="AES Logo" className="h-10 object-contain" crossOrigin="anonymous" />
          <h1 className="text-lg font-bold">AES Smart Form</h1>
        </div>
        <div className="flex gap-2">
          {appState === AppState.IDLE ? (
            <label className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold cursor-pointer hover:bg-blue-700 transition text-sm">
              <i className="fas fa-upload mr-2"></i> Novo Print
              <input type="file" accept="image/png, image/jpeg" onChange={handleFileUpload} className="hidden" />
            </label>
          ) : (
            <>
              <button onClick={() => { setAppState(AppState.IDLE); setData(null); setError(null); }} className="px-3 py-1 text-slate-600 font-bold text-sm">Sair</button>
              <button onClick={() => setAppState(AppState.SIGNING)} className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold text-sm">Assinar</button>
              <button onClick={exportAsJPG} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm">Salvar & Exportar</button>
            </>
          )}
        </div>
      </header>

      {error && <div className="w-full max-w-[820px] mb-4 p-4 bg-red-100 text-red-700 rounded-lg border border-red-200">{error}</div>}

      {loading && (
        <div className="fixed inset-0 z-[100] bg-white/80 flex items-center justify-center">
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="font-bold text-slate-700 uppercase text-[10px] tracking-widest">Processando Inteligência...</p>
          </div>
        </div>
      )}

      {appState === AppState.IDLE && history.length > 0 && (
        <div className="w-full max-w-[820px] bg-white rounded-xl shadow-lg p-6 mb-10 no-print">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><i className="fas fa-history text-blue-500"></i> Histórico de Timesheets</h2>
          <div className="grid grid-cols-1 gap-3">
            {history.map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition cursor-pointer">
                <div onClick={() => loadFromHistory(item)} className="flex-1">
                  <span className="font-bold text-blue-600">#{item.serial}</span> - {item.data.client} 
                  <span className="ml-4 text-xs text-slate-400">{new Date(item.timestamp).toLocaleDateString()}</span>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); deleteFromHistory(item.id); }}
                  className="text-red-400 hover:text-red-600 p-2"
                >
                  <i className="fas fa-trash-alt"></i>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {data && (
        <div className="flex flex-col gap-10">
          <div ref={timesheetRef} className="paper-preview border-b-[6px] border-[#001f5c]">
            <div className="flex justify-between items-start mb-2">
              <img src={LOGO_URL} alt="AES Logo" className="h-14 object-contain" crossOrigin="anonymous" />
              <div className="text-[7px] text-center sm:text-right text-slate-800 leading-tight">
                Address: 52, 49-51 Mitchell Road, Brookvale NSW 2100<br/>
                Phone: 1300 237 287<br/>
                Email: info@aesaus.com.au Website: www.aesaus.com.au
              </div>
            </div>

            <div className="text-center relative mb-2">
              <h3 className="text-lg font-black uppercase tracking-[0.2em] text-[#001f5c]">Project Time Sheet</h3>
              <span className="absolute right-0 top-0 text-red-600 font-mono text-2xl font-bold">{serialNumber}</span>
            </div>

            <div className="table-responsive">
            <div className="border border-black text-[8px] grid grid-cols-[130px_1fr_100px_1fr] mb-2">
              <div className="border-r border-b border-black label-fill p-1">Client:</div>
              <div className="border-r border-b border-black data-cell-white p-0"><EditableField value={data.client} onChange={(v:any) => updateField('client', v)} uppercase /></div>
              <div className="border-r border-b border-black label-fill p-1 flex justify-between items-center italic">Quoted <div onClick={() => toggleCheck('quoted')} className="w-3 h-3 border border-black bg-white flex items-center justify-center font-bold">{getItemQty('quoted')}</div></div>
              <div className="border-b border-black label-fill p-1 flex justify-between items-center italic">Rates <div onClick={() => toggleCheck('rates')} className="w-3 h-3 border border-black bg-white flex items-center justify-center font-bold">{getItemQty('rates')}</div></div>

              <div className="border-r border-b border-black label-fill p-1">Contact Name:</div>
              <div className="border-r border-b border-black data-cell-white p-0"><EditableField value={(data as any).contactName} onChange={(v:any) => updateField('contactName' as any, v)} uppercase /></div>
              <div className="border-r border-b border-black label-fill p-1">Date:</div>
              <div className="border-b border-black data-cell-white p-0"><EditableField value={data.date} onChange={(v:any) => updateField('date', v)} /></div>

              <div className="border-r border-b border-black label-fill p-1">Telephone/Mobile:</div>
              <div className="border-r border-b border-black data-cell-white p-0"><EditableField value={data.contactNumber} onChange={(v:any) => updateField('contactNumber', v)} /></div>
              <div className="border-r border-b border-black label-fill p-1">Job No:</div>
              <div className="border-b border-black data-cell-white p-0"><EditableField value={data.jobId} onChange={(v:any) => updateField('jobId', v)} uppercase className="font-bold" /></div>

              <div className="border-r border-b border-black label-fill p-1">Job Site Address:</div>
              <div className="border-r border-b border-black data-cell-white p-0"><EditableField value={data.address} onChange={(v:any) => updateField('address', v)} uppercase /></div>
              <div className="border-r border-b border-black label-fill p-1">Client P/O No:</div>
              <div className="border-b border-black data-cell-white p-0"><EditableField value={getItemQty('client_po')} onChange={(v:any) => updateItemQty('client_po', v)} /></div>

              <div className="border-r border-black label-fill p-1">Task Description:</div>
              <div className="col-span-3 data-cell-white p-0"><EditableField value={data.description} onChange={(v:any) => updateField('description', v)} uppercase /></div>
            </div>

            </div>
            {/* Time Table */}
            <div className="table-responsive">
            <div className="border border-black text-[8px] mb-2">
              <div className="grid grid-cols-[200px_80px_80px_100px_80px_1fr] table-header border-b border-black text-center font-bold">
                <div className="border-r border-black p-0.5 text-left italic">Supervisor:</div>
                <div className="border-r border-black p-0.5">Start Time</div>
                <div className="border-r border-black p-0.5">Finish Time</div>
                <div className="border-r border-black p-0.5">+ Travel Time</div>
                <div className="border-r border-black p-0.5">TOTAL</div>
                <div className="p-0.5">Allowances (Specify)</div>
              </div>
              <div className="grid grid-cols-[200px_80px_80px_100px_80px_1fr] border-b border-black h-6 items-center text-center">
                <div className="border-r border-black h-full data-cell-white p-0"><EditableField value={data.supervisorName} onChange={(v:any) => updateField('supervisorName', v)} uppercase className="font-bold" /></div>
                <div className="border-r border-black h-full data-cell-white p-0"><EditableField value={data.startTime} onChange={(v:any) => updateField('startTime', v)} className="text-center" /></div>
                <div className="border-r border-black h-full data-cell-white p-0"><EditableField value={data.finishTime} onChange={(v:any) => updateField('finishTime', v)} className="text-center" /></div>
                <div className="border-r border-black h-full data-cell-white p-0"><EditableField value={data.travelTime} onChange={(v:any) => updateField('travelTime', v)} className="text-center" /></div>
                <div className="border-r border-black h-full data-cell-white p-0"><EditableField value={data.totalTime} onChange={(v:any) => updateField('totalTime', v)} className="text-center font-bold" /></div>
                <div className="h-full data-cell-white p-0"><EditableField value={getItemQty('Supervisor Allowances')} onChange={(v:any) => updateItemQty('Supervisor Allowances', v)} className="text-center" /></div>
              </div>
              <div className="grid grid-cols-[200px_80px_80px_100px_80px_1fr] table-header border-b border-black text-center font-bold">
                <div className="border-r border-black p-0.5 text-left italic">Labour:</div>
                <div className="border-r border-black p-0.5">Start Time</div>
                <div className="border-r border-black p-0.5">Finish Time</div>
                <div className="border-r border-black p-0.5">+ Travel Time</div>
                <div className="border-r border-black p-0.5">TOTAL</div>
                <div className="p-0.5">Allowances (Specify)</div>
              </div>
              {[...Array(8)].map((_, i) => (
                <div key={i} className="grid grid-cols-[200px_80px_80px_100px_80px_1fr] border-b last:border-b-0 border-black h-5 items-center text-center">
                  <div className="border-r border-black h-full data-cell-white p-0"><EditableField value={getItemQty(`L_N_${i}`)} onChange={(v:any) => updateItemQty(`L_N_${i}`, v)} uppercase /></div>
                  <div className="border-r border-black h-full data-cell-white p-0"><EditableField value={getItemQty(`L_S_${i}`)} onChange={(v:any) => updateItemQty(`L_S_${i}`, v)} className="text-center" /></div>
                  <div className="border-r border-black h-full data-cell-white p-0"><EditableField value={getItemQty(`L_F_${i}`)} onChange={(v:any) => updateItemQty(`L_F_${i}`, v)} className="text-center" /></div>
                  <div className="border-r border-black h-full data-cell-white p-0"><EditableField value={getItemQty(`L_T_${i}`)} onChange={(v:any) => updateItemQty(`L_T_${i}`, v)} className="text-center" /></div>
                  <div className="border-r border-black h-full data-cell-white p-0"><EditableField value={getItemQty(`L_TOT_${i}`)} onChange={(v:any) => updateItemQty(`L_TOT_${i}`, v)} className="text-center font-bold" /></div>
                  <div className="h-full data-cell-white p-0"><EditableField value={getItemQty(`L_A_${i}`)} onChange={(v:any) => updateItemQty(`L_A_${i}`, v)} className="text-center" /></div>
                </div>
              ))}
            </div>

            </div>
            {/* Resources Grid */}
            <div className="table-responsive">
            <div className="border border-black text-[7px] grid grid-cols-4 mb-2">
              <div className="table-header border-r border-b border-black p-0.5 flex justify-between font-bold">Material <span className="mr-1">QTY</span></div>
              <div className="table-header border-r border-b border-black p-0.5 flex justify-between font-bold">Material <span className="mr-1">QTY</span></div>
              <div className="table-header border-r border-b border-black p-0.5 flex justify-between font-bold">Plant/Equipment <span className="mr-1">QTY</span></div>
              <div className="table-header border-b border-black p-0.5 flex justify-between font-bold">Environmental <span className="mr-1">QTY</span></div>
              
              <div className="flex flex-col border-r border-black divide-y divide-black bg-white">
                {['Black plastic', 'Clear plastic', 'Asbestos bags', 'Duct tape', 'D/sided tape', 'Hazard tape', 'Coveralls', 'Gloves', 'Boot covers', 'P2 respirators', 'Pre-filters', 'Pump box filters'].map(m => (
                  <div key={m} className="flex justify-between items-center h-[14px]">
                    <span className="pl-1 leading-none">{m}</span>
                    <span className="w-8 border-l border-black h-full data-cell-white"><EditableField value={getItemQty(m)} onChange={(v:any) => updateItemQty(m, v)} className="h-full text-center p-0 text-[7px]" /></span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col border-r border-black divide-y divide-black bg-white">
                {['Vacuum bags', 'Geo-fabric', 'HEPA filters', '', 'Plant/Equipment', 'Decontamination Unit', 'Decontamination Trailer', 'Portable wash station', 'Negative air unit', 'HEPA vacuum', 'Airless spray', 'Platform ladder'].map((m, idx) => (
                  <div key={idx} className={`flex justify-between items-center h-[14px] ${m === 'Plant/Equipment' ? 'table-header border-b border-black' : ''}`}>
                    <span className={`pl-1 leading-none ${m === 'Plant/Equipment' ? 'font-bold' : ''}`}>{m}</span>
                    {m && m !== 'Plant/Equipment' && <span className="w-8 border-l border-black h-full data-cell-white"><EditableField value={getItemQty(m)} onChange={(v:any) => updateItemQty(m, v)} className="h-full text-center p-0 text-[7px]" /></span>}
                    {m === 'Plant/Equipment' && <span className="text-[6px] pr-1 font-bold">QTY</span>}
                  </div>
                ))}
              </div>
              <div className="flex flex-col border-r border-black divide-y divide-black bg-white">
                {['Wet vacuum', 'Generator - 2 KVA', 'Generator - 7 KVA', '2t truck', '6t truck', 'HP washer', 'Floor stripper', 'Dehumidifier', 'Air mover', 'Air Purifier', 'Fencing', ''].map((m, idx) => (
                  <div key={idx} className="flex justify-between items-center h-[14px]">
                    <span className="pl-1 leading-none">{m}</span>
                    {m && <span className="w-8 border-l border-black h-full data-cell-white"><EditableField value={getItemQty(m)} onChange={(v:any) => updateItemQty(m, v)} className="h-full text-center p-0 text-[7px]" /></span>}
                  </div>
                ))}
              </div>
              <div className="flex flex-col divide-y divide-black bg-white">
                {['Air monitoring', 'Air clearance monitoring', 'Clearance Inspection', 'Asbestos sample analysis', 'Mould sample analysis', '', 'Other', '', '', '', '', ''].map((m, idx) => (
                  <div key={idx} className={`flex justify-between items-center h-[14px] ${m === 'Other' ? 'table-header border-b border-black' : ''}`}>
                    <span className={`pl-1 leading-none ${m === 'Other' ? 'font-bold' : ''}`}>{m}</span>
                    {m === 'Other' && <span className="text-[6px] pr-1 font-bold">QTY</span>}
                    {idx > 5 && m !== 'Other' && <span className="w-8 border-l border-black h-full data-cell-white"><EditableField value={getItemQty(`Env_Other_${idx}`)} onChange={(v:any) => updateItemQty(`Env_Other_${idx}`, v)} className="h-full text-center p-0 text-[7px]" /></span>}
                    {idx < 5 && m !== '' && <span className="w-8 border-l border-black h-full data-cell-white"><EditableField value={getItemQty(m)} onChange={(v:any) => updateItemQty(m, v)} className="h-full text-center p-0 text-[7px]" /></span>}
                  </div>
                ))}
              </div>
              </div>

            </div>
            {/* TIPPING SECTION */}
            <div className="table-responsive">
            <div className="border border-black text-[7px] mb-2">
                <div className="label-fill p-1 font-bold italic border-b border-black">Tipping</div>
                <div className="grid grid-cols-[80px_1fr] border-b border-black h-6">
                    <div className="label-fill p-1 flex items-center italic">Type of Waste</div>
                    <div className="flex items-center gap-4 px-2 data-cell-white">
                        {['Asbestos', 'Asbestos Soil', 'Lead', 'GSW', 'Brick/concrete', 'Other'].map(type => (
                            <div key={type} className="flex items-center gap-1 cursor-pointer" onClick={() => toggleCheck(`waste_type_${type}`)}>
                                <div className="w-3 h-3 border border-black bg-white flex items-center justify-center font-bold">{getItemQty(`waste_type_${type}`)}</div>
                                <span>{type}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-[80px_1fr] border-b border-black h-6">
                    <div className="label-fill p-1 flex items-center italic">Waste</div>
                    <div className="grid grid-cols-5 h-full divide-x divide-black">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="flex items-center justify-end pr-1 data-cell-white">
                                <EditableField value={getItemQty(`Waste_KG_${i}`)} onChange={(v:any) => updateItemQty(`Waste_KG_${i}`, v)} className="text-right w-12" />
                                <span className="ml-1 font-bold">KG</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-[80px_1fr] h-6">
                    <div className="label-fill p-1 flex items-center italic">Waste Facility</div>
                    <div className="flex items-center gap-6 px-2 data-cell-white">
                        {['SUEZ', 'Kimbriki', 'DADI', 'Other:'].map(fac => (
                            <div key={fac} className="flex items-center gap-1 cursor-pointer" onClick={() => toggleCheck(`waste_fac_${fac}`)}>
                                <div className="w-3 h-3 border border-black bg-white flex items-center justify-center font-bold">{getItemQty(`waste_fac_${fac}`)}</div>
                                <span>{fac}</span>
                                {fac === 'Other:' && <EditableField value={getItemQty('Waste_Fac_Other')} onChange={(v:any) => updateItemQty('Waste_Fac_Other', v)} className="w-20 border-b border-black!" />}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            </div>

            <div className="border border-black text-[9px] flex h-16 mb-2">
              <div className="label-fill border-r border-black w-[130px] p-1 font-bold flex items-center italic">Notes/Variations</div>
              <div className="flex-1 data-cell-white h-full p-0">
                <textarea 
                  value={data.notes} 
                  onChange={(e) => updateField('notes', e.target.value)}
                  className="w-full h-full p-1 border-none focus:ring-0 text-[8px] uppercase bg-transparent resize-none leading-tight"
                />
              </div>
            </div>

            <div className="border border-black grid grid-cols-[1fr_1fr] text-[9px]">
              <div className="grid grid-rows-2 h-16 divide-y divide-black border-r border-black">
                <div className="grid grid-cols-[120px_1fr] h-full">
                  <div className="label-fill p-1 font-bold border-r border-black flex items-center leading-tight italic">Supervisor's Name:</div>
                  <div className="data-cell-white p-0 flex items-center"><EditableField value={data.supervisorName} onChange={(v:any) => updateField('supervisorName', v)} uppercase className="font-bold" /></div>
                </div>
                <div className="grid grid-cols-[120px_1fr] h-full">
                  <div className="label-fill p-1 font-bold border-r border-black flex items-center leading-tight italic">Client Representative Name:</div>
                  <div className="data-cell-white p-0 flex items-center"><EditableField value={data.clientRepName} onChange={(v:any) => updateField('clientRepName', v)} uppercase className="font-bold" /></div>
                </div>
              </div>
              <div className="grid grid-rows-2 h-16 divide-y divide-black">
                <div className="grid grid-cols-[120px_1fr] h-full">
                  <div className="label-fill p-1 font-bold border-r border-black flex items-center leading-tight italic">Supervisor's Signature:</div>
                  <div className="p-0.5 flex items-center justify-center bg-white cursor-pointer" onClick={() => setAppState(AppState.SIGNING)}>
                    {supervisorSignature ? <img src={supervisorSignature} className="max-h-full" alt="s-sign" /> : <span className="text-[6px] text-slate-300 italic">Click to sign</span>}
                  </div>
                </div>
                <div className="grid grid-cols-[120px_1fr] h-full">
                  <div className="label-fill p-1 font-bold border-r border-black flex items-center leading-tight italic">Client Representative Signature:</div>
                  <div className="p-0.5 flex items-center justify-center bg-white cursor-pointer" onClick={() => setAppState(AppState.SIGNING)}>
                    {mySignature ? <img src={mySignature} className="max-h-full" alt="c-sign" /> : <span className="text-[6px] text-slate-300 italic">Click to sign</span>}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-between mt-1 text-[7px] text-slate-500 font-bold uppercase italic">
                <span>White - Customer Copy</span>
                <span>Blue - Office Copy</span>
            </div>
          </div>

          {/* Quick Edit Panel */}
          <div className="w-full max-w-[820px] bg-white rounded-xl shadow-lg border border-slate-200 p-4 sm:p-6 no-print flex flex-col gap-6 mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-2 gap-2">
                <h2 className="text-xl font-bold flex items-center gap-2">
                   <i className="fas fa-magic text-blue-600"></i> Smart Edit Panel (All Fields)
                </h2>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Editor Completo</span>
            </div>
            
            {/* 1. Basic Info (collapsible) */}
            <div className="border-t pt-4">
              <button type="button" className="w-full flex justify-between items-center" onClick={() => toggleSection('basicInfo')}>
                <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2 uppercase tracking-wide">
                  <i className="fas fa-info-circle text-blue-500"></i> Basic Info
                </h3>
                <span className="text-slate-400">{collapsed.basicInfo ? '▸' : '▾'}</span>
              </button>
              {!collapsed.basicInfo && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[9px] font-bold uppercase text-slate-500">Client</label>
                    <input type="text" value={data.client} onChange={e => updateField('client', e.target.value)} className="border p-2 rounded text-xs" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[9px] font-bold uppercase text-slate-500">Job No</label>
                    <input type="text" value={data.jobId} onChange={e => updateField('jobId', e.target.value)} className="border p-2 rounded text-xs font-bold" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[9px] font-bold uppercase text-slate-500">Date</label>
                    <input type="text" value={data.date} onChange={e => updateField('date', e.target.value)} className="border p-2 rounded text-xs" />
                  </div>
                </div>
              )}
            </div>

            {/* 2. Labour Section Edit (collapsible) */}
            <div className="border-t pt-4">
              <button type="button" className="w-full flex justify-between items-center" onClick={() => toggleSection('labour')}>
                <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2 uppercase tracking-wide">
                 <i className="fas fa-users text-blue-500"></i> Labour & Times
                </h3>
                <span className="text-slate-400">{collapsed.labour ? '▸' : '▾'}</span>
              </button>
              {!collapsed.labour && (
              <div className="table-responsive">
                <div className="grid grid-cols-1 gap-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end border-b pb-2 border-slate-50">
                    <div className="col-span-2">
                      <label className="text-[8px] text-slate-400 uppercase font-bold">Labourer Name {i+1}</label>
                      <input type="text" value={getItemQty(`L_N_${i}`)} onChange={e => updateItemQty(`L_N_${i}`, e.target.value)} className="w-full border p-1 rounded text-[10px]" />
                    </div>
                    <div>
                      <label className="text-[8px] text-slate-400 uppercase font-bold">Start</label>
                      <input type="text" value={getItemQty(`L_S_${i}`)} onChange={e => updateItemQty(`L_S_${i}`, e.target.value)} className="w-full border p-1 rounded text-[10px]" />
                    </div>
                    <div>
                      <label className="text-[8px] text-slate-400 uppercase font-bold">Finish</label>
                      <input type="text" value={getItemQty(`L_F_${i}`)} onChange={e => updateItemQty(`L_F_${i}`, e.target.value)} className="w-full border p-1 rounded text-[10px]" />
                    </div>
                    <div>
                      <label className="text-[8px] text-slate-400 uppercase font-bold">Travel</label>
                      <input type="text" value={getItemQty(`L_T_${i}`)} onChange={e => updateItemQty(`L_T_${i}`, e.target.value)} className="w-full border p-1 rounded text-[10px]" />
                    </div>
                    <div>
                      <label className="text-[8px] text-slate-400 uppercase font-bold">Total</label>
                      <input type="text" value={getItemQty(`L_TOT_${i}`)} onChange={e => updateItemQty(`L_TOT_${i}`, e.target.value)} className="w-full border p-1 rounded text-[10px] font-bold" />
                    </div>
                  </div>
                ))}
                </div>
              </div>
              )}
            </div>

            {/* 3. Materials, Plant & Environmental Edit (collapsible) */}
            <div className="border-t pt-4">
              <button type="button" className="w-full flex justify-between items-center" onClick={() => toggleSection('resources')}>
                <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2 uppercase tracking-wide">
                 <i className="fas fa-box-open text-orange-500"></i> Resources & Insumos
                </h3>
                <span className="text-slate-400">{collapsed.resources ? '▸' : '▾'}</span>
              </button>
              {!collapsed.resources && (
              <div className="table-responsive">
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <h4 className="text-[10px] font-bold text-blue-600 mb-2 border-b pb-1">MATERIAL</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                    {['Black plastic', 'Clear plastic', 'Asbestos bags', 'Duct tape', 'D/sided tape', 'Hazard tape', 'Coveralls', 'Gloves', 'Boot covers', 'P2 respirators', 'Pre-filters', 'Pump box filters', 'Vacuum bags', 'Geo-fabric', 'HEPA filters'].map(m => (
                      <div key={m} className="flex flex-col">
                        <label className="text-[8px] text-slate-400 uppercase font-bold truncate">{m}</label>
                        <input type="text" value={getItemQty(m)} onChange={e => updateItemQty(m, e.target.value)} className="border p-1 rounded text-[10px]" />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-bold text-orange-600 mb-2 border-b pb-1">PLANT & EQUIPMENT</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                    {['Decontamination Unit', 'Decontamination Trailer', 'Portable wash station', 'Negative air unit', 'HEPA vacuum', 'Airless spray', 'Platform ladder', 'Wet vacuum', 'Generator - 2 KVA', 'Generator - 7 KVA', '2t truck', '6t truck', 'HP washer', 'Floor stripper', 'Dehumidifier', 'Air mover', 'Air Purifier', 'Fencing'].map(m => (
                      <div key={m} className="flex flex-col">
                        <label className="text-[8px] text-slate-400 uppercase font-bold truncate">{m}</label>
                        <input type="text" value={getItemQty(m)} onChange={e => updateItemQty(m, e.target.value)} className="border p-1 rounded text-[10px]" />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-bold text-green-600 mb-2 border-b pb-1">ENVIRONMENTAL & OTHER</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                    {['Air monitoring', 'Air clearance monitoring', 'Clearance Inspection', 'Asbestos sample analysis', 'Mould sample analysis'].map(m => (
                      <div key={m} className="flex flex-col">
                        <label className="text-[8px] text-slate-400 uppercase font-bold truncate">{m}</label>
                        <input type="text" value={getItemQty(m)} onChange={e => updateItemQty(m, e.target.value)} className="border p-1 rounded text-[10px]" />
                      </div>
                    ))}
                    {[6, 7, 8, 9, 10, 11].map(idx => (
                     <div key={idx} className="flex flex-col">
                       <label className="text-[8px] text-slate-400 uppercase font-bold">Other Qty {idx-5}</label>
                       <input type="text" value={getItemQty(`Env_Other_${idx}`)} onChange={e => updateItemQty(`Env_Other_${idx}`, e.target.value)} className="border p-1 rounded text-[10px]" />
                     </div>
                    ))}
                  </div>
                </div>
              </div>
              </div>
              )}
            </div>

            {/* 4. Tipping Edit (Including 5 KG fields) - collapsible */}
            <div className="border-t pt-4">
              <button type="button" className="w-full flex justify-between items-center" onClick={() => toggleSection('tipping')}>
                <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2 uppercase tracking-wide">
                   <i className="fas fa-truck text-slate-500"></i> Tipping Details
                </h3>
                <span className="text-slate-400">{collapsed.tipping ? '▸' : '▾'}</span>
              </button>
              {!collapsed.tipping && (
              <>
              <div className="flex flex-wrap gap-4 mb-3 p-3 bg-slate-50 rounded">
                <span className="text-[10px] font-bold text-slate-500 w-full">Waste Types:</span>
                {['Asbestos', 'Asbestos Soil', 'Lead', 'GSW', 'Brick/concrete', 'Other'].map(type => (
                   <label key={type} className="flex items-center gap-2 cursor-pointer bg-white border px-2 py-1 rounded">
                     <input type="checkbox" checked={getItemQty(`waste_type_${type}`) === 'X'} onChange={() => toggleCheck(`waste_type_${type}`)} />
                     <span className="text-[10px] uppercase">{type}</span>
                   </label>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 mb-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="flex flex-col gap-0.5">
                     <label className="text-[9px] font-bold text-slate-500 uppercase">KG {i}</label>
                     <input type="text" value={getItemQty(`Waste_KG_${i}`)} onChange={e => updateItemQty(`Waste_KG_${i}`, e.target.value)} className="border p-2 rounded text-xs" placeholder="KG" />
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-4 mb-3 p-3 bg-slate-50 rounded">
                <span className="text-[10px] font-bold text-slate-500 w-full">Facilities:</span>
                {['SUEZ', 'Kimbriki', 'DADI', 'Other:'].map(fac => (
                   <label key={fac} className="flex items-center gap-2 cursor-pointer bg-white border px-2 py-1 rounded">
                     <input type="checkbox" checked={getItemQty(`waste_fac_${fac}`) === 'X'} onChange={() => toggleCheck(`waste_fac_${fac}`)} />
                     <span className="text-[10px] uppercase">{fac}</span>
                   </label>
                ))}
              </div>
              <div className="flex flex-col gap-0.5">
                 <label className="text-[9px] font-bold text-slate-500 uppercase">Other Facility Name</label>
                 <input type="text" value={getItemQty('Waste_Fac_Other')} onChange={e => updateItemQty('Waste_Fac_Other', e.target.value)} className="border p-2 rounded text-xs" />
              </div>
              </>
              )}
            </div>

            {/* 5. Notes & Signatures Info (collapsible) */}
            <div className="border-t pt-4">
              <button type="button" className="w-full flex justify-between items-center" onClick={() => toggleSection('notes')}>
                <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2 uppercase tracking-wide">
                   <i className="fas fa-pen-fancy text-slate-600"></i> Notes & Signatures
                </h3>
                <span className="text-slate-400">{collapsed.notes ? '▸' : '▾'}</span>
              </button>
              {!collapsed.notes && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="flex flex-col gap-1">
                 <label className="text-[9px] font-bold text-slate-500 uppercase">Notes / Variations</label>
                 <textarea value={data.notes} onChange={e => updateField('notes', e.target.value)} className="border p-2 rounded text-xs h-24" />
               </div>
               <div className="flex flex-col gap-3">
                 <div className="flex flex-col gap-0.5">
                    <label className="text-[9px] font-bold text-slate-500 uppercase">Client Representative Name</label>
                    <input type="text" value={data.clientRepName} onChange={e => updateField('clientRepName', e.target.value)} className="border p-2 rounded text-xs font-bold" />
                 </div>
                 <div className="flex flex-col gap-0.5">
                    <label className="text-[9px] font-bold text-slate-500 uppercase">Supervisor Name</label>
                    <input type="text" value={data.supervisorName} onChange={e => updateField('supervisorName', e.target.value)} className="border p-2 rounded text-xs" />
                 </div>
               </div>
              </div>
              )}
            </div>
          </div>
        </div>
      )}

      {appState === AppState.SIGNING && (
        <div className="fixed inset-0 z-[150] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-2xl shadow-2xl">
            <h2 className="text-lg font-black mb-4 border-b pb-2 text-slate-800 uppercase tracking-wide">Signatures</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SignaturePad label="Client Representative" onSave={setMySignature} onClear={() => setMySignature(null)} />
              <SignaturePad label="AES Supervisor" onSave={setSupervisorSignature} onClear={() => setSupervisorSignature(null)} />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setAppState(AppState.EDITING)} className="bg-slate-100 text-slate-700 px-6 py-2 rounded-lg font-bold text-sm">Back</button>
              <button onClick={() => setAppState(AppState.EDITING)} className="bg-blue-600 text-white px-8 py-2 rounded-lg font-bold text-sm">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
