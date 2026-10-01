"use client";

import { useState } from "react";
import Dropdown from "@/components/shared/Dropdown";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import ActionsMenu, { type ActionsMenuItem } from "@/components/shared/ActionsMenu";
import InviteLinkPanel from "./InviteLinkPanel";
import { useCachedGet } from "./useCachedGet";
import { groupCampaignPeople, personLabel, type CampaignPerson } from "@/src/core/campaigns/people";

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
  /** V3.1-10 : horodatage d'une demande "mot de passe oublié" en attente, par id de compte — absent = aucune demande. */
  passwordResetRequests: Record<string, string>;
  /** V3.1-15 (ADR 0032) : tag à 4 chiffres par compte — renvoyé SEULEMENT au MJ du monde, vide pour quiconque d'autre. */
  handleTags?: Record<string, string>;
}

/** V1-D5, specs/ruleset-personnel.md §3.1 : une table de jeu ordinaire (4-6 joueurs + MJ) reste bien en-deca — au-dela, un rappel plus explicite, jamais un refus. */
const PERSONAL_REFERENCE_CIRCLE_SOFT_CAP = 7;

const dropdownTrigger = "rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none transition-colors hover:bg-panel-raised";
const smallButton = "rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50";

type Confirming = { kind: "remove_member"; userId: string } | { kind: "free_character"; entityId: string; userId: string } | null;

/**
 * La Gestion de campagne (V1-C1, refaite V3.1-15 d'après l'esquisse « A —
 * Invitations en haut, une fiche par personne », retenue par l'auteur le 1ᵉʳ
 * octobre) :
 *
 * 1. le panneau **Invitations** (`InviteLinkPanel`) ;
 * 2. **les MJ sur une ligne** — un MJ peut déjà tout modifier, une carte
 *    entière serait du bruit ;
 * 3. **une carte par compte joueur** : son PJ, les fiches qu'il peut aussi
 *    modifier, et le menu ⋮ du compte ;
 * 4. à part, **les personnages que personne ne tient** (PNJ, PJ libérés).
 *
 * Chaque geste de l'ancien écran garde une place, et une seule. « Révoquer »
 * ne veut plus dire deux choses : « Retirer de la campagne » (le compte) et
 * « Libérer le personnage » (la fiche) sont deux gestes distincts, chacun
 * confirmé. Le tag à 4 chiffres suit le nom partout dans cet écran quand le
 * serveur l'a envoyé (au MJ seulement, ADR 0032).
 */
export default function CampaignDetail({
  campaignId,
  worldEntities,
  grantableEntities,
  canManage,
}: {
  campaignId: string;
  worldEntities: { id: string; name: string }[];
  /** V2-M9 (Lot M) : toutes les fiches du monde, pour les fiches partagées — distinct de `worldEntities` (personnages seulement). */
  grantableEntities: { id: string; name: string }[];
  /** V2-M7 (Lot M) : gestes reserves au MJ reel de ce monde — deja verifie cote serveur par la page appelante (`isWorldAdmin`), cette prop cache seulement des actions qui echoueraient toujours pour un simple joueur. */
  canManage: boolean;
}) {
  // `useCachedGet` (retour utilisateur : "elle a l'air de se recharger a
  // chaque changement d'onglet") — evite le flash "Chargement..." quand ce
  // composant remonte a chaque bascule de section (Monde/Regles/MJ).
  const { data, reload } = useCachedGet<CampaignDetailData>(`campaignDetail:${campaignId}`, `/api/campaigns/${campaignId}`);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [resetLinkByUserId, setResetLinkByUserId] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  /** Compte dont la zone « attribuer un PJ » ou « partager une fiche » est ouverte. */
  const [openPicker, setOpenPicker] = useState<{ userId: string; kind: "pc" | "grant" } | null>(null);
  const [pickedEntityId, setPickedEntityId] = useState("");
  const [npcEntityId, setNpcEntityId] = useState("");
  const [npcOwnerId, setNpcOwnerId] = useState("");

  async function inviteByEmail(email: string, role: "gm" | "player"): Promise<string | null> {
    const res = await fetch(`/api/campaigns/${campaignId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return body?.error ?? "Échec de l'invitation.";
    }
    reload();
    return null;
  }

  /** Attribue un personnage (V1-C1) : à un compte → PJ ; sans compte → PNJ de la campagne. Même endpoint qu'avant. */
  async function assignCharacter(entityId: string, userId: string | null) {
    setError(null);
    const res = await fetch(`/api/campaigns/${campaignId}/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityId, userId, isPc: userId !== null }),
    });
    if (!res.ok) setError("Échec de l'attribution du personnage.");
    reload();
  }

  /**
   * Libere une fiche PJ (V2-M7) : `isPc` reste `true` pour que la fiche
   * redevienne selectionnable par un NOUVEAU joueur (meme etat que juste
   * apres la creation de la campagne, `is_pc: true, user_id: null`). La RLS
   * (`campaign_characters_write`, is_world_admin) est le seul gate necessaire.
   */
  async function freeCharacter(entityId: string) {
    setError(null);
    const res = await fetch(`/api/campaigns/${campaignId}/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityId, userId: null, isPc: true }),
    });
    if (!res.ok) setError("Échec de la libération du personnage.");
    reload();
  }

  async function grantAccess(entityId: string, userId: string) {
    setError(null);
    const res = await fetch(`/api/entities/${entityId}/grants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Échec du partage de la fiche.");
    }
    reload();
  }

  async function revokeAccess(entityId: string, userId: string) {
    setError(null);
    const res = await fetch(`/api/entities/${entityId}/grants/${userId}`, { method: "DELETE" });
    if (!res.ok) setError("Échec du retrait de l'accès.");
    reload();
  }

  /** Retire un membre de la campagne (V3.1-10) : libere son personnage, jamais le lien qui l'a fait rejoindre (ADR 0031). */
  async function removeMember(userId: string) {
    setError(null);
    const res = await fetch(`/api/campaigns/${campaignId}/members/${userId}`, { method: "DELETE" });
    if (!res.ok) setError("Échec du retrait de la campagne.");
    reload();
  }

  /** "Forcer une réinitialisation" (V3.1-10, ADR 0031 §5) : un jeton à usage unique, remis à la personne hors application. */
  async function forceResetPassword(userId: string) {
    setError(null);
    const res = await fetch(`/api/campaigns/${campaignId}/members/${userId}/reset-password`, { method: "POST" });
    if (!res.ok) {
      setError("Échec de la génération du lien.");
      return;
    }
    const body = (await res.json()) as { url: string };
    setResetLinkByUserId((prev) => ({ ...prev, [userId]: `${window.location.origin}${body.url}` }));
  }

  if (!data) return <p className="text-xs text-ink-muted">Chargement…</p>;

  const tags = data.handleTags ?? {};
  const people = groupCampaignPeople({ members: data.members, characters: data.characters, grants: data.grants, displayNames: data.displayNames });
  const labelOf = (userId: string) => personLabel(data.displayNames[userId] || "Sans nom", tags[userId]);
  const entityName = (id: string) => grantableEntities.find((e) => e.id === id)?.name ?? worldEntities.find((e) => e.id === id)?.name ?? "Fiche inconnue";
  // Un personnage déjà tenu par un compte ne se propose plus. Un PNJ, lui,
  // peut encore devenir le PJ d'une joueuse (geste de l'ancien écran, gardé).
  const heldIds = new Set(data.characters.filter((c) => c.user_id !== null).map((c) => c.entity_id));
  const npcIds = new Set(data.characters.filter((c) => c.user_id === null && !c.is_pc).map((c) => c.entity_id));
  const pcCandidates = worldEntities.filter((e) => !heldIds.has(e.id));
  const npcCandidates = pcCandidates.filter((e) => !npcIds.has(e.id));

  function openPickerFor(userId: string, kind: "pc" | "grant") {
    setPickedEntityId("");
    setOpenPicker({ userId, kind });
  }

  function personActions(person: CampaignPerson): ActionsMenuItem[] {
    return [
      { label: "Forcer une réinitialisation", onSelect: () => void forceResetPassword(person.userId) },
      // Retirer un MJ n'est pas ce geste (transfert de campagne, hors
      // perimetre) — seuls les comptes joueurs se retirent ici.
      ...(person.role === "player" ? [{ label: "Retirer de la campagne", onSelect: () => setConfirming({ kind: "remove_member", userId: person.userId }), danger: true }] : []),
    ];
  }

  function grantChips(person: CampaignPerson) {
    return person.grantedEntityIds.map((entityId) => (
      <span key={entityId} className="inline-flex items-center gap-1 rounded-full border border-edge bg-panel-raised py-0.5 pl-2.5 pr-1 text-sm text-ink">
        {entityName(entityId)}
        {canManage && (
          <button
            type="button"
            onClick={() => void revokeAccess(entityId, person.userId)}
            aria-label={`Retirer à ${labelOf(person.userId)} l'accès à ${entityName(entityId)}`}
            className="grid h-6 w-6 place-items-center rounded-full text-ink-muted hover:bg-panel hover:text-danger"
          >
            ×
          </button>
        )}
      </span>
    ));
  }

  function picker(person: CampaignPerson) {
    if (!openPicker || openPicker.userId !== person.userId) return null;
    const options =
      openPicker.kind === "pc"
        ? pcCandidates
        : grantableEntities.filter((e) => !person.grantedEntityIds.includes(e.id) && e.id !== person.pcEntityId);
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Dropdown
          value={pickedEntityId}
          onChange={setPickedEntityId}
          options={[{ value: "", label: openPicker.kind === "pc" ? "Choisir un personnage…" : "Choisir une fiche…" }, ...options.map((e) => ({ value: e.id, label: e.name }))]}
          aria-label={openPicker.kind === "pc" ? `Personnage à attribuer à ${labelOf(person.userId)}` : `Fiche à partager avec ${labelOf(person.userId)}`}
          triggerClassName={`min-w-0 flex-1 ${dropdownTrigger}`}
        />
        <button
          type="button"
          disabled={!pickedEntityId}
          onClick={() => {
            if (openPicker.kind === "pc") void assignCharacter(pickedEntityId, person.userId);
            else void grantAccess(pickedEntityId, person.userId);
            setOpenPicker(null);
          }}
          className={smallButton}
        >
          {openPicker.kind === "pc" ? "Attribuer" : "Partager"}
        </button>
        <button type="button" onClick={() => setOpenPicker(null)} className="text-xs text-ink-muted hover:underline">
          Fermer
        </button>
      </div>
    );
  }

  function resetLink(userId: string) {
    if (!resetLinkByUserId[userId]) return null;
    return (
      <p className="rounded-md border border-edge bg-panel-sunken px-2 py-1 text-xs text-ink-muted">
        Lien à usage unique, à transmettre hors application : <span className="break-all text-ink">{resetLinkByUserId[userId]}</span>
      </p>
    );
  }

  const notice =
    data.rulesetContentOrigin === "personal_reference" ? (
      <div className="flex flex-col gap-1">
        {/* Rappel explicite du cadre (V1-D5, specs/ruleset-personnel.md §3.1) :
            l'invitation reste AUTORISEE — seul un rappel visible avant d'inviter. */}
        <p className="text-xs text-danger">
          Cette campagne utilise un ruleset de référence personnelle : les membres invités pourront consulter les fiches en session,
          mais ne pourront jamais les exporter ni en repartir avec une copie.
        </p>
        {data.members.length > PERSONAL_REFERENCE_CIRCLE_SOFT_CAP && (
          <p className="text-xs text-danger">
            {data.members.length} membres : au-delà d’une table de jeu, ce n’est plus le cercle privé visé par une référence personnelle.
          </p>
        )}
      </div>
    ) : undefined;

  const confirmingLabel = confirming ? labelOf(confirming.userId) : "";

  return (
    <div className="flex flex-col gap-5 border-t border-edge/60 pt-4 text-sm">
      {canManage && <InviteLinkPanel campaignId={campaignId} onEmailInvite={inviteByEmail} notice={notice} />}
      {error && <p className="text-xs text-danger">{error}</p>}

      {/* Les MJ sur une ligne : un MJ peut deja tout modifier. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-lg text-ink">À la table</h3>
        <div className="flex flex-wrap items-center gap-4">
          {people.gms.map((gm) => (
            <div key={gm.userId} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-panel-raised text-xs font-semibold text-ink">{gm.name.charAt(0).toUpperCase()}</span>
                <span className="text-ink">
                  {gm.name}
                  {tags[gm.userId] && <span className="text-ink-muted tabular-nums">#{tags[gm.userId]}</span>}
                </span>
                <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-semibold text-accent">MJ</span>
                {gm.pcEntityId && <span className="text-xs text-ink-muted">joue {entityName(gm.pcEntityId)}</span>}
                {gm.grantedEntityIds.length > 0 && (
                  <span className="text-xs text-ink-muted">peut aussi modifier : {gm.grantedEntityIds.map(entityName).join(", ")}</span>
                )}
                {data.passwordResetRequests[gm.userId] && <span className="text-xs text-accent">· mot de passe oublié</span>}
                {canManage && <ActionsMenu items={personActions(gm)} aria-label={`Actions sur le compte de ${labelOf(gm.userId)}`} />}
              </div>
              {resetLink(gm.userId)}
            </div>
          ))}
        </div>
      </div>

      {people.players.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-edge p-5 text-center text-sm text-ink-muted">
          Aucune joueuse pour l&apos;instant : génère un lien joueur ci-dessus et envoie-le à ta table.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {people.players.map((player) => (
            <div key={player.userId} className="flex flex-col gap-3 rounded-[14px] border border-edge bg-panel p-4">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-panel-raised font-semibold text-ink">{player.name.charAt(0).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-ink">
                    {player.name}
                    {tags[player.userId] && <span className="font-normal text-ink-muted tabular-nums">#{tags[player.userId]}</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-panel-raised px-2 py-0.5 text-xs font-semibold text-ink">Joueur</span>
                    {data.passwordResetRequests[player.userId] && (
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent" title="A demandé un nouveau mot de passe">
                        mot de passe oublié
                      </span>
                    )}
                  </div>
                </div>
                {canManage && <ActionsMenu items={personActions(player)} aria-label={`Actions sur le compte de ${labelOf(player.userId)}`} />}
              </div>
              {resetLink(player.userId)}

              {player.pcEntityId ? (
                <div className="flex items-center gap-2 rounded-[10px] border border-accent/55 bg-accent/10 px-3 py-2 text-ink">
                  <span className="text-xs text-accent">Joue</span>
                  <strong className="min-w-0 flex-1 truncate">{entityName(player.pcEntityId)}</strong>
                  {canManage && (
                    <ActionsMenu
                      items={[{ label: "Libérer le personnage", onSelect: () => setConfirming({ kind: "free_character", entityId: player.pcEntityId as string, userId: player.userId }), danger: true }]}
                      aria-label={`Actions sur le personnage de ${labelOf(player.userId)}`}
                    />
                  )}
                </div>
              ) : canManage ? (
                <button
                  type="button"
                  onClick={() => openPickerFor(player.userId, "pc")}
                  className="rounded-[10px] border border-dashed border-edge px-3 py-2 text-left text-sm text-ink-muted hover:bg-panel-raised"
                >
                  Aucun personnage — <span className="text-accent">attribuer un PJ</span>
                </button>
              ) : (
                <p className="text-sm text-ink-muted">Aucun personnage.</p>
              )}
              {openPicker?.userId === player.userId && openPicker.kind === "pc" && picker(player)}

              {canManage && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Peut aussi modifier</span>
                  <div className="flex flex-wrap gap-1.5">
                    {player.grantedEntityIds.length === 0 ? <span className="text-xs text-ink-muted">Aucune fiche partagée.</span> : grantChips(player)}
                  </div>
                  {openPicker?.userId === player.userId && openPicker.kind === "grant" ? (
                    picker(player)
                  ) : (
                    <button type="button" onClick={() => openPickerFor(player.userId, "grant")} className={`self-start ${smallButton}`}>
                      + Partager une fiche
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <section className="flex flex-col gap-2.5 rounded-[10px] border border-edge bg-panel-sunken p-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Personnages sans joueur</span>
        <div className="flex flex-wrap gap-1.5">
          {people.unclaimed.length === 0 && <span className="text-xs text-ink-muted">Aucun.</span>}
          {people.unclaimed.map((c) => (
            <span key={c.entityId} className="inline-flex items-center gap-1.5 rounded-full border border-edge bg-panel-raised px-2.5 py-0.5 text-sm text-ink">
              {entityName(c.entityId)}
              <span className="text-xs text-ink-muted">
                {c.kind === "npc" ? "PNJ" : c.kind === "free_pc" ? "PJ libre" : `tenu par ${data.displayNames[c.userId ?? ""] || "un ancien membre"}`}
              </span>
            </span>
          ))}
        </div>
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <Dropdown
              value={npcEntityId}
              onChange={setNpcEntityId}
              options={[{ value: "", label: "Choisir un personnage…" }, ...npcCandidates.map((e) => ({ value: e.id, label: e.name }))]}
              aria-label="Personnage à ajouter à la campagne"
              triggerClassName={`min-w-0 flex-1 ${dropdownTrigger}`}
            />
            {/* Un personnage sans joueur, ou tenu par un MJ : les joueuses,
                elles, reçoivent le leur depuis leur carte. */}
            <Dropdown
              value={npcOwnerId}
              onChange={setNpcOwnerId}
              options={[{ value: "", label: "PNJ (sans joueur)" }, ...people.gms.map((gm) => ({ value: gm.userId, label: `MJ — ${labelOf(gm.userId)}` }))]}
              aria-label="À qui le confier"
              triggerClassName={dropdownTrigger}
            />
            <button
              type="button"
              disabled={!npcEntityId}
              onClick={() => {
                void assignCharacter(npcEntityId, npcOwnerId || null);
                setNpcEntityId("");
                setNpcOwnerId("");
              }}
              className={smallButton}
            >
              Ajouter
            </button>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirming?.kind === "remove_member"}
        title={`Retirer ${confirmingLabel} de la campagne ?`}
        message={`${confirmingLabel} perd l'accès à cette campagne et son personnage redevient libre. Le compte et le lien d'invitation qui l'a fait rejoindre restent inchangés — un lien joueur réutilisable continue de fonctionner pour d'autres.`}
        confirmLabel="Retirer de la campagne"
        danger
        onConfirm={() => {
          if (confirming?.kind === "remove_member") void removeMember(confirming.userId);
          setConfirming(null);
        }}
        onCancel={() => setConfirming(null)}
      />
      <ConfirmDialog
        open={confirming?.kind === "free_character"}
        title="Libérer le personnage ?"
        message={
          confirming?.kind === "free_character"
            ? `${entityName(confirming.entityId)} redevient libre : une autre joueuse pourra le réclamer. ${confirmingLabel} garde son accès à la campagne.`
            : ""
        }
        confirmLabel="Libérer"
        danger
        onConfirm={() => {
          if (confirming?.kind === "free_character") void freeCharacter(confirming.entityId);
          setConfirming(null);
        }}
        onCancel={() => setConfirming(null)}
      />
    </div>
  );
}
