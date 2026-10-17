"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import FeuilleDuBas from "@/components/shared/FeuilleDuBas";
import { classerPageMj } from "@/lib/ui/barreMj";
import BarreFlottante, { type EntreeBarre } from "./BarreFlottante";
import { useDesktopWindowsState } from "./DesktopWindowsProvider";
import { IconeRail, TraitSvg } from "./Rail";
import RadioWidget from "./RadioWidget";
import { useSectionLiens } from "./SectionToggle";
import { useChatUnread } from "./useChatUnread";
import {
  RULE_TOOL_KEYS,
  mjToolHref,
  refsEqual,
  requeteFenetres,
  windowContentLabel,
  windowHref,
  type MjToolKey,
  type WindowRef,
} from "./windowRefs";

type FeuilleMj = "outils" | "table" | "fiches" | "aucuneFiche";

/** Une fiche de la pile : entite ou regle ouverte, affichee ou rangee en `?avec=`. */
interface FicheOuverte {
  id: string;
  ref: WindowRef;
  nom: string;
  type: string | null;
  courante: boolean;
}

/** Outils de la feuille « Outils », hors chat (qui a sa propre entree). */
type OutilFeuille = Exclude<MjToolKey, "chat">;

function IconeFiches() {
  return (
    <TraitSvg>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="11" r="2" />
      <path d="M5.5 16c.5-2 2-3 3-3s2.5 1 3 3M14 9.5h5M14 13h5" />
    </TraitSvg>
  );
}

function IconeTable() {
  return (
    <TraitSvg>
      <rect x="3" y="8" width="18" height="5" rx="1.5" />
      <path d="M6 13v7M18 13v7" />
    </TraitSvg>
  );
}

function IconeChat() {
  return (
    <TraitSvg>
      <path d="M4 5h16v11H8l-4 4V5Z" />
      <path d="M8 9h8M8 12.5h5" />
    </TraitSvg>
  );
}

/**
 * Barre flottante du telephone, cote MJ (V3.1-29) : Monde, Regles, Fiches |
 * Table, Chat, Outils. Montee UNE fois pour les trois sections MJ (Monde,
 * Regles, MJ) par `AppShell`, jamais sous `/joueur` ni `/apercu`
 * (`classerPageMj`). Elle n'ajoute aucun chargement reseau : la pile des
 * fiches lit l'etat deja present (`DesktopWindowsProvider`), les liens
 * reprennent le `?avec=` des sections (`useSectionLiens`).
 *
 * Tout ce qui s'ouvre vient du bas : Outils, Table et la pile des fiches sont
 * des `FeuilleDuBas`. Un outil choisi dans « Outils » navigue vers sa page
 * (`mjToolHref`) et ferme la feuille : `MjToolWindowContent` demande des
 * donnees chargees par `/api/.../window`, un chargement de plus que la page
 * routee, qui rend deja l'outil.
 */
export default function BarreTelephoneMj({ worldSlug }: { worldSlug: string }) {
  const t = useTranslations("shell");
  const tRegles = useTranslations("regles");
  const pathname = usePathname();
  const router = useRouter();
  const { unreadCount } = useChatUnread();
  const { openRefs, hrefWithWindows, navigate } = useSectionLiens(worldSlug);
  const state = useDesktopWindowsState();
  const [feuille, setFeuille] = useState<FeuilleMj | null>(null);

  const emplacement = classerPageMj(pathname, worldSlug, RULE_TOOL_KEYS);
  if (!emplacement) return null;

  const base = `/m/${worldSlug}`;
  const baseRegles = `${base}/regles`;
  const baseChat = mjToolHref(worldSlug, "chat");
  const surRoute = feuille === null;

  // ---- pile des fiches : l'etat des fenetres, lu tel quel ----
  const entityKindLabels = t.raw("kindLabelsSingular") as Record<string, string>;
  const entryTypeLabels = tRegles.raw("entryTypes") as Record<string, string>;
  const fiches: FicheOuverte[] = openRefs()
    .filter((ref) => ref.kind === "entity" || ref.kind === "rule")
    .map((ref) => {
      const courante = !!state?.primary && refsEqual(ref, state.primary.ref);
      const { name, badge } = courante
        ? { name: state!.primary!.name, badge: state!.primary!.badge }
        : windowContentLabel(ref, state?.avecWindows.find((w) => refsEqual(w.ref, ref))?.data);
      const traduit = badge ? ((ref.kind === "entity" ? entityKindLabels[badge] : entryTypeLabels[badge]) ?? badge) : null;
      return { id: `${ref.kind}:${ref.key}`, ref, nom: name, type: traduit, courante };
    });

  function aller(href: string) {
    setFeuille(null);
    router.push(href);
  }

  /** Affiche `ref` en page, les autres fenetres ouvertes rangees dans `?avec=` (meme format qu'en ordinateur). */
  function afficher(ref: WindowRef) {
    const autres = openRefs().filter((r) => !refsEqual(r, ref));
    const requete = requeteFenetres(autres, state?.disposition ?? null);
    aller(`${windowHref(worldSlug, ref)}${requete}`);
  }

  function retirer(fiche: FicheOuverte) {
    state?.closeWindow(fiche.ref);
    // La fiche affichee quitte la page, et sans autre fiche la feuille n'a plus rien a montrer.
    if (fiche.courante || fiches.length <= 1) setFeuille(null);
  }

  function toucherFiches() {
    if (fiches.length === 0) setFeuille("aucuneFiche");
    else if (emplacement!.page === "fiche") setFeuille("fiches");
    // Hors d'une fiche : on revient a la derniere ouverte.
    else afficher(fiches[fiches.length - 1].ref);
  }

  const entrees: EntreeBarre[] = [
    {
      cle: "monde",
      libelle: t("monde"),
      icone: <IconeRail nom="maison" />,
      actif: surRoute && emplacement.section === "monde" && emplacement.page !== "fiche",
      href: hrefWithWindows(base),
      onClick: (e) => {
        setFeuille(null);
        navigate(e, base);
      },
    },
    {
      cle: "regles",
      libelle: t("regles"),
      icone: <IconeRail nom="livres" />,
      actif: surRoute && emplacement.section === "regles" && emplacement.page !== "fiche",
      href: hrefWithWindows(baseRegles),
      onClick: (e) => {
        setFeuille(null);
        navigate(e, baseRegles);
      },
    },
    {
      cle: "fiches",
      libelle: t("fiches"),
      icone: <IconeFiches />,
      actif: surRoute ? emplacement.page === "fiche" : feuille === "fiches" || feuille === "aucuneFiche",
      onClick: toucherFiches,
      ouvreFeuille: true,
    },
    {
      cle: "table",
      libelle: t("table"),
      icone: <IconeTable />,
      actif: feuille === "table",
      onClick: () => setFeuille("table"),
      ouvreFeuille: true,
    },
    {
      cle: "chat",
      libelle: t("chat"),
      icone: <IconeChat />,
      actif: surRoute && emplacement.page === "chat",
      badge: unreadCount,
      href: hrefWithWindows(baseChat),
      onClick: (e) => {
        setFeuille(null);
        navigate(e, baseChat);
      },
    },
    {
      cle: "outils",
      libelle: t("outils"),
      icone: <IconeRail nom="outils" />,
      // Un outil ouvert en page garde l'entree allumee : on y est arrive par la feuille.
      actif: feuille === "outils" || (surRoute && emplacement.section === "mj" && emplacement.page === "outil"),
      onClick: () => setFeuille("outils"),
      ouvreFeuille: true,
    },
  ];

  return (
    <>
      <BarreFlottante entrees={entrees} libelle={t("barreMj")} />

      {/* Plusieurs fiches ouvertes : une seule s'affiche, la pastille ouvre la pile. */}
      {fiches.length >= 2 && (
        <button
          type="button"
          onClick={() => setFeuille("fiches")}
          aria-haspopup="dialog"
          className="fixed right-3 top-3 z-[41] rounded-full border border-edge bg-panel-raised px-3 py-1.5 text-xs text-ink shadow-md backdrop-blur-[var(--blur)] md:hidden print:hidden"
        >
          {t("fichesPastille", { count: fiches.length })} ▾
        </button>
      )}

      {feuille === "outils" && (
        <FeuilleOutils
          worldSlug={worldSlug}
          pathname={pathname}
          hrefWithWindows={hrefWithWindows}
          onAller={aller}
          onFermer={() => setFeuille(null)}
        />
      )}

      {feuille === "table" && (
        <FeuilleDuBas titre={t("tableBientot")} titreVisible onFermer={() => setFeuille(null)}>
          <p className="px-1 pb-2 text-sm text-ink-muted">{t("tableBientotTexte")}</p>
        </FeuilleDuBas>
      )}

      {feuille === "aucuneFiche" && (
        <FeuilleDuBas titre={t("fiches")} titreVisible onFermer={() => setFeuille(null)}>
          <p className="px-1 pb-2 text-sm text-ink-muted">{t("aucuneFiche")}</p>
        </FeuilleDuBas>
      )}

      {feuille === "fiches" && (
        <FeuilleDuBas titre={t("fichesOuvertes")} titreVisible onFermer={() => setFeuille(null)}>
          <ul className="flex flex-col gap-2 pb-1">
            {fiches.map((fiche) => (
              <li key={fiche.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => (fiche.courante ? setFeuille(null) : afficher(fiche.ref))}
                  aria-current={fiche.courante ? "true" : undefined}
                  className={`flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-2xl border px-3 py-2 text-left transition-colors hover:bg-panel-raised ${
                    fiche.courante ? "border-accent bg-panel" : "border-edge bg-panel"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{fiche.nom}</span>
                    {fiche.type && <span className="block truncate text-xs text-ink-muted">{fiche.type}</span>}
                  </span>
                  {fiche.courante && <span className="shrink-0 text-xs font-semibold text-accent">{t("ficheAffichee")}</span>}
                </button>
                <button
                  type="button"
                  onClick={() => retirer(fiche)}
                  aria-label={t("retirerFiche", { nom: fiche.nom })}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-panel hover:text-ink"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </FeuilleDuBas>
      )}
    </>
  );
}

/**
 * Feuille « Outils » : la radio en tete, puis les outils par moment de la
 * partie. Le chat n'y est pas : il a son entree dans la barre.
 */
function FeuilleOutils({
  worldSlug,
  pathname,
  hrefWithWindows,
  onAller,
  onFermer,
}: {
  worldSlug: string;
  pathname: string;
  hrefWithWindows: (base: string) => string;
  onAller: (href: string) => void;
  onFermer: () => void;
}) {
  const t = useTranslations("shell");
  const tMj = useTranslations("mj");

  const libelles: Record<OutilFeuille, string> = {
    initiative: tMj("initiative"),
    rencontres: tMj("rencontres"),
    generateurs: tMj("generateurs"),
    probabilites: tMj("probabilites"),
    table: t("table"),
    notes: tMj("blocNotes"),
    "livre-de-sessions": tMj("livreDeSessions"),
    calendrier: tMj("calendrier"),
    "calendrier-reel": tMj("calendrierReel"),
    "creation-personnage": tMj("creationPersonnage"),
    "gestion-campagne": tMj("gestionCampagne"),
    "journal-historique": tMj("journalHistorique"),
    "regles-actives": tMj("reglesActives"),
    publication: tMj("publication"),
    personnalisation: tMj("personnalisation"),
  };
  const groupes: { cle: string; titre: string; outils: OutilFeuille[] }[] = [
    { cle: "seance", titre: t("outilsEnSeance"), outils: ["initiative", "rencontres", "generateurs", "probabilites"] },
    {
      cle: "preparation",
      titre: t("outilsPreparation"),
      outils: ["notes", "livre-de-sessions", "calendrier", "calendrier-reel", "creation-personnage"],
    },
    {
      cle: "campagne",
      titre: t("outilsCampagne"),
      outils: ["gestion-campagne", "journal-historique", "regles-actives", "publication", "personnalisation"],
    },
  ];

  return (
    <FeuilleDuBas titre={t("outils")} titreVisible onFermer={onFermer}>
      <div className="flex flex-col gap-4 pb-1">
        <RadioWidget worldSlug={worldSlug} variante="feuille" />
        {groupes.map((groupe) => (
          <section key={groupe.cle}>
            <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">{groupe.titre}</h3>
            <ul className="grid grid-cols-2 gap-2">
              {groupe.outils.map((cle) => {
                const chemin = mjToolHref(worldSlug, cle);
                const actif = pathname === chemin;
                return (
                  <li key={cle}>
                    <Link
                      href={hrefWithWindows(chemin)}
                      prefetch={false}
                      aria-current={actif ? "page" : undefined}
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
                        e.preventDefault();
                        onAller(hrefWithWindows(chemin));
                      }}
                      className={`flex min-h-11 items-center rounded-2xl border bg-panel px-3 py-2 text-sm transition-colors hover:bg-panel-raised ${
                        actif ? "border-accent text-accent" : "border-edge text-ink"
                      }`}
                    >
                      {libelles[cle]}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </FeuilleDuBas>
  );
}
