/**
 * La Gestion de campagne par personne (V3.1-15, esquisse « A — Invitations
 * en haut, une fiche par personne »).
 *
 * `/api/campaigns/[id]` renvoie trois listes plates — membres, personnages
 * attribués, octrois d'édition — et l'ancien écran les affichait telles
 * quelles : au MJ de recouper de tête qui joue quoi et qui peut modifier
 * quoi. Cette fonction les regroupe par personne, sans rien perdre :
 *
 * - une ligne par MJ (son éventuel PJ et ses fiches partagées) ;
 * - une carte par compte joueur (son PJ, ses fiches partagées) ;
 * - à part, les personnages que personne ne tient : PNJ, PJ libérés, et un
 *   personnage resté au nom d'un compte qui n'est plus membre.
 */

export interface CampaignPerson {
  userId: string;
  role: "gm" | "player";
  name: string;
  /** Premier PJ tenu par ce compte, s'il y en a un. */
  pcEntityId: string | null;
  grantedEntityIds: string[];
}

export interface UnclaimedCharacter {
  entityId: string;
  kind: "npc" | "free_pc" | "orphan";
  userId: string | null;
}

export interface CampaignPeople {
  gms: CampaignPerson[];
  players: CampaignPerson[];
  unclaimed: UnclaimedCharacter[];
}

export function groupCampaignPeople(input: {
  members: readonly { user_id: string; role: string }[];
  characters: readonly { entity_id: string; user_id: string | null; is_pc: boolean }[];
  grants: readonly { entity_id: string; user_id: string }[];
  displayNames: Readonly<Record<string, string>>;
}): CampaignPeople {
  const memberIds = new Set(input.members.map((m) => m.user_id));
  const people = input.members.map(
    (m): CampaignPerson => ({
      userId: m.user_id,
      role: m.role === "gm" ? "gm" : "player",
      name: input.displayNames[m.user_id] || "Sans nom",
      pcEntityId: input.characters.find((c) => c.user_id === m.user_id && c.is_pc)?.entity_id ?? null,
      grantedEntityIds: input.grants.filter((g) => g.user_id === m.user_id).map((g) => g.entity_id),
    })
  );

  const unclaimed: UnclaimedCharacter[] = [];
  for (const c of input.characters) {
    if (c.user_id === null) unclaimed.push({ entityId: c.entity_id, kind: c.is_pc ? "free_pc" : "npc", userId: null });
    else if (!memberIds.has(c.user_id)) unclaimed.push({ entityId: c.entity_id, kind: "orphan", userId: c.user_id });
  }

  return {
    gms: people.filter((p) => p.role === "gm"),
    players: people.filter((p) => p.role === "player"),
    unclaimed,
  };
}

/** `Tamara#4821` quand le tag est connu (le MJ de la campagne, ADR 0032), le nom seul sinon. */
export function personLabel(name: string, tag: string | undefined): string {
  return tag ? `${name}#${tag}` : name;
}

/**
 * « Retirer de la campagne » se propose-t-il pour cette personne ? Toujours
 * pour un compte joueur ; pour un MJ, seulement s'il n'est pas le créateur du
 * monde (`worlds.owner_id`) — retirer celui-là reviendrait à transférer le
 * monde, un autre geste. Le serveur refuse de toute façon (migration
 * 20261001130000) : ceci ne fait qu'éviter de proposer un bouton voué à
 * l'échec. Créateur inconnu : aucun MJ proposé, par prudence.
 */
export function canRemoveFromCampaign(person: Pick<CampaignPerson, "userId" | "role">, worldOwnerId: string | null): boolean {
  if (person.role === "player") return true;
  return worldOwnerId !== null && person.userId !== worldOwnerId;
}
