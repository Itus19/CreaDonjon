import WikiBackgroundProvider from "@/components/entities/public/WikiBackgroundProvider";

/**
 * Seul endroit qui persiste entre deux fiches d'un meme lien de partage
 * (V2-G13 suite) : porte le fond de page wiki, pour qu'il puisse
 * s'estomper en quittant une fiche plutot que de couper net a chaque
 * navigation — voir `WikiBackgroundProvider.tsx`.
 */
export default function ShareLinkLayout({ children }: { children: React.ReactNode }) {
  return <WikiBackgroundProvider>{children}</WikiBackgroundProvider>;
}
