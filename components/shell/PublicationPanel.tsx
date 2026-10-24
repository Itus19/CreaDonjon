"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { updateWikiWelcomeMessageAction, type UpdateWikiWelcomeMessageState } from "@/app/m/[worldSlug]/wikiSettingsActions";
import Tabs from "@/components/shared/Tabs";
import { MODES_APPARENCE, modeApresChoixDeFond } from "@/lib/ui/apparence";
import { enregistrerFondWiki, MESSAGE_ACCUEIL_MAX } from "@/lib/ui/publication";
import { wikiBackgroundInputFromRef, type WikiBackgroundInput } from "@/src/core/theme/worldWikiBackground";
import type { ThemeMode } from "@/src/core/theme/oklch";
import type { PublicationData } from "@/src/server/services/publication";
import ApercuVisiteur from "./ApercuVisiteur";
import BackgroundPicker, { type BackgroundSelection } from "./BackgroundPicker";
import ShareLinkPanel from "./ShareLinkPanel";

/** Délai sans mouvement du curseur avant d'enregistrer le flou : une seule requête par geste. */
const DELAI_FLOU_MS = 500;

const CARTE = "rounded-[18px] border border-edge bg-panel p-4 backdrop-blur-[var(--blur)]";

/** Le fond tel que l'écran le connaît : l'enregistré, ou la vignette qu'on vient de choisir. */
interface FondLocal {
  ref: string | null;
  libelle: string;
  imageUrl: string;
  hue: number;
  chroma: number;
  availableModes: readonly string[];
}

/**
 * Message d'accueil du wiki public (V2-G2, extension) : remplace le gros
 * titre de la page d'accueil du lien de partage. Vide = la page publique
 * retombe sur le nom de la campagne. Le texte vit dans le parent (`message`)
 * pour que l'aperçu le suive à la frappe.
 */
function MessageAccueil({
  worldId,
  message,
  onChange,
  initialMessage,
}: {
  worldId: string;
  message: string;
  onChange: (valeur: string) => void;
  initialMessage: string;
}) {
  const t = useTranslations("publication.message");
  const [dernierEnvoye, setDernierEnvoye] = useState(initialMessage);
  const [state, formAction, pending] = useActionState<UpdateWikiWelcomeMessageState, FormData>(async (precedent, formData) => {
    const resultat = await updateWikiWelcomeMessageAction(precedent, formData);
    if (resultat && "ok" in resultat) setDernierEnvoye(String(formData.get("message") ?? ""));
    return resultat;
  }, null);
  const enregistre = state !== null && "ok" in state && message === dernierEnvoye;

  return (
    <section className={`flex flex-col gap-2 ${CARTE}`}>
      <form action={formAction} className="flex flex-col gap-2">
        <input type="hidden" name="worldId" value={worldId} />
        <label className="flex flex-col gap-1 text-sm text-ink">
          {t("titre")}
          <textarea
            name="message"
            value={message}
            onChange={(e) => onChange(e.target.value)}
            maxLength={MESSAGE_ACCUEIL_MAX}
            rows={3}
            placeholder={t("placeholder")}
            className="w-full resize-y rounded-md border border-edge bg-panel-raised px-2.5 py-1.5 text-sm text-ink outline-none placeholder:text-ink-muted"
          />
        </label>
        <p className="text-xs text-ink-muted">{t("aide")}</p>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-edge px-3 py-1.5 text-sm text-ink transition-colors hover:bg-panel-raised disabled:opacity-50 motion-reduce:transition-none"
          >
            {enregistre ? t("enregistre") : t("enregistrer")}
          </button>
          <span className="text-xs tabular-nums text-ink-muted">{t("compteur", { n: message.length, max: MESSAGE_ACCUEIL_MAX })}</span>
        </div>
        {state && "error" in state && <p className="text-xs text-danger">{state.error}</p>}
      </form>
    </section>
  );
}

/**
 * Publication du wiki public (V3.1-60) : les réglages à gauche, ce que voit un
 * visiteur à droite. Tout arrive en props (docs/CABLAGE.md C1) ; l'aperçu ne
 * fait aucune requête, il suit l'état local. Le fond, le mode et le flou
 * s'enregistrent par `PUT /api/worlds/[slug]/wiki-background`.
 */
export default function PublicationPanel({ worldSlug, publication }: { worldSlug: string; publication: PublicationData }) {
  const router = useRouter();
  const t = useTranslations("publication");
  const ts = useTranslations("settings");
  const { worldId, links, wikiWelcomeMessage, campaignName, publicTree, wikiBackground } = publication;

  const [message, setMessage] = useState(wikiWelcomeMessage);
  const [fond, setFond] = useState<FondLocal | null>(
    wikiBackground
      ? {
          ref: wikiBackground.ref,
          libelle: "",
          imageUrl: wikiBackground.imageUrl,
          hue: wikiBackground.hue,
          chroma: wikiBackground.chroma,
          availableModes: wikiBackground.availableModes,
        }
      : null
  );
  const [mode, setMode] = useState<ThemeMode>(wikiBackground?.mode ?? "dark");
  const [blur, setBlur] = useState(wikiBackground?.blur ?? 0);
  const [annonce, setAnnonce] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  // Les dernières valeurs, pour que la minuterie du flou n'enregistre pas un mode périmé.
  const modeRef = useRef(mode);
  const blurRef = useRef(blur);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (minuterie.current) clearTimeout(minuterie.current);
    },
    []
  );

  // Les envois partent l'un après l'autre : un « keep » (mode, flou) ne doit
  // jamais arriver avant le choix du fond qui le précède, sinon il réglerait
  // l'ancien fond.
  const file = useRef<Promise<void>>(Promise.resolve());
  function enregistrer(corps: WikiBackgroundInput) {
    file.current = file.current.then(async () => {
      setErreur(null);
      setErreur(await enregistrerFondWiki(worldSlug, corps, t("fond.echec")));
    });
  }

  function choisirFond(selection: BackgroundSelection) {
    const suite = modeApresChoixDeFond(mode, selection.availableModes);
    const nouveauMode = suite.mode as ThemeMode;
    setFond({ ...selection, imageUrl: selection.backdropUrl });
    setMode(nouveauMode);
    modeRef.current = nouveauMode;
    setAnnonce(suite.bascule ? ts("theme.bascule", { fond: selection.libelle, apres: ts(`theme.${nouveauMode}`) }) : null);
    enregistrer(wikiBackgroundInputFromRef(selection.ref, nouveauMode, blur));
  }

  function choisirMode(nouveau: ThemeMode) {
    setMode(nouveau);
    modeRef.current = nouveau;
    setAnnonce(null);
    enregistrer({ source: "keep", mode: nouveau, blur: blurRef.current });
  }

  function changerFlou(valeur: number) {
    setBlur(valeur);
    blurRef.current = valeur;
    if (minuterie.current) clearTimeout(minuterie.current);
    minuterie.current = setTimeout(() => {
      minuterie.current = null;
      enregistrer({ source: "keep", mode: modeRef.current, blur: blurRef.current });
    }, DELAI_FLOU_MS);
  }

  const modeItems = MODES_APPARENCE.map((m) => {
    const permis = fond !== null && fond.availableModes.includes(m);
    return { value: m, label: ts(`theme.${m}`), disabled: !permis, title: permis ? undefined : ts("theme.modeIllisible") };
  });

  return (
    <div className="@container flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h1 className="block-title text-lg">{t("titre")}</h1>
        <a
          href={`/m/${worldSlug}/apercu`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-edge px-3 py-1.5 text-sm text-ink transition-colors hover:bg-panel-raised motion-reduce:transition-none"
        >
          {t("previsualiser")}
        </a>
      </div>

      <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] @3xl:items-start">
        <div className="order-1 @md:order-4 @3xl:order-1 @3xl:col-start-1">
          {/* Sa propre carte de verre : l'envelopper la doublerait. */}
          <ShareLinkPanel worldId={worldId} worldSlug={worldSlug} links={links} onMutated={() => router.refresh()} />
        </div>

        <div className="order-2 @3xl:col-start-1">
          <MessageAccueil worldId={worldId} message={message} onChange={setMessage} initialMessage={wikiWelcomeMessage} />
        </div>

        <section className={`order-3 flex flex-col gap-3 @3xl:col-start-1 ${CARTE}`}>
          <div className="flex flex-col gap-0.5">
            <h2 className="text-sm font-semibold text-ink">{t("fond.titre")}</h2>
            <p className="text-xs text-ink-muted">{t("fond.aide")}</p>
          </div>
          <BackgroundPicker currentRef={wikiBackground?.ref ?? ""} onSelectionChange={choisirFond} />
          <div className="flex flex-wrap items-center gap-2.5 text-sm text-ink">
            <span className="shrink-0">{t("fond.modes")}</span>
            <Tabs value={mode} items={modeItems} onChange={choisirMode} aria-label={t("fond.modes")} />
          </div>
          <p role="status" className="min-h-0 text-xs text-accent empty:hidden">
            {annonce}
          </p>
          <label className="flex items-center gap-2.5 text-sm text-ink">
            <span className="shrink-0">{t("fond.flou")}</span>
            <input
              type="range"
              min={0}
              max={40}
              step={2}
              value={blur}
              disabled={fond === null}
              onChange={(e) => changerFlou(Number(e.target.value))}
              className="min-w-0 flex-1 accent-accent disabled:opacity-50"
            />
            <b className="w-12 shrink-0 text-right font-medium tabular-nums">{ts("theme.flouValeur", { valeur: blur })}</b>
          </label>
          {erreur && <p className="text-xs text-danger">{erreur}</p>}
        </section>

        <div className="order-4 @md:order-1 @3xl:order-4 @3xl:sticky @3xl:top-4 @3xl:col-start-2 @3xl:row-span-3 @3xl:row-start-1">
          <h2 className="mb-2 text-sm font-semibold text-ink">{t("apercu.titre")}</h2>
          <ApercuVisiteur
            message={message}
            campaignName={campaignName}
            publicTree={publicTree}
            fond={fond ? { imageUrl: fond.imageUrl, hue: fond.hue, chroma: fond.chroma } : null}
            mode={mode}
            blur={blur}
          />
        </div>
      </div>
    </div>
  );
}
