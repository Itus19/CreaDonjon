import PlayerRulesSidebar from "@/components/rules/PlayerRulesSidebar";
import TwoPaneReaderLayout from "@/components/shell/TwoPaneReaderLayout";

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

  return <TwoPaneReaderLayout sidebar={<PlayerRulesSidebar worldSlug={worldSlug} />}>{children}</TwoPaneReaderLayout>;
}
