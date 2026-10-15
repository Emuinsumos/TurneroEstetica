import { useEffect, useState } from "react";
import { onAuthStateChanged, getIdTokenResult } from "firebase/auth";
import { auth } from "../../config/firebase";
import { BUSINESS_ID } from "../../config/paths";

// Es admin solo si el token (firmado por el servidor) lo dice para ESTE negocio.
export function useAdminSession() {
  const [state, setState] = useState({ loading: true, admin: false });

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) return setState({ loading: false, admin: false });
      try {
        const r = await getIdTokenResult(u);
        setState({
          loading: false,
          admin: r.claims.role === "admin" && r.claims.businessId === BUSINESS_ID,
        });
      } catch {
        setState({ loading: false, admin: false });
      }
    });
  }, []);

  return state;
}
