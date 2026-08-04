# Backlog V1 — Le compagnon jouable

**Version :** 1.0 — 30 juillet 2026
**Établi à partir de :** dépôt `Itus19/CreaDonjon`, commit `fe3736a` (V0-07)
**Documents liés :** `SCHEMA.md` · `specs/regles-couche.md` · `specs/regles-blocs.md` · `specs/wiki-liens-et-personnages.md` · `specs/wiki-blocs.md`

---

## 0. État constaté

La V0 est terminée. Ce qui existe et fonctionne :

| Brique | État |
|---|---|
| Authentification, mondes, entités, slugs, routage `/m/[monde]/f/[fiche]` | fait |
| Blocs `text`, `infobox`, `image`, `custom_table` avec schémas Zod | fait |
| Segments en nœuds typés, marques, références, caviardage | fait |
| Relations en bande d'en-tête | fait |
| Recherche, arborescence, coquille, jetons de design | fait |
| Partage anonyme en lecture seule | fait |
| Couches `src/core` → `services` → `repos` respectées | fait |

Les modifications d'apparence apportées à la main sont acquises : **le code fait foi désormais, pas `specs/coquille-et-design.md`**, qui redevient une référence d'intention. Ne pas laisser Claude Code « corriger » l'apparence pour se conformer au document.

---

## 1. Dette à solder avant d'ouvrir la V1

### D-01 — Le contournement de RLS de la page publique · `M` · **prioritaire**

`app/partage/[token]/**` résout le jeton par une fonction `security definer` bornée — c'est correct — puis lit les entités et les blocs avec `createShareLinkServiceClient()`, c'est-à-dire la clé `service_role`.

Cette clé contourne **toute** la RLS. La seule chose qui empêche une fuite est alors le filtrage applicatif de `getPublicEntityDetail`. Le code réutilise `filterBlocks` / `filterSegments`, ce qui est le bon choix — un seul endroit où une visibilité peut fuir. Mais cela inverse le principe posé au §4.2 de `SCHEMA.md` : *la RLS est le dernier filet, pas la seule défense.* Ici, il n'y a pas de filet.

Ce n'est pas à réécrire. C'est à **doter du filet manquant** :

- [x] Un test d'intégration qui crée un monde avec un bloc `public` et un bloc `gm`, génère un lien, appelle la route publique, et vérifie que la chaîne du bloc `gm` est **absente de la réponse HTTP brute** — pas de l'écran, de la réponse.
- [x] Le même test pour un segment `gm` à l'intérieur d'un bloc public.
- [x] Le client `service_role` est confiné à `src/server/services/publicShare.ts`. Une règle ESLint interdit son import ailleurs.
- [x] Un commentaire en tête de `service.ts` rappelant pourquoi cette exception existe et ce qu'elle exige.

**Fait** — en vérifiant, le test a trouvé un vrai bug (pas juste confirmé son absence) : `anon` n'avait jamais eu `usage on schema app`, le lien de partage ne fonctionnait jamais pour un vrai visiteur anonyme. Corrigé par migration.

Sans ce test, une modification future de `getPublicEntityDetail` peut ouvrir une fuite totale sans que rien n'échoue.

### D-02 — Deux mécanismes qui se ressemblent, un seul est de la sécurité · `S`

Le code possède maintenant :

| Mécanisme | Nature | Où il agit |
|---|---|---|
| marque `spoiler` sur un nœud | **mise en forme** — texte envoyé au client, masqué en CSS, révélé au clic | effet de style, comme sur Discord |
| `visibility_level` d'un bloc ou d'un segment | **sécurité** — jamais envoyé au client non autorisé | filtrage serveur |

Les deux se ressemblent à l'écran. La confusion est facile et coûteuse : quelqu'un — ou un agent de codage — peut un jour croire que `spoiler` protège un secret de MJ.

- [x] Le nommer explicitement dans `CLAUDE.md` : *`spoiler` est de la mise en forme, jamais de la sécurité. Un secret de MJ passe par `visibility_level`, jamais par une marque.*
- [x] Le rendre visible dans l'interface : les deux ne doivent pas se ressembler. Le caviardage MJ porte le liseré terracotta ; le spoiler est neutre.

**Fait** — confirmé que la distinction est garantie par les jetons de couleur eux-mêmes (`--gm` teinté terracotta, chroma ~0.11-0.13 ; caviardage en `--ink` neutre, chroma ~0.008), pas une coïncidence à surveiller.

### D-03 — Documents obsolètes à la racine · `S`

`Phase0_Schema_Technique_v0_1.md` et `Project_Design_Document_v0.1.md` sont encore à la racine, alors que `docs/` contient les versions à jour. Un agent de codage qui tombe sur la v0.1 lira un schéma dont la visibilité est une chaîne encodée et dont les segments portent `text` au lieu de `content`.

- [x] Supprimer les deux fichiers de la racine (l'historique Git les conserve).
- [x] Vérifier que `docs/` contient bien les versions courantes de tous les documents.
- [x] Réconcilier `ROADMAP.md` et `docs/BACKLOG.md` : un seul des deux fait autorité.
- [x] Remplacer le `README.md` de `create-next-app` : installation, commandes, où trouver quoi, `NOTICE.md` d'attribution SRD.

**Fait** — `ROADMAP.md` reste le tableau de bord transversal par module ; `docs/BACKLOG.md`/`docs/BACKLOG_V1.md` restent la source des tickets. Deux axes, pas deux autorités concurrentes.

### D-04 — Vérifier l'import SRD · `S`

`srd-2014.json` et `srd-2024.json` sont à la racine du dépôt. Avant d'attaquer le lot A :

- [x] L'import a-t-il été exécuté et les rulesets officiels existent-ils en base ?
- [x] `ruleset_entries.source_raw` existe-t-il et contient-il le JSON d'origine ? (recommandé au §1 de `specs/outils-mj.md` — sans lui, tout champ non encore transformé exigera un réimport)
- [x] `NOTICE.md` contient-il le texte d'attribution exact des deux SRD ?
- [x] Déplacer les deux JSON dans `data/srd/` — ils n'ont rien à faire à la racine.

**Fait** — import confirmé en base (SRD 5.1 : 1790 entrées, SRD 5.2.1 : 2195 entrées, `source_raw` peuplé sur les deux), `NOTICE.md` déjà correct.

---

## 2. Principe de séquencement de la V1

> **Le moteur avant l'écran, la verticale avant la largeur.**

Trois erreurs à éviter, dans l'ordre de probabilité :

1. **Construire l'interface de règles avant le moteur de résolution.** On obtient alors un affichage qui court après une logique instable.
2. **Faire les douze types de blocs de règles d'un coup.** Cinq suffisent pour un sort et une classe. Le reste attendra un besoin réel.
3. **Ouvrir les campagnes à des joueurs tiers avant la RLS fine.** `SCHEMA.md` §19.2 le dit : le filtrage MJ/joueur repose sur la couche service jusqu'au lot C. Tant qu'il n'est pas descendu en RLS, l'usage reste personnel.

Quatre lots, dans cet ordre. **Chacun se termine par quelque chose de montrable.**

---

## Lot A — Consulter les règles

*Objectif : ouvrir une fiche de sort et une fiche de classe, propres, reliées entre elles, et les personnaliser.*

### V1-A1 — Blocs de règles et rendu · `L`

Cinq types de blocs, pas douze. Spécification : `specs/regles-blocs.md`.

- Table `ruleset_entry_blocks` (migration).
- Schémas Zod : `description`, `spell_casting`, `effects`, `scaling`, `class_progression`, `custom_table`.
- Les dix primitives du §3 dans `src/core/schemas/primitives.ts` — `Quantity`, `Formula`, `Reference`, `Duration`, `Range`, `Area`, `Choice`, `Modifier`, `Grant`, `Localized`.
- Composants de mise en page : `key_values`, `progression_table`, `formula_list`, `prose`, `chips`, `table`. **Un par mise en page, jamais un par type de bloc.**
- Routage `/m/[monde]/regles/[cle]`.

**Critères**
- [x] Une fiche de sort affiche paramètres, effets et montée en puissance.
- [x] Une fiche de classe affiche sa table de progression, colonnes déclarées et lignes en données.
- [x] La colonne « bonus de maîtrise » est **calculée par formule**, pas saisie vingt fois.
- [x] Le bloc `scaling` engendre la table complète des niveaux d'emplacement à partir de sa règle — le moteur consomme la règle, l'affichage consomme la table engendrée.
- [x] Un `entry_type` auquel il manque un bloc requis est signalé sur la fiche, pas rejeté.

**Fait** — vérifié dans le navigateur sur des entrées réelles (Fireball, Barbarian, Magma Mephit). La voie « colonne calculée par formule » et « scaling engendré par règle » sont testées unitairement mais pas encore exercées par une vraie donnée SRD (l'import fournit toujours des tables déjà énumérées) — le mécanisme existe et fonctionne, sans avoir encore de cas réel qui l'exige.

### V1-A2 — Conversion de l'import SRD vers les blocs · `L`

Le script d'import produit désormais des blocs, plus un objet plat.

- [x] Import idempotent : rejouer donne le même état.
- [x] Les sorts produisent `description`, `spell_casting`, `effects`, et `scaling` quand il y a montée en puissance.
- [x] Les classes produisent `class_progression`.
- [x] Un rapport de conversion en fin de script : combien d'entrées par type, combien de blocs, combien d'échecs — et **les échecs sont listés**, pas avalés.
- [x] Aucun contenu hors SRD.

**Fait** — trois lacunes trouvées en relisant le script, corrigées ensemble :

- Aucune entrée ne faisait planter tout l'import avant (0 échec constaté), mais rien ne l'aurait empêché : chaque entrée est maintenant transformée dans son propre `try/catch`, les échecs sont collectés et listés en fin de script plutôt que de remonter une exception non rattrapée.
- `effects[].formula` n'était jamais rempli (seul le type de dégâts l'était) ; les tours de magie qui montent en puissance par niveau de personnage (`damage_at_character_level`, ex. Trait de feu) n'étaient pas lus du tout — seul `damage_at_slot_level` l'était. Les deux sont corrigés et vérifiés dans le navigateur (Boule de feu : `8d6(Fire)` + table de montée en puissance ; Trait de feu : `1d10(Fire)` + palier par niveau de personnage 1/5/11/17).
- Déduplication des aptitudes génériques confirmée sur le cas signalé : "Ability Score Improvement" comptait 63 lignes strictement identiques (2014 seul), une par classe/niveau — regroupement par (nom, texte) strictement identiques, jamais par nom seul, pour ne fusionner que les vrais doublons. Résultat vérifié : 63 → 3 fiches partagées (Guerrier et Roublard ont un texte légèrement différent — ASI bonus à des niveaux supplémentaires — donc restent distincts, à raison). "Divine Domain feature" (contenu réel et distinct par classe) n'est pas touché par la fusion, comme attendu. Nouvelle fonction Postgres `app.import_prune_stale_entries` (migration `20260802100001`) : l'ancien script ne faisait qu'upserter, jamais nettoyer — sans elle, les 223 anciennes fiches par classe seraient restées mortes en base. Traductions ré-attachées aux nouvelles fiches canoniques (`npm run translate:entries feature ...`) ; aucune perte constatée au-delà des candidats jamais vérifiés contre le texte officiel (couverts par V1-A5).
- Idempotence vérifiée en rejouant l'import deux fois de suite : mêmes comptes exacts, zéro nouvelle suppression au second passage.

### V1-A3 — Graphe de renvois · `M`

- Table `ruleset_entry_refs`, extracteur pur dans `src/core/rules/refs.ts`.

**Critères**
- [x] Les renvois `derived` sont recalculés à chaque écriture ; les `declared` ne sont jamais touchés.
- [x] Une fiche affiche ses renvois sortants **et** entrants.
- [x] Un renvoi surligne le chemin exact dans la structure quand on le suit.
- [x] `target_key` résout vers la version surchargée du ruleset courant, pas vers l'entrée d'origine.

**Fait** — la table et ses politiques RLS existaient déjà depuis la migration initiale (004), seul l'extracteur et le branchement manquaient.

- Extracteur pur `src/core/rules/refs.ts` (tests écrits d'abord) : un seul cas produit un renvoi fiable aujourd'hui — une colonne `grants` de `class_progression` qui accorde une `feature`, seul endroit où un champ structuré (pas du JSON brut d'import) porte déjà une clé d'entrée stable. `part_of` (sous-classe → classe), `damage_type`, etc. attendront un bloc qui les porte réellement — même discipline que les blocs eux-mêmes, pas de renvoi vers une catégorie sans fiche à elle (`Damage-Types`, `Magic-Schools`...).
- `app.import_srd_entries` (migration `20260802110001`) recalcule les renvois `derived` d'une entrée en même temps que ses blocs (supprime puis réinsère, jamais les `declared`) ; `target_entry_id` est résolu dans le même ruleset que la source — la seule résolution valide tant que la surcharge (V1-A4) n'existe pas.
- Repo/service : `listOutgoingRefs`/`listIncomingRefsForKey`, résolution par lot (jamais une requête par renvoi), traduction incluse.
- UI : panneau « Renvois sortants/entrants » sur chaque fiche ; suivre un renvoi entrant navigue vers la fiche source et surligne l'élément exact (`data-ref-path` + `?path=`, `RefPathHighlighter`). Bénéfice inattendu : les cellules `grants` de `class_progression` affichent désormais le nom traduit et lient vers la fiche de l'aptitude, au lieu de la clé brute — même donnée que le panneau de renvois, pas de deuxième résolution.
- Vérifié dans le navigateur : Barbare affiche 25 renvois sortants (Rage, Reckless Attack...) ; suivre "Barbare" depuis les renvois entrants de Rage surligne exactement la cellule niveau 1. Import rejoué deux fois : 317 puis 317 renvois (5.1), 336 puis 336 (5.2.1) — stable.

### V1-A4 — Surcharge et variantes · `L`

- Table `ruleset_overrides`, résolution pure dans `src/core/rules/resolve.ts`.

**Critères**
- [x] « Chez moi la boule de feu fait 6d6 » est un `patch_block` sur `effects` ; le reste de la fiche suit toujours sa base.
- [x] Chaîne d'héritage : profondeur maximale 8, cycles détectés, erreur explicite.
- [x] Un ruleset publié est figé : toute édition crée `version + 1` avec le même `lineage_id`.
- [x] Un badge « modifiée dans ta variante » ouvre la comparaison avec l'original.
- [x] Les rulesets officiels restent inviolables (le trigger le prouve par un test).

**Fait** — portée volontairement limitée au moteur + verrou de version (décision explicite : pas de formulaire brut de création de surcharge, ce sera l'éditeur assisté par IA de V1-D2, pas une saisie JSON jetable).

- `src/core/rules/resolve.ts` (tests d'abord, 15 cas) : merge patch RFC 7386 fait main (pas de dépendance, l'algorithme tient en une dizaine de lignes), application des sept actions de surcharge dans l'ordre donné.
- Deux fonctions Postgres, même idiome que `app.delete_own_account` (security definer + `auth.uid()`, jamais de client service-role côté app) : `upsert_ruleset_override` refuse une surcharge directe sur un ruleset officiel et refuse l'édition par quiconque n'est pas le créateur ; éditer un ruleset publié crée `version + 1` (même `lineage_id`) et copie les surcharges existantes avant d'appliquer la nouvelle. `publish_ruleset` fige, idempotent.
- Remontée de chaîne avec détection de cycle réelle (`Set` de rulesets visités, pas seulement la borne de profondeur) — `src/server/services/rules.ts`. Une fiche de monde variante résout maintenant ses surcharges avant validation Zod des blocs.
- Badge + comparaison : réutilisent le même `renderBlockData` que l'affichage normal (`components/rules/blockContentRenderer.tsx`), jamais un second mapping bloc → mise en page.
- **Test d'intégration réel** (`src/server/repos/rulesetVersioning.integration.test.ts`, même pattern que D-01) : le trigger `forbid_official_ruleset_write` — jamais testé avant ce ticket — empêche bien de modifier un ruleset officiel, y compris avec `service_role` ; `upsert_ruleset_override` refuse l'écriture directe sur l'officiel et refuse un tiers non créateur ; publier puis éditer crée bien `version + 1`, copie les surcharges, et n'affecte pas l'ancienne version. Vérifié aussi dans le navigateur avec la variante déjà semée (`seed-dev.ts`) : la description de Boule de feu affiche le texte de la variante, le badge apparaît, la comparaison montre les deux textes côte à côte.

### V1-A5 — Finalisation de la traduction française · `M`

Ajoutée en cours de route (V1-A1b) : traduction officielle des noms d'entrées du SRD vers le français, source `official_srd` (nom proposé, vérifié mot pour mot dans le texte extrait des PDF officiels CC-BY-4.0 avant écriture — jamais une correspondance non confirmée). État à l'ouverture de ce ticket : Classe/Espèce/Historique/Condition 100 %, Monstre ~84 %, Sort ~55 %, Sous-classe/Arme/Armure/Règle faites, Aptitude et Objet très partiels (catégories les plus volumineuses et répétitives).

Positionnée ici, après le lot A entier plutôt qu'après A2 seul : V1-A2 change la structure des aptitudes (déduplication), V1-A3 ajoute des renvois, V1-A4 ajoute des surcharges — traduire avant que cette structure se stabilise aurait signifié refaire une partie du travail à chaque lot.

- [ ] Compléter Sort et Monstre à ~100 % (Sort à 99,5 %, Monstre à 88 % — très proche, reste des cas structurellement non vérifiables, voir plus bas).
- [ ] Traduire Objet et Aptitude en tenant compte de la nouvelle structure post-V1-A2 (Objet 30 % → **67 %**, Aptitude 28 % → **65,3 %** — catégories les plus volumineuses, 1169 et 961 entrées, en net progrès mais pas finies).
- [x] Aucune traduction sans vérification mot pour mot contre `data/srd/fr-source/*.txt` — un terme non trouvé reste en anglais plutôt que d'écrire une correspondance devinée.
- [x] Taille de police du texte de description vérifiée : `.rich-text-content p { font-size: 12px }` (`app/globals.css`), déjà correcte, aucun changement nécessaire.
- [x] Traduire aussi le **texte** des blocs `description` (pas seulement le nom de l'entrée) — ajouté en cours de route sur demande explicite. Fait pour Sort (mécanisme réutilisable, pas encore étendu aux autres catégories à vraie prose officielle : Règle, Aptitude).
- [x] Traduire les métadonnées structurées du bloc `spell_casting` (École, Temps d'incantation, Portée, Composantes, Durée) — signalé par l'utilisateur comme non traduit alors que le nom et la description l'étaient déjà. Ces champs sont peuplés directement depuis le JSON SRD anglais à l'import (`ingest-srd.ts`) et n'avaient jamais de chemin de traduction ; comme `getRuleEntryForWorld` applique déjà `blocks.<type>` génériquement pour n'importe quel `block_type`, aucun changement de service n'a été nécessaire, seule l'extraction l'était.

**En cours** — progrès substantiel sur deux sessions, ticket pas fermé : Objet et Aptitude restent les deux gros chantiers.

- Un paragraphe de prose ne se devine pas puis ne se vérifie pas mot pour mot comme un nom (la traduction officielle ne reproduit jamais l'anglais caractère pour caractère, même fidèle) : la méthode est différente — extraction directe du texte officiel depuis `data/srd/fr-source/srd-5.1-fr.txt`, jamais une traduction reconstruite. Script dédié : `scripts/translate-spell-descriptions-fr.ts` (`npm run translate:spell-descriptions`), détecte chaque sort par son motif fixe (nom seul, puis ligne « École du Ne niveau » ou « Sort mineur d'École »), extrait la prose jusqu'à l'entrée suivante, filtre le pied de page répété sur chaque page du PDF. Trois bugs corrigés en le construisant : suffixe `(rituel)` cassait la détection d'en-tête (avalait des dizaines de sorts en trop, ex. Communion), école commençant par une consonne utilise « de » et non « d' » (Divination, Nécromancie), dernière entrée du chapitre sans borne de fin naturelle.
- Stockage : `ruleset_entry_translations.blocks.description.segments` (colonne déjà prévue par le schéma, jamais utilisée jusqu'ici). Le service (`getRuleEntryForWorld`) l'applique à la base **avant** la résolution des surcharges de variante (V1-A4) : une surcharge de variante l'emporte toujours si elle vise le même bloc, la traduction ne fait que remplacer le texte officiel non surchargé.
- Astuce de recyclage : les noms déjà vérifiés pour UN ruleset (2014 ou 2024) servent de candidats croisés pour l'autre — beaucoup de « manquants » n'étaient qu'un trou de couverture sur une seule édition, pas une vraie traduction absente.
- Bonus : croiser l'extraction de prose avec les données structurées déjà en base (école + niveau + notation de dés exacte, un signal indépendant de la langue) a permis de découvrir des noms de sorts supplémentaires sans jamais deviner (ex. « Weird » → « Ennemi subconscient », confirmé par le contenu).
- **Limite structurelle découverte, pas un échec de méthode** : certaines entrées 5e-bits n'ont pas d'équivalent séparé dans le texte officiel — une seule fiche couvre plusieurs variantes. Confirmé pour les formes de loup-garou/vampire (« Werewolf, Human/Hybrid/Wolf Form » → une seule fiche « Loup-garou » dans le SRD) et pour les potions de résistance par type de dégâts (« Potion of Acid/Cold/Fire/... Resistance » → une seule fiche « Potion de résistance » générique, le type étant tiré au hasard). Ces cas restent en anglais en toute connaissance de cause : il n'y a rien à vérifier séparément.
- Vérifié dans le navigateur : Boule de feu affiche le texte français officiel complet, y compris la clause « À plus haut niveau ».
- Pourquoi Sort n'était qu'à 98 % : 7 noms de sorts (Move Earth, Contingency, Dominate Beast, Sending, Sequester, Tree Stride, Wind Walk) manquaient encore sur une ou deux rulesets. Retrouvés et vérifiés par contenu (niveau + école + mécanique exacte, jamais devinés) contre les 319 entrées déjà extraites du texte officiel mais pas encore rapprochées d'un nom anglais : Sort passe à 99,5 % (635/638), seul Contingency reste absent du texte SRD 5.2.1 spécifiquement (différence d'édition déjà documentée ailleurs).
- Métadonnées d'incantation : `École`/`Temps d'incantation`/`Portée`/`Durée` sont déjà écrites en français juste au-dessus de la prose dans le texte officiel (ex. « Temps d'incantation : 1 action », « Durée : instantanée ») — extraites verbatim par le même script (`translate-spell-descriptions-fr.ts`), pas traduites depuis l'anglais. `Composantes` (V/S/M) est indépendant de la langue ; le composant matériel entre parenthèses est extrait du texte français. Écrit dans `blocks.spell_casting` aux côtés de `blocks.description`, avec la même précédence surcharge-de-variante-l'emporte. Vérifié dans le navigateur sur Boule de feu : École "Évocation", Portée "45 m", Durée "instantanée", Composantes "V, S, M (une petite boule de guano de chauve-souris et de soufre)".
- **Bug de nom trouvé en creusant pourquoi Portée/Durée manquaient encore sur 5 sorts** (Jump, Feather Fall, Tongues, Seeming, Web) : le nom stocké en base pour ces cinq-là était **faux**, pas juste incomplet — une passe de vérification antérieure avait confirmé une sous-chaîne qui matchait bien le texte officiel, mais celle d'une autre entrée (Feather Fall portait le nom de l'aptitude de moine « Chute ralentie », pas le vrai nom du sort « Feuille morte ») ou une version tronquée du vrai titre (Web = « Toile », alors que le titre complet est « Toile d'araignée » ; Seeming = « Apparence » au lieu de « Apparence trompeuse »). Le nom exact a été retrouvé en lisant le texte officiel autour de la mécanique de chaque sort (portée/composantes/durée qui correspondent), puis corrigé en base pour les deux rulesets : Jump → **Saut**, Feather Fall → **Feuille morte**, Tongues → **Don des langues**, Seeming → **Apparence trompeuse**, Web → **Toile d'araignée**. Une fois le nom corrigé, l'extraction habituelle a rattrapé description + métadonnées sans changement de code. Sort est maintenant à 100 % de couverture pour description + métadonnées d'incantation (635/635 traductions existantes).
- Leçon pour les prochaines catégories (Règle, Aptitude) : une vérification par sous-chaîne peut confirmer un nom qui appartient à une AUTRE entrée du même texte — ne pas se fier uniquement au « la chaîne existe quelque part », vérifier aussi que le contexte (mécanique, chapitre) correspond bien à l'entrée visée.
- **Monstre, 88 % → 91 %** : la plupart des noms restants ne sont pas des traductions ratées mais de vrais trous de contenu, distincts les uns des autres et vérifiés un par un dans le texte officiel (`data/srd/fr-source/srd-5.1-fr.txt`, chapitre « Monstres », ligne 26015+) :
  - 13 noms recyclés d'un ruleset vers l'autre n'ont **rien apporté** cette fois (contrairement aux sorts) : chacun a échoué la vérification mot pour mot contre le texte de la ruleset qui les manquait — signe que ces créatures (Duergar, Androsphinx, Gnome des profondeurs, Nuées d'insectes, Vétéran demi-dragon rouge, Guerrier tribal côté SRD 5.2.1 ; Roper, Drow, Prêtre, Chuul côté SRD 5.1) sont simplement absentes du sous-ensemble de créatures publié dans CETTE édition du SRD — un vrai trou de contenu officiel, pas un bug d'extraction.
  - 11 noms cherchés directement par mécanique de statblock (jamais devinés à l'aveugle) ont abouti, certains avec un nom français très éloigné de l'anglais : Solar → **Solar**, Pit Fiend → **Diantrefosse**, Wight → **Nécronte (nécrophage)**, Wraith → **Spectre**, Spirit Naga → **Naga corrupteur**, Rust Monster → **Oxydeur**, Treant → **Sylvanien**, Axe Beak → **Autrache**, Lizardfolk → **Saurial (homme-lézard)**, Rug of Smothering → **Tapis étrangleur**, Owlbear → **Hibours (ours-hibou)**, Vampire Spawn → **Vampirien**, et une coquille corrigée : Chuul avait un nom déjà vérifié mais mal orthographié (« Chtuul » au lieu de « Cthuul » confirmé dans le texte 5.1).
  - Vrais trous restants (confirmés absents du texte officiel après recherche, pas seulement non trouvés) : Merfolk, Gibbering Mouther, Grimlock, Giant Rat (Diseased) — introuvables dans la section alphabétique attendue du chapitre Monstres, dans aucune des deux éditions.
  - ~38 des 58 manquants restants sont les variantes de forme déjà documentées (loup-garou/vampire/etc., une seule fiche officielle pour plusieurs entry_key 5e-bits) — non traduisibles par nature, pas un travail restant.
- **Aptitude, 28 % → 45 % (961 entrées, 406 noms anglais distincts manquants au départ)** — troisième session sur cette catégorie, avec une découverte méthodologique importante : cette traduction officielle SRD 5.1 **n'est pas** la traduction PHB grand public que la plupart des joueurs français connaissent (Ubisoft/BBE). C'est une traduction indépendante avec ses propres choix de vocabulaire, parfois très éloignés des termes attendus :
  - Action Surge = **Fougue** (pas « Sursaut d'action »)
  - Indomitable (Guerrier) = **Inflexible** (pas « Puissance indomptable », qui est en réalité le nom d'Indomitable Might chez le Barbare — deux aptitudes homonymes en anglais, deux noms différents en français, vérifié par lecture directe pour ne pas les confondre)
  - Cunning Action = **Ruse** (pas « Action rusée »)
  - Reckless Attack = **Témérité** (pas « Attaque téméraire »)
  - Sorcerous Origin = **Origine magique**, Arcane Recovery (Magicien) = **Restauration magique** (le mot « arcanique » n'est pas utilisé ici)
  - Eldritch Invocations = **Manifestations occultes** (pas « Invocations occultes ») — a permis de retrouver les 17 noms d'invocations individuelles un par un en lisant le chapitre Occultiste et en faisant correspondre chaque prérequis/mécanique (ex. Agonizing Blast = « Décharge déchirante », Lifedrinker = « Buveuse de vie »)
  - Plusieurs autres : Deflect Missiles = Parade de projectiles, Purity of Body = Pureté physique, Land's Stride = Foulée tellurique, Natural Explorer = Explorateur-né, Divine Sense = Perception divine, Font of Magic = Source de sorcellerie, Otherworldly Patron = Protecteur d'outre-monde, Mystic Arcanum = Arcanum mystique (pas « Arcane »), Song of Rest = Chant reposant.
  - Leçon pour la suite : deviner à partir de la traduction PHB grand public produit des candidats plausibles mais faux plus d'une fois sur deux (45/180 puis 85/90 vérifiés selon les lots) — il vaut mieux lire directement la table de progression de chaque classe dans `data/srd/fr-source/srd-5.1-fr.txt` (elle liste tous les noms d'aptitudes de la classe en une fois) que deviner puis vérifier.
  - Classes couvertes en détail cette session : Guerrier, Barbare, Barde, Clerc, Druide, Moine, Paladin, Rôdeur, Roublard, Ensorceleur, Occultiste, Magicien. Races couvertes ensuite (même méthode, lecture directe des traits raciaux) : Nain, Elfe/Haut-elfe, Halfelin, Demi-orc, Drakéide, Gnome, Tieffelin — avec de nouvelles corrections du même type (Relentless Endurance = **Acharnement** pas « Endurance implacable », Savage Attacks = **Sauvagerie** pas « Attaques sauvages », Infernal Legacy = **Ascendance infernale** pas « Héritage infernal », Elf Weapon Training = **Entraînement martial elfique** pas « elfe »). Sous-classe Lignée draconique de l'Ensorceleur également couverte (Draconic Resilience = **Résistance draconique** pas « Robustesse draconique »).
  - Toutes les sous-classes SRD couvertes ensuite avec la même méthode (lecture directe, jamais devinée) : Voie de la Paume (Moine, Wholeness of Body = **Plénitude physique** pas « Intégrité du corps », Quivering Palm = **Paume vibratoire** pas « Paume vibrante »), Chasseur (Rôdeur, toute la liste Hunter's Prey/Defensive Tactics/Superior Hunter's Defense retrouvée par les choix « au choix » du texte), Voleur (Roublard, Fast Hands = **Mains lestes** pas « Mains rapides », Second-Story Work = **Monte-en-l'air**), Collège du Savoir (Barde, Cutting Words = **Mots cinglants** pas « Mots acérés »), Serment de Dévotion (Paladin), Le Fiélon (Occultiste, Dark One's Blessing = **Bénédiction du ténébreux** pas « ... du seigneur des ténèbres »), École d'Évocation (Magicien, Evocation Savant = **Évocateur érudit**), Voie du Berserker (Barbare, Retaliation = **Représailles**), Champion (Guerrier, déjà correct), Lignée draconique (Ensorceleur, déjà fait).
  - Variantes 2024 (`data/srd/fr-source/srd-5.2.1-fr.txt`, classes entièrement retravaillées) couvertes ensuite : le vocabulaire y est souvent très différent du 2014, parfois pour la même aptitude anglaise renommée (Destroy Undead 2014 devient Sear Undead 2024 = **Calcination de Mort-vivant** ; Divine Intervention Improvement 2014 = « Intervention divine supérieure » devient Greater Divine Intervention 2024 = **Intervention divine suprême** ; Ki-Empowered Strikes 2014 = « Frappes de ki » devient **Frappes renforcées** en 2024). Nouvelles aptitudes propres au 2024 : Epic Boon = **Faveur épique**, Divine Order = **Ordre divin**, Weapon Mastery (« Bottes d'arme »), Tactical Mind = **Sens tactique**, Cunning Strike = **Frappe malicieuse**, Abjure Foes = **Abjuration d'ennemis**. Deux candidats au même nom anglais mais avec des valeurs différentes par édition coexistent sans conflit : le script ne réécrit que la ruleset où le terme se vérifie réellement dans le texte.
  - Suite des classes 2024 couvertes (Barde, Ensorceleur, Occultiste, Magicien, Rôdeur, Druide) : nouvelles aptitudes propres au 2024 sans équivalent 2014 direct — Words of Creation = **Verbe de la création**, Innate Sorcery = **Sorcellerie innée**, Sorcery Incarnate = **Sorcellerie incarnée**, Contact Patron = **Communication avec le protecteur**, Magical Cunning = **Rouerie magique**, Ritual Adept = **Savoir rituel**, Scholar = **Érudition**, Memorize Spell = **Mémorisation de sort**, Deft Explorer = **Fin explorateur**, Roving = **Arpenteur**, Tireless = **Infatigable**, Relentless Hunter = **Chasseur implacable**, Nature's Veil = **Voile de la nature**, Precise Hunter = **Chasseur précis**, Primal Order = **Ordre primitif**, Wild Resurgence = **Regain sauvage**.
  - Traits d'espèce 2024 couverts ensuite (remplacent les sous-races 2014 par un système de « lignage » choisi indépendamment de l'espèce) : Elven Lineage = **Lignage elfique**, Gnomish Lineage = **Lignage gnome**, Fiendish Legacy = **Héritage fiélon**, Giant Ancestry = **Ascendance gigante** (Goliath 2024) avec ses 6 bénéfices au choix retrouvés un par un (Fire's Burn = Brûlure ignée, Frost's Chill = Froid mordant, Hill's Tumble = Renversement des coteaux, Cloud's Jaunt = Saut des nuées, Stone's Endurance = Endurance de la pierre, Storm's Thunder = Tonnerre des cieux). Traits Halfelin/Humain/Orc 2024 aussi : Lucky = **Chance** (pas « Chanceux » comme en 2014), Skilled = **Compétent**, Resourceful = **Ingénieux**, Adrenaline Rush (Orc) = **Poussée d'adrénaline**.
  - **Nouvelle découverte (Aptitude 62 % → 65 %)** : le chapitre « Dons » (Feats) du SRD 2024 contient une section dédiée « Dons de faveur épique » qui liste individuellement les 7 Epic Boons — Boon of Irresistible Offense = **Faveur d'attaque irrésistible**, Boon of Dimensional Travel = **Faveur de déplacement dimensionnel**, Boon of Fate = **Faveur du destin**, etc. Même chapitre pour les dons de Style de combat (2024 en a fait des dons plutôt que des choix de classe) : Archery = **Archerie**, Two-Weapon Fighting = **Combat à deux armes** — mais Dueling et Protection n'y figurent plus du tout (vrai retrait, pas un trou d'extraction). Alert = **Vigilant** et Grappler = **Empoigneur** confirment que plusieurs dons ont aussi été renommés entre éditions.
  - Circle of the Land (Druide) : les 7 choix de terrain (Arctic/Coast/Desert/Forest/Grassland/Mountain/Swamp) ont en fait des en-têtes séparés dans le texte, contrairement à ce qui avait été supposé au premier passage — Coast = **Littoral** (pas « Côte »), Swamp = **Marais** (pas « Marécage »), les deux premières suppositions étaient fausses mais la vérification mot pour mot les avait déjà écartées sans dégât.
  - Dernier lot de cette session : les noms de catégorie de sous-classe « nus » (sans le suffixe artificiel « feature » ajouté par 5e-bits) confirmés pour le 2014 — Arcane Tradition = **Tradition arcanique**, Bard College = **Collège bardique**, Sacred Oath = **Serment sacré**, Sorcerous Origin = **Origine magique**, etc. Rendement en forte baisse à ce stade : le reste est soit un doublon déjà couvert par une autre variante, soit un vrai retrait de contenu entre éditions (comme Fighting Style: Dueling/Protection déjà documentés).
  - Restent à couvrir : Demi-elfe (traits déjà lus, rien de nouveau trouvé).
- **Objet, 30 % → 52 % (1169 entrées)** : contrairement aux aptitudes (dispersées en prose dans chaque chapitre de classe), les objets magiques sont listés dans un unique chapitre « Objets magiques » (`data/srd/fr-source/srd-5.1-fr.txt`, ligne 20588+), avec un motif d'en-tête fixe (nom seul, puis ligne « Anneau/Arme/Armure/Baguette/Bâton/Bouclier/Objet merveilleux/Potion, rareté »). Extraction systématique du chapitre entier (187 objets trouvés en une passe, comme pour les sorts et les monstres), puis rapprochement par sens avec les noms anglais manquants avant vérification — jamais une correspondance non vérifiée : Amulet of Proof against Detection and Location = **Amulette d'antidétection**, Cubic Gate = **Cube des plans**, Handy Haversack = **Havresac magique**, Staff of the Magi = **Bâton du thaumaturge**. Plus de 100 objets vérifiés d'un coup sur ce seul lot.
  - Chapitre « Équipement » couvert ensuite pour le matériel mondain (outils, instruments de musique, paquetages) : Alchemist's Supplies = **Matériel d'alchimiste**, Navigator's Tools = **Instruments de navigateur**, Poisoner's Kit = **Matériel d'empoisonneur**.
  - Objets magiques à bonus (+1/+2/+3) couverts en un seul motif réutilisable pour toutes les variantes : Weapon +1/+2/+3 = **Arme +1, +2 ou +3**, Armor +1/+2/+3 = **Armure +1, +2 ou +3**, Shield +1/+2/+3 = **Bouclier +1, +2 ou +3**, Ammunition +1/+2/+3 = **Munitions +1, +2 ou +3** (la rareté variable selon le bonus est décrite dans le même paragraphe que le nom générique, donc une seule fiche officielle couvre les trois bonus).
  - Sous-variantes tabulaires partiellement couvertes ensuite (Objet 52 % → 54 %) : les 9 statuettes de Figurine of Wondrous Power sont nommées individuellement en gras dans le texte (Ivory Goats = **Chèvres d'ivoire**, Bronze Griffon = **Griffon de bronze**, etc.) — vérifiées et écrites sans risque, ce sont des expressions à plusieurs mots, distinctives. Potion of Greater/Superior Healing = **Guérison importante/supérieure** (la table ne nomme que le suffixe de rareté, pas le nom complet du sous-objet, mais suffisant pour vérifier).
  - **Tenté et volontairement écarté** : les 6 variantes de Belt of X Giant Strength (« Ceinturon de force de géant des nuages », etc.) — le texte officiel ne les nomme que par la colonne d'un tableau (« Géant des nuages », rareté), jamais comme une expression complète assemblée ; la vérification mot pour mot a donc correctement rejeté ces 6 candidats plutôt que d'écrire une reconstruction non confirmée. Même limite prévisible pour Ioun Stone (14 sous-types, chacun nommé par un seul mot commun comme « Absorption » ou « Agilité » — risque de faux positif trop élevé pour vérifier par simple sous-chaîne, écarté par prudence) et Feather Token (sous-types nommés uniquement par leur forme d'animal dans une liste, pas par une expression complète).
  - Armes et armures magiques nommées couvertes ensuite (Objet 54 % → 56 %), chacune vérifiée par sa mécanique exacte avant d'écrire (plusieurs noms très éloignés du sens littéral anglais) : Sword of Sharpness = **Épée acérée**, Flame Tongue = **Épée ardente**, Sword of Wounding = **Épée mordante**, Sun Blade = **Épée radieuse**, Dagger of Venom = **Dague venimeuse**, Berserker Axe = **Hache du berserker**, Dwarven Thrower = **Marteau de lancer nain**, Mace of Disruption/Smiting/Terror = **Masse d'anéantissement/destructrice/terrifiante**, Scimitar of Speed = **Cimeterre de célérité**, Mithral Armor = **Armure de mithral**, Demon Armor = **Armure démoniaque**, Glamoured Studded Leather Armor = **Armure de cuir clouté enchantée**.
  - Sceptres (Rod) couverts ensuite (Objet 56 % → 57 %) : Rod of Absorption = **Sceptre d'absorption**, Rod of Lordly Might = **Sceptre de puissance seigneuriale**, Rod of Security = **Sceptre de sécurité**, Rod of Rulership = **Sceptre de suzeraineté**, Rod of Alertness = **Sceptre de vigilance**, Immovable Rod = **Sceptre inamovible**. Plus Robe of Stars = **Robe aux étoiles**.
  - Écarté par la même limite structurelle déjà documentée (nom du sous-type uniquement dans une colonne de tableau, jamais en expression complète) : Elemental Gem (Air/Earth/Fire/Water — la table associe un type de gemme, comme « Saphir bleu », à un élémentaire, sans jamais nommer « Gemme élémentaire de l'air »), Spell Scroll par niveau (la table nomme juste « 1er », « 2e »... sans le mot « Parchemin »). Quelques armes nommées cherchées sans succès cette fois (Holy Avenger, Luck Blade, Nine Lives Stealer, Weapon of Warning, Defender, Frost Brand) — probablement présentes ailleurs dans le chapitre sous un nom différent de ce qui était deviné, à reprendre une prochaine fois par lecture exhaustive plutôt que recherche ciblée.
  - **Repris et résolu** : les six armes légendaires cherchées sans succès la fois précédente ont en fait été trouvées en listant systématiquement tous les en-têtes de catégorie « Arme ( » du chapitre plutôt qu'en devinant un nom français puis en cherchant : Frost Brand = **Fer gelé**, Defender = **Gardienne**, Luck Blade = **Lame porte-bonheur**, Holy Avenger = **Vengeresse sacrée**, Nine Lives Stealer = **Voleuse de vie**, Hammer of Thunderbolts = **Marteau de tonnerre**. Même passage exhaustif sur les catégories « Armure ( » : Adamantine Armor = **Armure d'adamantium**, Elven Chain = **Chemise de mailles elfique**, Dwarven Plate = **Harnois nain**, Plate Armor of Etherealness = **Harnois éthéré**.
  - **Découverte majeure (Objet 66 % → 67 %, plus gros bond de la session)** : la table générale « Objet Prix Poids » du chapitre Équipement (avant même le chapitre Objets magiques) couvre à elle seule des dizaines de manquants — matériel d'aventurier courant (Acid vial = **Acide**, Antitoxin = **Antidote**, Caltrops = **Chausse-trappes**, Grappling Hook = **Grappin**, Holy Water = **Eau bénite**, Ladder = **Échelle**...), plus la table complète des Poisons (Assassin's Blood = **Sang d'assassin**, Wyvern Poison = **Poison de vouivre**, Truth Serum = **Sérum de vérité**, les 14 poisons nommés retrouvés d'un coup) et la table Montures et véhicules (Warhorse = **Destrier**, Mastiff = **Molosse**, Chariot = **Char** — à ne pas confondre avec le mot français « Chariot », qui correspond en fait à l'anglais Wagon, un vrai faux-ami entre les deux tables).
  - **Point de blocage atteint pour ce cycle** : l'essentiel des ~260 noms restants appartient aux familles tabulaires déjà écartées par prudence (Ioun Stone ×14, Ring of X Resistance/Command ×13, Potion of X Giant Strength/Resistance ×15, Manual of X Golems ×4, Barding ×10, Dragon Scale Mail ×10 couleurs, Spell Scroll ×11 niveaux) — le nom du sous-type n'existe que dans une colonne de tableau, jamais en expression complète vérifiable sans risque de faux positif. Le reste (Keelboat, Mysterious Deck, Three-Dragon Ante, Dragonchess, Dragon Orb, Boots of Striding and Springing, Wings of Flying, Restorative Ointment...) demanderait une lecture exhaustive supplémentaire du chapitre pour un gain marginal par recherche — bon point d'arrêt naturel plutôt qu'un vrai blocage.
  - **Incident de mesure repéré et clarifié** : un contrôle de couverture a affiché 654/1169 (55,9 %) au lieu des 784/1169 (67,1 %) attendus. Vérifié directement en base que les traductions déjà écrites (Épée acérée, Gardienne, Sceptre d'absorption...) étaient bien présentes — aucune perte de données. Le script relancé plusieurs fois de suite est revenu spontanément à 784/1169, stable sur 3 essais consécutifs : lecture incohérente ponctuelle côté Supabase (délai de cohérence probable), pas un bug de méthode ni une régression. Periapt of Health/Wound Closure/Proof against Poison confirmés dans la foulée (Amulette de bonne santé/de cicatrisation/de protection contre le poison).
- **Règle (78 entrées, la plus petite catégorie), 73 % → 78 %** : Actions in Combat = **Actions au combat**, Between Adventures = **Entre les aventures**, Diseases = **Maladies** confirmés d'abord. Puis la même table des matières du SRD 2024 qui a débloqué Sous-classe/Espèce a aussi servi ici : The Order of Combat = **L'ordre du combat**, Sentient Magic Items = **Objets magiques intelligents**, Standard Exchange Rates = **Pièces de monnaie** (le SRD 2024 fusionne ce chapitre avec la table des pièces plutôt que d'en faire une section à part). Restent introuvables : Adventuring, The Environment, The Planes of Existence, Using Each Ability, What Is a Spell?, Appendix, Fantasy-Historical Pantheons — leur contenu 2014 a été redistribué dans d'autres sections du 2024 (Comment jouer, Boîte à outils ludique...) sans conserver un titre isolé équivalent, une vraie différence de plan entre éditions plutôt qu'un trou d'extraction.
  - **Découverte importante en creusant cette catégorie** : contrairement à Monstre (description synthétisée à l'import), le bloc `description` d'une entrée Règle contient déjà une vraie prose anglaise substantielle extraite du JSON SRD brut (souvent plusieurs paragraphes en Markdown, avec titres et listes). Une extraction française serait donc légitime et à forte valeur — mais contrairement aux sorts et aux objets magiques (regroupés dans un chapitre unique et bien délimité), le contenu des règles est **dispersé dans tout le document** (création de personnage, combat, incantation, équipement, aventure) avec des sections de longueur très variable. Extraire ça correctement demanderait de localiser et délimiter chacune des ~78 sections individuellement, un travail bien plus long que l'extraction des sorts — identifié mais pas commencé, à traiter dans un prochain ticket dédié plutôt qu'en fin de session.
- **Sous-classe, 85 % → 100 % (terminé)** et **Espèce, 46 % → 71 %** : découverte clé en cherchant les 5 derniers noms de sous-classe manquants (tous des variantes 2024) — le texte `srd-5.2.1-fr.txt` a une **table des matières complète en tout début de document** qui liste le nom officiel de chaque sous-classe et chaque espèce du SRD 2024 en un seul endroit, bien plus rapide à lire que de fouiller chapitre par chapitre. Elle a aussi révélé que plusieurs sous-classes ont changé de nom entre 2014 et 2024 pour la même idée : Draconic Bloodline 2014 = « Lignée draconique » devient **Sorcellerie draconique** en 2024 ; The Fiend 2014 = « Le Fiélon » devient **Protecteur Fiélon** ; Way of the Open Hand 2014 = « Voie de la Paume » devient **Credo de la Paume** en 2024.
  - Même table des matières a débloqué Espèce : les sous-choix de lignage 2024 (Elven Lineage, Gnomish Lineage, Fiendish Legacy, Giant Ancestry) ont été retrouvés via les tableaux dédiés à chaque espèce — Fiendish Legacy: Abyssal/Chthonic/Infernal = **Abyssal/Chtonien/Infernal**, Gnomish Lineage: Forest/Rock Gnome = **Gnome des forêts/des roches**. Les 6 bénéfices de Giant Ancestry déjà trouvés pour Aptitude ont été réutilisés tels quels pour Espèce, sans nouvelle recherche.
  - Restent bloqués, en toute connaissance de cause : les 10 couleurs de Draconic Ancestor (même limite tabulaire que les couleurs de dragon déjà documentées — un seul mot commun par couleur, aucune expression complète à vérifier sans risque) ; Half-Elf, Half-Orc, Hill Dwarf, Lightfoot Halfling confirmés absents du SRD 2024 (la table des matières des espèces 2024 liste Drakéide/Elfe/Gnome/Goliath/Halfelin/Humain/Nain/Orc/Tieffelin — ni Demi-elfe ni Demi-orc n'y figurent, un vrai retrait de contenu entre éditions, pas un trou d'extraction).

**État des noms par catégorie (deux sessions de suite)** :

| Catégorie | Round 1 | Round 2 | Final |
|---|---|---|---|
| Sort | 55 % | 71 % | **99,5 %** |
| Monstre | 84 % | 87 % | **91 %** |
| Aptitude | 14 % | 20 % → **65,3 %** | (961 entrées) |
| Arme | 60 % | 92 % | **97 %** |
| Armure | 62 % | 77 % | **96 %** |
| Sous-classe | 61 % | 79 % → **100 %** | — |
| Règle | 42 % | 67 % → **78 %** | (78 entrées) |
| Espèce | 46 % | 46 % → **71 %** | (débloqué via la table des matières du SRD 2024) |
| Objet | 8 % | 30 % → **67 %** | (1169 entrées) |
| Classe/Historique/Condition | 100 % | — | inchangé |

Objet et Aptitude restent, de loin, les deux catégories qui pèsent le plus lourd (2130 entrées à eux deux), mais toutes deux ont dépassé la moitié de leur volume ce cycle. Description de texte officielle : seul Sort a une extraction de prose à ce jour ; étendre la même méthode à Règle et Aptitude (qui ont une vraie prose SRD, contrairement à Monstre dont la description est une phrase synthétisée par l'import) reste à faire.

---

## Lot B — Le personnage

*Le morceau difficile. Objectif : créer un personnage jouable et afficher sa fiche.*

### V1-B1 — Le moteur de fiche dérivée · `L` · **écrire les tests d'abord**

Entièrement dans `src/core/rules/sheet.ts`. Ni base, ni réseau. Spécification : `specs/wiki-liens-et-personnages.md` partie B.

- Les sept couches de modificateurs et leurs règles d'empilement (§B4).
- `characterSheet(build, ruleset, equipment, activeEffects): DerivedSheet`.
- Chaque valeur dérivée porte sa provenance.

**Critères** — les six cas dorés du §B7, un test chacun :
- [x] Guerrier nain niveau 1, cotte de mailles + bouclier : couches 1 à 6, empilement de CA.
- [x] Roublard niveau 5 avec expertise.
- [x] Magicien niveau 3 : DD de sort, emplacements, caractéristique d'incantation.
- [x] Guerrier 5 / roublard 2 : multiclassage, clés de choix qualifiées.
- [x] Sous *bénédiction* et *entravé* : couche 7, avantage et désavantage s'annulent.
- [x] Prérequis non satisfait : avertissement présent, enregistrement autorisé.
- [x] La fonction n'importe rien de `next`, `react` ni `@supabase` (la règle ESLint le prouve).
- [x] Couverture > 90 % (98,1 % lignes, 92,4 % branches sur `sheet.ts`).

> **C'est la fonction la plus dense du projet et la première cause de bugs de tout créateur de personnage jamais écrit.** Si un seul module mérite des tests écrits avant le code, c'est celui-là.

**Fait** — `src/core/rules/sheet.ts` + `sheet.test.ts` (12 tests dont les six cas dorés). Fonction pure, aucune dépendance base/réseau.

Décisions prises en écrivant le moteur, qui engagent V1-B2 et la suite :
- `Modifier`/`Choice`/`ResolvedRuleset`/`CharacterBuild`/`DerivedSheet` n'existaient nulle part dans le code (seulement en JSON d'exemple dans la spec) — définis à neuf dans `sheet.ts`. Les primitives Zod `zModifier`/`zChoice` de `src/core/schemas/rule-blocks/primitives.ts` existent déjà mais sont plus étroites que le contrat §B4/§B2 (pas de champ `source`, `op` restreint, `from` en tableau plutôt qu'objet discriminé) et ne sont utilisées par aucun bloc — laissées telles quelles, à réconcilier quand V1-B2 aura besoin d'un vrai bloc `character`/`modifiers`.
- Contrat §B7 étendu avec un champ `rollState` (`"advantage"|"disadvantage"|"normal"`) sur `savingThrows`/`skills` : le contrat d'origine n'expose aucun moyen d'observer l'annulation avantage/désavantage de la couche 7, pourtant un critère explicite du ticket.
- `set` sur une cible efface entièrement les sources précédentes (règle B4.4) ; `min`/`max` s'appliquent une seule fois, après les sept couches, comme bornes globales.
- Règle de multiclassage : seule `build.classes[0]` (la classe de départ) fournit des maîtrises de jets de sauvegarde, conformément aux règles 5e.
- Points de vie : premier niveau du personnage (première classe, niveau 1) au maximum du dé de vie, tous les niveaux suivants — y compris de la même classe — à la moyenne arrondie au supérieur, plus le modificateur de Constitution par niveau.

### V1-B2 — Blocs de personnage · `L`

`character`, `inventory`, `spellcasting`, `resources`, `statblock`. Spécification : `specs/wiki-blocs.md` §4.

**Critères**
- [x] Le bloc `character` ne stocke que le build : espèce, classe, niveau, caractéristiques, choix. Aucune valeur dérivée en base.
- [x] L'inventaire accepte les trois natures : référence de règle, référence d'entité, objet en ligne.
- [x] `statblock` permet un PNJ ou une créature **sans build** — personne ne construira un gobelin niveau par niveau.
- [x] Décocher « équipé » sur une armure recalcule la CA sans rechargement de page.
- [x] Chaque référence porte son lien : capacités, armes, sorts, dons mènent à leur fiche de règle.

**Fait** — cinq schémas Zod (`src/core/schemas/blocks/{character,inventory,spellcasting,resources,statblock}.ts`), enregistrés dans le registre des blocs ; cinq éditeurs UI (`components/blocks/*BlockEditor.tsx`), câblés dans `EntityBlocks.tsx` au même mécanisme générique que les blocs V0 (aucun changement de repo/service/route n'a été nécessaire, le CRUD de blocs était déjà entièrement générique) ; un résolveur de référence (`src/server/services/referenceChips.ts`, route `POST /api/worlds/[worldSlug]/reference-chips`) et un composant `<RuleChip>` réutilisant `ai_digest` et la remontée de chaîne de ruleset (V1-A4). Vérifié dans le navigateur : ajout des cinq blocs, résolution de `dwarf`→« Nain » et `scimitar`→« Cimeterre » avec lien vers la fiche de règle, et rebasculement de la CA (11 → 16 → 11) en décochant/cochant « Équipé », sans rechargement.

**Complément post-critères** — `RuleEntryAutocomplete` (`components/blocks/RuleEntryAutocomplete.tsx`) : le champ texte libre pour une référence de règle propose maintenant, pendant la frappe, les entrées du ruleset du monde dont le nom ou la clé correspond (filtrées par `entryType`) ; un clic remplace le texte par la clé exacte. S'appuie sur `listRuleEntriesForWorld` (déjà construit pour la barre latérale Règles, V1-A1) via une nouvelle route `GET /api/worlds/[worldSlug]/rule-entries`, mise en cache en mémoire côté client (`useWorldRuleEntries`) pour ne charger la liste qu'une fois par monde même avec plusieurs champs sur la même fiche. Câblé sur `character` (espèce, historique, classe, sous-classe), `inventory` (référence d'objet) et `spellcasting` (sort connu). **Ce composant est générique et devrait être réutilisé** pour tout futur bloc qui référence une entrée de règle en texte libre (V2 : `random_table`, `loot`, `encounter`) plutôt que d'être redéveloppé par bloc.
- **`character.species/background/classes` restent des references texte, pas un champ fermé** — l'utilisateur peut toujours taper une clé qui n'existe pas (elle sera juste signalée « introuvable » par le `<RuleChip>`) ; cohérent avec la philosophie « avertir, ne pas interdire » du reste du projet (§B5).
- **Le recalcul de CA en direct utilise un `ResolvedRuleset` de démonstration**, pas l'assemblage complet depuis les règles SRD réellement importées : ce dernier suppose un bloc de règle `armor`/`weapon` qui n'existe pas encore (`specs/regles-blocs.md` : « vient quand un cas concret le réclame »). L'éditeur d'inventaire reconnaît par mot-clé (« cotte de mailles », « cuir », « bouclier ») pour prouver le mécanisme — recalcul client, aucun aller-retour réseau, via le vrai `characterSheet()` de V1-B1. L'assemblage général reste un ticket à part.
- **`choices` (bloc `character`) s'édite en JSON brut** : un vrai parcours de choix multi-niveaux est le sujet de V1-B4, pas de ce ticket.
- **`containers` (bloc `inventory`) et `saving_throws`/`skills` (bloc `statblock`) n'ont pas encore d'éditeur UI** — le schéma les accepte, la donnée survit si elle existe déjà, mais rien ne les crée depuis l'interface pour l'instant.
- **Aucune vue publique dédiée** (`components/entities/public/PublicBlockView.tsx`) pour ces cinq types — un bloc personnage rendu public via un lien de partage n'affiche que son titre, aucun contenu (le dispatcher public ne connaît que `text`/`infobox`/`image`/`custom_table`), à corriger avant d'exposer ces blocs au partage anonyme.

### V1-B3 — État de jeu · `M`

Table `entity_runtime_state`.

**Critères**
- [ ] Points de vie, ressources, conditions, expérience, hors du bloc `character`.
- [ ] Le même personnage dans deux campagnes a deux états distincts.
- [ ] Une mutation de jeu écrit un `session_event`, **jamais** une `entity_revision` (`specs/wiki-blocs.md` §4.5).

### V1-B4 — Parcours de création · `L`

**Critères**
- [ ] L'étape « choix restants » est une **liste, pas un tunnel** : on peut revenir sur un choix jusqu'au bout.
- [ ] La fiche se recalcule à chaque modification.
- [ ] Un personnage illégal reste enregistrable, avec un bandeau explicite. On avertit, on n'interdit pas.
- [ ] La CA affiche sa décomposition, pas un nombre nu.

---

## Lot C — Campagnes et permissions

*Objectif : plusieurs personnes autour d'un monde, chacune voyant ce qu'elle doit voir.*

### V1-C1 — Campagnes · `M`

`campaigns`, `campaign_members`, `campaign_characters`, `campaign_entity_snapshots`.

- [ ] Une campagne épingle une version précise de ruleset.
- [ ] Le groupe de joueurs est une entité `faction` créée avec la campagne.
- [ ] Inviter un joueur, lui attribuer un personnage.

### V1-C2 — RLS fine · `L` · **le verrou de l'ouverture publique**

Descendre la résolution de visibilité dans les politiques Postgres, en gardant le filtrage service.

**Critères**
- [ ] Un joueur ne lit aucun bloc `gm`, testé avec deux clients Supabase distincts, jamais `service_role`.
- [ ] Un joueur de la campagne A ne lit rien de la campagne B du même monde.
- [ ] Un bloc `campaign` n'est visible que des membres de cette campagne.
- [ ] La table de vérité de `src/core/visibility` et les politiques RLS donnent **le même résultat** sur les 30 cas — test comparatif automatisé.
- [ ] Aucune récursion sur `campaign_members`.

> Jusqu'à ce ticket, l'application reste à usage personnel. C'est un choix de séquencement assumé, écrit depuis la Phase 0.

### V1-C3 — Historique du wiki · `M`

`entity_revisions`.

- [ ] Chaque enregistrement rédactionnel crée une révision avec sa source.
- [ ] Comparer deux révisions, restaurer une version.
- [ ] Les mutations de jeu n'y apparaissent pas.

---

## Lot D — Première assistance IA

*Objectif : mesurer les coûts réels avant de concevoir le mode solo.*

### V1-D1 — Instrumentation et garde-fous · `M` · **avant tout appel**

- [ ] `ai_usage_log` écrit à **chaque** appel, sans exception.
- [ ] Limitation de débit par utilisateur sur les routes IA.
- [ ] Clés API serveur uniquement, jamais derrière `NEXT_PUBLIC_`.
- [ ] Le contenu de wiki inséré dans un prompt est encadré comme **donnée**, avec consigne d'ignorer toute instruction qu'il contiendrait.

### V1-D2 — Éditeur de règle assisté · `L`

Le « codeur accompagnant » de `specs/regles-couche.md` §5.

- [ ] Le modèle propose des blocs par appel d'outil, jamais du JSON extrait de prose.
- [ ] Échec de validation → deux tentatives, puis formulaire vide rendu à l'utilisateur.
- [ ] **L'utilisateur ne voit jamais de JSON** : formulaire engendré depuis le schéma Zod.
- [ ] Bac à sable avec trace : `1d8 (6) + FOR (+3) = 9 dégâts tranchants`.
- [ ] Une règle générée ne peut modifier qu'une variante, jamais une base officielle.

### V1-D3 — Assistance rédactionnelle · `M`

- [ ] Toute mutation passe par `ai_proposals` : Zod, validation métier, application transactionnelle.
- [ ] Le modèle ne peut référencer que des identifiants fournis dans le contexte du tour.
- [ ] Budget de propositions par tour ; au-delà, rejet et journalisation.

### V1-D4 — Relevé de coûts · `S`

- [ ] Remplir la colonne « mesuré » du tableau de `PDD.md` §32.
- [ ] Coût d'une génération de PNJ, d'une structuration de règle, d'une aide rédactionnelle.
- [ ] Décider du modèle économique et le consigner en §23 du PDD.

> Tant que ce tableau est vide, toute discussion sur le modèle économique est spéculative — et le mode solo se conçoit sans savoir ce qu'il coûte.

---

## 3. Critère de fin de V1

Le même que celui du PDD, à vérifier avec quelqu'un d'autre que vous :

> Un MJ prépare une session complète — 5 PNJ, 3 lieux, 1 rencontre — sans quitter l'application, en moins de 45 minutes.

Et un critère technique, non négociable :

> Ouvrir l'application à un joueur tiers exige que **V1-C2 soit terminé**.

---

## 4. Ordre recommandé

```
D-01 … D-04                dette, une session
Lot A  (A1→A2→A3→A4→A5)    les règles deviennent consultables et personnalisables,
                            A5 (traduction FR) ferme le lot une fois la structure stable
Lot B  (B1→B2→B3→B4)       le personnage devient jouable
Lot C  (C1→C2→C3)          plusieurs personnes, permissions réelles
Lot D  (D1→D2→D3→D4)       l'IA, instrumentée dès le premier appel
```

**Ne pas paralléliser les lots.** A débloque B (une fiche de personnage a besoin des règles), B débloque C (une campagne a besoin de personnages), et D a besoin de tout le reste pour avoir quelque chose à assister.

**Un ticket, un commit, une relecture.** La tentation d'enchaîner grandit avec l'aisance ; le risque R2 du registre aussi.
