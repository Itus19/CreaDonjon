import { z } from "zod";
import type { TableEntry } from "./types";

/**
 * AG-21 — une table aléatoire lue depuis un fichier (`data/personnel/tables/`,
 * jamais suivi par Git) : un texte, une entrée par ligne, ou un JSON
 * `{ key?, attribution?, entries: [{ text, tier?, weight? }] }`. Les plages se
 * déduisent des poids, de 1 au total, et le dé de ce total : la table se tire
 * telle quelle. Pur : l'écran lit le fichier, la donnée passe ensuite par
 * l'enregistrement habituel du bloc, qui la revalide.
 */
const MAX_ENTREES = 1000;

const zFichierJson = z.object({
  key: z.string().trim().min(1).max(80).optional(),
  attribution: z.string().trim().min(1).max(300).optional(),
  entries: z
    .array(
      z.object({
        text: z.string().trim().min(1).max(2000),
        tier: z.string().trim().min(1).max(40).optional(),
        weight: z.number().int().min(1).max(100).optional(),
      })
    )
    .min(1)
    .max(MAX_ENTREES),
});

export interface TableImportee {
  key?: string;
  attribution?: string;
  die: string;
  entries: TableEntry[];
}

export type LectureTable = { ok: true; table: TableImportee } | { ok: false; erreur: string };

export function lireTableImportee(contenu: string): LectureTable {
  const texte = contenu.trim();
  if (texte === "") return { ok: false, erreur: "Le fichier est vide." };
  const json = texte.startsWith("{") ? essayerJson(texte) : undefined;
  if (json !== undefined) {
    const parsed = zFichierJson.safeParse(json);
    if (!parsed.success) return { ok: false, erreur: `Fichier JSON illisible : ${parsed.error.issues[0]?.message ?? "forme inattendue"}.` };
    const { key, attribution, entries } = parsed.data;
    return { ok: true, table: { ...(key ? { key } : {}), ...(attribution ? { attribution } : {}), ...avecPlages(entries) } };
  }
  const lignes = texte
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "" && !l.startsWith("#"));
  if (lignes.length === 0) return { ok: false, erreur: "Aucune entrée dans le fichier." };
  if (lignes.length > MAX_ENTREES) return { ok: false, erreur: `Plus de ${MAX_ENTREES} entrées : découpez le fichier.` };
  return { ok: true, table: avecPlages(lignes.map((text) => ({ text }))) };
}

function essayerJson(texte: string): unknown {
  try {
    return JSON.parse(texte);
  } catch {
    // catch-attendu : un texte qui commence par « { » sans être du JSON se lit ligne à ligne.
    return undefined;
  }
}

function avecPlages(entries: readonly { text: string; tier?: string; weight?: number }[]): { die: string; entries: TableEntry[] } {
  let max = 0;
  const lignes = entries.map((e) => {
    const weight = e.weight ?? 1;
    const range = { min: max + 1, max: max + weight };
    max += weight;
    return { range, weight, text: e.text, ...(e.tier ? { tier: e.tier } : {}) };
  });
  return { die: `d${max}`, entries: lignes };
}
