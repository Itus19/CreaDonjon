/**
 * Livre de sessions (V3.1-43) : le calcul du registre MJ, sans DOM ni réseau.
 * Un devoir n'a pas de séance réelle stockée : on la retrouve par la date de
 * sa création.
 */

export interface SeanceReelle {
  id: string;
  scheduled_date: string;
  starts_at: string;
  duration_minutes: number;
}

export interface DevoirLivre {
  id: string;
  status: "pending" | "written";
  assigned_to: string;
  created_at: string;
  written_at: string | null;
  entity_name: string | null;
  entity_slug: string | null;
}

export type EtatLigne = "redigee" | "attente" | "sans_devoir";

export interface LigneRegistre<D extends DevoirLivre> {
  cle: string;
  /** `null` pour une séance passée sans aucun devoir. */
  devoir: D | null;
  seance: SeanceReelle | null;
  etat: EtatLigne;
}

function moment(seance: SeanceReelle): number {
  return new Date(`${seance.scheduled_date}T${seance.starts_at}`).getTime();
}

/** La plus récente séance réelle dont la date n'est pas postérieure à la création du devoir (date UTC, comme `created_at`). */
export function seanceReelleDuDevoir(creeLe: string, seances: readonly SeanceReelle[]): SeanceReelle | null {
  // Le jour LOCAL de la création : `scheduled_date` est une date locale, le jour UTC décalerait un devoir posé le soir.
  const cree = new Date(creeLe);
  const jour = `${cree.getFullYear()}-${String(cree.getMonth() + 1).padStart(2, "0")}-${String(cree.getDate()).padStart(2, "0")}`;
  let retenue: SeanceReelle | null = null;
  for (const s of seances) {
    if (s.scheduled_date > jour) continue;
    if (!retenue || moment(s) > moment(retenue)) retenue = s;
  }
  return retenue;
}

/** La séance à venir la plus proche. */
export function prochaineSeance(seances: readonly SeanceReelle[], maintenant: number): SeanceReelle | null {
  const futures = seances.filter((s) => moment(s) >= maintenant).sort((a, b) => moment(a) - moment(b));
  return futures[0] ?? null;
}

/** La séance déjà jouée la plus récente. */
export function derniereSeanceJouee(seances: readonly SeanceReelle[], maintenant: number): SeanceReelle | null {
  const passees = seances.filter((s) => moment(s) < maintenant).sort((a, b) => moment(b) - moment(a));
  return passees[0] ?? null;
}

/**
 * Le registre : une ligne par devoir, plus une ligne « sans devoir » par
 * séance passée qu'aucun devoir ne couvre. Plus récent d'abord.
 */
export function registre<D extends DevoirLivre>(devoirs: readonly D[], seances: readonly SeanceReelle[], maintenant: number): LigneRegistre<D>[] {
  const couvertes = new Set<string>();
  const lignes: { ligne: LigneRegistre<D>; date: number }[] = devoirs.map((d) => {
    const seance = seanceReelleDuDevoir(d.created_at, seances);
    if (seance) couvertes.add(seance.id);
    return {
      ligne: { cle: `devoir-${d.id}`, devoir: d, seance, etat: d.status === "written" ? "redigee" : "attente" },
      date: Date.parse(d.created_at),
    };
  });
  for (const s of seances) {
    if (moment(s) >= maintenant || couvertes.has(s.id)) continue;
    lignes.push({ ligne: { cle: `seance-${s.id}`, devoir: null, seance: s, etat: "sans_devoir" }, date: moment(s) });
  }
  return lignes.sort((a, b) => b.date - a.date).map((x) => x.ligne);
}
