"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Dropdown from "@/components/shared/Dropdown";
import { interpretIntent, type IntentAction, type MechanicalIntentKind } from "@/src/core/rules/intent";
import type { AdvantageState } from "@/src/core/rules/action";
import type { EncashedTurnOutcome, IntentBarData, PendingRequest, PendingTurnResponse, TurnOutcome } from "@/lib/solo/types";

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
 *
 * **V3-D4 Phase 2 — un seul champ.** L'ancien panneau « Jet demandé »
 * séparé (avec son propre champ « Dé annoncé ») a disparu : ce MÊME champ
 * change de rôle quand une demande est posée — bordure à l'accent, texte
 * temporaire qui devient la demande, et ce que le joueur y tape devient le
 * naturel annoncé plutôt qu'une phrase à interpréter. `pending` est
 * possédé par `SoloScreen.tsx` (sondé au même rythme que le fil) : une
 * demande honorée depuis la fiche (colonne voisine, V3-B5 Phase 2) se
 * répercute donc ici sans qu'IntentBar l'ait lui-même demandée.
 *
 * **Ce que ce ticket NE change PAS, et pourquoi.** Un jet fait depuis la
 * fiche ou le volet de dés continue de résoudre DIRECTEMENT (V3-B5 Phase
 * 2, déjà vérifié en direct) plutôt que de s'inscrire en texte ici pour
 * exiger un second clic — les deux colonnes sont des arbres React
 * distincts, et faire remonter un texte de l'une vers l'autre aurait exigé
 * un canal de plus pour un gain douteux (un pas de plus là où B5 en
 * demande déjà un de moins). Le champ unique porte donc le chemin « annoncé
 * à la main », le seul qui n'avait pas déjà de résolution directe.
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

/** 1 à 8 lignes (critère du ticket) — mesuré sur `text-sm` (20px de ligne) plus le padding vertical du champ (2 × 6px). */
const LINE_HEIGHT_PX = 20;
const FIELD_PADDING_PX = 12;
const MAX_LINES = 8;

function actionOptionLabel(action: IntentAction): string {
  return action.kind === "weapon_attack" ? `${action.label} — attaque` : action.label;
}

export default function IntentBar({
  worldSlug,
  campaignId,
  entityId,
  data,
  pending,
  onPendingChange,
  onActed,
}: {
  worldSlug: string;
  campaignId: string | null;
  entityId: string;
  data: IntentBarData;
  /** V3-D4 — possédée par `SoloScreen.tsx`, pas par cette barre (voir le commentaire d'en-tête). */
  pending: PendingRequest | null;
  onPendingChange: (next: PendingRequest | null) => void;
  /** Appelé après toute action confirmée par le serveur (pose ou encaissement) — `SoloScreen.tsx` en profite pour rafraîchir le fil tout de suite, sans attendre son sondage. */
  onActed?: () => void;
}) {
  const [text, setText] = useState("");
  const [overrideActionId, setOverrideActionId] = useState<string | null>(null);
  const [overrideTargetId, setOverrideTargetId] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const [advantage, setAdvantage] = useState<AdvantageState>("normal");
  const [dc, setDc] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Le champ change de role des qu'une demande apparait ou disparait —
  // qu'elle vienne de CETTE barre ou de la fiche (`pending` est un prop,
  // sondé par le parent). Vider le texte a ce moment-la evite qu'un
  // brouillon d'action a moitie tape se retrouve interprete comme un
  // naturel, ou l'inverse. Ajuste PENDANT le rendu (pas dans un effet) —
  // le motif React recommande pour « reinitialiser un etat quand une prop
  // change », qui evite une passe de rendu supplementaire.
  const pendingKey = pending ? `${pending.kind}:${pending.action_id}` : null;
  const [lastPendingKey, setLastPendingKey] = useState(pendingKey);
  if (pendingKey !== lastPendingKey) {
    setLastPendingKey(pendingKey);
    setText("");
  }

  // Grandit avec son CONTENU (1 a 8 lignes) — colle a `scrollHeight`,
  // que le texte vienne de la frappe ou d'une valeur posee par du code.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = LINE_HEIGHT_PX * MAX_LINES + FIELD_PADDING_PX;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [text]);

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
      const body = (await res.json()) as TurnOutcome | PendingTurnResponse;
      // V3-B5 — un choix mecanique en campagne ne rend plus un tour joue :
      // il rend la demande posee, en attente du de annonce (`encash`).
      // L'action libre, elle, garde son aller simple d'avant ce ticket.
      if ("pending" in body) {
        onPendingChange(body.pending);
      } else {
        onPendingChange(null);
        setDc("");
      }
      onActed?.();
    } catch {
      setError("Le serveur n'a pas répondu.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Encaisse la demande posee : un nombre NU, jamais un total — c'est le
   * serveur qui y ajoute le modificateur fige a la pose
   * (`resolveIntentRequest`, turnIntent.ts). Une attaque qui touche CHAINE
   * une demande de degats (`outcome.chained`) : le champ repart alors
   * directement en attente d'un second nombre, meme tour, meme geste.
   */
  async function encash() {
    if (pending === null) return;
    const value = Number(text);
    if (!Number.isInteger(value) || value < 1 || value > pending.die_max) {
      setError(`Un dé annoncé se lit entre 1 et ${pending.die_max}.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/solo/tour/encaisser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, campaignId, worldSlug, natural: value, origin: "a_la_main" }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Le jet n'a pas pu être encaissé.");
        return;
      }
      const outcome = (await res.json()) as EncashedTurnOutcome;
      onPendingChange(outcome.chained);
      if (outcome.chained === null) setDc("");
      onActed?.();
    } catch {
      setError("Le serveur n'a pas répondu.");
    } finally {
      setBusy(false);
    }
  }

  function submit() {
    if (pending) void encash();
    else void play();
  }

  function handleChange(value: string) {
    // En attente d'une demande, le champ n'accepte que le naturel annonce
    // — jamais une phrase a interpreter tant que le tour n'est pas honore.
    if (pending) setText(value.replace(/[^0-9]/g, ""));
    else changeText(value);
  }

  const label = pending ? "Jet demandé" : "Que fais-tu ?";
  const placeholder = pending
    ? `${pending.what}${pending.target_label ? ` sur ${pending.target_label}` : ""} — lance depuis ta fiche, ou écris ton résultat (1-${pending.die_max})`
    : "je frappe le gobelin avec mon épée";

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-lg border border-edge bg-panel p-6">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</span>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !busy) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={placeholder}
            maxLength={pending ? (pending.die_max >= 100 ? 3 : 2) : 500}
            rows={1}
            className={`resize-none overflow-y-auto rounded-md border bg-transparent px-2 py-1.5 text-sm text-ink outline-none ${
              pending ? "border-accent" : "border-edge"
            }`}
          />
        </label>

        {pending && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
              <span>
                modificateur {pending.modifier >= 0 ? "+" : "−"}
                {Math.abs(pending.modifier)}
              </span>
              {pending.dc !== null && (
                <span>
                  · {pending.kind === "weapon_attack" ? "CA" : "DD"} {pending.dc}
                </span>
              )}
              {pending.advantage !== "normal" && <span>· {ADVANTAGE_LABELS[pending.advantage]}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={BTN_PRIMARY} onClick={() => void encash()} disabled={busy || text.trim() === ""}>
                {busy ? "…" : "Annoncer"}
              </button>
            </div>
          </div>
        )}

        {!pending &&
          (text.trim().length === 0 ? (
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
          ))}

        {error !== null && (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-edge bg-panel-sunken p-3 text-sm text-danger">
            <span>{error}</span>
            <button type="button" className={BTN_SECONDARY} onClick={() => submit()} disabled={busy}>
              Réessayer
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
