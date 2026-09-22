"use client";

import { useMemo, useState } from "react";
import Dropdown from "@/components/shared/Dropdown";
import EmptyState from "@/components/shell/EmptyState";
import { interpretIntent, type IntentAction, type MechanicalIntentKind } from "@/src/core/rules/intent";
import type { AdvantageState } from "@/src/core/rules/action";
import type { IntentBarData, TurnOutcome } from "@/lib/solo/types";

/**
 * V3-B1 — La barre d'intention.
 *
 * Le joueur ecrit librement ; **rien ne part avant que la mecanique soit
 * resolue**, et la proposition du moteur est affichee AVANT d'etre
 * executee. C'est la reponse d'ADR 0009 au defaut de S1 : une case a cocher
 * facultative ne suffit pas, il faut que la mecanique soit le chemin.
 *
 * La lecture de la phrase se fait ICI, dans le navigateur, parce que
 * `interpretIntent` est un module pur du noyau : la proposition s'affiche
 * en frappant, sans aller-retour. Elle n'engage rien — le serveur ne
 * recoit jamais la phrase a interpreter, seulement le CHOIX retenu.
 */

const KIND_LABELS: Record<MechanicalIntentKind, string> = {
  weapon_attack: "Attaque",
  skill_check: "Test",
  ability_check: "Test",
  saving_throw: "Sauvegarde",
};

const ADVANTAGE_LABELS: Record<AdvantageState, string> = {
  disadvantage: "désavantage",
  normal: "normal",
  advantage: "avantage",
};

const BTN_PRIMARY =
  "rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50";
const BTN_SECONDARY =
  "rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50";
const CHIP = "rounded-full border border-edge px-3 py-1 text-xs text-ink";

function actionOptionLabel(action: IntentAction): string {
  return action.kind === "weapon_attack" ? `${action.label} — attaque` : action.label;
}

export default function IntentBar({
  worldSlug,
  campaignId,
  entityId,
  data,
}: {
  worldSlug: string;
  campaignId: string | null;
  entityId: string;
  data: IntentBarData;
}) {
  const [text, setText] = useState("");
  const [overrideActionId, setOverrideActionId] = useState<string | null>(null);
  const [overrideTargetId, setOverrideTargetId] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const [advantage, setAdvantage] = useState<AdvantageState>("normal");
  const [dc, setDc] = useState<string>("");
  const [turns, setTurns] = useState<TurnOutcome[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const proposal = useMemo(() => interpretIntent(text, data.catalog), [text, data.catalog]);

  /**
   * Une correction porte sur LA phrase corrigee. Reecrire la phrase repart
   * de la lecture du moteur, sinon un choix fait pour « je frappe » se
   * collerait silencieusement au tour suivant.
   *
   * Remis a zero dans le gestionnaire de saisie, jamais dans un effet : un
   * effet qui appelle `setState` declenche un second rendu pour rien, et
   * ici l'evenement qui invalide la correction est connu — c'est la frappe.
   */
  function changeText(next: string) {
    setText(next);
    setOverrideActionId(null);
    setOverrideTargetId(null);
    setCorrecting(false);
  }

  // `actions` melange plusieurs familles sous le meme identifiant (« dex »
  // est a la fois un test et une sauvegarde) : la cle d'option porte donc
  // la famille, jamais l'identifiant seul.
  const optionKey = (action: IntentAction) => `${action.kind}:${action.id}`;
  const chosenAction: IntentAction | null =
    (overrideActionId ? (data.catalog.actions.find((a) => optionKey(a) === overrideActionId) ?? null) : null) ??
    (proposal.kind === "mechanical" ? proposal.action : null);

  const proposedTargetId = proposal.kind === "mechanical" ? (proposal.target?.id ?? null) : null;
  const chosenTargetId = overrideTargetId === null ? proposedTargetId : overrideTargetId === "" ? null : overrideTargetId;
  const chosenTarget = data.targetDetails.find((t) => t.id === chosenTargetId) ?? null;
  const corrected = overrideActionId !== null || overrideTargetId !== null;
  const needsDc = chosenAction !== null && chosenAction.kind !== "weapon_attack";

  async function play() {
    if (text.trim().length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const choice = chosenAction
        ? chosenAction.kind === "weapon_attack"
          ? { kind: "weapon_attack" as const, actionId: chosenAction.id, targetId: chosenTargetId, advantage }
          : {
              kind: chosenAction.kind,
              actionId: chosenAction.id,
              targetId: chosenTargetId,
              advantage,
              dc: dc.trim() === "" ? null : Number(dc),
            }
        : { kind: "free" as const };

      const res = await fetch("/api/solo/tour", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, campaignId, worldSlug, text: text.trim(), corrected, choice }),
      });
      // Un `fetch` dont on ne teste pas `res.ok` est un bug
      // (docs/CHARTE-UI.md §5) : un echec silencieux laisserait l'ecran en
      // attente d'un tour qui n'arrivera jamais.
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Le tour n'a pas pu être joué.");
        return;
      }
      const record = (await res.json()) as TurnOutcome;
      setTurns((previous) => [record, ...previous]);
      changeText("");
      setDc("");
    } catch {
      setError("Le serveur n'a pas répondu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-lg border border-edge bg-panel p-6">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Que fais-tu ?</span>
          <input
            value={text}
            onChange={(e) => changeText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !busy) void play();
            }}
            placeholder="je frappe le gobelin avec mon épée"
            maxLength={500}
            className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
          />
        </label>

        {text.trim().length === 0 ? (
          <p className="text-sm text-ink-muted">
            Écris ton action. Le moteur dit ce qu&apos;il a compris avant de lancer quoi que ce soit.
          </p>
        ) : (
          <div className="flex flex-col gap-3 rounded-md border border-edge bg-panel-sunken p-3">
            {chosenAction ? (
              <div className="flex flex-wrap items-center gap-2 text-sm text-ink">
                <span className={CHIP}>{KIND_LABELS[chosenAction.kind]}</span>
                <span className="font-medium">{chosenAction.label}</span>
                {chosenTarget && (
                  <>
                    <span className="text-ink-muted">·</span>
                    <span>
                      cible : <span className="font-medium">{chosenTarget.label}</span>
                      {chosenTarget.ac !== null && <span className="text-ink-muted"> (CA {chosenTarget.ac})</span>}
                    </span>
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-1 text-sm text-ink">
                <span className={CHIP}>Action libre</span>
                <span className="text-ink-soft">
                  {proposal.kind === "free" && proposal.reason === "aucune_action_disponible"
                    ? "Le verbe est compris, mais cette fiche n'a rien pour le faire — aucun jet ne sera lancé."
                    : "Aucune mécanique reconnue — ce tour partira sans jet."}
                </span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={BTN_PRIMARY} onClick={() => void play()} disabled={busy}>
                {busy ? "…" : chosenAction ? "Lancer" : "Envoyer sans jet"}
              </button>
              <button type="button" className={BTN_SECONDARY} onClick={() => setCorrecting((v) => !v)} disabled={busy}>
                ce n&apos;est pas ça
              </button>
              {corrected && <span className="text-xs text-ink-muted">corrigé</span>}
            </div>

            {correcting && (
              <div className="flex flex-col gap-2 border-t border-edge pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Dropdown
                    aria-label="Action à résoudre"
                    size="md"
                    className="w-64"
                    value={chosenAction ? optionKey(chosenAction) : ""}
                    options={[
                      { value: "", label: "Action libre — aucun jet" },
                      ...data.catalog.actions.map((a) => ({ value: optionKey(a), label: actionOptionLabel(a) })),
                    ]}
                    onChange={(v) => setOverrideActionId(v)}
                  />
                  <Dropdown
                    aria-label="Cible de l'action"
                    size="md"
                    className="w-56"
                    value={chosenTargetId ?? ""}
                    options={[
                      { value: "", label: "Aucune cible" },
                      ...data.targetDetails.map((t) => ({
                        value: t.id,
                        label: t.ac === null ? t.label : `${t.label} — CA ${t.ac}`,
                      })),
                    ]}
                    onChange={(v) => setOverrideTargetId(v)}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-ink-muted">Jet :</span>
                  {(["disadvantage", "normal", "advantage"] as AdvantageState[]).map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAdvantage(a)}
                      className={`rounded-full border px-3 py-1 transition-colors ${
                        advantage === a ? "border-accent text-accent" : "border-edge text-ink-muted hover:bg-panel-raised"
                      }`}
                    >
                      {ADVANTAGE_LABELS[a]}
                    </button>
                  ))}
                  {needsDc && (
                    <label className="flex items-center gap-1">
                      <span className="text-ink-muted">DD</span>
                      <input
                        value={dc}
                        onChange={(e) => setDc(e.target.value.replace(/[^0-9]/g, ""))}
                        inputMode="numeric"
                        maxLength={2}
                        placeholder="—"
                        className="w-12 rounded-md border border-edge bg-transparent px-2 py-1 text-xs text-ink outline-none"
                      />
                    </label>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {error !== null && (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-edge bg-panel-sunken p-3 text-sm text-danger">
            <span>{error}</span>
            <button type="button" className={BTN_SECONDARY} onClick={() => void play()} disabled={busy}>
              Réessayer
            </button>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        {turns.length === 0 ? (
          <EmptyState
            title="Aucun tour joué"
            description="Les faits établis s'écriront ici, au fur et à mesure. Ils sont journalisés avant toute narration — la prose viendra plus tard, les faits sont acquis."
          />
        ) : (
          turns.map((turn, index) => (
            <article key={turn.record.eventId ?? `${index}`} className="rounded-lg border border-edge bg-panel p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className={CHIP}>{turn.record.kind === "roll" ? "Jet résolu" : "Action libre"}</span>
                {turn.time && (
                  <span className="text-xs text-ink-muted">
                    jour {turn.time.day}, {String(turn.time.hour).padStart(2, "0")}h
                    {String(turn.time.minute).padStart(2, "0")}
                  </span>
                )}
                {turn.record.eventId === null && <span className="text-xs text-ink-muted">hors campagne — non journalisé</span>}
              </div>
              <div className="mt-2 flex flex-col gap-1">
                {turn.record.facts.map((fact, factIndex) => (
                  <p key={factIndex} className="text-base text-ink">
                    {fact}
                  </p>
                ))}
              </div>

              {/* Ce que le tour a CHANGE — les effets appliqués, pas les
                  faits. Les deux se lisent ensemble ou pas du tout. */}
              {turn.changes.length > 0 && (
                <ul className="mt-3 flex flex-col gap-1 border-t border-edge pt-3">
                  {turn.changes.map((line, changeIndex) => (
                    <li key={changeIndex} className="text-sm text-ink-soft">
                      {line}
                    </li>
                  ))}
                </ul>
              )}

              {turn.hints.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1">
                  {turn.hints.map((hint, hintIndex) => (
                    <li key={hintIndex} className="text-sm italic text-ink-soft">
                      {hint}
                    </li>
                  ))}
                </ul>
              )}

              {/* Ce que le moteur n'a PAS pu appliquer se voit, toujours :
                  une règle qui ne s'applique pas en silence est pire
                  qu'une règle absente. */}
              {turn.ignored.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1">
                  {turn.ignored.map((reason, ignoredIndex) => (
                    <li key={ignoredIndex} className="text-xs text-ink-muted">
                      Non appliqué — {reason}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))
        )}
      </section>
    </div>
  );
}
