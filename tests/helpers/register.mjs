// Hace que los tests de los endpoints usen una base de datos simulada en lugar de firebase-admin.
import { register } from "node:module";
register("./hooks.mjs", import.meta.url);
