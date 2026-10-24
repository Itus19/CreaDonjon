import { useTranslations } from "next-intl";

/**
 * D'où vient un combattant — entité du monde, combattant improvisé, monstre
 * d'un bloc de statistiques. Icônes au trait (charte §10) : elles prennent la
 * couleur du texte et suivent les modes. Le libellé reste dans `title` et pour
 * les lecteurs d'écran : l'icône seule ne dit pas son sens.
 */
export default function IconeGenre({ genre }: { genre: string }) {
  const t = useTranslations("initiative");
  const libelle = genre === "entity" ? t("genreEntite") : genre === "custom" ? t("genreLibre") : t("genreMonstre");
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={libelle}
      className="h-3.5 w-3.5 shrink-0 text-ink-muted"
    >
      <title>{libelle}</title>
      {genre === "entity" ? (
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
        </>
      ) : genre === "custom" ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.4" />
          <path d="M12 16.8h.01" />
        </>
      ) : (
        <>
          <path d="M12 3a7 7 0 0 0-7 7c0 2.4 1.2 4.1 3 5.2V19h8v-3.8c1.8-1.1 3-2.8 3-5.2a7 7 0 0 0-7-7Z" />
          <circle cx="9.5" cy="10.5" r="1.2" />
          <circle cx="14.5" cy="10.5" r="1.2" />
          <path d="M10.5 19v2M13.5 19v2" />
        </>
      )}
    </svg>
  );
}
