import { useState } from "react";
import { money } from "../../lib/hours";
import { DEPOSIT_HOURS, EXPIRE_HOURS } from "../../lib/deposit";

// Datos de la cuenta para abonar la seña. Se muestran el alias (con botón de copiar),
// el titular y el banco para que la clienta verifique que transfiere a la cuenta correcta.
export default function DepositBox({ amount, alias, holder, bank }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(alias);
    } catch {
      const t = document.createElement("textarea");
      t.value = alias;
      document.body.appendChild(t);
      t.select();
      try { document.execCommand("copy"); } catch { /* sin permiso: queda el alias a la vista */ }
      t.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="deposit">
      <p className="kicker">Seña para asegurar tu turno</p>
      <p className="deposit-amount">{money(amount)}</p>
      <div className="deposit-alias">
        <div>
          <span className="muted small">Alias</span>
          <b>{alias}</b>
        </div>
        <button type="button" className="btn ghost sm" onClick={copy}>{copied ? "¡Copiado!" : "Copiar alias"}</button>
      </div>
      <dl className="deposit-account">
        {holder && <div><dt>Titular</dt><dd>{holder}</dd></div>}
        {bank && <div><dt>Banco / billetera</dt><dd>{bank}</dd></div>}
      </dl>
      <p className="muted small">Antes de confirmar la transferencia, verificá que el titular coincida.</p>
      <p className="muted small">
        Tenés <b>{DEPOSIT_HOURS} hs</b> para abonarla. Si no la recibimos, el turno se cancela automáticamente a las <b>{EXPIRE_HOURS} hs</b>.
      </p>
    </div>
  );
}
