# 0012 — Hébergement sur Vercel + Supabase (paliers gratuits), usage personnel

**Date :** 2026-08-27
**Statut :** acceptée (partiellement — voir « Questions ouvertes »)

## Contexte

Jusqu'ici, la cible de déploiement documentée était le fonctionnement local (`specs/cible-locale-et-ia.md`). L'utilisateur a demandé s'il pouvait plutôt déployer l'app pour lui-même et son groupe de joueuses, en cherchant d'abord si GitHub pouvait héberger l'app directement (non — GitHub Pages ne sert que du statique, pas de serveur ni de base de données), avant de se tourner vers l'option déjà en place dans le projet : Vercel (déjà configuré comme cible de déploiement) et Supabase (déjà le fournisseur de base de données).

Au même moment, l'utilisateur a précisé une ambition qui change l'échelle du contenu : illustrer l'intégralité du compendium SRD 2024 (sorts, créatures, objets), pas seulement les fiches de sa propre campagne — plusieurs centaines de fiches contre quelques dizaines.

## Options envisagées

- **A. GitHub Pages** — gratuit, mais statique uniquement. Rejeté : l'app a besoin d'un serveur (routes API, actions serveur) et d'une vraie base Postgres (RLS).
- **B. GitHub Codespaces** — ferait tourner la pile complète (Next.js + Postgres + Ollama), mais reste une machine virtuelle chez Microsoft/GitHub, pas la machine de l'utilisateur. Rejeté pour l'instant : contredit l'objectif que l'IA ne quitte jamais sa propre machine.
- **C. Auto-hébergement chez soi** (PC personnel ou petit serveur) — le plus fidèle à `specs/cible-locale-et-ia.md`, mais demande encore la brique de stockage local (règle 4 de ce document) qui n'existe pas encore.
- **D. Vercel (palier Hobby, gratuit) + Supabase (palier Free, déjà utilisé)** — retenu. Rien à construire, l'app est déjà écrite pour cette pile.

## Décision

Déploiement sur Vercel (compte personnel de l'utilisateur, palier Hobby gratuit) connecté au dépôt GitHub existant, avec le projet Supabase déjà en place. Usage strictement personnel/non-commercial (le MJ et son groupe de joueuses) — c'est précisément le cadre du palier gratuit des deux services.

Repères de capacité vérifiés avant décision (voir sources ci-dessous) :
- Vercel Hobby : 1 000 000 invocations de fonctions/mois, fonctions jusqu'à 5 min, 100 déploiements/jour — tient large pour un petit groupe.
- Supabase Free : 500 Mo de base de données, 1 Go de stockage fichiers, 50 000 utilisateurs actifs/mois — **mais le projet se met en pause après 1 semaine d'inactivité** (réactivation manuelle au dashboard).
- Chaque image (portrait ou bloc) passe déjà par `sharp` → redimensionnement + réencodage WebP qualité 82, quel que soit le format d'entrée (PNG/JPEG/WebP). Un portrait réel mesuré : 38 Ko. **Le format source (PNG conseillé, sans perte, une seule compression avec perte au bout) n'a donc aucun impact sur le poids final stocké.**
- Illustrer tout le compendium SRD 2024 (~800 entrées : 20 sorts, 316 créatures, 206 équipements, 262 objets magiques) à 3-4 images/fiche ≈ 400-650 Mo selon la taille moyenne réelle des illustrations — jugé largement tenable par l'utilisateur.

## Conséquences

- L'utilisateur va créer un compte Vercel et fournir les informations nécessaires pour connecter le dépôt et déployer.
- La cible « fonctionnement local » (`specs/cible-locale-et-ia.md`) n'est pas abandonnée, mais n'est plus la prochaine étape immédiate — ce document reste valable pour une bascule future, pas pour maintenant.
- **Le stockage des images doit migrer de `bytea` (base de données) vers le bucket Supabase Storage, avant de lancer l'illustration du compendium.** Décidé le 2026-08-27, pas encore construit. Raison : les images sont aujourd'hui dans des colonnes `bytea` Postgres (`entity_portraits`, `block_images`, `background_images`), qui comptent contre les **500 Mo de la base** — jamais contre le **1 Go de stockage fichiers**, qui resterait vide. Le calcul « 400-650 Mo, largement tenable » suppose le Go de stockage ; appliqué tel quel à la base actuelle, il la saturerait avant la fin du compendium. Chantier à prévoir : les trois tables, les routes qui les servent, et — point de vigilance — les images déjà en place doivent être migrées, pas seulement le code qui en écrit de nouvelles.
- **Pont entre l'IA locale (Ollama/LM Studio) et l'app hébergée : direction retenue, pas encore construite.** Un appel fait depuis une fonction serveur Vercel ne peut pas atteindre un Ollama sur le PC de l'utilisateur sans un tunnel exposé — les deux machines ne se voient pas nativement. Approche retenue : un tunnel inverse (Cloudflare Tunnel ou Tailscale Funnel, gratuits) donnant une adresse joignable à l'Ollama local, secret partagé pour empêcher un tiers de l'appeler ; l'adaptateur `AiProvider` compatible OpenAI déjà écrit pour Ollama/LM Studio (`src/server/ai/provider.ts`, ADR implicite de `cible-locale-et-ia.md` §3) pointe simplement vers l'URL du tunnel au lieu de `localhost` — aucun nouveau code d'adaptateur, juste sa configuration. L'utilisateur allume le tunnel + Ollama quand il veut utiliser l'IA ; `capabilities().isLocal`/une verification de joignabilité permet de désactiver proprement les fonctions IA le reste du temps, plutôt que d'échouer à l'usage (même principe que §4 de `cible-locale-et-ia.md`). Alternative envisagée et écartée pour l'instant : une file d'attente en base interrogée par un petit programme local (aucun port exposé, mais plus de code à construire) — à reconsidérer si l'exposition du tunnel pose un problème à l'usage.

## Questions ouvertes

1. **Pause hebdomadaire Supabase.** À surveiller à l'usage — si le groupe se connecte irrégulièrement, prévoir de réactiver le projet au dashboard avant une séance plutôt que de découvrir la panne en jeu.

## Sources consultées

- [Vercel — Hobby Plan](https://vercel.com/docs/plans/hobby)
- [Supabase — Pricing](https://supabase.com/pricing)
