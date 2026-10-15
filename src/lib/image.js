// Achica y comprime una foto del celular ANTES de subirla, para que la página sea liviana.
// Devuelve un data URL (webp, o jpeg si el navegador no soporta webp).
async function decode(file) {
  if (window.createImageBitmap) {
    try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch { /* sigue abajo */ }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo leer la imagen")); };
    img.src = url;
  });
}

const toBlob = (canvas, type, q) => new Promise((res) => canvas.toBlob(res, type, q));
const readAsDataURL = (blob) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error("No se pudo procesar la imagen"));
    r.readAsDataURL(blob);
  });

export async function compressImage(file, { maxSide = 1000, maxBytes = 140000 } = {}) {
  if (!file || !String(file.type).startsWith("image/")) throw new Error("El archivo no es una imagen");
  if (file.size > 25 * 1024 * 1024) throw new Error("La imagen es demasiado grande (máx. 25 MB)");
  const src = await decode(file);
  const w0 = src.width || src.naturalWidth;
  const h0 = src.height || src.naturalHeight;
  let scale = Math.min(1, maxSide / Math.max(w0, h0));

  for (let attempt = 0; attempt < 4; attempt++) {
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; // las PNG transparentes no quedan negras al pasar a jpeg
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(src, 0, 0, w, h);
    for (const q of [0.82, 0.7, 0.58, 0.46]) {
      let blob = await toBlob(canvas, "image/webp", q);
      if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", q);
      if (blob && blob.size <= maxBytes) return readAsDataURL(blob);
    }
    scale *= 0.8; // todavía pesa mucho: achicamos y reintentamos
  }
  throw new Error("No se pudo comprimir la imagen lo suficiente. Probá con otra.");
}
