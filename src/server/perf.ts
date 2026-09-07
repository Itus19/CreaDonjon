import "server-only";

/**
 * Chronometre de vague (audit P-06). L'audit de rapidite a montre que le
 * probleme du chargement n'est pas le NOMBRE de requetes — le parallelisme
 * interne est bien fait — mais le nombre de VAGUES sequentielles : huit a
 * dix allers-retours en serie avant le premier pixel a l'ouverture d'une
 * fiche, chacune payant la latence en entier.
 *
 * Or rien ne mesurait rien. Toute cette analyse reposait sur une lecture du
 * code, pas sur des chiffres — assez pour dire OU le temps peut se perdre,
 * jamais pour dire ou il se perd VRAIMENT, ni combien.
 *
 * **Silencieux par defaut.** Sans `PERF_LOG`, `timed` renvoie la promesse
 * telle quelle et ne coute rien de mesurable. C'est ce qui permet de
 * l'inscrire durablement sur les chemins chauds sans polluer les journaux :
 * on l'allume le temps d'une mesure, on lit, on eteint.
 *
 *   PERF_LOG=1 npm run dev
 *
 * Ne remplace pas un vrai outil de tracage. Il repond a une question
 * precise et bornee : "cette vague, combien de millisecondes ?".
 */
const ENABLED = Boolean(process.env.PERF_LOG);

export async function timed<T>(label: string, run: () => Promise<T>): Promise<T> {
  if (!ENABLED) return run();

  const startedAt = performance.now();
  try {
    return await run();
  } finally {
    // `finally` : une vague qui echoue a quand meme coute son temps, et
    // c'est souvent la plus interessante a mesurer. L'erreur poursuit son
    // chemin sans etre touchee.
    const ms = Math.round(performance.now() - startedAt);
    console.log(JSON.stringify({ niveau: "perf", vague: label, ms }));
  }
}
