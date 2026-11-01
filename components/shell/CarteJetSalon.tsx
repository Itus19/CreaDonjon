"use client";

import { useTranslations } from "next-intl";
import { etatDe, formaterModificateur, type JetAffiche } from "@/lib/ui/outilDes";
import { lectureJet } from "@/lib/ui/salon";

/**
 * Un jet en carte dans le salon de table (V3.1-22, planche « Chat — B
 * retenue ») : qui, quoi, total, dés, modificateurs (puces) et verdict vert
 * ou rouge quand un DD existait. Un jet secret a la bordure pointillée
 * violette et le mot « secret » ; la RLS ne le livre qu'à son auteur et au MJ.
 * Ne charge rien : le jet vient du salon.
 */
export default function CarteJetSalon({ jet, estMj }: { jet: JetAffiche; estMj: boolean }) {
  const t = useTranslations("chat");
  const { dc, dcInconnu, verdict } = lectureJet(jet, estMj);
  const contre = dc !== null ? t("contreDd", { dd: dc }) : dcInconnu ? t("contreDdInconnu") : null;
  const heure = new Date(jet.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return (
    <article
      title={jet.secret ? t("jetSecretAide") : undefined}
      className={`flex w-full max-w-sm flex-col gap-1.5 rounded-md border bg-panel-raised px-3 py-2 text-sm ${
        jet.secret ? "border-dashed border-gm" : "border-edge-strong"
      }`}
    >
      <header className="flex items-baseline gap-2 text-xs text-ink-muted">
        <span className="font-semibold text-ink">{jet.who}</span>
        {jet.secret && <span className="uppercase tracking-wider text-gm">{t("jetSecret")}</span>}
        <span className="ml-auto">{heure}</span>
      </header>
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-ink-soft">
          {jet.what}
          {contre && <span className="text-ink-muted"> · {contre}</span>}
        </p>
        <p
          aria-label={t("total", { total: jet.total })}
          className={`shrink-0 font-mech text-2xl font-bold leading-none ${
            verdict === "success" ? "text-success" : verdict === "fail" ? "text-danger" : "text-ink"
          }`}
        >
          {jet.total}
        </p>
      </div>
      {(jet.groups.length > 0 || jet.chips.length > 0 || verdict) && (
        <div className="flex flex-wrap items-center gap-1">
          {jet.groups.flatMap((groupe, g) =>
            groupe.rolls.map((valeur, i) => {
              const etat = etatDe(valeur, groupe.faces);
              return (
                <span
                  key={`${g}-${i}`}
                  className={`rounded border border-edge bg-panel px-1.5 py-0.5 font-mech text-xs ${
                    etat === "maximum" ? "text-accent" : etat === "un" ? "text-danger" : "text-ink"
                  }`}
                >
                  <span className="text-ink-muted">d{groupe.faces}</span> {valeur}
                </span>
              );
            })
          )}
          {jet.chips.map((chip, i) => (
            <span key={i} className="rounded-full border border-edge bg-panel px-1.5 py-0.5 font-mech text-xs">
              <span className="text-ink-muted">{chip.label}</span> <span className="font-semibold text-accent">{formaterModificateur(chip.value)}</span>
            </span>
          ))}
          {verdict && (
            <span className={`ml-auto text-xs font-semibold ${verdict === "success" ? "text-success" : "text-danger"}`}>
              {verdict === "success" ? t("reussite") : t("echec")}
            </span>
          )}
        </div>
      )}
    </article>
  );
}
