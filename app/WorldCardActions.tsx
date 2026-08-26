"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Exporter/dupliquer un monde depuis l'ecran d'accueil (V2-G1, dernier point) — hors du <Link> de la carte, ce sont des actions, pas une navigation. */
export default function WorldCardActions({ worldSlug }: { worldSlug: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<"export" | "duplicate" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExport(e: React.MouseEvent) {
    e.preventDefault();
    setPending("export");
    setError(null);
    const res = await fetch(`/api/worlds/${worldSlug}/export`);
    setPending(null);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Échec de l'export.");
      return;
    }
    const { data, warnings, suggestedFilename } = await res.json();
    if (warnings.length > 0 && !window.confirm(`${warnings.join("\n")}\n\nContinuer le téléchargement ?`)) {
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = suggestedFilename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDuplicate(e: React.MouseEvent) {
    e.preventDefault();
    setPending("duplicate");
    setError(null);
    const res = await fetch(`/api/worlds/${worldSlug}/duplicate`, { method: "POST" });
    setPending(null);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Échec de la duplication.");
      return;
    }
    const { world, campaign } = await res.json();
    router.push(campaign.mode === "solo" ? `/m/${world.slug}/mj/creation-personnage` : `/m/${world.slug}`);
  }

  return (
    <div className="flex items-center gap-2 pt-1">
      <button
        type="button"
        onClick={handleExport}
        disabled={pending !== null}
        className="rounded-full border border-edge px-2 py-0.5 text-[11px] text-ink-muted transition-colors hover:bg-panel-raised disabled:opacity-50"
      >
        {pending === "export" ? "Export..." : "Exporter"}
      </button>
      <button
        type="button"
        onClick={handleDuplicate}
        disabled={pending !== null}
        className="rounded-full border border-edge px-2 py-0.5 text-[11px] text-ink-muted transition-colors hover:bg-panel-raised disabled:opacity-50"
      >
        {pending === "duplicate" ? "Duplication..." : "Dupliquer"}
      </button>
      {error && <p className="text-[11px] text-danger">{error}</p>}
    </div>
  );
}
