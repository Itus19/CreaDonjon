"use client";

import { useEffect, useState } from "react";

/**
 * V2-S1 : ecran jetable pour le spike de viabilite du solo. Rien n'est
 * persiste — evenements et PV se suivent uniquement dans cet etat React,
 * un rechargement de page reset l'experience. Pas de style soigne
 * (specs/coquille-et-design.md n'a pas a s'appliquer ici) : "un ecran
 * jetable suffit", au mot pres du ticket.
 *
 * Vingt tours minimum, mesures notees au fil de l'eau (voir docs/BACKLOG_V2.md
 * S1) : latence, tokens, appels malformes, identifiants inventes (objectifs,
 * calcules ici) + coherence des PNJ et qualite de la prose (subjectifs, a
 * noter par la personne qui joue apres chaque tour).
 */

interface Npc {
  id: string;
  name: string;
  blurb: string;
  priority: string;
  line: string;
  stanceTowardBram: string;
}

interface Setup {
  locationName: string;
  locationText: string;
  npcs: Npc[];
  hpCurrent: number;
  ac: number;
  encounter: { monsterName: string; monsterEntryKey: string; count: number } | null;
}

interface TurnEntry {
  turn: number;
  playerAction: string;
  mechanicalFact: string | null;
  ok: boolean;
  narration?: string;
  npcReactionText?: string;
  invalidReason?: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  coherence?: number;
  prose?: number;
  note?: string;
  /** S2 : le modele contredit-il un nombre qu'on lui a fourni (degats, PV, reussite/echec) ? */
  contradicted?: boolean;
  /** S2 : le modele invente-t-il un fait mecanique absent du contexte (critique, chute, PNJ qui intervient) ? */
  invented?: boolean;
}

export default function SpikeSoloPage() {
  const [setup, setSetup] = useState<Setup | "loading" | "error">("loading");
  const [playerAction, setPlayerAction] = useState("");
  const [busy, setBusy] = useState(false);
  const [entries, setEntries] = useState<TurnEntry[]>([]);
  /** PV suivis tour apres tour — `null` tant que le setup n'est pas charge. */
  const [hp, setHp] = useState<number | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/spike-solo/setup")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data: Setup) => {
        setSetup(data);
        setHp(data.hpCurrent);
      })
      .catch(() => setSetup("error"));
  }, []);

  /** Seul endroit ou cette phrase se compose — affichee ET envoyee au modele, jamais deux formulations. */
  function characterLine(currentHp: number, ac: number): string {
    return `Bram : PV actuels ${currentHp}, CA ${ac}.`;
  }

  function recentEventStrings(): string[] {
    return entries
      .filter((e) => e.ok)
      .map((e) => [e.narration, e.npcReactionText].filter(Boolean).join(" "))
      .filter((s) => s.length > 0);
  }

  /**
   * S2 : la resolution mecanique est OBLIGATOIRE et passe en premier.
   *
   * S1 en faisait une case a cocher, et l'unique fois ou elle a ete cochee la
   * resolution a echoue sans rien interrompre : le combat des tours 2 a 4 a ete
   * narre sans qu'aucun de reel soit lance (ADR 0009). La garantie centrale du
   * projet — le modele ne calcule rien — n'a donc jamais ete observee. Ici, si la
   * resolution echoue, le tour s'ARRETE : pas de fait, pas de narration. Un tour
   * manquant se voit, un tour narre sans fait ne se voit pas.
   */
  async function handleSubmit() {
    if (!playerAction.trim() || setup === "loading" || setup === "error" || busy || hp === null) return;
    if (!setup.encounter) {
      setBlocked("Aucune rencontre preparee : S2 mesure des tours de COMBAT, il n'y a rien a resoudre.");
      return;
    }
    setBusy(true);
    setBlocked(null);

    const resolveRes = await fetch("/api/spike-solo/resolve-attack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monsterEntryKey: setup.encounter.monsterEntryKey }),
    });
    if (!resolveRes.ok) {
      setBlocked(`Resolution mecanique echouee (HTTP ${resolveRes.status}) — tour ABANDONNE, le modele n'a pas ete appele.`);
      setBusy(false);
      return;
    }
    const resolved = (await resolveRes.json()) as { fact: string; hit: boolean; damage: number };
    const hpAfter = Math.max(0, hp - resolved.damage);
    const mechanicalFact = `${resolved.fact} PV de Bram apres ce coup : ${hpAfter}.`;
    setHp(hpAfter);

    const res = await fetch("/api/spike-solo/turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locationText: setup.locationText,
        characterSummary: characterLine(hpAfter, setup.ac),
        recentEvents: recentEventStrings(),
        mechanicalFact,
        playerAction: playerAction.trim(),
      }),
    });

    const turnNumber = entries.length + 1;
    if (!res.ok) {
      setEntries((prev) => [
        ...prev,
        { turn: turnNumber, playerAction, mechanicalFact, ok: false, invalidReason: `HTTP ${res.status}`, latencyMs: 0, inputTokens: 0, outputTokens: 0 },
      ]);
    } else {
      const outcome = (await res.json()) as {
        ok: boolean;
        narration?: string;
        npcReaction?: { npcName: string; text: string };
        invalidReason?: string;
        latencyMs: number;
        inputTokens: number;
        outputTokens: number;
      };
      setEntries((prev) => [
        ...prev,
        {
          turn: turnNumber,
          playerAction,
          mechanicalFact,
          ok: outcome.ok,
          narration: outcome.narration,
          npcReactionText: outcome.npcReaction ? `${outcome.npcReaction.npcName} : ${outcome.npcReaction.text}` : undefined,
          invalidReason: outcome.invalidReason,
          latencyMs: outcome.latencyMs,
          inputTokens: outcome.inputTokens,
          outputTokens: outcome.outputTokens,
        },
      ]);
    }

    setPlayerAction("");
    setBusy(false);
  }

  function rate(turn: number, field: "coherence" | "prose", value: number) {
    setEntries((prev) => prev.map((e) => (e.turn === turn ? { ...e, [field]: value } : e)));
  }

  function flag(turn: number, field: "contradicted" | "invented", value: boolean) {
    setEntries((prev) => prev.map((e) => (e.turn === turn ? { ...e, [field]: value } : e)));
  }

  function setNote(turn: number, note: string) {
    setEntries((prev) => prev.map((e) => (e.turn === turn ? { ...e, note } : e)));
  }

  if (setup === "loading") return <p className="p-6 text-sm text-ink-muted">Chargement du spike…</p>;
  if (setup === "error") return <p className="p-6 text-sm text-danger">Impossible de charger l&apos;etat initial (fixture seed-dev absente ?).</p>;

  const okEntries = entries.filter((e) => e.ok);
  const malformedCount = entries.length - okEntries.length;
  const avgLatency = okEntries.length ? Math.round(okEntries.reduce((a, e) => a + e.latencyMs, 0) / okEntries.length) : 0;
  const avgInputTokens = okEntries.length ? Math.round(okEntries.reduce((a, e) => a + e.inputTokens, 0) / okEntries.length) : 0;
  const contradictedCount = okEntries.filter((e) => e.contradicted).length;
  const inventedCount = okEntries.filter((e) => e.invented).length;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6 text-ink">
      <h1 className="text-lg font-semibold">S2 — Le lien fait-mecanique → narration (dette de l&apos;ADR 0009)</h1>

      <div className="rounded-md border border-edge/50 bg-panel-sunken p-3 text-sm">
        <p className="font-medium">{setup.locationName}</p>
        <p className="text-ink-muted">{setup.locationText}</p>
        <p className="mt-2 font-medium">Personnage</p>
        <p className="text-ink-muted">{hp === null ? "…" : characterLine(hp, setup.ac)}</p>
        <p className="mt-2 font-medium">PNJ presents</p>
        <ul className="list-inside list-disc text-ink-muted">
          {setup.npcs.map((n) => (
            <li key={n.id}>
              <span className="text-ink">{n.name}</span> — {n.blurb} {n.stanceTowardBram}
            </li>
          ))}
        </ul>
        {setup.encounter && (
          <p className="mt-2 text-ink-muted">
            Rencontre preparee : {setup.encounter.count}× {setup.encounter.monsterName}
          </p>
        )}
      </div>

      <div className="rounded-md border border-edge/50 bg-panel-sunken p-3 text-xs text-ink-muted">
        Tour {entries.length}/10 — latence moyenne {avgLatency} ms — tokens d&apos;entree moyens {avgInputTokens} — appels
        malformes : {malformedCount}/{entries.length || 0}
        <br />
        <span className={contradictedCount > 1 ? "text-danger" : undefined}>
          S2 — nombres contredits : {contradictedCount}/{okEntries.length} (seuil d&apos;echec : plus de 1 sur 10)
        </span>
        {" — "}
        <span className={inventedCount > 0 ? "text-danger" : undefined}>faits mecaniques inventes : {inventedCount}/{okEntries.length}</span>
      </div>

      <div className="flex flex-col gap-3">
        {entries.map((e) => (
          <div key={e.turn} className={`rounded-md border p-3 text-sm ${e.ok ? "border-edge/50" : "border-danger/50 bg-danger/5"}`}>
            <p className="text-xs text-ink-muted">
              Tour {e.turn} — {e.latencyMs} ms — {e.inputTokens} tokens entree / {e.outputTokens} sortie
            </p>
            <p className="mt-1 italic text-ink-muted">Action : {e.playerAction}</p>
            {e.mechanicalFact && <p className="text-ink-muted">Fait : {e.mechanicalFact}</p>}
            {e.ok ? (
              <>
                <p className="mt-1">{e.narration}</p>
                {e.npcReactionText && <p className="mt-1 text-accent">{e.npcReactionText}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                  <label className="flex items-center gap-1">
                    Coherence PNJ
                    <select value={e.coherence ?? ""} onChange={(ev) => rate(e.turn, "coherence", Number(ev.target.value))} className="rounded border border-edge bg-transparent px-1">
                      <option value="">–</option>
                      {[1, 2, 3, 4, 5].map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-1">
                    Qualite de la prose
                    <select value={e.prose ?? ""} onChange={(ev) => rate(e.turn, "prose", Number(ev.target.value))} className="rounded border border-edge bg-transparent px-1">
                      <option value="">–</option>
                      {[1, 2, 3, 4, 5].map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={e.contradicted ?? false} onChange={(ev) => flag(e.turn, "contradicted", ev.target.checked)} />
                    Nombre contredit
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={e.invented ?? false} onChange={(ev) => flag(e.turn, "invented", ev.target.checked)} />
                    Fait invente
                  </label>
                  <input
                    value={e.note ?? ""}
                    onChange={(ev) => setNote(e.turn, ev.target.value)}
                    placeholder="note libre"
                    className="min-w-0 flex-1 rounded border border-edge bg-transparent px-1"
                  />
                </div>
              </>
            ) : (
              <p className="mt-1 text-danger">Rejete : {e.invalidReason}</p>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded-md border border-edge/50 bg-panel-sunken p-3">
        <textarea
          value={playerAction}
          onChange={(e) => setPlayerAction(e.target.value)}
          placeholder="Que fait Bram ?"
          rows={2}
          className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm outline-none"
        />
        {setup.encounter && (
          <p className="text-xs text-ink-muted">
            Chaque tour resout d&apos;abord une attaque reelle de {setup.encounter.monsterName} — plus de case a cocher (S2).
          </p>
        )}
        {blocked && <p className="text-xs text-danger">{blocked}</p>}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={busy || !playerAction.trim()}
          className="self-start rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-50"
        >
          {busy ? "…" : "Jouer ce tour"}
        </button>
      </div>
    </div>
  );
}
