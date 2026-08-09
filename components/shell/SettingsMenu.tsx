"use client";

import { useActionState, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  deleteAccountAction,
  setLocaleAction,
  updateDisplayNameAction,
  type DeleteAccountState,
  type UpdateDisplayNameState,
} from "@/app/settings/actions";
import ShareLinkPanel from "./ShareLinkPanel";
import type { ShareLinkSummary } from "@/src/server/services/shareLinks";

const MODES = ["dark", "dim", "soft", "light"] as const;

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000`;
}

function DisplayNameForm({ initialDisplayName }: { initialDisplayName: string }) {
  const t = useTranslations("settings.compte");
  const [state, formAction, pending] = useActionState<UpdateDisplayNameState, FormData>(
    updateDisplayNameAction,
    null,
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input
        name="displayName"
        defaultValue={initialDisplayName}
        placeholder={t("pseudoPlaceholder")}
        maxLength={80}
        className="flex-1 rounded-md border border-edge bg-panel-raised px-2.5 py-1.5 text-sm text-ink outline-none placeholder:text-ink-muted"
      />
      <button
        type="submit"
        disabled={pending}
        className="shrink-0 rounded-md border border-edge px-3 py-1.5 text-sm text-ink transition-colors hover:bg-panel-raised disabled:opacity-50"
      >
        {state && "ok" in state ? t("enregistre") : t("enregistrer")}
      </button>
      {state && "error" in state && <p className="text-xs text-danger">{state.error}</p>}
    </form>
  );
}

function DeleteAccountSection() {
  const t = useTranslations("settings.suppression");
  const [revealed, setRevealed] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [state, formAction, pending] = useActionState<DeleteAccountState, FormData>(deleteAccountAction, null);

  if (!revealed) {
    return (
      <button
        type="button"
        onClick={() => setRevealed(true)}
        className="rounded-md border border-danger/50 px-3 py-1.5 text-sm text-danger transition-colors hover:bg-danger/10"
      >
        {t("supprimerCompte")}
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-md border border-danger/50 bg-danger/5 p-3">
      <p className="text-xs text-danger">{t("avertissement")}</p>
      <label className="text-xs text-ink-muted">
        {t("confirmationLabel")}
        <input
          name="confirmation"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          className="mt-1 w-full rounded-md border border-edge bg-panel-raised px-2.5 py-1.5 font-mech text-sm text-ink outline-none"
          autoComplete="off"
        />
      </label>
      {state?.error && <p className="text-xs text-danger">{t("erreur")}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || confirmation !== t("confirmationMot")}
          className="rounded-md bg-danger px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-danger/90 disabled:opacity-40"
        >
          {pending ? t("enCours") : t("confirmer")}
        </button>
        <button
          type="button"
          onClick={() => {
            setRevealed(false);
            setConfirmation("");
          }}
          className="rounded-md border border-edge px-3 py-1.5 text-sm text-ink-muted transition-colors hover:bg-panel-raised"
        >
          {t("annuler")}
        </button>
      </div>
    </form>
  );
}

export default function SettingsMenu({
  currentMode,
  currentContrast,
  currentLocale,
  email,
  displayName,
}: {
  currentMode: string;
  currentContrast: string;
  currentLocale: string;
  email: string;
  displayName: string;
}) {
  const t = useTranslations("settings");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(currentMode);
  const [contrast, setContrast] = useState(currentContrast);

  // Le panneau de partage a quitte l'accueil du monde pour cet onglet
  // (V1-C4) : ce composant est rendu globalement (app/layout.tsx), hors de
  // tout contexte serveur de monde, donc le monde courant se detecte depuis
  // l'URL plutot que d'etre recu en props.
  const pathname = usePathname();
  const worldSlug = pathname.match(/^\/m\/([^/]+)/)?.[1] ?? null;
  const [shareData, setShareData] = useState<{ worldId: string; links: ShareLinkSummary[] } | null>(null);

  function refreshShareData() {
    if (!worldSlug) return;
    fetch(`/api/worlds/${worldSlug}/share-links`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { worldId: string; links: ShareLinkSummary[] } | null) => {
        if (body) setShareData(body);
      })
      .catch(() => {});
  }

  useEffect(() => {
    if (!open || !worldSlug) return;
    let cancelled = false;
    fetch(`/api/worlds/${worldSlug}/share-links`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { worldId: string; links: ShareLinkSummary[] } | null) => {
        if (!cancelled && body) setShareData(body);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, worldSlug]);

  useEffect(() => {
    document.documentElement.dataset.mode = mode;
    setCookie("mode", mode);
  }, [mode]);

  useEffect(() => {
    if (contrast === "high") {
      document.documentElement.dataset.contrast = "high";
    } else {
      delete document.documentElement.dataset.contrast;
    }
    setCookie("contrast", contrast);
  }, [contrast]);

  function toggleContrast() {
    setContrast((c) => (c === "high" ? "off" : "high"));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("ouvrir")}
        className="fixed left-4 top-2.5 z-50 flex h-9 w-9 items-center justify-center rounded-full border border-edge bg-panel text-ink shadow-lg transition-colors hover:bg-panel-raised"
      >
        ⚙
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-scrim pt-[8vh]"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={t("titre")}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[80vh] w-full max-w-md flex-col gap-5 overflow-y-auto rounded-lg border border-edge-strong bg-panel-raised p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="block-title text-lg">{t("titre")}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("fermer")}
                className="text-ink-muted hover:text-ink"
              >
                ×
              </button>
            </div>

            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {t("langue.titre")}
              </h3>
              <form action={setLocaleAction} className="flex gap-2">
                {(["fr", "en"] as const).map((locale) => (
                  <button
                    key={locale}
                    type="submit"
                    name="locale"
                    value={locale}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                      currentLocale === locale
                        ? "border-accent text-accent"
                        : "border-edge text-ink-muted hover:text-ink"
                    }`}
                  >
                    {t(`langue.${locale}`)}
                  </button>
                ))}
              </form>
            </section>

            <section className="flex flex-col gap-2 border-t border-edge pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {t("theme.titre")}
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-ink transition-colors hover:bg-panel ${
                      mode === m ? "ring-1 ring-accent" : ""
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full border border-edge mode-swatch-${m}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full mode-swatch-${m}-accent`} />
                    </span>
                    {t(`theme.${m}`)}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={toggleContrast}
                className={`self-start rounded-md border border-edge px-2.5 py-1.5 text-left text-sm text-ink transition-colors hover:bg-panel ${
                  contrast === "high" ? "text-accent" : ""
                }`}
              >
                {t("theme.contrasteEleve")} {contrast === "high" ? "✓" : ""}
              </button>
            </section>

            <section className="flex flex-col gap-2 border-t border-edge pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {t("compte.titre")}
              </h3>
              <p className="text-sm text-ink-muted">{email}</p>
              <DisplayNameForm initialDisplayName={displayName} />
            </section>

            {worldSlug && shareData && (
              <section className="border-t border-edge pt-4">
                <ShareLinkPanel
                  worldId={shareData.worldId}
                  worldSlug={worldSlug}
                  links={shareData.links}
                  onMutated={refreshShareData}
                />
              </section>
            )}

            <section className="flex flex-col gap-2 border-t border-edge pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {t("collaboration.titre")}
              </h3>
              <button
                type="button"
                disabled
                title={t("collaboration.bientot")}
                className="cursor-not-allowed self-start rounded-md border border-edge px-3 py-1.5 text-sm text-ink-muted opacity-60"
              >
                {t("collaboration.inviterMJ")} — {t("collaboration.bientot")}
              </button>
            </section>

            <section className="flex flex-col gap-2 border-t border-edge pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {t("suppression.titre")}
              </h3>
              <DeleteAccountSection />
            </section>
          </div>
        </div>
      )}
    </>
  );
}
