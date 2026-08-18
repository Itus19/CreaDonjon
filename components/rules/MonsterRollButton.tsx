"use client";

import { useState } from "react";

/**
 * Bouton de jet pour une action de monstre (V1-E4 suite, retour utilisateur
 * point 6 : "au lieu des choses du type '+9 pour toucher'... fait le meme
 * systeme que dans le bloc de personnage, met des boutons comme pour jeter
 * des dés"). Passe par `/api/formula/evaluate` — meme moteur que le jeu reel
 * (`parseFormula`/`evaluate`), RNG serveur (`serverRng`, CLAUDE.md regle 6),
 * jamais un jet cote client. Contrairement au bouton d'attaque de
 * `PlayableCharacterSheet` (lie a un personnage, un inventaire, une
 * campagne), une fiche de regle SRD n'a aucun de ces trois — ce composant
 * est donc autonome : il porte son propre etat de jet plutot que de
 * s'appuyer sur un `rollLog` partage.
 */
export default function MonsterRollButton({ label, formula }: { label: string; formula: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ value: number; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function roll() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/formula/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formula, mode: "roll" }),
    });
    const body = (await res.json().catch(() => null)) as { value?: number; text?: string; error?: string } | null;
    setBusy(false);
    if (!res.ok || body?.value === undefined) {
      setError(body?.error ?? "Erreur de jet.");
      return;
    }
    setResult({ value: body.value, text: body.text ?? "" });
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={roll}
      title={formula}
      className="flex min-w-[5.5rem] flex-col items-center gap-0.5 rounded-md border border-edge px-2.5 py-1 text-ink hover:bg-panel disabled:opacity-50"
    >
      <span className="text-[10px] font-medium">{label}</span>
      <span className="mech" style={{ fontSize: "0.8125rem" }}>
        {result ? result.value : formula}
      </span>
      {result && (
        <span className="mech text-ink-muted" style={{ fontSize: "0.625rem" }}>
          {result.text}
        </span>
      )}
      {error && <span className="text-[9px] text-danger">{error}</span>}
    </button>
  );
}
