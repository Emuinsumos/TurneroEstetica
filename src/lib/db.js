import { ref, set, update, remove, push } from "firebase/database";
import { db } from "../config/firebase";

export const dbSet = (path, value) => set(ref(db, path), value);
export const dbUpdate = (path, value) => update(ref(db, path), value);
export const dbRemove = (path) => remove(ref(db, path));
export const newKey = (path) => push(ref(db, path)).key;

// Fecha de hoy (YYYY-MM-DD) en la zona horaria de Argentina
export const todayAR = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });
