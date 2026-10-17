/**
 * Logique pure de l'accueil en tableau de bord (V3.1-35) : répartition des
 * mondes en colonnes, tri des prochaines séances, « il y a … ». Aucun accès
 * au navigateur ni à l'horloge : l'heure courante est un argument.
 */

/** La part d'un monde de l'accueil dont cette logique a besoin. */
export interface MondeAccueil {
  id: string;
  mode: "campaign" | "solo" | null;
  myRole: "gm" | "player" | null;
  nextSession: { startsAt: string; durationMinutes: number } | null;
  myCharacter: { entityId: string; name: string } | null;
  players: { entityId: string; speciesLabel: string | null; classesLabel: string | null }[];
}

export interface RepartitionMondes<M> {
  jeMene: M[];
  enSolo: M[];
  jeJoue: M[];
}

/**
 * Trois groupes sans recouvrement. « En solo » passe avant « Je joue » : un
 * monde solo n'a pas de MJ humain, il ne peut pas être une table qu'on
 * rejoint comme joueur.
 */
export function repartirMondes<M extends MondeAccueil>(mondes: M[]): RepartitionMondes<M> {
  const repartition: RepartitionMondes<M> = { jeMene: [], enSolo: [], jeJoue: [] };
  for (const monde of mondes) {
    if (monde.mode === "solo") repartition.enSolo.push(monde);
    else if (monde.myRole === "player") repartition.jeJoue.push(monde);
    else repartition.jeMene.push(monde);
  }
  return repartition;
}

export type OngletMondes = "mene" | "joue" | "solo";

/** Onglets de la pilule du téléphone ; « Solo » seulement s'il y a des mondes solo ou si le compte peut en créer. */
export function ongletsMondes(repartition: RepartitionMondes<unknown>, canUseSoloMode: boolean): OngletMondes[] {
  return repartition.enSolo.length > 0 || canUseSoloMode ? ["mene", "joue", "solo"] : ["mene", "joue"];
}

/** L'onglet ouvert d'abord sur téléphone : le premier qui a des mondes (« Je mène » si aucun). */
export function premierOnglet(repartition: RepartitionMondes<unknown>): OngletMondes {
  if (repartition.jeMene.length > 0) return "mene";
  if (repartition.jeJoue.length > 0) return "joue";
  if (repartition.enSolo.length > 0) return "solo";
  return "mene";
}

export interface SeanceAVenir<M> {
  monde: M;
  startsAt: string;
  durationMinutes: number;
}

/** Les mondes qui ont une prochaine séance, la plus proche d'abord (à date égale, l'ordre d'origine). */
export function prochainesSeances<M extends MondeAccueil>(mondes: M[]): SeanceAVenir<M>[] {
  const seances: SeanceAVenir<M>[] = [];
  for (const monde of mondes) {
    if (monde.nextSession) {
      seances.push({ monde, startsAt: monde.nextSession.startsAt, durationMinutes: monde.nextSession.durationMinutes });
    }
  }
  return seances.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

export interface DelaiEcoule {
  unite: "maintenant" | "minutes" | "heures" | "jours";
  nombre: number;
}

const MINUTE_MS = 60_000;
const HEURE_MS = 60 * MINUTE_MS;
const JOUR_MS = 24 * HEURE_MS;

/**
 * Le temps écoulé depuis `quandIso`, dans la plus grande unité entière
 * (« il y a 3 h »). Moins d'une minute, date future ou illisible : « maintenant ».
 */
export function delaiEcoule(quandIso: string, maintenantMs: number): DelaiEcoule {
  const ecart = maintenantMs - Date.parse(quandIso);
  if (!Number.isFinite(ecart) || ecart < MINUTE_MS) return { unite: "maintenant", nombre: 0 };
  if (ecart < HEURE_MS) return { unite: "minutes", nombre: Math.floor(ecart / MINUTE_MS) };
  if (ecart < JOUR_MS) return { unite: "heures", nombre: Math.floor(ecart / HEURE_MS) };
  return { unite: "jours", nombre: Math.floor(ecart / JOUR_MS) };
}

/** Date et heure d'une séance dans la langue de l'interface (« sam. 3 oct., 18:30 »). `timeZone` : pour les tests. */
export function formaterSeance(iso: string, locale: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(iso));
}

/** « Mon personnage » du panneau joueur : le nom, et « espèce · classes » trouvés dans les joueurs du monde. */
export function monPersonnage(monde: MondeAccueil): { nom: string; detail: string | null } | null {
  const perso = monde.myCharacter;
  if (!perso) return null;
  const fiche = monde.players.find((p) => p.entityId === perso.entityId);
  const detail = [fiche?.speciesLabel, fiche?.classesLabel].filter(Boolean).join(" · ");
  return { nom: perso.name, detail: detail === "" ? null : detail };
}
