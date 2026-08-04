"use client";

import { useEffect, useState } from "react";

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
}

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
      .then((body: { members: MemberRow[]; characters: CharacterRow[] } | null) => {
        if (body) setData({ members: body.members, characters: body.characters });
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
                {entity?.name ?? c.entity_id} {c.user_id ? `→ ${c.user_id}` : "(PNJ)"}
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
    </div>
  );
}
