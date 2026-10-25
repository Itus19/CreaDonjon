"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import RichTextEditor from "@/components/entities/richtext/RichTextEditor";
import type { Segment } from "@/src/core/schemas/entities/segments";
import type { TextBlockData } from "@/src/core/schemas/blocks/text";
import type { OtherEntityOption } from "@/components/entities/RelationsChips";
import { assistanceTexte, type PropositionIa } from "@/lib/ui/assistanceTexte";

/**
 * Assistance redactionnelle (V1-F3) : une instruction libre propose un
 * paragraphe via l'IA, jamais ecrit directement — chaque proposition passe
 * par `ai_proposals` (pending), relue ici avec Accepter/Refuser. "Accepter"
 * ecrit reellement le bloc cote serveur (`POST /api/ai-proposals/[id]/apply`),
 * d'ou `onBlockRefreshed` : la donnee ET la version locales doivent suivre,
 * sinon la prochaine edition manuelle echoue en faux conflit (voir
 * EntityBlocks.tsx, `handleBlockRefreshed`).
 *
 * V3.1-65 : trois changements de forme, aucun de fond.
 * - La lettrine a quitte ce corps pour l'en-tete de la carte
 *   (`LettrineBouton`) : c'est une propriete du bloc entier, pas d'un
 *   passage.
 * - L'encart est violet (`--link-entity`, le violet de ce projet — aucun
 *   jeton violet propre n'a ete cree, decision deja prise et consignee
 *   dans `docs/backlog-v3.1/termines.md`) et affiche le budget restant, lu
 *   sur `GET /api/ai/budget` : sans ca, « Proposer » pouvait echouer en 429
 *   sans que rien ne l'ait laisse prevoir.
 * - Une proposition en attente s'affiche EN POINTILLE A SA PLACE, juste
 *   sous le dernier paragraphe (le service propose un paragraphe, qui
 *   s'ajoutera la), au lieu d'etre relegue dans l'encart. Elle n'est
 *   toujours ecrite qu'a « Accepter » — regle 9 : rien ne touche le bloc
 *   avant validation.
 */
export default function TextBlockEditor({
  data,
  onChange,
  entityId,
  blockId,
  onBlockRefreshed,
  hideAssist,
  worldSlug,
  worldId,
  otherEntities,
}: {
  data: TextBlockData;
  onChange: (data: TextBlockData) => void;
  entityId: string;
  blockId: string;
  onBlockRefreshed: (fresh: { id: string; data: unknown; version: number }) => void;
  /** Coquille joueur (retour utilisateur) : "enlever les outils d'assistance IA" — jamais retire pour le MJ, `undefined`/`false` partout ailleurs. */
  hideAssist?: boolean;
  /** V2.1-1 : boutons Lier/Créer/Ouvrir une fiche, transmis à `RichTextEditor` — absents (contexte hors fiche de monde) masquent simplement ces boutons. */
  worldSlug?: string;
  worldId?: string;
  otherEntities?: OtherEntityOption[];
}) {
  const t = useTranslations("fiche.assistance");
  const [showAssist, setShowAssist] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [proposing, setProposing] = useState(false);
  const [proposeError, setProposeError] = useState<string | null>(null);
  const [proposals, setProposals] = useState<PropositionIa[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [budget, setBudget] = useState<number | null>(null);
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

  /** V3.1-65 : relu apres chaque appel, pour que le compte affiche ne soit jamais celui d'avant. */
  const chargerBudget = useCallback(() => {
    fetch("/api/ai/budget")
      .then((res) => (res.ok ? res.json() : null))
      .then((corps: { remaining?: number } | null) => setBudget(corps?.remaining ?? null))
      .catch((erreur) => console.error("Lecture du budget IA impossible", erreur));
  }, []);

  useEffect(() => {
    if (!showAssist) return;
    chargerBudget();
    fetch(`/api/entities/${entityId}/ai-proposals`)
      .then((res) => (res.ok ? res.json() : []))
      // Pas de filtre ici : `assistanceTexte` ne garde que celles de ce bloc, en un seul endroit.
      .then((all: PropositionIa[]) => setProposals(all))
      .catch((erreur) => console.error("Chargement des propositions d'écriture impossible", erreur));
  }, [showAssist, entityId, blockId, chargerBudget]);

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
    chargerBudget();
    if (!res.ok) {
      setProposeError(res.status === 429 ? t("erreurBudget") : t("erreur"));
      return;
    }
    const created = (await res.json()) as PropositionIa[];
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

  /** V3.1-65 : tout ce qui s'affiche se decide dans `lib/ui/assistanceTexte.ts`, teste sans navigateur. */
  const assistance = assistanceTexte({
    masquee: hideAssist === true,
    blockId,
    propositions: proposals,
    budgetRestant: budget,
    consigne: instruction,
    enCours: proposing,
  });

  return (
    <div className="flex flex-col gap-2">
      <RichTextEditor
        key={remountKey}
        segments={data.segments}
        onChange={(segments: Segment[]) => onChange({ ...data, segments })}
        worldSlug={worldSlug}
        worldId={worldId}
        otherEntities={otherEntities}
        dropCap={data.dropCap}
      />

      {/* A SA PLACE : un paragraphe propose s'ajoutera a la fin du bloc,
          donc il se montre ici, sous le dernier paragraphe, dans la meme
          typographie que le texte (`rich-text-content`) et en pointille
          pour dire qu'il n'est pas encore ecrit. Hors de l'encart
          repliable a dessein : une fois la proposition faite, replier
          l'encart ne la cache pas. Elle n'est en revanche RELUE qu'a
          l'ouverture de l'encart — rouvrir la fiche encart ferme ne
          declenche aucune requete (une par bloc `text` a chaque ouverture
          de fiche serait exactement le genre de chargement que
          docs/QUOTAS.md demande d'eviter). */}
      {assistance.enAttente.map((p) => (
          <div
            key={p.id}
            className="flex flex-col gap-2 rounded-xl border border-dashed border-link-entity/70 bg-link-entity/5 p-3"
          >
            <p className="rich-text-content text-ink-soft">{p.payload.text}</p>
            <p className="text-xs italic text-link-entity">{t("enAttente")}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleApply(p.id)}
                disabled={busyId === p.id}
                className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
              >
                {t("accepter")}
              </button>
              <button
                type="button"
                onClick={() => handleReject(p.id)}
                disabled={busyId === p.id}
                className="rounded-full border border-edge px-2.5 py-1 text-xs text-ink transition-colors hover:bg-panel disabled:opacity-50"
              >
                {t("refuser")}
              </button>
            </div>
          </div>
        ))}

      {assistance.encart && (
        <div className="flex flex-col gap-1.5 rounded-md border border-link-entity/40 bg-link-entity/5 p-2">
          <button
            type="button"
            onClick={() => setShowAssist((v) => !v)}
            aria-expanded={showAssist}
            className="self-start text-xs font-medium text-link-entity transition-opacity hover:opacity-80"
          >
            {showAssist ? "▾" : "▸"} {t("titre")}
          </button>

          {showAssist && (
            <div className="flex flex-col gap-2">
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder={t("consigne")}
                rows={2}
                aria-label={t("consigneLabel")}
                className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-xs text-ink outline-none"
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handlePropose}
                  disabled={!assistance.peutProposer}
                  className="rounded-full border border-link-entity/60 px-3 py-1 text-xs font-medium text-link-entity transition-colors hover:bg-link-entity/10 disabled:opacity-50"
                >
                  {proposing ? t("generation") : t("proposer")}
                </button>
                {/* Le budget est le reste de la fenetre glissante d'une heure
                    (V1-F1), lu sur le serveur — jamais un compte tenu ici. */}
                {budget !== null && (
                  <span className="text-xs text-ink-muted">
                    {budget === 0 ? t("budgetEpuise") : t("budget", { restant: budget })}
                  </span>
                )}
              </div>
              {proposeError && <p className="text-xs text-danger">{proposeError}</p>}

              {assistance.rejetees.map((p) => (
                <p key={p.id} className="text-xs italic text-ink-muted">
                  {p.validationErrors?.reason === "budget_exceeded" ? t("rejeteeBudget") : t("rejetee")}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
