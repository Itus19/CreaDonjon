"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Dropdown from "@/components/shared/Dropdown";
import type { EncounterMonsterSummary } from "@/src/server/services/encounters";
import type { AjoutParticipant } from "@/lib/ui/initiativeApi";

type Mode = "entity" | "statblock" | "custom";

const CHAMP = "rounded-md border border-edge bg-transparent px-2 py-1 text-xs text-ink outline-none focus:border-accent";

/** « + Ajouter » : un PJ, un monstre du ruleset, ou un adversaire saisi à la main — avec sa CA et ses PV dès l'ajout. */
export default function FormulaireAjout({
  pcOptions,
  monsters,
  occupe,
  onAjouter,
}: {
  pcOptions: { id: string; name: string }[];
  monsters: EncounterMonsterSummary[];
  occupe: boolean;
  onAjouter: (ajout: AjoutParticipant) => Promise<boolean>;
}) {
  const t = useTranslations("initiative");
  const [mode, setMode] = useState<Mode>("statblock");
  const [recherche, setRecherche] = useState("");
  const [monstre, setMonstre] = useState<EncounterMonsterSummary | null>(null);
  const [pcId, setPcId] = useState(pcOptions[0]?.id ?? "");
  const [nom, setNom] = useState("");
  const [ca, setCa] = useState("");
  const [pv, setPv] = useState("");

  const trouves = monsters.filter((m) => m.name.toLowerCase().includes(recherche.toLowerCase())).slice(0, 8);
  const nombre = (saisie: string): number | null => {
    const n = Number(saisie);
    return saisie.trim() !== "" && Number.isInteger(n) && n > 0 ? n : null;
  };
  const caSaisie = nombre(ca);
  const pvSaisis = nombre(pv);

  function construire(): AjoutParticipant | null {
    if (mode === "entity") return pcId ? { sourceKind: "entity", entityId: pcId, isAlly: true } : null;
    if (mode === "statblock") return monstre ? { sourceKind: "statblock", entryKey: monstre.key, label: monstre.name, isAlly: false } : null;
    if (nom.trim() === "") return null;
    return { sourceKind: "custom", label: nom.trim(), isAlly: false, ac: caSaisie, hpMax: pvSaisis };
  }

  const ajout = construire();

  return (
    <div className="flex flex-col gap-2 rounded-[18px] border border-edge bg-panel p-3 backdrop-blur-[var(--blur)]">
      <Dropdown
        value={mode}
        onChange={(v) => setMode(v as Mode)}
        aria-label={t("typeAjout")}
        options={[
          { value: "entity", label: t("ajoutPj") },
          { value: "statblock", label: t("ajoutMonstre") },
          { value: "custom", label: t("ajoutLibre") },
        ]}
      />
      {mode === "entity" && (
        <Dropdown value={pcId} onChange={setPcId} aria-label={t("choixPj")} options={pcOptions.map((p) => ({ value: p.id, label: p.name }))} />
      )}
      {mode === "statblock" && (
        <div className="flex flex-col gap-1">
          <input
            value={monstre ? monstre.name : recherche}
            onChange={(e) => {
              setMonstre(null);
              setRecherche(e.target.value);
            }}
            placeholder={t("rechercherMonstre")}
            aria-label={t("rechercherMonstre")}
            className={CHAMP}
          />
          {recherche && !monstre && (
            <div className="max-h-40 overflow-y-auto rounded-md border border-edge">
              {trouves.map((m) => (
                <button key={m.key} type="button" onClick={() => setMonstre(m)} className="block w-full px-2 py-1 text-left text-xs text-ink hover:bg-panel-raised">
                  {m.name} ({t("fp", { fp: m.challengeRatingLabel })})
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {mode === "custom" && (
        <div className="flex flex-wrap gap-2">
          <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder={t("nomLibre")} aria-label={t("nomLibre")} className={`${CHAMP} min-w-[10rem] flex-1`} />
          <input value={ca} onChange={(e) => setCa(e.target.value)} inputMode="numeric" placeholder={t("ca")} aria-label={t("classeArmure")} className={`${CHAMP} w-16 text-center`} />
          <input value={pv} onChange={(e) => setPv(e.target.value)} inputMode="numeric" placeholder={t("pv")} aria-label={t("pointsDeVieMax")} className={`${CHAMP} w-16 text-center`} />
        </div>
      )}
      <button
        type="button"
        disabled={occupe || ajout === null}
        onClick={async () => {
          if (!ajout) return;
          if (await onAjouter(ajout)) {
            setNom("");
            setCa("");
            setPv("");
            setMonstre(null);
            setRecherche("");
          }
        }}
        className="self-start rounded-full border border-accent px-3 py-1 text-xs text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
      >
        {t("ajouter")}
      </button>
    </div>
  );
}
