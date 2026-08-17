"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

/**
 * Barre laterale du Compagnon MJ (nouvel onglet, meme repli mobile que
 * RulesSidebar/Sidebar) : campagnes et probabilites aujourd'hui (V1-E5), le
 * reste en reserve — generateurs/rencontres sont explicitement V2
 * (specs/outils-mj.md), le bloc-notes attend son propre ticket. Les
 * entrees reservees restent visibles (pas de fonctionnalite cachee) mais
 * desactivees, meme convention que "Inviter un MJ" dans le menu de reglages.
 */
export default function MjSidebar({ worldSlug }: { worldSlug: string }) {
  const t = useTranslations("mj");
  const tShell = useTranslations("shell");
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isCampagnes = pathname === `/m/${worldSlug}/mj`;
  const isProbabilites = pathname === `/m/${worldSlug}/mj/probabilites`;

  const reserved = [t("tablesAleatoires"), t("rencontres"), t("blocNotes")];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={tShell("ouvrirArborescence")}
        className="fixed left-3 top-[68px] z-40 rounded-md border border-edge bg-panel-raised p-2 text-sm text-ink shadow-md md:hidden"
      >
        ☰
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-scrim md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 top-14 z-50 flex w-[280px] shrink-0 flex-col gap-1 border-r border-edge bg-panel-sunken p-4 transition-transform md:static md:top-0 md:z-auto md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Link
          href={`/m/${worldSlug}/mj`}
          onClick={() => setOpen(false)}
          className={`rounded px-2 py-1.5 text-sm transition-colors hover:bg-panel-raised ${
            isCampagnes ? "bg-panel-raised text-accent" : "text-ink-soft"
          }`}
        >
          {t("campagnes")}
        </Link>

        <Link
          href={`/m/${worldSlug}/mj/probabilites`}
          onClick={() => setOpen(false)}
          className={`rounded px-2 py-1.5 text-sm transition-colors hover:bg-panel-raised ${
            isProbabilites ? "bg-panel-raised text-accent" : "text-ink-soft"
          }`}
        >
          {t("probabilites")}
        </Link>

        <div className="mt-3 flex flex-col gap-1 border-t border-edge/60 pt-3">
          {reserved.map((label) => (
            <span
              key={label}
              className="flex items-center justify-between rounded px-2 py-1.5 text-sm text-ink-muted opacity-60"
              title={t("bientot")}
            >
              {label}
              <span className="text-[10px] uppercase tracking-wider">{t("bientot")}</span>
            </span>
          ))}
        </div>
      </aside>
    </>
  );
}
