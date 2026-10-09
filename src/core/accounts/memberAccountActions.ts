/**
 * ADR 0052 — Qui peut agir sur le COMPTE d'un autre : « voir comme » et
 * reinitialisation forcee du mot de passe.
 *
 * Deux gestes qui donnent, l'un comme l'autre, la main sur le compte vise.
 * Le superadmin les fait partout. Un MJ seulement :
 * - sur un membre de la campagne d'ou il agit (jamais « un compte qu'il
 *   connait par ailleurs ») ;
 * - sur un compte « tag » (email synthetique) — jamais un compte ordinaire,
 *   qui a son propre email pour se reinitialiser et que personne ne doit
 *   pouvoir emprunter.
 * « Voir comme » reste interdit sur un compte ordinaire, meme au superadmin.
 */

/** Domaines des comptes sans email reel : « tag » (V3.1-10) et ceux crees par lien avant V3.1-10. */
const SYNTHETIC_ACCOUNT_DOMAINS = ["creadonjon.tag", "creadonjon.invite"] as const;

export function isSyntheticAccountEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const domain = email.slice(at + 1).toLowerCase();
  return (SYNTHETIC_ACCOUNT_DOMAINS as readonly string[]).includes(domain);
}

export type MemberAccountAction = "view_as" | "reset_password";

export type MemberAccountDecision = { allowed: true } | { allowed: false; reason: "not_authorized" | "not_a_member" | "ordinary_account" };

export function canActOnMemberAccount(params: {
  action: MemberAccountAction;
  callerIsSuperadmin: boolean;
  /** MJ (administrateur du monde) de la campagne d'ou le geste est fait. */
  callerManagesCampaign: boolean;
  targetIsMember: boolean;
  targetIsSyntheticAccount: boolean;
}): MemberAccountDecision {
  if (!params.targetIsSyntheticAccount && (params.action === "view_as" || !params.callerIsSuperadmin)) {
    return { allowed: false, reason: "ordinary_account" };
  }
  if (params.callerIsSuperadmin) return { allowed: true };
  if (!params.callerManagesCampaign) return { allowed: false, reason: "not_authorized" };
  if (!params.targetIsMember) return { allowed: false, reason: "not_a_member" };
  return { allowed: true };
}
