"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Interrupteur from "@/components/rules/Interrupteur";
import RulesetSelector from "@/components/rules/RulesetSelector";
import ParticipantCharacterSheet from "@/components/shell/ParticipantCharacterSheet";
import type { FicheAvecPage } from "@/components/blocks/useAmorcerFicheAvecPage";
import { bornerInspirationMax, enregistrerReglagesTable, INTERRUPTEURS_TABLE, reglagesParDefaut } from "@/lib/ui/reglesActives";
import { mergeTableSettings, sheetControls, type CampaignTableSettings, type CampaignTableSettingsPatch } from "@/src/core/campaigns/tableSettings";
import type { ReglesActivesData } from "@/src/server/services/reglesActives";

const CARTE = "rounded-[18px] border border-edge bg-panel p-4 backdrop-blur-[var(--blur)]";

/**
 * Règles actives (V3.1-57) : le ruleset et son atelier d'un côté, la table de
 * l'autre (les six interrupteurs « ce que les joueurs modifient eux-mêmes »,
 * l'inspiration au plus, l'aperçu de la fiche d'une joueuse). Tout arrive en
 * props (docs/CABLAGE.md C1) ; l'aperçu suit l'état local sans requête, et
 * chaque geste n'envoie qu'un `PUT` du réglage touché.
 *
 * Disposition par requêtes de conteneur : large, deux colonnes ; moyen, une
 * colonne avec la table et l'aperçu d'abord (le geste fréquent) ; étroit, le
 * ruleset, la table, l'aperçu, puis « Variantes et import » replié.
 */
export default function ReglesActivesPanel({
  worldSlug,
  data,
  ficheAvecPage = null,
}: {
  worldSlug: string;
  data: ReglesActivesData;
  ficheAvecPage?: Promise<FicheAvecPage> | null;
}) {
  const t = useTranslations("regles");
  const { campaign, apercu } = data;

  const [reglages, setReglages] = useState<CampaignTableSettings | null>(campaign?.tableSettings ?? null);
  const [erreur, setErreur] = useState<string | null>(null);

  /** État local aussitôt, puis UNE requête ; en cas d'échec, l'état revient à la valeur d'avant. */
  async function appliquer(patch: CampaignTableSettingsPatch) {
    if (!campaign || !reglages) return;
    const avant = reglages;
    setReglages(mergeTableSettings(avant, patch));
    setErreur(null);
    const echec = await enregistrerReglagesTable(campaign.id, patch, t("table.erreur"));
    if (echec) {
      setReglages(avant);
      setErreur(echec);
    }
  }

  // Les commandes que verrait une joueuse (jamais le MJ), pour l'aperçu.
  const commandesJoueuse = reglages ? sheetControls(reglages, { callerIsGm: false }) : null;

  return (
    <div className="@container flex flex-col gap-4">
      <h1 className="block-title text-lg">{t("reglesActives")}</h1>

      <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] @3xl:grid-rows-[auto_auto_1fr] @3xl:items-start">
        <RulesetSelector
          worldSlug={worldSlug}
          options={data.options}
          current={data.current}
          classeRuleset="order-1 @md:order-2 @3xl:order-none @3xl:col-start-1"
          classeAtelier="order-3 @md:order-3 @3xl:order-none @3xl:col-start-1"
        />

        <div className="order-2 flex flex-col gap-4 @md:order-1 @3xl:order-none @3xl:col-start-2 @3xl:row-span-3 @3xl:row-start-1">
          {campaign && reglages && commandesJoueuse ? (
            <>
              <section className={`flex flex-col gap-3 ${CARTE}`}>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-ink">{t("table.titre")}</h2>
                  <button
                    type="button"
                    onClick={() => appliquer(reglagesParDefaut())}
                    className="rounded-full border border-edge px-2.5 py-1 text-xs text-ink-muted transition-colors hover:bg-panel-raised motion-reduce:transition-none"
                  >
                    {t("table.parDefaut")}
                  </button>
                </div>
                <p className="text-xs text-ink-muted">{t("table.aide")}</p>
                <div className="flex flex-col gap-3">
                  {INTERRUPTEURS_TABLE.map((champ) => {
                    const permis = reglages.player_can_edit[champ];
                    return (
                      <Interrupteur
                        key={champ}
                        actif={permis}
                        onChange={() => appliquer({ player_can_edit: { [champ]: !permis } })}
                        titre={t(`table.${champ}.titre`)}
                        aide={t(`table.${champ}.aide`)}
                        etat={<span className={`shrink-0 text-xs ${permis ? "text-accent" : "text-ink-muted"}`}>{permis ? t("table.joueuse") : t("table.mj")}</span>}
                      />
                    );
                  })}
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-edge/60 pt-3">
                  <span className="flex min-w-0 flex-col text-sm text-ink">
                    {t("table.inspirationMax")}
                    <small className="text-xs text-ink-muted">{t("table.inspirationMaxAide")}</small>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      aria-label={t("table.diminuer")}
                      disabled={reglages.inspiration_max <= 1}
                      onClick={() => appliquer({ inspiration_max: bornerInspirationMax(reglages.inspiration_max - 1) })}
                      className="h-7 w-7 rounded-full border border-edge text-sm text-ink transition-colors hover:bg-panel-raised disabled:opacity-50 motion-reduce:transition-none"
                    >
                      −
                    </button>
                    <b className="w-4 text-center text-sm font-medium tabular-nums text-ink">{reglages.inspiration_max}</b>
                    <button
                      type="button"
                      aria-label={t("table.augmenter")}
                      disabled={reglages.inspiration_max >= 5}
                      onClick={() => appliquer({ inspiration_max: bornerInspirationMax(reglages.inspiration_max + 1) })}
                      className="h-7 w-7 rounded-full border border-edge text-sm text-ink transition-colors hover:bg-panel-raised disabled:opacity-50 motion-reduce:transition-none"
                    >
                      +
                    </button>
                  </span>
                </div>
                {erreur && (
                  <p role="alert" className="text-xs text-danger">
                    {erreur}
                  </p>
                )}
              </section>

              <section className={`flex flex-col gap-3 ${CARTE}`}>
                {apercu ? (
                  <>
                    <div className="flex flex-col gap-0.5">
                      <h2 className="text-sm font-semibold text-ink">{t("table.apercuTitre", { nom: apercu.entityName })}</h2>
                      <p className="text-xs text-ink-muted">{t("table.apercuAide")}</p>
                    </div>
                    {/* La vraie fiche, en lecture : `inert` retire tout clic, toute touche et tout focus. */}
                    <div inert className="overflow-hidden rounded-xl border border-edge/60">
                      <ParticipantCharacterSheet
                        worldSlug={worldSlug}
                        campaignId={campaign.id}
                        entityId={apercu.entityId}
                        initialBlocks={apercu.blocks}
                        ficheAvecPage={ficheAvecPage}
                        commandesImposees={commandesJoueuse}
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-ink-muted">{t("table.apercuSansPersonnage")}</p>
                )}
              </section>
            </>
          ) : (
            <section className={CARTE}>
              <p className="text-sm text-ink-muted">{t("table.sansCampagne")}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
