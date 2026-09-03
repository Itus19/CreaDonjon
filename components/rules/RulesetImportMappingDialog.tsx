"use client";

import { useState } from "react";
import Dropdown from "@/components/shared/Dropdown";
import { mapThirdPartyEntries } from "@/src/core/ruleset/thirdPartyMapping";
import { ENTRY_TYPES, type EntryType } from "@/src/core/schemas/rule-blocks/entry-types";

interface OfficialOption {
  baseSystem: string;
  label: string;
}

interface ImportOutcome {
  rulesetId: string;
  imported: { entryKey: string; name: string }[];
  errors: { entryKey: string | null; name: string; message: string }[];
}

/**
 * Assistant de correspondance (V2-J4, specs/arbitrage-modifications.md §1.2 :
 * "l'utilisateur associe les champs, on n'écrit pas trente convertisseurs")
 * — pour un fichier JSON tiers, tableau d'objets a plat dont les cles ne
 * correspondent a rien de connu. L'utilisateur associe : quelle cle → nom,
 * quelle(s) cle(s) → description, un seul type de regle pour tout le lot.
 * Un seul bloc `description` generique par entree, jamais de tentative de
 * deviner des blocs structures (arme/armure/etc.) — l'auteur enrichit
 * ensuite a la main via les editeurs de fiche de regle deja existants.
 * Converge sur le MEME chemin serveur que l'import "notre format"
 * (`POST /api/rulesets/import`, `createRulesetFromImport`), jamais un
 * second point d'entree serveur — seule la normalisation cote client differe.
 */
export default function RulesetImportMappingDialog({
  records,
  officials,
  onCancel,
  onImported,
}: {
  records: Record<string, unknown>[];
  officials: OfficialOption[];
  onCancel: () => void;
  onImported: (outcome: ImportOutcome) => void;
}) {
  const sampleKeys = records.length > 0 ? Object.keys(records[0]) : [];
  const [name, setName] = useState("");
  const [baseSystem, setBaseSystem] = useState(officials[0]?.baseSystem ?? "");
  const [nameKey, setNameKey] = useState(sampleKeys[0] ?? "");
  const [descriptionKeys, setDescriptionKeys] = useState<string[]>([]);
  const [entryType, setEntryType] = useState<EntryType>("item");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleDescriptionKey(key: string) {
    setDescriptionKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function handleSubmit() {
    if (!name.trim() || !baseSystem || !nameKey) return;
    setSubmitting(true);
    setError(null);
    const entries = mapThirdPartyEntries(records, { nameKey, descriptionKeys, entryType });
    if (entries.length === 0) {
      setSubmitting(false);
      setError("Aucun enregistrement n'a de valeur pour le champ nom choisi.");
      return;
    }
    const res = await fetch("/api/rulesets/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), baseSystem, entries }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Impossible de créer le ruleset.");
      return;
    }
    onImported((await res.json()) as ImportOutcome);
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-accent/40 bg-panel-sunken p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-ink">Assistant de correspondance — format tiers</span>
        <button type="button" onClick={onCancel} className="text-xs text-ink-muted hover:text-ink">
          Annuler
        </button>
      </div>

      <p className="text-xs text-ink-muted">
        {records.length} enregistrement{records.length > 1 ? "s" : ""} détecté{records.length > 1 ? "s" : ""}. Associez les
        champs source aux champs de la fiche.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom du nouveau ruleset"
          className="flex-1 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
        />
        <Dropdown
          value={baseSystem}
          onChange={setBaseSystem}
          options={officials.map((o) => ({ value: o.baseSystem, label: o.label }))}
          aria-label="Système de base"
        />
      </div>

      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        Champ → Nom de l&apos;entrée
        <Dropdown value={nameKey} onChange={setNameKey} options={sampleKeys.map((k) => ({ value: k, label: k }))} aria-label="Champ nom" />
      </label>

      <div className="flex flex-col gap-1 text-xs text-ink-muted">
        Champ(s) → Description (cochez-en un ou plusieurs, dans l&apos;ordre voulu)
        <div className="flex flex-wrap gap-1.5">
          {sampleKeys.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleDescriptionKey(key)}
              className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
                descriptionKeys.includes(key) ? "border-accent text-accent" : "border-edge text-ink-muted hover:bg-panel"
              }`}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        Type de règle (le même pour tout le lot)
        <Dropdown value={entryType} onChange={(v) => setEntryType(v as EntryType)} options={ENTRY_TYPES.map((t) => ({ value: t, label: t }))} aria-label="Type de règle" />
      </label>

      {error && <p className="text-xs text-danger">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || !name.trim() || !nameKey}
        className="self-start rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {submitting ? "Création…" : "Créer le ruleset"}
      </button>
    </div>
  );
}
