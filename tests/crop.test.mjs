import assert from "node:assert/strict";
import { coverScale, clampPos, centerPos, zoomAt, cropRect, fitFrame, outSize } from "../src/lib/crop.js";

const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} ≉ ${b}`);

// foto horizontal 4000×3000 en marco cuadrado 300×300 → escala por el lado corto
{
  const s = coverScale(4000, 3000, 300, 300);
  near(s, 0.1);
  const c = centerPos(4000, 3000, s, 300, 300);
  near(c.x, -50); near(c.y, 0);
  // recorte centrado = cuadrado del medio de la foto
  const r = cropRect(c.x, c.y, s, 300, 300);
  near(r.sx, 500); near(r.sy, 0); near(r.sw, 3000); near(r.sh, 3000);
}
// no se puede arrastrar más allá de los bordes
{
  const s = coverScale(4000, 3000, 300, 300);
  const p = clampPos(100, 100, 4000, 3000, s, 300, 300);
  assert.deepEqual(p, { x: 0, y: 0 });
  const q = clampPos(-9999, -9999, 4000, 3000, s, 300, 300);
  near(q.x, 300 - 400); near(q.y, 0);
}
// zoom: el punto bajo el dedo queda en su lugar y la foto sigue cubriendo
{
  const iw = 2000, ih = 2000, fw = 300, fh = 300;
  const s0 = coverScale(iw, ih, fw, fh);
  const st = { s: s0, ...centerPos(iw, ih, s0, fw, fh) };
  const before = { ix: (150 - st.x) / st.s, iy: (150 - st.y) / st.s };
  const z = zoomAt(st, s0 * 2, 150, 150, iw, ih, fw, fh, s0, s0 * 4);
  near((150 - z.x) / z.s, before.ix); near((150 - z.y) / z.s, before.iy);
  assert.ok(z.x <= 0 && z.y <= 0 && z.x + iw * z.s >= fw - 1e-6);
  // no baja del mínimo ni pasa del máximo
  near(zoomAt(st, 0.0001, 0, 0, iw, ih, fw, fh, s0, s0 * 4).s, s0);
  near(zoomAt(st, 999, 0, 0, iw, ih, fw, fh, s0, s0 * 4).s, s0 * 4);
}
// marco y tamaño de salida
assert.deepEqual(fitFrame(1, 400, 500), { fw: 400, fh: 400 });
assert.deepEqual(fitFrame(4 / 5, 400, 300), { fw: 240, fh: 300 });
assert.deepEqual(outSize(3000, 3000, 1000), { ow: 1000, oh: 1000 });
assert.deepEqual(outSize(300, 200, 1000), { ow: 300, oh: 200 });
console.log("crop ok");
