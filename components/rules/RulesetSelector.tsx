"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import Interrupteur from "@/components/rules/Interrupteur";
import RulesetImportMappingDialog from "@/components/rules/RulesetImportMappingDialog";
import { clearWorldRuleEntriesCache } from "@/components/blocks/useWorldRuleEntries";
import { clearRuleEntryBlocksCache } from "@/components/blocks/useRuleEntryBlocks";
import { arbreRulesets, baseDeRetour, peutExporter } from "@/lib/ui/reglesActives";
import type { SelectableRulesetRow } from "@/src/server/repos/rules";

const CARTE = "rounded-[18px] border border-edge bg-panel p-4 backdrop-blur-[var(--blur)]";
const PUCE = "rounded-full border px-2.5 py-1 text-xs transition-colors motion-reduce:transition-none";

interface BilanImport {
  imported: number;
  errors: { name: string; message: string }[];
}

/** Le résultat d'un import : le nombre de règles importées, puis les erreurs ligne à ligne. */
function BilanDImport({ bilan }: { bilan: BilanImport }) {
  const t = useTranslations("regles");
  return (
    <div className="text-xs">
      <p className="text-ink">{t("importerResultat", { count: bilan.imported })}</p>
      {bilan.errors.length > 0 && (
        <>
          <p className="mt-1 text-danger">{t("importerErreursTitre", { count: bilan.errors.length })}</p>
          <ul className="list-disc pl-4 text-ink-muted">
            {bilan.errors.map((e, i) => (
              <li key={i}>
                {e.name} — {e.message}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/**
 * Le volet gauche de l'écran Règles actives (V3.1-57) : le ruleset de la
 * campagne en arbre, puis l'atelier (créer une variante, importer des règles).
 * Rend deux éléments de la grille du parent (`ReglesActivesPanel`), qui lui
 * passe leurs classes de placement : le ruleset d'un côté, l'atelier de
 * l'autre, séparés pour que la tablette et le téléphone les réordonnent.
 *
 * Les rulesets et le ruleset actif arrivent avec la page (docs/CABLAGE.md C1) :
 * rien n'est chargé au montage. L'état local suit les gestes (choisir,
 * créer, supprimer) sans attendre un rechargement ; il se recale quand la page
 * renvoie de nouvelles données (`router.refresh()`).
 *
 * `clearWorldRuleEntriesCache` / `clearRuleEntryBlocksCache` : l'assistant de
 * création et les listes de règles gardent un cache côté client que
 * `router.refresh()` ne touche jamais ; sans les vider, ils montreraient
 * l'ancien ruleset jusqu'à un rechargement complet.
 */
export default function RulesetSelector({
  worldSlug,
  options: optionsRecues,
  current: courantRecu,
  classeRuleset,
  classeAtelier,
}: {
  worldSlug: string;
  options: SelectableRulesetRow[];
  current: string | null;
  classeRuleset: string;
  classeAtelier: string;
}) {
  const t = useTranslations("regles");
  const router = useRouter();
  const [options, setOptions] = useState(optionsRecues);
  const [current, setCurrent] = useState(courantRecu);
  // Recalage sur de nouvelles données de la page (motif « ajuster l'état pendant le rendu »).
  const [recu, setRecu] = useState({ options: optionsRecues, current: courantRecu });
  if (recu.options !== optionsRecues || recu.current !== courantRecu) {
    setRecu({ options: optionsRecues, current: courantRecu });
    setOptions(optionsRecues);
    setCurrent(courantRecu);
  }

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [variantName, setVariantName] = useState("");
  const [variantParentId, setVariantParentId] = useState("");
  const [personalReference, setPersonalReference] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SelectableRulesetRow | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<BilanImport | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  /** V2-J4 : "append" ajoute dans la variante active ; "create" crée un nouveau ruleset personnel à partir du fichier. */
  const [importMode, setImportMode] = useState<"append" | "create">("append");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createResult, setCreateResult] = useState<BilanImport | null>(null);
  /** Fichier tiers (ne correspond pas à notre format) en attente de correspondance manuelle — voir RulesetImportMappingDialog. */
  const [mappingRecords, setMappingRecords] = useState<Record<string, unknown>[] | null>(null);

  const officials = options.filter((o) => o.is_official_base);
  const arbre = arbreRulesets(options);
  const parentId = officials.some((o) => o.id === variantParentId) ? variantParentId : (officials[0]?.id ?? "");

  /** Les fiches, la création et les règles suivent sans rechargement : caches clients vidés, page relue. */
  function apresChangementDeRuleset() {
    clearWorldRuleEntriesCache(worldSlug);
    clearRuleEntryBlocksCache(worldSlug);
    router.refresh();
  }

  async function choose(rulesetId: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/worlds/${worldSlug}/ruleset`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rulesetId }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(t("erreurChangementRuleset"));
      return;
    }
    setCurrent(rulesetId);
    apresChangementDeRuleset();
  }

  async function createVariant(e: React.FormEvent) {
    e.preventDefault();
    const parent = officials.find((o) => o.id === parentId);
    if (!variantName.trim() || !parent) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/worlds/${worldSlug}/ruleset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: variantName.trim(), parentRulesetId: parentId, personalReference }),
    });
    if (!res.ok) {
      setBusy(false);
      setError(t("erreurCreationVariante"));
      return;
    }
    const created = (await res.json()) as { id: string };
    // La nouvelle variante apparaît aussitôt dans l'arbre ; la page la relira avec `choose`.
    setOptions((prev) => [
      ...prev,
      {
        id: created.id,
        name: variantName.trim(),
        is_official_base: false,
        base_system: parent.base_system,
        version: 1,
        published_at: null,
        content_origin: personalReference ? "personal_reference" : "user_created",
        parent_ruleset_id: parent.id,
      },
    ]);
    setVariantName("");
    setPersonalReference(false);
    await choose(created.id);
  }

  async function confirmDelete() {
    const cible = deleteTarget;
    if (!cible) return;
    const estActive = cible.id === current;
    const base = baseDeRetour(options, cible.id);
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/rulesets/${cible.id}?worldSlug=${encodeURIComponent(worldSlug)}`, { method: "DELETE" });
    setBusy(false);
    setDeleteTarget(null);
    if (!res.ok) {
      setError(res.status === 409 ? t("erreurSuppressionEnUtilisation") : t("erreurSuppressionVariante"));
      return;
    }
    setOptions((prev) => prev.filter((o) => o.id !== cible.id));
    if (estActive) {
      // Le serveur a ramené le monde et sa campagne à la base : l'écran suit.
      if (base) setCurrent(base.id);
      apresChangementDeRuleset();
    }
  }

  /**
   * Import JSON — cible TOUJOURS `current` (la variante active). Une entrée
   * invalide est écartée côté serveur, jamais toute l'importation.
   */
  async function importFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !current) return;
    setImportError(null);
    setImportResult(null);
    setBusy(true);
    setImporting(true);
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setBusy(false);
      setImporting(false);
      setImportError(t("importerErreurLecture"));
      return;
    }
    const res = await fetch(`/api/rulesets/${current}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    });
    setBusy(false);
    setImporting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setImportError(body?.error ?? t("importerErreurReseau"));
      return;
    }
    const body = (await res.json()) as { imported: { name: string }[]; errors: { name: string; message: string }[] };
    setImportResult({ imported: body.imported.length, errors: body.errors });
    if (body.imported.length > 0) apresChangementDeRuleset();
  }

  /** Export « notre format » (V2-J4) — télécharge directement le JSON. */
  async function handleExport(rulesetId: string, name: string) {
    setExportingId(rulesetId);
    const res = await fetch(`/api/rulesets/${rulesetId}/export`);
    setExportingId(null);
    if (!res.ok) {
      setError(t("erreurExport"));
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${name.trim() || "ruleset"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Fichier choisi en mode « créer un nouveau ruleset personnel » (V2-J4) —
   * « notre format » part vers `POST /api/rulesets/import` ; un tableau nu de
   * forme inconnue ouvre l'assistant de correspondance.
   */
  async function handleCreateFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCreateError(null);
    setCreateResult(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setCreateError(t("importerErreurLecture"));
      return;
    }

    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      typeof (parsed as { name?: unknown }).name === "string" &&
      typeof (parsed as { baseSystem?: unknown }).baseSystem === "string" &&
      Array.isArray((parsed as { entries?: unknown }).entries)
    ) {
      setCreating(true);
      const res = await fetch("/api/rulesets/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      setCreating(false);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setCreateError(body?.error ?? t("importerErreurReseau"));
        return;
      }
      const body = (await res.json()) as { imported: { name: string }[]; errors: { name: string; message: string }[] };
      setCreateResult({ imported: body.imported.length, errors: body.errors });
      router.refresh();
      return;
    }

    if (!Array.isArray(parsed)) {
      setCreateError(t("importerErreurFormat"));
      return;
    }
    setMappingRecords(parsed as Record<string, unknown>[]);
  }

  const currentRuleset = options.find((o) => o.id === current);
  const baseDeLaSuppression = deleteTarget ? baseDeRetour(options, deleteTarget.id) : null;
  const suppressionActive = deleteTarget !== null && deleteTarget.id === current && baseDeLaSuppression !== null;

  return (
    <>
      <section className={`flex flex-col gap-3 ${CARTE} ${classeRuleset}`}>
        <h2 className="text-sm font-semibold text-ink">{t("rulesetCampagneTitre")}</h2>
        {error && <p className="text-xs text-danger">{error}</p>}
        <ul className="flex flex-col gap-1.5">
          {arbre.map(({ ruleset, profondeur }) => (
            <li
              key={ruleset.id}
              style={{ marginLeft: `${profondeur * 1.25}rem` }}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-edge/60 px-3 py-2"
            >
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {profondeur > 0 && <span aria-hidden="true" className="-ml-1 h-3 w-3 shrink-0 rounded-bl border-b border-l border-edge-strong" />}
                <span
                  className="rounded-full border px-2 py-0.5 text-xs font-medium"
                  style={ruleset.is_official_base ? { borderColor: "var(--gm)", color: "var(--gm)" } : { borderColor: "var(--link-rule)", color: "var(--link-rule)" }}
                >
                  {ruleset.is_official_base ? t("rulesetOfficiel") : t("variante")}
                </span>
                {ruleset.content_origin === "personal_reference" && (
                  <span className="rounded-full border px-2 py-0.5 text-xs font-medium" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
                    {t("referencePersonnelle")}
                  </span>
                )}
                <span className="min-w-0 break-words text-sm text-ink">{ruleset.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {ruleset.id === current ? (
                  <span className="text-xs font-medium text-accent">● {t("rulesetActuel")}</span>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => choose(ruleset.id)}
                    className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50 motion-reduce:transition-none"
                  >
                    {t("choisir")}
                  </button>
                )}
                {peutExporter(ruleset) && (
                  <button
                    type="button"
                    disabled={busy || exportingId === ruleset.id}
                    onClick={() => handleExport(ruleset.id, ruleset.name)}
                    className="rounded-full border border-edge px-2.5 py-1 text-xs text-ink-muted transition-colors hover:bg-panel-raised disabled:opacity-50 motion-reduce:transition-none"
                  >
                    {exportingId === ruleset.id ? "…" : t("exporter")}
                  </button>
                )}
                {!ruleset.is_official_base && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setDeleteTarget(ruleset)}
                    aria-label={t("supprimerVariante")}
                    title={t("supprimerVariante")}
                    className="px-1 text-sm text-danger hover:underline disabled:opacity-50"
                  >
                    ×
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <details
        className={`${classeAtelier} @md:[&::details-content]:[content-visibility:visible] [&[open]>summary]:mb-3`}
      >
        <summary className={`cursor-pointer text-sm font-semibold text-ink @md:hidden ${CARTE}`}>{t("variantesEtImport")}</summary>
        <div className="flex flex-col gap-4">
          {officials.length > 0 && (
            <form onSubmit={createVariant} className={`flex flex-col gap-3 ${CARTE}`}>
              <div className="flex flex-col gap-0.5">
                <h2 className="text-sm font-semibold text-ink">{t("creerVarianteSection")}</h2>
                <p className="text-xs text-ink-muted">{t("creerVarianteAide")}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-ink-muted">{t("creerVarianteDepuis")}</span>
                {officials.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={o.id === parentId}
                    onClick={() => setVariantParentId(o.id)}
                    className={`${PUCE} ${o.id === parentId ? "border-accent text-accent" : "border-edge text-ink-muted hover:bg-panel-raised"}`}
                  >
                    {o.name}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={variantName}
                  onChange={(e) => setVariantName(e.target.value)}
                  placeholder={t("nomDeLaVariante")}
                  aria-label={t("nomDeLaVariante")}
                  className="min-w-0 flex-1 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none placeholder:text-ink-muted"
                />
                <button
                  type="submit"
                  disabled={busy || !variantName.trim()}
                  className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50 motion-reduce:transition-none"
                >
                  {t("creer")}
                </button>
              </div>
              <Interrupteur
                actif={personalReference}
                onChange={() => setPersonalReference((v) => !v)}
                titre={t("referencePersonnelle")}
                aide={t("referencePersonnelleSous")}
              />
              {personalReference && <p className="text-xs text-danger">{t("referencePersonnelleAvertissement")}</p>}
            </form>
          )}

          <section className={`flex flex-col gap-3 ${CARTE}`}>
            <h2 className="text-sm font-semibold text-ink">{t("importerSection")}</h2>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                aria-pressed={importMode === "append"}
                onClick={() => setImportMode("append")}
                className={`${PUCE} ${importMode === "append" ? "border-accent text-accent" : "border-edge text-ink-muted hover:bg-panel-raised"}`}
              >
                {t("importerModeAjouter")}
              </button>
              <button
                type="button"
                aria-pressed={importMode === "create"}
                onClick={() => setImportMode("create")}
                className={`${PUCE} ${importMode === "create" ? "border-accent text-accent" : "border-edge text-ink-muted hover:bg-panel-raised"}`}
              >
                {t("importerModeCreer")}
              </button>
            </div>

            {importMode === "append" && (
              <>
                {!currentRuleset || currentRuleset.is_official_base ? (
                  <p className="text-xs text-ink-muted">{t("importerReglesNeedsVariante")}</p>
                ) : (
                  <>
                    <p className="text-xs text-ink-muted">{t("importerReglesVariante", { name: currentRuleset.name })}</p>
                    <label
                      className={`self-start rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised motion-reduce:transition-none ${
                        busy ? "pointer-events-none opacity-50" : "cursor-pointer"
                      }`}
                    >
                      {importing ? t("importEnCours") : t("importerBouton")}
                      <input type="file" accept="application/json,.json" onChange={importFile} disabled={busy} className="hidden" />
                    </label>
                  </>
                )}
                {importError && <p className="text-xs text-danger">{importError}</p>}
                {importResult && <BilanDImport bilan={importResult} />}
              </>
            )}

            {importMode === "create" && (
              <>
                <p className="text-xs text-danger">{t("referencePersonnelleAvertissement")}</p>
                {mappingRecords === null ? (
                  <label
                    className={`self-start rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised motion-reduce:transition-none ${
                      creating ? "pointer-events-none opacity-50" : "cursor-pointer"
                    }`}
                  >
                    {creating ? t("importEnCours") : t("importerBouton")}
                    <input type="file" accept="application/json,.json" onChange={handleCreateFile} disabled={creating} className="hidden" />
                  </label>
                ) : (
                  <RulesetImportMappingDialog
                    records={mappingRecords}
                    officials={officials.map((o) => ({ baseSystem: o.base_system, label: o.name }))}
                    onCancel={() => setMappingRecords(null)}
                    onImported={(outcome) => {
                      setMappingRecords(null);
                      setCreateResult({ imported: outcome.imported.length, errors: outcome.errors });
                      router.refresh();
                    }}
                  />
                )}
                {createError && <p className="text-xs text-danger">{createError}</p>}
                {createResult && <BilanDImport bilan={createResult} />}
              </>
            )}
          </section>
        </div>
      </details>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t("confirmerSuppressionTitre")}
        message={
          deleteTarget
            ? t("confirmerSuppressionVarianteMessage", {
                name: deleteTarget.name,
                actif: suppressionActive ? "oui" : "non",
                base: baseDeLaSuppression?.name ?? "",
              })
            : ""
        }
        confirmLabel={t("supprimer")}
        cancelLabel={t("annuler")}
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
