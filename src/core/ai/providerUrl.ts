/**
 * V3.1-224 (ADR 0103) — l'adresse d'un fournisseur d'IA, telle qu'un
 * utilisateur la saisit.
 *
 * Elle sera appelée par NOTRE serveur, avec ses privilèges réseau : c'est une
 * SSRF par construction. Cette fonction est la première barrière, et elle est
 * pure — donc testée en millisecondes, et employée aux DEUX moments qui
 * comptent : à l'enregistrement, et avant chaque appel (une adresse valide
 * hier peut avoir été écrite à la main en base depuis).
 *
 * Ce qu'elle ne sait pas faire, et qu'il faut savoir : un nom de domaine
 * public peut résoudre vers une adresse privée (DNS rebinding). S'en défendre
 * demanderait de résoudre le nom puis d'épingler l'adresse jusqu'à la
 * connexion — hors de portée de `fetch`. Les deux autres gardes de l'ADR
 * (aucune redirection suivie, délai court) limitent ce que cela permettrait.
 */

export type RaisonUrlRefusee =
  /** Ni une adresse, ni absolue. */
  | "illisible"
  /** Autre chose que http ou https : `file:`, `data:`, `gopher:`… */
  | "schema"
  /** `http:` en clair, hors machine locale. */
  | "http"
  /** Machine locale, réseau privé, ou métadonnées d'instance. */
  | "privee"
  /** Un `user:motdepasse@` dans l'adresse. */
  | "identifiants";

export type UrlFournisseurVerdict = { ok: true } | { ok: false; raison: RaisonUrlRefusee };

/** Les plages qu'un serveur hébergé ne doit jamais appeler sur ordre d'un utilisateur. */
function estAdressePrivee(hote: string): boolean {
  const h = hote.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h === "::1" || h === "0.0.0.0") return true;
  // IPv6 unique local (fc00::/7) et lien-local (fe80::/10).
  if (/^f[cd][0-9a-f]{2}:/.test(h) || /^fe[89ab][0-9a-f]:/.test(h)) return true;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!v4) return false;
  const [a, b] = [Number(v4[1]), Number(v4[2])];
  if (a === 127 || a === 10 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  // 169.254/16 : le lien-local, et surtout 169.254.169.254, les métadonnées d'instance.
  if (a === 169 && b === 254) return true;
  return false;
}

export function verifierUrlFournisseur(brut: string, options: { adressesPriveesAutorisees: boolean }): UrlFournisseurVerdict {
  let url: URL;
  try {
    url = new URL(brut.trim());
  } catch {
    return { ok: false, raison: "illisible" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false, raison: "schema" };
  if (url.username !== "" || url.password !== "") return { ok: false, raison: "identifiants" };

  const privee = estAdressePrivee(url.hostname);
  if (privee && !options.adressesPriveesAutorisees) return { ok: false, raison: "privee" };
  // `http:` en clair ne se tolère que sur la machine de l'utilisateur lui-même.
  if (url.protocol === "http:" && !(privee && options.adressesPriveesAutorisees)) return { ok: false, raison: "http" };
  return { ok: true };
}
