"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { MusicBlockData, MusicTrack } from "@/src/core/schemas/blocks/music";
import { PROVIDER_LABELS } from "@/src/core/music/embedUrl";
import { useMusicPlayback, useMusicProgress } from "@/components/shell/MusicPlaybackContext";
import Checkbox from "@/components/shared/Checkbox";
import {
  FONDU_PAR_DEFAUT_MS,
  capacites,
  dureeJouee,
  progressionPiste,
  texteProgression,
  deplacerPiste,
  ecrireTemps,
  formaterFondu,
  lireTemps,
  noteFondus,
  pasFondu,
  texteBornes,
  validerLien,
  validerPiste,
} from "@/lib/ui/musique";

/**
 * Bloc `music` (V2-G3, refait en V3.1-77 « A »). Une « station » est ce bloc —
 * son nom est le `display.label` du bloc, jamais une catégorie fournie par
 * l'application. Chaque piste est un lien externe (Spotify, SoundCloud, YouTube),
 * jamais un fichier hébergé par nous.
 *
 * La platine en tête, la liste dessous (⠿ pour ranger), « ⋯ » qui ouvre sous
 * la piste ses bornes (YouTube seulement, ADR 0022 ; pour Spotify et SoundCloud,
 * la phrase qui dit pourquoi), puis les réglages. Aucun lecteur visible : la
 * lecture passe par le lecteur caché partagé (`MusicPlaybackProvider`), un seul
 * à la fois pour toute l'application.
 *
 * Les fondus sont lus dans `data` AU MOMENT où une piste est lancée : la
 * nouvelle durée s'applique donc au prochain fondu qu'on déclenche. Ni la
 * progression ni les temps de la piste ne sont affichés : le lecteur partagé
 * ne les expose pas (et il ne change pas, V3.1-77).
 *
 * V2.1-6 : ce bloc ne s'affiche plus du tout sur les pages de lecture (voir
 * `PublicMusicToggle`), mais garde ici son affichage complet.
 */
export default function MusicBlockEditor({
  data,
  onChange,
  blockId,
}: {
  data: MusicBlockData;
  onChange: (data: MusicBlockData) => void;
  blockId: string;
}) {
  const t = useTranslations("fiche.musique");
  const dndId = useId();
  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [courant, setCourant] = useState(0);
  const [ouvertId, setOuvertId] = useState<string | null>(null);
  const { currentKey, play, stop } = useMusicPlayback();
  const suivi = useMusicProgress();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const tracks = data.tracks;
  const fadeIn = data.fadeInMs ?? FONDU_PAR_DEFAUT_MS;
  const fadeOut = data.fadeOutMs ?? FONDU_PAR_DEFAUT_MS;
  const piste = tracks[Math.min(courant, tracks.length - 1)];
  const cleDe = (track: MusicTrack) => `block:${blockId}:${track.id}`;

  /** Lance une piste avec les fondus et la boucle du bloc, lus ICI : la nouvelle durée vaut pour ce fondu-ci. */
  function lancer(track: MusicTrack) {
    play({ key: cleDe(track), tracks: [track], fadeInMs: fadeIn, fadeOutMs: fadeOut, loop: data.loop === true });
  }

  function toggleTrack(track: MusicTrack) {
    if (currentKey === cleDe(track)) stop();
    else lancer(track);
  }

  function aller(sens: 1 | -1) {
    if (tracks.length === 0) return;
    const suivant = (Math.min(courant, tracks.length - 1) + sens + tracks.length) % tracks.length;
    setCourant(suivant);
    if (piste && currentKey === cleDe(piste)) lancer(tracks[suivant]);
  }

  function addTrack() {
    const url = urlInput.trim();
    if (!url) return;
    const verdict = validerLien(url);
    if (!verdict.ok) {
      setError(verdict.message);
      return;
    }
    onChange({ ...data, tracks: [...tracks, { id: crypto.randomUUID(), url }] });
    setUrlInput("");
    setError(null);
  }

  function removeTrack(track: MusicTrack) {
    if (currentKey === cleDe(track)) stop();
    setOuvertId(null);
    onChange({ ...data, tracks: tracks.filter((x) => x.id !== track.id) });
  }

  function renameTrack(track: MusicTrack, title: string) {
    onChange({ ...data, tracks: tracks.map((x) => (x.id === track.id ? { ...x, title: title || undefined } : x)) });
  }

  /**
   * Une borne vide retire le champ plutôt que d'y poser 0 : `startSeconds: 0` et
   * « pas de borne » se ressemblent à l'œil mais pas dans la donnée. Le schéma
   * du bloc décide (fin > début, plafond de 24 h) ; on rend son message.
   */
  function setBorne(track: MusicTrack, champ: "startSeconds" | "endSeconds", secondes: number | undefined): string | null {
    const candidate: MusicTrack = { ...track, [champ]: secondes };
    if (secondes === undefined) delete candidate[champ];
    const verdict = validerPiste(candidate);
    if (!verdict.ok) return verdict.message;
    onChange({ ...data, tracks: tracks.map((x) => (x.id === track.id ? candidate : x)) });
    return null;
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const de = tracks.findIndex((x) => x.id === active.id);
    const vers = tracks.findIndex((x) => x.id === over.id);
    if (de === -1 || vers === -1) return;
    onChange({ ...data, tracks: deplacerPiste(tracks, de, vers) });
  }

  const fondusActifs = fadeIn > 0 || fadeOut > 0;
  const note = piste ? noteFondus(piste.url, fadeIn, fadeOut) : null;
  const bornesPiste = piste ? texteBornes(piste.startSeconds, piste.endSeconds, { debut: t("debut"), fin: t("fin") }) : null;
  const service = piste ? capacites(piste.url).service : null;
  const joue = piste ? currentKey === cleDe(piste) : false;
  // V3.1-146 : YouTube seulement, et seulement la piste dont on relève la position.
  const progression =
    piste && capacites(piste.url).fondus && suivi.cle === cleDe(piste) ? progressionPiste(suivi.position, suivi.duree, piste.startSeconds, piste.endSeconds) : null;

  return (
    <div className="flex flex-col gap-3">
      {piste && (
        <div className="flex items-center gap-3 rounded-xl border border-edge bg-panel-sunken p-3">
          <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-panel-raised text-lg text-ink-muted">
            ♪
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-ink">{piste.title || t("sansTitre")}</div>
            <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-ink-muted">
              {service && <span className="rounded-full border border-edge px-2 py-0.5 text-ink-soft">{PROVIDER_LABELS[service]}</span>}
              <span>
                {note?.cle === "fondus"
                  ? note.entrant === note.sortant
                    ? t("fondus", { duree: note.entrant })
                    : t("fondusDeux", { entrant: note.entrant, sortant: note.sortant })
                  : t("pasDeFondu", { service: note?.service ? PROVIDER_LABELS[note.service] : "" })}
              </span>
              {bornesPiste && <span>· {t("joue", { bornes: bornesPiste })}</span>}
            </div>
            {progression && (
              <div className="mt-1.5 flex items-center gap-2">
                <div
                  role="progressbar"
                  aria-label={t("progression")}
                  aria-valuemin={0}
                  aria-valuemax={Math.floor(progression.total)}
                  aria-valuenow={Math.floor(progression.ecoule)}
                  aria-valuetext={texteProgression(progression)}
                  className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-panel-raised"
                >
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(progression.ratio * 1000) / 10}%` }} />
                </div>
                <span className="shrink-0 text-xs tabular-nums text-ink-muted">{texteProgression(progression)}</span>
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={() => aller(-1)} aria-label={t("precedente")} className="rounded-full px-2 py-1 text-sm text-ink-muted transition-colors hover:text-ink">
              ◂◂
            </button>
            <button
              type="button"
              onClick={() => toggleTrack(piste)}
              aria-label={joue ? t("pause") : t("lecture")}
              className="rounded-full bg-accent px-3.5 py-1.5 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover"
            >
              {joue ? "⏸" : "▶"}
            </button>
            <button type="button" onClick={() => aller(1)} aria-label={t("suivante")} className="rounded-full px-2 py-1 text-sm text-ink-muted transition-colors hover:text-ink">
              ▸▸
            </button>
          </div>
        </div>
      )}

      {tracks.length === 0 ? (
        <p className="text-sm text-ink-muted">{t("aucunePiste")}</p>
      ) : (
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          accessibility={{ screenReaderInstructions: { draggable: t("reordonner") } }}
        >
          <SortableContext items={tracks.map((x) => x.id)} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col">
              {tracks.map((track) => (
                <LignePiste
                  key={track.id}
                  track={track}
                  joue={currentKey === cleDe(track)}
                  duree={capacites(track.url).fondus ? dureeJouee(suivi.durees[cleDe(track)] ?? 0, track.startSeconds, track.endSeconds) : null}
                  ouvert={ouvertId === track.id}
                  onLecture={() => toggleTrack(track)}
                  onTitre={(titre) => renameTrack(track, titre)}
                  onBascule={() => setOuvertId(ouvertId === track.id ? null : track.id)}
                  onBorne={(champ, secondes) => setBorne(track, champ, secondes)}
                  onRetirer={() => removeTrack(track)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <div className="flex items-center gap-2">
        <input
          value={urlInput}
          onChange={(e) => {
            setUrlInput(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") addTrack();
          }}
          placeholder={t("lienPlaceholder")}
          aria-label={t("lienLabel")}
          className="min-w-0 flex-1 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={addTrack}
          className="shrink-0 rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
        >
          {t("ajouter")}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}

      {/* V2.1-6 : le bloc étant invisible sur les pages de lecture, ces réglages sont le seul endroit où son comportement se décide. */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
        <Checkbox
          checked={data.autoplayOnVisit === true}
          onChange={() => onChange({ ...data, autoplayOnVisit: !data.autoplayOnVisit })}
          label={<span className="text-xs text-ink-soft">{t("autoplay")}</span>}
        />
        <Checkbox
          checked={data.loop === true}
          onChange={() => onChange({ ...data, loop: !data.loop })}
          label={<span className="text-xs text-ink-soft">{t("boucle")}</span>}
        />
        <Checkbox
          checked={fondusActifs}
          onChange={() => onChange({ ...data, fadeInMs: fondusActifs ? 0 : FONDU_PAR_DEFAUT_MS, fadeOutMs: fondusActifs ? 0 : FONDU_PAR_DEFAUT_MS })}
          label={<span className="text-xs text-ink-soft">{t("fondusInterrupteur")}</span>}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <PasFondu libelle={t("fonduEntrant")} valeur={fadeIn} onChange={(v) => onChange({ ...data, fadeInMs: v })} />
        <PasFondu libelle={t("fonduSortant")} valeur={fadeOut} onChange={(v) => onChange({ ...data, fadeOutMs: v })} />
        <span className="text-xs text-ink-muted">{t("fonduAide")}</span>
      </div>

      <p className="text-xs text-ink-muted">
        {t("rappel")} <span aria-hidden>♪</span> · {data.autoplayOnVisit ? t("rappelAuto") : t("rappelManuel")}
      </p>
    </div>
  );
}

function LignePiste({
  track,
  joue,
  duree,
  ouvert,
  onLecture,
  onTitre,
  onBascule,
  onBorne,
  onRetirer,
}: {
  track: MusicTrack;
  joue: boolean;
  /** V3.1-146 : durée jouée d'une piste YouTube, une fois connue (après sa première lecture) ; `null` sinon. */
  duree: number | null;
  ouvert: boolean;
  onLecture: () => void;
  onTitre: (titre: string) => void;
  onBascule: () => void;
  /** Écrit une borne ; rend le message du schéma si elle est refusée. */
  onBorne: (champ: "startSeconds" | "endSeconds", secondes: number | undefined) => string | null;
  onRetirer: () => void;
}) {
  const t = useTranslations("fiche.musique");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: track.id });
  const cap = capacites(track.url);
  const bornes = texteBornes(track.startSeconds, track.endSeconds, { debut: t("debut"), fin: t("fin") });
  const nom = track.title || t("sansTitre");

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex flex-col border-t border-edge first:border-t-0 ${isDragging ? "relative z-10 rounded-lg bg-panel-raised shadow-2xl" : ""} ${joue ? "rounded-lg bg-accent/10" : ""}`}
    >
      <div className="flex items-center gap-2 px-1.5 py-1.5 text-sm">
        <button
          type="button"
          onClick={onLecture}
          aria-label={joue ? t("pauseNom", { nom }) : t("lectureNom", { nom })}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs transition-colors ${
            joue ? "border-accent bg-accent text-accent-ink" : "border-edge-strong text-ink hover:border-accent"
          }`}
        >
          {joue ? "⏸" : "▶"}
        </button>
        {/* La poignée de rangement disparaît au téléphone (fenêtre étroite), comme les durées. */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={t("poignee", { nom })}
          title={t("poigneeTitre")}
          className="hidden shrink-0 cursor-grab touch-none text-ink-muted transition-colors hover:text-ink active:cursor-grabbing @md/bloc:block"
        >
          ⠿
        </button>
        <div className="flex min-w-0 flex-1 flex-col">
          <input
            value={track.title ?? ""}
            onChange={(e) => onTitre(e.target.value)}
            placeholder={t("titrePlaceholder")}
            aria-label={t("titreLabel")}
            className={`min-w-0 truncate bg-transparent text-sm outline-none ${joue ? "text-accent" : "text-ink"}`}
          />
          {bornes && <span className="text-xs text-ink-muted">{bornes}</span>}
        </div>
        {duree !== null && <span className="hidden shrink-0 text-xs tabular-nums text-ink-muted @md/bloc:block">{ecrireTemps(Math.floor(duree))}</span>}
        {cap.service && <span className="shrink-0 text-xs text-ink-muted">{PROVIDER_LABELS[cap.service]}</span>}
        <button
          type="button"
          aria-expanded={ouvert}
          aria-label={t("reglagesPiste", { nom })}
          title={t("reglagesTitre")}
          onClick={onBascule}
          className="shrink-0 rounded-md px-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
        >
          ⋯
        </button>
      </div>

      {ouvert && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-2 pb-2.5 pl-10 text-xs text-ink-soft">
          {cap.bornes ? (
            <>
              <ChampTemps
                key={`d${track.startSeconds ?? ""}`}
                libelle={t("commencerA")}
                placeholder="0:00"
                valeur={track.startSeconds}
                onValider={(s) => onBorne("startSeconds", s)}
              />
              <ChampTemps
                key={`f${track.endSeconds ?? ""}`}
                libelle={t("finirA")}
                placeholder={t("fin")}
                valeur={track.endSeconds}
                onValider={(s) => onBorne("endSeconds", s)}
              />
              <span className="text-ink-muted">{t("pisteEntiere")}</span>
            </>
          ) : (
            <span className="text-ink-muted">{t("pasDeBornes", { service: cap.service ? PROVIDER_LABELS[cap.service] : "" })}</span>
          )}
          <button
            type="button"
            onClick={onRetirer}
            className="ml-auto rounded-full border border-edge px-3 py-1 text-ink transition-colors hover:border-danger hover:text-danger"
          >
            {t("retirerPiste")}
          </button>
        </div>
      )}
    </li>
  );
}

/**
 * Un temps « m:ss » : on tape dans un brouillon, la valeur se pose en quittant
 * le champ (ou Entrée). Vide efface la borne ; une saisie qui n'est pas un temps,
 * ou refusée par le schéma, dit pourquoi et ne change rien.
 */
function ChampTemps({
  libelle,
  placeholder,
  valeur,
  onValider,
}: {
  libelle: string;
  placeholder: string;
  valeur: number | undefined;
  /** Écrit la borne ; rend le message du schéma si elle est refusée. */
  onValider: (secondes: number | undefined) => string | null;
}) {
  const t = useTranslations("fiche.musique");
  const [brouillon, setBrouillon] = useState(ecrireTemps(valeur));
  const [refus, setRefus] = useState<string | null>(null);

  function valider() {
    const lu = lireTemps(brouillon);
    if (!lu.ok) {
      setRefus(t("tempsInvalide"));
      return;
    }
    if (lu.secondes === valeur) {
      setRefus(null);
      return;
    }
    const message = onValider(lu.secondes);
    setRefus(message);
  }

  return (
    <span className="flex flex-col gap-0.5">
      <label className="inline-flex items-center gap-1.5">
        {libelle}
        <input
          value={brouillon}
          onChange={(e) => {
            setBrouillon(e.target.value);
            setRefus(null);
          }}
          onBlur={valider}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          placeholder={placeholder}
          inputMode="numeric"
          className="w-16 rounded-md border border-edge bg-transparent px-2 py-1 text-xs text-ink outline-none focus:border-accent"
        />
      </label>
      {refus && (
        <span role="alert" className="text-danger">
          {refus}
        </span>
      )}
    </span>
  );
}

/** Pas-à-pas d'un fondu : 0 à 5 s, de 0,5 s en 0,5 s, affiché « 1,5 s ». */
function PasFondu({ libelle, valeur, onChange }: { libelle: string; valeur: number; onChange: (ms: number) => void }) {
  const t = useTranslations("fiche.musique");
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-edge py-0.5 pl-2.5 pr-1 text-xs text-ink-soft">
      {libelle}
      <button
        type="button"
        onClick={() => onChange(pasFondu(valeur, -1))}
        aria-label={t("moins", { libelle })}
        className="h-5 w-5 rounded-full border border-edge bg-panel-sunken text-ink transition-colors hover:border-accent"
      >
        −
      </button>
      <b className="min-w-9 text-center text-ink">{formaterFondu(valeur)}</b>
      <button
        type="button"
        onClick={() => onChange(pasFondu(valeur, 1))}
        aria-label={t("plus", { libelle })}
        className="h-5 w-5 rounded-full border border-edge bg-panel-sunken text-ink transition-colors hover:border-accent"
      >
        +
      </button>
    </span>
  );
}
