import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "../config/firebase";
import { P } from "../config/paths";

function useNode(path) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  useEffect(() => {
    return onValue(
      ref(db, path),
      (s) => setState({ data: s.val(), loading: false, error: null }),
      (e) => setState({ data: null, loading: false, error: e.message })
    );
  }, [path]);
  return state;
}

export const useConfig = () => useNode(P.config);
export const useServices = () => useNode(P.services);
export const useProfessionals = () => useNode(P.professionals);
export const useAvailability = () => useNode(P.availabilityAll);
export const useBlocked = () => useNode(P.blockedSlots);
export const useServiceAgenda = () => useNode(P.serviceAgenda);
export const usePayment = () => useNode(P.payment);
export const useAuditLog = () => useNode(P.auditLog); // solo lo puede leer el admin

export const toList = (obj) =>
  Object.entries(obj || {}).map(([id, v]) => ({ id, ...v }));

export const useAppointments = () => useNode(P.appointments);

// Reservas ocupadas (locks) de uno o varios profesionales en una fecha.
// Mientras no llegaron todas, loading = true (no hay que mostrar horarios todavía).
export function useLocks(profIds, date) {
  const key = profIds.join(",");
  const [state, setState] = useState({ locks: {}, loading: true, error: null });
  useEffect(() => {
    const ids = key ? key.split(",") : [];
    if (!date || ids.length === 0) {
      setState({ locks: {}, loading: false, error: null });
      return undefined;
    }
    const got = {};
    setState({ locks: {}, loading: true, error: null });
    const unsubs = ids.map((id) =>
      onValue(
        ref(db, P.slotLocks(id, date)),
        (s) => {
          got[id] = s.val() || {};
          setState({ locks: { ...got }, loading: Object.keys(got).length < ids.length, error: null });
        },
        (e) => setState({ locks: {}, loading: false, error: e.message })
      )
    );
    return () => unsubs.forEach((u) => u());
  }, [key, date]);
  return state;
}
