"use client";

import { useTranslations } from "next-intl";
import { BoutonPetit, ChampListe } from "@/components/rules/briques/ContexteBriques";
import { remplacerA, retirerA } from "@/lib/ui/briquesRegle";
import { BIOMES } from "@/src/core/worldgen/biomes";
import { SETTLEMENT_WEALTH, SETTLEMENT_ZONES, type SettlementBlockData, type SettlementShare } from "@/src/core/schemas/blocks/settlement";

const CHAMP = "w-full rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none";

/** Un entier aléatoire de 0 à 2^32-1, tiré par le navigateur (la graine ne vient jamais de l'IA). */
function tirerUneGraine(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}

/**
 * G-3 (ADR 0109) — le bloc « Ville » : les agrégats d'une ville. Peuples et
 * métiers sont des lignes « nom + poids » ; la graine fixe le tirage des
 * habitants, elle se tire d'un geste mais ne se saisit pas.
 */
export default function SettlementBlockEditor({ data, onChange }: { data: SettlementBlockData; onChange: (d: SettlementBlockData) => void }) {
  const t = useTranslations("fiche.ville");
  const optionsRang = SETTLEMENT_ZONES.map((z) => ({ value: z, label: t(`zones.${z}`) }));
  const optionsRichesse = SETTLEMENT_WEALTH.map((w) => ({ value: w, label: t(`richesses.${w}`) }));
  const optionsBiome = BIOMES.map((b) => ({ value: b, label: t(`biomes.${b}`) }));

  function listeEditable(champ: "peoples" | "trades", titre: string, libelleAjout: string) {
    const lignes = data[champ];
    const maj = (liste: SettlementShare[]) => onChange({ ...data, [champ]: liste });
    return (
      <div className="flex flex-col gap-2">
        <span className="text-xs text-ink-soft">{titre}</span>
        {lignes.map((ligne, i) => (
          <div key={i} className="grid grid-cols-[1fr_5rem_auto] items-end gap-2">
            <input aria-label={t("cle")} value={ligne.key} onChange={(e) => maj(remplacerA(lignes, i, { ...ligne, key: e.target.value }))} className={CHAMP} />
            <input
              aria-label={t("poids")}
              type="number"
              min={1}
              max={1000}
              step={1}
              value={ligne.share}
              onChange={(e) => {
                const poids = Number(e.target.value);
                if (Number.isInteger(poids) && poids >= 1 && poids <= 1000) maj(remplacerA(lignes, i, { ...ligne, share: poids }));
              }}
              className={`${CHAMP} font-mech`}
            />
            <button type="button" onClick={() => maj(retirerA(lignes, i))} className="pb-2 text-xs text-danger hover:underline">
              {t("retirer")}
            </button>
          </div>
        ))}
        <div>
          <BoutonPetit onClick={() => maj([...lignes, { key: "", share: 1 }])}>{libelleAjout}</BoutonPetit>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 @md:grid-cols-4">
        <label className="flex min-w-0 flex-col gap-1 text-xs text-ink-soft">
          {t("population")}
          <input
            type="number"
            min={0}
            step={1}
            value={data.population}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isInteger(n) && n >= 0 && n <= 10_000_000) onChange({ ...data, population: n });
            }}
            className={`${CHAMP} font-mech`}
          />
        </label>
        <ChampListe libelle={t("rang")} valeur={data.zone} options={optionsRang} onChange={(z) => onChange({ ...data, zone: SETTLEMENT_ZONES.find((x) => x === z) ?? data.zone })} />
        <ChampListe libelle={t("richesse")} valeur={data.wealth} options={optionsRichesse} onChange={(w) => onChange({ ...data, wealth: SETTLEMENT_WEALTH.find((x) => x === w) ?? data.wealth })} />
        <ChampListe libelle={t("biome")} valeur={data.biome} options={optionsBiome} onChange={(b) => onChange({ ...data, biome: BIOMES.find((x) => x === b) ?? data.biome })} />
      </div>
      {listeEditable("peoples", t("peuples"), t("ajouterPeuple"))}
      {listeEditable("trades", t("metiers"), t("ajouterMetier"))}
      <div className="flex items-center gap-3 text-xs text-ink-soft">
        <span>
          {t("graine")} : <span className="font-mech text-ink">{data.seed}</span>
        </span>
        <BoutonPetit onClick={() => onChange({ ...data, seed: tirerUneGraine() })}>{t("tirerGraine")}</BoutonPetit>
      </div>
    </div>
  );
}
