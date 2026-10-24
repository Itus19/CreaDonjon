"use client";

import { useTranslations } from "next-intl";
import type { CombatRow } from "@/src/server/repos/combats";
import { phaseDe } from "@/lib/ui/initiative";

/** « Mes combats » : l'état de chacun (y compris « Suspendu »), tenu à jour par le temps réel. */
export default function ListeCombats({
  combats,
  actifId,
  onChoisir,
  onSupprimer,
}: {
  combats: CombatRow[];
  actifId: string | null;
  onChoisir: (id: string) => void;
  onSupprimer: (id: string) => void;
}) {
  const t = useTranslations("initiative");
  const libelle = (status: string) => {
    const phase = phaseDe(status);
    return phase === "draft" ? t("statutDraft") : phase === "rolling" ? t("statutRolling") : phase === "running" ? t("statutRunning") : phase === "paused" ? t("statutPaused") : t("statutEnded");
  };
  return (
    <section className="flex flex-col gap-2 rounded-[18px] border border-edge bg-panel p-3 backdrop-blur-[var(--blur)]">
      <h2 className="text-xs font-bold uppercase tracking-widest text-ink-muted">{t("mesCombats", { n: combats.length })}</h2>
      {combats.length === 0 ? (
        <p className="text-xs text-ink-muted">{t("aucunCombat")}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {combats.map((c) => (
            <li key={c.id} className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 text-xs ${c.id === actifId ? "border-accent bg-panel-raised" : "border-edge"}`}>
              <button type="button" onClick={() => onChoisir(c.id)} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 text-left hover:text-accent">
                <span className="min-w-0 flex-1 truncate text-ink">{c.name ?? t("combatSansNom")}</span>
                <span className="text-ink-muted">{libelle(c.status)}</span>
                <span className="text-ink-muted">{new Date(c.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</span>
              </button>
              <button type="button" onClick={() => onSupprimer(c.id)} aria-label={t("supprimerCombat")} title={t("supprimerCombat")} className="text-danger hover:underline">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
