import PlayerRulesSidebar from "@/components/rules/PlayerRulesSidebar";

/**
 * Onglet Regles (retour utilisateur 31 août) : meme disposition a deux
 * volets que l'onglet Wiki (`../wiki/layout.tsx`) — sommaire etroit et
 * persistant + fiche centrale a `max-w-[70ch]`, "exactement la
 * presentation du wiki public" appliquee ici a la liste des regles plutot
 * qu'aux entites.
 */
export default async function JoueurReglesLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ worldSlug: string }>;
}) {
  const { worldSlug } = await params;

  return (
    <div className="flex h-full min-h-0">
      <aside className="no-scrollbar min-h-0 w-44 shrink-0 overflow-y-auto pr-4">
        <PlayerRulesSidebar worldSlug={worldSlug} />
      </aside>
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto border-l border-edge/60 pl-6">
        <div className="mx-auto max-w-[70ch]">{children}</div>
      </main>
    </div>
  );
}
