import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * V3.1-105 — le cœur commun de résolution ne parle à aucun modèle d'IA
 * (règle 8 : l'IA narre, le code arbitre). Même motif que
 * `turnIntent.noAi.test.ts`, qui couvre la boucle de tour du solo ; ce
 * fichier-ci, que le solo appelle désormais, est vérifié ici sans toucher au
 * test du solo.
 */
const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const AI_MARKERS = ["@/src/server/ai/", "@/src/core/ai/", "runAiCompletion", "AiProvider", "ai_proposals"];
const FILES = ["src/server/services/targetedRoll.ts", "src/core/rules/targeting.ts", "app/api/campaigns/[campaignId]/combats/[combatId]/targeted-roll/route.ts"];

describe("le cœur de résolution n'appelle jamais aucun modèle", () => {
  for (const file of FILES) {
    it(`${file} n'importe rien d'un fournisseur d'IA`, () => {
      const lines = readFileSync(new URL(file, `file://${ROOT}`), "utf8")
        .split("\n")
        .filter((line) => !line.trimStart().startsWith("*") && !line.trimStart().startsWith("//"));
      for (const marker of AI_MARKERS) {
        expect(lines.filter((line) => line.includes(marker)), `${file} mentionne ${marker}`).toEqual([]);
      }
    });
  }
});
