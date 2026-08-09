import Link from "next/link";
import { useTranslations } from "next-intl";
import SectionToggle from "./SectionToggle";

/**
 * Coquille commune aux deux sections (Monde/Règles) : uniquement l'en-tete
 * (specs/coquille-et-design.md §3). Chaque section fournit son propre
 * contenu (barre laterale + fenetres flottantes pour Monde,
 * liste+detail pour Regles) via son propre layout imbrique — jamais la
 * meme barre laterale pour les deux, elles n'ont pas le meme usage.
 */
export default function AppShell({
  worldName,
  worldSlug,
  children,
}: {
  worldName: string;
  worldSlug: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("shell");
  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-edge bg-panel px-4 print:hidden">
        <Link href={`/m/${worldSlug}`} className="truncate font-chrome text-sm font-semibold text-ink">
          {worldName}
        </Link>
        <SectionToggle worldSlug={worldSlug} />
        <Link href="/" className="text-sm text-ink-muted hover:text-ink">
          {t("mesMondes")}
        </Link>
      </header>

      <div className="flex flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
