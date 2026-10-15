import { Component } from "react";

// Si algo se rompe en pantalla, mostramos un aviso en vez de la página en blanco.
export default class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e) { console.error(e); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="wrap" style={{ padding: "80px 16px", textAlign: "center" }}>
        <h2>Algo salió mal</h2>
        <p className="muted">Recargá la página. Si sigue pasando, avisanos.</p>
        <button className="btn" onClick={() => window.location.reload()}>Recargar</button>
      </div>
    );
  }
}
