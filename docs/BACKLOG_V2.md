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
| **Thème dérivé de l'image** | **fait** — voir V2-G4 (reformulé : par joueur, pas par monde) |

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

- [x] **Montée de niveau accompagnée.** Le bouton « +XP » devient « Monter de niveau » au seuil, et rejoue la partie utile du parcours de création (`wiki-liens-et-personnages.md` §B8).
- [x] **Application des dégâts à une cible** depuis l'écran de combat — la V1 ne permettait que de les subir manuellement.
- [x] **Réorganisation par glisser-déposer** des blocs. Le `display_order` en `numeric` est prêt depuis la Phase 0.
- [x] **Panneaux multiples** : deux fiches côte à côte, via `?avec=[slug]`. Le composant `<Panel>` a été isolé pour ça.
- [x] **Export et import de monde** en JSON. L'export omet le contenu `personal_reference` (`ruleset-personnel.md` §3.2).

**Périmètre étendu sur demande explicite** : l'assistant de création de personnage (§B8) devient un outil partagé par trois points d'entrée, dans cet ordre — 1) outil complet dans l'écran MJ (`/mj/creation-personnage`), 2) bloc distinct sur une entité (édition actuelle de `PlayableCharacterSheet` conservée telle quelle), 3) onglet de montée de niveau sur la fiche jouable, activé au franchissement d'un seuil de PX. Le point 1 est fait et enrichi sur deux passes de retour utilisateur :

- Huit étapes au lieu de sept : espèce (boutons, lignées gérées comme les sous-classes), classe (boutons, niveau et multiclassage complets, sous-classe gatée par niveau), caractéristiques (tableau standard/achat de points/tirage, stats dérivées en direct), historique (boutons, vrai choix d'équipement contre or), équipement, compétences (liste + acquis fixes), **sorts** (budget par classe incantatrice, lu dans `class_progression`), aperçu.
- L'aperçu réutilise les vrais composants de la fiche jouable (en-tête + onglets Actions/Magie/Inventaire/Traits), pas une mini-fiche à part.
- **Bug racine corrigé (deuxième passe)** : `listRuleEntryBlocksByKeys` (l'endpoint batché de l'assistant) ne résolvait jamais les références internes d'un bloc (don d'un historique, traits d'une espèce, options d'une sous-classe) — `blockContentRenderer.tsx` affichait alors "undefined" ou du texte anglais non traduit. Corrigé par une deuxième passe de résolution batchée dans `listRuleEntryBlocksByKeys` (`src/server/services/rules.ts`), miroir de ce que fait déjà `getRuleEntryForWorld` mais sans le N+1.
- Bug de données trouvé au passage : les sous-espèces du SRD 2014 (`Subraces`, ex. Nain des collines) ne portent jamais `parentSpeciesKey` — `speciesParentKey()` ne lisait que la forme 2024 (`source_raw.species`), jamais 2014 (`source_raw.race`). Corrigé dans `src/server/services/rules.ts`.
- Espèce et classe : la fiche de l'élément choisi (espèce/classe) s'affiche désormais **avant** les boutons de lignée/sous-classe, qui ajoutent leur propre fiche en dessous plutôt que de remplacer la première — les deux restent visibles en même temps.
- Caractéristiques : CA (bouclier)/Initiative/Perception passive réutilisent maintenant `StatBadge`/le même bouclier que `CharacterSheetHeader` (jamais une deuxième présentation) ; les jets de sauvegarde sont montés dans l'encadré de chaque caractéristique, sous le modificateur.
- Historique : titre "Don : <nom>" plutôt qu'une paire étiquette/valeur séparée (`Background()`, `blockContentRenderer.tsx`) ; le double affichage de l'équipement (fiche détaillée + résumé texte) est réduit à la fiche détaillée + de simples boutons "Choisir A/B".
- Traductions manquantes ajoutées : `WEAPON_ARMOR_PROFICIENCY_LABELS_FR` (`src/i18n/fr.ts`) pour les maîtrises d'arme/armure par catégorie (ex. "Daggers"), qui n'ont pas de fiche de règle propre (`Proficiencies` est exclue de l'import) ; les langues déjà acquises passent maintenant par `LANGUAGE_LABELS_FR` dans `RemainingChoicesStep.tsx`.
- Sorts : présentation en encadrés dépliables (`SpellCard`, même langage visuel que `ItemCard` de l'onglet Inventaire) plutôt qu'en pastilles — sélection et dépliage de la description sont deux interactions séparées.
- Reste signalé, non corrigé : les résumés de chip (`ai_digest`) sont en anglais et en pieds — généré par `scripts/ingest-srd.ts`, hors périmètre de ce ticket. Idem pour le `\n` isolé au milieu d'une phrase dans au moins une traduction française existante (don "Initié à la magie") — probablement pas un cas isolé, pas encore quantifié.

**Troisième passe de retour utilisateur** :

- **Bug de performance racine corrigé** : `assembleResolvedRuleset` (endpoint `resolved-ruleset`, appelé à chaque changement d'espèce/historique/classe/équipement/sort) refaisait sa propre remontée de chaîne de rulesets pour CHAQUE entrée (espèce, historique, chaque classe), jamais partagée — mesuré à ~1.3s pour un seul personnage simple. Ajout de `fetchEntriesBatch` (même lot que `listRuleEntryBlocksByKeys`) : un seul parcours de chaîne pour tout le lot. Les 4 fonctions `resolveEquipment*` (armure/arme/poids/coût) refaisaient aussi chacune `fetchEquipmentBlocks` sur les mêmes clés — fusionnées en `resolveEquipmentData`, une seule résolution par objet, en parallèle. Résultat mesuré : ~600ms (encore perceptible, mais divisé par plus de deux) — le reste vient du nombre de allers-retours réseau vers Supabase local, pas d'un travail redondant restant.
- Sorts : regroupés par niveau (Sorts mineurs, puis Niveau 1, Niveau 2...) plutôt qu'un seul bloc plat ; bug réel corrigé au passage — un lanceur "préparant" (Magicien, Clerc, Druide...) n'a jamais de nombre de sorts tabulé par niveau dans le SRD (ça dépend du modificateur de caractéristique), `computeBudget` ne proposait donc jamais de sorts de niveau 1+ pour ces classes, seulement les sorts mineurs. Repli sur la formule officielle (modificateur + niveau, minimum 1). `SpellCard` reprend maintenant le chrome exact de `ItemCard` (bandeau de pliage + bande verticale de sélection).
- **Équipement de départ des classes (point 9 comblé)** : nouveau bloc de règle `class_equipment` (`fixed` + `choices[]`, réutilise les types `BackgroundEquipmentItem/Option` — un choix de classe n'est qu'un choix d'historique avec plusieurs choix indépendants). Ingestion étendue (`scripts/ingest-srd.ts`), ré-exécutée contre la base locale (idempotente, additive — voir `app.import_srd_entries`). Piège réel rencontré : la ré-ingestion retire les fiches qui ne viennent pas du SRD JSON, dont `encounter-budget` (écrite à part par `scripts/write-encounter-budget-2024.ts`) — **toujours relancer ce script après une ré-ingestion**. Seule la première classe du personnage accorde de l'équipement (comme en jeu — le multiclassage n'en redonne jamais) ; objets fixes appliqués automatiquement, chaque choix indépendant via des boutons "Choisir A/B" dans `LevelClassesStep.tsx`.
- Signalé, pas résolu : un clic très rapproché entre deux boutons de choix (beaucoup plus rapide qu'un humain) a fait planter le rendu une fois pendant les tests et revenir au tableau de bord — non reproduit avec un rythme de clic normal malgré plusieurs essais ; à surveiller si ça revient en usage réel.

**Quatrième passe de retour utilisateur** :

- **Deuxième bug de performance racine corrigé** : `/api/worlds/[worldSlug]/rule-entries` (la liste complète des règles d'un monde, chargée par chaque étape du wizard via `useWorldRuleEntries`) prenait ~4.2s sous le SRD 2024 (1905 entrées) — `listRulesetEntries`/`listRulesetEntriesByKeys`/`listTranslationsForEntries`/`listEntryTranslationsWithBlocks`/`listBlocksForRulesetEntries` (`src/server/repos/rules.ts`) paginaient/lotaient toutes en boucle SEQUENTIELLE (un lot attend le precedent), jusqu'à dix allers-retours d'affilée pour les traductions seules. Toutes batchées en parallèle via un nouveau `fetchBatched` partagé. Résultat mesuré : ~1.4-1.8s (environ 2.5x plus rapide) — le reste est du temps de transfert reseau reel (1905 lignes), pas du travail redondant.
- Langues manquantes sous le SRD 2024 (point 3) : corrigé. Le SRD 5.2.1 ne rattache plus aucune langue à l'espèce ni à l'historique (contrairement à 2014) — la règle générale du personnage s'applique alors ("Choisissez vos langues", data/srd/fr-source/srd-5.2.1-fr.txt : "Le commun, plus deux langues déterminées au hasard ou choisies"), codée en repli explicite dans `assembleResolvedRuleset` quand aucune langue n'a été trouvée ailleurs. Le Commun est acquis d'office, jamais proposé une deuxième fois dans le choix des 2 langues libres.
- Historiques manquants sous le SRD 2024 (point 2) : non reproduit sous le ruleset **officiel** `SRD 5.2.1 (2024)` — les 4 historiques du SRD (Acolyte, Criminel, Sage, Soldat, la totalité de ce que la licence libre republie) y sont bien présents et traduits. Le monde de test avait pour ruleset actif une variante ("Guide du MJ maison", parentée sur le SRD 2014 — qui ne republie qu'Acolyte), pas l'officiel 2024 : la variante n'hérite jamais des historiques 2024. Ces rulesets variantes/personal_reference préexistent (fonctionnalité V1-D4/V1-D5, pas créée pendant cette passe).
- Espèces en double à l'écran + retour inopiné au tableau de bord (point 1) : les données elles-mêmes ne portent aucun doublon (vérifié par requête directe, plusieurs fois) — un onglet de navigateur neuf ne reproduit ni les espèces en double ni aucune erreur console, alors qu'un onglet réutilisé depuis le début de la session (des dizaines de rechargements à chaud pendant l'édition) en accumule. Piste retenue : artefact du rechargement à chaud (HMR) du serveur de développement pendant une édition de code active, pas un bug du code livré — non reproduit sur un chargement propre malgré plusieurs tentatives. Reste à surveiller si ça se produit en dehors d'une session d'édition active.

Points 2 et 3 restent à faire ; le pré-remplissage par IA (§B8 « en surcouche ») est délibérément reporté au lot J.

**Cinquième passe de retour utilisateur** :

- Boutons d'historique enrichis (don lié, valeurs de caractéristique, maîtrise d'outil, maîtrises de compétence), même motif que les boutons d'espèce (`BackgroundStep.tsx`).
- Étape « Sorts » masquée (jamais un onglet adaptatif) pour toute classe sans progression d'incantation dans le ruleset actif — `CharacterCreatorWizard.tsx`, présence du bloc `spellcasting_progression`.
- **Maîtrise d'armes** (SRD 2024 — Barbare, Guerrier, Paladin, Rôdeur, Roublard) : choix en étape 6, résolu côté serveur (`assembleResolvedRuleset`) au même titre que compétences/langues. Les armes éligibles se lisent dans les vraies maîtrises d'armes de la classe (jamais une liste recopiée à la main). **Plus aucune règle codée en dur côté serveur** (retour utilisateur explicite, deux passes) : le nombre par classe (colonne `class_specific_weapon_mastery`) et la restriction « corps à corps seulement » du Barbare (`class_specific_weapon_mastery_melee_only` — un fait sur sa capacité, jamais sur l'arme elle-même, que `is_ranged` par arme ne suffit pas à exprimer) sont tous deux lus dans `class_progression`, cinq classes par le même chemin. Les deux valeurs sont injectées à l'import (`scripts/ingest-srd.ts`, `classProgressionBlock`), strictement gardées à `sourceAttribution === "SRD 5.2.1"` — la maîtrise d'armes n'existe pas sous 2014, même `classIndex`. Un booléen dans une table de progression s'affiche désormais « Oui »/« Non » (`cellValue`, `blockContentRenderer.tsx`), jamais « true »/« false ». Onglet dédié sur la fiche jouable, remis à zéro à chaque repos long (`characterActions.ts`, `takeLongRest`), avec un badge « Botte disponible » sur une arme équipée actuellement maîtrisée — l'effet de la botte reste à résoudre à la main (hors périmètre : modéliser les huit propriétés de maîtrise comme de vraies mécaniques de combat est un chantier à part).
- Régression de performance détectée et corrigée en cours de route : le catalogue d'armes se chargeait même pour une classe qui n'accorde pas la maîtrise dans le ruleset actif (ex. Guerrier sous 2014) — repéré par un test d'intégration qui a commencé à expirer.

**Montée de niveau accompagnée (point 1 du ticket)** : nouvel assistant séparé `LevelUpWizard.tsx`, pas un troisième mode de `CharacterCreatorWizard` — la sauvegarde chirurgicale (aucun renommage, aucun contact avec l'inventaire) l'exigeait de toute façon. Réutilise sans modification `LevelClassesStep`/`RemainingChoicesStep`/`SpellSelectionStep` (déjà écrits en « budget total moins déjà choisi », donc naturellement delta-aware au changement de niveau). Amélioration de caractéristique (ASI) incluse dans le périmètre, sur décision explicite : `src/core/rules/abilityScoreImprovement.ts` (choix +2/une ou +1/deux, plafond 20) monte comme modificateur couche 5, exactement le mécanisme déjà en place pour les bonus d'espèce (couche 2) — `sheet.ts` n'a nécessité aucun changement. Les niveaux qui accordent une ASI ne sont jamais codés en dur : lus dans `progressionRows` (`extractAsiGrantedLevels`, `srdMapping.ts`), exposés par `assembleResolvedRuleset` (`asiGrantedLevels`). Sauvegarde via une nouvelle action serveur `applyLevelUp` (`characterActions.ts` + `app/api/entities/[id]/actions/level-up/`), qui recalcule la fiche CANDIDATE côté serveur pour vérifier le plafond de 20 et la légitimité de chaque choix d'ASI, jamais la fiche envoyée par le client. Trou de données documenté et accepté : sous le SRD 2014, la fusion de textes identiques à l'import confond les ASI supplémentaires du Guerrier et du Roublard (propres à leur classe) avec des clés sans marqueur — fonctionne correctement sous le SRD 2024 (ruleset actif de Valdoria).

Deux bugs réels trouvés en testant la soumission dans le navigateur, tous deux corrigés :

- **Comparaison espèce/historique invalide** : `applyLevelUp` comparait `species`/`background` (avant/après) par `JSON.stringify`, qui casse après un aller-retour par une colonne `jsonb` — Postgres ne garantit pas l'ordre des clés d'un objet. Toute montée de niveau était rejetée à tort (« ne peut pas changer l'espèce... ») dès que l'ordre des clés différait par hasard. Remplacé par une comparaison structurelle (`sameBlockReference`).
- **ASI invisible aux calculs serveur** : `resolveCharacterActionContext` — utilisé par les jets d'attaque, de dégâts, de sort, et par la route `/sheet` — ne construisait jamais les features synthétiques d'ASI, contrairement à `applyLevelUp`. Un bonus d'ASI déjà appliqué et enregistré ne comptait donc dans AUCUN jet de dé réel, en contradiction directe avec la règle 6 de `CLAUDE.md` (« l'IA narre, le code arbitre »). Extrait en fonction partagée `buildAsiChoiceFeatures`, appelée maintenant aux deux endroits.

**Retour utilisateur après livraison** : deux points corrigés/ajoutés.

- **Bug d'affichage** : l'assistant s'ouvrait sur un écran « niveau 12 → 12 » (le niveau n'était pas pré-incrémenté), obligeant à corriger le chiffre soi-même avant de pouvoir continuer. `LevelUpWizard` applique maintenant +1 sur la première classe dès l'ouverture — l'étape Classe reste l'endroit pour rediriger ce niveau vers une autre classe (multiclassage) si besoin.
- **Jet de dé de vie réel (absent jusqu'ici)** : `computeHitPoints` (`sheet.ts`) prenait systématiquement la moyenne pour tout niveau après le premier — décision documentée dès la V1 (`BACKLOG_V1.md` V1-B1), mais le champ `hp_method` (« Valeur fixe »/« Jetés ») affiché sur la fiche n'a jamais été branché à quoi que ce soit. Corrigé en ajoutant une vraie mémoire de jet : `ClassLevel.hpRolls`/`character.classes[].hp_rolls`, un historique de PV gagnés niveau par niveau, jamais recalculé (un jet est un fait, pas une valeur dérivable) — absent ou plus court que prévu = personnage antérieur à cette fonctionnalité, `computeHitPoints` comble alors avec la moyenne, aucun changement pour l'existant. Nouvelle étape « Points de vie » dans `LevelUpWizard` (composant `HpRollStep.tsx`) : un choix moyenne/jet par niveau nouvellement gagné, par classe — jamais un choix global. Le client ne transmet qu'une INTENTION (`hpChoices`, moyenne ou jet) ; `applyLevelUp` exécute le jet lui-même via `serverRng` (régle 6) et rejette (`invalid_hp_choice`) tout choix manquant ou dont le compte ne correspond pas exactement aux niveaux gagnés. L'aperçu affiche une estimation (« ≈ ») tant qu'un jet est en attente, la vraie valeur n'existant qu'après confirmation.

**Application des dégâts à une cible (point 2 du ticket)** : `InitiativeTracker.tsx` gagne un contrôle unique « Appliquer des dégâts » (montant tapé + participant choisi dans une liste), plutôt qu'un jet automatisé par arme — les participants `custom` (piège) et `statblock` (monstre) n'ont pas forcément d'arme ni de fiche de personnage à interroger, ce contrôle fonctionne identiquement pour les trois `source_kind`. Les PV temporaires absorbent en premier (règle 5e), le reste retombe sur les PV réels sans jamais descendre sous 0 ; réutilise `patchCombatParticipant` (déjà en place pour le stepper PV manuel), donc le bouton « Annuler » de l'écran existant défait aussi cette action sans code supplémentaire. Corrigé au passage : le stepper PV de chaque ligne avait été oublié lors du remplacement des anciens ronds +/- par la case à bandes pleine largeur (retour utilisateur antérieur) — même composant partagé `Stepper.tsx` que partout ailleurs désormais.

**Réorganisation par glisser-déposer (point 3 du ticket)** : `@dnd-kit/core`+`sortable`+`utilities` (MIT, ~15 ko gzip à eux trois, aucune dépendance transitive) — décision explicite face au HTML5 natif, qui n'aurait couvert ni le clavier ni le tactile. `EntityBlocks.tsx` enveloppe la liste dans `DndContext`/`SortableContext` ; chaque carte de bloc est extraite dans `SortableBlockCard` (le hook `useSortable` doit s'appeler une fois par instance de composant, jamais une fois par itération d'une boucle `.map()` dans le parent — règle des hooks). Le calcul du nouveau `display_order` au dépôt (`computeDroppedDisplayOrder`) généralise l'écart déjà utilisé par Monter/Descendre (`(voisin + voisin) / 2`, jamais une renumérotation de toute la liste) à une position d'arrivée arbitraire ; les deux chemins convergent vers la même route serveur (`PATCH /api/blocks/[id]/order`, même vérification de version), donc aucun changement côté serveur. Les boutons Monter/Descendre restent en place (accessibilité, secours). Bug réel trouvé et corrigé au passage : `DndContext` sans `id` fixe produisait un `aria-describedby` divergent entre le rendu serveur et l'hydratation client (compteur interne de dnd-kit) — corrigé avec un `id` dérivé de `entityId`, déjà stable. Limite assumée : l'environnement de test automatisé de cette session ne simule pas correctement les événements pointeur/clavier de dnd-kit (propriétés `key`/`code` vides sur les évènements synthétisés) — le geste de glisser-déposer lui-même n'a donc pas pu être vérifié en direct par l'assistant ; le code suit le patron officiel de la bibliothèque et les boutons Monter/Descendre (qui empruntent le même chemin serveur) fonctionnent, mais un essai manuel reste à faire.

**Export et import de monde (point 5 du ticket, après la prépa "un monde = une campagne")** : format JSON propre (`src/core/schemas/worldExport.ts`), servi par trois routes (`GET /api/worlds/[slug]/export`, `POST /api/worlds/import`, `POST /api/worlds/[slug]/duplicate` — dupliquer est un export+import serveur-a-serveur, sans passer par un fichier), réservées au propriétaire du monde. Périmètre volontairement limité au **lore** : entités, blocs, relations, révisions mécaniques, et le ruleset actif du monde — jamais l'état de partie (sessions, membres de campagne, PJ assignés, état d'execution) ni les images/assets, qui restent hors de ce format v1. Import = toujours un monde neuf avec sa campagne fraîche (mode choisi par la personne qui importe, jamais imposé par le fichier), jamais une écriture dans un monde existant.

Trois bugs réels trouvés en testant contre la vraie base (pas seulement en tests unitaires), tous corrigés :
- **Le slug d'une entité est un numéro séquentiel par monde** (`nextNumericSlug`, V0-06g), jamais dérivé du nom — le réutiliser tel quel à l'import entrait en collision avec la propre séquence du nouveau monde (sa première entité, créée par `createCampaign` avant la boucle d'import, occupe déjà le numéro 1). Corrigé en réutilisant `createEntity` (qui génère toujours un numéro frais) plutôt qu'un insert direct, et en retirant `slug` du format d'export — il n'a jamais de sens hors de son monde d'origine.
- **`blocks.version`** (concurrence optimiste) confondu au départ avec `schema_version` (qui, lui, existe sur `ruleset_entry_blocks`, une tout autre table) — retiré du format d'export, une ligne fraîchement importée n'a encore été éditée par personne.
- **`entities.name` peut être vide** en pratique (aucune contrainte `CHECK` ne l'interdit) — le schéma d'export exigeait `min(1)` à tort, rejetant l'export d'un monde réel qui contient une telle fiche.

**Ruleset personnel jamais exporté, vérifié en conditions réelles** (`specs/ruleset-personnel.md` §3.2, pas seulement en theorie) : un monde de test avec une variante `personal_reference` portant une entrée maison a été exporté, le JSON produit inspecté au mot près (`fetch(...).then(r=>r.text())`) pour confirmer l'absence totale du contenu — seul `{kind:"personal_omitted", name, baseSystem, note}` survit, avec un avertissement explicite affiché avant tout téléchargement. Une variante `user_created` (non verrouillée) a elle aussi été exportée puis réimportée en conditions réelles : ruleset et surcharge (`patch_block` sur `fireball`) reconstruits à l'identique sous un nouvel id.

Visibilité `campaign`/`user` : ramenée à `gm` à l'export (leur `scopeId` — un id de campagne ou d'utilisateur — ne survit à aucun transfert de compte), avec un avertissement compté et affiché avant le téléchargement. Une référence d'entité embarquée *dans* le JSON d'un bloc (ex. un objet d'inventaire qui pointe vers une autre entité) est réécrite par un parcours structurel générique (`remapEntityIds`, `src/core/linker/`) plutôt qu'une logique par type de bloc.

Connu et accepté, pas un bug : dupliquer un monde recrée en double son entité-faction "Groupe — X" (l'originale, exportée comme une entité wiki ordinaire parmi d'autres, et la fraîche, créée par `createCampaign` pour la nouvelle campagne) — l'ancienne devient une fiche wiki orpheline, plus rattachée à aucune campagne. Corriger ça demanderait d'exporter aussi `campaigns.party_entity_id` pour le traiter à part ; pas fait pour un premier jet, le coût dépasse la gêne (une fiche en trop, jamais une perte de donnée).

**Correction apres coup — ruleset non propage a la campagne** : signale par l'utilisateur ("l'ecran d'accueil indique 2014 alors que ce sont les regles de 2024 qui courent"). Cause reelle : `setActiveRuleset` (le selecteur de ruleset des Reglages) ne mettait a jour que `worlds.default_ruleset_id`, jamais `campaigns.ruleset_id` — un heritage d'avant "un monde = une campagne", ou le verrou protegeait les AUTRES campagnes d'un meme monde d'un changement retroactif involontaire (toujours vrai pour l'edition du CONTENU d'un ruleset publie, SCHEMA.md §9.5, non touche ici). Ce risque n'existe plus a une seule campagne par monde : `setActiveRuleset` propage desormais le changement a la campagne unique du monde (`updateCampaignRuleset`, `src/server/repos/campaigns.ts`). Verifie en direct sur le vrai monde Valdoria de l'utilisateur (ruleset de la campagne divergent constate en base, corrige, ecran d'accueil revenu coherent). Verification demandee explicitement pour un NOUVEAU PJ : `resolveCharacterActionContext` (`characterActions.ts`) resout `campaign?.ruleset_id ?? getWorldDefaultRulesetId(...)` — une fonction du seul (campagneId, mondeId), jamais du personnage ni de sa date de creation. Le meme correctif couvre donc tout PJ, present ou futur, sans code supplementaire ; le createur de personnage (`useWorldRuleEntries`) lisait deja `worlds.default_ruleset_id`, jamais affecte par ce bug.

**Une ligne par PJ sur la carte de monde** (retour utilisateur) : nom, espece et classe(s)/niveau, plutot qu'une simple liste de noms separes par des virgules — reutilise `listWorldPlayerCharacters` (`src/server/services/worldPlayerCharacters.ts`), deja la source de la page d'accueil d'un monde, aucune seconde resolution de regles ecrite pour l'ecran d'accueil. `WorldCard.players` (repo) part vide ; c'est `listWorldCards` (service, desormais parametre par la locale) qui l'enrichit, un appel par monde (N+1 assume, meme convention que `listMyGmCampaignsWithMembers`).

**Panneaux multiples (point 4 du ticket) : déjà fait, par un autre chemin que celui décrit.** Le texte du ticket décrit le plan d'origine (des `<Panel>` fixes côte à côte) — mais `ADR-0006` (docs/adr/0006-fenetres-flottantes.md) avait déjà devancé et remplacé ce plan **avant même que ce ticket soit écrit** : `?avec=` est une liste de références (`entite:slug`/`regle:slug`, `components/shell/windowRefs.ts`) qui ouvre chaque fiche dans sa propre fenêtre flottante (`WindowFrame`/`DesktopWindowsProvider`), pas dans un `<Panel>`. Plusieurs fiches sont donc déjà visibles en même temps aujourd'hui — vérifié en direct (`/m/valdoria?avec=entite:7,entite:1`, deux fenêtres empilées à l'écran) — livré dès la V0 (V0-06c) et étendu en V2-K1 (adressage mixte entité/règle). `<Panel>` lui-même ne sert plus qu'à l'affichage mobile et au fond vide du bureau avant ouverture d'une fiche ; son commentaire, qui prétendait le contraire, est corrigé.

### V2-G4 — Thème dérivé de l'image · `M` · *issu de la revue de code* — fait, reformulé

Le socle est là — `tokens.css` en OKLCH, `data-mode` sur `<html>`, les quatre modes. **Il manque toute la chaîne d'extraction.**

- [x] Téléversement d'une image de fond — **par joueur, pas par monde** (reformulation explicite du client : le fond doit rester un réglage personnel, changeable à sa guise, indépendant de la partie ouverte — voir "Ce qui a changé" ci-dessous).
- [x] Extraction de palette **côté serveur, au téléversement** — jamais dans le navigateur au chargement (`src/server/backgroundImageProcessing.ts`, `sharp`).
- [x] Vignette nette (pas floutée, retour utilisateur ultérieur) en base64 pour la grille de sélection — **stockée dans une table dédiée `background_images` (personnelle, pas dans `worlds.theme` qui n'existe pas)**, plus une seconde image pour le fond réel, à l'aspect préservé, servie par sa propre route (jamais l'image d'origine telle quelle, jamais plus de 1920px).
- [x] Contrôle de contraste sur les quatre modes (`availableModesFor`, `src/core/theme/oklch.ts`) ; un mode qui échoue n'est pas proposé (désactivé, info-bulle), et on le dit — en pratique n'échoue quasiment jamais avec les jetons actuels, la teinte/chroma ne pilotant jamais la clarté des surfaces (voir le code).
- [x] Variables injectées dans le HTML rendu côté serveur (`app/layout.tsx`, cookie lu avant le premier rendu) — aucun scintillement au premier rendu.

Spécification : `coquille-et-design.md` §2b (le choix "par monde" de la spec a été explicitement écarté par le client — voir ci-dessous).

**Ce qui a changé par rapport à la spec d'origine, sur demande explicite du client** : le fond n'est pas un réglage du monde mais du joueur, réglable depuis Réglages → Général indépendamment de toute partie ouverte. Bibliothèque strictement **personnelle** (jamais partagée entre comptes) plus les images déjà fournies avec l'application (`public/backgrounds/`, toujours proposées, non supprimables). La palette dérivée s'applique **en plus** des quatre modes existants, jamais à leur place — confirmé explicitement par le client après une clarification, à l'encontre de la lecture initiale ("teinte indépendante du mode").

**Deux compléments demandés après la première livraison** :
- Un curseur de flou du fond (0–40px), pour ne pas imposer un flou fixe — variable CSS dédiée `--bg-blur`, volontairement distincte de `--blur` (le flou "verre dépoli" des fenêtres/panneaux, `WindowFrame.tsx`/`Panel.tsx`) : les deux se valaient 20px par coïncidence, jamais la même intention.
- Miniatures nettes dans la grille de sélection (pas floutées à la source) — pour que la personne voie ce qu'elle choisit.

**Deux bugs réels trouvés et corrigés en testant contre la vraie base, pas en théorie** :
- Une miniature 64×64 suffisait pour l'icône de la grille mais devenait visiblement pixelisée une fois étirée plein écran dès que le flou baisse (et son recadrage carré centrait mal l'image sur un écran rectangulaire) — corrigé en générant une seconde image dédiée au fond, à l'aspect d'origine préservé, plafonnée à 1920px, stockée en `bytea` et servie par sa propre route (jamais embarquée dans le HTML, à la différence de la miniature).
- `url(...)` CSS sans guillemets s'arrête à la première parenthèse rencontrée — les noms de fichiers fournis contenant des parenthèses littérales ("Artwork_B (1).png") cassaient silencieusement le chargement de trois images sur neuf. Corrigé en entourant systématiquement les URL injectées de guillemets (`url("...")`).

Vérifié en direct à chaque étape (téléversement, sélection en direct sans rechargement, suppression avec repli propre, absence de scintillement au rechargement, les neuf images fournies, un second compte qui ne voit jamais les images de l'autre). `typecheck`/`lint`/`test` verts (638 tests).

### V2-G5 — Découper `PlayableCharacterSheet.tsx` · `M` · *issu de la revue de code* — fait

1255 lignes pour six fonctions de premier niveau. C'est la principale dette du dépôt, et **V2-G1 va y toucher** (montée de niveau, application des dégâts).

- [x] Un composant par onglet : `ActionsTab`, `MagicTab`, `InventoryTab`, `TraitsTab`.
- [x] L'en-tête (identité, PV, XP, repos) extrait à part.
- [x] Aucun changement de comportement : découpage pur, vérifié par les tests existants.

**À faire avant G1, pas pendant.** Découper et modifier dans le même commit rend la relecture impossible.

Fait. `PlayableCharacterSheet.tsx` reste l'orchestrateur (état, appels serveur) ; les quatre onglets et l'en-tête sont des composants purs recevant des props déjà prêtes à afficher. Aucun test automatisé ne couvrait ce composant avant (aucun fichier `*.test.tsx` ne le référence) — vérification manuelle en navigateur sur les trois onglets (actions, inventaire, traits), `typecheck`/`lint`/`test` verts (seul échec : le flake connu de l'intégration LM Studio, pré-existant, sans rapport).

### V2-G6 — `characterSheet()` côté client · `S` · *issu de la revue de code* — déjà satisfait, aucun travail nécessaire

`characterSheet()` n'est appelée que côté serveur. La fonction étant pure et sans dépendance, elle peut tourner dans le navigateur — c'était l'intérêt de la contrainte `src/core`.

- [x] Décocher « équipé » recalcule la CA **sans aller-retour serveur**.
- [x] Le serveur reste l'autorité pour tout ce qui engage la partie ; le client ne recalcule que l'affichage.
- [x] Même fonction des deux côtés — aucune divergence possible.

À faire seulement si la latence actuelle gêne réellement. Mesurez avant.

**Mesuré : la latence n'existe déjà pas.** Le ticket demandait de mesurer avant d'agir — la mesure montre que l'architecture actuelle satisfait déjà les trois critères, sans code à écrire :
- `useCharacterSheetContext.ts` (`"use client"`) appelle déjà `characterSheet()` directement dans le navigateur, pour calculer `sheet` (CA incluse) à partir de `inventory` — la même fonction que celle utilisée côté serveur (`resolveCharacterActionContext`, `characterActions.ts`), aucune seconde implémentation.
- Cocher/décocher « équipé » (`InventoryPanel.tsx`) appelle `onUpdateInventory` → `patchBlock` (`EntityBlocks.tsx`) : une simple mise à jour d'état React **synchrone**, jamais un `await` sur le réseau. La persistance réelle (`saveBlock`, PATCH `/api/blocks/[id]`) est chaînée en arrière-plan, sans jamais bloquer le rendu.
- Les actions qui engagent réellement la partie (attaque, dégâts, sort, repos...) passent toutes par `postAction`/les routes serveur dédiées (`characterActions.ts`) — seul l'**affichage** (CA, modificateurs) est recalculé côté client, jamais un jet de dé ni une mutation de règle.

Vérifié en direct sur la vraie fiche de Jean-Pascal (Valdoria) : équiper/déséquiper une arme met à jour le bouton instantanément (aucune requête réseau dans le chemin critique), la persistance en base est confirmée après coup par lecture directe, l'objet remis dans son état d'origine après le test.

### V2-G2 — Wiki public en présentation « livre » · `M` — fait, étendu

Seconde peau de la coquille, pas une refonte. Mêmes composants, jetons différents.

- [x] Colonne de gauche en sommaire hiérarchique plutôt qu'en arborescence d'édition.
- [x] Corps de texte à largeur mesurée, **65 à 75 caractères par ligne**.
- [x] Aucune commande d'édition visible.
- [x] Le thème dérivé de l'image s'applique aussi à cette peau.

**Ce qui existait déjà et n'a pas été reconstruit** : le mécanisme de publication lui-même (`share_links`, `app/partage/[token]/**`, `src/server/services/publicShare.ts`) était déjà complet — jeton révocable, mot de passe optionnel, filtrage par visibilité identique au reste de l'app. Il ne portait aucun habillage. `components/shell/EntityTree.tsx` (+ `buildEntityTree`, `src/core/entity-tree/build-tree.ts`) était déjà exactement le sommaire hiérarchique demandé par le premier critère — son seul couplage à l'édition (`useOpenEntityLink`, qui ouvre une fenêtre flottante) a reçu un paramètre optionnel `hrefBase` : fourni, navigation normale sans interception ; absent, comportement d'édition inchangé. Le thème dérivé de l'image (V2-G4) s'appliquait déjà de lui-même : `resolveBackgroundSelection` retombe sur le fond par défaut sans jamais toucher Supabase quand aucun cookie `background` n'existe — rien à coder, seulement vérifié en navigateur.

**Extension demandée après coup : un onglet Publication + une prévisualisation.** L'utilisateur a demandé, en plus des 4 critères, une adresse facile à trouver pour que les joueurs consultent le wiki, et un moyen de voir le rendu sans generer un lien. Réalisé :
- `components/entities/public/BookSkin.tsx` (nouveau) : sommaire (`EntityTree` + `hrefBase`) + colonne de contenu `max-w-[70ch]`, réutilisé tel quel par `/partage/[token]/**` et par la nouvelle prévisualisation ci-dessous — un seul skin, deux routes fines, comme le demandait le ticket.
- `src/server/services/publicShare.ts` : nouvelle `getPublicEntityTree(worldId)`, même schéma que `getEntityTree` (édition) mais via le client `service_role` déjà confiné à ce fichier.
- **Prévisualisation = route authentifiée, pas un lien jetable** : `GET /m/[worldSlug]/apercu` et `/apercu/[entitySlug]` (nouveaux), gardés par le même `getWorldBySlug` (RLS) que le reste du monde édité, appelant directement les fonctions de `publicShare.ts` avec le `worldId` — jamais de jeton ni de mot de passe. Montre exactement la vue anonyme (`public_only`), sans « dépenser » de vrai lien et même quand aucun lien n'existe encore.
- `components/shell/SettingsMenu.tsx` : nouvel onglet « Publication » (gardé par `worldSlug`, même motif que « Règles ») — y déplace `ShareLinkPanel` (retiré de l'onglet « Général ») et ajoute le lien « Prévisualiser ↗ » vers `/apercu`.

**Vérifié en navigateur** : `/m/valdoria/apercu` (sommaire complet, navigation entre fiches, surbrillance de la fiche courante, contenu de Jean-Pascal correctement filtré) puis un vrai lien créé depuis le nouvel onglet Publication et ouvert dans un onglet séparé (`/partage/[token]`) — rendu identique, aucune chrome d'édition. Lien de test révoqué après vérification.

**Hors périmètre, explicitement** : pas d'image d'en-tête façon capture d'écran de référence (`entity_assets.role='banner'` existe en schéma mais n'a jamais été câblé — un chantier à part) ; pas de prévisualisation « en tant que joueur d'une campagne » (seule la vue anonyme `public_only`) ; pas de fond d'écran propre au monde (contredirait la décision déjà prise en V2-G4, par joueur jamais par monde). Aussi noté au passage, préexistant et non traité ici : `PublicBlockView` ne rend que text/infobox/image/custom_table — un bloc `character`/`inventory`/`music`/etc. n'affiche que son titre publiquement, aucun contenu.

**Trois retouches supplémentaires, après un premier retour utilisateur sur la peau :**
- **Champ de recherche** dans le sommaire, entre le titre et la première catégorie — filtre local (`filterEntityTree`, `src/core/entity-tree/build-tree.ts`, testé) sur l'arborescence déjà chargée, pas de nouvel appel serveur pour une poignée d'entités. Un nœud correspondant garde tous ses enfants visibles ; un parent non-correspondant survit si un descendant correspond.
- **Nom de la campagne à la place du nom du monde**, partout dans la peau « livre » (« un monde = une campagne », migration `20260826100001`) — et affiché *en plus* du nom du monde dans la barre supérieure de l'écran MJ uniquement (`AppShell.tsx`, détection de section par `usePathname`).
- **Message d'accueil personnalisable** (nouvelle colonne `worlds.wiki_welcome_message`, migration `20260826170001`) : remplace, sur la page d'accueil du **vrai** lien de partage seulement (pas la prévisualisation, sur demande explicite), le gros titre par un message éditable depuis l'onglet Publication — vide, un message par défaut est calculé (« Bienvenue dans la campagne — {campagne} ! L'aventure commence ici ! »), jamais stocké tant que non personnalisé. Le texte « Lecture seule — lien de partage » a été retiré de cette même page.
- **Espacement du sommaire** : le titre butait contre le bouton Réglages (`fixed left-4 top-2.5`, hors du flux du document) sur `/partage`, qui n'a pas d'en-tête d'application au-dessus. `pt-16` sur la colonne de gauche au lieu de `py-10`, dégageant le bouton.

Vérifié en navigateur pour les quatre : recherche filtrant en direct, nom de campagne affiché aux deux endroits attendus (et seulement là), message par défaut puis personnalisé puis effacé (repli confirmé), `/apercu` inchangée comme demandé. Lien de partage et personnalisation de test nettoyés après vérification.

**Lien de partage perdu trop facilement, trois retours successifs.** Premier retour : le jeton en clair (visible une seule fois, jamais stocké en base à l'origine) n'avait pas de bouton Copier, seule une sélection manuelle du champ. Ajouté : bouton « Copier » (`navigator.clipboard`) juste à côté du champ, à la création. Second retour (capture à l'appui, un lien déjà dans la liste « Créé le… ») : demande d'un bouton Copier sur un lien déjà créé — à l'époque impossible par construction (le jeton n'existait plus nulle part après le premier affichage), corrigé provisoirement en le mémorisant en `sessionStorage` le temps de la session du navigateur.

**Troisième retour : décision explicite de revenir sur la règle elle-même.** L'utilisateur a jugé que « jamais stocké » n'avait pas lieu d'être pour un lien qui n'ouvre qu'une vue en lecture seule, sans capacité de modification — pas le même profil de risque qu'un mot de passe ou une clé d'API. Le raisonnement tient : la règle protégeait contre une fuite de la base de données (un jeton haché y reste inutilisable même en cas de fuite), pas contre le compte du monde lui-même (qui donne de toute façon un accès en édition bien supérieur à un simple lien de lecture). Réalisé : nouvelle colonne `share_links.token` (migration `20260826180001`), le jeton en clair est désormais conservé en base en plus de `token_hash` (inchangé, toujours utilisé pour la résolution). `ShareLinkSummary`/`listShareLinks` l'exposent désormais, chaque ligne « Créé le… » porte son propre bouton Copier — le contournement `sessionStorage` du retour précédent est devenu inutile et a été retiré. Les liens créés avant cette migration n'ont jamais eu leur jeton conservé : `token` y reste `null`, pas de bouton Copier pour ceux-là (aucun moyen de le reconstituer). Vérifié en navigateur : nouveau lien créé, jeton visible et copiable immédiatement puis retrouvé et copiable à nouveau depuis la liste après fermeture/réouverture des Réglages.

### V2-G3 — Bloc musique · `S` — fait

- [x] Bloc `music` : un lien Spotify, SoundCloud ou YouTube, avec lecteur.
- [x] **Le lecteur ne se charge qu'au clic.** Une intégration tierce chargée automatiquement dépose des traceurs sur toute fiche qui en contient une.
- [x] URL validée contre une liste de domaines autorisés — sinon c'est un vecteur d'injection.

**Question posée en cours de route : la « radio » de vvd.world.** Avant d'implémenter, la demande initiale évoquait une inspiration : la radio de vvd.world propose plusieurs « stations » dont certaines nommées d'après des franchises (Final Fantasy, The Witcher…). La fonctionnalité est cachée derrière leur connexion — impossible à inspecter davantage. Deux lectures possibles étaient en jeu : héberger nous-mêmes de la musique de licence (infraction directe), ou nommer une station d'après une franchise même sans en jouer la musique (fausse affiliation implicite, exactement le risque déjà couvert par la politique SRD stricte de ce dépôt). Les deux ont été signalées explicitement à l'utilisateur avant d'écrire du code.

**Décision retenue, sur choix explicite de l'utilisateur** : une « station » n'est jamais une catégorie fournie par l'application — c'est le bloc `music` lui-même, avec son `display.label` choisi par la personne (comme tout bloc). Plusieurs stations sur une même fiche = plusieurs blocs `music`. Aucun fichier audio n'est jamais hébergé par nous : chaque piste est un lien externe vers une plateforme qui porte elle-même la licence (Spotify, SoundCloud, YouTube), résolu et validé par `src/core/music/embedUrl.ts` (`detectProvider`/`toEmbedUrl`, testés dans `embedUrl.test.ts`, y compris un essai explicite de mystification de domaine — `open.spotify.com.evil.com` — correctement rejeté). Le fournisseur n'est jamais stocké côté client : toujours redérivé de l'URL réelle à la validation.

**Vérifié en navigateur** sur la fiche de Jean-Pascal : ajout du bloc, rejet d'une URL à domaine mystifié avec le message d'erreur attendu, ajout d'une piste YouTube valide, lecteur non chargé tant que « ▶ Lecture » n'est pas cliqué, chargement effectif au clic, ajout d'une seconde piste (SoundCloud) avec navigation ‹/› entre les pistes et réinitialisation correcte du chargement au changement de piste, suppression de piste, suppression du bloc — fiche restaurée à son état d'origine après le test.

**Extension demandée après coup : radio d'arrière-plan + refonte du bloc.** Deux retours explicites une fois le premier jet vu : (1) le premier jet donnait un bloc avec navigation entre pistes, mais l'utilisateur voulait un bouton lecture par piste, sans aucun lecteur visible — juste « un lien, un bouton play, un nom » ; (2) il manquait la vraie demande initiale, un bouton de musique de fond en haut à droite (à côté de l'horloge, comme la radio de vvd.world), avec des « stations » nommées par la personne — même principe de sécurité que le bloc (jamais une catégorie fournie par l'application). Les deux doivent s'exclure mutuellement : lancer une piste de bloc met en pause la radio, et inversement.

Réalisé en réutilisant un seul mécanisme pour les deux : `MusicPlaybackProvider` (`components/shell/MusicPlaybackContext.tsx`), monté une fois dans `app/layout.tsx` (donc jamais démonté par la navigation entre pages), qui ne garde qu'une seule iframe cachée à la fois — en démarrer une en démonte forcément une autre, ce qui donne l'exclusion mutuelle sans dépendre de l'API JS propre à chaque fournisseur. L'iframe est rendue hors champ (1px, opacité nulle) plutôt qu'en `display:none`, pour ne pas risquer que le moteur coupe l'audio d'un élément qu'il considère non affiché. `toEmbedUrl` accepte désormais `{ autoplay: true }` (`src/core/music/embedUrl.ts`) : le clic sur play est le geste utilisateur qui autorise la lecture automatique dans l'iframe.

- `components/shell/RadioWidget.tsx` : bouton en ligne dans `AppShell.tsx`, à gauche de l'horloge (un bouton `fixed` indépendant du fil d'en-tête finissait par chevaucher le lien "Mes mondes"), stations `{label, url}` nommées par la personne, persistées en `localStorage` (préférence de navigateur, même raisonnement que `mode`/`background` avant leur lecture serveur — rien ici n'appelle une synchronisation entre appareils). Icône maison en SVG (ondes de diffusion, `currentColor`) plutôt qu'un emoji — retour explicite, même registre que les glyphes déjà utilisés dans la coquille (⚙, ▾, ×).
- `components/blocks/MusicBlockEditor.tsx` : refonte complète — plus de lecteur visible ni de navigation entre pistes, chaque piste de la liste porte son propre bouton ▶/⏸ et un champ de nom éditable (ex. « Arrivée du méchant »), exactement la demande.

**Vérifié en navigateur** : création de la station « Fireren Radio » avec le lien playlist fourni, lecture lancée (iframe cachée confirmée par script avec `autoplay=1` dans l'URL), persistance de la lecture après une navigation interne (clic sur un lien, pas un rechargement complet) vers la fiche de Jean-Pascal. Ajout d'une piste nommée « Arrivée du méchant » dans le bloc `music` de cette fiche : lecture de la piste met bien la radio en pause (bouton radio repasse en `▶`, iframe repointée vers la piste du bloc), puis relancer la radio met bien la piste du bloc en pause — exclusion mutuelle confirmée dans les deux sens.

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

### V2-H3 — Généalogie et relations · `M` — fait

- Bloc `relationships` (liste simple) **avant** `genealogy` (arbre visuel).
- `genealogy` ne stocke que la configuration d'affichage ; les liens vivent dans `relations`.

**Critères**
- [x] Ajouter un parent se fait en créant une relation ; tous les arbres qui incluent la personne se mettent à jour.
- [x] **Le graphe est construit côté serveur, après filtrage.** Une parenté en visibilité `gm` n'est pas dans la réponse HTTP.
- [x] Un nœud dont la relation est cachée **disparaît**, il ne s'affiche pas grisé.
- [x] Cycles sur `part_of` et sur `parent_of` refusés par déclencheur.

> Construisez `relationships` d'abord et servez-vous-en une semaine. Vous découvrirez peut-être que l'arbre visuel n'est pas nécessaire.

**Pas de bloc `relationships` séparé, décision explicite** : cette liste simple existait déjà, sans condition, en tête de fiche (`RelationsChips.tsx`/`PublicRelations.tsx`, V2-G11) — un bloc dédié n'aurait fait que dupliquer la même donnée. `genealogy` (`FamilyTreeCanvas`/`FamilyTreeCard`) dérive l'arbre en direct de `relations` via une seule fonction partagée (`getFamilyTree`, `src/server/services/genealogy.ts`) entre l'éditeur et le wiki public — jamais deux chemins de filtrage qui pourraient diverger. Navigation clic-glisser et zoom (centré sur la souris) ajoutés à la demande, arbre centré/ajusté à l'ouverture ; suppression de lien directement depuis l'arête épinglée ; menu de choix du type de relation positionné exactement sur le bouton cliqué plutôt qu'en bas de l'écran.

**Vérifié en direct, les quatre critères** (monde Valdoria, fiche de Sah Lââm) :
- Relation `parent_of` ajoutée en visibilité MJ uniquement (Sah → Naivara Amakiir) : le nouveau nœud apparaît dans l'arbre pour un visiteur MJ après rechargement, avec son propre portrait.
- `/m/valdoria/apercu/test-v0-06e` (prévisualisation anonyme, même filtrage que `/partage`) : le nœud Naivara est **entièrement absent** du conteneur de l'arbre (vérifié par script, pas seulement à l'œil), alors que le reste de la fiche est visible — la relation n'a jamais quitté le serveur, pas un simple masquage CSS.
- Tentative de cycle (Naivara `parent_of` Sah, alors que Sah `parent_of` Naivara existe déjà) : rejetée par le déclencheur `check_parent_of_no_cycle` (`supabase/migrations/20260827170001_genealogy_relations.sql`).
- Relation et nœud de test retirés après vérification, fiches restaurées à leur état d'origine.

**Bug réel trouvé et corrigé en testant** : le bouton « + Ajouter une relation » (`RelationsChips.tsx`, partagé par toute fiche) soumet la sélection par défaut du formulaire (première entité, premier type) — qui entre facilement en collision avec une relation déjà existante ou déclenche le refus de cycle. Le serveur laissait alors remonter une exception Postgres non rattrapée (500, `uncaughtException` côté serveur) sans aucun message pour la personne. Corrigé : `insertRelation` (`src/server/repos/relations.ts`) distingue maintenant les deux refus attendus (`23505` unicité, `P0001` cycle — le code du déclencheur) d'une vraie panne, la route (`app/api/entities/[id]/relations/route.ts`) répond `409` avec un message clair, et `RelationsChips.tsx` l'affiche à côté du bouton plutôt que d'échouer en silence.

**Limite connue, non corrigée** : le bloc généalogie charge son arbre une seule fois côté client et ne se resynchronise pas automatiquement quand une relation est ajoutée ailleurs sur la même page (le formulaire d'en-tête, `RelationsChips.tsx`) — seul son propre bouton « + » interne déclenche un rechargement immédiat. Un rechargement de page suffit à voir l'arbre à jour (la donnée elle-même est toujours correcte, jamais mise en cache côté serveur), mais ce n'est pas encore instantané entre les deux surfaces d'édition. À corriger si ça gêne en usage réel — pas fait ici pour rester dans le périmètre de la vérification.

### V2-H4 — Quêtes et journal de séance · `M` — fait

- Bloc `quest` : objectifs, état, récompenses, commanditaire, prérequis.
- Bloc `session_log` relié aux `session_events`.

**Critères**
- [x] États : non commencée, en cours, réussie, échouée, abandonnée.
- [x] Un objectif référence des entités ; les cocher est journalisé.
- [ ] Les quêtes actives entrent dans le contexte déterministe de la V3.

**Bloc `quest` — fait.** Schéma (`src/core/schemas/blocks/quest.ts`) : état (les cinq valeurs du critère), commanditaire et chaque objectif/récompense/prérequis peuvent référencer une entité (`zBlockReference`, même primitive que l'inventaire). **Décision explicite, sur clarification demandée à l'utilisateur** : récompenses et prérequis restent du texte libre avec référence optionnelle — pas un vrai graphe de dépendances entre quêtes (une quête qui en bloque une autre), non demandé par le ticket et nettement plus de code pour un besoin non détaillé.

Cocher un objectif est un fait de partie, pas une édition rédactionnelle silencieuse : route dédiée `POST /api/blocks/[blockId]/quest-objective` (`src/server/services/quests.ts`, `toggleQuestObjective`) qui écrit la donnée du bloc ET journalise un `session_event` (kind `world_update`, même convention que `runtimeState.ts`) si une session de campagne est ouverte pour le monde — sans campagne, la case se coche quand même, seul le journal est absent. Vérifié en direct (fiche de Candide Fausset) : objectif coché → `session_events` porte bien la ligne (`payload.note`, `payload.patch.objectiveId`), requête directe en base après coup. Rendu public : `getPublicEntityDetail` (`publicShare.ts`) résout les id référencés en nom/slug pour un lien cliquable, jamais un UUID brut envoyé au visiteur — vérifié sur `/apercu`, lien vers l'entité référencée fonctionnel.

Troisième critère non coché mais préparé : `listActiveQuestsForWorld` (`src/server/services/quests.ts`) liste les quêtes en état "en cours", déjà filtrées par visibilité (règle 9 de `CLAUDE.md`) — rien ne l'appelle encore hors des tests, la V3 (mode solo, contexte déterministe) n'existe pas. Écrite maintenant pour que ce travail n'ait pas à être refait quand la V3 arrivera, sans construire le reste du mécanisme de contexte lui-même.

**Bug réel trouvé et corrigé en testant, sans rapport avec les quêtes** : sélectionner une valeur dans n'importe quel `Dropdown` (état de la quête, mais aussi tout autre menu déroulant de la coquille — visibilité, dé d'une table aléatoire, etc.) juste avant de quitter le bloc pouvait perdre la sélection silencieusement. Cause : le panneau du menu est rendu dans un portail (`document.body`), hors du conteneur DOM du bloc — cliquer une option y déplace le focus AVANT que le clic n'applique la valeur, ce qui déclenchait la sauvegarde au blur (`EntityBlocks.tsx`, `handleBlockBlur`) avec l'état encore ANCIEN. Reproduit et confirmé par une vérification base réelle (rechargement après sélection : la valeur était bien retombée à l'ancienne). Corrigé dans `components/shared/Dropdown.tsx` : `onMouseDown={(e) => e.preventDefault()}` sur chaque option, pour que le focus ne quitte jamais le bloc pendant la sélection — revérifié en direct, la valeur survit maintenant au rechargement.

**Bloc `session_log` — fait.** Décision de conception : le résumé rédactionnel n'est **jamais dupliqué** dans la donnée du bloc — `sessions.summary` (`docs/SCHEMA.md` §12, « réinjecté dans le contexte IA ») reste l'unique source de vérité ; le bloc ne stocke qu'un `sessionId` et sert de fenêtre dessus (`src/core/schemas/blocks/sessionLog.ts`). Pas de vrai sélecteur de séance — cohérent avec la limite déjà posée dans `src/server/services/sessions.ts` (« aucune interface de gestion de séance n'existe encore ») : le bloc s'attache tout seul, une fois, à la séance en cours de la campagne du monde (`attachSessionLogBlock`, route `POST /api/blocks/[blockId]/session-log/attach`, réutilise `getOrOpenSessionForCampaign`). Sans campagne active, le bloc reste vide plutôt que d'échouer.

Une fois attaché : zone de texte pour le résumé (sauvegardée à la perte de focus via `PATCH /api/sessions/[id]`, jamais par le mécanisme générique des blocs) et le fil des `session_events` de cette séance en lecture seule en dessous (`GET /api/sessions/[id]/events`), du plus ancien au plus récent.

**Vérifié en direct** (fiche de Candide Fausset, même monde que le test du bloc quête) : création du bloc → rattachement automatique confirmé par requête réseau → le journal affiché reprend fidèlement les vrais `session_events` de la session, **y compris la ligne « Objectif coché » écrite quelques minutes plus tôt en testant `quest`** — même séance, deux blocs différents, un seul journal. Résumé tapé, sauvegardé au blur, confirmé après rechargement complet de la page. Bloc de test et résumé nettoyés après vérification (la séance touchée est la vraie séance en cours de la campagne de l'utilisateur, pas une séance jetable).

**Hors périmètre, explicitement** : pas de rendu public pour `session_log` (comme `character`/`inventory`/`music`, seul le titre s'affiche sur le wiki public, `PublicBlockView.tsx`) — un journal de séance est un outil de suivi de partie, pas du contenu de lore destiné aux joueurs.

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

## Lot K — Refonte de la coquille : sidebar unifiée et fenêtres

*Née d'une demande explicite de restructuration de l'interface (2026-08-25). Indépendant de H/I/J — peut se glisser n'importe quand, mais mieux vaut finir le lot avant d'en ouvrir un autre : rouvrir la coquille deux fois coûte plus cher que de la faire d'un bloc.*

### Décisions de conception, à prendre avant d'écrire

**Adressage mixte d'une fenêtre.** `?avec=` ne portait jusqu'ici que des slugs d'entité. Afficher une fiche de règle et une fiche de monde dans le même espace de travail oblige à distinguer les deux types sans ambiguïté — préfixer (`?avec=entite:pont-de-pierre,regle:boule-de-feu`) plutôt que deviner le type en cherchant le slug dans les deux tables (plus lent, et ambigu si le même slug existe des deux côtés).

**Taille fixe des fenêtres : la valeur se choisit en la voyant, pas a priori.** Tester contre les blocs les plus denses (fiche de personnage jouable, inventaire, tableau de compétences) avant de figer un nombre dans le code.

### V2-K1 — Fenêtres partagées entre Monde et Règles · `L` — fait

Aujourd'hui `DesktopWindows`/`WindowFrame` (`components/shell/DesktopWindows.tsx`, `components/shell/WindowFrame.tsx`) ne vivent que sous la route `(monde)` : une fiche de règle (`/m/[worldSlug]/regles/[cle]`) s'affiche toujours en page pleine, jamais en fenêtre. C'est le verrou qui empêche d'afficher monde et règles en même temps — pas un manque de fonctionnalité de fenêtre, qui existe déjà (ADR-0006).

- [x] Remonter le gestionnaire de fenêtres au niveau de `app/m/[worldSlug]/layout.tsx`, partagé par Monde/Règles/MJ.
- [x] `?avec=` accepte des références mixtes (entité et entrée de règle — voir décision ci-dessus), chacune résolue par sa route API existante.
- [x] Ouvrir une fiche de règle depuis la vue Règles l'ajoute comme fenêtre, sans quitter la vue courante.
- [x] Changer de vue (Monde/Règles/MJ) ne ferme plus les fenêtres ouvertes.

**Préalable à K2 et K4** — ils supposent que les fenêtres survivent au changement de vue.

Fait — décision d'architecture (état partagé + rendu dupliqué par section, MJ non concerné) dans `docs/adr/0011-fenetres-partagees-monde-regles.md`. `DesktopWindows.tsx` scindé en `DesktopWindowsProvider.tsx` (état, monté une fois) et `WindowsDesktop.tsx` (rendu, monté par Monde et par Règles). Adressage mixte dans `components/shell/windowRefs.ts`. `RegisterPrimaryWindow`, `useOpenEntityLink`/`useOpenRuleLink` généralisés sur un `WindowRef`. Une fiche de règle partage désormais `RuleEntryView` entre son rendu serveur (fenêtre primaire) et sa récupération client (`/api/worlds/[worldSlug]/regles/[cle]/window`, fenêtre secondaire), même motif que `EditEntityForm`. `RulesSidebar` récupère désormais sa liste côté client (`useWorldRuleEntries`, déjà utilisé ailleurs) plutôt que par props serveur, pour ne pas payer ce coût sur les pages Monde. Piège trouvé et corrigé : la clé d'effet déclenchant la récupération d'une fenêtre secondaire dépendait à tort de primaire+avec combinés — une référence passant de primaire à secondaire pouvait laisser cette clé combinée inchangée et l'effet ne se redéclenchait pas ; corrigé en la faisant dépendre de `avec` seul. Vérifié en navigateur : ouverture d'une fiche de règle et d'une fiche d'entité simultanément, aller-retour Monde → Règles → MJ → Monde sans perte de fenêtre, fermeture d'une fenêtre individuelle. `typecheck`/`lint` verts ; `test` vert sur les tests unitaires (595/606, le reste exige une base Supabase locale indisponible dans cet environnement, sans rapport avec ce ticket).

### V2-K2 — Sidebar unifiée comme sélecteur de vue · `M` — fait

*Dépend de K1.*

- [x] Le bandeau `Monde / Règles / MJ` (`components/shell/SectionToggle.tsx`) quitte la barre supérieure, remonte dans la sidebar, au-dessus du champ de recherche.
- [x] Choisir une vue change le contenu de l'arborescence (`EntityTree`, liste de `RulesSidebar`, navigation de `MjSidebar`) **sans perdre l'espace de travail** — les fenêtres ouvertes survivent (garanti par K1).
- [x] L'URL continue de refléter la vue active (lien partageable, bouton retour), sans démonter le gestionnaire de fenêtres.
- [x] Les boutons propres à chaque vue (bas de sidebar) restent inchangés, sauf ce que déplacent K6 et K7.

Fait — décision prise avec l'utilisateur avant d'écrire : Monde/Règles/MJ restent de vraies routes Next.js (pas un état client décroché de l'URL), option la moins invasive puisque K1 garantit déjà la survie des fenêtres à travers une navigation. `SectionToggle` quitte `AppShell.tsx` (l'en-tête redevient juste nom du monde + horloge + « Mes mondes ») et se monte désormais en haut de chacune des trois barres latérales (`Sidebar.tsx`, `RulesSidebar.tsx`, `MjSidebar.tsx`), au-dessus de leur champ de recherche respectif (MJ n'en a pas, le bandeau y est simplement en tête de liste). Le composant passe d'une pastille centrée (pensée pour une barre de 56px) à trois segments `flex-1` pleine largeur, pensés pour une colonne de 280px. Aucun changement de comportement de navigation au-delà de ça — le fond du travail (état partagé, repli de la primaire dans `avec`) était déjà celui de K1. Vérifié en navigateur sur les trois sections ; `typecheck`/`lint`/`test` verts (605/606, 1 ignoré).

### V2-K3 — Taille fixe des fenêtres · `S` — fait

- [x] Poignées de redimensionnement retirées de `WindowFrame.tsx`.
- [x] Une seule taille à l'ouverture, quel que soit le contenu (voir décision ci-dessus).
- [x] Déplacement (drag) et agrandissement/restauration (maximiser) inchangés.

Fait — taille choisie en la voyant (comme décidé) : 860×760, testée contre la fiche de personnage jouable (grille de caractéristiques, compétences, cartes de sorts) et la table de progression de classe la plus large du dépôt (Magicien), aucune des deux ne déborde ni ne semble à l'étroit. 860px reprend d'ailleurs la largeur déjà validée de `Panel.tsx` pour le même contenu. Poignée de redimensionnement (coin bas-droit) et sa logique retirées de `WindowFrame.tsx` ; l'aimantation sur les bords (glisser près d'un bord tuile la fenêtre à moitié écran) reste inchangée, ce n'est pas une poignée de redimensionnement et le ticket ne demandait pas de la retirer. Déplacement et agrandir/restaurer vérifiés en navigateur. `typecheck`/`lint`/`test` verts (605/606, 1 ignoré).

### V2-K4 — Réduction de fenêtre en onglet de bas d'écran · `M` — fait

*Dépend de K1.*

- [x] Un bouton « réduire » sur chaque fenêtre, à côté de fermer/agrandir.
- [x] Fenêtre réduite → un onglet compact en bas de l'espace de travail (nom de la fiche) ; la fenêtre elle-même se masque.
- [x] Cliquer l'onglet restaure la fenêtre à sa position précédente.
- [x] L'état réduit est un état d'affichage local, **jamais dans `?avec=`** ni dans l'URL — même logique que l'ordre d'empilement, déjà non persisté (`docs/adr/0006-fenetres-flottantes.md`).

Fait — `minimizedIds` (nouvel état local dans `DesktopWindowsProvider.tsx`, jamais lu ni écrit depuis `?avec=`) et une barre d'onglets (`WindowsDesktop.tsx`) listant toute fenêtre réduite, primaire comme secondaire. Piège réel : réduire la fenêtre PRIMAIRE ne doit jamais retirer `children` de l'arbre React — c'est elle qui porte `RegisterPrimaryWindow`, la démonter aurait désenregistré la primaire et fait disparaître son propre onglet réduit. Corrigé en la gardant montée mais masquée (`className="hidden"`) plutôt qu'omise du rendu. `windowContentLabel` (nouveau, `windowRefs.ts`) factorise le calcul nom/badge d'une fenêtre secondaire, déjà dupliqué avant ce ticket. Vérifié : réduire/restaurer la primaire et une secondaire (bouton et via le DOM), position restaurée à l'identique, `?avec=`/URL inchangés pendant toute l'opération (confirmé par `window.location.href`), le bouton "Restaurer" est bien présent et accessible (arbre d'accessibilité) même quand la capture d'écran de cet environnement ne le compose pas visiblement (flou d'arrière-plan). `typecheck`/`lint`/`test` verts (605/606, 1 ignoré).

### V2-K5 — Réglages à onglets · `S` — fait

`components/shell/SettingsMenu.tsx` est aujourd'hui une seule modale à sections empilées (Langue, Thème, Compte, liens de partage, Collaboration, Suppression). Premier composant d'onglets du dépôt — un `<Tabs>` générique, pas un cas particulier à cet écran.

- [x] `<Tabs>` générique (`components/shared/`, même famille que `Dropdown`).
- [x] Sections existantes réparties en onglets (Général + les deux onglets neufs ci-dessous).
- [x] Aucun changement de comportement sur les sections déplacées — pur découpage, comme V2-G5.

Fait — `<Tabs>` (`components/shared/Tabs.tsx`) est un primitif controlé (`value`/`items`/`onChange`), reprenant le style déjà établi par `SectionToggle.tsx` (segments égaux dans un conteneur arrondi) plutôt qu'une deuxième présentation d'onglets. Deux onglets aujourd'hui : **Général** (Langue, Thème, Compte, liens de partage, Suppression — tout ce qui existait déjà) et **Collaboration** (le bouton désactivé « Inviter un MJ », déplacé tel quel). Le troisième onglet (Règles) n'est pas créé ici : K6 l'introduira avec son vrai contenu plutôt que de poser un onglet vide en attendant. Nouvelle clé de traduction `settings.general` (fr/en). Aucune section déplacée n'a changé de comportement. Vérifié en navigateur : bascule entre les deux onglets, contenu identique à avant. `typecheck`/`lint`/`test` verts (605/606, 1 ignoré).

### V2-K6 — Ruleset actif déplacé dans les Réglages · `S` — fait

*Dépend de K5.*

- [x] `RulesetSelector` (`components/rules/RulesetSelector.tsx`) quitte le bas de `RulesSidebar` pour un onglet des Réglages généraux.
- [x] Même comportement (choix du ruleset actif, création de variante, suppression) — seul l'emplacement change.
- [x] Cohérent avec K2 : la sidebar Règles redevient une simple liste, sans réglage mélangé dedans.

Fait — `RulesetSelector` n'a pas bougé lui-même (déjà autonome, déjà en portail) : seul son point de montage change, de `RulesSidebar.tsx` vers un nouvel onglet « Règles » de `SettingsMenu.tsx`, visible uniquement dans le contexte d'un monde (`worldSlug` détecté depuis l'URL, même mécanisme que le panneau de partage). Aucune ligne de `RulesetSelector.tsx` modifiée. Vérifié en navigateur : le bouton « Règles actives » et sa boîte de dialogue (choisir/créer une variante/supprimer) fonctionnent à l'identique depuis les Réglages ; la sidebar Règles est redevenue une simple liste + les deux boutons de création. `typecheck`/`lint`/`test` verts (605/606, 1 ignoré).

### V2-K7 — Onglet Collaboration dans les Réglages · `S` — fait

*Dépend de K5.*

- [x] Le bouton désactivé « Inviter un MJ (bientôt) » (`SettingsMenu.tsx`) devient un onglet Collaboration fonctionnel.
- [x] Reprend le flux d'invitation par e-mail déjà existant au niveau campagne (`CampaignDetail.tsx`) plutôt que d'en écrire un second.
- [x] Liste les invitations actives, quel que soit le monde ou la campagne concernée.

**Divergence trouvée avant d'écrire, tranchée avec l'utilisateur** : il n'existe aucune invitation « en attente » dans ce dépôt — inviter (`inviteCampaignMember`, `src/server/services/campaigns.ts`) ajoute la personne IMMÉDIATEMENT comme membre si un compte existe déjà pour son e-mail (404 sinon), sans statut ni étape d'acceptation. Construire un vrai système d'invitation en attente aurait exigé une migration de schéma (table nouvelle, RLS, flux d'acceptation) — hors de portée d'un ticket `S`. Décision : reprendre le flux existant tel quel, transversalement.

Fait — nouvelle vue transversale : `listGmCampaignsForUser` (`src/server/repos/campaigns.ts`, jointure `campaign_members → campaigns → worlds`, RLS déjà filtrante) + `listMyGmCampaignsWithMembers` (`src/server/services/campaigns.ts`) + route `GET /api/campaigns/mine`. `SettingsMenu.tsx` : nouveau `CollaborationTab`, un sélecteur parmi les campagnes dont l'utilisateur est MJ (tous mondes confondus) + un formulaire d'invitation (e-mail + rôle MJ/joueur) qui appelle la MÊME route `POST /api/campaigns/[campaignId]/members` que `CampaignDetail.tsx` — aucune deuxième implémentation du flux d'invitation. En dessous, la liste de toutes les campagnes MJ avec leurs membres actuels. Vérifié en navigateur : campagne existante listée avec son membre, invitation vers un e-mail sans compte renvoie bien « Aucun compte n'existe pour cette adresse » (même message que le flux d'origine). `typecheck`/`lint`/`test` verts (605/606, 1 ignoré).

**Lot K terminé** (K1 à K7).

---

## Lot L — Infrastructure et hébergement

*Né du déploiement réel sur Vercel + Supabase (paliers gratuits), pas d'une fonctionnalité de wiki — voir `docs/adr/0012-hebergement-vercel-supabase-gratuit.md` pour le contexte complet de la décision.*

### V2-L1 — Stockage des images hors de la base (Supabase Storage) · `M`

Aujourd'hui, `entity_portraits`, `block_images` et `background_images` stockent l'image directement dans une colonne `bytea` Postgres — un choix simple fait pendant la V2-G/H, jamais pensé pour tenir à l'échelle d'un compendium illustré. Ces octets comptent contre les **500 Mo de la base** du palier gratuit Supabase, jamais contre le **1 Go de stockage fichiers**, qui reste vide. L'ambition d'illustrer tout le compendium SRD 2024 (~800 entrées, 3-4 images chacune) sature la base bien avant de toucher au stockage si rien ne change.

**Point de vigilance, pas un détail** : un bloc peut être en visibilité `gm` (règle absolue 4 du `CLAUDE.md` — la visibilité se résout côté serveur, avant l'envoi). Si le bucket Storage est configuré en accès public pour simplifier, l'image d'un bloc `gm` devient joignable par n'importe qui connaissant l'URL, sans repasser par le filtrage — exactement la fuite que `publicShare.ts` existe pour éviter côté texte. Le bucket doit rester privé, avec une URL signée générée côté serveur après revérification de la visibilité, jamais un lien public direct.

**Critères**
- [ ] `entity_portraits.image`, `block_images.image`, `background_images.backdrop_image` migrent vers des objets du bucket Supabase Storage ; la colonne `bytea` est retirée une fois la bascule confirmée.
- [ ] Une interface de stockage sépare l'appelant du fournisseur concret (`specs/cible-locale-et-ia.md` règle 4) — remplaçable par le système de fichiers le jour de la cible locale, sans toucher au reste du code.
- [ ] Les images déjà en place au moment de la migration sont copiées vers le bucket, pas seulement le code qui en écrit de nouvelles — aucune image existante perdue.
- [ ] Un bloc/portrait dont la visibilité n'est pas publique reste inaccessible par URL directe à un visiteur qui n'y a pas droit (URL signée à durée limitée, jamais un bucket public en lecture libre).
- [ ] Après migration, la taille de la base de données redescend nettement ; celle du bucket reflète le poids réel des images.
- [ ] Vérifié en conditions réelles (déploiement Vercel, pas seulement en local) : upload, affichage public et privé d'un portrait et d'une image de bloc.

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
