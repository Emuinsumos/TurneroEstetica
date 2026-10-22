import { useEffect, useRef, useState } from "react";
import { decode, compressSource, compressImage } from "../../lib/image";
import {
  coverScale, clampPos, centerPos, zoomAt, cropRect, fitFrame, outSize,
} from "../../lib/crop";

const MAX_ZOOM = 4; // veces el zoom mínimo

// Gira 90° una foto ya decodificada (devuelve un canvas)
function rotate90(src) {
  const w = src.width || src.naturalWidth;
  const h = src.height || src.naturalHeight;
  const c = document.createElement("canvas");
  c.width = h;
  c.height = w;
  const ctx = c.getContext("2d");
  ctx.translate(h, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(src, 0, 0);
  return c;
}

// aspects: [{ label, value }]  (value = ancho / alto)
function Cropper({ file, aspects, round, maxSide, maxBytes, step, onApply, onFull, onSkip, onCancel, busy, error }) {
  const [src, setSrc] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [ai, setAi] = useState(0);
  const aspect = aspects[ai].value;
  const [view, setView] = useState({ s: 1, x: 0, y: 0 });
  const [frame, setFrame] = useState({ fw: 300, fh: 300 });
  const canvasRef = useRef(null);
  const pts = useRef(new Map());
  const last = useRef(null);
  const dims = src ? { iw: src.width || src.naturalWidth, ih: src.height || src.naturalHeight } : { iw: 1, ih: 1 };
  const minS = coverScale(dims.iw, dims.ih, frame.fw, frame.fh);

  // decodificar la foto elegida
  useEffect(() => {
    let alive = true;
    setSrc(null);
    setLoadErr("");
    decode(file).then((d) => alive && setSrc(d)).catch(() => alive && setLoadErr("No se pudo leer la foto"));
    return () => { alive = false; };
  }, [file]);

  // tamaño del marco según proporción y pantalla
  useEffect(() => {
    const calc = () => setFrame(fitFrame(aspect, Math.min(window.innerWidth - 32, 440), Math.max(200, window.innerHeight * 0.5)));
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [aspect]);

  // al cambiar foto, giro, proporción o tamaño: centrar y cubrir
  useEffect(() => {
    if (!src) return;
    const s = coverScale(dims.iw, dims.ih, frame.fw, frame.fh);
    setView({ s, ...centerPos(dims.iw, dims.ih, s, frame.fw, frame.fh) });
  }, [src, frame.fw, frame.fh]); // eslint-disable-line react-hooks/exhaustive-deps

  // dibujar
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !src) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(frame.fw * dpr);
    cv.height = Math.round(frame.fh * dpr);
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, frame.fw, frame.fh);
    ctx.drawImage(src, view.x, view.y, dims.iw * view.s, dims.ih * view.s);
  }, [src, view, frame]); // eslint-disable-line react-hooks/exhaustive-deps

  const move = (dx, dy) =>
    setView((v) => ({ ...v, ...clampPos(v.x + dx, v.y + dy, dims.iw, dims.ih, v.s, frame.fw, frame.fh) }));
  const zoomTo = (ns, cx, cy) =>
    setView((v) => zoomAt(v, ns, cx, cy, dims.iw, dims.ih, frame.fw, frame.fh, minS, minS * MAX_ZOOM));

  const rel = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pts.current.set(e.pointerId, rel(e));
    last.current = null;
  };
  const onMove = (e) => {
    if (!pts.current.has(e.pointerId)) return;
    const p = rel(e);
    const prev = pts.current.get(e.pointerId);
    pts.current.set(e.pointerId, p);
    if (pts.current.size === 1) {
      move(p.x - prev.x, p.y - prev.y);
    } else if (pts.current.size === 2) {
      const [a, b] = [...pts.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (last.current) {
        setView((v) => {
          const z = zoomAt(v, v.s * (dist / last.current.dist), mid.x, mid.y, dims.iw, dims.ih, frame.fw, frame.fh, minS, minS * MAX_ZOOM);
          const pp = clampPos(z.x + (mid.x - last.current.mid.x), z.y + (mid.y - last.current.mid.y), dims.iw, dims.ih, z.s, frame.fw, frame.fh);
          return { s: z.s, ...pp };
        });
      }
      last.current = { dist, mid };
    }
  };
  const onUp = (e) => {
    pts.current.delete(e.pointerId);
    last.current = null;
  };
  const onWheel = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    zoomTo(view.s * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.clientX - r.left, e.clientY - r.top);
  };

  function reset() {
    setView({ s: minS, ...centerPos(dims.iw, dims.ih, minS, frame.fw, frame.fh) });
  }
  function turn() {
    setSrc((s) => rotate90(s));
  }

  function apply() {
    const { sx, sy, sw, sh } = cropRect(view.x, view.y, view.s, frame.fw, frame.fh);
    const source = src;
    onApply(() => render(source, sx, sy, sw, sh));
  }

  async function render(source, sx, sy, sw, sh) {
    const { ow, oh } = outSize(sw, sh, maxSide);
    const out = document.createElement("canvas");
    out.width = ow;
    out.height = oh;
    const ctx = out.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, ow, oh);
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, ow, oh);
    return compressSource(out, ow, oh, { maxSide: Math.max(ow, oh), maxBytes });
  }

  const zoomVal = minS ? view.s / minS : 1;

  return (
    <div className="crop-ov" role="dialog" aria-modal="true" aria-label="Acomodar foto">
      <div className="crop-box">
        <p className="kicker" style={{ margin: 0 }}>Acomodar foto{step ? ` · ${step}` : ""}</p>
        <p className="muted small" style={{ margin: "0 0 4px" }}>Arrastrá para mover y usá el control de abajo (o dos dedos) para el zoom.</p>

        {aspects.length > 1 && (
          <div className="crop-chips">
            {aspects.map((a, i) => (
              <button key={a.label} type="button" className={i === ai ? "on" : ""} onClick={() => setAi(i)}>{a.label}</button>
            ))}
          </div>
        )}

        <div
          className={`crop-frame${round ? " round" : ""}`}
          style={{ width: frame.fw, height: frame.fh }}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}
        >
          <canvas ref={canvasRef} style={{ width: frame.fw, height: frame.fh }} />
          {!src && !loadErr && <span className="crop-msg">Cargando…</span>}
          {loadErr && <span className="crop-msg">{loadErr}</span>}
          <span className="crop-grid" />
        </div>

        <div className="crop-zoom">
          <span aria-hidden="true">−</span>
          <input type="range" min="1" max={MAX_ZOOM} step="0.01" value={zoomVal} aria-label="Zoom"
            onChange={(e) => zoomTo(minS * Number(e.target.value), frame.fw / 2, frame.fh / 2)} disabled={!src} />
          <span aria-hidden="true">+</span>
        </div>

        <div className="crop-tools">
          <button type="button" className="btn ghost sm" onClick={turn} disabled={!src || busy}>⟳ Girar</button>
          <button type="button" className="btn ghost sm" onClick={reset} disabled={!src || busy}>Centrar</button>
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="crop-actions">
          <button type="button" className="btn" onClick={apply} disabled={!src || busy}>{busy ? "Guardando…" : "Usar esta"}</button>
          <button type="button" className="btn ghost" onClick={onFull} disabled={busy}>Foto completa</button>
          {onSkip && <button type="button" className="btn ghost" onClick={onSkip} disabled={busy}>Omitir</button>}
          <button type="button" className="btn ghost" onClick={onCancel} disabled={busy}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// Recorre las fotos elegidas de a una. Al terminar (o cancelar) llama onFinish(ids subidos).
export function CropQueue({ files, aspects, round, maxSide, maxBytes, save, onFinish }) {
  const [i, setI] = useState(0);
  const [done, setDone] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const finishIf = (list, next) => {
    if (next >= files.length) onFinish(list);
    else { setDone(list); setI(next); setError(""); }
  };

  async function use(makeDataUrl) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const id = await save(await makeDataUrl());
      setBusy(false);
      finishIf([...done, id], i + 1);
    } catch (e) {
      setBusy(false);
      setError(e.message || "No se pudo guardar la foto");
    }
  }

  const file = files[i];
  if (!file) return null;
  return (
    <Cropper
      key={i}
      file={file}
      aspects={aspects}
      round={round}
      maxSide={maxSide}
      maxBytes={maxBytes}
      step={files.length > 1 ? `${i + 1} de ${files.length}` : ""}
      busy={busy}
      error={error}
      onApply={(make) => use(make)}
      onFull={() => use(() => compressImage(file, { maxSide, maxBytes }))}
      onSkip={files.length > 1 ? () => finishIf(done, i + 1) : null}
      onCancel={() => onFinish(done)}
    />
  );
}
