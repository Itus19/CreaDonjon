"use client";

import { useEffect, useState } from "react";
import Dropdown from "@/components/shared/Dropdown";

interface MemberRow {
  campaign_id: string;
  user_id: string;
  role: string;
  joined_at: string;
}
interface CharacterRow {
  campaign_id: string;
  entity_id: string;
  user_id: string | null;
  is_pc: boolean;
}
interface GrantRow {
  entity_id: string;
  user_id: string;
  granted_by: string;
  granted_at: string;
}
interface CampaignDetailData {
  members: MemberRow[];
  characters: CharacterRow[];
  grants: GrantRow[];
  rulesetContentOrigin: string | null;
  /** V2-M9 (Lot M) : nom affichable par id de compte — l'uuid brut ne dit rien a personne dans "voir qui a deja quoi". */
  displayNames: Record<string, string>;
}

/** V1-D5, specs/ruleset-personnel.md §3.1 : une table de jeu ordinaire (4-6 joueurs + MJ) reste bien en-deca — au-dela, un rappel plus explicite, jamais un refus. */
const PERSONAL_REFERENCE_CIRCLE_SOFT_CAP = 7;

/** Detail d'une campagne (V1-C1) : membres + personnages attribues, invitation par email, attribution d'un personnage. Charge a l'ouverture (jamais en avance — une campagne repliee ne coute rien). */
export default function CampaignDetail({
  campaignId,
  worldEntities,
  grantableEntities,
  canManage,
}: {
  campaignId: string;
  worldEntities: { id: string; name: string }[];
  /** V2-M9 (Lot M) : toutes les fiches du monde, pour "Octrois d'edition" — distinct de `worldEntities` (personnages seulement, "Personnages attribues"). */
  grantableEntities: { id: string; name: string }[];
  /** V2-M7 (Lot M) : revocation de fiche PJ et octrois d'edition reserves au MJ reel de ce monde — deja verifie cote serveur par la page appelante (`isWorldAdmin`), cette prop cache seulement des actions qui echoueraient toujours pour un simple joueur. */
  canManage: boolean;
}) {
  const [data, setData] = useState<CampaignDetailData | null>(null);
  const [email, setEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [grantEntityId, setGrantEntityId] = useState("");
  const [grantUserId, setGrantUserId] = useState("");
  const [grantError, setGrantError] = useState<string | null>(null);

  function reload() {
    fetch(`/api/campaigns/${campaignId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          body: {
            members: MemberRow[];
            characters: CharacterRow[];
            grants: GrantRow[];
            rulesetContentOrigin: string | null;
            displayNames: Record<string, string>;
          } | null
        ) => {
          if (body) {
            setData({
              members: body.members,
              characters: body.characters,
              grants: body.grants,
              rulesetContentOrigin: body.rulesetContentOrigin,
              displayNames: body.displayNames,
            });
          }
        }
      )
      .catch(() => {});
  }

  useEffect(reload, [campaignId]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError(null);
    const res = await fetch(`/api/campaigns/${campaignId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role: "player" }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setInviteError(body?.error ?? "Échec de l'invitation.");
      return;
    }
    setEmail("");
    reload();
  }

  async function assignCharacter() {
    if (!selectedEntityId) return;
    const userId = selectedUserId || null;
    await fetch(`/api/campaigns/${campaignId}/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityId: selectedEntityId, userId, isPc: userId !== null }),
    });
    setSelectedEntityId("");
    setSelectedUserId("");
    reload();
  }

  /**
   * Revocation d'une fiche PJ (V2-M7, Lot M) : jamais le meme geste que
   * "PNJ (sans joueur)" ci-dessus — `isPc` reste `true` pour que la fiche
   * redevienne selectionnable par un NOUVEAU joueur (meme etat que juste
   * apres la creation de la campagne, `is_pc: true, user_id: null`, filtre
   * par `accountProvisioning.ts` pour la liste des personnages disponibles
   * a la reclamation). Reutilise le meme endpoint que l'attribution, RLS
   * (`campaign_characters_write`, is_world_admin) est deja le seul gate
   * necessaire ici — meme choix deliberement documente que dans
   * `assignCampaignCharacter` (aucun second controle cote service).
   */
  async function revokeCharacterClaim(entityId: string) {
    await fetch(`/api/campaigns/${campaignId}/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityId, userId: null, isPc: true }),
    });
    reload();
  }

  async function grantAccess() {
    if (!grantEntityId || !grantUserId) return;
    setGrantError(null);
    const res = await fetch(`/api/entities/${grantEntityId}/grants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: grantUserId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setGrantError(body?.error ?? "Échec de l'octroi.");
      return;
    }
    setGrantEntityId("");
    setGrantUserId("");
    reload();
  }

  async function revokeAccess(entityId: string, userId: string) {
    await fetch(`/api/entities/${entityId}/grants/${userId}`, { method: "DELETE" });
    reload();
  }

  if (!data) return <p className="text-xs text-ink-muted">Chargement…</p>;

  const displayName = (userId: string) => data.displayNames[userId] || userId;
  const memberOptions = [
    { value: "", label: "PNJ (sans joueur)" },
    ...data.members.map((m) => ({ value: m.user_id, label: `${m.role} — ${displayName(m.user_id)}` })),
  ];
  const entityOptions = [
    { value: "", label: "Choisir un personnage…" },
    ...worldEntities.map((e) => ({ value: e.id, label: e.name })),
  ];
  const grantEntityOptions = [
    { value: "", label: "Choisir une fiche…" },
    ...grantableEntities.map((e) => ({ value: e.id, label: e.name })),
  ];
  const grantMemberOptions = [
    { value: "", label: "Choisir un joueur…" },
    ...data.members.filter((m) => m.role === "player").map((m) => ({ value: m.user_id, label: displayName(m.user_id) })),
  ];

  return (
    <div className="flex flex-col gap-3 border-t border-edge/60 pt-3 text-sm">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Membres</span>
        <ul className="flex flex-col gap-1 text-xs">
          {data.members.map((m) => (
            <li key={m.user_id}>
              {m.role} — {displayName(m.user_id)}
            </li>
          ))}
        </ul>
        {data.rulesetContentOrigin === "personal_reference" && (
          <>
            {/* Rappel explicite du cadre (V1-D5, specs/ruleset-personnel.md §3.1) :
                l'invitation reste AUTORISEE — c'est le cercle prive vise, jamais un
                refus — seul un rappel visible avant d'inviter. Meme couleur que le
                badge de fiche (--danger), meme signification : attention, pas blocage. */}
            <p className="mt-2 text-xs text-danger">
              Cette campagne utilise un ruleset de référence personnelle : les membres invités pourront consulter les
              fiches en session, mais ne pourront jamais les exporter ni en repartir avec une copie.
            </p>
            {/* Plafond souple (§3.1 : "un plafond souple sur le nombre de
                membres... suffit a materialiser le cercle. Pas de refus
                brutal — un avertissement explicite.") — jamais un blocage,
                juste un rappel qui se renforce au-dela d'une table de jeu
                ordinaire (4-6 joueurs + MJ). */}
            {data.members.length > PERSONAL_REFERENCE_CIRCLE_SOFT_CAP && (
              <p className="mt-1 text-xs text-danger">
                {data.members.length} membres : au-delà d’une table de jeu, ce n’est plus le cercle privé visé par une
                référence personnelle.
              </p>
            )}
          </>
        )}
        <form onSubmit={invite} className="mt-2 flex items-center gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="courriel du joueur"
            className="flex-1 rounded-md border border-edge bg-transparent px-2 py-1 text-xs text-ink outline-none"
          />
          <button type="submit" className="rounded-full border border-edge px-3 py-1 text-xs text-ink hover:bg-panel-raised">
            Inviter
          </button>
        </form>
        {inviteError && <p className="text-xs text-danger">{inviteError}</p>}
      </div>

      <div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Personnages attribués</span>
        <ul className="flex flex-col gap-1 text-xs">
          {data.characters.map((c) => {
            const entity = worldEntities.find((e) => e.id === c.entity_id);
            return (
              <li key={c.entity_id} className="flex items-center justify-between gap-2">
                <span>
                  {/* Etiquette PJ/PNJ derivee de is_pc (V1-C4, jamais un
                      entity_kind distinct — un PNJ peut devenir un PJ) */}
                  {entity?.name ?? c.entity_id} — {c.is_pc ? "PJ" : "PNJ"}
                  {c.user_id ? ` (${displayName(c.user_id)})` : ""}
                </span>
                {c.user_id && canManage && (
                  <button
                    type="button"
                    onClick={() => revokeCharacterClaim(c.entity_id)}
                    className="shrink-0 text-danger hover:underline"
                  >
                    Révoquer
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Dropdown
            value={selectedEntityId}
            onChange={setSelectedEntityId}
            options={entityOptions}
            aria-label="Personnage"
            className="flex-1 rounded-md border border-edge bg-transparent px-2 py-1 text-xs text-ink outline-none transition-colors hover:bg-panel-raised"
          />
          <Dropdown
            value={selectedUserId}
            onChange={setSelectedUserId}
            options={memberOptions}
            aria-label="Joueur"
            className="rounded-md border border-edge bg-transparent px-2 py-1 text-xs text-ink outline-none transition-colors hover:bg-panel-raised"
          />
          <button
            type="button"
            onClick={assignCharacter}
            className="rounded-full border border-edge px-3 py-1 text-xs text-ink hover:bg-panel-raised"
          >
            Attribuer
          </button>
        </div>
      </div>

      {canManage && (
      <div>
        {/* Octrois d'edition (V2-M7, elargi V2-M9 a toute fiche du monde,
            retour utilisateur : "un outil... qui reference ainsi TOUT les
            octrois d'edition") : accorder l'edition d'une fiche precise a un
            joueur SANS la lui attribuer comme PJ — cas d'usage distinct de
            "Personnages attribues" ci-dessus (ex. laisser un joueur editer
            une fiche partagee du groupe). `entity_grants` existe depuis
            V2-M3. Section entiere reservee au MJ (`canManage`) : lecture
            comprise, un joueur n'a pas besoin de voir qui a quel octroi. */}
        <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Octrois d&apos;édition</span>
        <ul className="flex flex-col gap-1 text-xs">
          {data.grants.length === 0 && <li className="text-ink-muted">Aucun octroi pour l&apos;instant.</li>}
          {data.grants.map((g) => {
            const entity = grantableEntities.find((e) => e.id === g.entity_id);
            return (
              <li key={`${g.entity_id}-${g.user_id}`} className="flex items-center justify-between gap-2">
                <span>
                  {entity?.name ?? g.entity_id} — {displayName(g.user_id)}
                </span>
                <button
                  type="button"
                  onClick={() => revokeAccess(g.entity_id, g.user_id)}
                  className="shrink-0 text-danger hover:underline"
                >
                  Retirer
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Dropdown
            value={grantEntityId}
            onChange={setGrantEntityId}
            options={grantEntityOptions}
            aria-label="Fiche"
            className="flex-1 rounded-md border border-edge bg-transparent px-2 py-1 text-xs text-ink outline-none transition-colors hover:bg-panel-raised"
          />
          <Dropdown
            value={grantUserId}
            onChange={setGrantUserId}
            options={grantMemberOptions}
            aria-label="Joueur"
            className="rounded-md border border-edge bg-transparent px-2 py-1 text-xs text-ink outline-none transition-colors hover:bg-panel-raised"
          />
          <button
            type="button"
            onClick={grantAccess}
            disabled={!grantEntityId || !grantUserId}
            className="rounded-full border border-edge px-3 py-1 text-xs text-ink hover:bg-panel-raised disabled:opacity-50"
          >
            Accorder
          </button>
        </div>
        {grantError && <p className="mt-1 text-xs text-danger">{grantError}</p>}
      </div>
      )}
    </div>
  );
}
