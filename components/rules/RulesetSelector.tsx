"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";

interface SelectableRuleset {
  id: string;
  name: string;
  is_official_base: boolean;
  base_system: string;
  version: number;
  published_at: string | null;
}

/**
 * Selecteur de ruleset actif (V1-C5) : bouton en bas de la barre laterale
 * des regles (meme emplacement que « + Nouvelle entite » cote monde,
 * components/shell/Sidebar.tsx), ouvre une boite de dialogue qui liste les
 * rulesets officiels et les variantes de l'utilisateur, permet d'en choisir
 * un comme actif pour ce monde, et d'en creer une nouvelle a partir d'un
 * officiel. Meme patron d'overlay que ConfirmDialog.tsx (portail + scrim +
 * panneau centre, z-[1100]).
 *
 * "Reflete immediatement... sans rechargement de page" : `router.refresh()`
 * re-execute les composants serveur de cette page (la liste de regles vient
 * de la, elle change donc sans reload navigateur). La fiche jouable, elle,
 * relit toujours `worlds.default_ruleset_id` a chaque appel API — elle
 * n'a besoin d'aucune plomberie supplementaire pour rester exacte au
 * prochain chargement/interaction, meme dans une autre fenetre.
 */
export default function RulesetSelector({ worldSlug }: { worldSlug: string }) {
  const t = useTranslations("regles");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [options, setOptions] = useState<SelectableRuleset[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [variantName, setVariantName] = useState("");
  const [variantParentId, setVariantParentId] = useState("");

  function openSelector() {
    setOpen(true);
    setLoading(true);
    setError(null);
    fetch(`/api/worlds/${worldSlug}/ruleset`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: { options: SelectableRuleset[]; current: string | null }) => {
        setOptions(body.options);
        setCurrent(body.current);
        setVariantParentId((prev) => prev || body.options.find((o) => o.is_official_base)?.id || "");
      })
      .catch(() => setError(t("erreurChargementRulesets")))
      .finally(() => setLoading(false));
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
    router.refresh();
    setOpen(false);
  }

  async function createVariant(e: React.FormEvent) {
    e.preventDefault();
    if (!variantName.trim() || !variantParentId) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/worlds/${worldSlug}/ruleset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: variantName.trim(), parentRulesetId: variantParentId }),
    });
    if (!res.ok) {
      setBusy(false);
      setError(t("erreurCreationVariante"));
      return;
    }
    const created = (await res.json()) as { id: string };
    setVariantName("");
    await choose(created.id);
  }

  const officials = options.filter((o) => o.is_official_base);
  const variants = options.filter((o) => !o.is_official_base);

  return (
    <>
      <button
        type="button"
        onClick={openSelector}
        className="block w-full rounded-full border border-edge px-4 py-2 text-center text-sm font-medium text-ink transition-colors hover:bg-panel-raised"
      >
        {t("reglesActives")}
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[1100] flex items-center justify-center bg-scrim"
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label={t("choisirRuleset")}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[80vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-lg border border-edge-strong bg-panel-raised p-4 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink">{t("choisirRuleset")}</h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-xs text-ink-muted hover:text-ink"
                >
                  {t("fermer")}
                </button>
              </div>

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
                        <span className="text-sm text-ink">{ruleset.name}</span>
                      </div>
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
                    <select
                      value={variantParentId}
                      onChange={(e) => setVariantParentId(e.target.value)}
                      className="rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
                    >
                      {officials.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
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
                </form>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
