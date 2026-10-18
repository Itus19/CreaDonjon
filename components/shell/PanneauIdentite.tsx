"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { LogoApp } from "@/components/brand/LogoApp";
import { APP_LOGO_KEYS, APP_NAME_MAX, APP_TAGLINE_MAX, DEFAULT_APP_IDENTITY, type AppLogoKey } from "@/src/core/brand/identity";
import { resetAppIdentityAction, updateAppIdentityAction } from "@/app/appIdentityActions";
import { actionLogo, choixInitial, type ChoixLogo } from "@/lib/ui/identiteApp";

export interface IdentiteAdmin {
  name: string;
  tagline: string;
  logoKey: AppLogoKey;
  logoUrl: string | null;
}

/** Recettes de la planche Admin-Decide (`.csec`, `.frow`, `.idg`, `.idprev`) en jetons de la charte. */
const CHAMP =
  "w-full rounded-md border border-edge bg-transparent px-3 py-1.5 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-accent lg:max-w-80";
const CASE_LOGO =
  "flex flex-col items-center gap-1.5 rounded-[14px] border bg-panel-sunken px-1 pb-2 pt-2.5 text-center text-xs transition-colors motion-reduce:transition-none";

/**
 * Panneau d'édition de l'identité (V3.1-88). L'aperçu suit chaque frappe sans
 * enregistrer ; l'enregistrement passe par `updateAppIdentityAction`, qui
 * invalide le cache : la page se re-rend d'elle-même avec la nouvelle
 * identité (aucun chargement ici, docs/CABLAGE.md C1).
 */
export default function PanneauIdentite({ identite }: { identite: IdentiteAdmin }) {
  const t = useTranslations("administration.identite");
  const [nom, setNom] = useState(identite.name);
  const [phrase, setPhrase] = useState(identite.tagline);
  const [cle, setCle] = useState<AppLogoKey>(identite.logoKey);
  const [choix, setChoix] = useState<ChoixLogo>(() => choixInitial(identite.logoUrl));
  const [fichier, setFichier] = useState<File | null>(null);
  const [urlApercu, setUrlApercu] = useState<string | null>(null);
  const entree = useRef<HTMLInputElement>(null);

  const [etat, enregistrer, enCours] = useActionState(updateAppIdentityAction, null);
  const [confirmation, setConfirmation] = useState(false);
  const [erreurReset, setErreurReset] = useState<string | null>(null);
  const [resetEnCours, demarrerReset] = useTransition();

  // L'identité enregistrée change (re-rendu après enregistrement) : les champs
  // s'alignent dessus. Réalignement pendant le rendu, sans effet de synchronisation.
  const signature = `${identite.name}|${identite.tagline}|${identite.logoKey}|${identite.logoUrl ?? ""}`;
  const [signatureVue, setSignatureVue] = useState(signature);
  if (signatureVue !== signature) {
    setSignatureVue(signature);
    setNom(identite.name);
    setPhrase(identite.tagline);
    setCle(identite.logoKey);
    setChoix(choixInitial(identite.logoUrl));
    setFichier(null);
    setUrlApercu(null);
  }

  // L'aperçu du fichier est révoqué à chaque changement et au démontage.
  useEffect(() => {
    return () => {
      if (urlApercu) URL.revokeObjectURL(urlApercu);
    };
  }, [urlApercu]);

  const televerseExistant = identite.logoUrl !== null;
  const logoMontre = choix === "televerse" ? (urlApercu ?? identite.logoUrl) : null;
  const action = actionLogo({ choix, fichierChoisi: fichier !== null, televerseExistant });

  function surFichier(f: File | null) {
    if (!f) return;
    setFichier(f);
    setUrlApercu(URL.createObjectURL(f));
    setChoix("televerse");
  }

  function surCaseTeleverser() {
    // Un téléversé (ancien ou nouveau) laissé de côté pour un dessin : on le reprend.
    if (choix === "dessin" && (fichier || televerseExistant)) {
      setChoix("televerse");
      return;
    }
    // Vidé avant d'ouvrir le sélecteur : rechoisir le même fichier redéclenche `onChange`.
    if (entree.current) entree.current.value = "";
    entree.current?.click();
  }

  function retablir() {
    setConfirmation(false);
    setErreurReset(null);
    demarrerReset(async () => {
      const res = await resetAppIdentityAction();
      if (res && "error" in res) {
        setErreurReset(res.error);
        return;
      }
      setNom(DEFAULT_APP_IDENTITY.name);
      setPhrase(DEFAULT_APP_IDENTITY.tagline);
      setCle(DEFAULT_APP_IDENTITY.logoKey);
      setChoix("dessin");
      setFichier(null);
      setUrlApercu(null);
      if (entree.current) entree.current.value = "";
    });
  }

  const occupe = enCours || resetEnCours;
  const erreur = etat && "error" in etat ? etat.error : erreurReset;

  return (
    <form action={enregistrer} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-edge bg-panel p-3 lg:p-4">
      <p className="text-xs leading-relaxed text-ink-muted">{t("note")}</p>

      <label className="grid items-center gap-1.5 text-sm lg:grid-cols-[170px_1fr] lg:gap-2.5">
        <span className="text-ink-muted">{t("nom")}</span>
        <input
          name="name"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          maxLength={APP_NAME_MAX}
          required
          autoComplete="off"
          className={CHAMP}
        />
      </label>

      <label className="grid items-center gap-1.5 text-sm lg:grid-cols-[170px_1fr] lg:gap-2.5">
        <span className="text-ink-muted">{t("phrase")}</span>
        <input
          name="tagline"
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          maxLength={APP_TAGLINE_MAX}
          autoComplete="off"
          className={CHAMP}
        />
      </label>

      <div className="grid gap-1.5 text-sm lg:grid-cols-[170px_1fr] lg:items-start lg:gap-2.5">
        <span className="text-ink-muted">{t("logo")}</span>
        <div className="flex min-w-0 flex-col gap-2">
          <div role="group" aria-label={t("logoGrilleAria")} className="grid grid-cols-4 gap-1.5 lg:grid-cols-7 lg:gap-2">
            {APP_LOGO_KEYS.map((k) => {
              const choisi = choix === "dessin" && cle === k;
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={choisi}
                  onClick={() => {
                    setCle(k);
                    setChoix("dessin");
                  }}
                  className={`${CASE_LOGO} ${choisi ? "border-accent text-ink ring-1 ring-accent" : "border-edge text-ink-muted hover:border-edge-strong"}`}
                >
                  <LogoApp logoKey={k} taille={36} />
                  {t(`logos.${k}`)}
                </button>
              );
            })}
            <button
              type="button"
              aria-pressed={choix === "televerse"}
              onClick={surCaseTeleverser}
              className={`${CASE_LOGO} justify-center border-dashed ${
                choix === "televerse" ? "border-accent text-ink ring-1 ring-accent" : "border-edge text-accent hover:border-edge-strong"
              }`}
            >
              {logoMontre ? (
                <>
                  <LogoApp logoKey={cle} logoUrl={logoMontre} taille={36} />
                  {t("televerse")}
                </>
              ) : (
                t("televerser")
              )}
            </button>
            <input
              ref={entree}
              type="file"
              // Sans nom hors téléversement : un fichier choisi puis laissé pour un dessin ne part pas avec le formulaire.
              name={action === "upload" ? "logoFile" : undefined}
              accept="image/png,image/webp"
              className="hidden"
              onChange={(e) => surFichier(e.target.files?.[0] ?? null)}
            />
          </div>
          <p className="text-xs leading-relaxed text-ink-muted">{t("noteLogo")}</p>
        </div>
      </div>

      <input type="hidden" name="logoKey" value={cle} />
      <input type="hidden" name="logoAction" value={action} />

      <div className="grid gap-1.5 text-sm lg:grid-cols-[170px_1fr] lg:items-start lg:gap-2.5">
        <span className="text-ink-muted">{t("apercu")}</span>
        <div
          aria-hidden="true"
          className="relative flex h-[150px] min-w-0 flex-col items-center justify-center gap-2 overflow-hidden rounded-[18px] border border-edge bg-black/40 px-3 backdrop-blur-xl lg:h-[200px]"
        >
          <div className="flex min-w-0 flex-col items-center gap-3 text-center lg:flex-row lg:gap-4">
            <LogoApp logoKey={cle} logoUrl={logoMontre} taille={56} className="max-lg:hidden" />
            <LogoApp logoKey={cle} logoUrl={logoMontre} taille={40} className="lg:hidden" />
            <span className="max-w-full break-words font-display text-[26px] font-extrabold leading-none tracking-tight text-ink [text-shadow:0_10px_40px_rgba(0,0,0,.6)] lg:text-[40px]">
              {nom}
            </span>
          </div>
          {phrase && <span className="max-w-full break-words text-center text-sm text-ink-soft">{phrase}</span>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={occupe}
          className="rounded-md border border-accent/50 bg-accent/15 px-3 py-1.5 text-xs text-accent transition-colors hover:bg-accent/25 disabled:opacity-50 motion-reduce:transition-none max-md:w-full"
        >
          {enCours ? t("enregistrement") : t("enregistrer")}
        </button>
        <button
          type="button"
          disabled={occupe}
          onClick={() => setConfirmation(true)}
          className="rounded-md border border-edge px-3 py-1.5 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50 motion-reduce:transition-none max-md:w-full"
        >
          {t("retablir", { nom: DEFAULT_APP_IDENTITY.name })}
        </button>
        {etat && "ok" in etat && !enCours && (
          <span role="status" className="text-xs text-success">
            {t("enregistre")}
          </span>
        )}
      </div>
      {erreur && (
        <p role="alert" className="text-xs text-danger">
          {erreur}
        </p>
      )}

      <ConfirmDialog
        open={confirmation}
        title={t("retablirTitre")}
        message={t("retablirMessage")}
        confirmLabel={t("retablir", { nom: DEFAULT_APP_IDENTITY.name })}
        danger
        onConfirm={retablir}
        onCancel={() => setConfirmation(false)}
      />
    </form>
  );
}
