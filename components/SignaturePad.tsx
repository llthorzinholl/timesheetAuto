import React, { useEffect, useRef, useState } from "react";

type Props = {
  id: string; // ✅ precisa ser unico por instancia (ex: "client", "supervisor")
  label: string;
  onSave: (dataUrl: string) => void;
  onClear: () => void;
};

export const SignaturePad: React.FC<Props> = ({ id, label, onSave, onClear }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const [hasInk, setHasInk] = useState(false);

  const getCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) throw new Error("Canvas not ready");
    return canvas;
  };

  const getCtx = () => {
    const ctx = getCanvas().getContext("2d");
    if (!ctx) throw new Error("2D context not available");
    return ctx;
  };

  const resizeCanvasToContainer = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ratio = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();

    // tamanho visual
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    // tamanho real (hiDPI)
    canvas.width = Math.floor(rect.width * ratio);
    canvas.height = Math.floor(rect.height * ratio);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    // estilo da caneta
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827"; // slate-900
  };

  useEffect(() => {
    resizeCanvasToContainer();
    const onResize = () => resizeCanvasToContainer();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const pointFromEvent = (e: PointerEvent | React.PointerEvent) => {
    const canvas = getCanvas();
    const rect = canvas.getBoundingClientRect();
    const x = (e as any).clientX - rect.left;
    const y = (e as any).clientY - rect.top;
    return { x, y };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = getCanvas();
    canvas.setPointerCapture(e.pointerId);

    drawingRef.current = true;
    lastPointRef.current = pointFromEvent(e);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = getCtx();

    const p = pointFromEvent(e);
    const last = lastPointRef.current;
    if (!last) {
      lastPointRef.current = p;
      return;
    }

    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();

    lastPointRef.current = p;
    setHasInk(true);
  };

  const end = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = false;
    lastPointRef.current = null;
    try {
      const canvas = getCanvas();
      canvas.releasePointerCapture(e.pointerId);
    } catch {}
  };

  const clear = () => {
    const canvas = getCanvas();
    const ctx = getCtx();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onClear();
  };

  const save = () => {
    const canvas = getCanvas();

    // ✅ export com fundo branco (não transparente)
    const out = document.createElement("canvas");
    out.width = canvas.width;
    out.height = canvas.height;

    const octx = out.getContext("2d");
    if (!octx) return;

    octx.fillStyle = "#FFFFFF";
    octx.fillRect(0, 0, out.width, out.height);
    octx.drawImage(canvas, 0, 0);

    const dataUrl = out.toDataURL("image/png");
    onSave(dataUrl);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase text-slate-600">{label}</span>
        <span className="text-[10px] text-slate-400 font-bold">ID: {id}</span>
      </div>

      <div
        ref={containerRef}
        className="w-full h-full rounded-lg border border-slate-200 bg-slate-50 overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full touch-none"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerLeave={end}
        />
      </div>

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={clear}
          className="px-3 py-2 rounded-lg text-sm font-bold border border-slate-200 bg-white hover:bg-slate-50"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!hasInk}
          className={`px-3 py-2 rounded-lg text-sm font-bold text-white ${
            hasInk ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-300 cursor-not-allowed"
          }`}
        >
          Save
        </button>
      </div>
    </div>
  );
};
