/**
 * Logique pure de la page Administration (V3.1-87) : ce qui est « à traiter »,
 * les compteurs des tuiles, la tuile d'ouverture et la recherche de compte.
 * Aucune dépendance réseau ni React.
 */

/** Les seuls champs d'un compte dont cette logique a besoin (`AdminAccountRow` y convient). */
export interface CompteAdmin {
  id: string;
  handle_name: string;
  must_change_password: boolean;
  password_reset_requested_at: string | null;
}

export type TuileAdmin = "a_traiter" | "comptes" | "liens" | "identite" | "titres";

/** Comptes ayant demandé une réinitialisation, la demande la plus récente en premier. */
export function aTraiter<T extends CompteAdmin>(comptes: T[]): T[] {
  return comptes
    .filter((c) => c.password_reset_requested_at !== null)
    .sort((a, b) => Date.parse(b.password_reset_requested_at ?? "") - Date.parse(a.password_reset_requested_at ?? ""));
}

/** Comptes qui doivent changer leur mot de passe sans demande en cours : rien à faire, pour mémoire. */
export function pourMemoire<T extends CompteAdmin>(comptes: T[]): T[] {
  return comptes.filter((c) => c.must_change_password && c.password_reset_requested_at === null);
}

export function compteurs(comptes: CompteAdmin[], liens: unknown[]): { aTraiter: number; comptes: number; liens: number } {
  return { aTraiter: aTraiter(comptes).length, comptes: comptes.length, liens: liens.length };
}

/** La page s'ouvre sur « À traiter » s'il y a quelque chose, sinon sur « Comptes ». */
export function tuileInitiale(nbATraiter: number): "a_traiter" | "comptes" {
  return nbATraiter > 0 ? "a_traiter" : "comptes";
}

function replier(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Filtre par nom de compte (`handle_name`), sans tenir compte de la casse ni des accents. */
export function filtrerComptes<T extends CompteAdmin>(comptes: T[], recherche: string): T[] {
  const q = replier(recherche.trim());
  if (q === "") return comptes;
  return comptes.filter((c) => replier(c.handle_name).includes(q));
}
