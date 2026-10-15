import { useRef } from "react";
import Img from "../../components/Img";

// Carrusel táctil (scroll horizontal con "snap") con botones de avance/retroceso.
// Si no hay imágenes, no se muestra nada.
export default function Carousel({ images, title }) {
  const box = useRef(null);
  const list = (images || []).filter(Boolean);
  if (list.length === 0) return null;

  const go = (dir) => {
    const el = box.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  };

  return (
    <div className="carousel">
      {title && <p className="carousel-title">{title}</p>}
      <div className="carousel-track" ref={box}>
        {list.map((src, i) => (
          <Img key={i} src={src} alt={`Trabajo ${i + 1}`} loading="lazy" />
        ))}
      </div>
      {list.length > 1 && (
        <>
          <button type="button" className="car-btn prev" onClick={() => go(-1)} aria-label="Anterior">‹</button>
          <button type="button" className="car-btn next" onClick={() => go(1)} aria-label="Siguiente">›</button>
        </>
      )}
    </div>
  );
}
