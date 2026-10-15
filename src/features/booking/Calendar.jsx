import { useState } from "react";
import { pad, weekday } from "../../lib/availability";

const HEAD = ["L", "M", "M", "J", "V", "S", "D"];

// getStatus(fecha) => "open" | "closed" | "disabled"
export default function Calendar({ today, maxDate, selected, onSelect, getStatus }) {
  const [ty, tm] = today.split("-").map(Number);
  const [my, mm] = maxDate.split("-").map(Number);
  const [view, setView] = useState({ y: ty, m: tm });

  const idx = view.y * 12 + view.m;
  const canPrev = idx > ty * 12 + tm;
  const canNext = idx < my * 12 + mm;
  const move = (n) =>
    setView((v) => {
      const t = v.y * 12 + (v.m - 1) + n;
      return { y: Math.floor(t / 12), m: (t % 12) + 1 };
    });

  const first = weekday(`${view.y}-${pad(view.m)}-01`); // 0 = domingo
  const offset = (first + 6) % 7; // semana empieza en lunes
  const total = new Date(Date.UTC(view.y, view.m, 0)).getUTCDate();
  const title = new Date(Date.UTC(view.y, view.m - 1, 1)).toLocaleDateString("es-AR", {
    month: "long", year: "numeric", timeZone: "UTC",
  });

  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(<span key={`b${i}`} />);
  for (let d = 1; d <= total; d++) {
    const date = `${view.y}-${pad(view.m)}-${pad(d)}`;
    const st = getStatus(date);
    const cls = ["day-btn", st, date === selected ? "sel" : "", date === today ? "today" : ""].join(" ");
    cells.push(
      <button
        key={date}
        type="button"
        className={cls}
        disabled={st !== "open"}
        onClick={() => onSelect(date)}
        aria-label={date}
      >
        {d}
      </button>
    );
  }

  return (
    <div className="cal">
      <div className="cal-head">
        <button type="button" className="icon-btn" onClick={() => move(-1)} disabled={!canPrev} aria-label="Mes anterior">‹</button>
        <b className="cal-title">{title}</b>
        <button type="button" className="icon-btn" onClick={() => move(1)} disabled={!canNext} aria-label="Mes siguiente">›</button>
      </div>
      <div className="cal-grid cal-dow">{HEAD.map((h, i) => <span key={i}>{h}</span>)}</div>
      <div className="cal-grid">{cells}</div>
      <p className="muted small cal-legend">Los días en gris están cerrados, completos o fuera del rango de reserva.</p>
    </div>
  );
}
