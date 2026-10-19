import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Vitest ne cherche les tests que sous `src/` et `lib/` (vitest.config.ts).
 * Un test posé ailleurs ne tourne jamais, sans aucun message : le 19
 * octobre, le test de rendu de V3.1-56, rangé sous `components/`, passait
 * pour vérifié alors qu'il n'avait jamais été lancé. Ce test le refuse.
 */
function testsSous(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) return entree.name === "node_modules" || entree.name.startsWith(".") ? [] : testsSous(chemin);
    return /\.test\.tsx?$/.test(entree.name) ? [chemin] : [];
  });
}

describe("emplacement des tests", () => {
  it("aucun fichier de test hors de src/ et lib/ (il ne tournerait jamais)", () => {
    const racine = process.cwd();
    const egares = ["app", "components", "scripts"].flatMap((d) => testsSous(join(racine, d)));
    expect(egares).toEqual([]);
  });
});
