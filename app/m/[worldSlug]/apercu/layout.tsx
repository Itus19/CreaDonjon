import WikiBackgroundProvider from "@/components/entities/public/WikiBackgroundProvider";

/**
 * Seul endroit qui persiste entre deux fiches d'un meme monde en apercu
 * (V2-G13 suite) : porte le fond de page wiki, pour qu'il puisse
 * s'estomper en quittant une fiche plutot que de couper net a chaque
 * navigation — voir `WikiBackgroundProvider.tsx`.
 */
export default function ApercuLayout({ children }: { children: React.ReactNode }) {
  return <WikiBackgroundProvider>{children}</WikiBackgroundProvider>;
}
