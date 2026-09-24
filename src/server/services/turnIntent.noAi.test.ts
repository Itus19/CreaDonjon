import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * V3-B1 — Le garde-fou du critere central du ticket : « **Aucun appel au
 * modele de narration avant que la resolution mecanique ait produit son
 * resultat.** Verifie par un test, pas par une convention. »
 *
 * **Mise a jour au cablage de la narration (V3-B2).** Ce fichier annoncait
 * lui-meme, depuis V3-B1 : « le jour ou V3-B2 branchera la narration, ce
 * test tombera — et c'est exactement ce qu'on veut : il faudra alors venir
 * ici ecrire l'ordre a la main, en connaissance de cause ». C'est fait :
 * `app/api/solo/tour/route.ts` appelle desormais `narrateSoloTurn` — mais
 * seulement APRES `playTurn`, jamais avant, et seulement en best-effort
 * (specs/cible-locale-et-ia.md §4). La garantie la plus forte (« aucun
 * appel nulle part sur ce chemin ») reste vraie pour les quatre fichiers
 * qui font REELLEMENT tourner la mecanique — `route.ts` n'en fait pas
 * partie, il les enveloppe, et c'est desormais un ORDRE qu'on verifie,
 * pas une absence.
 *
 * Meme motif que `publicShare.blockCoverage.test.ts` : lit les sources, ne
 * touche ni la base ni le reseau, s'execute donc partout — y compris sans
 * `.env.local`, ou les tests d'integration se sautent en silence.
 */

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

/** Le noyau du tour : jamais un appel d'IA, sans aucune exception. */
const STRICT_PATH = [
  "src/core/rules/intent.ts",
  "src/server/services/turnIntent.ts",
  "src/server/services/turnLoop.ts",
  "components/solo/IntentBar.tsx",
];

/**
 * Les portes d'entree de l'IA dans ce depot. `src/server/ai/` est la seule
 * (regle absolue 12) ; `promptSafety` et les schemas de proposition de
 * `src/core/ai/` n'appellent rien eux-memes, mais leur presence sur ce
 * chemin signalerait qu'un prompt s'y construit.
 */
const AI_MARKERS = ["@/src/server/ai/", "@/src/core/ai/", "runAiCompletion", "AiProvider", "ai_proposals"];

function sourceOf(relativePath: string): string {
  return readFileSync(new URL(relativePath, `file://${ROOT}`), "utf8");
}

/** Lignes de code seulement — un marqueur en commentaire explique justement pourquoi il n'y en a pas. */
function codeLines(source: string): string[] {
  return source.split("\n").filter((line) => !line.trimStart().startsWith("*") && !line.trimStart().startsWith("//"));
}

describe("le noyau du tour n'appelle jamais aucun modele", () => {
  for (const file of STRICT_PATH) {
    it(`${file} n'importe rien d'un fournisseur d'IA`, () => {
      const lines = codeLines(sourceOf(file));
      for (const marker of AI_MARKERS) {
        const offending = lines.filter((line) => line.includes(marker));
        expect(offending, `${file} mentionne ${marker} hors commentaire`).toEqual([]);
      }
    });
  }
});

describe("la route du tour appelle l'IA, mais jamais avant playTurn", () => {
  it("getOpenAiCompatibleProviderFromEnv() et narrateSoloTurn() n'apparaissent qu'APRES l'appel a playTurn(", () => {
    const lines = codeLines(sourceOf("app/api/solo/tour/route.ts"));
    const playTurnCallIndex = lines.findIndex((line) => line.includes("playTurn("));
    expect(playTurnCallIndex, "playTurn( doit etre appele dans ce fichier").toBeGreaterThanOrEqual(0);

    // Les CALLS, jamais les imports : un `import { x } from "..."` ne
    // contient pas `x(`, seul un site d'appel reel le fait — inutile de
    // filtrer les imports a part, la forme textuelle les exclut deja.
    for (const call of ["getOpenAiCompatibleProviderFromEnv(", "narrateSoloTurn("]) {
      const callIndex = lines.findIndex((line) => line.includes(call));
      expect(callIndex, `${call} doit apparaitre dans ce fichier`).toBeGreaterThanOrEqual(0);
      expect(callIndex, `${call} doit venir APRES playTurn(`).toBeGreaterThan(playTurnCallIndex);
    }
  });
});

describe("le journal precede tout le reste", () => {
  it("chaque tour resolu passe par `journalTurn` avant de rendre son resultat", () => {
    const source = sourceOf("src/server/services/turnIntent.ts");
    // Un `return { kind: "roll" | "player_action" }` qui ne serait pas
    // precede de sa journalisation rendrait un fait au client sans jamais
    // l'avoir ecrit — le tour existerait a l'ecran et nulle part ailleurs.
    const returns = source.split("\n").filter((line) => /^\s*return \{ kind: "(roll|player_action)"/.test(line));
    expect(returns.length).toBeGreaterThan(0);
    for (const line of returns) {
      expect(line, "le resultat rendu doit porter l'identifiant de l'evenement journalise").toContain("eventId");
    }
    expect(source).toContain("const eventId = await journalTurn(");
  });
});
