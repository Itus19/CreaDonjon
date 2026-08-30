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
import { updateWikiWelcomeMessageAction, type UpdateWikiWelcomeMessageState } from "@/app/m/[worldSlug]/wikiSettingsActions";
import ShareLinkPanel from "./ShareLinkPanel";
import type { ShareLinkSummary } from "@/src/server/services/shareLinks";
import InviteLinkPanel from "./InviteLinkPanel";
import MyInvitePanel from "./MyInvitePanel";
import Tabs from "@/components/shared/Tabs";
import RulesetSelector from "@/components/rules/RulesetSelector";
import BackgroundPicker, { type BackgroundSelection } from "./BackgroundPicker";

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

/**
 * Message d'accueil du wiki public (V2-G2, extension) : remplace le gros
 * titre de la page d'accueil du lien de partage — voir `BookSkin` et
 * `app/partage/[token]/page.tsx`. Vide = pas de personnalisation, la page
 * publique retombe alors sur un message calcule (nom de la campagne).
 */
function WikiWelcomeMessageForm({ worldId, initialMessage }: { worldId: string; initialMessage: string }) {
  const [state, formAction, pending] = useActionState<UpdateWikiWelcomeMessageState, FormData>(
    updateWikiWelcomeMessageAction,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="worldId" value={worldId} />
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        Message d&apos;accueil du wiki
        <textarea
          name="message"
          defaultValue={initialMessage}
          maxLength={500}
          rows={2}
          placeholder="Bienvenue dans la campagne — … ! L'aventure commence ici !"
          className="w-full resize-y rounded-md border border-edge bg-panel-raised px-2.5 py-1.5 text-sm text-ink outline-none placeholder:text-ink-muted"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md border border-edge px-3 py-1.5 text-sm text-ink transition-colors hover:bg-panel-raised disabled:opacity-50"
      >
        {state && "ok" in state ? "Enregistré" : "Enregistrer"}
      </button>
      {state && "error" in state && <p className="text-xs text-danger">{state.error}</p>}
    </form>
  );
}

interface GmCampaignSummary {
  campaignId: string;
  campaignName: string;
  worldId: string;
  worldName: string;
  worldSlug: string;
  members: { userId: string; role: string }[];
}

/**
 * Onglet Collaboration (V2-K7) : reprend le flux d'invitation deja
 * existant au niveau campagne (`CampaignDetail.tsx`, meme route API
 * `/api/campaigns/[campaignId]/members`) plutot que d'en ecrire un
 * second — seul ce qui manquait avant ce ticket est nouveau : une vue
 * transversale (`/api/campaigns/mine`) listant les campagnes dont
 * l'utilisateur est MJ, tous mondes confondus, pour choisir la cible de
 * l'invitation et voir les membres deja presents partout.
 */
function CollaborationTab() {
  const t = useTranslations("settings.collaboration");
  const [campaigns, setCampaigns] = useState<GmCampaignSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"gm" | "player">("player");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    fetch("/api/campaigns/mine")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: { campaigns: GmCampaignSummary[] }) => {
        setCampaigns(body.campaigns);
        setSelectedId((prev) => prev || body.campaigns[0]?.campaignId || "");
      })
      .catch(() => setLoadError(t("erreurChargement")));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule fois au montage (activation de l'onglet), pas a chaque frappe de traduction
  useEffect(load, []);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !email.trim()) return;
    setBusy(true);
    setInviteError(null);
    const res = await fetch(`/api/campaigns/${selectedId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), role }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setInviteError(body?.error ?? t("erreurInvitation"));
      return;
    }
    setEmail("");
    load();
  }

  if (campaigns === null) {
    return loadError ? (
      <p className="text-xs text-danger">{loadError}</p>
    ) : (
      <p className="text-xs text-ink-muted">…</p>
    );
  }

  if (campaigns.length === 0) {
    return <p className="text-sm text-ink-muted">{t("aucuneCampagneMj")}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={invite} className="flex flex-col gap-2">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
        >
          {campaigns.map((c) => (
            <option key={c.campaignId} value={c.campaignId}>
              {c.campaignName} — {c.worldName}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("inviterPlaceholder")}
            className="flex-1 rounded-md border border-edge bg-panel-raised px-2.5 py-1.5 text-sm text-ink outline-none placeholder:text-ink-muted"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "gm" | "player")}
            className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
          >
            <option value="player">{t("rolePlayer")}</option>
            <option value="gm">{t("roleGm")}</option>
          </select>
          <button
            type="submit"
            disabled={busy || !email.trim()}
            className="shrink-0 rounded-md border border-edge px-3 py-1.5 text-sm text-ink transition-colors hover:bg-panel-raised disabled:opacity-50"
          >
            {t("inviter")}
          </button>
        </div>
        {inviteError && <p className="text-xs text-danger">{inviteError}</p>}
      </form>

      <div className="flex flex-col gap-3 border-t border-edge pt-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("mesCampagnes")}</h3>
        {campaigns.map((c) => (
          <div key={c.campaignId} className="flex flex-col gap-1">
            <p className="text-sm text-ink">
              {c.campaignName} <span className="text-xs text-ink-muted">— {c.worldName}</span>
            </p>
            {c.members.length === 0 ? (
              <p className="text-xs text-ink-muted">{t("aucunMembre")}</p>
            ) : (
              <ul className="flex flex-col gap-0.5 text-xs text-ink-muted">
                {c.members.map((m) => (
                  <li key={m.userId}>
                    {m.role === "gm" ? t("roleGm") : t("rolePlayer")} — {m.userId}
                  </li>
                ))}
              </ul>
            )}
            <InviteLinkPanel campaignId={c.campaignId} />
          </div>
        ))}
      </div>
    </div>
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
  currentBackgroundRef,
  currentBackgroundAvailableModes,
  currentBgBlur,
}: {
  currentMode: string;
  currentContrast: string;
  currentLocale: string;
  email: string;
  displayName: string;
  currentBackgroundRef: string;
  currentBackgroundAvailableModes: string[];
  currentBgBlur: number;
}) {
  const t = useTranslations("settings");
  const tShell = useTranslations("shell");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(currentMode);
  const [contrast, setContrast] = useState(currentContrast);
  const [backgroundAvailableModes, setBackgroundAvailableModes] = useState(currentBackgroundAvailableModes);
  const [bgBlur, setBgBlur] = useState(currentBgBlur);
  // Premier composant d'onglets du depot (V2-K5) — pur decoupage des
  // sections deja existantes, aucun changement de comportement. L'onglet
  // "regles" n'existe que dans le contexte d'un monde (V2-K6), tout comme
  // "publication" (V2-G2) qui recoit desormais ShareLinkPanel — hors du
  // contexte d'un monde il n'y a rien a publier.
  const [tab, setTab] = useState<"general" | "regles" | "publication" | "collaboration">("general");

  // Le panneau de partage a quitte l'accueil du monde pour cet onglet
  // (V1-C4) : ce composant est rendu globalement (app/layout.tsx), hors de
  // tout contexte serveur de monde, donc le monde courant se detecte depuis
  // l'URL plutot que d'etre recu en props.
  const pathname = usePathname();
  const worldSlug = pathname.match(/^\/m\/([^/]+)/)?.[1] ?? null;
  const [shareData, setShareData] = useState<{
    worldId: string;
    links: ShareLinkSummary[];
    wikiWelcomeMessage: string | null;
  } | null>(null);

  function refreshShareData() {
    if (!worldSlug) return;
    fetch(`/api/worlds/${worldSlug}/share-links`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { worldId: string; links: ShareLinkSummary[]; wikiWelcomeMessage: string | null } | null) => {
        if (body) setShareData(body);
      })
      .catch(() => {});
  }

  useEffect(() => {
    if (!open || !worldSlug) return;
    let cancelled = false;
    fetch(`/api/worlds/${worldSlug}/share-links`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { worldId: string; links: ShareLinkSummary[]; wikiWelcomeMessage: string | null } | null) => {
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

  /**
   * Applique une selection de fond d'ecran (V2-G4 reformule) : meme
   * technique que `mode`/`contrast` ci-dessus (cookie + ecriture DOM
   * directe, aucun rechargement) — mais `--h`/`--c` vivent sur `<html>` et
   * `--bg-image` sur `.app-backdrop`, un frere de ce composant dans
   * `app/layout.tsx`, jamais un ancetre React de celui-ci : d'ou la
   * selection par attribut plutot qu'une ref.
   */
  function handleBackgroundSelection(selection: BackgroundSelection) {
    document.documentElement.style.setProperty("--h", String(selection.hue));
    document.documentElement.style.setProperty("--c", String(selection.chroma));
    document.querySelector<HTMLElement>(".app-backdrop")?.style.setProperty("--bg-image", `url("${selection.backdropUrl}")`);
    setBackgroundAvailableModes(selection.availableModes);
    if (!selection.availableModes.includes(mode)) {
      const fallbackMode = selection.availableModes[0];
      if (fallbackMode) setMode(fallbackMode);
    }
    setCookie("background", selection.ref);
  }

  useEffect(() => {
    document.documentElement.style.setProperty("--bg-blur", `${bgBlur}px`);
    setCookie("bgBlur", String(bgBlur));
  }, [bgBlur]);

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

            <Tabs
              value={tab}
              onChange={(v) => setTab(v as "general" | "regles" | "publication" | "collaboration")}
              items={[
                { value: "general", label: t("general") },
                ...(worldSlug ? [{ value: "regles", label: tShell("regles") }] : []),
                ...(worldSlug ? [{ value: "publication", label: "Publication" }] : []),
                { value: "collaboration", label: t("collaboration.titre") },
              ]}
            />

            {tab === "general" && (
              <>
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
                    {MODES.map((m) => {
                      const disabled = !backgroundAvailableModes.includes(m);
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setMode(m)}
                          disabled={disabled}
                          title={disabled ? "Ce fond ne permet pas ce mode de façon lisible" : undefined}
                          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-ink transition-colors hover:bg-panel disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent ${
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
                      );
                    })}
                  </div>
                  <BackgroundPicker currentRef={currentBackgroundRef} onSelectionChange={handleBackgroundSelection} />
                  <label className="flex flex-col gap-1 text-xs text-ink-muted">
                    Flou du fond ({bgBlur}px)
                    <input
                      type="range"
                      min={0}
                      max={40}
                      step={2}
                      value={bgBlur}
                      onChange={(e) => setBgBlur(Number(e.target.value))}
                      className="accent-accent"
                    />
                  </label>
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

                <MyInvitePanel />

                <section className="flex flex-col gap-2 border-t border-edge pt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    {t("suppression.titre")}
                  </h3>
                  <DeleteAccountSection />
                </section>
              </>
            )}

            {tab === "regles" && worldSlug && (
              <section className="flex flex-col gap-2">
                <RulesetSelector worldSlug={worldSlug} />
              </section>
            )}

            {tab === "publication" && worldSlug && (
              <section className="flex flex-col gap-3">
                <a
                  href={`/m/${worldSlug}/apercu`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="self-start rounded-full border border-edge px-3 py-1.5 text-sm text-ink transition-colors hover:bg-panel-raised"
                >
                  Prévisualiser ↗
                </a>
                {shareData && (
                  <>
                    <WikiWelcomeMessageForm
                      worldId={shareData.worldId}
                      initialMessage={shareData.wikiWelcomeMessage ?? ""}
                    />
                    <ShareLinkPanel
                      worldId={shareData.worldId}
                      worldSlug={worldSlug}
                      links={shareData.links}
                      onMutated={refreshShareData}
                    />
                  </>
                )}
              </section>
            )}

            {tab === "collaboration" && (
              <section className="flex flex-col gap-2">
                <CollaborationTab />
              </section>
            )}
          </div>
        </div>
      )}
    </>
  );
}
