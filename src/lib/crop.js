// Matemática pura del recorte de fotos (sin navegador), para poder probarla con node.
//
// Modelo: la foto (iw × ih px) se dibuja con escala s y esquina superior izquierda en (x, y)
// dentro de un marco de fw × fh px. La foto siempre tiene que CUBRIR el marco.

// Escala mínima para que la foto cubra el marco
export const coverScale = (iw, ih, fw, fh) => Math.max(fw / iw, fh / ih);

// Mantiene la foto cubriendo el marco (no deja bordes vacíos)
export function clampPos(x, y, iw, ih, s, fw, fh) {
  const minX = Math.min(0, fw - iw * s);
  const minY = Math.min(0, fh - ih * s);
  return { x: Math.min(0, Math.max(minX, x)), y: Math.min(0, Math.max(minY, y)) };
}

// Centra la foto en el marco
export const centerPos = (iw, ih, s, fw, fh) => ({ x: (fw - iw * s) / 2, y: (fh - ih * s) / 2 });

// Cambia el zoom dejando fijo el punto (cx, cy) del marco
export function zoomAt({ x, y, s }, ns, cx, cy, iw, ih, fw, fh, minS, maxS) {
  const s2 = Math.min(maxS, Math.max(minS, ns));
  const k = s2 / s;
  const p = clampPos(cx - (cx - x) * k, cy - (cy - y) * k, iw, ih, s2, fw, fh);
  return { s: s2, ...p };
}

// Zona de la foto original (en px de la foto) que se ve dentro del marco
export const cropRect = (x, y, s, fw, fh) => ({ sx: -x / s, sy: -y / s, sw: fw / s, sh: fh / s });

// Tamaño del marco para una proporción (ancho/alto) dentro de un espacio máximo
export function fitFrame(aspect, maxW, maxH) {
  let fw = maxW;
  let fh = fw / aspect;
  if (fh > maxH) { fh = maxH; fw = fh * aspect; }
  return { fw: Math.round(fw), fh: Math.round(fh) };
}

// Tamaño final de la foto recortada: el lado más largo no pasa de maxSide
export function outSize(sw, sh, maxSide) {
  const k = Math.min(1, maxSide / Math.max(sw, sh));
  return { ow: Math.max(1, Math.round(sw * k)), oh: Math.max(1, Math.round(sh * k)) };
}
