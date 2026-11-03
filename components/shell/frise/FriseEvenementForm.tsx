"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { addTimelineEventAction } from "@/app/m/[worldSlug]/(monde)/chronologie/actions";
import Dropdown from "@/components/shared/Dropdown";
import GameDateInput from "@/components/shared/GameDateInput";
import { VISIBILITY_OPTIONS } from "@/components/shared/visibilityOptions";

/**
 * Sans « Privé » : une date de la frise ne retient pas son auteur, le filtre
 * serveur la refuserait donc à tout le monde, MJ compris (même règle que la
 * pastille, `sansPrive`).
 */
const NIVEAUX_FRISE = VISIBILITY_OPTIONS.filter((o) => o.value !== "private");
import type { GameDate } from "@/src/core/calendar/types";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";
import { TIMELINE_ENTRY_KINDS, TIMELINE_SCOPES, type TimelineEntryKind, type TimelineScope } from "@/src/core/schemas/blocks/timeline";

const CHAMP = "rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none";

/**
 * « + Événement » (V3.1-98) : date au calendrier du monde, genre, titre,
 * résumé, visibilité, portée, et « dans : la frise générale ou une fiche ».
 * L'écriture passe par `addTimelineEventAction` (Zod et droits côté serveur) ;
 * la page se relit d'elle-même (l'action la revalide).
 */
export default function FriseEvenementForm({
  worldSlug,
  calendrier,
  fiches,
  dateDepart,
  onFermer,
}: {
  worldSlug: string;
  calendrier: CalendarConfigInput;
  fiches: { id: string; nom: string }[];
  dateDepart: GameDate;
  onFermer: () => void;
}) {
  const t = useTranslations("frise.form");
  const tg = useTranslations("fiche.chronologie.genres");
  const tp = useTranslations("frise.carte.portee");
  const [date, setDate] = useState<GameDate>(dateDepart);
  const [genre, setGenre] = useState<TimelineEntryKind>("custom");
  const [titre, setTitre] = useState("");
  const [resume, setResume] = useState("");
  const [visibilite, setVisibilite] = useState<string>("public");
  const [portee, setPortee] = useState<string>("auto");
  const [cible, setCible] = useState<string>("monde");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function ajouter() {
    setEnCours(true);
    setErreur(null);
    const res = await addTimelineEventAction({
      worldSlug,
      target: cible === "monde" ? { kind: "world" } : { kind: "entity", entityId: cible },
      event: {
        date,
        kind: genre,
        title: titre,
        summary: resume,
        visibility: { level: visibilite, scopeId: null },
        ...(portee === "auto" ? {} : { scope: portee as TimelineScope }),
      },
    });
    setEnCours(false);
    if (!res.ok) {
      setErreur(res.error || t("erreur"));
      return;
    }
    onFermer();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void ajouter();
      }}
      className="flex flex-col gap-3 rounded-lg border border-edge bg-panel p-4"
    >
      <h2 className="text-sm font-semibold text-ink">{t("titre")}</h2>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-ink-muted">{t("date")}</span>
        <GameDateInput calendar={calendrier} value={date} onChange={setDate} />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-xs text-ink-muted">
          {t("titreLabel")}
          <input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder={t("titrePlaceholder")} maxLength={200} className={CHAMP} />
        </label>
        <Dropdown
          size="md"
          value={genre}
          options={TIMELINE_ENTRY_KINDS.map((k) => ({ value: k, label: tg(k) }))}
          onChange={(v) => setGenre(v as TimelineEntryKind)}
          aria-label={t("genre")}
        />
      </div>
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        {t("resume")}
        <textarea value={resume} onChange={(e) => setResume(e.target.value)} rows={2} maxLength={4000} className={CHAMP} />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Dropdown size="md" value={visibilite} options={NIVEAUX_FRISE} onChange={setVisibilite} aria-label={t("visibilite")} />
        <Dropdown
          size="md"
          value={portee}
          options={[{ value: "auto", label: t("porteeAuto") }, ...TIMELINE_SCOPES.map((s) => ({ value: s, label: tp(s) }))]}
          onChange={setPortee}
          aria-label={t("portee")}
        />
        <Dropdown
          size="md"
          value={cible}
          options={[{ value: "monde", label: t("friseGenerale") }, ...fiches.map((f) => ({ value: f.id, label: f.nom }))]}
          onChange={setCible}
          aria-label={t("dans")}
        />
      </div>
      {erreur && (
        <p role="alert" className="text-sm text-danger">
          {erreur}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={enCours || titre.trim() === ""}
          className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {enCours ? t("enCours") : t("ajouter")}
        </button>
        <button
          type="button"
          onClick={onFermer}
          className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
        >
          {t("annuler")}
        </button>
      </div>
    </form>
  );
}
