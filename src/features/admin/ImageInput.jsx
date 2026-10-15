import { useRef, useState } from "react";
import Img from "../../components/Img";
import { compressImage } from "../../lib/image";
import { dbSet, newKey } from "../../lib/db";
import { P } from "../../config/paths";

// Sube una foto: elegir del celular (galería o cámara) → se comprime → se guarda → devuelve "m:ID".
async function uploadFile(file, opts) {
  const dataUrl = await compressImage(file, opts);
  const id = newKey(P.media);
  await dbSet(`${P.media}/${id}`, dataUrl);
  return `m:${id}`;
}

const kb = (n) => `${Math.round(n / 1024)} KB`;

export function ImageInput({ label, value, onChange, maxSide = 1000, maxBytes = 140000, round = false, hint }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      onChange(await uploadFile(file, { maxSide, maxBytes }));
    } catch (ex) {
      setErr(ex.message || "No se pudo subir la imagen");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="field">
      <span>{label}</span>
      <div className="img-input">
        <div className={`img-prev${round ? " round" : ""}`}>
          {value ? <Img src={value} alt="" /> : <span className="muted small">Sin foto</span>}
        </div>
        <div className="btn-row">
          <button type="button" className="btn ghost sm" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? "Subiendo…" : value ? "Cambiar foto" : "Elegir foto"}
          </button>
          {value && !busy && <button type="button" className="btn ghost sm" onClick={() => onChange("")}>Quitar</button>}
        </div>
        <input ref={input} type="file" accept="image/*" hidden onChange={pick} />
      </div>
      {hint && <small className="muted">{hint}</small>}
      {err && <p className="form-error">{err}</p>}
    </div>
  );
}

export function ImageListInput({ label, values, onChange, max = 12, maxSide = 1000, maxBytes = 140000, hint }) {
  const input = useRef(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  async function pick(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    const room = max - values.length;
    if (room <= 0) { setErr(`Máximo ${max} fotos`); return; }
    setErr("");
    const added = [];
    try {
      for (let i = 0; i < Math.min(files.length, room); i++) {
        setBusy(`Subiendo ${i + 1} de ${Math.min(files.length, room)}…`);
        added.push(await uploadFile(files[i], { maxSide, maxBytes }));
      }
      if (files.length > room) setErr(`Se subieron ${room}: el máximo es ${max} fotos.`);
    } catch (ex) {
      setErr(ex.message || "No se pudo subir la imagen");
    } finally {
      setBusy("");
      if (added.length) onChange([...values, ...added]);
    }
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
        <button type="button" className="btn ghost sm" disabled={!!busy || values.length >= max} onClick={() => input.current?.click()}>
          {busy || "+ Agregar fotos"}
        </button>
      </div>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={pick} />
      {hint && <small className="muted">{hint}</small>}
      {err && <p className="form-error">{err}</p>}
    </div>
  );
}
