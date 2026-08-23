# Backlog V2 — Le monde vivant

**Version :** 1.0 — 2 septembre 2026
**Établi sur :** l'état documenté de la V1. Le dépôt étant privé, les écarts éventuels sont à signaler.
**Documents liés :** `psyche-pnj.md` · `wiki-blocs.md` · `outils-mj.md` · `cible-locale-et-ia.md` · `module-joueur-et-solo.md`

---

## 0. Comment me montrer l'état du projet

Le dépôt est privé, je ne peux plus le lire. Le plus léger :

```bash
git log --oneline -20
```

Vos messages de commit sont assez descriptifs pour que ça suffise dans la plupart des cas. Pour une revue de code, téléversez les fichiers concernés.

---

## 1. Point de contrôle — vérifié sur le dépôt au commit `5f74b9a`

Inspection faite le 2 septembre. Cinq points sur six sont acquis.

| Point | État |
|---|---|
| Pureté de `src/core` | **acquis** — zéro import interdit, règle ESLint effective |
| Confinement du client `service_role` | **acquis** — un seul importateur, règle ESLint, test de fuite |
| Six cas dorés de `characterSheet()` | **acquis** — présents, plus deux cas d'encombrement |
| `AiProvider` + adaptateur local | **acquis** — `openAiCompatible.ts`, prêt pour Ollama et LM Studio |
| `ai_usage_log` à chaque appel | **acquis** — écrit même quand l'appel échoue |
| **Thème dérivé de l'image** | **incomplet** — voir V2-G4 |

### Restent à confirmer par vous (invisibles depuis le dépôt)

- [ ] **Couverture de traduction** par type d'entrée. Les scripts existent ; seul l'état de la base le dira.
- [ ] `npm run test:coverage` sur `src/core/rules` et `src/core/visibility` : au-dessus de 90 % ?
- [ ] La migration `restore_entity_blocks` suivant immédiatement `entity_blocks_full` : incident réglé ou correctif partiel ?

## 2. Principe de séquencement

> **Lever l'incertitude la plus grande d'abord, enrichir ensuite.**

La V1 suivait « le moteur avant l'écran ». La V2 a une contrainte différente : **une grande inconnue pèse sur la V3**, et elle est bon marché à lever maintenant que le moteur et le fournisseur d'IA existent.

D'où l'ordre :

```
S1        spike de viabilité du solo        2 à 4 jours, avant tout
Lot G     finitions et dette de V1
Lot H     le monde vivant                   psyché, généalogie, chronologie, quêtes
Lot I     les cartes
Lot J     génération assistée et confort
```

**H, I et J sont indépendants entre eux.** Vous pouvez les réordonner selon l'envie — c'est même recommandé, la motivation compte (risque R9). S1 et G, eux, viennent d'abord.

---

## S1 — Spike : le mode solo est-il viable sur votre machine ? · `M` — fait

**Ce n'est pas un ticket de fonctionnalité. C'est une expérience, avec un verdict.**

### Pourquoi maintenant

Votre essai avec SillyTavern a été décevant. Mais il testait l'approche que votre architecture remplace : tout empiler dans le prompt et laisser le modèle se souvenir, arbitrer, calculer et écrire simultanément.

Chez vous, le moteur calcule et le modèle reçoit *« boule de feu, trois gobelins touchés, 24 dégâts, deux morts, un baril d'huile dans la zone »* — environ 140 tokens, une seule tâche : raconter.

**Cette thèse n'a jamais été testée.** Elle détermine la forme de toute la V3. Elle coûte quelques jours à vérifier maintenant, contre plusieurs semaines à découvrir trop tard.

### Périmètre — délibérément minuscule

Pas d'interface à trois colonnes. Un écran jetable suffit.

- **Un** lieu préparé, avec sa description.
- **Trois** PNJ avec blocs `personality` et une relation chacun envers le groupe.
- **Un** combat préparé via le générateur de rencontres du lot E.
- Contexte assemblé de façon déterministe : lieu, PNJ présents, personnage du joueur, cinq derniers événements.
- `resolveAction` pour toute mécanique. Le modèle ne calcule rien, ne lance rien.
- Sorties structurées pour les propositions, validées par Zod.

### Ce qu'on mesure — vingt tours minimum

| Mesure | Seuil acceptable |
|---|---|
| Latence par tour | < 15 s, sinon injouable |
| Tokens d'entrée par tour | < 3 000 avec le contexte déterministe |
| Appels d'outils malformés | < 10 % des tours |
| Identifiants inventés | **0** — la validation doit tous les rejeter |
| Cohérence des PNJ sur 20 tours | jugement subjectif, noté honnêtement |
| Qualité de la prose | jugement subjectif, noté honnêtement |

Les deux dernières lignes sont subjectives et c'est assumé. **Notez-les au fil de l'eau, pas à la fin** — le souvenir global est toujours plus indulgent que l'expérience réelle.

### Le verdict, et ses trois issues

C'est le cœur du spike : **aucune issue n'est un échec du projet.**

| Constat | Décision |
|---|---|
| Mécanique solide, prose acceptable | La V3 se construit comme prévu |
| Mécanique solide, **prose faible** | → **repli sur le MJ assisté**, voir ci-dessous |
| Mécanique instable (outils, identifiants) | Changer de modèle avant de conclure ; c'est un symptôme de modèle, pas d'architecture |

### Le repli qui n'en est pas un : le MJ assisté

Si la narration autonome déçoit à la taille de modèle dont vous disposez, la V3 change de forme sans perdre sa valeur.

**MJ IA :** le modèle mène, vous jouez. Exige une bonne prose en continu.
**MJ assisté :** vous menez, le modèle propose. Il suggère une réaction de PNJ, une complication, une description que vous acceptez, modifiez ou ignorez.

Le second demande beaucoup moins au modèle : des propositions courtes, ponctuelles, que vous filtrez. Un modèle de 14 milliards de paramètres y est très correct là où il peine à porter une narration continue.

Et c'est **la même infrastructure** : contexte déterministe, propositions validées, outils du moteur. Seule l'interface change — des suggestions plutôt qu'un flux.

**Cette option devrait probablement exister de toute façon**, y compris si le solo fonctionne : c'est ce qui sert un MJ humain en séance, et c'est cohérent avec le principe 3.1 du PDD — l'IA assiste, elle ne confisque pas le contrôle.

### Critères

- [x] Vingt tours joués, mesures relevées au fil de l'eau.
- [x] Zéro identifiant inventé accepté par la validation.
- [x] Verdict écrit dans un ADR : `docs/adr/0009-viabilite-solo.md`.
- [ ] Si repli : la V3 est réécrite en conséquence **avant** d'ouvrir le lot G — **prochaine étape, pas encore faite** : le verdict recommande le repli (MJ assisté), mais aucune V3 formelle n'existe encore à réécrire (seulement le tableau §4 ci-dessous). À faire avant le lot G.

**Verdict (ADR 0009, 22 août 2026) : repli sur le MJ assisté.** Mesures objectives dans le budget (latence ~10 s, tokens ~1400, 0 identifiant inventé, 5 % d'appels malformés une fois l'incident d'infrastructure retiré) — c'est la cohérence narrative dans la durée qui déçoit à cette taille de modèle (répétitions verbatim, dérive de personnage, PNJ omniprésent hors de sa scène). Point ouvert : le lien fait-mécanique → narration n'a en réalité jamais été observé de bout en bout (panne réseau sur l'unique tentative) — à reboucler avant conclusion définitive. Détail complet et enseignements de conception (suivi de scène, contexte de personnage vivant, voix des PNJ incidents) dans l'ADR.

---

## Lot G — Finitions et dette de V1

*Tout ce qui a été reporté « à plus tard » pendant la V1. Une session, deux au plus.*

### V2-G1 — Reports assumés de la V1 · `M`

- [ ] **Montée de niveau accompagnée.** Le bouton « +XP » devient « Monter de niveau » au seuil, et rejoue la partie utile du parcours de création (`wiki-liens-et-personnages.md` §B8).
- [ ] **Application des dégâts à une cible** depuis l'écran de combat — la V1 ne permettait que de les subir manuellement.
- [ ] **Réorganisation par glisser-déposer** des blocs. Le `display_order` en `numeric` est prêt depuis la Phase 0.
- [ ] **Panneaux multiples** : deux fiches côte à côte, via `?avec=[slug]`. Le composant `<Panel>` a été isolé pour ça.
- [ ] **Export et import de monde** en JSON. L'export omet le contenu `personal_reference` (`ruleset-personnel.md` §3.2).

**Périmètre étendu sur demande explicite** : l'assistant de création de personnage (§B8) devient un outil partagé par trois points d'entrée, dans cet ordre — 1) outil complet dans l'écran MJ (`/mj/creation-personnage`), 2) bloc distinct sur une entité (édition actuelle de `PlayableCharacterSheet` conservée telle quelle), 3) onglet de montée de niveau sur la fiche jouable, activé au franchissement d'un seuil de PX. Le point 1 est fait : sept étapes (espèce, classe niveau 1, caractéristiques — tableau standard/achat de points/tirage —, historique, équipement, choix restants en liste, aperçu), même moteur de résolution que la fiche jouable (`useCharacterSheetContext`), crée une vraie entité + bloc `character` (+ `inventory` si équipé). Points 2 et 3 restent à faire ; le pré-remplissage par IA (§B8 « en surcouche ») est délibérément reporté au lot J.

### V2-G4 — Thème dérivé de l'image · `M` · *issu de la revue de code*

Le socle est là — `tokens.css` en OKLCH, `data-mode` sur `<html>`, les quatre modes. **Il manque toute la chaîne d'extraction.**

- [ ] Téléversement d'une image de fond par monde.
- [ ] Extraction de palette **côté serveur, au téléversement** — jamais dans le navigateur au chargement.
- [ ] Vignette 32×32 floutée en base64, stockée dans `worlds.theme` ; l'image pleine résolution n'est jamais chargée en fond.
- [ ] Contrôle de contraste sur les quatre modes ; un mode qui échoue n'est pas proposé, et on le dit.
- [ ] Variables injectées dans le HTML rendu côté serveur — aucun scintillement au premier rendu.

Spécification : `coquille-et-design.md` §2b.

### V2-G5 — Découper `PlayableCharacterSheet.tsx` · `M` · *issu de la revue de code*

1255 lignes pour six fonctions de premier niveau. C'est la principale dette du dépôt, et **V2-G1 va y toucher** (montée de niveau, application des dégâts).

- [x] Un composant par onglet : `ActionsTab`, `MagicTab`, `InventoryTab`, `TraitsTab`.
- [x] L'en-tête (identité, PV, XP, repos) extrait à part.
- [x] Aucun changement de comportement : découpage pur, vérifié par les tests existants.

**À faire avant G1, pas pendant.** Découper et modifier dans le même commit rend la relecture impossible.

Fait. `PlayableCharacterSheet.tsx` reste l'orchestrateur (état, appels serveur) ; les quatre onglets et l'en-tête sont des composants purs recevant des props déjà prêtes à afficher. Aucun test automatisé ne couvrait ce composant avant (aucun fichier `*.test.tsx` ne le référence) — vérification manuelle en navigateur sur les trois onglets (actions, inventaire, traits), `typecheck`/`lint`/`test` verts (seul échec : le flake connu de l'intégration LM Studio, pré-existant, sans rapport).

### V2-G6 — `characterSheet()` côté client · `S` · *issu de la revue de code*

`characterSheet()` n'est appelée que côté serveur. La fonction étant pure et sans dépendance, elle peut tourner dans le navigateur — c'était l'intérêt de la contrainte `src/core`.

- [ ] Décocher « équipé » recalcule la CA **sans aller-retour serveur**.
- [ ] Le serveur reste l'autorité pour tout ce qui engage la partie ; le client ne recalcule que l'affichage.
- [ ] Même fonction des deux côtés — aucune divergence possible.

À faire seulement si la latence actuelle gêne réellement. Mesurez avant.

### V2-G2 — Wiki public en présentation « livre » · `M`

Seconde peau de la coquille, pas une refonte. Mêmes composants, jetons différents.

- [ ] Colonne de gauche en sommaire hiérarchique plutôt qu'en arborescence d'édition.
- [ ] Corps de texte à largeur mesurée, **65 à 75 caractères par ligne**.
- [ ] Aucune commande d'édition visible.
- [ ] Le thème dérivé de l'image s'applique aussi à cette peau.

À faire quand le wiki public a du contenu à montrer. Habiller trois fiches de test n'apprend rien.

### V2-G3 — Bloc musique · `S`

- [ ] Bloc `music` : un lien Spotify, SoundCloud ou YouTube, avec lecteur.
- [ ] **Le lecteur ne se charge qu'au clic.** Une intégration tierce chargée automatiquement dépose des traceurs sur toute fiche qui en contient une.
- [ ] URL validée contre une liste de domaines autorisés — sinon c'est un vecteur d'injection.

---

## Lot H — Le monde vivant

*Ce qui donne de la mémoire et de la profondeur au monde. Le lot le plus utile pour la V3.*

### V2-H1 — Psyché des PNJ · `L`

Spécification complète : `specs/psyche-pnj.md`.

- Blocs `personality`, `worldview`, `relationship` (un par relation).
- Table `entity_attitudes` (valeurs courantes, portée campagne) et `attitude_events` (ajout seul).
- `applyDelta` dans `src/core/psyche/` — fonction pure.

**Critères**
- [ ] Valeurs stockées de −100 à +100 ; l'écran et le contexte IA affichent la **bande nommée**, jamais le nombre.
- [ ] Rendements décroissants : s'éloigner du centre s'amortit, y revenir garde son plein effet.
- [ ] `deltas` stocke le **brut** ; rejouer le journal reproduit exactement la valeur courante.
- [ ] Après 50 événements simulés d'ampleur « notable », aucun axe n'est saturé.
- [ ] Un delta brut supérieur à 40 exige confirmation.
- [ ] `known_as` respecté : le contexte IA ne révèle pas une identité que le PNJ ignore.
- [ ] Comparaison automatique entre les convictions d'un PNJ et celles de sa faction, avec signalement des divergences fortes.

### V2-H2 — Chronologie et calendrier · `L`

`wiki-blocs.md` §3.

- Calendrier par monde, en JSON dans `worlds.calendar`.
- Bloc `timeline` : entrées en ligne **et** entités de type `event`.
- `sort_key` entier calculé, stocké à côté de chaque date.

**Critères**
- [ ] Le tri et le filtrage fonctionnent avec un calendrier à treize mois de vingt-huit jours.
- [ ] `precision` gère l'imprécision : « vers 1200 » est une date valide.
- [ ] `end` permet les périodes ; une guerre dure.
- [ ] `label` prime à l'affichage : « le Troisième Hiver Noir » plutôt qu'une date.
- [ ] Une entrée en ligne se promeut en entité d'un clic, sans rien perdre.

### V2-H3 — Généalogie et relations · `M`

- Bloc `relationships` (liste simple) **avant** `genealogy` (arbre visuel).
- `genealogy` ne stocke que la configuration d'affichage ; les liens vivent dans `relations`.

**Critères**
- [ ] Ajouter un parent se fait en créant une relation ; tous les arbres qui incluent la personne se mettent à jour.
- [ ] **Le graphe est construit côté serveur, après filtrage.** Une parenté en visibilité `gm` n'est pas dans la réponse HTTP.
- [ ] Un nœud dont la relation est cachée **disparaît**, il ne s'affiche pas grisé.
- [ ] Cycles sur `part_of` et sur `parent_of` refusés par déclencheur.

> Construisez `relationships` d'abord et servez-vous-en une semaine. Vous découvrirez peut-être que l'arbre visuel n'est pas nécessaire.

### V2-H4 — Quêtes et journal de séance · `M`

- Bloc `quest` : objectifs, état, récompenses, commanditaire, prérequis.
- Bloc `session_log` relié aux `session_events`.

**Critères**
- [ ] États : non commencée, en cours, réussie, échouée, abandonnée.
- [ ] Un objectif référence des entités ; les cocher est journalisé.
- [ ] Les quêtes actives entrent dans le contexte déterministe de la V3.

---

## Lot I — Les cartes

*Le plus gros morceau visuel de la V2, et le moins spécifié jusqu'ici.*

### Décisions de conception, à prendre avant d'écrire

**Image d'abord, procédural jamais — ou beaucoup plus tard.** Le PDD évoque la génération procédurale (simplex-noise, Voronoï). C'est un projet en soi, et une carte téléversée couvre 95 % du besoin réel : la plupart des MJ ont déjà leur carte. Le procédural reste une idée future, pas un ticket.

**Coordonnées normalisées, jamais des pixels.** Une punaise se stocke en 0–1 relatif à l'image. Des pixels casseraient à chaque redimensionnement, zoom ou remplacement d'image.

**Une punaise est une référence**, réutilisant la primitive `Reference` : elle pointe vers une entité, et hérite de sa visibilité.

**Cartes imbriquées via `part_of`.** Une punaise « Porte de Baldur » sur la carte du continent ouvre la carte de la ville. Aucun nouveau concept : c'est la hiérarchie des lieux, rendue visuellement.

**Le brouillard est une découverte, pas un calque de dessin.** Des régions nommées, révélées ou non par campagne — même modèle que `entity_discoveries`. Un brouillard dessiné à la main serait un second système à maintenir.

### V2-I1 — Carte et punaises · `L`

```sql
create table map_regions (
  id         uuid primary key default gen_random_uuid(),
  entity_id  uuid not null references entities(id) on delete cascade,  -- le lieu portant la carte
  name       text not null,
  shape      jsonb not null,   -- polygone en coordonnées normalisées
  created_at timestamptz not null default now()
);

create table map_region_reveals (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  region_id   uuid not null references map_regions(id) on delete cascade,
  revealed_at timestamptz not null default now(),
  primary key (campaign_id, region_id)
);
```

- Bloc `map` sur une entité `location` : un asset image, une liste de punaises.
- Zoom et déplacement, sans dépendance lourde.

**Critères**
- [ ] Les punaises sont en coordonnées normalisées ; remplacer l'image par une version plus grande ne les décale pas.
- [ ] Une punaise vers une entité `gm` est absente de la réponse pour un joueur.
- [ ] Une punaise vers un lieu portant lui-même une carte ouvre cette carte.
- [ ] Une carte de 4000 px s'affiche sans bloquer l'interface — vignette d'abord, pleine résolution ensuite.

### V2-I2 — Brouillard par campagne · `M`

- [ ] Le MJ trace des régions ; il les révèle en cours de partie.
- [ ] Une région non révélée est **absente de la réponse serveur**, pas masquée en CSS.
- [ ] Révéler écrit un `session_event`.

---

## Lot J — Génération assistée et confort

*Nécessite le lot F de la V1. Le contenu de ce lot dépend du verdict de S1.*

### V2-J1 — Les emplacements en prose des générateurs · `M`

Le lot E de la V1 a écrit les générateurs avec leurs emplacements de prose **laissés vides**. Ce ticket les remplit.

- [ ] Description de taverne, d'échoppe, de PNJ — les longueurs demandées dans vos notes.
- [ ] La prose est **cohérente avec les valeurs déjà tirées**, jamais contradictoire.
- [ ] Sans fournisseur d'IA actif, le générateur fonctionne toujours : les emplacements de prose restent vides, le reste est complet.
- [ ] Les noms à jeu de mots viennent de **tables écrites à la main**, jamais d'une génération libre.

### V2-J2 — Création d'une fiche par générateur · `M`

- [ ] Le bouton « nouvelle entité » propose : fiche vierge, modèle, ou générateur.
- [ ] Le résultat crée une entité avec ses blocs pré-remplis, secrets en visibilité `gm`, références déjà liées.
- [ ] **Un seul mécanisme de promotion**, partagé avec la chronologie, l'inventaire et les tables (V1-E6).

### V2-J3 — Assistant de préparation de séance · `M`

- [ ] Une entité de type `session_prep` avec des blocs. **Pas un second système de documents.**
- [ ] Boutons d'insertion de générateur dans l'éditeur.
- [ ] Feuille de style d'impression.

### V2-J4 — Import de règles au format JSON · `M`

`arbitrage-modifications.md` §1.2.

- [ ] Import à notre format documenté, miroir exact de l'export.
- [ ] Assistant de correspondance pour un format tiers — l'utilisateur associe les champs, on n'écrit pas trente convertisseurs.
- [ ] Un ruleset importé est marqué `personal_reference` par défaut, avec ses verrous.
- [ ] **Aucune analyse automatique de PDF.** Position inchangée.

---

## 3. Critère de fin de V2

> Mener une séance complète avec votre table — préparation, PNJ cohérents, carte, combat, notes — sans ouvrir aucun autre outil.

À vérifier en jouant réellement, pas en cochant des cases.

Et un critère technique : **le verdict de S1 est écrit et la V3 est cadrée en conséquence.**

---

## 4. Ce qui reste pour la V3

| Contenu | Note |
|---|---|
| Compagnon joueur | `module-joueur-et-solo.md` partie A — la vraie nouveauté est le modèle de permissions |
| Mode solo ou MJ assisté | forme déterminée par S1 |
| RAG sur le wiki | `SCHEMA.md` §17 — la dimension d'embedding doit être figée avant la première indexation |
| Édition élargie par les joueurs | `canEditEntity` est déjà le point d'extension |
| Passage à l'application locale | `cible-locale-et-ia.md` §6 — la question « local seul ou local d'abord » reste ouverte |
| Génération procédurale de cartes | idée future, jamais un ticket tant que le reste n'est pas solide |

---

## 5. Rappel de méthode

**Un ticket, un commit, une relecture.** Après un an de projet, c'est la discipline la plus facile à relâcher et la plus coûteuse à perdre.

**Ne parallélisez pas H, I et J** — non pour des dépendances techniques, il n'y en a pas, mais parce que trois chantiers ouverts finissent tous à 80 %.

**Et si l'envie manque un jour, prenez le lot qui vous fait plaisir plutôt que le suivant dans la liste.** Le risque R9 — perte de motivation — reste le premier risque de ce projet, devant tous les risques techniques.
