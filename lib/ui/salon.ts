import type { JetAffiche } from "./outilDes";

/**
 * Logique pure du salon de table (V3.1-22, ADR 0038) : intercaler les
 * messages et les jets par heure, ne jamais montrer deux fois le même jet,
 * ne jamais montrer à un joueur ce que le DD privé lui cache. Rien d'aléatoire
 * ici : les jets sont lus, jamais lancés.
 */

/** Le fil que montre un panneau : le salon, ou un fil privé (`joueurId` omis côté joueur : c'est le sien). */
export type FilChat = { genre: "salon" } | { genre: "prive"; joueurId?: string };

/**
 * La valeur de `thread_user_id` d'un message du fil : `null` pour le salon,
 * l'identifiant du joueur pour un fil privé. `undefined` tant qu'on ignore
 * qui je suis (côté joueur) : aucun message ne doit alors passer le filtre.
 */
export function cibleDuFil(fil: FilChat, moiId: string | null): string | null | undefined {
  if (fil.genre === "salon") return null;
  return fil.joueurId ?? moiId ?? undefined;
}

export type ElementSalon<M extends { id: string; created_at: string }> =
  | { genre: "message"; id: string; at: string; message: M }
  | { genre: "jet"; id: string; at: string; jet: JetAffiche };

/**
 * Les messages et les jets du salon, du plus ancien au plus récent, sans
 * doublon (par identifiant). Les jets chargés par la route passent avant ceux
 * reçus en direct : la route les a déjà passés au filtre du lecteur.
 */
export function fusionnerSalon<M extends { id: string; created_at: string }>(
  messages: readonly M[],
  jetsCharges: readonly JetAffiche[],
  jetsRecus: readonly JetAffiche[]
): ElementSalon<M>[] {
  const vus = new Set<string>();
  const elements: ElementSalon<M>[] = [];
  for (const message of messages) {
    if (vus.has(message.id)) continue;
    vus.add(message.id);
    elements.push({ genre: "message", id: message.id, at: message.created_at, message });
  }
  const idsJets = new Set<string>();
  for (const jet of [...jetsCharges, ...jetsRecus]) {
    if (idsJets.has(jet.id)) continue;
    idsJets.add(jet.id);
    elements.push({ genre: "jet", id: jet.id, at: jet.createdAt, jet });
  }
  // `sort` est stable : à heure égale, l'ordre d'arrivée est conservé.
  return elements.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

export interface LectureJet {
  dc: number | null;
  /** Un DD existe mais le lecteur n'a pas à le connaître : « contre DD ? ». */
  dcInconnu: boolean;
  verdict: "success" | "fail" | null;
}

/**
 * Ce que le lecteur a le droit de lire d'un jet : un joueur ne voit jamais le
 * verdict ni la valeur d'un DD privé. La route le retire déjà, mais les jets
 * en direct arrivent bruts : on le cache aussi à l'écran.
 */
export function lectureJet(jet: JetAffiche, estMj: boolean): LectureJet {
  if (jet.dcPrivate && !estMj) return { dc: null, dcInconnu: true, verdict: null };
  return { dc: jet.dc, dcInconnu: false, verdict: jet.verdict };
}
