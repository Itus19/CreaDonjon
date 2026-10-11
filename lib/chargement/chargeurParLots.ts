/**
 * V3.1-62, règle C2 de docs/CABLAGE.md : « une donnée partagée se charge une
 * fois par écran ». Plusieurs blocs d'une même fiche demandent chacun leurs
 * clés (puces de référence, blocs de règles) au même moment : ce chargeur les
 * regroupe en une seule requête, et réutilise une réponse encore fraîche.
 *
 * Mesuré le 11 octobre : la fiche de personnage lançait 26 requêtes de puces
 * et 5 de blocs de règles, chacune refaisant la session, le monde et la
 * chaîne de rulesets côté serveur.
 *
 * Fonctionnement :
 * - une clé déjà chargée et encore fraîche est rendue sans requête ;
 * - une clé déjà demandée et pas encore revenue réutilise la même attente ;
 * - les autres partent ensemble au tour suivant de la boucle d'événements
 *   (`setTimeout(0)`), assez tard pour que tous les blocs rendus dans le même
 *   passage aient déposé leurs clés, coupées à `tailleMax` (la borne du
 *   schéma Zod de la route) ;
 * - un échec rejette les demandes concernées et ne laisse rien en cache.
 *
 * Aucune dépendance à React ni au réseau : `chargerLot` fait l'appel.
 */
export interface ChargeurParLots<V> {
  /** Rend les valeurs trouvées ; une clé introuvable côté serveur est simplement absente. */
  charger(cles: readonly string[]): Promise<Map<string, V>>;
  /** Le résultat tout de suite si TOUTES les clés sont en cache et fraîches, sinon `null` (premier affichage sans clignotement). */
  lireSiPret(cles: readonly string[]): Map<string, V> | null;
  /** Oublie les clés choisies (toutes sans filtre), pour forcer un rechargement. */
  vider(filtre?: (cle: string) => boolean): void;
}

interface Entree<V> {
  /** `undefined` : la clé n'existe pas côté serveur (résultat gardé lui aussi). */
  valeur: V | undefined;
  chargeeA: number;
}

interface Attente<V> {
  promesse: Promise<V | undefined>;
  resoudre: (valeur: V | undefined) => void;
  rejeter: (erreur: unknown) => void;
}

export function creerChargeurParLots<V>(options: {
  chargerLot: (cles: readonly string[]) => Promise<Map<string, V>>;
  tailleMax: number;
  /** Durée pendant laquelle une réponse est réutilisée ; `Infinity` : jusqu'à `vider`. */
  dureeCacheMs: number;
  maintenant?: () => number;
}): ChargeurParLots<V> {
  const maintenant = options.maintenant ?? Date.now;
  const cache = new Map<string, Entree<V>>();
  const enCours = new Map<string, Attente<V>>();
  let file: string[] = [];
  let envoiPrevu = false;

  function envoyer(): void {
    envoiPrevu = false;
    const lot = file;
    file = [];
    for (let i = 0; i < lot.length; i += options.tailleMax) {
      const morceau = lot.slice(i, i + options.tailleMax);
      options.chargerLot(morceau).then(
        (resultats) => {
          for (const cle of morceau) {
            const valeur = resultats.get(cle);
            cache.set(cle, { valeur, chargeeA: maintenant() });
            enCours.get(cle)?.resoudre(valeur);
            enCours.delete(cle);
          }
        },
        (erreur: unknown) => {
          for (const cle of morceau) {
            enCours.get(cle)?.rejeter(erreur);
            enCours.delete(cle);
          }
        }
      );
    }
  }

  function attendre(cle: string): Promise<V | undefined> {
    const entree = cache.get(cle);
    if (entree && maintenant() - entree.chargeeA < options.dureeCacheMs) return Promise.resolve(entree.valeur);
    const deja = enCours.get(cle);
    if (deja) return deja.promesse;

    let resoudre: (valeur: V | undefined) => void = () => {};
    let rejeter: (erreur: unknown) => void = () => {};
    const promesse = new Promise<V | undefined>((ok, ko) => {
      resoudre = ok;
      rejeter = ko;
    });
    enCours.set(cle, { promesse, resoudre, rejeter });
    file.push(cle);
    if (!envoiPrevu) {
      envoiPrevu = true;
      setTimeout(envoyer, 0);
    }
    return promesse;
  }

  return {
    async charger(cles) {
      const uniques = [...new Set(cles)];
      const valeurs = await Promise.all(uniques.map(attendre));
      const resultat = new Map<string, V>();
      uniques.forEach((cle, i) => {
        const valeur = valeurs[i];
        if (valeur !== undefined) resultat.set(cle, valeur);
      });
      return resultat;
    },
    lireSiPret(cles) {
      const resultat = new Map<string, V>();
      for (const cle of cles) {
        const entree = cache.get(cle);
        if (!entree || maintenant() - entree.chargeeA >= options.dureeCacheMs) return null;
        if (entree.valeur !== undefined) resultat.set(cle, entree.valeur);
      }
      return resultat;
    },
    vider(filtre) {
      for (const cle of [...cache.keys()]) if (!filtre || filtre(cle)) cache.delete(cle);
    },
  };
}
