import { getTranslations } from "next-intl/server";

/**
 * Accueil neutre de la section MJ — aucune fenetre primaire (meme motif que
 * `regles/page.tsx`, "choisissez une regle") : sans cet accueil distinct,
 * "fermer" un outil MJ n'avait nulle part ou revenir puisque `/mj` etait
 * jusqu'ici occupe par l'outil "Gestion de campagne" lui-meme (deplace sur
 * `/mj/gestion-campagne`), voir sa documentation pour le detail du bug.
 */
export default async function MjHomePage() {
  const t = await getTranslations("mj");
  return <p className="text-sm text-ink-muted">{t("choisirOutil")}</p>;
}
