"use client";

import type { DeathSaves } from "@/src/core/rules/deathSaves";
import type { EtatMourant } from "@/lib/ui/etatMourant";

const BOUTON =
  "min-h-9 rounded-full border border-edge px-3 py-1.5 text-sm text-ink transition-colors hover:bg-panel disabled:opacity-50";

/** Trois ronds, remplis selon le compte : ● obtenu, ○ à venir. Le compte est aussi dit en toutes lettres aux lecteurs d'écran. */
function Ronds({ libelle, compte, danger }: { libelle: string; compte: number; danger?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 text-xs uppercase tracking-wide text-ink-muted">{libelle}</span>
      <span
        role="img"
        aria-label={`${libelle} : ${compte} sur 3`}
        className={`text-lg leading-none tracking-[0.25em] ${danger ? "text-danger" : "text-accent"}`}
      >
        {[0, 1, 2].map((i) => (i < compte ? "●" : "○")).join("")}
      </span>
    </div>
  );
}

/**
 * À 0 PV (V3.1-32) : prend la place de la jauge de PV dans l'en-tête, à toutes
 * les largeurs. Mourant : réussites, échecs, « Jet de mort » et soins. Stabilisé :
 * le mot et les soins. Mort : le mot, sans bouton de jet.
 *
 * Aucun calcul ici : l'état vient de `etatMourant`, le d20 est lancé par le
 * serveur (`onJetDeMort`), et un soin ne transmet qu'un écart (`onSoigner`).
 */
export default function BlocMourant({
  etat,
  deathSaves,
  desactive,
  dernierD20,
  onJetDeMort,
  onSoigner,
}: {
  etat: Exclude<EtatMourant, "vivant">;
  deathSaves: DeathSaves;
  desactive: boolean;
  /** Dernier d20 obtenu par « Jet de mort » sur cette fiche, pour le montrer ; `null` avant tout jet. */
  dernierD20: number | null;
  onJetDeMort: () => void;
  /** Absent : l'interrupteur « PV » du MJ est coupé (V3.1-109), les soins à la main disparaissent ; le jet de mort reste (geste du moteur). */
  onSoigner?: (delta: number) => void;
}) {
  const soins = onSoigner && (
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={desactive} onClick={() => onSoigner(1)} className={BOUTON}>
        Soigner +1
      </button>
      <button type="button" disabled={desactive} onClick={() => onSoigner(2)} className={BOUTON}>
        Soigner +2
      </button>
    </div>
  );

  if (etat === "mort") {
    return (
      <div className="flex min-w-[10rem] flex-col gap-1 rounded-md border border-edge bg-panel-sunken px-3 py-2" role="status">
        <span className="text-sm font-semibold text-ink-muted">Mort</span>
        <Ronds libelle="Échecs" compte={deathSaves.fail} danger />
      </div>
    );
  }

  return (
    <div className="flex min-w-[15rem] max-w-full flex-col gap-2 rounded-md border border-danger/60 bg-danger/10 px-3 py-2">
      <span className="text-xs font-bold uppercase tracking-wide text-danger">
        {etat === "stabilisé" ? "Stabilisé" : "À 0 PV — jets contre la mort"}
      </span>
      {etat === "mourant" && (
        <>
          <Ronds libelle="Réussites" compte={deathSaves.success} />
          <Ronds libelle="Échecs" compte={deathSaves.fail} danger />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={desactive} onClick={onJetDeMort} className={`${BOUTON} border-danger/60 font-semibold`}>
              Jet de mort
            </button>
            <span aria-live="polite" className="text-sm text-ink">
              {dernierD20 !== null ? `d20 : ${dernierD20}` : ""}
            </span>
          </div>
        </>
      )}
      {soins}
    </div>
  );
}
