import { useEffect, useRef, useState } from "react";
import Img from "../../components/Img";

// Carrusel táctil (scroll horizontal con "snap") con botones circulares:
// al llegar a la última foto, "siguiente" vuelve a la primera (y al revés).
// Si no hay imágenes, no se muestra nada.
export default function Carousel({ images, title }) {
  const box = useRef(null);
  const [cur, setCur] = useState(0);
  const list = (images || []).filter(Boolean);
  const sig = list.join("|");

  // Al cambiar de profesional (otras fotos) arranca siempre en la primera.
  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTo({ left: 0, behavior: "auto" });
    setCur(0);
  }, [sig]);

  if (list.length === 0) return null;

  const index = () => {
    const el = box.current;
    return el && el.clientWidth ? Math.round(el.scrollLeft / el.clientWidth) : 0;
  };

  const go = (dir) => {
    const el = box.current;
    if (!el) return;
    const n = list.length;
    const target = (index() + dir + n) % n;
    el.scrollTo({ left: target * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="carousel">
      {title && <p className="carousel-title">{title}</p>}
      <div className="carousel-track" ref={box} onScroll={() => setCur(Math.min(index(), list.length - 1))}>
        {list.map((src, i) => (
          <Img key={i} src={src} alt={`Trabajo ${i + 1}`} loading="lazy" />
        ))}
      </div>
      {list.length > 1 && (
        <>
          <button type="button" className="car-btn prev" onClick={() => go(-1)} aria-label="Anterior">‹</button>
          <button type="button" className="car-btn next" onClick={() => go(1)} aria-label="Siguiente">›</button>
          <span className="car-count">{cur + 1} / {list.length}</span>
        </>
      )}
    </div>
  );
}
