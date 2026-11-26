import assert from "node:assert/strict";
import { groupByCategory } from "../src/lib/hours.js";
import {
  normalizeText, filterGroups, categoryNames, canonicalCategory, existingCategories,
} from "../src/lib/serviceFilter.js";

const S = (id, name, category, order, description = "") => ({ id, name, category, order, description });
const list = [
  S("1", "Lifting de pestañas", "Lifting y pestañas", 1),
  S("2", "Perfilado de cejas", "Lifting y pestañas", 2, "Diseño con henna"),
  S("3", "Depilación piernas", "Depilación", 3),
  S("4", "Depilación axilas", "Depilación", 4),
  S("5", "Uñas esculpidas", "Uñas", 5),
  S("6", "Limpieza facial", undefined, 6),
];
const groups = groupByCategory(list);

// normalización: sin acentos ni mayúsculas
assert.equal(normalizeText("  Uñas   ESCULPIDAS "), "unas esculpidas");
assert.equal(normalizeText(null), "");

// sin filtros: devuelve todo, mismo orden de grupos
assert.deepEqual(filterGroups(groups).map((g) => g.category), ["Lifting y pestañas", "Depilación", "Uñas", "Otros"]);

// búsqueda sin acentos y en cualquier orden de palabras
assert.deepEqual(filterGroups(groups, { query: "unas" }).flatMap((g) => g.items.map((s) => s.id)), ["5"]);
assert.deepEqual(filterGroups(groups, { query: "piernas depilacion" }).flatMap((g) => g.items.map((s) => s.id)), ["3"]);

// también busca en descripción y en el nombre de la categoría
assert.deepEqual(filterGroups(groups, { query: "henna" }).flatMap((g) => g.items.map((s) => s.id)), ["2"]);
assert.deepEqual(filterGroups(groups, { query: "depilacion" }).flatMap((g) => g.items.map((s) => s.id)), ["3", "4"]);

// los servicios sin categoría caen en "Otros" y se pueden filtrar por ese nombre
assert.deepEqual(filterGroups(groups, { category: "Otros" }).flatMap((g) => g.items.map((s) => s.id)), ["6"]);

// categoría + texto; los grupos vacíos no aparecen
assert.deepEqual(filterGroups(groups, { category: "Depilación", query: "axilas" }).flatMap((g) => g.items.map((s) => s.id)), ["4"]);
assert.deepEqual(filterGroups(groups, { query: "zzz" }), []);

// categorías para los chips
assert.deepEqual(categoryNames(groups), ["Lifting y pestañas", "Depilación", "Uñas", "Otros"]);
assert.deepEqual(categoryNames(groupByCategory([S("a", "x", undefined, 1)])), []);
assert.deepEqual(existingCategories(list), ["Lifting y pestañas", "Depilación", "Uñas"]);

// admin: reutiliza la categoría ya cargada aunque se escriba distinto
const cats = ["Lifting y pestañas", "Depilación", "Uñas"];
assert.equal(canonicalCategory("unas", cats), "Uñas");
assert.equal(canonicalCategory("  DEPILACION ", cats), "Depilación");
assert.equal(canonicalCategory("Masajes", cats), "Masajes");
assert.equal(canonicalCategory("   ", cats), null);
assert.equal(canonicalCategory(undefined, cats), null);

console.log("serviceFilter OK");
