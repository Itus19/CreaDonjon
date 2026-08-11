# Backlog V1 — Le compagnon jouable

**Version :** 1.0 — 30 juillet 2026
**Établi à partir de :** dépôt `Itus19/CreaDonjon`, commit `fe3736a` (V0-07)
**Documents liés :** `SCHEMA.md` · `specs/regles-couche.md` · `specs/regles-blocs.md` · `specs/wiki-liens-et-personnages.md` · `specs/wiki-blocs.md` · `specs/arbitrage-modifications.md` · `specs/fiche-personnage-interactive.md` · `specs/psyche-pnj.md` · `specs/module-joueur-et-solo.md`

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

**Complément post-critères** — `RuleEntryAutocomplete` (`components/blocks/RuleEntryAutocomplete.tsx`) : le champ texte libre pour une référence de règle propose maintenant, pendant la frappe, les entrées du ruleset du monde dont le nom ou la clé correspond (filtrées par `entryType`) ; un clic remplace le texte par la clé exacte, mais une clé non trouvée reste acceptée et signalée « introuvable » par le `<RuleChip>` plutôt que bloquée — cohérent avec la philosophie « avertir, ne pas interdire » du reste du projet (§B5). S'appuie sur `listRuleEntriesForWorld` (déjà construit pour la barre latérale Règles, V1-A1) via une nouvelle route `GET /api/worlds/[worldSlug]/rule-entries`, mise en cache en mémoire côté client (`useWorldRuleEntries`) pour ne charger la liste qu'une fois par monde même avec plusieurs champs sur la même fiche. Câblé sur `character` (espèce, historique, classe, sous-classe), `inventory` (référence d'objet) et `spellcasting` (sort connu). **Ce composant est générique et devrait être réutilisé** pour tout futur bloc qui référence une entrée de règle en texte libre (V2 : `random_table`, `loot`, `encounter`) plutôt que d'être redéveloppé par bloc.

Décisions de périmètre, documentées pour la suite :
- **Le recalcul de CA en direct utilise un `ResolvedRuleset` de démonstration**, pas l'assemblage complet depuis les règles SRD réellement importées : ce dernier suppose un bloc de règle `armor`/`weapon` qui n'existe pas encore (`specs/regles-blocs.md` : « vient quand un cas concret le réclame »). L'éditeur d'inventaire reconnaît par mot-clé (« cotte de mailles », « cuir », « bouclier ») pour prouver le mécanisme — recalcul client, aucun aller-retour réseau, via le vrai `characterSheet()` de V1-B1. L'assemblage général reste un ticket à part.
- **`choices` (bloc `character`) s'édite en JSON brut** : un vrai parcours de choix multi-niveaux est le sujet de V1-B4, pas de ce ticket.
- **`containers` (bloc `inventory`) et `saving_throws`/`skills` (bloc `statblock`) n'ont pas encore d'éditeur UI** — le schéma les accepte, la donnée survit si elle existe déjà, mais rien ne les crée depuis l'interface pour l'instant.
- **Aucune vue publique dédiée** (`components/entities/public/PublicBlockView.tsx`) pour ces cinq types — un bloc personnage rendu public via un lien de partage n'affiche que son titre, aucun contenu (le dispatcher public ne connaît que `text`/`infobox`/`image`/`custom_table`), à corriger avant d'exposer ces blocs au partage anonyme.

### V1-B3 — État de jeu · `M`

Table `entity_runtime_state`.

**Critères**
- [x] Points de vie, ressources, conditions, expérience, hors du bloc `character`.
- [x] Le même personnage dans deux campagnes a deux états distincts.
- [x] Une mutation de jeu écrit un `session_event`, **jamais** une `entity_revision` (`specs/wiki-blocs.md` §4.5).

**Fait** — les tables (`entity_runtime_state`, `sessions`, `session_events`, `campaigns`, `entity_active_effects`) existaient déjà depuis la Phase 0 (migrations `20260729204002_campaigns.sql`, `20260730120001_sessions.sql`), RLS comprise : ce ticket construit uniquement la couche applicative, aucune migration nécessaire. Schéma `zRuntimeState` (`src/core/schemas/runtimeState.ts`, testé) fidèle à l'exemple de `specs/wiki-blocs.md` §4.2 (`hp`, `hit_dice`, `exhaustion`, `xp`, `resources`, `spell_slots_used`, `conditions`, `death_saves`, `attuned`). Fusion pure `mergeRuntimeState` (`src/core/rules/runtimeState.ts`, testée) : les compteurs et sous-objets se fusionnent clé par clé (« le plus petit fait possible », §4.5), les listes se remplacent entièrement. Repos (`src/server/repos/{runtimeState,sessions}.ts`) + service (`src/server/services/runtimeState.ts`, `getEntityRuntimeState`/`applyRuntimeStateChange`) : ce dernier ne touche jamais `entities`/`entity_revisions`, et n'écrit un `session_event` que si un `sessionId` est fourni (état hors campagne = rien à journaliser, aucune session n'existe). Vérifié par un test d'intégration contre la vraie base (`runtimeState.integration.test.ts`) : mêmes personnage/entité, deux campagnes, deux PV actuels indépendants ; une mutation avec session écrit exactement un `session_event` de type `world_update` et zéro ligne dans `entity_revisions`.

Décision de périmètre : **aucune UI** dans ce ticket. Les trois critères sont vérifiables au niveau service/données (comme V1-B1) ; une vraie UI (bouton +/- PV, liste de conditions) suppose une session active à laquelle rattacher les événements, et rien ne permet encore de créer une campagne/session (`V1-C1`, Lot C, pas encore construit). Construire cette UI maintenant reviendrait à l'exposer nulle part utilisable. À reprendre une fois V1-C1 livré, ou plus tôt en petit complément si une UI « hors campagne » (PV/XP personnels, sans session) est jugée utile avant.

### V1-B4 — Parcours de création · `L`

**Critères**
- [x] L'étape « choix restants » est une **liste, pas un tunnel** : on peut revenir sur un choix jusqu'au bout.
- [x] La fiche se recalcule à chaque modification.
- [x] Un personnage illégal reste enregistrable, avec un bandeau explicite. On avertit, on n'interdit pas.
- [x] La CA affiche sa décomposition, pas un nombre nu.

**Découverte qui a changé le périmètre** — en creusant ce ticket, j'ai constaté que les entrées SRD déjà importées (V1-A1/A2) portent, dans leur bloc `custom_table` (l'échappatoire de `specs/regles-blocs.md` §5) et leur bloc `class_progression`, toutes les données mécaniques structurées nécessaires : `ability_bonuses`/`speed` (espèce), `hit_die`/`saving_throws`/`spellcasting.spellcasting_ability` (classe), `spellcasting_spell_slots_level_N` par ligne de progression, `proficiency_choices` (compétences offertes), `armor_class`/`armor_category` (armure). Ça a permis de construire un **assembleur réel**, pas un jeu de démonstration comme en V1-B2/B1 — même les cas dorés de V1-B1 se rejouent maintenant avec les vraies données (`resolvedRuleset.integration.test.ts`).

**Fait** :
- `src/core/rules/srdMapping.ts` (testé, 17 tests) : extracteurs purs qui traduisent les champs SRD déjà importés vers les formes de `characterSheet()` — bonus de caractéristique/vitesse d'espèce, dé de vie/maîtrises/incantation de classe, table d'emplacements par niveau, choix de compétences offerts, compétences d'historique, et modificateur de CA d'armure (lourde = CA fixe, légère = Dex complète, moyenne = Dex plafonnée à +2, bouclier = s'ajoute).
- `src/server/services/resolvedRuleset.ts` (`assembleResolvedRuleset`, `resolveEquipmentArmorData`) + route `POST /api/worlds/[worldSlug]/resolved-ruleset` : assemble un `ResolvedRuleset` réel pour une sélection espèce/historique/classes, avec chain-walk de variante (V1-A4) et traductions (V1-A5). Vérifié par un test d'intégration contre la base réelle : un nain guerrier assemblé ainsi reproduit exactement le cas doré de V1-B1 (CA, PV, jets de sauvegarde).
- `CharacterSheetPreview` (`components/blocks/CharacterSheetPreview.tsx`), rendu par `EntityBlocks.tsx` (pas par l'éditeur du bloc `character` seul, car il lui faut aussi le bloc `inventory` voisin) : recalcule `characterSheet()` à chaque rendu, CA décomposée (armure réelle si équipée), PV, vitesse, bonus de maîtrise, bandeau d'avertissement, liste éditable des choix de compétences restants (cases à cocher, jamais un tunnel), liste des aptitudes accordées avec `<RuleChip>`.
- L'ancien aperçu de démonstration de `InventoryBlockEditor.tsx` (V1-B2, reconnaissance par mot-clé) a été retiré — remplacé par ce panneau réel.
- Vérifié dans le navigateur : ajout d'une classe « guerrier » à un nain des collines fait apparaître instantanément Style de combat/Second souffle (vraies aptitudes traduites), une liste de 8 compétences à cocher (2/2), et persiste après rechargement.

Décisions de périmètre, documentées pour la suite :
- **Un seul type de choix modélisé : les compétences de départ de classe.** Dons, style de combat, augmentation de caractéristique, choix d'historique (ability scores/feat du SRD 2024) ne sont pas dans la liste des « choix restants » — ils existent dans les données SRD (`multi_classing.prerequisites`, `feat`, etc.) mais aucun extracteur ne les lit encore.
- **Aucun `ResolvedFeature` assemblé ne porte de `prerequisites`** — le mécanisme d'avertissement (`sheet.warnings`, testé en V1-B1) fonctionne et s'affiche correctement dans l'aperçu, mais rien dans l'assembleur actuel ne peut aujourd'hui le déclencher avec de vraies données (aucun don/multiclassage avec prérequis n'est encore mappé). Le bandeau est donc prêt, pas encore atteignable en jeu réel.
- **Sous-race sans héritage de la race de base** — sélectionner `hill-dwarf` seul donne +1 Sagesse (sa propre `ability_bonuses`) mais pas le +2 Constitution de la race `dwarf` de base : le SRD (5e-bits) modélise chaque sous-race comme une entrée séparée, sans composition automatique. Un vrai nain des collines devrait cumuler les deux ; ce ticket ne les compose pas.
- **`species`/`background` restent un champ unique** (pas de couple race+sous-race distinct dans le bloc `character`) — cohérent avec le point précédent.

### V1-B5 — Fiche de personnage jouable · `L`

Ajoutée le 12 août (`specs/arbitrage-modifications.md` §3.3), après V1-B1 à B4 dont elle dépend directement. Spécification complète : `specs/fiche-personnage-interactive.md`.

Une **vue** sur les blocs de personnage déjà spécifiés (`character`, `inventory`, `spellcasting`, `resources`, l'état de jeu) et sur la fiche dérivée de `characterSheet()` — pas un nouveau bloc de données. Quatre onglets (Actions, Magie, Inventaire, Traits), boutons d'attaque et de dégâts appelant `resolveAction`, avantage/désavantage en un clic, emplacements de sorts, repos court et long, exports JSON et PDF, sélecteur d'objets interrogeant règles **et** entités. Le bloc de stats affiché séparément (hors du bloc de personnage, cf. V1-C4) disparaît dans le même ticket — ses valeurs viennent de `characterSheet()`, elles n'ont pas à exister deux fois.

**Critères** — §8 de la spécification :
- [x] Aucun composant de la fiche ne calcule une valeur de règle. Tout vient de `characterSheet()` ou de `resolveAction()`.
- [x] Le bloc de stats séparé n'existe plus ; ajouter un bloc `character` n'en crée pas un second.
- [x] Décocher « équipé » sur une armure change la CA sans rechargement de page, et la décomposition affichée suit.
- [ ] **Passer l'épuisement à 2 change la vitesse affichée, avec sa provenance.** Non fait — voir « Décisions de périmètre ».
- [x] Un bouton d'attaque produit un jet journalisé dans `dice_rolls`, avec sa trace lisible (dans une campagne — voir périmètre).
- [x] Avantage et désavantage sont accessibles en un clic et s'annulent mutuellement.
- [x] Lancer un sort de niveau 2 décompte un emplacement de niveau 2 et applique la montée en puissance du bloc `scaling`.
- [x] Un sort sans emplacement disponible reste visible, désactivé, avec la raison affichée.
- [x] L'onglet Magie est absent pour un personnage sans incantation.
- [x] Un repos long recharge ce que le ruleset déclare, rien de codé en dur.
- [x] Le même inventaire s'affiche dans la fiche et dans l'éditeur ; modifier l'un modifie l'autre.
- [x] Le sélecteur d'objets propose règles et entités, chacune badgée.
- [x] L'export JSON ne contient aucune valeur dérivée ; le réimport reconstruit une fiche identique.
- [x] Une mutation de jeu écrit un `session_event`, jamais une `entity_revision`.
- [x] La fiche reste lisible et utilisable à 375 px de large — elle servira sur téléphone en V3.

**Fait** — `resolveAction` n'existait nulle part dans le code malgré l'affirmation de la spec (`specs/fiche-personnage-interactive.md:58`, « existe déjà ») : construit de zéro dans `src/core/rules/action.ts` (`resolveAttackRoll`, `resolveDamageRoll`, notation `2d20kh1`/`2d20kl1` pour avantage/désavantage, doublement des dés sur critique sans doubler le modificateur), tests d'abord. `src/core/rules/srdMapping.ts` étendu avec `parseWeaponData` (tolérant aux deux formes SRD 2014/2024). Orchestration côté serveur dans `src/server/services/characterActions.ts` : `resolveCharacterActionContext` réassemble un `DerivedSheet` complet à chaque appel — jamais de nombre envoyé par le client, conformément à CLAUDE.md règle 6 — et `getOrInitializeRuntimeState` initialise PV/dés de vie au maximum une seule fois, sans journalisation (`sessionId: null, actor: "system"`), puisque ce n'est pas une action du joueur. Sessions de jeu ouvertes paresseusement (`src/server/services/sessions.ts`, `getOrOpenSessionForCampaign`) : aucune gestion de séance n'existe ailleurs dans l'application, donc aucune UI dédiée n'a été ajoutée ici.

`components/blocks/PlayableCharacterSheet.tsx` remplace `CharacterSheetPreview` (V1-B4) : quatre onglets (Actions/Magie/Inventaire/Traits, Magie filtré si aucun bloc `spellcasting`), recalcul client instantané pour l'en-tête (CA/Init/Vitesse/etc., même motif que V1-B4), fetch serveur unique au montage pour l'état de jeu autoritaire. L'onglet Inventaire embarque directement `<InventoryBlockEditor>` — même composant, même canal `onChange` que l'éditeur de bloc, donc « même bloc, deux vues » sans duplication. Nouveau sélecteur `components/blocks/ItemAutocomplete.tsx` (double source : entrées de règles + entités du monde via `/api/worlds/[worldSlug]/entities-search`, badgées « règle »/« entité ») branché dans `InventoryBlockEditor`, qui ne proposait jusqu'ici que les règles malgré un schéma déjà prêt pour les deux. Export PDF par impression navigateur (`window.print()` + `@media print` dans `app/globals.css`, `print:hidden` sur l'en-tête/la barre latérale) — délibérément aucune dépendance serveur de génération PDF.

Deux bugs réels trouvés et corrigés en testant dans le navigateur, tous deux préexistants à ce ticket (pas introduits par lui) :
- `components/blocks/useResolvedRuleset.ts` effaçait tout le ruleset résolu affiché (espèce, classes, PV) dès qu'un objet d'inventaire passait en « Référence de règle » avant la moindre frappe (`ref.key = ""`, rejeté par `z.string().min(1)`, la requête échouait, le hook retombait sur un état vide sur toute réponse non-`ok`). Corrigé par un filtre `nonEmptyKeys()` appliqué à la fois à la clé de dédoublonnage et au corps de la requête.
- `app/api/entities/[id]/sheet/route.ts` : `URLSearchParams.get("campaignId")` renvoie `""` (pas `null`) pour `?campaignId=` — la chaîne vide descendait jusqu'à `putRuntimeState`, qui l'insérait telle quelle dans une colonne `uuid`, provoquant une erreur serveur 500 systématique sur la fiche jouable hors campagne (le cas normal depuis le wiki). Corrigé en normalisant `""` en `null` dans la route.

Vérification complète dans le navigateur (pas seulement les tests) : jet d'attaque et de dégâts sur une arme réelle du SRD (épée courte, finesse, mod FOR/DEX correct + maîtrise), avantage (notation `2d20kh1` confirmée dans la trace affichée), repos long restaurant PV/dés de vie, incantation avec un personnage magicien de test (emplacement de niveau 2 décompté 2/2 → 1/2), export JSON téléchargeable avec en-tête `Content-Disposition`, fiche lisible à 375 px de large.

Décisions de périmètre :
- **L'épuisement ne modifie pas encore la vitesse affichée.** La spec (§ « L'épuisement — le cas qui prouve le modèle ») suppose que la règle d'épuisement du ruleset produit déjà des modificateurs de couche 7 « à l'import » — en vérifiant ce critère, aucune conversion de ce type n'existe nulle part dans le code, pour aucune des deux éditions SRD (`data/srd/srd-2014.json` et `srd-2024.json` ne portent que du texte libre pour cette règle, pas de table structurée), et rien ne branche jamais `entity_runtime_state.exhaustion` sur `characterSheet()`'s `activeEffects` (toujours `[]`). C'est un vrai écart entre la spec et l'implémentation, pas une régression de ce ticket — construire la conversion (deux mécaniques différentes selon l'édition) est un chantier séparé, suivi comme tâche de fond.
- **Le jet d'attaque n'est journalisé dans `dice_rolls` que depuis une campagne** (`campaignId` non nul) — le mécanisme est testé et fonctionne (intégration + navigateur), mais la fiche du wiki fonctionne toujours avec `campaignId: null` (aucune navigation ne relie encore une page d'entité à une campagne), donc les jets y restent des essais non enregistrés. Cohérent avec la décision déjà actée pour V1-B4/B5 sur ce point.
- **Maîtrise d'arme toujours supposée.** Aucune modélisation de la maîtrise d'arme par classe n'existe dans le moteur ; ajouter cette nuance est un chantier de règles à part.
- **`resolveAction` limité à l'attaque/dégâts à l'arme et aux sorts (emplacements + dégâts).** Pas de distinction attaque de sort contre jet de sauvegarde — non modélisée pour l'instant.
- **Le sélecteur d'objets ne filtre pas les entités par « a une facette mécanique ».** Rien dans le modèle actuel ne marque ou n'interroge cette distinction ; le sélecteur cherche sur toutes les entités du monde.

---

## Lot C — Campagnes et permissions

*Objectif : plusieurs personnes autour d'un monde, chacune voyant ce qu'elle doit voir.*

### V1-C1 — Campagnes · `M`

`campaigns`, `campaign_members`, `campaign_characters`, `campaign_entity_snapshots`.

- [x] Une campagne épingle une version précise de ruleset.
- [x] Le groupe de joueurs est une entité `faction` créée avec la campagne.
- [x] Inviter un joueur, lui attribuer un personnage.

**Fait** — un vrai trou de schéma est apparu en creusant ce ticket : `campaigns` n'avait aucune colonne pour référencer l'entité `faction` de son groupe de joueurs, et `docs/SCHEMA.md` ne le prévoyait pas. Décision (avec l'utilisateur, `docs/adr/0008-campagne-entite-faction.md`) : nouvelle colonne `campaigns.party_entity_id` (migration `20260804140001_campaign_party_entity.sql`, poussée sur le projet lié via `supabase db push`, types régénérés). La même migration ajoute `app.find_user_id_by_email` (+ enveloppe `public`), une fonction `security definer` étroite qui ne renvoie qu'un id — nécessaire parce que `campaign_members.user_id` exige un compte déjà existant et que `profiles` ne peut pas servir d'annuaire (RLS : `profiles_select` ne laisse lire que sa propre ligne) ; jamais de lecture directe de `auth.users` depuis l'application, jamais d'élargissement de la portée du client `service_role` (CLAUDE.md règle 4 ter) — même patron que `resolve_share_link` (V0-07).

`src/server/repos/campaigns.ts` + `src/server/services/campaigns.ts` (`createCampaign` crée la faction **avant** la ligne `campaigns`, jamais l'inverse ; le créateur devient MJ en mode `campaign`, simple joueur en mode `solo` où l'IA est MJ ; `inviteCampaignMember` signale `not_found` sans erreur serveur si l'email ne correspond à aucun compte). Vérifié par un test d'intégration contre la base réelle (`campaigns.integration.test.ts`) — y compris la découverte que l'invitation doit être appelée avec un client **connecté** (`authenticated`, qui a l'accès au schéma `app`), jamais avec le client `service_role` des tests (qui ne l'a pas et ne doit pas l'avoir).

Routes (`/api/worlds/[worldSlug]/campaigns`, `/api/campaigns/[campaignId]`, `.../members`, `.../characters`) + `CampaignsPanel`/`CampaignDetail` (`components/shell/`). Vérifié dans le navigateur : création d'une campagne, confirmation en base que `party_entity_id` référence bien une entité `entity_kind='faction'`, attribution d'un personnage existant à un membre.

Décisions de périmètre :
- **Pas de sélecteur de ruleset** dans le formulaire de création — la campagne épingle toujours le ruleset par défaut du monde (`getWorldDefaultRulesetId`). Choisir une variante à la création est un ajout UI distinct, pas un changement de forme de données.
- **Invitation = compte déjà existant, ajout immédiat, aucun email envoyé.** Cohérent avec `specs/`/`docs/BACKLOG_V1.md` §V1-C2 qui rappelle explicitement que « jusqu'à ce ticket, l'application reste à usage personnel » — un vrai flux d'invitation par courriel (compte à créer, lien à accepter) est un chantier à part, pas requis ici.

**Complément post-critères** — à l'usage, le panneau Campagnes coincé sur la page d'accueil du monde (à côté du partage) s'est révélé mal placé. Sur suggestion de l'utilisateur, nouvel onglet **MJ** dans `SectionToggle` (`/m/[worldSlug]/mj`, `MjSidebar`), avec Campagnes comme première entrée fonctionnelle et trois emplacements réservés désactivés (Tables aléatoires, Rencontres, Bloc-notes) — ces outils sont explicitement classés V2 dans `specs/outils-mj.md`, pas construits ici, juste réservés dans la sidebar pour ne pas la refondre plus tard. Ceci ne contredit pas le commentaire d'origine de `SectionToggle` (« le mode solo viendra en V3, pas encore de troisième onglet ») : celui-là visait le mode solo (IA-MJ), un sujet distinct d'un espace d'outils MJ.

### V1-C2 — RLS fine · `L` · **le verrou de l'ouverture publique**

Descendre la résolution de visibilité dans les politiques Postgres, en gardant le filtrage service.

**Critères**
- [x] Un joueur ne lit aucun bloc `gm`, testé avec deux clients Supabase distincts, jamais `service_role`.
- [x] Un joueur de la campagne A ne lit rien de la campagne B du même monde.
- [x] Un bloc `campaign` n'est visible que des membres de cette campagne.
- [x] La table de vérité de `src/core/visibility` et les politiques RLS donnent **le même résultat** — test comparatif automatisé.
- [x] Aucune récursion sur `campaign_members`.

> Jusqu'à ce ticket, l'application reste à usage personnel. C'est un choix de séquencement assumé, écrit depuis la Phase 0.

**Fait** — Nouvelle fonction SQL `app.visibility_permits(world_id, level, scope_id, created_by)` (migration `20260804150001`), miroir exact de `canSee()` pour `public/players/gm/user/private`. Branchée en `and` dans la politique `_select` de **cinq** tables partageant les colonnes de visibilité — `blocks`, `relations`, `entity_mentions`, `chunks`, `assets` — pas seulement `blocks` comme le nom du ticket le suggérait : les quatre autres avaient exactement la même faille (porte d'entrée limitée à `app.is_world_member`, jamais la visibilité fine), corrigée par cohérence plutôt que d'en laisser quatre non protégées.

Deux bugs découverts et corrigés en vérifiant la RLS descendue avec un vrai test comparatif (`src/server/services/visibilityRls.integration.test.ts`, deux clients Supabase réels signés comme des joueurs distincts, jamais `service_role`) :
- `app.is_world_member` (migration `20260804150002`) ne reconnaissait que `worlds.owner_id`/`world_members`, jamais `campaign_members` seul — un joueur invité à une campagne (V1-C1, sans ligne `world_members` séparée) était bloqué à la porte extérieure de *toutes* les politiques, avant même la visibilité fine.
- Les politiques `*_write` préexistantes sont `for all`, donc s'appliquent aussi à `select` — Postgres combine plusieurs politiques permissives par **OR** — et ne vérifiaient que `is_world_member`, sans jamais consulter `visibility_permits`. Elles laissaient donc filtrer n'importe quel bloc à n'importe quel membre du monde, en parallèle de la nouvelle politique `_select` plus stricte, l'annulant silencieusement. Migration `20260804150003` : chaque `_write` scindée en `insert`/`update`/`delete` séparées (jamais `select`), mêmes conditions qu'avant.

Décisions de périmètre :
- **Le niveau `campaign` est vérifié en RLS par simple appartenance à la campagne** (`app.campaign_role(scope_id) is not null`), pas par la nuance contextuelle complète de `canSee()` (`ctx.campaignId === scopeId`, c'est-à-dire « en train de lire depuis cette campagne précise »). Une politique RLS ne voit que la ligne et `auth.uid()`, jamais « depuis quelle page l'utilisateur navigue » — cette notion n'existe nulle part côté Postgres. Vérifié par grep que `filterBlocks`/`filterSegments` ne sont actuellement appelés nulle part avec un contexte non vide dans l'application : la nuance contextuelle reste donc un raffinement service uniquement, documenté plutôt que supposé. La garantie réelle (aucune fuite vers un non-membre de la campagne) est bien portée par RLS.
- **L'accès public/anonyme réel ne passe pas par ces politiques RLS** : elles exigent toutes `app.is_world_member` en préalable. Un visiteur anonyme lit du contenu `public` via le mécanisme distinct du partage (D-01, `service_role` confiné à `publicShare.ts`), pas via une lecture RLS directe — cohérent avec le fait qu'un anonyme n'a justement pas de session Postgres authentifiée à qui accorder quoi que ce soit.

### V1-C3 — Historique du wiki · `M`

`entity_revisions`.

- [x] Chaque enregistrement rédactionnel crée une révision avec sa source.
- [x] Comparer deux révisions, restaurer une version.
- [x] Les mutations de jeu n'y apparaissent pas.

**Fait** — `entity_revisions` existait depuis la Phase 0 mais son `snapshot` ne portait que les champs de l'entité (« les blocs n'existent pas encore », un commentaire resté vrai jusqu'ici) et seule l'édition du nom/type/alias créait une révision. Ce ticket comble les deux trous :
- Le snapshot porte désormais l'entité **et** ses blocs en entier (SCHEMA.md §15), et toute mutation rédactionnelle de bloc (création, édition de contenu, suppression — pas le simple réordonnancement, purement présentationnel) crée elle aussi une révision, via un point d'entrée unique `recordEntityRevision` (`src/server/services/entityHistory.ts`) appelé depuis `services/entities.ts` et `services/blocks.ts`.
- **Interaction découverte avec V1-C2**, deux fois : depuis que la RLS de `blocks` filtre par visibilité fine, (1) un joueur qui édite son propre bloc ne récupère plus, via sa propre session, les blocs `gm` d'autrui sur la même entité — l'instantané serait tronqué ; (2) restaurer une ancienne révision fait un `delete`/`insert` groupé sur `blocks`, or Postgres exige que la ligne ciblée satisfasse *aussi* la politique `select` pour un `update`/`delete`, pas seulement celle de la commande — un bloc `gm` restait donc en place silencieusement (ni erreur, ni ligne affectée) quand c'est un joueur qui restaure. Les deux corrigés par des fonctions `security definer` bornées par `is_world_member` (jamais un rôle plus large) : `public.entity_blocks_full` (migration `20260804160001`) pour la lecture complète, `public.restore_entity_blocks` (migration `20260804160002`) pour l'écriture groupée.
- Diff pur dans `src/core/history/diff.ts` (tests d'abord) : champs d'entité + blocs ajoutés/supprimés/modifiés par id, ignore volontairement `displayOrder`.
- Filtrage de visibilité **à la lecture de l'historique** (`getRevisionForViewer`, `compareRevisionsForViewer`) : chaque instantané est filtré par blocs visibles pour le demandeur *avant* tout affichage ou calcul de diff — un joueur ne doit même pas apprendre qu'un bloc MJ a été ajouté ou modifié, pas seulement en ignorer le contenu. La restauration elle-même reste sûre pour tout déclencheur puisqu'elle ne fait que réappliquer des niveaux de visibilité déjà présents dans l'instantané, jamais un contenu neuf exposé au client.
- Restauration = toujours une **nouvelle** révision qui reproduit l'état ancien (esprit « ajout seul », ADR 0005), jamais une réécriture de l'historique.
- Compatibilité avec les révisions antérieures à ce ticket (format à plat, sans clé `blocks`) : lues comme « aucun bloc connu » sans planter, et une restauration vers l'une d'elles ne touche pas aux blocs actuels (un tableau vide serait une invention, pas un fait historique) — testé explicitement (`entityHistory.integration.test.ts`).
- UI : lien « Historique » à côté du slug dans l'en-tête de fiche (`EntityHistoryPanel.tsx`), liste des révisions, sélection de deux pour comparer, bouton restaurer par révision avec confirmation.

Décisions de périmètre :
- **Les relations n'entrent pas dans l'instantané.** Le commentaire SQL de `entity_revisions` (SCHEMA.md §15) dit explicitement « entité + blocs », pas relations — une relation est partagée entre deux fiches, sa restauration depuis l'instantané d'une seule d'entre elles soulèverait des questions distinctes (supprimer une relation que l'autre fiche ne s'attend pas à voir disparaître). Sujet à part, non traité ici.
- **Pas d'instantané automatique de fin de séance.** `specs/wiki-blocs.md` §4 mentionne l'idée (un point de restauration par séance), mais aucune notion de « fin de séance » n'existe encore dans l'application (pas de bouton, pas de flux) — rien à quoi l'accrocher pour l'instant.

### V1-C4 — Correctifs, coquille et partage protégé · `M`

Issu de `specs/arbitrage-modifications.md` §3.1 et §3.2. Petits, isolés, sans dépendance.

- [x] **Bug** : le bouton « supprimer » d'un bloc ne fonctionne pas. Écrire le test qui reproduit avant de corriger.
- [x] Le bloc de stats affiché hors du bloc de personnage disparaît.
- [x] Bouton paramètres déplacé, nom du monde à droite, menu centré sur la barre haute.
- [x] Bouton d'historique : icône ronde de montre inversée, à côté du bouton orange.
- [x] Panneau de partage déplacé dans un onglet du menu de configuration ; l'encart de l'accueil disparaît.
- [x] Écran d'accueil « Nouvelles aventures » ; sous le nom du monde, la liste des PJ (nom, espèce, classe, niveau).
- [x] Étiquette PJ/PNJ **dérivée de `campaign_characters.is_pc`**, jamais un `entity_kind` distinct.
- [x] Horloge temps réel en haut à droite.
- [x] Mot de passe optionnel sur un lien de partage : `password_hash` seul, contenu non récupéré avant validation, tentatives limitées.
- [x] Champs `gender` et `pronouns` sur le bloc `character`, avec `neutral` et `unspecified` distincts.
- [x] Règles de rédaction inclusive dans `src/i18n/fr.ts` : forme épicène, jamais de point médian (accessibilité).

**Fait** — Le bug de suppression n'en était pas un côté logique : reproduit en direct (le mécanisme delete-fetch-et-retrait-local fonctionnait déjà correctement une fois `window.confirm()` contourné), la vraie cause est `window.confirm()` lui-même — boîte native sans style, incohérente avec la coquille, facile à manquer. Remplacé par `components/shared/ConfirmDialog.tsx`, un composant réutilisable (même patron d'overlay que `CommandPalette.tsx`), branché à la fois sur la suppression de bloc (`EntityBlocks.tsx`) et sur la restauration de révision (`EntityHistoryPanel.tsx`, même symptôme). Piège découvert en le branchant : `EntityHistoryPanel` a son propre overlay `z-[1000]` — `ConfirmDialog` doit rester à `z-[1100]`, au-dessus de tout modal connu de la coquille, sinon il s'ouvre invisible derrière.

La fiche jouable (V1-B5) vit désormais dans la carte du bloc `character` lui-même (`EntityBlocks.tsx`, rendue juste après l'en-tête du bloc, avant son formulaire brut) plutôt qu'en panneau flottant au-dessus de la liste des blocs.

Coquille : en-tête du monde passé en grille à trois colonnes égales (`grid-cols-[1fr_auto_1fr]`) pour un centrage réel du bascule Monde/Règles/MJ, bouton réglages repositionné en haut à gauche (`top-2.5` pour un centrage vertical dans la barre de 56 px), historique transformé en icône ronde (⧗) déplacée à côté du sélecteur de type d'entité — dans le même coin que les pastilles orange/rouge de la fenêtre, sans toucher au composant `WindowFrame` générique. Horloge temps réel (`components/shell/Clock.tsx`) : rien n'est rendu côté serveur (évite tout écart d'hydratation), premier affichage différé au tick suivant plutôt qu'un `setState` synchrone dans l'effet.

Partage : `ShareLinkPanel` déplacé de l'accueil du monde vers un nouvel encart du menu de réglages. `SettingsMenu` est rendu globalement (`app/layout.tsx`, hors contexte serveur de monde) : le monde courant se détecte côté client depuis l'URL (`usePathname`), et les liens sont récupérés par un fetch vers la nouvelle route `/api/worlds/[worldSlug]/share-links` plutôt que par props serveur — l'encart n'apparaît que dans un contexte de monde, absent sur l'accueil global. `ShareLinkPanel` refactorisé pour exposer un `onMutated` (resynchronise la copie du parent après création/révocation, puisque la revalidation de page d'origine ne s'applique plus à un état récupéré côté client).

Accueil du monde : « Nouvelles aventures » sous le nom, puis la liste des personnages joueurs (nom, espèce, classe, niveau) via un nouveau service `listWorldPlayerCharacters` — parcourt toutes les campagnes du monde, ne garde que les `campaign_characters.is_pc = true`, résout chaque personnage avec le ruleset de **sa propre** campagne (des campagnes du même monde peuvent épingler des variantes différentes). Étiquette PJ/PNJ dans `CampaignDetail.tsx` corrigée au passage : elle venait par erreur de la présence d'un `user_id` plutôt que de `is_pc` — deux concepts distincts (un PNJ contrôlé par le MJ peut très bien ne pas avoir de `user_id` sans être un PJ pour autant, et l'inverse).

Mot de passe sur un lien de partage : colonnes `password_hash`/`password_attempts` sur `share_links` (migration `20260809210001`), hachage **scrypt salé côté application** (`src/core/shareLinks/password.ts`, `node:crypto`, natif — un simple SHA-256 comme pour le jeton n'aurait pas suffi, un mot de passe humain est une entrée bien plus faible qu'un jeton aléatoire de 256 bits). `resolve_share_link` étendue pour renvoyer `password_hash`/`password_attempts` (jamais transmis au client — `ShareLinkSummary`, le type exposé, ne porte qu'un booléen `hasPassword`), nouvelle fonction `record_share_link_password_attempt` (incrémente sur échec, remet à zéro sur réussite, plafond de 10 tentatives). Les deux pages publiques (`app/partage/[token]/**`) s'arrêtent avant tout appel à `listPublicEntities`/`getPublicEntityDetail` tant qu'un cookie de vérification (httpOnly, scopé au chemin exact `/partage/<token>`) n'est pas posé — jamais de contenu chargé puis masqué.

`gender`/`pronouns` ajoutés au bloc `character` (`.optional()`, jamais `.default()` — les blocs antérieurs à ce ticket n'ont ni l'un ni l'autre, `.strict()` doit continuer à les valider tels quels). `gender` est soit une des quatre valeurs énumérées (`feminine`/`masculine`/`neutral`/`unspecified`), soit `{ custom: string }`. Éditeur : menu déroulant à cinq entrées (les quatre valeurs + « Personnalisé », qui révèle un champ texte) et un champ pronoms libre, dans `CharacterBlockEditor.tsx`.

Règles de rédaction inclusive documentées en tête de `src/i18n/fr.ts` (forme épicène en premier choix, doublet complet en repli, jamais de point médian — raison d'accessibilité, pas de posture). Vérifié par recherche exhaustive (`grep "·"`) qu'aucun point médian n'existe déjà dans le code ou les catalogues de traduction — les quelques « · » trouvés sont des séparateurs visuels neutres entre informations distinctes (« Nain · Guerrier 1 »), pas des marques de genre, donc hors sujet et non touchés.

Décisions de périmètre :
- **CLI Supabase relinkée en cours de route.** Elle était restée pointée sur l'ancien projet `myluqabtqewpqkvokube` (aujourd'hui supprimé) depuis une investigation de sécurité interrompue plus tôt dans la session — relinkée sur `fivakjqzqgfvfpaqvqex` avant toute migration de ce ticket, sans quoi la migration du mot de passe aurait pu échouer silencieusement contre le mauvais projet.
- **La conversion `password → hash` reste côté application, jamais en SQL.** `scrypt` n'existe pas nativement dans pgcrypto (qui offre `crypt()`/blowfish, pas scrypt) — la fonction `security definer` ne fait que stocker/comparer des hachages déjà calculés, jamais de calcul cryptographique en base.

**Complément post-critères** — sur retour utilisateur : le bloc `character` avait toujours un formulaire brut (`CharacterBlockEditor.tsx`) sous la fiche jouable pour éditer espèce/classes/caractéristiques/genre/pronoms, une duplication qui restait visible même une fois le panneau de stats fusionné. L'onglet Traits de `PlayableCharacterSheet.tsx` édite désormais le build en entier (même style que le reste de la fiche, mêmes champs que l'ancien formulaire), et `CharacterBlockEditor.tsx` est supprimé — même principe que « même bloc, deux vues » déjà appliqué à l'Inventaire (V1-B5 §5.1). Le bouton replier/déplier disparaît aussi pour ce type de bloc : il n'y a plus rien en dessous à masquer.

**Complément post-critères (2)** — l'utilisateur a fourni des captures d'écran d'une fiche de référence (structure façon D&D Beyond) pour inspirer l'organisation de la nôtre, en gardant notre propre DA. L'écart structurel le plus net : ni les jets de sauvegarde ni les compétences n'étaient affichés nulle part, alors que `characterSheet()` les calcule déjà entièrement (`sheet.savingThrows`, `sheet.skills`). Ajout pur d'affichage dans l'onglet Traits, aucun calcul nouveau : une pastille de maîtrise (pleine si maîtrisé) et le bonus signé sous chaque caractéristique, puis une liste des 18 compétences triée alphabétiquement (pastille pleine = expertise, pastille à moitié pleine = maîtrisée, pastille creuse = aucune ; caractéristique gouvernante ; bonus). Libellés français ajoutés dans `SKILL_LABELS_FR` (`src/i18n/fr.ts`, même patron que `RELATION_LABELS_FR`, traductions officielles reprises de `data/srd/fr-source`). Délibérément **pas** de section « Maîtrises » (armures/armes/outils/langues) : le moteur ne modélise encore aucune de ces proficiences (limite déjà actée en V1-B5, « Maîtrise d'arme toujours supposée ») — les ajouter aurait inventé des valeurs plutôt que d'afficher du réel.

**Complément post-critères (3)** — sur retour utilisateur, opinion demandée avant tout code sur un point d'interaction : **pas de bouton « Éditer » façon fiche de référence.** Toute l'app édite en place avec sauvegarde automatique (titre d'entité, blocs, inventaire) — un mode édition dédié aurait introduit une deuxième façon d'interagir, incohérente avec le reste ; confirmé par l'utilisateur, qui préférait lui-même l'édition permanente. Décisions retenues, toutes en affichage/UI, aucun nouveau calcul :
- **Espèce/Historique/Genre/Pronoms remontent dans l'en-tête** du bloc `character` (à gauche des boutons Repos court/long/Exporter), champs compacts toujours éditables ; retirés de l'onglet Traits (doublon supprimé). Classes/Caractéristiques/Compétences/méthode de PV restent dans Traits — jamais dupliqués ailleurs.
- **« Choix restants » fusionné dans la liste Compétences** : les pastilles des compétences éligibles à un choix de classe non résolu (ex. les 6 options du choix « Magicien — compétences ») deviennent des boutons cliquables (bordure claire `border-ink` = choisissable, remplie = choisie, atténuée = choix déjà complet) — un seul point d'interaction au lieu de deux UI qui listaient les mêmes compétences. Toutes les options connues aujourd'hui sont des clés de compétence (`extractSkillChoices`, seule source de `remainingChoices` côté serveur) ; une future nature de choix non-compétence resterait simplement invisible ici.
- **Exporter JSON/PDF fusionnés** en un seul bouton « Exporter » (menu, réutilise `ActionsMenu` — étendu avec des props `label`/`triggerClassName` optionnelles, rétrocompatible avec son unique autre usage).
- **PV/XP peu réactifs** : `changeHp`/`changeXp` faisaient un aller-retour POST puis un second GET (`reloadRemote`) avant que le nombre affiché ne bouge. Mise à jour optimiste locale (même clampage à 0 minimum que le serveur) avant l'appel réseau — le serveur reste la vérité, `reloadRemote()` corrige ensuite si besoin.
- **XP décrémentable** : bouton « −100 » ajouté à côté de « +100 ». A révélé un vrai bug bloquant en testant dans le navigateur : `xpChangeSchema` (`lib/characterActions/schemas.ts`) exigeait `delta` positif (`z.number().int().positive()`), rejetant toute correction à la baisse en 400 — assoupli à `z.number().int()` comme `hpChangeSchema`, le clampage à 0 restant côté serveur (`changeXp`). Corrigé au passage : la note d'historique `session_event` codait `"XP +${delta}"` en dur, ce qui aurait affiché « XP +-100 » pour un delta négatif — désormais `${delta >= 0 ? "+" : ""}${delta}`, même format que la note PV.
- **Perception passive sur deux lignes** (« Perception » / « passive ») pour réduire la largeur prise dans la rangée de stats.

**Complément post-critères (4)** — sur retour utilisateur, avec captures d'écran d'une fiche de référence (structure façon D&D Beyond) : réorganisation complète de la mise en page de `PlayableCharacterSheet.tsx`, en confirmant d'abord un point structurant avant de coder (multiclassage — voir ci-dessous). **Supersede la note du complément (3)** sur l'emplacement de Classes/Caractéristiques/Compétences : elles ne vivent plus dans l'onglet Traits.
- **Colonne gauche persistante** (Caractéristiques + Compétences), visible quel que soit l'onglet actif, à côté d'une fenêtre à onglets (Actions/Magie/Inventaire/Traits) — au lieu d'un bloc qui remplaçait tout son contenu par onglet. Empile en une colonne sous `md` (`flex-col md:flex-row`) pour préserver la lisibilité à 375px, critère déjà acquis en V1-B5. L'onglet Traits ne porte plus que « Aptitudes accordées » (Classes/Caractéristiques/Compétences remontées ailleurs, Objets retiré — doublon pur de l'onglet Inventaire).
- **Classes remontées entièrement dans l'en-tête**, décision confirmée par l'utilisateur face à deux options possibles (tout dans l'en-tête vs. classe principale dans l'en-tête + multiclassage dans Traits) : chaque classe est une pastille compacte (classe + niveau + sous-classe) à côté d'Espèce/Historique/Genre/Pronoms, avec un « + » pour en ajouter une. L'onglet Traits perd sa section Classes — plus aucun doublon.
- **`CompactRuleField`** (nouveau composant local) : fusionne le champ éditable et le renvoi vers la fiche de règle en un seul élément au lieu d'un champ + une pastille séparée (couleur `--link-rule` reprise de `RuleChip` — même sens, pas une couleur inventée). Remplace l'ancien tandem `RuleEntryAutocomplete` + `ReferenceChipDisplay` pour Espèce/Historique/Classe/Sous-classe.
- **CA en badge bouclier** (`clip-path` hexagonal, pas de nouvelle couleur), **Initiative/Vitesse/Perception passive/Maîtrise/Épuisement en badges carrés** (nouveau composant local `StatBadge`) — se distinguent par forme et libellé, jamais par couleur : `specs/coquille-et-design.md` §2 interdit toute couleur codée en dur hors de `tokens.css`, donc pas de palette arc-en-ciel par statistique comme sur la référence.
- **Jauge de PV qui se remplit/vide** (barre de progression, passe au jeton `--danger` sous 25 % des PV max) et **barre d'XP** avec un vrai pourcentage de remplissage — calculé contre les seuils de PX cumulés officiels de la 5e (`XP_LEVEL_THRESHOLDS`, identiques SRD 2014/2024, niveau total = somme des niveaux de classe). Uniquement pour l'affichage de la barre ; aucune montée de niveau automatisée à partir de ces seuils.
- **Champ XP + boutons** remplace les anciens boutons à montant fixe (+100/−100) : on tape un montant, « + » l'ajoute et vide le champ, « − » le retranche (toujours clampé à 0 côté serveur) et vide le champ — répond à « je peux me tromper », sans perdre le montant tapé entre deux corrections.

**Complément post-critères (5)** — passe de polish/alignement sur retour utilisateur (avec capture d'écran de référence pour le style des cartes de caractéristiques), pur CSS/réagencement, aucun nouveau calcul :
- **`CompactRuleField` affiche désormais le nom résolu** (« Tieffelin », « Magicien »…) au lieu d'une simple icône « ↗ » — la traduction fonctionnait déjà côté serveur (`getLocale()` + `listTranslationsForEntries`), mais rester sur une icône nue cachait le nom français derrière un survol. Tronqué à 6rem avec le nom complet en `title`.
- **Ligne d'identité réordonnée** : Espèce, Historique, Genre, Pronoms, puis Classes tout à droite (était Espèce/Historique/Classes/Genre/Pronoms). Alignement passé de `items-end` à `items-start`, et le cadre bordé autour de chaque groupe de classe supprimé (remplacé par un simple séparateur `border-l` entre classes en cas de multiclassage) — c'est ce cadre qui décalait verticalement le libellé « Classes » par rapport aux autres, en ajoutant un padding que les autres champs n'avaient pas. Vérifié par mesure DOM : les 5 libellés et les 5 centres de champ sont maintenant à moins de 2px l'un de l'autre.
- **`StatBadge` restructuré** : libellé au-dessus d'un encadré de hauteur fixe (`h-14`, même structure que le bouclier de CA) au lieu d'un libellé dans l'encadré — l'ancienne version donnait une hauteur d'encadré variable selon que « Perception passive » tenait sur une ou deux lignes. Les 5 badges (CA compris) mesurent maintenant exactement 84px de haut, vérifié par mesure DOM.
- **PV avec champ + boutons**, même motif que l'XP (barre, champ, « + », « − », tous à droite) au lieu de boutons ±1 aux deux extrémités.
- **Suppression du sélecteur de méthode d'attribution** (« Tableau standard »/« Achat de points »/« Tirage ») — la donnée `abilities.method` reste dans le bloc (toujours utile pour, par exemple, un futur assistant de création), seul le contrôle disparaît de la fiche jouable.
- **Cartes de caractéristiques restylées** sur le modèle fourni par l'utilisateur : libellé en `--accent` (dans la palette existante, pas une couleur inventée), modificateur en grand, score toujours éditable mais affiché petit dans une pastille, bonus de sauvegarde en pastille pleine si maîtrisé.
- **Pastilles de compétences réalignées** : la version choix-en-attente (un `<button>` de 16×16px) et la version simple (un `<span>` de 8×8px sans enveloppe) n'avaient pas la même largeur de départ, donc les points ne tombaient pas sur la même colonne. Les deux utilisent maintenant la même enveloppe 16×16px. Vérifié par mesure DOM : les 18 lignes ont leur pastille strictement à la même abscisse.
- **Colonne resserrée** (`md:w-56` → `md:w-48`) une fois le sélecteur de méthode retiré, ajustée pour que « Représentation · CHA · +1 » (la ligne la plus longue) tienne sans repli à la ligne.
- **CA non rendue éditable, contrairement à la demande** — signalé plutôt que silencieusement implémenté ou ignoré : `character.ts` documente explicitement que le bloc `character` ne stocke *jamais* de valeur dérivée (CA, PV, modificateurs...), toujours recalculée par `characterSheet()`. Un champ `ac_override` casserait cette garantie et ouvrirait un écart entre la CA affichée et la CA réellement utilisée par le moteur. Décision et alternative proposées à l'utilisateur en fin de tour plutôt que tranchées seul.

**Complément post-critères (6)** — suite du (5), l'utilisateur a validé l'option « rendre visible pourquoi c'est 10 » pour la CA (survol du bouclier, déjà en place). Reste :
- **Boutons +/− des barres de PV et XP inversés** (« − » puis « + », au lieu de « + » puis « − ») et **un champ vide vaut désormais 1** au lieu de ne rien faire — `applyHpDelta`/`applyXpDelta` traitent une chaîne vide comme `1` plutôt que `0`. Les boutons ne sont plus désactivés quand le champ est vide (avant : `disabled={busy || !xpDelta}`, qui empêchait justement d'utiliser le raccourci « vide = 1 »).
- **Nouveau badge Épuisement**, toujours visible (avant : caché si 0), avec ses propres boutons − et + en pastille pleine, valeur au centre, clampée à [0, 6] comme `zRuntimeState.exhaustion` — sur le modèle de la capture d'écran fournie. A fallu écrire toute la plomberie manquante côté serveur : `changeExhaustion` (`characterActions.ts`, même patron que `changeXp`), `exhaustionChangeSchema` (`lib/characterActions/schemas.ts`), route `app/api/entities/[id]/actions/exhaustion/route.ts` — rien de tout cela n'existait, seul le décrément automatique au repos long touchait `exhaustion` jusqu'ici.
- **L'ajustement dynamique des règles d'épuisement (vitesse/initiative/perception/compétences) n'est pas fait** — demandé par l'utilisateur, mais c'est très exactement le chantier déjà mis de côté à la fin de V1-B5 (« L'épuisement ne modifie pas encore la vitesse affichée [...] aucune conversion de ce type n'existe nulle part dans le code [...] chantier séparé, suivi comme tâche de fond »). Deux éditions SRD ont des tables d'épuisement différentes (2014 : désavantage aux tests de caractéristique dès le niveau 1, vitesse divisée par deux au niveau 2, etc. ; 2024 : pénalité uniforme -1 par niveau aux jets de d20 et à la vitesse). Construire cette conversion est un vrai morceau de `src/core/rules` (tests d'abord, comme toujours pour ce dossier), pas une retouche visuelle — non fait dans ce tour, à cadrer comme ticket à part si l'utilisateur veut l'attaquer maintenant.
- **Champs d'édition des caractéristiques sans flèches de spinner** (`[appearance:textfield]` + masquage des boutons natifs Chrome) — `text-align: center` était déjà correct, mais les flèches natives du `<input type="number">` mangent l'espace à droite et donnent une impression de texte décalé à gauche.

**Complément post-critères (7)** — **annule et remplace la note ci-dessus sur les champs texte+suggestions.** Contre-argument de l'utilisateur, vérifié et retenu : §B5 (`specs/wiki-liens-et-personnages.md`) parle des *prérequis de personnage* (« avertir, ne pas interdire » = un personnage illégal reste enregistrable), pas de l'existence d'une clé de référence — l'invoquer pour justifier une clé espèce/classe qui ne résout jamais était une extension par analogie, pas une vraie contrainte du projet. Et le raisonnement produit tient : un MJ qui invente une race crée d'abord sa fiche de règle, qui apparaît alors dans la liste — accepter une clé qui ne matche jamais rien n'apporte aucune valeur réelle pour ces quatre champs précis.
- **Espèce/Historique/Classe/Sous-classe convertis en listes déroulantes** (nouveau composant `RuleSelect`, remplace `CompactRuleField`), tirées de `useWorldRuleEntries` filtré par `entryType`, triées par nom traduit. Le bouton affiche directement le nom résolu (« Tieffelin ▾ ») — plus besoin d'un champ texte séparé, gain de place réel par rapport à la version précédente. Petit lien « ↗ » conservé à côté pour aller à la fiche de règle. Une valeur déjà enregistrée qui ne correspond plus à rien (rare, ruleset changé) s'affiche encore via le repli `current?.label ?? value` de `<Dropdown>` — pas de perte de données silencieuse.
- `RuleEntryAutocomplete` n'est pas supprimé du projet — il reste utilisé par l'inventaire (V1-B5, sélecteur d'objets mêlant règles et entités) et les sorts connus, où une recherche texte dans une liste beaucoup plus longue et hétérogène a plus de sens qu'un menu déroulant.

**Complément post-critères (8)** — suite du retour utilisateur sur l'intégration des onglets (« certains boutons ne fonctionnent pas »). Deux vrais bugs bloquants trouvés en creusant, plus deux ajustements demandés :
- **Badge « Dés de vie »** ajouté entre Maîtrise et Épuisement, valeur dynamique (`sheet.hitPoints.hitDice`, déjà calculée par `computeHitPoints` — ex. « 3d10 », ou « 1d6 + 2d8 » en multiclassage), aucun nouveau calcul nécessaire.
- **Sous-classes filtrées par classe principale** : `RuleEntrySummary` gagne un champ `parentClassKey` (nouveau, `src/server/services/rules.ts`), lu depuis `source_raw.class.index` — forme SRD vérifiée en base pour toutes les entrées `entry_type = "subclass"`. `RuleSelect` gagne un prop `filterFn` optionnel ; le sélecteur de sous-classe filtre sur `parentClassKey === classKey` et se réinitialise à `null` quand la classe change (plus de sous-classe orpheline d'une autre classe affichée).
- **Bug racine de « Ajouter un objet » qui ne faisait rien** : deux causes distinctes. (1) `updateInventory` (`EntityBlocks.tsx`) ne faisait rien si l'entité n'avait pas encore de bloc `inventory` — bootstrap ajouté (`createBlockWithData`, crée le bloc puis le patch en un aller simple, sans passer par `saveBlock` à cause d'un risque de fermeture obsolète sur un bloc tout juste créé). (2) même une fois le bloc créé, `InventoryBlockEditor.newItem()` posait `label: ""`, qui échoue `zInventoryItem` (`z.string().min(1)`) côté serveur en 400 — corrigé en `"Nouvel objet"`.
- **Bug systémique découvert en creusant (1)/(2) : échec d'enregistrement totalement silencieux.** `doSaveBlock` avait `if (!res.ok) return;` — un 400 (ou toute autre erreur hors 409) ne laissait aucune trace dans l'interface, exactement ce qui rendait le bug (2) indétectable pour l'utilisateur. Ajout d'un état `saveErrorIds` et d'un message inline (« Cette modification n'a pas pu être enregistrée [...] »), même patron que le message de conflit 409 déjà existant.
- **Doublon d'affichage du bloc Inventaire** : une fois créé, il s'affichait à la fois dans l'onglet Inventaire de la fiche jouable (sa vraie surface d'édition) et comme carte brute séparée en dessous — le masquage déjà en place pour le bloc `character` (V1-C4) n'avait jamais été étendu à `inventory`. Corrigé de la même façon : bouton de repli masqué et éditeur brut remplacé par une simple note de renvoi pour `block.blockType === "inventory"`.
- Vérifié en navigateur : ajout d'objet fonctionne et persiste (PATCH 200), plus de carte dupliquée, badge Dés de vie correct, sous-classe filtrée (Guerrier → seulement les sous-classes de guerrier).
- **Non traité dans ce tour**, demandé dans le même message mais hors périmètre d'un correctif — à cadrer séparément : refonte complète de l'onglet Actions (attaques + sorts, gestion des emplacements de sorts multi-niveaux), flux Magie (sorts connus triés → sélection « préparé » → apparition dans Actions), vérification/complétion de l'équipement (arme/armure « équipée » → CA et Actions), et refonte de l'onglet Traits (dons/maîtrises/langues par type, chacun avec sa source et sa description liée dynamiquement à la fiche de règle). Ce dernier point demande de la modélisation `src/core` qui n'existe pas encore (maîtrises d'armes/outils/langues absentes de `srdMapping.ts`).

**Complément post-critères (9)** — demande utilisateur : une barre de charge (poids porté / capacité) en haut de l'onglet Inventaire, dynamique selon les objets et leurs fiches de règle. Deux points d'ambiguïté réelle tranchés avec l'utilisateur avant de coder (`AskUserQuestion`) plutôt que devinés : effets mécaniques inclus (pas seulement informationnel), et formule 2014 réutilisée pour 2024 en l'absence de texte de règle 2024 importé pour ce sujet.
- **`parseItemWeight`** (`srdMapping.ts`) : lit `fields.weight` (livres), champ confirmé présent et identique en forme sur les entrées `Equipment` des deux éditions (arme, armure, objet).
- **`src/core/rules/encumbrance.ts`** (nouveau module, tests d'abord) : `computeEncumbrance(strScore, carried)` applique la variante d'encombrement du SRD 2014 (seule édition dont le texte de règle est importé — `Rule-Sections["using-each-ability"]`) : capacité = FOR × 15, encombré au-delà de FOR × 5 (vitesse −10), lourdement encombré au-delà de FOR × 10 (vitesse −20, désavantage FOR/DEX/CON). `encumbranceModifiers()` traduit le résultat en `Modifier[]` (couche 6, même couche que l'armure). `totalCarriedWeight()` somme le poids des objets (référence de règle résolue, ou poids en ligne pour un objet sans référence) × quantité.
- **`characterSheet()` étend sa signature** avec un 5e paramètre optionnel `carriedWeight = 0` — aucun appelant existant modifié n'était nécessaire pour les tests déjà en place (0 = aucun effet, comportement identique). Calcule `sheet.encumbrance` juste après la résolution des caractéristiques (dépend du score de Force final) et injecte ses modificateurs avant `savingThrows`/`skills`/`speed` — la vitesse affichée et le `rollState` des jets FOR/DEX/CON reflètent donc automatiquement l'encombrement, sans code UI supplémentaire.
- **Plomberie serveur et client** : `resolveEquipmentWeight` (nouveau, même patron que `resolveEquipmentArmorData`/`resolveEquipmentWeaponData`) résolu en parallèle dans `resolveCharacterActionContext` (serveur, actions de jeu) et dans la route `/api/worlds/[worldSlug]/resolved-ruleset` (client, aperçu vivant) — `ResolvedRulesetView.weight` s'ajoute à `equipment`, même mécanisme.
- **Barre de charge** en haut de l'onglet Inventaire : `sheet.encumbrance.carried`/`capacity` en livres, libellé du palier si encombré, couleur `--danger` sous encombrement (sinon `--accent`) — même motif binaire que la barre de PV, pas de couleur inventée.
- **Non compté : le poids des pièces.** Le SRD documente un poids par pièce (2014 : 50 pièces = 1 lb), mais cette règle n'a pas été vérifiée pour 2024 dans les données importées — plutôt que d'inventer un nombre, laissé de côté et signalé ici plutôt que fait silencieusement. Un objet en ligne sans poids renseigné compte pour 0, jamais une estimation.
- Vérifié en navigateur : dague (1 lb) → 1/210 lb affiché (FOR 14 → capacité 210). Quantité montée à 150 → barre rouge « 150/210 LB · LOURDEMENT ENCOMBRÉ (VITESSE −20, DÉSAVANTAGE FOR/DEX/CON) », badge Vitesse passé de 30 m à 10 m automatiquement. Revert propre vérifié (PATCH confirmé, plus aucune trace du test).

### V1-C5 — Sélection et gestion du ruleset actif · `M` — fait

Vérifié dans le reste du backlog avant d'ouvrir ce ticket : **pas déjà prévu ailleurs**. V1-C1 avait explicitement écarté le sujet (« Choisir une variante à la création est un ajout UI distinct, pas un changement de forme de données »), et V1-D2 (éditeur de règle assisté par IA) ne couvre que la création de contenu à l'intérieur d'une variante déjà choisie, pas le choix de la variante elle-même. La mécanique de fond existe déjà et n'a pas besoin d'être retouchée : `rulesets.is_official_base`/`parent_ruleset_id`, la chaîne de surcharge (V1-A4), et `worlds.default_ruleset_id` — cette dernière colonne existe en base mais n'avait **aucun point d'écriture applicatif** (grep fait : seul un test d'intégration l'écrivait directement en `service_role`). Il ne manquait que l'écran.

**Deux corrections trouvées en creusant, avant d'écrire le code** :
- Le « badge officiel/variante déjà utilisé ailleurs » cité au départ n'existe pas — `ModifiedBlockBadge.tsx` (V1-A4) porte un badge « modifiée dans ta variante » par *entrée*, pas un badge officiel/variante au niveau *ruleset*. Nouveau badge simple (2 lignes de JSX, jetons `--gm`/`--link-rule` déjà existants).
- « Créer une variante réutilise `upsert_ruleset_override`/`publish_ruleset` » était inexact : ces deux fonctions Postgres éditent/publient des entrées *à l'intérieur* d'une variante déjà créée (V1-D2, pas encore construit) — elles n'ont jamais servi à la création elle-même, qui n'est qu'un `insert` simple dans `rulesets` (RLS `rulesets_write` l'autorise déjà : `created_by = auth.uid()`). Confirmé contre `rulesetVersioning.integration.test.ts`, qui crée sa variante de test exactement ainsi.

- [x] Bouton « Règles actives » en bas de la barre latérale des règles (même emplacement que « + Nouvelle entité » côté monde, `components/shell/Sidebar.tsx`) ouvre `RulesetSelector.tsx` — même patron d'overlay que `ConfirmDialog.tsx` (portail + scrim + `z-[1100]`).
- [x] Le sélecteur liste les rulesets officiels (2014, 2024) et les variantes créées par l'utilisateur courant (`listSelectableRulesets`, filtre explicite `is_official_base OR created_by = utilisateur` — plus précis que la seule RLS, qui laisserait aussi passer une variante d'un monde dont l'utilisateur n'est que membre).
- [x] Choisir une entrée met à jour `worlds.default_ruleset_id` (`setActiveRuleset`/`setWorldDefaultRuleset`, nouvelle route `PATCH /api/worlds/[worldSlug]/ruleset` — 403 explicite si l'appelant n'est pas propriétaire du monde, plutôt que de laisser la RLS échouer en silence sur 0 ligne).
- [x] Depuis cet écran, créer une nouvelle variante à partir d'un ruleset officiel (`POST` même route, `createRulesetVariant` — insertion vierge, aucune surcharge : la chaîne de résolution déjà existante fait remonter chaque entrée jusqu'à l'officiel tant que rien ne la surcharge, un MJ peut donc l'utiliser dès sa création).
- [x] Le changement est reflété immédiatement dans la sidebar de règles (`router.refresh()`, même patron que `EntityHistoryPanel.tsx`) — pour la fiche jouable, aucune plomberie supplémentaire n'était nécessaire : elle relit déjà `worlds.default_ruleset_id` à chaque appel API, donc reste exacte dès le prochain chargement/interaction, y compris dans une autre fenêtre.
- Vérifié en navigateur : bascule 2014 → 2024 (contenu de la sidebar change réellement, ex. historiques Criminel/Sage/Soldat apparaissent), création d'une variante « Ma variante maison » à partir de 2014 (auto-sélectionnée, résout correctement à travers la chaîne jusqu'à son parent puisqu'elle n'a encore aucune surcharge), retour à l'officiel 2014.

*Hors périmètre de ce ticket, noté ici pour ne pas l'oublier : **téléverser un fichier de règles entièrement custom** (JSON ou autre format à définir). Aucun pipeline n'existe pour ça aujourd'hui — seul le script d'import SRD existe, taillé sur mesure pour `data/srd/*.json`. Accepter un fichier arbitraire demande de définir un format, le valider, et le transformer en `ruleset_entries`/blocs : un vrai chantier de conception à part, pas une extension de ce ticket. En attendant, un MJ peut déjà construire ses propres règles à la main, entrée par entrée, via le système de variante existant.*

**Complément post-critères (1)** — demande utilisateur : bouton de suppression pour les rulesets autres que les deux officiels.
- [x] Bouton « × » à côté de chaque variante dans `RulesetSelector.tsx` (jamais sur un officiel — `is_official_base` filtré côté UI en plus de la RLS, qui l'interdirait de toute façon puisqu'un officiel n'a pas de `created_by`). Confirmation via `ConfirmDialog.tsx` (danger, irréversible).
- [x] Nouvelle route `DELETE /api/rulesets/[rulesetId]` (`deleteRulesetVariant`/`deleteRuleset`) : trois issues distinctes, jamais une erreur 500 pour les deux dernières qui sont des refus attendus — `not_found` (RLS a bloqué en silence : n'existe pas, officiel, ou appartient à quelqu'un d'autre) → 404 ; `in_use` (violation de clé étrangère 23503 — `worlds.default_ruleset_id`, `campaigns.ruleset_id`, ou `parent_ruleset_id` d'une autre variante pointent encore dessus, aucune n'a de `on delete cascade`) → 409, message clair plutôt qu'une erreur Postgres brute.
- Pas de vérification préalable de chacune des trois références possibles avant de tenter la suppression : la contrainte de clé étrangère fait déjà ce travail de manière atomique, le dupliquer côté application ouvrirait une fenêtre de course (vérifié → plus vrai → supprimé quand même).
- Vérifié en navigateur : tentative de suppression d'une variante active → 409, message affiché, rien de supprimé. Bascule vers l'officiel puis nouvelle tentative → succès, la variante disparaît de la liste.

### V1-C6 — Actions, Magie et Traits : intégration complète de la fiche jouable · `L`

Demande utilisateur (suite V1-B5/V1-C4) : les 4 onglets doivent être pleinement fonctionnels, pas seulement structurés. Investigation faite avant d'écrire les critères — une partie est déjà en place, à ne pas refaire :

**Déjà fait, à ne pas retoucher :**
- Attaques d'armes équipées dans l'onglet Actions (`equippedWeapons`, boutons Attaquer/Dégâts/Dégâts à deux mains) — filtré sur `item.equipped`, donc « équiper » une arme l'y fait déjà apparaître.
- CA déjà recalculée dynamiquement à l'équipement d'une armure (`armorAcModifier`, couche 6).
- Emplacements de sorts multi-niveaux : chaque sort connu affiche déjà un bouton de lancer par niveau d'emplacement disponible (`sheet.spellcasting.slots`) — c'est le point le plus redouté de la demande initiale, et il était déjà couvert par V1-B5.
- Le champ `prepared: string[]` existe déjà dans `zSpellcastingBlockData` et `SpellcastingBlockEditor.tsx` (carte brute du bloc) le gère déjà avec une case à cocher — seule la fiche jouable ne l'exploite pas encore.
- Inventaire : armes/armures/objets/pièces déjà tous listés et éditables (`InventoryBlockEditor`), le bug qui bloquait « ajouter un objet » et « ajouter des pièces » est corrigé (complément post-critères 8).

**A. Magie ↔ Actions (`M`, pas de changement de schéma) — fait.**
- [x] Onglet Magie : sorts connus triés par niveau puis ordre alphabétique — `parseSpellLevel(fields)` (`srdMapping.ts`, même forme que `parseItemWeight`), résolu en lot via un nouveau `resolveSpellLevels` (service, même patron que `resolveEquipmentWeight`), transporté par `useResolvedRuleset` (`spellKeys`/`spellLevels`, `resolveRulesetSchema` étendu).
- [x] Onglet Magie : case à cocher « Préparé » par sort connu (réutilise `data.prepared`) à la place du bouton de lancer direct — nouveau prop `onUpdateSpellcasting` sur `PlayableCharacterSheet`, câblé dans `EntityBlocks.tsx` (`updateSpellcasting`, même bootstrap-si-bloc-absent que `updateInventory`).
- [x] Onglet Actions : nouvelle section « Sorts préparés », les sorts dont la clé est dans `spellcasting.prepared` y apparaissent avec le même bouton de lancer par niveau d'emplacement (déplacé de l'ancien rendu Magie, pas dupliqué).
- Vérifié en navigateur (multiclasse Guerrier/Magicien temporaire, revert propre après test) : Armure du mage (niv. 1), Projectile magique (niv. 1), Boule de feu (niv. 3) triés correctement ; cocher « Préparé » sur Boule de feu la fait apparaître dans Actions avec son bouton de lancer niv. 1 (0/2).
- Non traité, comme annoncé : sorts « toujours préparés » (rituels innés) — aucune notion de ce type dans le moteur aujourd'hui, pas un besoin concret observé.

**B. Traits par type : dons, maîtrises, langues (`L`, nouveau travail `src/core`, tests d'abord) — maîtrises et langues fixes faites, dons hors périmètre (voir plus bas).**

Vérifié contre `data/srd/srd-2014.json` et `srd-2024.json` avant d'écrire ces critères — trois natures de données différentes, trois traitements différents :

- [x] **Maîtrises d'armure/arme/outil** : `mapProficiencies(fields)` (`srdMapping.ts`) lit `fields.proficiencies ?? fields.starting_proficiencies` (classe et historique, même champ que `mapBackgroundModifiers`), exclut `skill-*` (déjà couvert) et `saving-throw-*` (déjà couvert par `mapClassCore`).
- [x] **Langues** : `extractLanguages(fields)` lit `fields.languages` (espèce).
- [x] Assemblage : `assembleResolvedRuleset` (service) agrège ces deux listes pour espèce/historique/chaque classe, avec la source (nom traduit déjà résolu) — nouveau type `TraitGrant { key, name, source }`, transporté par `useResolvedRuleset` (`proficiencies`/`languages`) jusqu'à l'onglet Traits.
- [x] Affichage : un badge par élément (maîtrise ou langue), nom + source en survol/petit texte à côté — **pas de lien vers une fiche de règle dédiée pour ces deux catégories**, décision confirmée par la vérification SRD (aucun texte descriptif sur `Languages`/`Proficiencies`, un lien mènerait vers une page quasi vide).
- [ ] **Dons** — **non affichables dans ce ticket**, signalé plutôt que fait à moitié : le SRD `Feats` a bien un texte descriptif complet (contrairement aux deux catégories ci-dessus, donc *ceux-là* méritent un vrai lien vers une fiche de règle), mais **aucun mécanisme n'existe pour qu'un personnage se voie accorder un don** — pas de choix de don à la création de niveau, `character.choices`/`featureKeys` ne référencent jamais d'entrée `feat`. Afficher une liste vide en permanence n'apporterait rien. Un futur ticket doit d'abord construire le choix de don (probablement à la création de personnage, V1-B4) avant que cet onglet ait quoi que ce soit à lister.
- [ ] **Langues choisies par l'historique** (ex. Acolyte : 2 langues au choix) — **non traité ici** : `background.language_options` est une structure de choix (« 2 parmi toutes »), pas une liste fixe, donc un vrai flux de sélection serait nécessaire (même famille que les choix de compétences existants), pas un simple affichage. Seules les langues **fixes** (accordées sans choix, ex. espèce) sont dans le périmètre de ce ticket.
- [x] Traits déjà accordés (aptitudes de classe) : aucun changement, `classFeatures` continue de fonctionner comme avant — les deux nouvelles catégories s'ajoutent à côté, ne remplacent rien.
- Vérifié en navigateur (guerrier tieffelin) : Maîtrises = All armor/Shields/Simple Weapons/Martial Weapons (source « Guerrier », jets de sauvegarde bien exclus) ; Langues = Common/Infernal (source « Tieffelin »).

**Hors périmètre, à ne pas faire ici** : choix de don (nécessite une UI de création/montée de niveau, gros morceau à part), choix de langue d'historique (même famille), sorts « toujours préparés » sans notion de préparation existante dans le moteur (magiciens ne préparent pas comme les clercs par ex. — règle 5e réelle non modélisée, à vérifier si ça devient un problème concret plutôt que supposé).

### V1-C7 — Choix de langues d'historique · `M` — fait

Suite de V1-C6 (§B, « Langues choisies par l'historique — non traité ici »).

**Deux corrections trouvées en implémentant, aux hypothèses écrites avant de coder :**
- **« `PlayableCharacterSheet.tsx` gère déjà génériquement les choix restants » était faux, vérifié en lisant le code plutôt que supposé.** La liste de cases à cocher n'existe que pour les compétences (`SORTED_SKILLS.map(...)`, une boucle fixe sur les 18 compétences) — le composant lui-même le documentait : *« si une autre nature de choix apparaît plus tard, elle restera simplement invisible ici »*. Un choix de langue ajouté à `remainingChoices` sans rien d'autre n'aurait eu **aucune interface pour le cocher**, juste un compteur "0/2" sans bouton. Corrigé en ajoutant un discriminant `kind: "skill" | "language"` à `RemainingChoice`, et une deuxième liste de cases à cocher dédiée aux langues (mêmes principes que celle des compétences : jamais un tunnel, persistée dans `character.choices`), placée dans l'onglet Traits à côté des langues fixes plutôt que dans la colonne Caractéristiques/Compétences — plus cohérent : le joueur choisit ses langues là où elles s'affichent ensuite.
- **Importer `Languages` comme `ruleset_entries` était une généralisation prématurée.** En regardant `sheet.ts`, `ABILITIES`/`SKILLS` sont déjà des constantes figées du moteur, pas des données importées — les 16 langues du SRD ont exactement le même statut (vocabulaire de base du système, identique 2014/2024, aucune description associée dans le SRD à afficher sur une fiche dédiée). Ajouter un type d'entrée, une migration, et relancer l'import pour un besoin qui ne sert qu'à peupler une liste de choix aurait été plus de mécanique que ce que le problème demande (CLAUDE.md, « règle des trois ») — surtout que le seul scénario qui en aurait eu besoin (une variante avec des langues maison) n'existe pas encore, faute d'éditeur de règle (V1-D2). `SRD_LANGUAGES` est donc une constante `src/core/rules/srdMapping.ts`, au même titre que `ABILITIES`/`SKILLS`.

**Fait** :
- `SRD_LANGUAGES` (16 langues, `srdMapping.ts`) + `extractLanguageChoice(fields): {count} | null` (tests d'abord) qui lit `background.language_options` — seul le nombre est lu (`{choose: 2, type: "languages", ...}` ne porte jamais de liste fixe, contrairement aux choix de compétences), les options sont toujours `SRD_LANGUAGES` en entier.
- `assembleResolvedRuleset` ajoute ce choix à `remainingChoices` (id `background:acolyte.languages`, `kind: "language"`), même convention que les choix de compétences.
- `LANGUAGE_LABELS_FR` (`src/i18n/fr.ts`), même patron que `SKILL_LABELS_FR` déjà existant.
- Onglet Traits : nouvelle liste de cases à cocher (langues triées par libellé FR) au-dessus des langues déjà accordées — les langues choisies rejoignent la même liste de badges que les langues fixes (V1-C6), avec leur source (« Acolyte ») déduite du libellé du choix.
- Correctif au passage : le résumé « choix restants » de la colonne Compétences listait tous les `remainingChoices` sans filtrer par `kind`, y compris les langues — un texte de compétence (« cliquez les ronds clairs ci-dessous ») se serait affiché pour un choix de langue qui n'a pas de rond dans cette colonne. Filtré sur `kind === "skill"`.
- Vérifié en navigateur (Guerrier Tieffelin, historique Acolyte) : « Acolyte — langues : 0/2 choisie(s) » avec 16 langues cliquables, sélection de Draconique puis Nain fait passer à 2/2, les autres langues se désactivent, les deux apparaissent dans la liste des langues avec la source « Acolyte », désélection propre.

*Hors périmètre, comme prévu : lier une langue choisie à un effet mécanique (aucune langue n'en a dans le SRD) ; les choix de langue d'une classe ou d'un don, s'ils existent, suivent le même mécanisme mais ne sont pas vérifiés ici.*

### V1-C8 — Choix de don · `L` — fait

Suite de V1-C6 (§B, « Dons — non affichables dans ce ticket »).

**Ce que l'investigation des données SRD a changé par rapport au ticket écrit avant de coder :**
- **2024 n'offre pas un *choix* de don, mais un don fixe accordé par l'historique.** Chacun des 4 historiques importés (`Backgrounds.*.feat`, vérifié dans `data/srd/srd-2024.json`) porte exactement un don, jamais une liste : Acolyte → Initié à la magie, Criminel → Alerte, Sage → Initié à la magie, Soldat → Attaquant féroce. Pas de `RemainingChoice` à créer pour ce cas — plus simple que prévu, pas de mécanisme de sélection à construire.
- **2014 n'a aucun champ structuré pour un don, nulle part.** La seule mention est en prose libre dans la description de l'aptitude de classe « Amélioration de caractéristique » (choix +2 caractéristiques *ou* un don, en variante). Sans champ structuré à lire, ce cas reste non implémenté — limite réelle des données SRD 2014, pas un oubli.
- Le mécanisme de choix de V1-C7 (`RemainingChoice`) n'a donc pas été réutilisé : il n'y avait rien à choisir côté données disponibles.

**Fait** :
- `extractBackgroundFeat(fields): string | null` (`srdMapping.ts`, tests d'abord) — lit `background.feat`, retourne la clé de règle du don ou `null` si absent (2014, ou tout historique sans don).
- `mapPrerequisites(sourceRaw): Prerequisite[]` (`srdMapping.ts`) — lit les prérequis structurés déjà présents sur l'entrée `ruleset_entries` du don (`source_raw`, déjà chargé par `listRulesetEntryChipsByKeys`) et les convertit vers le type `Prerequisite` du moteur (`sheet.ts`), déjà testé mais jamais alimenté depuis V1-B1.
- `assembleResolvedRuleset` : le don accordé par l'historique rejoint `extraFeatureKeys` (renommé depuis `classFeatureKeys`, devenu une `Map<clé, source>` plutôt qu'un `Set` car deux natures de source coexistent désormais) et se résout exactement comme une aptitude de classe — `ResolvedFeature` sans modificateur (périmètre informationnel, comme les maîtrises/langues de V1-C6), mais avec `prerequisites` peuplé via `mapPrerequisites`.
- Aucun don n'est affiché ni testé avec un prérequis non satisfait (aucun des 4 dons accordés n'en porte dans les données actuelles) — le branchement est fait et testé unitairement (`mapPrerequisites`), mais `sheet.warnings` déclenché par un don reste à observer en situation réelle le jour où un historique/don avec prérequis non rempli existe en jeu.
- Correctif ciblé, tiré en avance de V1-C9 : le filtre de l'onglet Traits (`PlayableCharacterSheet.tsx`) qui ne gardait que `f.source === "class"` aurait rendu le don invisible (source `"background:acolyte"`). Étendu pour inclure aussi les entrées `f.source.startsWith("background:")` qui ne sont pas l'entrée d'historique elle-même (`f.key !== f.source`, pour ne pas exposer le porteur de modificateurs de l'historique, sans description ni lien utile). Le reste du filtrage plus général (espèce, réaffichage propre par source) reste le travail de V1-C9.
- Vérifié en navigateur (Demi-elfe/Acolyte/Magicien, monde Valdoria) : sur SRD 5.2.1 (2024), « Initié à la magie » apparaît dans « Aptitudes accordées » avec un vrai lien vers `/m/valdoria/regles/magic-initiate` et sa description SRD réelle en infobulle. Basculé le monde sur SRD 5.1 (2014) via `RulesetSelector` (V1-C5) : le don disparaît de la liste, seules les aptitudes de classe restent — confirme la limite documentée ci-dessus.

*Hors périmètre, comme prévu : effets mécaniques réels d'un don ; choix de don en 2014 (aucun champ structuré pour l'implémenter) ; amélioration de caractéristique comme choix concurrent du don (+2 ou don, règle 2014) — non applicable, 2014 n'a pas de choix de don structuré à faire concurrencer.*

### V1-C9 — Onglet Traits : encadrés par élément, sources manquantes · `M` — fait

Relecture du message original de l'utilisateur qui a ouvert V1-C6, point par point, pour vérifier ce qui reste réellement :

> « Dans l'onglet traits j'aimerais qu'il recense tous les traits par type, dons, maîtrises, langues, du personnage. Pour cela il faut qu'il y ait un encadré par élément qui possède le titre du trait, pourquoi le personnage l'a (race, classe, historique, etc.) ainsi que la description du trait dynamiquement liée à la fiche de règle correspondante. »

Maîtrises et langues sont faites (V1-C6), déviation assumée non rouverte ici (pas de lien de fiche de règle, le SRD ne porte aucun texte descriptif dessus). **Les deux points restants, tous deux sur les aptitudes (dons compris depuis V1-C8) :**

1. **Format d'affichage** — remplacé : des pilules en ligne (`<RuleChip>`) vers des encadrés individuels (bordure, `bg-panel-raised`) avec trois champs toujours visibles : titre lié à la fiche de règle, source en haut à droite, description en dessous (`chip.summary`, déjà résolue par `useReferenceChips` mais auparavant cachée en infobulle seulement).
2. **Sources manquantes** — le filtre `f.source === "class"` excluait les traits d'espèce et d'historique (`source: "species:tiefling"`, `source: "background:acolyte"`) de `ruleset.features`. Supprimé : `traits = Object.values(ruleset.features)` affiche maintenant tout, sans filtre.

**Deux ajustements nécessaires, découverts en implémentant, pour que le point 2 (source lisible) tienne réellement :**
- **`source: "class"` était une chaîne littérale identique pour toutes les classes** — insuffisant pour afficher « Guerrier » plutôt qu'un mot générique, et carrément faux en multiclasse (deux classes, une seule étiquette). Changé en `source: "class:<clé>"` (`resolvedRuleset.ts`, même convention que `species:<clé>`/`background:<clé>`) — `ruleset.classes[clé].label` donne alors le nom traduit sans appel supplémentaire.
- **Les bundles espèce/historique portent une clé synthétique** (`species:tiefling`), pas une clé `ruleset_entries` réelle — l'utiliser telle quelle pour résoudre une fiche de règle échouerait toujours. `traitRefKey()` retire le préfixe pour retomber sur la vraie clé (`tiefling`) uniquement quand `f.key === f.source` (le bundle lui-même) ; aptitudes de classe et dons accordés portent déjà leur vraie clé dans `f.key`, inchangés.

**Fait** :
- `traits`, `traitRefKey()`, `traitSourceLabel()` (`PlayableCharacterSheet.tsx`) — plus de filtre par source littérale, résolution de la vraie clé de règle pour les bundles espèce/historique, libellé de source dérivé de `ruleset.features[f.source]?.label` ou `ruleset.classes[...].label` selon le préfixe.
- Encadrés remplaçant les pilules `<RuleChip>` dans l'onglet Traits (import retiré, plus utilisé que là) ; repli inchangé si le renvoi ne résout pas (libellé brut, pas de lien).
- **Limite affichée telle quelle pour ce ticket, corrigée dans sa prémisse en creusant le sujet ai_digest juste après** : les bundles espèce/historique n'ont qu'**une** carte chacun (pas une par trait racial individuel comme « Vision dans le noir » séparément). L'affirmation initiale ici (« le SRD ne découpe pas les traits raciaux en entrées distinctes ») était fausse, vérifiée après coup : `data/srd/*.json` porte bien une catégorie `Traits` à part entière (Darkvision, Fey Ancestry...), déjà importée (`entry_type: "feature"`, `scripts/ingest-srd.ts` `Traits: "feature"`), chacune avec sa vraie description. Ce que le bundle espèce référence (`fields.traits`, un tableau de `{index, name}`) n'est aujourd'hui pas exploité pour afficher ces traits individuellement dans l'onglet Traits — amélioration réelle possible pour un futur ticket, pas traitée ici.
- **Défaut de données révélé par ce ticket, corrigé séparément** : `ai_digest` pour les entrées sans prose SRD (espèce, historique) valait littéralement `"<nom> (<type>) — <nom>"` (`scripts/ingest-srd.ts:557`, repli `digestSource = prose ?? name` quand `prose` est `null`) — invisible tant que `chip.summary` ne s'affichait qu'en infobulle, devenu visible en permanence par ce ticket. Corrigé : `fallbackDigestFacts()` construit un résumé factuel à partir des champs déjà structurés (vitesse, bonus de caractéristique, liste de traits pour une espèce ; maîtrises, don accordé, aptitude d'historique pour un historique) plutôt que de répéter le nom. Import rejoué (`npm run ingest:srd`), vérifié en base pour les deux éditions et en navigateur (ex. « Half-Elf (species) — Speed 30 ft. Ability bonuses: CHA +2. Traits: Darkvision, Fey Ancestry, Skill Versatility. »).
- Vérifié en navigateur (Demi-elfe/Acolyte/Magicien, Valdoria) : bundle « Demi-elfe » (source DEMI-ELFE) et bundle « Acolyte » (source ACOLYTE) apparaissent enfin, aptitudes de classe affichent la vraie source « MAGICIEN » (au lieu de rien avant), don accordé « Initié à la magie » (V1-C8) affiche source « ACOLYTE » avec sa description complète, dans le même format d'encadré que le reste — cohérence visuelle confirmée.

*Hors périmètre, comme prévu : rouvrir la décision maîtrises/langues sans lien ; regroupement visuel par source (sous-titres) — la liste plate actuelle reste lisible avec les données réelles observées, pas de confusion constatée.*

### V1-C10 — Onglet Actions : armes équipées jamais rafraîchies après un changement d'inventaire · `S` — fait

Signalé par l'utilisateur : ajouter/équiper une arme dans l'onglet Inventaire ne la faisait pas apparaître dans l'onglet Actions.

**Cause identifiée** : `equippedWeapons` (`PlayableCharacterSheet.tsx`) filtrait sur `weaponByKey`, lui-même lu depuis `remote.weaponByKey` — un instantané chargé **une seule fois** au montage du composant (`GET /api/entities/[id]/sheet`) et rafraîchi uniquement après une action de jeu (attaque, dégâts, sort, repos — chacune appelle `reloadRemote()`). Un changement d'inventaire seul (ajouter, équiper, déséquiper une arme) ne déclenche jamais ce rafraîchissement : une arme ajoutée après le chargement initial restait invisible dans Actions jusqu'à la prochaine attaque ou au rechargement de la page. Vérifié en reproduisant exactement ce scénario avant de corriger : ajout d'un arc court, équipé, resté absent de l'onglet Actions sans reload.

**Pourquoi les sorts préparés n'avaient pas le même problème, vérifié par lecture de code** : `preparedSpells` ne dépend que de props (`spellcasting.prepared`, `spellcasting.known`) mises à jour de façon optimiste et synchrone par `EntityBlocks.updateSpellcasting` (`patchBlock` appelle `setBlocks` avant même l'appel réseau de sauvegarde) — aucun aller-retour serveur nécessaire pour que l'onglet Actions reflète un sort fraîchement préparé. Seule la donnée d'arme mécanique (dégâts, propriétés) exigeait une résolution serveur, d'où le point de défaillance unique.

**Fait** :
- `resolveEquipmentWeaponData` (déjà utilisée par `/api/entities/[id]/sheet`) branchée aussi sur `/api/worlds/[worldSlug]/resolved-ruleset` — la même route déjà réactive à `equipmentKeys` (armure via `resolveEquipmentArmorData`, poids) porte maintenant aussi les données d'arme.
- `useResolvedRuleset` expose `weaponByKey`, recalculé à chaque changement d'inventaire comme `equipment`/`weight` — plus de dépendance à `remote`.
- `PlayableCharacterSheet.tsx` lit ce `weaponByKey` réactif au lieu de `remote?.weaponByKey ?? {}` ; `SheetApiResponse`/la réponse de `/sheet` ne portent plus ce champ, devenu inutile côté client (`ctx.weaponByKey` reste utilisé en interne par `characterActions.ts` pour l'exécution réelle des attaques — aucun changement là, seule la copie d'affichage disparaît).
- Vérifié en navigateur : arc court ajouté et équipé dans l'onglet Inventaire, apparaît immédiatement dans Actions sans reload ni action de jeu ; déséquipé, disparaît tout aussi immédiatement.

### V1-C11 — Refonte de l'onglet Inventaire · `L` — fait

Demande utilisateur en 5 points : retirer une phrase de bruit, remonter la monnaie sous la barre de charge, encadrés d'objet dans le même langage visuel que l'onglet Traits (propriétés, poids, coût, boutons d'action alignés à droite avec formule résolue en dessous), ajout d'objet par recherche de règle plutôt que le couple menu « Objet en ligne/Référence de règle », bouton Équipé restylé et cartes d'armes équipées reportées dans l'onglet Actions (les armures n'y apparaissent pas — elles ne portent pas de bouton d'action, seulement un effet sur la CA).

**Ce que l'implémentation a demandé, au-delà de l'affichage** :
- Le coût (`cost: {quantity, unit}`) n'était encore lu nulle part dans le moteur — `parseItemCost` (`srdMapping.ts`, tests d'abord) suit exactement le même patron que `parseItemWeight` (déjà existant), et `resolveEquipmentCost` (`resolvedRuleset.ts`) le même patron que `resolveEquipmentWeight`, branché sur `/api/worlds/[worldSlug]/resolved-ruleset` et `useResolvedRuleset` — déjà réactif à l'inventaire comme le reste (`equipment`/`weaponByKey`/`weight`).
- Les propriétés d'arme (`finesse`, `light`, `thrown`...) n'ont pas de fiche de règle propre — `Weapon-Properties` est une catégorie volontairement exclue de l'import (`scripts/ingest-srd.ts`, `SKIPPED_CATEGORIES`, décision antérieure à ce ticket). `WEAPON_PROPERTY_LABELS_FR`/`ARMOR_CATEGORY_LABELS_FR`/`CURRENCY_LABELS_FR` (`src/i18n/fr.ts`) sont donc des tables statiques, même motif que `SKILL_LABELS_FR`/`LANGUAGE_LABELS_FR`.
- La caractéristique utilisée pour l'attaque/les dégâts (`weaponAttackAbilityMod`, `src/core/rules/action.ts`, déjà utilisée côté serveur) est réutilisée telle quelle côté client pour l'aperçu affiché — jamais une seconde règle recalculée séparément, qui aurait pu diverger de ce que le clic déclenche réellement.
- **Décision : le libellé des boutons reste un verbe (« Attaquer », « Dégâts »), pas la notation dé demandée littéralement (« 1d20 », « 1d4 »)** — deux boutons d'attaque (mêlée et lancer) porteraient sinon le même « 1d20 », rien pour les distinguer. La formule résolue (avec la bonne caractéristique) va en police mécanique juste en dessous, comme demandé.
- Le bouton « lancer » d'une arme avec la propriété `thrown` réutilise exactement le même calcul que l'attaque normale (`weaponAttackAbilityMod` ne distingue pas mêlée/lancer — règle 5e réelle : un jet à distance avec une arme de mêlée utilise le même modificateur que l'attaque de mêlée, sauf finesse qui s'applique déjà aux deux) — pas de second chemin serveur, juste un second bouton visuel.
- L'ajout d'objet réutilise `ItemAutocomplete` (déjà existant pour l'éditeur générique), étendu d'un `onQueryChange` optionnel et rétrocompatible pour capter le texte tapé sans suggestion choisie — un objet homebrew (sans fiche de règle) reste ajoutable exactement comme avant, juste par le même champ plutôt qu'un menu séparé.
- `ItemCard` (nouveau composant) est **le même composant** utilisé par l'onglet Inventaire (toutes les entrées, contrôles de gestion visibles) et par l'onglet Actions (entrées équipées et porteuses d'un bouton d'action seulement, `onToggleEquipped`/`onChangeQty`/`onRemove` omis) — « reporté dans l'onglet Actions » au sens propre : pas une copie, le même encadré.
- La phrase retirée l'était aussi de l'éditeur générique `InventoryBlockEditor.tsx` (utilisé hors fiche jouable, pour tout bloc `inventory` d'une entité quelconque) — sans intérêt réel même dans ce contexte, retirée partout plutôt que dupliquée en distinguant les deux usages.

**Fait** :
- `parseItemCost` + tests, `resolveEquipmentCost`, `cost` propagé jusqu'à `useResolvedRuleset`.
- `ItemCard`, `ActionButton`, `AddItemRow` (`PlayableCharacterSheet.tsx`) — encadrés type Traits, formule d'attaque/dégâts adaptée à la caractéristique réellement utilisée (finesse comprise), bouton Équipé stylisé (pastille + couleur d'accent, même langage que les toggles de compétence/langue déjà existants).
- Onglet Inventaire : monnaie sous la barre de charge, liste d'encadrés, recherche + quantité pour ajouter (référence de règle ou objet en ligne selon ce qui est choisi).
- Onglet Actions : les armes équipées utilisent le même `ItemCard`, sans contrôles de gestion.
- Vérifié en navigateur : dague (finesse/légère/lancer, FOR > DEX ici donc « +FOR ») affiche « Attaquer 1d20+FOR+maîtrise », « Lancer », « Dégâts 1d4+FOR» — un vrai jet d'attaque confirme le même total (14 = 1d20(10) + mod(4)). Armure de cuir ajoutée puis équipée : CA passe de 11 à 12, aucun bouton d'action, absente de l'onglet Actions — comportement attendu pour une armure. Objet retiré proprement.

*Hors périmètre, comme prévu : le libellé exact des boutons (verbe plutôt que notation dé, décision documentée ci-dessus, à ajuster si l'utilisateur préfère l'inverse) ; regroupement des propriétés d'arme sous forme d'explication longue plutôt que de badges courts (aucune prose officielle disponible pour ces clés, cf. `SKIPPED_CATEGORIES`) ; la grille de monnaie de l'éditeur générique `InventoryBlockEditor.tsx` (hors fiche jouable) garde les codes SRD bruts pp/gp/ep/sp/cp — seule celle de la fiche jouable utilise `CURRENCY_LABELS_FR`, pas homogénéisé partout, non demandé ici.*

### V1-C12 — Encadré d'objet : bascule verticale, boutons à trois lignes, sens des propriétés · `M` — fait

Suite de V1-C11, 5 ajustements sur retour utilisateur : ajout d'objet remonté sous la monnaie ; bouton Équiper en bandeau vertical à gauche, sur toute la hauteur de l'encadré ; titre/poids/valeur/nombre/suppression sur une seule ligne ; boutons d'action à trois lignes (verbe, formule résolue en nombres, détail symbolique en dessous) ; sous les tags de propriété, leur explication réelle tirée d'une fiche de règle.

**Ce que le dernier point a changé, au-delà de l'affichage** — la partie la plus substantielle de ce ticket :
- Les propriétés d'arme (`finesse`, `light`, `thrown`...) portent bien une vraie prose SRD (`desc`, vérifié) — la décision antérieure de ne pas les importer (`scripts/ingest-srd.ts`, `SKIPPED_CATEGORIES`, « pas de besoin concret aujourd'hui ») ne tenait plus dès qu'un besoin concret existe. Retirées de `SKIPPED_CATEGORIES`, ajoutées à `CATEGORY_ENTRY_TYPE` (`Weapon-Properties: "feature"`, même motif que `Traits`/`Feats`) — importées pour de vrai (import rejoué, 0 échec).
- **Bug réel découvert en vérifiant, pas en supposant** : plusieurs index de propriété sont des mots ordinaires qui percutent une autre entrée déjà présente sous la même clé — `light` est aussi le sort *Lumière*, `monk` la classe Moine, `ammunition`/`versatile` d'autres entrées. Le désambiguateur générique de collision (`${clé}-${entry_type}`) évite bien un doublon en base, mais une clé devinée côté client (`{kind:"rule", key:"light"}`) aurait alors résolu la fiche du **sort**, pas de la propriété — un lien vers le mauvais contenu, pas juste une fiche manquante. Corrigé à la source : `Weapon-Properties` reçoit un préfixe dédié et permanent (`weapon-property-<index>`, ex. `weapon-property-light`) dans `transformEntry`, sans collision possible par construction — vérifié en base que `light` (sort) et `weapon-property-light` (propriété) résolvent chacun leur propre contenu.
- Description non traduite (anglais SRD brut), même limite que partout ailleurs pour les descriptions d'aptitude (cf. V1-C9) — seuls les noms ont une traduction officielle systématique.
- Le préfixe redondant de `ai_digest` (`"<nom> (<type>) — <texte>"`) est retiré à l'affichage (`stripDigestPrefix`) pour ne pas répéter le nom de la propriété deux fois à côté de son propre badge FR.

**Fait** :
- `ActionButton` réécrit à trois lignes (`resolvedFormula`/`detailFormula`, ex. « 1d20+2+2 » puis « 1d20+FOR+maîtrise »), tout dans le bouton.
- Bascule Équiper en bandeau vertical (`writing-mode: vertical-rl` + rotation), pleine hauteur via le comportement `stretch` par défaut d'un conteneur flex — pas de hauteur fixée à la main.
- Ligne d'en-tête unique : titre, poids, coût, quantité, puis suppression poussée à l'extrémité droite (`flex-1` invisible en séparateur).
- Tags de propriété (badges courts) suivis d'un bloc de descriptions réelles, une par propriété.
- `AddItemRow` remonté juste sous la grille de monnaie, avant la liste d'objets.
- Vérifié en navigateur : dague — badges Finesse/Légère/Lancer/Moine, descriptions anglaises réelles en dessous (ex. « Finesse — When making an attack with a finesse weapon... »), boutons Attaquer/Lancer/Dégâts avec formule résolue (1d20+2+2) et détail (1d20+FOR+maîtrise) dans le même bouton. Cuirasse (armure intermédiaire pré-existante sur la fiche de test) : bandeau vertical, une seule ligne d'en-tête, catégorie affichée, aucun bouton d'action — cohérent avec V1-C11.

*Hors périmètre : traduction française des ~11 descriptions de propriété (limite déjà documentée V1-C9, pas rouverte) ; `Weapon-Mastery-Properties` (2024, mécanique non modélisée sur la fiche jouable aujourd'hui) reste hors import.*

**Ajustement suite au premier retour visuel (tailles de police)** — cause identifiée avant de corriger, pas devinée : `.mech` (`app/globals.css`) impose son propre `font-size: 0.9em` en CSS non-layé (hors de tout `@layer` Tailwind), qui l'emporte toujours sur une classe `text-[Npx]` combinée sur le même élément, quel que soit l'ordre écrit — règle CSS Cascade Layers, le non-layé bat systématiquement tout layer. Plusieurs tailles affichées ne correspondaient donc pas à la classe lue dans le code. Corrigé par un style en ligne (seule priorité qui passe devant `.mech`, jamais une classe Tailwind seule) partout où `mech` est combiné à une taille explicite : poids et coût maintenant identiques (`0.625rem`/10px, tous deux en police mécanique) ; dans un bouton d'action, la formule résolue centrale (« 1d20+2+2 ») égale la taille du titre de l'encadré (`0.875rem`/14px), le verbe et le détail symbolique descendent à `0.625rem`/10px ; descriptions de propriété passées à `text-xs` (12px). Tailles exactes vérifiées via `getComputedStyle` en navigateur, pas seulement à l'œil.

**Second ajustement (badge « Moine »)** — question de l'utilisateur sur la présence du tag « Moine » sur une dague pour un personnage Magicien : donnée SRD réelle et correcte (la dague est éligible comme arme de moine dans les règles officielles, le SRD encode ça comme une propriété de l'arme), mais sans effet sur aucun calcul affiché ici, contrairement à finesse. Sur confirmation explicite : masqué quand le personnage n'a aucun niveau dans la classe Moine (`character.classes`, comparaison sur la clé `"monk"`) — les autres propriétés restent toujours affichées, ce sont des faits sur l'arme, pas sur qui la porte.

---

### V1-C13 — Encadré d'objet repliable (onglet Inventaire) · `S` — fait

Réduit l'encombrement visé depuis le début de V1-C11/V1-C12 : replié par défaut, seuls titre/poids/coût/quantité/suppression et les badges de propriété restent visibles ; déplié, les descriptions et les boutons d'action apparaissent. Flèche centrée exactement au milieu de l'encadré (grille `1fr auto 1fr`, pas un simple bouton placé avant celui de suppression — resterait décentré selon la largeur du titre), à la même hauteur que le titre.

**Fait** :
- `ItemCard` gagne une prop `collapsible` explicite à chaque site d'appel plutôt qu'un comportement déduit implicitement : `false` dans l'onglet Actions (son seul rôle est d'utiliser l'objet, jamais replié — désactive aussi le rendu de la flèche) ; `true` dans l'onglet Inventaire.
- Aucune flèche affichée pour un objet sans rien à replier (armure, objet en ligne sans propriété) — pas de contrôle qui ne contrôlerait rien.
- Vérifié en navigateur : dague repliée par défaut (titre/poids/coût/tags visibles, description/boutons cachés), dépliée au clic sur la flèche (▾ devient ▴) ; armure affichée sans flèche (rien à replier) ; onglet Actions inchangé, toujours entièrement déplié.

---

### V1-C14 — Différencie l'encadré Inventaire (texte) de l'encadré Actions (boutons) · `M` — fait

Demande explicite : dans l'onglet Inventaire, aucun bouton d'action — seulement du texte informatif (« Attaquer — 1d20+FOR+maîtrise », « Dégâts — 1d4+FOR »), pas de dés à jeter depuis la gestion de l'inventaire. Dès qu'un objet est équipé et apparaît dans l'onglet Actions, ce texte disparaît au profit des vrais boutons (format V1-C12 inchangé) — seul cet onglet permet de jeter les dés. Demande secondaire : aligner le haut du bloc de boutons avec le haut du titre côté Actions, pour gagner de la place.

**Fait** :
- Onglet Inventaire : les lignes de texte (`Attaquer`/`Lancer`/`Dégâts`/`Dégâts (2 mains)`) s'affichent pour toute arme dès qu'elle est dépliée, **indépendamment de l'équipement** — contrairement aux anciens boutons, qui n'existaient que pour une arme équipée (`onAttack`/`onDamage` alors fournis). Une info sur une arme reste utile même rangée dans le sac ; corrigé au passage `hasCollapsibleContent` (la flèche de pliage doit exister dès qu'il y a du texte à déplier, pas seulement des boutons).
- Onglet Actions : les descriptions de propriété disparaissent (retirées de ce contexte, restent consultables via le lien de la fiche de règle) ; mise en page à deux colonnes (`items-start` sur un flex horizontal) — titre/tags à gauche, boutons à droite, même bord supérieur, sans calcul de hauteur.
- `collapsible` (déjà introduite en V1-C13) sert de signal unique pour distinguer les deux contextes plutôt que d'ajouter une prop redondante — `true` = Inventaire (texte, jamais de bouton), `false` = Actions (boutons, jamais de texte/description).
- Sur retour utilisateur immédiat : bouton de pliage (▾/▴) et bouton de suppression (×) agrandis (`h-7 w-7`, cible tactile plus confortable) ; le bouton de pliage devient une pastille ronde bordée (`rounded-full border`), bien plus visible qu'un simple caractère flottant.
- Vérifié en navigateur : dague dans l'onglet Inventaire affiche le texte (pas de bouton) même non équipée ; équipée, elle apparaît dans l'onglet Actions en boutons compacts, titre et rangée de boutons alignés sur la même ligne, sans description.

---

### V1-C15 — Format du texte d'arme, alignement poids/valeur/quantité, bascule de pliage en bandeau · `S` — fait

Trois demandes sur l'encadré d'objet de l'onglet Inventaire : (1) le texte « Attaquer »/« Lancer »/« Dégâts » doit reprendre le même format que les autres caractéristiques de l'encadré (libellé en gras, tiret, valeur — comme les descriptions de propriété d'arme) ; (2) le poids, la valeur et la quantité doivent être alignés entre les différents objets ; (3) pour faire de la place à des titres longs, la pastille de pliage/dépliage (V1-C14) devient un bandeau horizontal pleine largeur, en haut de l'encadré — sur le modèle du bandeau vertical « Équiper », mais sur l'autre axe.

**Fait** :
- Texte d'arme reformaté à l'identique des descriptions de propriété : `<span className="font-semibold text-ink">Attaquer</span> — <span className="mech">…</span>`, même taille (`text-xs leading-relaxed`).
- Poids (`w-12`), valeur (`w-14`) et quantité (`w-12`/`w-10`) passent en largeur fixe et texte aligné à droite (`text-right`) — alignés pixel pour pixel d'un objet à l'autre, vérifié via `getBoundingClientRect()` en navigateur. Seul le titre s'étire et se tronque (`min-w-0 flex-1 truncate`), ce qui lui laisse toute la place disponible sans désaligner les colonnes voisines.
- La pastille ronde centrale (V1-C14) est retirée de la grille d'en-tête et remplacée par un bouton pleine largeur en tête d'encadré (`flex w-full … border-b`), au-dessus du bandeau vertical « Équiper » — la grille 3 colonnes de l'en-tête redevient un simple flex, ce qui rend la largeur gagnée disponible au titre et aux colonnes alignées.
- Vérifié en navigateur : Dague/Cuirasse/Massue/Chemise de mailles alignées (poids à `right: 1238px`, valeur à `right: 1302px`, identique sur les quatre encadrés) ; onglet Actions inchangé (toujours sans bandeau de pliage, toujours boutons top-alignés à droite du titre).

---

### V1-C16 — Dépôt/dépense de pièces avec change automatique · `S` — fait

Demande explicite : un champ + boutons +/- pour les pièces, à l'image de ceux des points de vie et de l'XP, avec en plus une liste pour choisir la dénomination (pp/po/pe/pa/pc) — sur la même ligne que les cinq champs de pièces. Clarifié avec l'utilisateur (AskUserQuestion) : « faire automatiquement le change » signifiait la vraie conversion — si la dénomination choisie n'a pas assez d'unités, casser des pièces plus grosses selon le taux d'échange standard, puis recomposer tout le porte-monnaie avec le moins de pièces possible ; bloquer sans rien modifier si la valeur totale ne suffit pas.

**Fait** :
- `src/core/rules/currency.ts` (tests d'abord, `currency.test.ts`, 8 cas) : `depositCoins` ajoute simplement au type choisi ; `spendCoins` calcule le coût et la valeur totale en pièces de cuivre (taux SRD : 1 pp = 10 po = 20 pe = 100 pa = 1000 pc), renvoie `null` sans rien modifier si la valeur totale ne suffit pas, sinon recompose tout le porte-monnaie du plus gros au plus petit (glouton, minimise le nombre de pièces).
- Même motif que `applyHpDelta`/`applyXpDelta` (`PlayableCharacterSheet.tsx`) : un champ de montant vidé après usage, deux boutons −/+, plus un menu déroulant pour cibler la dénomination. Le dépôt (+) ne touche jamais aux autres pièces ; la dépense (−) peut recomposer l'ensemble du porte-monnaie (c'est le change automatique demandé).
- `coinError` (état local) affiche « Fonds insuffisants, même en cassant des pièces plus grosses. » sous la ligne quand `spendCoins` renvoie `null` ; se réinitialise dès que l'utilisateur retouche le montant ou la dénomination.
- Mise en page resserrée pour tenir sur une seule ligne dans la colonne étroite de l'onglet Inventaire (mesuré à 351px de large en navigateur) : `flex` sans `flex-wrap` plutôt que `flex-wrap` — à cette largeur, un retour à la ligne aurait justement contredit la demande explicite ; champs et boutons réduits (`w-9`/`w-10`, `text-xs`, `gap-1`) pour que les deux groupes cohabitent sans se chevaucher.
- Vérifié en navigateur : dépense de 5 po avec seulement 1 pp en poche casse la pièce de platine et recompose en 5 po (`pp: 1→0`, `gp: 0→5`) ; dépense de 15 po avec la même réserve (valeur totale insuffisante) bloque et affiche le message d'erreur sans rien modifier ; les deux groupes de contrôles restent sur la même ligne (mesuré via `getBoundingClientRect()`, même `bottom`).

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
Lot B  (B1→B2→B3→B4→B5)    le personnage devient jouable, B5 le rend interactif
Lot C  (C1→C2→C3→C4→C5→C6→C7→C8→C9)
                            plusieurs personnes, permissions réelles, C4 les correctifs,
                            C5 (sélection de ruleset) n'a de dépendance que sur C1,
                            C6 (Actions/Magie/Traits) n'a de dépendance que sur B5,
                            C7 (langues d'historique) et C8 (dons) dépendent de C6,
                            C9 (encadrés de l'onglet Traits) n'a de dépendance que sur C6,
                            profite de C8 s'il est déjà fait mais ne l'exige pas
Lot D  (D1→D2→D3→D4)       l'IA, instrumentée dès le premier appel
```

**Ne pas paralléliser les lots.** A débloque B (une fiche de personnage a besoin des règles), B débloque C (une campagne a besoin de personnages), et D a besoin de tout le reste pour avoir quelque chose à assister.

**Un ticket, un commit, une relecture.** La tentation d'enchaîner grandit avec l'aisance ; le risque R2 du registre aussi.
