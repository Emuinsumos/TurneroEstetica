import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  useConfig, useServices, useProfessionals, useAvailability, toList,
} from "../../lib/data";
import Img from "../../components/Img";
import BrandIcon, { BRAND_BG } from "../../components/BrandIcon";
import { useImgUrl } from "../../lib/media";
import { dayRows, businessWeekly, money, initials } from "../../lib/hours";

const Icon = {
  clock: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
  ),
  pin: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
  ),
  wa: (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.2 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .6l-.4.6c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.3.1.8-.1 1.3z" /></svg>
  ),
};

function Reveal({ children, className = "" }) {
  return <div className={`reveal ${className}`}>{children}</div>;
}

export default function Home() {
  const cfg = useConfig();
  const sv = useServices();
  const pr = useProfessionals();
  const av = useAvailability();
  const c = cfg.data || {};
  const heroUrl = useImgUrl(c.heroImage);

  useEffect(() => {
    if (c.accentColor) document.documentElement.style.setProperty("--accent", c.accentColor);
    if (c.name) document.title = c.name;
  }, [c.accentColor, c.name]);

  const error = cfg.error || sv.error || pr.error || av.error;
  if (error)
    return <div className="wrap" style={{ paddingTop: 80 }}><p>No se pudo cargar: {error}</p></div>;
  if (cfg.loading || sv.loading || pr.loading || av.loading)
    return <div className="splash"><div className="spinner" /></div>;
  if (!cfg.data)
    return <div className="wrap" style={{ paddingTop: 80 }}><p>Negocio no configurado.</p></div>;

  const services = toList(sv.data).filter((s) => s.active !== false && !s.deleted).sort((a, b) => (a.order || 0) - (b.order || 0));
  const pros = toList(pr.data).filter((p) => p.active !== false && !p.deleted).sort((a, b) => (a.order || 0) - (b.order || 0));
  const wa = (c.whatsapp || "").replace(/\D/g, "");
  const activeAv = Object.fromEntries(
    pros.map((p) => [p.id, av.data?.[p.id]]).filter(([, v]) => v)
  );
  const hours = dayRows(businessWeekly(activeAv));
  const gallery = Array.isArray(c.gallery) ? c.gallery : Object.values(c.gallery || {});
  const socials = [
    wa && { label: "WhatsApp", icon: "whatsapp", href: `https://wa.me/${wa}` },
    c.instagram && { label: "Instagram", icon: "instagram", href: c.instagram },
    c.tiktok && { label: "TikTok", icon: "tiktok", href: c.tiktok },
    c.facebook && { label: "Facebook", icon: "facebook", href: c.facebook },
  ].filter(Boolean);
  const mapsHref = c.mapsUrl || (c.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}` : null);

  return (
    <div className="page">
      <nav className="nav">
        <div className="nav-in">
          <a className="brand" href="#inicio">
            {c.logo ? <Img src={c.logo} alt="" /> : <span className="brand-dot">{initials(c.name)}</span>}
            <span>{c.name}</span>
          </a>
          <div className="nav-right">
            <Link className="btn sm" to="/reservar">Reservar</Link>
            <Link className="icon-btn" to="/admin" aria-label="Administración" title="Administración">
              {Icon.lock}
            </Link>
          </div>
        </div>
      </nav>

      <header id="inicio" className="hero" style={heroUrl ? { "--hero": `url("${heroUrl}")` } : undefined}>
        <div className="hero-in">
          <p className="eyebrow">{c.category || "Turnos online"}</p>
          <h1>{c.name}</h1>
          <p className="lead">{c.description}</p>
          <div className="hero-actions">
            <Link className="btn lg" to="/reservar">Reservar turno</Link>
            <a className="btn ghost lg" href="#servicios">Ver servicios</a>
          </div>
          {socials.length > 0 && (
            <div className="hero-social">
              {socials.map((x) => (
                <a key={x.label} className="brand-ic" style={{ background: BRAND_BG[x.icon] }} href={x.href} target="_blank" rel="noreferrer" aria-label={x.label} title={x.label}>
                  <BrandIcon name={x.icon} size={24} />
                </a>
              ))}
            </div>
          )}
        </div>
      </header>

      <main>
        <section id="servicios" className="section">
          <div className="wrap">
            <Reveal><p className="kicker">Lo que hacemos</p><h2>Servicios</h2></Reveal>
            <div className="svc-list">
              {services.map((s) => (
                <Reveal key={s.id} className="svc">
                  <div className="svc-main">
                    <h3>{s.name}</h3>
                    {s.description && <p className="muted">{s.description}</p>}
                    <span className="chip">{Icon.clock} {s.duration} min</span>
                  </div>
                  <div className="price">{money(s.price)}</div>
                </Reveal>
              ))}
            </div>
            <div className="center"><Link className="btn" to="/reservar">Reservar turno</Link></div>
          </div>
        </section>

        {pros.length > 0 && (
          <section id="equipo" className="section alt">
            <div className="wrap">
              <Reveal><p className="kicker">Quiénes te atienden</p><h2>Equipo</h2></Reveal>
              <div className="team">
                {pros.map((p) => (
                  <Reveal key={p.id} className="member">
                    {p.photo ? <Img className="photo" src={p.photo} alt={p.name} /> : <div className="photo ph">{initials(p.name)}</div>}
                    <h3>{p.name}</h3>
                    {p.description && <p className="muted">{p.description}</p>}
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        )}

        {gallery.length > 0 && (
          <section id="galeria" className="section">
            <div className="wrap">
              <Reveal><p className="kicker">Nuestro trabajo</p><h2>Galería</h2></Reveal>
              <div className="gallery">
                {gallery.map((src, i) => <Img key={i} src={src} alt="" loading="lazy" />)}
              </div>
            </div>
          </section>
        )}

        <section id="horarios" className="section alt">
          <div className="wrap two">
            <Reveal>
              <p className="kicker">Cuándo venir</p>
              <h2>Horarios</h2>
              <table className="hours">
                <tbody>
                  {hours.map((h) => (
                    <tr key={h.key} className={h.open ? "" : "closed"}>
                      <td>{h.day}</td><td>{h.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Reveal>
            <Reveal>
              <p className="kicker">Dónde estamos</p>
              <h2>Contacto</h2>
              {c.address ? (
                <p className="addr">{Icon.pin}<span>{c.address}</span></p>
              ) : (
                <p className="muted">La dirección se carga desde el panel.</p>
              )}
              <div className="btn-col">
                {mapsHref && <a className="btn ghost" href={mapsHref} target="_blank" rel="noreferrer">Cómo llegar</a>}
                {wa && <a className="btn ghost" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">Escribinos por WhatsApp</a>}
              </div>
              {c.cancelPolicy && (
                <div className="note">
                  <b>Cancelaciones y puntualidad</b>
                  <p>{c.cancelPolicy}</p>
                </div>
              )}
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="wrap foot-in">
          <span>© {new Date().getFullYear()} {c.name}</span>
          {socials.length > 0 && (
            <span className="socials">
              {socials.map((s) => (
                <a key={s.label} className="social-ic" href={s.href} target="_blank" rel="noreferrer" aria-label={s.label} title={s.label}>
                  <BrandIcon name={s.icon} size={18} />
                </a>
              ))}
            </span>
          )}
        </div>
      </footer>

      {wa && (
        <a className="wa-fab" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" aria-label="WhatsApp">
          {Icon.wa}
        </a>
      )}
    </div>
  );
}
