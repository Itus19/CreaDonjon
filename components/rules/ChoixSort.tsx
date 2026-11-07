"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/**
 * V3.1-182 — Le choix d'un sort parmi ceux du monde (plusieurs centaines) :
 * un champ de recherche et quelques propositions dessous. La charte écarte le
 * `<select>` natif et `Dropdown` n'a pas de recherche ; le nom choisi
 * s'affiche, la clé part au serveur.
 */
export default function ChoixSort({ sorts, value, onChange }: { sorts: readonly { key: string; name: string }[]; value: string; onChange: (key: string) => void }) {
  const t = useTranslations("regles");
  const [requete, setRequete] = useState("");
  const choisi = sorts.find((s) => s.key === value);
  if (choisi) {
    return (
      <span className="flex items-center gap-2">
        <span className="rounded-md border border-edge px-2 py-1 text-sm text-ink">{choisi.name}</span>
        <button type="button" onClick={() => onChange("")} className="text-xs text-ink-muted hover:text-ink">
          {t("sortsAccordes.changer")}
        </button>
      </span>
    );
  }
  const q = requete.trim().toLocaleLowerCase("fr");
  const propositions = q.length < 2 ? [] : sorts.filter((s) => s.name.toLocaleLowerCase("fr").includes(q)).slice(0, 6);
  return (
    <span className="flex min-w-48 flex-col gap-1">
      <input
        value={requete}
        onChange={(e) => setRequete(e.target.value)}
        placeholder={t("sortsAccordes.chercher")}
        aria-label={t("sortsAccordes.chercher")}
        className="rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
      />
      {propositions.length > 0 && (
        <span className="flex flex-wrap gap-1">
          {propositions.map((s) => (
            <button key={s.key} type="button" onClick={() => onChange(s.key)} className="rounded-full border border-edge px-2.5 py-0.5 text-xs text-ink hover:bg-panel-raised">
              {s.name}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
