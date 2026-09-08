# ROADMAP — Où en est le projet

Tableau de bord transversal : « qu'est-ce qui existe déjà ? », par module, sans
rouvrir tous les tickets. Il ne remplace ni `docs/PDD.md` (la vision), ni
`docs/SCHEMA.md` (le schéma), ni les backlogs (le détail ticket par ticket).

**État vérifié le 2026-09-08** contre le dépôt : routes, services, migrations,
cases cochées des backlogs. Ce qui n'a pas pu être vérifié sans base de données
ni écran est dit tel quel, jamais coché par optimisme.

**Le détail fait foi ailleurs.** Sur l'état d'un ticket précis, ce sont
`docs/BACKLOG_V2.md` et `docs/BACKLOG_V3.md` qui ont raison ; ce document-ci n'a
raison que sur la vue d'ensemble. C'est la seule répartition tenable : un
tableau de bord qui recopie les tickets devient faux au premier commit, et
l'audit du 6 septembre a constaté exactement cette dérive sur la version
précédente de ce fichier.

**À maintenir** quand un module change d'état — pas à chaque ticket.

| Source | Ce qu'on y trouve |
|---|---|
| `docs/BACKLOG.md` | Phase 0 et V0 — terminé, valeur historique |
| `docs/BACKLOG_V1.md` | V1, le compagnon jouable — ses reports assumés sont repris dans V2-G1 |
| `docs/BACKLOG_V2.md` | V2 — l'essentiel de ce qui existe aujourd'hui |
| `docs/BACKLOG_V3.md` | V3, le mode solo — 28 tickets, aucun commencé |
| `docs/audit/2026-09-06-*.md` | État de santé du code, backend et interface |

---

## Ce qui tourne

| Module | État | Détail |
|---|---|---|
| **Socle** | Next.js App Router + TypeScript strict, Supabase lié, 110 migrations, RLS sur les tables de monde et de campagne, tests Vitest (noyau pur + intégration) | `CLAUDE.md`, `docs/SCHEMA.md` |
| **Comptes et rôles** | Inscription, connexion, mot de passe oublié, superadmin, liens d'invitation nominatifs, « voir comme », journal MJ, `canEditEntity` + `entity_grants` | V2 lot M |
| **Wiki** | Entités, blocs typés, visibilité résolue côté serveur, glisser-déposer, texte enrichi Tiptap, alias, relations, portraits et images téléversés | V2 lots G, L |
| **Coquille** | Barre latérale unifiée, fenêtres partagées Monde/Règles, réduction en onglets, quatre thèmes, réglages à onglets, fond immersif | V2 lot K |
| **Monde vivant** | Psyché des PNJ, chronologie et calendrier, généalogie, quêtes et journal de séance | V2 lot H |
| **Cartes** | Bloc et type d'entité `map`, punaises, zones, couches, mode référent, brouillard par campagne | V2 lot I |
| **Outils MJ** | Générateurs (taverne, échoppe, butin, PNJ…), tables d100, rencontres, initiative, probabilités, lancer de dés, création de personnage, préparation de séance | V2 lots J, M |
| **Règles** | SRD 2014/2024 importés et partiellement traduits, compendium consultable, rulesets personnels, import JSON, armes/dons/historiques maison, bac à sable | V2 lot J, `specs/regles-couche.md` |
| **Joueur** | Coquille joueur allégée : accueil, wiki filtré, fiche jouable, règles, notes, discussion | V2 lot M |
| **Partage public** | Lien à jeton, alias court, présentation « livre », filtrage serveur (`publicShare.ts`, seul endroit à porter la clé service-role) | V2-G2, V2-M10 |
| **IA** | Couche `src/server/ai/` en place : `AiProvider`, adaptateurs, `ai_usage_log`, limitation de débit, `ai_proposals`, assistance à l'écriture, éditeur de règles, prose des générateurs | `specs/cible-locale-et-ia.md` |
| **Stockage de fichiers** | Bucket Supabase Storage créé par migration, interface `storage.ts`, URLs signées, redimensionnement `sharp`. Images de blocs, fonds et portraits migrés hors de la base | V2-L1, V2-I1 phases A et F₂ |

## Ce qui reste ouvert

| Sujet | Pourquoi ça n'avance pas |
|---|---|
| **Mode solo (V3)** | Cadré, 28 tickets écrits, aucun commencé. S1 a rendu son verdict : MJ assisté, pas MJ autonome (`docs/adr/0009-*`) |
| **Recherche globale** | La barre latérale filtre par nom sur la liste déjà chargée. Une vraie recherche plein texte demande `pg_trgm`/`unaccent` et une décision de portée |
| **Liens automatiques dans le texte** | `src/core/linker` détecte et normalise ; l'insertion automatique en cours de frappe reste non tranchée (faux positifs, question ouverte du PDD) |
| **Historique de fiche** | `src/core/history` (diff) et `entity_mechanical_revisions` existent ; l'écran de restauration n'est pas construit |
| **Graphe de connaissances** | `buildRelationsGraph` existe et sert la généalogie ; la vue graphe générale du monde n'est pas faite |
| **Éditeur de `narrative_content` par segments** | Distinct des blocs, jamais commencé — les segments sont spécifiés, pas implémentés |
| **Collaboration MJ (V2-M8)** | Le code est en place et les liens envoyés ; trois critères attendent qu'un ami rejoigne réellement. Ne pas cocher sur lecture de code |
| **Vignettes de carte** | `uploadAsset` sait redimensionner, mais la paire « vignette + plein format » n'est pas câblée (V2-I1, dernières cases) |
| **Cible locale** | `specs/cible-locale-et-ia.md` : « local seul » ou « local d'abord » n'est pas tranché |

## Dette technique

Elle n'est plus listée ici. L'audit du 6 septembre la tient, constat par
constat, avec son état de traitement :

- `docs/audit/2026-09-06-synthese.md` — vue d'ensemble et ordre de traitement
- `docs/audit/2026-09-06-backend.md` — B-01 à B-17, plus la section rapidité
- `docs/audit/2026-09-06-frontend-ux.md` — F-01 à F-20, plus les recommandations

Un fichier qui liste la dette à deux endroits en tient un des deux à jour. Les
rapports d'audit sont datés et se relisent ; ce tableau de bord, non.

## Plus tard, volontairement

Simulation procédurale du monde · immersion audiovisuelle · génération
procédurale de cartes · collaboration multi-MJ au-delà de V2-M8. Voir
`docs/PDD.md` §22. Aucune de ces lignes n'est un ticket, et aucune ne le
devient tant que la V3 n'est pas jouable.
