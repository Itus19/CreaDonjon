"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Dropdown from "@/components/shared/Dropdown";

/**
 * Import de monde depuis un fichier JSON exporte (V2-G1, dernier point) :
 * lu et parse cote client uniquement pour prerempler le mode suggere par le
 * fichier (`suggestedMode`) — la validation qui compte se fait cote serveur
 * (`importWorldSchema`, zod), ce parsing client n'est qu'un confort d'UI.
 *
 * G-7b : une carte d'Azgaar (export JSON « Complet ») est reconnue et
 * convertie ici, dans le navigateur (ADR 0109, G3) : ses villes, ses États et
 * leur histoire simulée deviennent un fichier d'export de monde ordinaire,
 * que la même route importe.
 */
export default function ImportWorldForm({ canUseSoloMode }: { canUseSoloMode: boolean }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<unknown | null>(null);
  const [mode, setMode] = useState<"campaign" | "solo">("campaign");
  const [error, setError] = useState<string | null>(null);
  const [azgaarSummary, setAzgaarSummary] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const modeOptions = canUseSoloMode
    ? [
        { value: "campaign", label: "Campagne (MJ humain)" },
        { value: "solo", label: "Solo (MJ IA)" },
      ]
    : [{ value: "campaign", label: "Campagne (MJ humain)" }];

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setError(null);
    setParsedData(null);
    setAzgaarSummary(null);
    if (!file) {
      setFileName(null);
      return;
    }
    setFileName(file.name);
    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      setError("Fichier illisible : ce n'est pas un JSON valide.");
      return;
    }
    if (estUneCarteAzgaar(json)) {
      setPending(true);
      try {
        // Chargé à la demande : le simulateur n'alourdit pas l'accueil.
        const { azgaarFileToWorldExport } = await import("@/src/core/worldgen/azgaar/toWorldExport");
        const { data, summary } = azgaarFileToWorldExport(json);
        setParsedData(data);
        setAzgaarSummary(
          `Carte Azgaar « ${summary.name} » : ${summary.sites} villes, ${summary.states} États, ${summary.events} événements d'histoire jusqu'en ${summary.presentYear}.`
        );
        if (canUseSoloMode) setMode("solo");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Carte Azgaar illisible.");
      } finally {
        setPending(false);
      }
      return;
    }
    setParsedData(json);
    const suggested = typeof json === "object" && json !== null && "suggestedMode" in json ? json.suggestedMode : null;
    if (suggested === "campaign" || (suggested === "solo" && canUseSoloMode)) {
      setMode(suggested);
    }
  }

  function handleCancel() {
    setFileName(null);
    setParsedData(null);
    setAzgaarSummary(null);
    setError(null);
    setMode("campaign");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleImport() {
    if (!parsedData) {
      setError("Choisissez d'abord un fichier.");
      return;
    }
    setPending(true);
    setError(null);
    const res = await fetch("/api/worlds/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, data: parsedData }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Échec de l'import.");
      return;
    }
    const { world } = await res.json();
    router.push(mode === "solo" ? `/m/${world.slug}/mj/creation-personnage` : `/m/${world.slug}`);
  }

  const fileChosen = parsedData !== null;

  return (
    <>
      <button
        type="button"
        onClick={() => (fileChosen ? handleImport() : fileInputRef.current?.click())}
        disabled={pending}
        className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Import..." : fileChosen ? "Confirmer l'import" : "Importer"}
      </button>
      <input ref={fileInputRef} type="file" accept="application/json" onChange={handleFileChange} className="hidden" />
      {fileName && <span className="text-sm text-ink-muted">{fileName}</span>}
      {fileChosen && (
        <>
          <Dropdown
            value={mode}
            onChange={(v) => setMode(v as "campaign" | "solo")}
            options={modeOptions}
            aria-label="Mode de jeu"
            triggerClassName="rounded-md border border-edge bg-transparent px-3 py-2 text-sm text-ink outline-none transition-colors hover:bg-panel-raised"
          />
          <button
            type="button"
            onClick={handleCancel}
            disabled={pending}
            title="Annuler l'import"
            aria-label="Annuler l'import"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-base text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
          >
            ×
          </button>
        </>
      )}
      {azgaarSummary && <p className="w-full text-sm text-ink-muted">{azgaarSummary}</p>}
      {error && <p className="w-full text-sm text-danger">{error}</p>}
    </>
  );
}

/** Une carte d'Azgaar se reconnaît à sa version et à ses villes ; un export de monde, lui, a `formatVersion`. */
function estUneCarteAzgaar(json: unknown): boolean {
  if (typeof json !== "object" || json === null || !("info" in json) || !("pack" in json)) return false;
  const pack = json.pack;
  return typeof pack === "object" && pack !== null && "burgs" in pack;
}
