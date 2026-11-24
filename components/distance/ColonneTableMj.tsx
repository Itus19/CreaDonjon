"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Tabs from "@/components/shared/Tabs";
import ChatThreadsPanel from "@/components/shell/ChatThreadsPanel";
import { useTableADistanceContexte } from "./TableADistanceContexte";

/**
 * Le jeu à distance, côté MJ : la colonne droite (option A) porte « Table »
 * (chaque joueur, ce qu'on attend de lui, les jets en cours avec leur DD
 * caché) et « Privé » (les fils privés du chat de campagne, ADR 0038, où
 * arrivent aussi les demandes de pause et les sujets à éviter).
 */
export default function ColonneTableMj({ campaignId }: { campaignId: string }) {
  const t = useTranslations("distance");
  const { view } = useTableADistanceContexte();
  const [onglet, setOnglet] = useState<"table" | "prive">("table");
  const enCours = view.requests.filter((r) => r.status === "pending");

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <Tabs
        aria-label={t("colonneDroite")}
        value={onglet}
        onChange={setOnglet}
        items={[
          { value: "table", label: t("ongletTable") },
          { value: "prive", label: t("ongletPrive") },
        ]}
      />
      {onglet === "table" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-lg border border-edge bg-panel p-3">
          <section className="flex flex-col gap-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("joueurs")}</h3>
            {view.players.length === 0 && <p className="text-sm text-ink-muted">{t("aucunJoueur")}</p>}
            {view.players.map((j) => {
              const etat = view.waiting.find((w) => w.userId === j.userId);
              return (
                <div key={j.userId} className="flex items-center justify-between gap-2 rounded-md bg-panel-sunken px-2 py-1.5 text-sm">
                  <span className="text-players">{j.name}</span>
                  <span className={`text-xs ${etat?.reason === "waits_for_gm" ? "text-accent" : "text-ink-muted"}`}>
                    {etat === undefined ? t("rienEnAttente") : etat.reason === "waits_for_gm" ? t("tAttend") : etat.reason === "must_roll" ? t("doitLancerCourt") : t("doitRepondreCourt")}
                  </span>
                </div>
              );
            })}
          </section>
          <section className="flex flex-col gap-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("jetsEnCours")}</h3>
            {enCours.length === 0 && <p className="text-sm text-ink-muted">{t("aucunJetEnCours")}</p>}
            {enCours.map((r) => (
              <div key={r.id} className="flex items-baseline justify-between gap-2 rounded-md bg-panel-sunken px-2 py-1.5 text-sm">
                <span>
                  <span className="text-players">{r.targetName}</span> · {r.label}
                </span>
                <span className="text-xs text-ink-muted">
                  {r.dcShown !== null ? t("ddAnnonce", { dd: r.dcShown }) : r.dcHidden !== null ? t("ddCacheMj", { dd: r.dcHidden }) : t("sansDd")}
                </span>
              </div>
            ))}
          </section>
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <ChatThreadsPanel campaignId={campaignId} role="mj" />
        </div>
      )}
    </div>
  );
}
