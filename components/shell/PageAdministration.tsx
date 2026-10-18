"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import ActionsMenu, { type ActionsMenuItem } from "@/components/shared/ActionsMenu";
import Dropdown from "@/components/shared/Dropdown";
import { LogoApp } from "@/components/brand/LogoApp";
import PanneauIdentite from "@/components/shell/PanneauIdentite";
import type { AppLogoKey } from "@/src/core/brand/identity";
import type { CampaignInviteAdminSummary } from "@/src/server/services/campaignInvites";
import type { AdminAccountRow } from "@/src/server/repos/account";
import { delaiEcoule } from "@/lib/ui/accueil";
import { aTraiter, compteurs, filtrerComptes, pourMemoire, tuileInitiale, type TuileAdmin } from "@/lib/ui/administration";

const ROLE_LABELS: Record<string, string> = { gm: "MJ", player: "Joueur" };

/** Gabarit commun d'une ligne de verre (`.ar` de la planche). */
const LIGNE_VERRE = "relative rounded-xl border border-edge bg-panel-sunken px-3 py-2 text-sm";
/** Étiquettes (`.flag`) : 12 px, la charte interdit 11 px. */
const ETIQUETTE = "whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs";
const BOUTON_PRIMAIRE =
  "rounded-md border border-accent/50 bg-accent/15 px-3 py-1.5 text-xs text-accent transition-colors hover:bg-accent/25 disabled:opacity-50 motion-reduce:transition-none";

/** « il y a 2 h », avec les libellés de l'accueil ; `maintenant` est lu une fois par la page. */
function useIlYa(maintenant: number): (quandIso: string) => string {
  const tAcc = useTranslations("accueil");
  return (quandIso) => {
    const d = delaiEcoule(quandIso, maintenant);
    if (d.unite === "minutes") return tAcc("ilYaMinutes", { nombre: d.nombre });
    if (d.unite === "heures") return tAcc("ilYaHeures", { nombre: d.nombre });
    if (d.unite === "jours") return tAcc("ilYaJours", { nombre: d.nombre });
    return tAcc("ilYaMaintenant");
  };
}

/** Lien à usage unique d'une réinitialisation forcée, affiché comme avant. */
function LienReinitialisation({ lien }: { lien: string }) {
  return (
    <p className="text-xs text-ink-muted">
      Lien à usage unique, à transmettre hors application : <span className="break-all text-ink">{lien}</span>
    </p>
  );
}

/**
 * « Forcer une réinitialisation » : la requête d'`AccountAdminRow` d'avant,
 * partagée entre la ligne « à traiter » et le menu ⋮ d'un compte.
 */
function useForcerReinitialisation(accountId: string, onForced: (id: string, lien: string) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function forcer() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/accounts/${accountId}/reset-password`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      setError("Échec de la génération du lien.");
      return;
    }
    const body = (await res.json()) as { url: string };
    onForced(accountId, `${window.location.origin}${body.url}`);
  }
  return { busy, error, forcer };
}

/** Une demande de réinitialisation, avec son geste en un clic. */
function LigneATraiter({
  account,
  texte,
  onForced,
}: {
  account: AdminAccountRow;
  texte: string;
  onForced: (id: string, lien: string) => void;
}) {
  const { busy, error, forcer } = useForcerReinitialisation(account.id, onForced);
  return (
    <li className={`${LIGNE_VERRE} flex flex-wrap items-center gap-x-3 gap-y-2`}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-panel-raised font-bold text-ink" aria-hidden="true">
        {account.handle_name.charAt(0).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1 text-ink">{texte}</span>
      <button type="button" onClick={() => void forcer()} disabled={busy} className={`${BOUTON_PRIMAIRE} max-md:w-full`}>
        Forcer une réinitialisation
      </button>
      {error && (
        <span role="alert" className="basis-full text-xs text-danger">
          {error}
        </span>
      )}
    </li>
  );
}

/** Une ligne de compte : gestes d'`AccountAdminRow` inchangés. Jamais `handle_tag`. */
function LigneCompte({
  account,
  allAccounts,
  lienForce,
  maintenant,
  onForced,
  onChanged,
  onDeleted,
}: {
  account: AdminAccountRow;
  allAccounts: AdminAccountRow[];
  lienForce: string | undefined;
  maintenant: number;
  onForced: (id: string, lien: string) => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const t = useTranslations("administration");
  const locale = useLocale();
  const { busy: busyForce, error: errorForce, forcer } = useForcerReinitialisation(account.id, onForced);
  const [busyAutre, setBusyAutre] = useState(false);
  const [errorAutre, setErrorAutre] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [ownedRulesets, setOwnedRulesets] = useState<{ id: string; name: string }[] | null>(null);
  const [selectedRulesetId, setSelectedRulesetId] = useState("");
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const busy = busyForce || busyAutre;
  const error = errorForce ?? errorAutre;

  const ilYa = useIlYa(maintenant);

  async function openTransfer() {
    setTransferring(true);
    if (ownedRulesets !== null) return;
    const res = await fetch(`/api/admin/accounts/${account.id}/rulesets`);
    if (!res.ok) {
      setOwnedRulesets([]);
      return;
    }
    const body = (await res.json()) as { rulesets: { id: string; name: string }[] };
    setOwnedRulesets(body.rulesets);
  }

  async function submitTransfer() {
    if (!selectedRulesetId || !selectedTargetId) return;
    setBusyAutre(true);
    setErrorAutre(null);
    const res = await fetch(`/api/admin/rulesets/${selectedRulesetId}/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newOwnerId: selectedTargetId }),
    });
    setBusyAutre(false);
    if (!res.ok) {
      setErrorAutre("Échec du transfert.");
      return;
    }
    setTransferring(false);
    setSelectedRulesetId("");
    setSelectedTargetId("");
    setOwnedRulesets(null);
    onChanged();
  }

  async function deleteAccount() {
    setConfirmingDelete(false);
    setBusyAutre(true);
    setErrorAutre(null);
    const res = await fetch(`/api/admin/accounts/${account.id}`, { method: "DELETE" });
    setBusyAutre(false);
    if (!res.ok) {
      setErrorAutre("Échec de la suppression.");
      return;
    }
    onDeleted();
  }

  const ignoreSiBusy = (geste: () => void) => () => {
    if (busy) return;
    geste();
  };
  const actions: ActionsMenuItem[] = [
    { label: "Forcer une réinitialisation", onSelect: ignoreSiBusy(() => void forcer()) },
    { label: "Transférer un ruleset…", onSelect: ignoreSiBusy(() => void openTransfer()) },
    { label: "Supprimer le compte", onSelect: ignoreSiBusy(() => setConfirmingDelete(true)), danger: true },
  ];

  const targetOptions = [
    { value: "", label: "Choisir un compte…" },
    ...allAccounts.filter((a) => a.id !== account.id).map((a) => ({ value: a.id, label: a.handle_name })),
  ];
  const rulesetOptions = [
    { value: "", label: ownedRulesets === null ? "Chargement…" : "Choisir un ruleset…" },
    ...(ownedRulesets ?? []).map((r) => ({ value: r.id, label: r.name })),
  ];

  const etiquettes = account.account_role === "superadmin" || account.password_reset_requested_at || account.must_change_password;

  return (
    <li className={`${LIGNE_VERRE} flex flex-col gap-2`}>
      <div className="grid grid-cols-[34px_1fr_34px] items-center gap-x-3 gap-y-1 lg:grid-cols-[34px_1fr_auto_34px]">
        <span
          className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-panel-raised font-bold text-ink"
          aria-hidden="true"
        >
          {account.handle_name.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold text-ink">{account.handle_name}</span>
          <small className="text-xs text-ink-muted">
            {t("depuisLe", {
              date: new Date(account.created_at).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" }),
            })}
          </small>
        </span>
        {etiquettes && (
          <span className="col-start-2 row-start-2 flex flex-wrap gap-1.5 lg:col-start-3 lg:row-start-1">
            {account.account_role === "superadmin" && (
              <span className={`${ETIQUETTE} border-link-entity/50 bg-link-entity/15 text-link-entity`}>{t("flagSuperadmin")}</span>
            )}
            {account.password_reset_requested_at && (
              <span className={`${ETIQUETTE} border-accent/50 bg-accent/15 text-accent`}>
                {t("flagDemande", { delai: ilYa(account.password_reset_requested_at) })}
              </span>
            )}
            {account.must_change_password && (
              <span className={`${ETIQUETTE} border-edge-strong bg-panel-raised text-ink-soft`}>{t("flagDoitChanger")}</span>
            )}
          </span>
        )}
        <span className="col-start-3 row-start-1 justify-self-end lg:col-start-4">
          <ActionsMenu items={actions} aria-label={`Actions sur le compte ${account.handle_name}`} />
        </span>
      </div>
      <ConfirmDialog
        open={confirmingDelete}
        title="Supprimer ce compte ?"
        message={`Le compte ${account.handle_name} est définitivement supprimé, ainsi que son accès à tous les mondes. Les fiches créées depuis ce compte sont conservées.`}
        confirmLabel="Supprimer le compte"
        danger
        onConfirm={deleteAccount}
        onCancel={() => setConfirmingDelete(false)}
      />
      {lienForce && <LienReinitialisation lien={lienForce} />}
      {transferring && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-edge bg-panel-sunken p-2">
          <Dropdown
            value={selectedRulesetId}
            onChange={setSelectedRulesetId}
            options={rulesetOptions}
            aria-label="Ruleset à transférer"
            triggerClassName="rounded-md border border-edge bg-transparent px-2 py-1 text-xs text-ink outline-none"
          />
          <span className="text-xs text-ink-muted">vers</span>
          <Dropdown
            value={selectedTargetId}
            onChange={setSelectedTargetId}
            options={targetOptions}
            aria-label="Nouveau propriétaire"
            triggerClassName="rounded-md border border-edge bg-transparent px-2 py-1 text-xs text-ink outline-none"
          />
          <button
            type="button"
            onClick={submitTransfer}
            disabled={busy || !selectedRulesetId || !selectedTargetId}
            className="rounded-md border border-edge px-2 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50"
          >
            Transférer
          </button>
          <button type="button" onClick={() => setTransferring(false)} className="text-xs text-ink-muted hover:text-ink">
            Annuler
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </li>
  );
}

const COLONNES_LIEN = "lg:grid-cols-[1.1fr_1.6fr_50px_1fr_1fr_34px]";

/** Une ligne de lien d'invitation : gestes d'`InviteAdminRow` inchangés. */
function LigneLien({
  invite,
  copiedUrl,
  onCopy,
  onRevoked,
  onChanged,
  onAccountDeleted,
}: {
  invite: CampaignInviteAdminSummary;
  copiedUrl: string | null;
  onCopy: (url: string) => void;
  onRevoked: (id: string) => void;
  onChanged: () => void;
  onAccountDeleted: () => void;
}) {
  const [editingPassword, setEditingPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freshUrl, setFreshUrl] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const url = freshUrl ?? (invite.token ? `${window.location.origin}/rejoindre/${invite.token}` : null);
  const copied = copiedUrl !== null && copiedUrl === url;

  async function savePassword() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/campaigns/${invite.campaignId}/invites/${invite.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Échec de la mise à jour.");
      return;
    }
    setEditingPassword(false);
    setPassword("");
    onChanged();
  }

  async function reset() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/invites/${invite.id}/reset`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      setError("Échec de la réinitialisation.");
      return;
    }
    const body = (await res.json()) as { url: string };
    setFreshUrl(`${window.location.origin}${body.url}`);
  }

  /** Révoquer retire l'ACCÈS et plus seulement le jeton (V2.1-25) : le geste est confirmé. */
  async function revoke() {
    setConfirmingRevoke(false);
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/campaigns/${invite.campaignId}/invites/${invite.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setError("Échec de la révocation.");
      return;
    }
    onRevoked(invite.id);
  }

  async function deleteAccount() {
    setConfirmingDelete(false);
    if (!invite.claimedByUserId) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/accounts/${invite.claimedByUserId}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setError("Échec de la suppression.");
      return;
    }
    onAccountDeleted();
  }

  /** « Voir comme » : changement de session RÉEL, bandeau de retour dans `app/layout.tsx`. */
  async function viewAs() {
    if (!invite.claimedByUserId) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/view-as", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: invite.claimedByUserId }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Échec du changement de session.");
      return;
    }
    const { url: cible } = (await res.json()) as { url: string };
    // `assign` et non `href = …` : règle `react-hooks/immutability` (comme avant).
    window.location.assign(cible);
  }

  const ignoreSiBusy = (geste: () => void) => () => {
    if (busy) return;
    geste();
  };
  const actions: ActionsMenuItem[] = [
    ...(url ? [{ label: copied ? "Copié ✓" : "Copier le lien", onSelect: () => void navigator.clipboard.writeText(url).then(() => onCopy(url)) }] : []),
    ...(invite.claimedByUserId ? [{ label: "Voir comme", onSelect: ignoreSiBusy(() => void viewAs()) }] : []),
    { label: editingPassword ? "Fermer le mot de passe" : "Mot de passe", onSelect: () => setEditingPassword((v) => !v) },
    { label: "Réinitialiser le lien", onSelect: ignoreSiBusy(() => void reset()), danger: true },
    { label: "Révoquer", onSelect: ignoreSiBusy(() => setConfirmingRevoke(true)), danger: true },
    ...(invite.claimedByUserId ? [{ label: "Supprimer le compte", onSelect: ignoreSiBusy(() => setConfirmingDelete(true)), danger: true }] : []),
  ];

  return (
    <li className={`${LIGNE_VERRE} flex flex-col gap-2`}>
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 pr-10 lg:grid lg:gap-3 lg:pr-0 ${COLONNES_LIEN}`}>
        <span className="font-semibold text-ink">{invite.worldName ?? "?"}</span>
        <span className="text-ink-soft">{invite.campaignName ?? "—"}</span>
        <span className="text-ink-soft">{invite.intendedRole ? ROLE_LABELS[invite.intendedRole] : "Au choix"}</span>
        <span className="text-ink-soft">{invite.claimedName ?? "—"}</span>
        <span className="text-ink-soft">{invite.hasPassword ? <span className="text-accent">protégé</span> : "—"}</span>
        <span className="absolute right-2 top-2 lg:static lg:justify-self-end">
          <ActionsMenu items={actions} aria-label={`Actions sur le lien ${invite.worldName ?? ""}`} />
        </span>
      </div>
      <ConfirmDialog
        open={confirmingRevoke}
        title="Révoquer ce lien ?"
        message={
          invite.claimedName
            ? `${invite.claimedName} perd l'accès à ${invite.campaignName ?? invite.worldName ?? "cette campagne"}, et son personnage redevient libre. Le compte et les fiches créées depuis ce compte sont conservés.`
            : "Ce lien cesse de fonctionner. Personne ne l'avait encore utilisé."
        }
        confirmLabel="Révoquer"
        danger
        onConfirm={revoke}
        onCancel={() => setConfirmingRevoke(false)}
      />
      <ConfirmDialog
        open={confirmingDelete}
        title="Supprimer ce compte ?"
        message={`Le compte de ${invite.claimedName ?? "cet ami"} est définitivement supprimé, ainsi que son accès à la campagne. Les fiches créées depuis ce compte sont conservées.`}
        confirmLabel="Supprimer le compte"
        danger
        onConfirm={deleteAccount}
        onCancel={() => setConfirmingDelete(false)}
      />
      {freshUrl && <p className="text-xs text-danger">Nouveau lien généré — copiez-le maintenant, l&apos;ancien ne fonctionne plus.</p>}
      {editingPassword && (
        <div className="flex items-center gap-2 rounded-md border border-edge bg-panel-sunken p-2">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={invite.hasPassword ? "Nouveau mot de passe (vide pour retirer)" : "Mot de passe (optionnel)"}
            className="flex-1 rounded-md border border-edge bg-transparent px-2 py-1 text-xs text-ink outline-none placeholder:text-ink-muted"
          />
          <button
            type="button"
            onClick={savePassword}
            disabled={busy}
            className="shrink-0 rounded-md border border-edge px-2 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50"
          >
            Enregistrer
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </li>
  );
}

/**
 * La page Administration (V3.1-87) : le tableau de bord du superadmin. Tout
 * arrive avec la page (docs/CABLAGE.md C1) ; les listes vivent dans l'état
 * local et les compteurs en sont dérivés, donc ils suivent les gestes sans
 * recharger la page. Seule la suppression d'un compte (rare) relit les deux
 * listes, car elle libère aussi des liens.
 */
export default function PageAdministration({
  comptesInitiaux,
  liensInitiaux,
  identite,
  nombreTitres,
}: {
  comptesInitiaux: AdminAccountRow[];
  liensInitiaux: CampaignInviteAdminSummary[];
  identite: { name: string; tagline: string; logoKey: AppLogoKey; logoUrl: string | null };
  nombreTitres: number;
}) {
  const t = useTranslations("administration");
  const [comptes, setComptes] = useState(comptesInitiaux);
  const [liens, setLiens] = useState(liensInitiaux);
  const [tuile, setTuile] = useState<TuileAdmin>(() => tuileInitiale(aTraiter(comptesInitiaux).length));
  const [recherche, setRecherche] = useState("");
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [liensForces, setLiensForces] = useState<Record<string, string>>({});
  const [erreurRelecture, setErreurRelecture] = useState<string | null>(null);
  // L'heure est lue une fois, au montage : « il y a … » n'a pas besoin de tourner.
  const [maintenant] = useState(() => Date.now());

  const nombres = compteurs(comptes, liens);
  const demandes = aTraiter(comptes);
  const memoire = pourMemoire(comptes);
  const comptesVisibles = filtrerComptes(comptes, recherche);
  const nomDe = (id: string) => comptes.find((c) => c.id === id)?.handle_name ?? "";

  const ilYa = useIlYa(maintenant);

  function relireLiens() {
    fetch("/api/admin/invites")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: { invites: CampaignInviteAdminSummary[] }) => setLiens(body.invites))
      .catch(() => setErreurRelecture("Impossible de charger les liens."));
  }

  function relireComptes() {
    fetch("/api/admin/accounts")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: { accounts: AdminAccountRow[] }) => setComptes(body.accounts))
      .catch(() => setErreurRelecture("Impossible de charger les comptes."));
  }

  /** Après « forcer » : la demande est effacée, le compte doit changer son mot de passe. */
  function apresForcer(id: string, lien: string) {
    setLiensForces((prev) => ({ ...prev, [id]: lien }));
    setComptes((prev) => prev.map((c) => (c.id === id ? { ...c, password_reset_requested_at: null, must_change_password: true } : c)));
  }

  function apresCompteSupprime() {
    relireComptes();
    relireLiens();
  }

  const tuiles: { id: TuileAdmin; libelle: string; valeur: string; accent?: boolean }[] = [
    { id: "a_traiter", libelle: t("tuileATraiter"), valeur: String(nombres.aTraiter), accent: true },
    { id: "comptes", libelle: t("tuileComptes"), valeur: String(nombres.comptes) },
    { id: "liens", libelle: t("tuileLiens"), valeur: String(nombres.liens) },
    { id: "identite", libelle: t("tuileIdentite"), valeur: "" },
    { id: "titres", libelle: t("tuileTitres"), valeur: String(nombreTitres) },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4 p-4 md:px-6 md:pb-8">
      <header className="flex flex-col gap-0.5">
        <Link href="/" className="mb-1 text-sm text-accent md:hidden">
          ‹ {t("retourAccueil")}
        </Link>
        <h1 className="block-title text-[22px] text-ink md:text-2xl">{t("titre")}</h1>
        <p className="text-sm text-ink-muted">{t("sousTitre")}</p>
      </header>

      <div role="group" aria-label={t("tuilesAria")} className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {tuiles.map((tl) => (
          <button
            key={tl.id}
            type="button"
            aria-pressed={tuile === tl.id}
            onClick={() => setTuile(tl.id)}
            className={`flex min-w-0 flex-col gap-1.5 rounded-2xl border bg-panel px-3 py-3 text-left transition-colors motion-reduce:transition-none lg:px-4 lg:py-3.5 ${
              tl.id === "titres" ? "max-lg:col-span-2" : ""
            } ${tuile === tl.id ? "border-accent ring-1 ring-accent" : "border-edge hover:bg-panel-raised"}`}
          >
            {tl.id === "identite" ? (
              <span className="flex min-w-0 items-center gap-2">
                <LogoApp logoKey={identite.logoKey} logoUrl={identite.logoUrl} taille={32} />
                <b className="truncate whitespace-nowrap text-[15px] font-bold text-ink lg:text-lg">{identite.name}</b>
              </span>
            ) : (
              <b className={`text-[26px] font-extrabold leading-none lg:text-[32px] ${tl.accent ? "text-accent" : "text-ink"}`}>{tl.valeur}</b>
            )}
            <span className="text-xs text-ink-muted">{tl.libelle}</span>
          </button>
        ))}
      </div>

      {erreurRelecture && (
        <p role="alert" className="text-xs text-danger">
          {erreurRelecture}
        </p>
      )}

      {tuile === "a_traiter" && (
        <section aria-label={t("tuileATraiter")} className="flex flex-col gap-2">
          <h2 className="block-title text-sm text-ink">{t("tuileATraiter")}</h2>
          {Object.entries(liensForces).map(([id, lien]) => (
            <div key={id} className={LIGNE_VERRE}>
              <p className="text-xs text-ink-muted">{nomDe(id)}</p>
              <LienReinitialisation lien={lien} />
            </div>
          ))}
          {demandes.length === 0 && memoire.length === 0 && Object.keys(liensForces).length === 0 && (
            <p className="text-sm text-ink-muted">{t("rienATraiter")}</p>
          )}
          {demandes.length > 0 && (
            <ul className="flex flex-col gap-2">
              {demandes.map((c) => (
                <LigneATraiter
                  key={c.id}
                  account={c}
                  texte={t("demandeReinit", { nom: c.handle_name, delai: ilYa(c.password_reset_requested_at ?? "") })}
                  onForced={apresForcer}
                />
              ))}
            </ul>
          )}
          {memoire.length > 0 && (
            <ul className="flex flex-col gap-2">
              {memoire.map((c) => (
                <li key={c.id} className={`${LIGNE_VERRE} flex items-center gap-3 text-ink-muted`}>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-panel-raised font-bold text-ink" aria-hidden="true">
                    {c.handle_name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">{t("pourMemoire", { nom: c.handle_name })}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-ink-muted">{t("noteDemandes")}</p>
        </section>
      )}

      {tuile === "comptes" && (
        <section aria-label={t("tuileComptes")} className="flex flex-col gap-2">
          <h2 className="block-title text-sm text-ink">{t("tuileComptes")}</h2>
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder={t("recherchePlaceholder")}
            aria-label={t("rechercheLabel")}
            className="w-full rounded-md border border-edge bg-transparent px-3 py-1.5 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-accent"
          />
          {comptes.length === 0 && <p className="text-sm text-ink-muted">{t("aucunCompte")}</p>}
          {comptes.length > 0 && comptesVisibles.length === 0 && <p className="text-sm text-ink-muted">{t("aucunResultat")}</p>}
          <ul className="flex flex-col gap-2">
            {comptesVisibles.map((c) => (
              <LigneCompte
                key={c.id}
                account={c}
                allAccounts={comptes}
                lienForce={liensForces[c.id]}
                maintenant={maintenant}
                onForced={apresForcer}
                onChanged={relireComptes}
                onDeleted={apresCompteSupprime}
              />
            ))}
          </ul>
        </section>
      )}

      {tuile === "liens" && (
        <section aria-label={t("tuileLiens")} className="flex flex-col gap-2">
          <h2 className="block-title text-sm text-ink">{t("tuileLiens")}</h2>
          {liens.length === 0 && <p className="text-sm text-ink-muted">{t("aucunLien")}</p>}
          {liens.length > 0 && (
            <>
              <div className={`hidden gap-3 px-3 text-xs uppercase tracking-wider text-ink-muted lg:grid ${COLONNES_LIEN}`} aria-hidden="true">
                <span>{t("colMonde")}</span>
                <span>{t("colCampagne")}</span>
                <span>{t("colRole")}</span>
                <span>{t("colReclamePar")}</span>
                <span>{t("colEtat")}</span>
                <span />
              </div>
              <ul className="flex flex-col gap-2">
                {liens.map((invite) => (
                  <LigneLien
                    key={invite.id}
                    invite={invite}
                    copiedUrl={copiedUrl}
                    onCopy={setCopiedUrl}
                    onRevoked={(id) => setLiens((prev) => prev.filter((i) => i.id !== id))}
                    onChanged={relireLiens}
                    onAccountDeleted={apresCompteSupprime}
                  />
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {tuile === "identite" && (
        <section aria-label={t("tuileIdentite")} className="flex flex-col gap-2">
          <h2 className="block-title text-sm text-ink">{t("tuileIdentite")}</h2>
          <PanneauIdentite identite={identite} />
        </section>
      )}

      {tuile === "titres" && (
        <section aria-label={t("tuileTitres")} className="flex flex-col gap-2">
          <h2 className="block-title text-sm text-ink">{t("tuileTitres")}</h2>
          <p className="text-sm text-ink-muted">{t("titresBientot")}</p>
        </section>
      )}
    </div>
  );
}
