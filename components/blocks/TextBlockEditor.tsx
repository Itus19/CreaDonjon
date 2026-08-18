"use client";

import { useEffect, useState } from "react";
import RichTextEditor from "@/components/entities/richtext/RichTextEditor";
import type { Segment } from "@/src/core/schemas/entities/segments";
import type { TextBlockData } from "@/src/core/schemas/blocks/text";

interface AiProposalItem {
  id: string;
  status: "pending" | "rejected";
  payload: { blockId?: string; text?: string };
  validationErrors: { reason?: string } | null;
}

/**
 * Assistance redactionnelle (V1-F3) : une instruction libre propose un
 * paragraphe via l'IA, jamais ecrit directement — chaque proposition passe
 * par `ai_proposals` (pending), relue ici avec Accepter/Rejeter. "Accepter"
 * ecrit reellement le bloc cote serveur (`POST /api/ai-proposals/[id]/apply`),
 * d'ou `onBlockRefreshed` : la donnee ET la version locales doivent suivre,
 * sinon la prochaine edition manuelle echoue en faux conflit (voir
 * EntityBlocks.tsx, `handleBlockRefreshed`).
 */
export default function TextBlockEditor({
  data,
  onChange,
  entityId,
  blockId,
  onBlockRefreshed,
}: {
  data: TextBlockData;
  onChange: (data: TextBlockData) => void;
  entityId: string;
  blockId: string;
  onBlockRefreshed: (fresh: { id: string; data: unknown; version: number }) => void;
}) {
  const [showAssist, setShowAssist] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [proposing, setProposing] = useState(false);
  const [proposeError, setProposeError] = useState<string | null>(null);
  const [proposals, setProposals] = useState<AiProposalItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  /**
   * `RichTextEditor` capture son contenu Tiptap une seule fois au montage
   * (`useState(() => segmentsToDoc(segments))`, volontaire : un editeur
   * "controle" depuis l'exterieur perdrait le curseur a chaque frappe). Une
   * proposition IA appliquee ecrit `data` par une voie qui contourne cet
   * editeur — sans resynchronisation explicite, le nouveau segment reste
   * invisible tant que la page n'est pas rechargee. Incrementer cette cle
   * force un remontage cible, seulement a ce moment precis, jamais pendant
   * la frappe normale.
   */
  const [remountKey, setRemountKey] = useState(0);

  useEffect(() => {
    if (!showAssist) return;
    fetch(`/api/entities/${entityId}/ai-proposals`)
      .then((res) => (res.ok ? res.json() : []))
      .then((all: AiProposalItem[]) => setProposals(all.filter((p) => p.payload?.blockId === blockId)))
      .catch(() => {});
  }, [showAssist, entityId, blockId]);

  async function handlePropose() {
    if (!instruction.trim()) return;
    setProposing(true);
    setProposeError(null);

    const res = await fetch(`/api/blocks/${blockId}/writing-assist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instruction: instruction.trim() }),
    });

    setProposing(false);
    if (!res.ok) {
      setProposeError("Impossible de contacter le fournisseur IA local.");
      return;
    }
    const created = (await res.json()) as AiProposalItem[];
    setProposals((prev) => [...created, ...prev]);
    setInstruction("");
  }

  async function handleApply(proposalId: string) {
    setBusyId(proposalId);
    const res = await fetch(`/api/ai-proposals/${proposalId}/apply`, { method: "POST" });
    if (res.ok) {
      const blocksRes = await fetch(`/api/entities/${entityId}/blocks`);
      if (blocksRes.ok) {
        const freshBlocks = (await blocksRes.json()) as Array<{ id: string; data: unknown; version: number }>;
        const fresh = freshBlocks.find((b) => b.id === blockId);
        if (fresh) {
          onBlockRefreshed(fresh);
          setRemountKey((k) => k + 1);
        }
      }
      setProposals((prev) => prev.filter((p) => p.id !== proposalId));
    }
    setBusyId(null);
  }

  async function handleReject(proposalId: string) {
    setBusyId(proposalId);
    const res = await fetch(`/api/ai-proposals/${proposalId}/reject`, { method: "POST" });
    if (res.ok) setProposals((prev) => prev.filter((p) => p.id !== proposalId));
    setBusyId(null);
  }

  const pending = proposals.filter((p) => p.status === "pending");
  const rejected = proposals.filter((p) => p.status === "rejected");

  return (
    <div className="flex flex-col gap-2">
      <RichTextEditor key={remountKey} segments={data.segments} onChange={(segments: Segment[]) => onChange({ __v: 1, segments })} />

      <div className="flex flex-col gap-1.5 rounded-md border border-edge/50 bg-panel-sunken p-2">
        <button
          type="button"
          onClick={() => setShowAssist((v) => !v)}
          className="self-start text-xs font-medium text-ink-muted transition-colors hover:text-ink"
        >
          {showAssist ? "▾" : "▸"} Assistance IA
        </button>

        {showAssist && (
          <div className="flex flex-col gap-2">
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="ex. Ajoute un paragraphe décrivant l'ambiance de ce lieu."
              rows={2}
              className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-xs text-ink outline-none"
            />
            <button
              type="button"
              onClick={handlePropose}
              disabled={proposing || !instruction.trim()}
              className="self-start rounded-full border border-edge px-3 py-1 text-xs font-medium text-ink transition-colors hover:bg-panel disabled:opacity-50"
            >
              {proposing ? "Génération…" : "Proposer"}
            </button>
            {proposeError && <p className="text-xs text-danger">{proposeError}</p>}

            {pending.map((p) => (
              <div key={p.id} className="flex flex-col gap-1.5 rounded-md border border-accent/30 bg-accent/5 p-2 text-xs">
                <p className="text-ink">{p.payload.text}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleApply(p.id)}
                    disabled={busyId === p.id}
                    className="rounded-full bg-accent px-2.5 py-1 font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
                  >
                    Accepter
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReject(p.id)}
                    disabled={busyId === p.id}
                    className="rounded-full border border-edge px-2.5 py-1 text-ink transition-colors hover:bg-panel disabled:opacity-50"
                  >
                    Rejeter
                  </button>
                </div>
              </div>
            ))}

            {rejected.map((p) => (
              <p key={p.id} className="text-xs italic text-ink-muted">
                Proposition rejetée{p.validationErrors?.reason === "budget_exceeded" ? " (limite de propositions par tour atteinte)" : ""}.
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
