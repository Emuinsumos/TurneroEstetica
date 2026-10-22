import { useRef, useState } from "react";
import Img from "../../components/Img";
import { CropQueue } from "./ImageCropper";
import { dbSet, newKey } from "../../lib/db";
import { P } from "../../config/paths";

// Guarda una foto ya recortada y comprimida (data URL) → "m:ID"
async function saveDataUrl(dataUrl) {
  const id = newKey(P.media);
  await dbSet(`${P.media}/${id}`, dataUrl);
  return `m:${id}`;
}

// aspect: número (ancho/alto) o lista [{ label, value }] para que se pueda elegir
const toAspects = (a) => (Array.isArray(a) ? a : [{ label: "", value: a || 1 }]);

export function ImageInput({ label, value, onChange, maxSide = 1000, maxBytes = 140000, round = false, aspect = 1, hint }) {
  const input = useRef(null);
  const [files, setFiles] = useState(null);
  const [err, setErr] = useState("");

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr("");
    setFiles([file]); // se abre el recorte
  }

  return (
    <div className="field">
      <span>{label}</span>
      <div className="img-input">
        <div className={`img-prev${round ? " round" : ""}`}>
          {value ? <Img src={value} alt="" /> : <span className="muted small">Sin foto</span>}
        </div>
        <div className="btn-row">
          <button type="button" className="btn ghost sm" onClick={() => input.current?.click()}>
            {value ? "Cambiar foto" : "Elegir foto"}
          </button>
          {value && <button type="button" className="btn ghost sm" onClick={() => onChange("")}>Quitar</button>}
        </div>
        <input ref={input} type="file" accept="image/*" hidden onChange={pick} />
      </div>
      {hint && <small className="muted">{hint}</small>}
      {err && <p className="form-error">{err}</p>}
      {files && (
        <CropQueue
          files={files} aspects={toAspects(aspect)} round={round} maxSide={maxSide} maxBytes={maxBytes}
          save={saveDataUrl}
          onFinish={(ids) => { setFiles(null); if (ids.length) onChange(ids[ids.length - 1]); }}
        />
      )}
    </div>
  );
}

export function ImageListInput({ label, values, onChange, max = 12, maxSide = 1000, maxBytes = 140000, aspect = 1, hint }) {
  const input = useRef(null);
  const [files, setFiles] = useState(null);
  const [err, setErr] = useState("");

  async function pick(e) {
    const picked = Array.from(e.target.files || []);
    e.target.value = "";
    if (!picked.length) return;
    const room = max - values.length;
    if (room <= 0) { setErr(`Máximo ${max} fotos`); return; }
    setErr("");
    if (picked.length > room) setErr(`Se van a usar ${room}: el máximo es ${max} fotos.`);
    setFiles(picked.slice(0, room)); // se abre el recorte, de a una
  }

  const move = (i, d) => {
    const next = [...values];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="field">
      <span>{label} ({values.length}/{max})</span>
      <div className="img-grid">
        {values.map((v, i) => (
          <div className="img-cell" key={`${v}-${i}`}>
            <Img src={v} alt="" />
            <div className="img-actions">
              <button type="button" aria-label="Mover a la izquierda" disabled={i === 0} onClick={() => move(i, -1)}>‹</button>
              <button type="button" aria-label="Quitar foto" onClick={() => onChange(values.filter((_, k) => k !== i))}>✕</button>
              <button type="button" aria-label="Mover a la derecha" disabled={i === values.length - 1} onClick={() => move(i, 1)}>›</button>
            </div>
          </div>
        ))}
      </div>
      <div className="btn-row">
        <button type="button" className="btn ghost sm" disabled={values.length >= max} onClick={() => input.current?.click()}>
          + Agregar fotos
        </button>
      </div>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={pick} />
      {hint && <small className="muted">{hint}</small>}
      {err && <p className="form-error">{err}</p>}
      {files && (
        <CropQueue
          files={files} aspects={toAspects(aspect)} maxSide={maxSide} maxBytes={maxBytes}
          save={saveDataUrl}
          onFinish={(ids) => { setFiles(null); if (ids.length) onChange([...values, ...ids]); }}
        />
      )}
    </div>
  );
}
