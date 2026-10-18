"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogoApp } from "@/components/brand/LogoApp";
import { clearCachedGet } from "@/components/shell/useCachedGet";
import { cheminInvitation, type PanneauTitre } from "@/lib/ui/ecranTitre";
import type { AppLogoKey } from "@/src/core/brand/identity";
import { createAccount, login, requestResetAction, type ActionState, type RequestResetState } from "./actions";

const etatInitial: ActionState = null;
const etatInitialOubli: RequestResetState = null;

const CHAMP =
  "rounded-xl border border-edge bg-panel-sunken px-3 py-2.5 text-sm text-ink outline-none focus:border-accent";
const LABEL = "flex flex-col gap-1.5 text-sm text-ink-soft";
const BOUTON_PLEIN =
  "rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50 motion-reduce:transition-none";
const BOUTON_LIEN = "self-start text-sm text-ink-muted hover:text-ink";
const PILULE =
  "rounded-full border border-edge-strong bg-panel px-4 py-3.5 text-base font-semibold text-ink backdrop-blur-md transition-[transform,border-color] duration-150 hover:scale-[1.03] hover:border-accent motion-reduce:transition-none motion-reduce:hover:scale-100";

interface EcranTitreProps {
  name: string;
  tagline: string;
  logoKey: AppLogoKey;
  logoUrl: string | null;
}

/**
 * Écran-titre (V3.1-85) : le nom et le logo de l'application, puis un menu de
 * trois pilules ; choisir en ouvre le panneau à la place du menu. La création
 * mène toujours à un compte « tag » (nom + mot de passe, aucun email) ; `/signup`
 * (compte à email) n'est pas lié d'ici.
 */
export function EcranTitre({ name, tagline, logoKey, logoUrl }: EcranTitreProps) {
  const t = useTranslations("ecranTitre");
  const [panneau, setPanneau] = useState<PanneauTitre>("menu");
  const searchParams = useSearchParams();
  const lienInvalide = searchParams.get("error") === "lien-invalide";

  // Point de passage obligé entre deux comptes (audit F-17) : le cache de
  // `useCachedGet` vit au niveau du module et survit aux navigations douces,
  // donc à `logout`/`login`. Le vider ici garantit qu'un compte ne voit jamais,
  // même fugacement, les données du précédent.
  useEffect(() => {
    clearCachedGet();
  }, []);

  const titres: Record<Exclude<PanneauTitre, "menu">, string> = {
    connexion: t("titreConnexion"),
    creation: t("titreCreation"),
    oubli: t("titreOubli"),
    invitation: t("titreInvitation"),
  };

  return (
    <div className="flex flex-1 flex-col items-center px-4 pb-10 pt-[12vh] font-sans">
      <div className="flex flex-col items-center gap-3 text-center md:flex-row md:gap-4">
        <LogoApp logoKey={logoKey} logoUrl={logoUrl} taille={84} />
        <h1 className="font-display text-[46px] font-extrabold leading-none tracking-tight text-ink [text-shadow:0_10px_40px_rgba(0,0,0,.6)] md:text-[72px]">
          {name}
        </h1>
      </div>
      {tagline && <p className="mt-3 text-center text-base text-ink-soft">{tagline}</p>}
      {lienInvalide && <p className="mt-3 text-center text-sm text-danger">{t("lienInvalideRefaire")}</p>}

      <div className="mt-10 flex w-full flex-col items-center">
        {panneau === "menu" ? (
          <nav aria-label={t("titreMenu")} className="flex w-[300px] max-w-full flex-col gap-3 md:w-[340px]">
            <button
              type="button"
              onClick={() => setPanneau("connexion")}
              className={`${PILULE} !border-accent !bg-accent !text-accent-ink`}
            >
              {t("seConnecter")}
            </button>
            <button type="button" onClick={() => setPanneau("creation")} className={PILULE}>
              {t("creerCompte")}
            </button>
            <button type="button" onClick={() => setPanneau("invitation")} className={PILULE}>
              {t("lienInvitation")}
            </button>
          </nav>
        ) : (
          <section className="flex w-[340px] max-w-full flex-col gap-3.5 rounded-3xl border border-edge bg-panel p-[18px] backdrop-blur-lg md:w-[380px] md:px-[22px] md:py-5">
            <button type="button" onClick={() => setPanneau("menu")} className="self-start text-sm text-accent hover:text-accent-hover">
              {t("menu")}
            </button>
            <h2 className="font-display text-[22px] font-extrabold text-ink">{titres[panneau]}</h2>
            {panneau === "connexion" && <PanneauConnexion onOubli={() => setPanneau("oubli")} />}
            {panneau === "creation" && <PanneauCreation />}
            {panneau === "oubli" && <PanneauOubli onRetour={() => setPanneau("connexion")} />}
            {panneau === "invitation" && <PanneauInvitation />}
          </section>
        )}
      </div>
    </div>
  );
}

function PanneauConnexion({ onOubli }: { onOubli: () => void }) {
  const t = useTranslations("ecranTitre");
  const [etat, action, enCours] = useActionState(login, etatInitial);
  // React vide un formulaire `action` après chaque envoi : le nom est gardé ici
  // pour qu'une faute de mot de passe ne le fasse pas retaper. Jamais le mot de passe.
  const [identifiant, setIdentifiant] = useState("");
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className={LABEL}>
        {t("identifiant")}
        <input
          name="identifier"
          type="text"
          required
          autoComplete="username"
          value={identifiant}
          onChange={(e) => setIdentifiant(e.target.value)}
          className={CHAMP}
        />
      </label>
      <label className={LABEL}>
        {t("motDePasse")}
        <input name="password" type="password" required autoComplete="current-password" className={CHAMP} />
      </label>
      {etat?.error && <p className="text-sm text-danger">{etat.error}</p>}
      <button type="submit" disabled={enCours} className={BOUTON_PLEIN}>
        {enCours ? t("connexionEnCours") : t("seConnecter")}
      </button>
      <button type="button" onClick={onOubli} className={BOUTON_LIEN}>
        {t("oubliLien")}
      </button>
    </form>
  );
}

function PanneauCreation() {
  const t = useTranslations("ecranTitre");
  const [etat, action, enCours] = useActionState(createAccount, etatInitial);
  const [nom, setNom] = useState("");
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className={LABEL}>
        {t("nom")}
        <input
          name="handleName"
          type="text"
          required
          maxLength={40}
          autoComplete="nickname"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          className={CHAMP}
        />
      </label>
      <label className={LABEL}>
        {t("motDePasse")}
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder={t("motDePasseCreation")}
          className={CHAMP}
        />
      </label>
      <p className="text-xs leading-relaxed text-ink-muted">{t("noteCreation")}</p>
      {etat?.error && <p className="text-sm text-danger">{etat.error}</p>}
      <button type="submit" disabled={enCours} className={BOUTON_PLEIN}>
        {enCours ? t("creationEnCours") : t("creerMonCompte")}
      </button>
    </form>
  );
}

function PanneauOubli({ onRetour }: { onRetour: () => void }) {
  const t = useTranslations("ecranTitre");
  const [etat, action, enCours] = useActionState(requestResetAction, etatInitialOubli);
  const envoyee = etat !== null && "success" in etat;
  return (
    <div className="flex flex-col gap-3">
      {envoyee ? (
        <p role="status" className="rounded-2xl border border-accent/50 bg-accent/10 px-3 py-2.5 text-sm leading-relaxed text-ink">
          {t("demandeEnvoyee")}
        </p>
      ) : (
        <form action={action} className="flex flex-col gap-3">
          <p className="text-xs leading-relaxed text-ink-muted">{t("noteOubli")}</p>
          <label className={LABEL}>
            {t("identifiant")}
            <input name="identifier" type="text" required autoComplete="username" className={CHAMP} />
          </label>
          {etat !== null && "error" in etat && <p className="text-sm text-danger">{etat.error}</p>}
          <button type="submit" disabled={enCours} className={BOUTON_PLEIN}>
            {enCours ? t("envoiEnCours") : t("envoyerDemande")}
          </button>
        </form>
      )}
      <button type="button" onClick={onRetour} className={BOUTON_LIEN}>
        {t("revenirConnexion")}
      </button>
    </div>
  );
}

function PanneauInvitation() {
  const t = useTranslations("ecranTitre");
  const router = useRouter();
  const [invalide, setInvalide] = useState(false);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const chemin = cheminInvitation(String(new FormData(e.currentTarget).get("lien") ?? ""));
        if (chemin === null) {
          setInvalide(true);
          return;
        }
        setInvalide(false);
        router.push(chemin);
      }}
    >
      <label className={LABEL}>
        {t("champLien")}
        <input name="lien" type="text" required autoComplete="off" onChange={() => setInvalide(false)} className={CHAMP} />
      </label>
      {invalide && <p className="text-sm text-danger">{t("lienInvalide")}</p>}
      <button type="submit" className={BOUTON_PLEIN}>
        {t("ouvrirInvitation")}
      </button>
    </form>
  );
}
