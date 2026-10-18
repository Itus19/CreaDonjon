"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { setLocaleAction } from "@/app/settings/actions";
import type { DonneesCompte, SectionCompte } from "@/lib/ui/compte";
import { entreesSommaire, partiesContexte, sectionActive } from "@/lib/ui/pageCompte";
import DisplayNameForm from "./DisplayNameForm";
import PasswordForm from "./PasswordForm";
import MyInvitePanel from "./MyInvitePanel";
import DeleteAccountSection from "./DeleteAccountSection";

const idSection = (s: SectionCompte) => `compte-section-${s}`;

/**
 * La page Compte (V3.1-80) : six sections en cartes de verre et un sommaire
 * (colonne de 200 px des 1024 px, rangee de pastilles en dessous). Tout vient
 * avec la page (docs/CABLAGE.md C1) ; aucun chargement ici. `apparence` est
 * l'emplacement du ticket 81 : absent, la section et son entree n'existent pas.
 */
export default function PageCompte({ compte, apparence }: { compte: DonneesCompte; apparence?: ReactNode }) {
  const t = useTranslations("compte");
  const avecApparence = apparence != null;
  const sections = entreesSommaire({ aRejointParUnLien: compte.invite !== null, avecApparence });
  const [active, setActive] = useState<SectionCompte>(sections[0] ?? "identite");
  const visibles = useRef(new Set<SectionCompte>());
  const cle = sections.join(",");

  // Le defilement allume l'entree de la section visible (observateur nettoye au demontage).
  useEffect(() => {
    const ordre = cle.split(",") as SectionCompte[];
    const observateur = new IntersectionObserver(
      (entrees) => {
        for (const e of entrees) {
          const section = ordre.find((s) => idSection(s) === e.target.id);
          if (!section) continue;
          if (e.isIntersecting) visibles.current.add(section);
          else visibles.current.delete(section);
        }
        setActive((actuelle) => sectionActive(ordre, visibles.current, actuelle));
      },
      { rootMargin: "-10% 0px -60% 0px" },
    );
    for (const s of ordre) {
      const el = document.getElementById(idSection(s));
      if (el) observateur.observe(el);
    }
    const vus = visibles.current;
    return () => {
      observateur.disconnect();
      vus.clear();
    };
  }, [cle]);

  function aller(section: SectionCompte) {
    setActive(section);
    const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(idSection(section))?.scrollIntoView({ behavior: reduit ? "auto" : "smooth", block: "start" });
  }

  const libelle = (s: SectionCompte) => t(`sections.${s}`);
  const libelleCourt = (s: SectionCompte) => (s === "invitation" || s === "suppression" ? t(`sectionsCourt.${s}`) : libelle(s));

  const parties = partiesContexte(compte.contexte).map((p) =>
    p.cle === "mene"
      ? t("contexteMene", { nombre: p.nombre })
      : p.cle === "joue"
        ? t("contexteJoue", { nombre: p.nombre })
        : t("contexteSolo", { nombre: p.nombre }),
  );
  const contexte = [compte.displayName, parties.join(", ")].filter((x) => x !== "").join(" · ");

  function carte(section: SectionCompte, enfants: ReactNode) {
    const danger = section === "suppression";
    return (
      <section
        key={section}
        id={idSection(section)}
        aria-labelledby={`${idSection(section)}-titre`}
        className={`scroll-mt-16 flex min-w-0 flex-col gap-3 rounded-2xl border bg-panel p-4 transition-colors motion-reduce:transition-none ${
          danger ? "border-danger/60" : active === section ? "border-accent" : "border-edge"
        }`}
      >
        <h2
          id={`${idSection(section)}-titre`}
          className={`block-title text-sm ${danger ? "text-danger" : "text-ink"}`}
        >
          {libelle(section)}
        </h2>
        {enfants}
      </section>
    );
  }

  const contenu: Record<SectionCompte, ReactNode> = {
    identite: (
      <>
        <DisplayNameForm initialDisplayName={compte.displayName} />
        {compte.handle && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-ink-muted">{t("identifiant")}</span>
            <span className="break-all text-sm text-ink">
              {compte.handle.name}
              <span className="text-accent tabular-nums">#{compte.handle.tag}</span>
            </span>
            <p className="text-xs text-ink-muted">{t("identifiantNote", { nom: compte.handle.name })}</p>
          </div>
        )}
        {compte.email !== null && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-ink-muted">
              {t("email")} · {t("emailMention")}
            </span>
            <span className="break-all text-sm text-ink">{compte.email}</span>
          </div>
        )}
      </>
    ),
    connexion: (
      <>
        <p className="text-sm text-ink-muted">{compte.email === null ? t("connexionNoteNom") : t("connexionNoteEmail")}</p>
        <PasswordForm />
      </>
    ),
    invitation: compte.invite ? <MyInvitePanel initialInvite={compte.invite} /> : null,
    apparence: apparence ?? null,
    langue: (
      <>
        <div role="group" aria-label={t("langueAria")} className="flex flex-wrap gap-2">
          {(["fr", "en"] as const).map((l) => (
            <form key={l} action={setLocaleAction}>
              <input type="hidden" name="locale" value={l} />
              <button
                type="submit"
                aria-pressed={compte.locale === l}
                className={`rounded-full border px-3 py-1 text-sm transition-colors motion-reduce:transition-none ${
                  compte.locale === l
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-edge text-ink-muted hover:bg-panel-raised"
                }`}
              >
                {l === "fr" ? t("langueFr") : t("langueEn")}
              </button>
            </form>
          ))}
        </div>
        <p className="text-xs text-ink-muted">{t("langueNote")}</p>
      </>
    ),
    suppression: <DeleteAccountSection mondesPossedes={compte.mondesPossedes} />,
  };

  return (
    <div className="flex min-w-0 flex-col gap-4 p-1 lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start">
      <header className="flex flex-col gap-1 lg:col-span-2">
        <h1 className="block-title text-xl text-ink">{t("titre")}</h1>
        {contexte !== "" && <p className="break-words text-sm text-ink-muted">{contexte}</p>}
      </header>

      <nav
        aria-label={t("sommaireAria")}
        className="sticky top-0 z-10 flex flex-wrap gap-1.5 rounded-b-xl bg-panel/90 py-2 backdrop-blur-md lg:hidden"
      >
        {sections.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => aller(s)}
            aria-current={active === s ? "true" : undefined}
            className={`rounded-full border px-3 py-1 text-xs transition-colors motion-reduce:transition-none ${
              s === "suppression" ? "text-danger" : ""
            } ${active === s ? "border-accent bg-panel-raised" : "border-edge hover:bg-panel-raised"}`}
          >
            {libelleCourt(s)}
          </button>
        ))}
      </nav>
      <nav aria-label={t("sommaireAria")} className="sticky top-0 hidden flex-col gap-1 lg:flex">
        {sections.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => aller(s)}
            aria-current={active === s ? "true" : undefined}
            className={`rounded-lg border px-3 py-1.5 text-left text-sm transition-colors motion-reduce:transition-none ${
              s === "suppression" ? "text-danger" : active === s ? "text-ink" : "text-ink-muted"
            } ${active === s ? "border-accent bg-panel-raised" : "border-transparent hover:bg-panel-raised"}`}
          >
            {libelle(s)}
          </button>
        ))}
      </nav>

      <div className="flex min-w-0 flex-col gap-4">{sections.map((s) => carte(s, contenu[s]))}</div>
    </div>
  );
}
