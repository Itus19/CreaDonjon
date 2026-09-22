import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * V3-B1 — Le garde-fou du critere central du ticket : « **Aucun appel au
 * modele de narration avant que la resolution mecanique ait produit son
 * resultat.** Verifie par un test, pas par une convention. »
 *
 * La forme la plus forte de cette garantie n'est pas un ordre d'appels
 * qu'on surveille : c'est qu'il n'y ait **aucun** appel de modele sur ce
 * chemin. C'est ce que ce test verrouille, fichier par fichier. Le jour ou
 * V3-B2 branchera la narration, ce test tombera — et c'est exactement ce
 * qu'on veut : il faudra alors venir ici ecrire l'ordre a la main, en
 * connaissance de cause, plutot que de decouvrir six mois plus tard qu'un
 * prompt est parti avant les des.
 *
 * Meme motif que `publicShare.blockCoverage.test.ts` : lit les sources, ne
 * touche ni la base ni le reseau, s'execute donc partout — y compris sans
 * `.env.local`, ou les tests d'integration se sautent en silence.
 */

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

/** Tout ce qu'un tour traverse, de la frappe au journal. */
const TURN_PATH = [
  "src/core/rules/intent.ts",
  "src/server/services/turnIntent.ts",
  "src/server/services/turnLoop.ts",
  "app/api/solo/tour/route.ts",
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

describe("le chemin d'un tour n'appelle aucun modele", () => {
  for (const file of TURN_PATH) {
    it(`${file} n'importe rien d'un fournisseur d'IA`, () => {
      const source = sourceOf(file);
      for (const marker of AI_MARKERS) {
        // Les mentions en commentaire sont legitimes (elles expliquent
        // justement pourquoi il n'y en a pas) : seules les lignes de code
        // comptent.
        const offending = source
          .split("\n")
          .filter((line) => !line.trimStart().startsWith("*") && !line.trimStart().startsWith("//"))
          .filter((line) => line.includes(marker));
        expect(offending, `${file} mentionne ${marker} hors commentaire`).toEqual([]);
      }
    });
  }
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
