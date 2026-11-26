import { useTranslations } from "next-intl";
import type { SettlementBlockData, SettlementShare } from "@/src/core/schemas/blocks/settlement";

/**
 * G-3 — le bloc « Ville » en lecture : des paires clé/valeur, sans la graine
 * (un détail de tirage, pas une information du lieu).
 */
export default function SettlementView({ data }: { data: SettlementBlockData }) {
  const t = useTranslations("fiche.ville");
  const liste = (parts: readonly SettlementShare[]) => (parts.length === 0 ? t("aucun") : parts.map((p) => t("poidsEntre", { cle: p.key, poids: p.share })).join(", "));
  const lignes: { libelle: string; valeur: string }[] = [
    { libelle: t("population"), valeur: data.population.toLocaleString("fr-FR") },
    { libelle: t("rang"), valeur: t(`zones.${data.zone}`) },
    { libelle: t("richesse"), valeur: t(`richesses.${data.wealth}`) },
    { libelle: t("biome"), valeur: t(`biomes.${data.biome}`) },
    { libelle: t("peuples"), valeur: liste(data.peoples) },
    { libelle: t("metiers"), valeur: liste(data.trades) },
  ];
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      {lignes.map((l) => (
        <div key={l.libelle} className="contents">
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{l.libelle}</dt>
          <dd className="text-ink">{l.valeur}</dd>
        </div>
      ))}
    </dl>
  );
}
