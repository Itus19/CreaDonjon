"use client";

import { useState } from "react";
import type { MusicBlockData } from "@/src/core/schemas/blocks/music";
import { PROVIDER_LABELS, detectProvider, youtubeVideoId } from "@/src/core/music/embedUrl";
import { useMusicPlayback } from "@/components/shell/MusicPlaybackContext";
import Checkbox from "@/components/shared/Checkbox";

/**
 * Bloc `music` (V2-G3, etendu sur demande explicite) : une "station" est ce
 * bloc — son nom est le `display.label` du bloc lui-meme (comme tout bloc),
 * jamais une categorie fournie par l'application. Chaque piste est un lien
 * externe vers Spotify/SoundCloud/YouTube, jamais un fichier heberge par
 * nous, et porte son propre nom choisi par la personne (ex. "Arrivee du
 * mechant") pour la retrouver dans la liste.
 *
 * Aucun lecteur visible : la lecture passe par le lecteur cache partage de
 * `MusicPlaybackProvider` (un seul a la fois pour toute l'app), qui met
 * donc en pause la radio d'arriere-plan si une piste de ce bloc est lancee,
 * et inversement — exactement le comportement demande.
 *
 * V2.1-6 : ce bloc ne s'affiche plus du tout sur les pages de lecture (voir
 * `PublicMusicToggle`), mais garde ici son affichage complet — une fiche
 * qu'on modifie n'est pas une fiche qu'on visite pour son ambiance.
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
  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { currentKey, play, stop } = useMusicPlayback();

  const tracks = data.tracks;

  function addTrack() {
    const url = urlInput.trim();
    if (!url) return;
    if (!detectProvider(url)) {
      setError("Lien non reconnu — seuls Spotify, SoundCloud et YouTube sont acceptés.");
      return;
    }
    onChange({ ...data, tracks: [...tracks, { id: crypto.randomUUID(), url }] });
    setUrlInput("");
    setError(null);
  }

  function removeTrack(index: number) {
    const track = tracks[index];
    if (currentKey === `block:${blockId}:${track.id}`) stop();
    onChange({ ...data, tracks: tracks.filter((_, i) => i !== index) });
  }

  /**
   * Une borne vide (champ efface) retire le champ plutot que d'y poser 0 :
   * `startSeconds: 0` et « pas de borne » se ressemblent a l'oeil mais pas
   * dans la donnee, et le schema veut `optional()`, jamais `null`.
   */
  function setBorne(index: number, champ: "startSeconds" | "endSeconds", value: number | undefined) {
    onChange({
      ...data,
      tracks: tracks.map((t, i) => (i === index ? { ...t, [champ]: value } : t)),
    });
  }

  function renameTrack(index: number, title: string) {
    onChange({
      ...data,
      tracks: tracks.map((t, i) => (i === index ? { ...t, title: title || undefined } : t)),
    });
  }

  function toggleTrack(index: number) {
    const track = tracks[index];
    const key = `block:${blockId}:${track.id}`;
    if (currentKey === key) stop();
    // Une seule piste, sans fondu : dans l'editeur on ecoute ce qu'on est en
    // train de regler, on ne joue pas l'ambiance de la fiche. L'enchainement
    // et les fondus appartiennent aux pages de lecture (`PublicMusicToggle`).
    else play({ key, tracks: [track] });
  }

  return (
    <div className="flex flex-col gap-2">
      {tracks.length === 0 ? (
        <p className="text-sm text-ink-muted">Aucune piste pour l&apos;instant.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {tracks.map((track, index) => {
            const key = `block:${blockId}:${track.id}`;
            const playing = currentKey === key;
            const provider = detectProvider(track.url);
            const pilotable = youtubeVideoId(track.url) !== null;
            return (
              <li key={track.id} className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-sm">
                  <button
                    type="button"
                    onClick={() => toggleTrack(index)}
                    aria-label={playing ? "Mettre en pause" : "Lecture"}
                    className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover"
                  >
                    {playing ? "⏸" : "▶"}
                  </button>
                  <input
                    value={track.title ?? ""}
                    onChange={(e) => renameTrack(index, e.target.value)}
                    placeholder="Nom de la piste (ex. Arrivée du méchant)"
                    className={`flex-1 truncate rounded-md border border-edge bg-transparent px-2 py-1 text-sm outline-none ${playing ? "text-accent" : "text-ink"}`}
                  />
                  {provider && <span className="shrink-0 text-xs text-ink-muted">{PROVIDER_LABELS[provider]}</span>}
                  <button type="button" onClick={() => removeTrack(index)} className="shrink-0 text-xs text-danger hover:underline">
                    ×
                  </button>
                </div>
                {/* V2.1-6 lot 2 : bornes YouTube seulement (ADR 0022). Le dire
                    a cote du lien concerne plutot qu'afficher deux champs qui
                    ne feraient rien. */}
                {pilotable ? (
                  <div className="flex items-center gap-2 pl-11 text-xs text-ink-muted">
                    <label className="flex items-center gap-1">
                      Début
                      <BorneInput
                        value={track.startSeconds}
                        onChange={(v) => setBorne(index, "startSeconds", v)}
                        ariaLabel="Début de la piste, en secondes"
                      />
                    </label>
                    <label className="flex items-center gap-1">
                      Fin
                      <BorneInput
                        value={track.endSeconds}
                        onChange={(v) => setBorne(index, "endSeconds", v)}
                        ariaLabel="Fin de la piste, en secondes"
                      />
                    </label>
                    <span>secondes — vide = piste entière</span>
                  </div>
                ) : (
                  <p className="pl-11 text-xs text-ink-muted">
                    Fondu, enchaînement et bornes début/fin ne s&apos;appliquent qu&apos;aux liens YouTube.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <input
          value={urlInput}
          onChange={(e) => {
            setUrlInput(e.target.value);
            setError(null);
          }}
          placeholder="Lien Spotify, SoundCloud ou YouTube…"
          className="flex-1 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
        />
        <button
          type="button"
          onClick={addTrack}
          disabled={!urlInput.trim()}
          className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50"
        >
          + Ajouter
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}

      {/* V2.1-6 : le bloc etant invisible sur les pages de lecture, ces
          reglages sont le seul endroit ou son comportement se decide. */}
      <Checkbox
        checked={data.autoplayOnVisit === true}
        onChange={() => onChange({ ...data, autoplayOnVisit: !data.autoplayOnVisit })}
        label={<span className="text-xs text-ink-soft">Lancer la musique à la visite de la fiche</span>}
      />
      <Checkbox
        checked={data.loop === true}
        onChange={() => onChange({ ...data, loop: !data.loop })}
        label={
          <span className="text-xs text-ink-soft">
            Lire en boucle <span className="text-ink-muted">(liens YouTube uniquement)</span>
          </span>
        }
      />

      <div className="flex flex-wrap items-center gap-4 text-xs text-ink-muted">
        <FonduInput
          libelle="Fondu entrant"
          value={data.fadeInMs ?? 1500}
          onChange={(v) => onChange({ ...data, fadeInMs: v })}
        />
        <FonduInput
          libelle="Fondu sortant"
          value={data.fadeOutMs ?? 1500}
          onChange={(v) => onChange({ ...data, fadeOutMs: v })}
        />
      </div>
    </div>
  );
}

/** Champ de secondes d'une borne de piste — vide plutôt que 0 quand la borne n'existe pas. */
function BorneInput({
  value,
  onChange,
  ariaLabel,
}: {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  ariaLabel: string;
}) {
  return (
    <input
      type="number"
      min={0}
      inputMode="numeric"
      aria-label={ariaLabel}
      value={value ?? ""}
      onChange={(e) => {
        const brut = e.target.value.trim();
        if (brut === "") return onChange(undefined);
        const n = Number.parseInt(brut, 10);
        onChange(Number.isFinite(n) && n >= 0 ? n : undefined);
      }}
      className="w-16 rounded-md border border-edge bg-transparent px-2 py-1 text-xs text-ink outline-none"
    />
  );
}

/**
 * Curseur de fondu. Même plage que le schéma (0-5000 ms) : au-delà on
 * n'entend plus un fondu mais un long silence. `0` désactive.
 */
function FonduInput({
  libelle,
  value,
  onChange,
}: {
  libelle: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="shrink-0">{libelle}</span>
      <input
        type="range"
        min={0}
        max={5000}
        step={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-28 accent-accent"
        aria-label={`${libelle}, en millisecondes`}
      />
      <span className="w-12 shrink-0 tabular-nums">{value === 0 ? "aucun" : `${(value / 1000).toFixed(1)} s`}</span>
    </label>
  );
}
