"use client";

import { useTranslations } from "next-intl";
import VisibilityPill from "@/components/shared/VisibilityPill";
import type { Aspiration } from "@/src/core/schemas/blocks/personality";
import { HORIZONS, intensiteSuivante, regrouperAspirations } from "@/lib/ui/psycheBloc";

/** Bouton « + … » discret, au pied d'une colonne ou d'une liste. */
const AJOUTER =
  "self-start text-xs text-accent transition-colors hover:text-accent-hover hover:underline";

/**
 * V3.1-70 — les aspirations en trois colonnes (Une vie, En ce moment, Ce
 * soir). Chaque aspiration : le texte, l'intensité en trois points (toucher =
 * la suivante) et la visibilité en pastille (`VisibilityPill`, qui écrit tout
 * de suite par `onVisibilite`).
 */
export function AspirationsColonnes({
  aspirations,
  onChange,
  onVisibilite,
  nonAuteur,
}: {
  aspirations: Aspiration[];
  onChange: (aspirations: Aspiration[]) => void;
  /** Écrit la visibilité d'UNE aspiration tout de suite ; `true` si le serveur l'a acceptée. */
  onVisibilite: (id: string, niveau: string) => Promise<boolean>;
  nonAuteur: boolean;
}) {
  const t = useTranslations("fiche.psyche");
  const groupes = regrouperAspirations(aspirations);

  function maj(id: string, patch: Partial<Aspiration>) {
    onChange(aspirations.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }
  function ajouter(horizon: Aspiration["horizon"]) {
    onChange([
      ...aspirations,
      { id: crypto.randomUUID(), text: "", horizon, intensity: 2, visibility: { level: "public", scopeId: null } },
    ]);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("aspirations")}</span>
      <div className="grid grid-cols-1 gap-2 @2xl/bloc:grid-cols-3">
        {HORIZONS.map((horizon) => (
          <div key={horizon} className="flex flex-col gap-1.5 rounded-xl border border-edge bg-panel-sunken p-2.5">
            <span className="text-xs uppercase tracking-wider text-ink-muted">{t(`horizons.${horizon}`)}</span>
            {groupes[horizon].map((a) => (
              <div key={a.id} className="flex flex-col gap-1 border-t border-edge pt-1.5 first-of-type:border-t-0 first-of-type:pt-0">
                <input
                  value={a.text}
                  onChange={(e) => maj(a.id, { text: e.target.value })}
                  placeholder={t("aspirationPlaceholder")}
                  aria-label={t("aspirationLabel")}
                  className="bg-transparent text-sm text-ink outline-none"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => maj(a.id, { intensity: intensiteSuivante(a.intensity) })}
                    aria-label={t("intensite", { n: a.intensity })}
                    title={t("intensiteTitre")}
                    className="inline-flex gap-1"
                  >
                    {[1, 2, 3].map((n) => (
                      <span
                        key={n}
                        aria-hidden
                        className={`h-2 w-2 rounded-full border border-accent ${n <= a.intensity ? "bg-accent" : ""}`}
                      />
                    ))}
                  </button>
                  <span className="flex-1" />
                  <VisibilityPill
                    niveau={a.visibility.level}
                    onChange={(niveau) => onVisibilite(a.id, niveau)}
                    objet={a.text || t("aspirationSansTexte")}
                    sansPrive={nonAuteur}
                  />
                  <button
                    type="button"
                    onClick={() => onChange(aspirations.filter((x) => x.id !== a.id))}
                    aria-label={t("retirerAspiration")}
                    className="rounded-md px-1 text-sm text-ink-muted transition-colors hover:text-danger"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
            <button type="button" onClick={() => ajouter(horizon)} className={AJOUTER}>
              {t("ajouterAspiration")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ListeDeLignes({
  titre,
  items,
  placeholder,
  onChange,
}: {
  titre: string;
  items: string[];
  placeholder: string;
  onChange: (items: string[]) => void;
}) {
  const t = useTranslations("fiche.psyche");
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-edge bg-panel-sunken p-2.5">
      <span className="text-xs uppercase tracking-wider text-ink-muted">{titre}</span>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span aria-hidden className="text-ink-muted">
            —
          </span>
          <input
            value={item}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
            placeholder={placeholder}
            aria-label={titre}
            className="min-w-0 flex-1 bg-transparent text-sm text-ink-soft outline-none"
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            aria-label={t("retirerLigne")}
            className="rounded-md px-1 text-sm text-ink-muted transition-colors hover:text-danger"
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, ""])} className={AJOUTER}>
        {t("ajouterLigne")}
      </button>
    </div>
  );
}

/** « Ne fera jamais » et « Fera, à contrecœur » côte à côte (une colonne dans une fenêtre étroite). */
export function LignesEtLimites({
  lines,
  limits,
  onLines,
  onLimits,
}: {
  lines: string[];
  limits: string[];
  onLines: (items: string[]) => void;
  onLimits: (items: string[]) => void;
}) {
  const t = useTranslations("fiche.psyche");
  return (
    <div className="grid grid-cols-1 gap-2 @xl/bloc:grid-cols-2">
      <ListeDeLignes titre={t("jamais")} items={lines} placeholder={t("jamaisPlaceholder")} onChange={onLines} />
      <ListeDeLignes titre={t("contrecoeur")} items={limits} placeholder={t("contrecoeurPlaceholder")} onChange={onLimits} />
    </div>
  );
}

/** Pastille éditable : un champ qui prend la largeur de son texte. */
function PastilleChamp({
  value,
  onChange,
  placeholder,
  label,
  onRetirer,
  retirerLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
  onRetirer?: () => void;
  retirerLabel?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-edge py-0.5 pl-2.5 pr-1 text-xs text-ink-soft">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        size={Math.max(value.length, placeholder.length > 12 ? 12 : placeholder.length, 4)}
        className="bg-transparent outline-none"
      />
      {onRetirer && (
        <button type="button" onClick={onRetirer} aria-label={retirerLabel} className="px-1 text-ink-muted transition-colors hover:text-danger">
          ×
        </button>
      )}
    </span>
  );
}

/** Façon de parler : le registre et les tics de langage en pastilles. */
export function FaconDeParler({
  register,
  tics,
  onRegister,
  onTics,
}: {
  register: string;
  tics: string[];
  onRegister: (v: string) => void;
  onTics: (v: string[]) => void;
}) {
  const t = useTranslations("fiche.psyche");
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("parler")}</span>
      <PastilleChamp value={register} onChange={onRegister} placeholder={t("registrePlaceholder")} label={t("registreLabel")} />
      {tics.map((tic, i) => (
        <PastilleChamp
          key={i}
          value={tic}
          onChange={(v) => onTics(tics.map((x, j) => (j === i ? v : x)))}
          placeholder={t("ticPlaceholder")}
          label={t("ticLabel")}
          onRetirer={() => onTics(tics.filter((_, j) => j !== i))}
          retirerLabel={t("retirerTic")}
        />
      ))}
      <button type="button" onClick={() => onTics([...tics, ""])} className={AJOUTER}>
        {t("ajouterTic")}
      </button>
    </div>
  );
}
