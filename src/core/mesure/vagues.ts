/**
 * V3.1-62 — resume les requetes a la base d'un affichage de page, relevees
 * par l'instrumentation de developpement (`lib/supabase/measuredFetch.ts`).
 *
 * « Vagues » : la plus longue chaine de requetes dont chacune part apres la
 * fin de la precedente. Le temps d'une page vaut a peu pres le nombre de
 * vagues multiplie par la latence vers la base (constat de V2.1-20) : c'est
 * le chiffre a faire baisser, plus que le nombre de requetes.
 */
export interface RequeteMesuree {
  /** Depart, en ms, sur une horloge commune aux requetes d'une page. */
  debut: number;
  ms: number;
  chemin: string;
}

export interface ResumeRequetes {
  requetes: number;
  /** Allers-retours au serveur d'authentification (`/auth/v1/`). */
  auth: number;
  vagues: number;
  /** Du premier depart a la derniere fin. */
  dureeMs: number;
  /** Somme des durees : ce que couterait tout faire en serie. */
  cumulMs: number;
}

export function resumerRequetes(requetes: readonly RequeteMesuree[]): ResumeRequetes {
  if (requetes.length === 0) return { requetes: 0, auth: 0, vagues: 0, dureeMs: 0, cumulMs: 0 };
  const triees = [...requetes].sort((a, b) => a.debut - b.debut);
  const chaine: number[] = [];
  for (let i = 0; i < triees.length; i++) {
    let meilleure = 0;
    for (let j = 0; j < i; j++) {
      if (triees[j].debut + triees[j].ms <= triees[i].debut) meilleure = Math.max(meilleure, chaine[j]);
    }
    chaine.push(meilleure + 1);
  }
  const premier = triees[0].debut;
  const derniereFin = Math.max(...triees.map((r) => r.debut + r.ms));
  return {
    requetes: triees.length,
    auth: triees.filter((r) => r.chemin.startsWith("/auth/v1/")).length,
    vagues: Math.max(...chaine),
    dureeMs: Math.round(derniereFin - premier),
    cumulMs: Math.round(triees.reduce((s, r) => s + r.ms, 0)),
  };
}
