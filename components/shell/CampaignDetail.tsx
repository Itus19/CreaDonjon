"use client";

import { useEffect, useState } from "react";
import PartyProbabilityTable from "./PartyProbabilityTable";

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
interface CampaignDetailData {
  members: MemberRow[];
  characters: CharacterRow[];
  rulesetContentOrigin: string | null;
}

/** V1-D5, specs/ruleset-personnel.md §3.1 : une table de jeu ordinaire (4-6 joueurs + MJ) reste bien en-deca — au-dela, un rappel plus explicite, jamais un refus. */
const PERSONAL_REFERENCE_CIRCLE_SOFT_CAP = 7;

/** Detail d'une campagne (V1-C1) : membres + personnages attribues, invitation par email, attribution d'un personnage. Charge a l'ouverture (jamais en avance — une campagne repliee ne coute rien). */
export default function CampaignDetail({
  campaignId,
  worldEntities,
}: {
  campaignId: string;
  worldEntities: { id: string; name: string }[];
}) {
  const [data, setData] = useState<CampaignDetailData | null>(null);
  const [email, setEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");

  function reload() {
    fetch(`/api/campaigns/${campaignId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { members: MemberRow[]; characters: CharacterRow[]; rulesetContentOrigin: string | null } | null) => {
        if (body) setData({ members: body.members, characters: body.characters, rulesetContentOrigin: body.rulesetContentOrigin });
      })
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

  if (!data) return <p className="text-xs text-ink-muted">Chargement…</p>;

  return (
    <div className="flex flex-col gap-3 border-t border-edge/60 pt-3 text-sm">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Membres</span>
        <ul className="flex flex-col gap-1 text-xs">
          {data.members.map((m) => (
            <li key={m.user_id}>
              {m.role} — {m.user_id}
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
              <li key={c.entity_id}>
                {/* Etiquette PJ/PNJ derivee de is_pc (V1-C4, jamais un
                    entity_kind distinct — un PNJ peut devenir un PJ) */}
                {entity?.name ?? c.entity_id} — {c.is_pc ? "PJ" : "PNJ"}
                {c.user_id ? ` (${c.user_id})` : ""}
              </li>
            );
          })}
        </ul>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={selectedEntityId}
            onChange={(e) => setSelectedEntityId(e.target.value)}
            className="flex-1 rounded-md border border-edge bg-transparent px-2 py-1 text-xs text-ink outline-none"
          >
            <option value="">Choisir un personnage…</option>
            {worldEntities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="rounded-md border border-edge bg-transparent px-2 py-1 text-xs text-ink outline-none"
          >
            <option value="">PNJ (sans joueur)</option>
            {data.members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.role} — {m.user_id}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={assignCharacter}
            className="rounded-full border border-edge px-3 py-1 text-xs text-ink hover:bg-panel-raised"
          >
            Attribuer
          </button>
        </div>
      </div>

      <PartyProbabilityTable campaignId={campaignId} />
    </div>
  );
}
