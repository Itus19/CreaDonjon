/**
 * V3.2-23 (ADR 0113) — le corpus d'évaluation du classement « faut-il un
 * jet ? ». Des phrases telles qu'on les écrit en jouant, et la réponse
 * qu'un MJ attentif donnerait. Rejoué hors ligne contre le fournisseur local
 * (`src/server/ai/soloClassify.eval.integration.test.ts`), jamais dans la
 * suite ordinaire : il coûte un appel de modèle par phrase.
 *
 * `skills` liste les tests acceptables pour un `check` (un MJ hésiterait
 * entre Perception et Investigation pour « je fouille la pièce ») ; le palier
 * n'est pas noté, seulement la décision et le test.
 */

export interface CorpusEntry {
  text: string;
  presents?: string[];
  expected: "none" | "trivial" | "check";
  skills?: string[];
}

export const CHECK_CLASSIFY_CORPUS: CorpusEntry[] = [
  // Rien à tester : parler, regarder, penser, se déplacer sans obstacle.
  { text: "je me raconte une histoire pour m'endormir", expected: "none" },
  { text: "je salue Mabelle et je lui demande comment elle va", presents: ["Mabelle"], expected: "none" },
  { text: "je m'assois près du feu", expected: "none" },
  { text: "je regarde autour de moi", expected: "none" },
  { text: "je range mon épée", expected: "none" },
  { text: "je demande le prix d'une chambre", presents: ["Mabelle"], expected: "none" },
  { text: "je marche jusqu'à la place du marché", expected: "none" },
  { text: "je repense à mon village natal", expected: "none" },
  { text: "je dis à Ourse que je pars demain", presents: ["Sergent Ourse"], expected: "none" },
  { text: "je mange ma soupe", expected: "none" },
  { text: "je vais me coucher", expected: "none" },
  { text: "je remercie le forgeron", presents: ["le forgeron"], expected: "none" },
  { text: "j'attends que la pluie cesse", expected: "none" },
  { text: "je lis la lettre que Wil m'a donnée", expected: "none" },
  // Évident pour le personnage : la tâche existe, mais sans enjeu.
  { text: "j'ouvre la porte de la chambre", expected: "trivial" },
  { text: "je monte l'escalier jusqu'au premier étage", expected: "trivial" },
  { text: "je paie ma bière", presents: ["Mabelle"], expected: "trivial" },
  { text: "j'allume une bougie", expected: "trivial" },
  { text: "je selle mon cheval", expected: "trivial" },
  { text: "je grimpe sur la charrette", expected: "trivial" },
  { text: "je ramasse la pièce tombée par terre", expected: "trivial" },
  { text: "je verse de l'eau dans mon gobelet", expected: "trivial" },
  // Un jet : l'issue est incertaine et compte.
  { text: "je négocie : trois pièces, pas plus", presents: ["Mabelle"], expected: "check", skills: ["persuasion"] },
  { text: "je lui fais croire que je suis envoyé par le bourgmestre", presents: ["le garde"], expected: "check", skills: ["deception"] },
  { text: "je menace le voleur de lui couper la main s'il ne parle pas", presents: ["le voleur"], expected: "check", skills: ["intimidation"] },
  { text: "j'escalade le mur glissant de la tour", expected: "check", skills: ["athletics"] },
  { text: "je fouille la pièce à la recherche d'un passage secret", expected: "check", skills: ["investigation", "perception"] },
  { text: "je tends l'oreille pour entendre ce qu'ils disent derrière la porte", expected: "check", skills: ["perception"] },
  { text: "je me faufile derrière le garde sans qu'il me voie", presents: ["le garde"], expected: "check", skills: ["stealth"] },
  { text: "je crochète la serrure du coffre", expected: "check", skills: ["sleight_of_hand", "test_dex"] },
  { text: "j'essaie de me souvenir de ce que je sais sur l'ordre du Fanal", expected: "check", skills: ["history", "religion"] },
  { text: "je cherche des traces de pas dans la boue", expected: "check", skills: ["survival", "perception"] },
  { text: "je soigne la blessure du fermier", presents: ["le fermier"], expected: "check", skills: ["medicine"] },
  { text: "je calme le cheval affolé", expected: "check", skills: ["animal_handling"] },
  { text: "je devine s'il me ment", presents: ["le marchand"], expected: "check", skills: ["insight"] },
  { text: "j'identifie la rune gravée sur la porte", expected: "check", skills: ["arcana"] },
  { text: "je saute par-dessus le ravin", expected: "check", skills: ["athletics"] },
  { text: "je traverse la rivière à la nage malgré le courant", expected: "check", skills: ["athletics"] },
  { text: "je vole la bourse du marchand pendant qu'il regarde ailleurs", presents: ["le marchand"], expected: "check", skills: ["sleight_of_hand"] },
  { text: "je joue du luth pour amuser la salle", expected: "check", skills: ["performance"] },
  { text: "je défonce la porte d'un coup d'épaule", expected: "check", skills: ["athletics", "test_str"] },
  { text: "je reconnais la plante qui pousse près du puits", expected: "check", skills: ["nature"] },
  { text: "je marche en équilibre sur la poutre", expected: "check", skills: ["acrobatics"] },
  { text: "je retiens mon souffle sous l'eau le plus longtemps possible", expected: "check", skills: ["test_con", "athletics"] },
  { text: "je convaincs le capitaine de nous laisser passer la nuit au fort", presents: ["le capitaine"], expected: "check", skills: ["persuasion"] },
  { text: "je cherche le symbole du dieu sur l'autel et ce qu'il signifie", expected: "check", skills: ["religion"] },
  // Le piège du 25 novembre : un nom de compétence sans demande de jet.
  { text: "je raconte l'histoire de ma famille à Mabelle", presents: ["Mabelle"], expected: "none" },
  { text: "je parle de la nature de ce pays avec le guide", presents: ["le guide"], expected: "none" },
];
