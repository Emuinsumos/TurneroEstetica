import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Home from "./features/public/Home";
import Booking from "./features/booking/Booking";
import ErrorBoundary from "./ErrorBoundary";

// El panel de admin se carga aparte: los clientes no descargan ese código.
const AdminRoute = lazy(() => import("./features/admin/AdminRoute"));

function NotFound() {
  return (
    <div className="wrap" style={{ padding: "80px 16px", textAlign: "center" }}>
      <h2>Página no encontrada</h2>
      <p className="muted">El enlace no existe.</p>
      <Link className="btn" to="/">Ir al inicio</Link>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<p className="muted" style={{ padding: 40, textAlign: "center" }}>Cargando…</p>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/reservar" element={<Booking />} />
            <Route path="/admin" element={<AdminRoute />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
