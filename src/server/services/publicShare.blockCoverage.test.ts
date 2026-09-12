import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BLOCK_TYPES, type BlockType } from "@/src/core/schemas/blocks/registry";

/**
 * Garde-fou de non-regression sur `publicShare.ts` (audit B-16).
 *
 * Ce fichier est le seul du projet autorise a construire un client
 * `service_role` pour la LECTURE : la RLS y est contournee par
 * construction, et le filtrage applicatif est donc la SEULE barriere
 * entre la base et un visiteur anonyme. Il grossit d'une section a chaque
 * nouveau type de bloc, et chaque ajout demande de se souvenir d'y
 * appliquer le bon traitement. Le vingt-deuxieme type sera ajoute un soir
 * de fatigue.
 *
 * Ce test ne verifie pas que le filtrage est CORRECT — il verifie qu'une
 * decision a ete PRISE pour chaque type de bloc. Ajouter un type au
 * registre sans le classer ci-dessous fait echouer la suite, au bon
 * moment : a l'ajout, pas six mois plus tard quand quelqu'un ouvre un
 * lien de partage.
 *
 * Pur : lit le fichier source, ne touche ni la base ni le reseau. Il
 * s'execute donc partout, y compris sans `.env.local`.
 */

/**
 * Categorie 1 — sous-visibilite INTERNE au bloc.
 *
 * La visibilite du bloc ne suffit pas : chaque fragment porte la sienne
 * (SCHEMA.md §7.1). Un bloc public peut contenir un segment `gm`. Sans
 * filtrage interne, ce segment quitte le serveur.
 *
 * C'est la categorie la plus dangereuse : l'oubli n'est pas visible a
 * l'ecran, la donnee est simplement PRESENTE dans le JSON envoye.
 */
const NEEDS_INNER_FILTERING: readonly BlockType[] = ["text", "timeline"];

/**
 * Categorie 2 — enrichi par une resolution cote serveur.
 *
 * La donnee du bloc ne porte que des identifiants ; le nom, le slug ou
 * l'arbre correspondant sont resolus ici. Chaque resolution doit
 * revalider la visibilite de ce qu'elle rapporte, jamais faire confiance
 * a l'identifiant stocke — une fiche masquee ne doit pas fuiter par la
 * relation, la quete ou la punaise qui la cite.
 */
const NEEDS_SERVER_RESOLUTION: readonly BlockType[] = [
  "genealogy",
  "quest",
  "relationship",
  "relations_graph",
  "personality",
  "worldview",
  "map",
  "image",
];

/**
 * Categorie 3 — donnee autoportante, envoyee telle quelle.
 *
 * Aucun identifiant a resoudre, aucune sous-visibilite : la visibilite du
 * bloc entier suffit, `filterBlocks` fait tout le travail. Le contenu est
 * du texte, des nombres ou des references de REGLES (publiques par
 * nature, `is_official_base`).
 *
 * Y inscrire un type est une decision : cela affirme qu'aucun champ de sa
 * donnee ne peut contenir un secret que la visibilite du bloc ne couvre
 * pas deja.
 */
const SELF_CONTAINED: readonly BlockType[] = [
  "infobox",
  "custom_table",
  "character",
  "inventory",
  "spellcasting",
  "resources",
  "statblock",
  "random_table",
  "generator",
  "music",
  "session_log",
];

const PUBLIC_SHARE_SOURCE = readFileSync(
  fileURLToPath(new URL("./publicShare.ts", import.meta.url)),
  "utf8"
);

describe("publicShare : couverture des types de bloc (garde-fou B-16)", () => {
  it("classe chaque type du registre dans exactement une categorie", () => {
    const classified = [...NEEDS_INNER_FILTERING, ...NEEDS_SERVER_RESOLUTION, ...SELF_CONTAINED];

    // Un type ajoute au registre et oublie ici : c'est le cas que ce test
    // existe pour attraper.
    const unclassified = BLOCK_TYPES.filter((t) => !classified.includes(t));
    expect(unclassified, "type(s) de bloc non classe(s) — voir l'en-tete de ce fichier").toEqual([]);

    // Un type classe deux fois, ou un type retire du registre et laisse ici.
    expect(new Set(classified).size, "un type est classe dans deux categories").toBe(classified.length);
    const unknown = classified.filter((t) => !BLOCK_TYPES.includes(t));
    expect(unknown, "type(s) classe(s) mais absent(s) du registre").toEqual([]);
  });

  it("traite reellement, dans publicShare.ts, chaque type qui l'exige", () => {
    // Les deux premieres categories DOIVENT laisser une trace dans le
    // fichier : un `blockType === "x"`, un schema de bloc importe, un
    // champ de `PublicBlock`. Retirer ce traitement sans reclasser le type
    // fait echouer ce test.
    for (const blockType of [...NEEDS_INNER_FILTERING, ...NEEDS_SERVER_RESOLUTION]) {
      expect(
        PUBLIC_SHARE_SOURCE.includes(`"${blockType}"`),
        `le type "${blockType}" est declare comme traite mais n'apparait plus dans publicShare.ts`
      ).toBe(true);
    }
  });

  it("applique filterBlocks avant de construire la reponse publique", () => {
    // La garde de base, celle sans laquelle toutes les autres sont
    // inutiles : la visibilite du bloc lui-meme.
    expect(PUBLIC_SHARE_SOURCE).toContain("filterBlocks");
    // Et le filtrage fin des fragments, pour la categorie 1.
    expect(PUBLIC_SHARE_SOURCE).toContain("filterSegments");
  });
});
