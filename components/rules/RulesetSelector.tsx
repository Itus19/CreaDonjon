"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import Dropdown from "@/components/shared/Dropdown";
import RulesetImportMappingDialog from "@/components/rules/RulesetImportMappingDialog";
import { clearWorldRuleEntriesCache } from "@/components/blocks/useWorldRuleEntries";
import { clearRuleEntryBlocksCache } from "@/components/blocks/useRuleEntryBlocks";

interface SelectableRuleset {
  id: string;
  name: string;
  is_official_base: boolean;
  base_system: string;
  version: number;
  published_at: string | null;
  content_origin: string;
}

/**
 * Selecteur de ruleset actif (V1-C5, revu retour utilisateur : "supprime le
 * bouton intermediaire, rends l'affichage... comme les autres outils de
 * mj") — rendu directement par la page `/mj/regles-actives`, seule
 * consommatrice de ce composant : plus de bouton-declencheur ni de modal,
 * la liste des rulesets officiels/variantes et le formulaire de creation de
 * variante sont le contenu de la page elle-meme, chargee au montage plutot
 * qu'au clic.
 *
 * "Reflete immediatement... sans rechargement de page" : `router.refresh()`
 * re-execute les composants serveur de cette page (la liste de regles vient
 * de la, elle change donc sans reload navigateur). La fiche jouable, elle,
 * relit toujours `worlds.default_ruleset_id` a chaque appel API — elle n'a
 * besoin d'aucune plomberie supplementaire pour rester exacte au prochain
 * chargement/interaction, meme dans une autre fenetre.
 *
 * `clearWorldRuleEntriesCache` (bug reel trouve en verifiant l'assistant de
 * creation de personnage) : `useWorldRuleEntries.ts` garde son propre cache
 * module-level cote client, que `router.refresh()` ne touche jamais (il ne
 * revalide que les composants serveur) — sans cet appel, les listes
 * espece/classe/historique de l'assistant continuaient de montrer l'ancien
 * ruleset tant que la page n'etait pas rechargee entierement.
 */
export default function RulesetSelector({ worldSlug }: { worldSlug: string }) {
  const t = useTranslations("regles");
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [options, setOptions] = useState<SelectableRuleset[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [variantName, setVariantName] = useState("");
  const [variantParentId, setVariantParentId] = useState("");
  const [personalReference, setPersonalReference] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SelectableRuleset | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number; errors: { name: string; message: string }[] } | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  /** V2-J4 : "append" ajoute dans la variante active (comportement existant) ; "create" cree un nouveau ruleset personnel a partir du fichier. */
  const [importMode, setImportMode] = useState<"append" | "create">("append");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createResult, setCreateResult] = useState<{ imported: number; errors: { name: string; message: string }[] } | null>(null);
  /** Fichier tiers (ne correspond pas a notre format) en attente de correspondance manuelle — voir RulesetImportMappingDialog. */
  const [mappingRecords, setMappingRecords] = useState<Record<string, unknown>[] | null>(null);

  useEffect(() => {
    fetch(`/api/worlds/${worldSlug}/ruleset`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: { options: SelectableRuleset[]; current: string | null }) => {
        setOptions(body.options);
        setCurrent(body.current);
        setVariantParentId((prev) => prev || body.options.find((o) => o.is_official_base)?.id || "");
      })
      .catch(() => setError(t("erreurChargementRulesets")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule fois au montage, `worldSlug` ne change jamais sans remonter la page
  }, []);

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
    clearWorldRuleEntriesCache(worldSlug);
    clearRuleEntryBlocksCache(worldSlug);
    router.refresh();
  }

  async function createVariant(e: React.FormEvent) {
    e.preventDefault();
    if (!variantName.trim() || !variantParentId) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/worlds/${worldSlug}/ruleset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: variantName.trim(), parentRulesetId: variantParentId, personalReference }),
    });
    if (!res.ok) {
      setBusy(false);
      setError(t("erreurCreationVariante"));
      return;
    }
    const created = (await res.json()) as { id: string };
    setVariantName("");
    setPersonalReference(false);
    await choose(created.id);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/rulesets/${deleteTarget.id}`, { method: "DELETE" });
    setBusy(false);
    setDeleteTarget(null);
    if (!res.ok) {
      if (res.status === 409) {
        setError(t("erreurSuppressionEnUtilisation"));
      } else {
        setError(t("erreurSuppressionVariante"));
      }
      return;
    }
    setOptions((prev) => prev.filter((o) => o.id !== deleteTarget.id));
  }

  /**
   * Import JSON (retour utilisateur : "importer des règles via des fichiers
   * JSON") — cible TOUJOURS `current` (la variante active) : c'est deja le
   * seul ruleset que "Choisir" peut selectionner, jamais un second champ a
   * remplir. Une entree invalide est ecartee cote serveur, jamais toute
   * l'importation (`importerResultat`/`importerErreursTitre` affichent les
   * deux a la fois).
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
    if (body.imported.length > 0) {
      clearWorldRuleEntriesCache(worldSlug);
      clearRuleEntryBlocksCache(worldSlug);
      router.refresh();
    }
  }

  /** Export "notre format" (V2-J4) — telecharge directement le JSON, aucun apercu intermediaire necessaire pour un fichier destine a etre reimporte tel quel. */
  async function handleExport(rulesetId: string, name: string) {
    setExportingId(rulesetId);
    const res = await fetch(`/api/rulesets/${rulesetId}/export`);
    setExportingId(null);
    if (!res.ok) {
      setError(t("erreurChargementRulesets"));
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
   * Fichier choisi en mode "creer un nouveau ruleset personnel" (V2-J4) —
   * "notre format" (`{name, baseSystem, entries}`) part directement vers
   * `POST /api/rulesets/import` ; tout le reste (tableau nu de forme
   * inconnue) ouvre l'assistant de correspondance plutot qu'un message
   * d'erreur sec.
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
      setCreateError("Ce fichier n'est ni notre format, ni un tableau JSON — l'assistant de correspondance a besoin d'un tableau.");
      return;
    }
    setMappingRecords(parsed as Record<string, unknown>[]);
  }

  const officials = options.filter((o) => o.is_official_base);
  const variants = options.filter((o) => !o.is_official_base);

  return (
    <>
      {loading && <p className="text-sm text-ink-muted">{t("chargementRulesets")}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      {!loading && (
        <div className="flex flex-col gap-3">
          {[...officials, ...variants].map((ruleset) => (
            <div
              key={ruleset.id}
              className="flex items-center justify-between gap-2 rounded-md border border-edge/60 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span
                  className="rounded-full border px-2 py-0.5 text-[10px] font-medium"
                  style={
                    ruleset.is_official_base
                      ? { borderColor: "var(--gm)", color: "var(--gm)" }
                      : { borderColor: "var(--link-rule)", color: "var(--link-rule)" }
                  }
                >
                  {ruleset.is_official_base ? t("rulesetOfficiel") : t("variante")}
                </span>
                {ruleset.content_origin === "personal_reference" && (
                  <span
                    className="rounded-full border px-2 py-0.5 text-[10px] font-medium"
                    style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
                  >
                    {t("referencePersonnelle")}
                  </span>
                )}
                <span className="text-sm text-ink">{ruleset.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {ruleset.id === current ? (
                  <span className="text-xs font-medium text-accent">{t("rulesetActuel")}</span>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => choose(ruleset.id)}
                    className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel disabled:opacity-50"
                  >
                    {t("choisir")}
                  </button>
                )}
                {!ruleset.is_official_base && (
                  <button
                    type="button"
                    disabled={busy || exportingId === ruleset.id}
                    onClick={() => handleExport(ruleset.id, ruleset.name)}
                    className="rounded-full border border-edge px-2.5 py-1 text-xs text-ink-muted transition-colors hover:bg-panel disabled:opacity-50"
                  >
                    {exportingId === ruleset.id ? "…" : "Exporter"}
                  </button>
                )}
                {!ruleset.is_official_base && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setDeleteTarget(ruleset)}
                    aria-label={t("supprimerVariante")}
                    title={t("supprimerVariante")}
                    className="text-sm text-danger hover:underline disabled:opacity-50"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && officials.length > 0 && (
        <form onSubmit={createVariant} className="flex flex-col gap-2 border-t border-edge/60 pt-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">
            {t("creerVarianteTitre")}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Dropdown
              value={variantParentId}
              onChange={setVariantParentId}
              options={officials.map((o) => ({ value: o.id, label: o.name }))}
              aria-label={t("creerVarianteTitre")}
            />
            <input
              value={variantName}
              onChange={(e) => setVariantName(e.target.value)}
              placeholder={t("nomDeLaVariante")}
              className="flex-1 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
            />
            <button
              type="submit"
              disabled={busy || !variantName.trim()}
              className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {t("creer")}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setPersonalReference((v) => !v)}
            className={`self-start rounded-md border border-edge px-2.5 py-1.5 text-left text-xs text-ink-muted transition-colors hover:bg-panel ${
              personalReference ? "border-accent text-accent" : ""
            }`}
          >
            {t("referencePersonnelleOption")} {personalReference ? "✓" : ""}
          </button>
          {personalReference && <p className="text-xs text-danger">{t("referencePersonnelleAvertissement")}</p>}
        </form>
      )}

      {!loading && (
        <div className="flex flex-col gap-2 border-t border-edge/60 pt-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">{t("importerReglesTitre")}</span>

          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setImportMode("append")}
              className={`rounded-full border px-2.5 py-1 transition-colors ${importMode === "append" ? "border-accent text-accent" : "border-edge text-ink-muted hover:bg-panel"}`}
            >
              Ajouter à la variante active
            </button>
            <button
              type="button"
              onClick={() => setImportMode("create")}
              className={`rounded-full border px-2.5 py-1 transition-colors ${importMode === "create" ? "border-accent text-accent" : "border-edge text-ink-muted hover:bg-panel"}`}
            >
              Créer un nouveau ruleset personnel
            </button>
          </div>

          {importMode === "append" && (
            <>
              {(() => {
                const currentRuleset = options.find((o) => o.id === current);
                if (!currentRuleset || currentRuleset.is_official_base) {
                  return <p className="text-xs text-ink-muted">{t("importerReglesNeedsVariante")}</p>;
                }
                return (
                  <>
                    <p className="text-xs text-ink-muted">{t("importerReglesVariante", { name: currentRuleset.name })}</p>
                    <label
                      className={`self-start rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel ${
                        busy ? "pointer-events-none opacity-50" : "cursor-pointer"
                      }`}
                    >
                      {importing ? t("importEnCours") : t("importerBouton")}
                      <input type="file" accept="application/json,.json" onChange={importFile} disabled={busy} className="hidden" />
                    </label>
                  </>
                );
              })()}
              {importError && <p className="text-xs text-danger">{importError}</p>}
              {importResult && (
                <div className="text-xs">
                  <p className="text-ink">{t("importerResultat", { count: importResult.imported })}</p>
                  {importResult.errors.length > 0 && (
                    <>
                      <p className="mt-1 text-danger">{t("importerErreursTitre", { count: importResult.errors.length })}</p>
                      <ul className="list-disc pl-4 text-ink-muted">
                        {importResult.errors.map((e, i) => (
                          <li key={i}>
                            {e.name} — {e.message}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {importMode === "create" && (
            <>
              <p className="text-xs text-danger">{t("referencePersonnelleAvertissement")}</p>
              {mappingRecords === null ? (
                <label
                  className={`self-start rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel ${
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
              {createResult && (
                <div className="text-xs">
                  <p className="text-ink">{t("importerResultat", { count: createResult.imported })}</p>
                  {createResult.errors.length > 0 && (
                    <>
                      <p className="mt-1 text-danger">{t("importerErreursTitre", { count: createResult.errors.length })}</p>
                      <ul className="list-disc pl-4 text-ink-muted">
                        {createResult.errors.map((e, i) => (
                          <li key={i}>
                            {e.name} — {e.message}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t("confirmerSuppressionTitre")}
        message={deleteTarget ? t("confirmerSuppressionMessage", { name: deleteTarget.name }) : ""}
        confirmLabel={t("supprimer")}
        cancelLabel={t("annuler")}
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
