"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { detectProvider } from "@/src/core/music/embedUrl";
import { useMusicPlayback } from "./MusicPlaybackContext";

interface RadioStation {
  id: string;
  label: string;
  url: string;
}

/** Icone minimaliste (ondes de diffusion) — jamais d'emoji dans la coquille, meme registre que les glyphes deja utilises ailleurs (⚙, ▾, ×). */
function BroadcastIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <path d="M9 9.5a3.6 3.6 0 0 0 0 5" />
      <path d="M15 9.5a3.6 3.6 0 0 1 0 5" />
      <path d="M6.2 6.8a7.6 7.6 0 0 0 0 10.4" />
      <path d="M17.8 6.8a7.6 7.6 0 0 1 0 10.4" />
    </svg>
  );
}

/**
 * Musique de fond (extension de V2-G3, sur demande explicite) : des
 * "stations" nommees par la personne elle-meme, jamais une categorie ou une
 * marque de franchise fournie par l'application (meme decision que le bloc
 * `music` d'une fiche — voir docs/BACKLOG_V2.md). Stations de monde, cote
 * serveur (`world_radio_stations`, RLS) — retour utilisateur : "les stations
 * radio sont celles que le MJ met en place pour ce monde et accessibles aux
 * joueurs". Ajout/suppression reserves au MJ (`canManage`, calcule serveur
 * via `isWorldAdmin`), lecture ouverte a tout membre.
 *
 * Rendu en ligne dans `AppShell.tsx` (a gauche de l'horloge), pas en bouton
 * flottant : un bouton `fixed` independant du fil d'en-tete finit tot ou
 * tard par chevaucher un autre element de cet en-tete (ici, le lien "Mes
 * mondes") dans certaines largeurs. Le panneau, lui, reste positionne en
 * portail (meme technique que `Dropdown.tsx`) pour ne jamais etre coupe
 * par un conteneur au scroll.
 */
interface PanelRect {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

export default function RadioWidget({ worldSlug }: { worldSlug: string }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<PanelRect | null>(null);
  const [stations, setStations] = useState<RadioStation[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { currentKey, play, stop } = useMusicPlayback();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/worlds/${worldSlug}/radio-stations`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { stations: RadioStation[]; canManage: boolean } | null) => {
        if (cancelled || !data) return;
        setStations(data.stations);
        setCanManage(data.canManage);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [worldSlug]);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (panelRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  /**
   * Ancrage adaptatif (retour utilisateur, coquille joueur : "la bulle de
   * la radio est hors champ de vision") — le declencheur n'est plus
   * toujours en haut a droite (en-tete `AppShell.tsx`) depuis qu'il vit
   * aussi en bas de la sidebar joueur (`PlayerShell.tsx`) : ouvrir
   * systematiquement vers le bas/la gauche du declencheur poussait le
   * panneau hors de l'ecran une fois le bouton pres du bord bas/gauche.
   * Choisit maintenant le cote (haut/bas, gauche/droite) qui laisse le
   * plus de place, dans les deux sens.
   */
  function toggleOpen() {
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      const PANEL_WIDTH = 288; // w-72
      const PANEL_HEIGHT_ESTIMATE = 360; // contenu variable (stations + formulaire) : une estimation genereuse suffit, seul le cote compte ici
      const next: PanelRect = {};
      if (window.innerHeight - r.bottom >= PANEL_HEIGHT_ESTIMATE || window.innerHeight - r.bottom >= r.top) {
        next.top = r.bottom + 6;
      } else {
        next.bottom = window.innerHeight - r.top + 6;
      }
      if (window.innerWidth - r.left >= PANEL_WIDTH) {
        next.left = r.left;
      } else {
        next.right = window.innerWidth - r.right;
      }
      setRect(next);
    }
    setOpen((v) => !v);
  }

  async function addStation() {
    const trimmedLabel = label.trim();
    const trimmedUrl = url.trim();
    if (!trimmedLabel || !trimmedUrl) return;
    if (!detectProvider(trimmedUrl)) {
      setError("Lien non reconnu — seuls Spotify, SoundCloud et YouTube sont acceptés.");
      return;
    }
    const res = await fetch(`/api/worlds/${worldSlug}/radio-stations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: trimmedLabel, url: trimmedUrl }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Impossible d'ajouter cette station.");
      return;
    }
    const station: RadioStation = await res.json();
    setStations((prev) => [...prev, station]);
    setLabel("");
    setUrl("");
    setError(null);
  }

  async function removeStation(id: string) {
    setStations((prev) => prev.filter((s) => s.id !== id));
    if (currentKey === `radio:${id}`) stop();
    await fetch(`/api/worlds/${worldSlug}/radio-stations/${id}`, { method: "DELETE" }).catch(() => {});
  }

  function toggleStation(station: RadioStation) {
    const key = `radio:${station.id}`;
    if (currentKey === key) stop();
    else play(key, station.url);
  }

  const isPlaying = currentKey?.startsWith("radio:") ?? false;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        aria-label="Radio"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:text-ink ${
          isPlaying ? "text-accent" : "text-ink-muted"
        }`}
      >
        <BroadcastIcon className="h-4 w-4" />
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Radio"
            className="fixed z-[100] flex max-h-[calc(100vh-2rem)] w-72 flex-col gap-3 overflow-y-auto rounded-lg border border-edge-strong bg-panel-raised p-4 shadow-2xl"
            style={{ top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right }}
          >
            <h2 className="text-sm font-semibold text-ink">Radio</h2>

            {stations.length === 0 ? (
              <p className="text-xs text-ink-muted">Aucune station pour l&apos;instant.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {stations.map((station) => {
                  const key = `radio:${station.id}`;
                  const playing = currentKey === key;
                  return (
                    <li key={station.id} className="flex items-center gap-2 text-sm">
                      <button
                        type="button"
                        onClick={() => toggleStation(station)}
                        aria-label={playing ? "Mettre en pause" : "Lecture"}
                        className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover"
                      >
                        {playing ? "⏸" : "▶"}
                      </button>
                      <span className={`flex-1 truncate ${playing ? "text-accent" : "text-ink"}`}>
                        {station.label}
                      </span>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => removeStation(station.id)}
                          className="text-xs text-danger hover:underline"
                        >
                          ×
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {canManage && (
              <div className="flex flex-col gap-1.5 border-t border-edge pt-3">
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Nom de la station"
                  className="rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
                />
                <input
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setError(null);
                  }}
                  placeholder="Lien Spotify, SoundCloud ou YouTube…"
                  className="rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
                />
                <button
                  type="button"
                  onClick={addStation}
                  disabled={!label.trim() || !url.trim()}
                  className="self-start rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel disabled:opacity-50"
                >
                  + Ajouter
                </button>
                {error && <p className="text-xs text-danger">{error}</p>}
              </div>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
