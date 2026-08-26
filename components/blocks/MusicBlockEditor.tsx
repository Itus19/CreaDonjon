"use client";

import { useState } from "react";
import type { MusicBlockData } from "@/src/core/schemas/blocks/music";
import { PROVIDER_LABELS, detectProvider } from "@/src/core/music/embedUrl";
import { useMusicPlayback } from "@/components/shell/MusicPlaybackContext";

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
      setError("Lien non reconnu — seuls Spotify, SoundCloud et YouTube sont acceptes.");
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

  function renameTrack(index: number, title: string) {
    onChange({
      ...data,
      tracks: tracks.map((t, i) => (i === index ? { ...t, title: title || undefined } : t)),
    });
  }

  function toggleTrack(trackId: string, url: string) {
    const key = `block:${blockId}:${trackId}`;
    if (currentKey === key) stop();
    else play(key, url);
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
            return (
              <li key={track.id} className="flex items-center gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => toggleTrack(track.id, track.url)}
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
    </div>
  );
}
