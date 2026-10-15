import { useEffect, useState } from "react";
import { ref, get } from "firebase/database";
import { db } from "../config/firebase";
import { P } from "../config/paths";

// Las fotos subidas se guardan aparte (media/{id}) y en los datos solo queda "m:{id}".
// Así los datos de la página (servicios, equipo, config) siguen siendo livianos y cada
// foto se baja una sola vez (queda en memoria y en el almacenamiento del navegador).
export const isMedia = (v) => typeof v === "string" && v.startsWith("m:");

const mem = new Map();
const pending = new Map();

function fromStore(id) {
  try { return localStorage.getItem(`media:${id}`); } catch { return null; }
}
function toStore(id, v) {
  try { localStorage.setItem(`media:${id}`, v); } catch { /* sin espacio: no pasa nada */ }
}

export function loadMedia(id) {
  if (mem.has(id)) return Promise.resolve(mem.get(id));
  const cached = fromStore(id);
  if (cached) { mem.set(id, cached); return Promise.resolve(cached); }
  if (!pending.has(id)) {
    pending.set(
      id,
      get(ref(db, `${P.media}/${id}`))
        .then((s) => {
          const v = s.val();
          if (typeof v === "string") { mem.set(id, v); toStore(id, v); }
          return typeof v === "string" ? v : null;
        })
        .catch(() => null)
        .finally(() => pending.delete(id))
    );
  }
  return pending.get(id);
}

// Devuelve la URL real a mostrar (links normales pasan directo).
export function useImgUrl(value) {
  const id = isMedia(value) ? value.slice(2) : null;
  const [url, setUrl] = useState(() => (id ? mem.get(id) || null : value || null));
  useEffect(() => {
    if (!id) { setUrl(value || null); return undefined; }
    let alive = true;
    loadMedia(id).then((v) => alive && setUrl(v));
    return () => { alive = false; };
  }, [id, value]);
  return url;
}
