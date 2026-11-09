# Rugosités de novembre

Ce qu'on a constaté en jouant, à partir du 1ᵉʳ novembre. Même règle que le reste de V3.1 : un ticket par constat, taille `S` ou `M`.

---

*V3.1-150 à 154 et 186 sont terminés (`termines.md`).*

### V3.1-187 — La montée de niveau refuse tout personnage qui a une date de naissance (8 novembre)

**Modèle conseillé : Opus** — fait par Opus seul (petit, contexte chargé). Constat de l'auteur : en montant Terk de 2 à 3, l'erreur « La montée de niveau ne peut pas changer l'espèce, l'historique ou l'identité du personnage », alors que rien n'a changé.
- **Cause** : `applyLevelUp` (`src/server/services/characterActions.ts`) comparait la naissance par `JSON.stringify`. La colonne `jsonb` réordonne les clés (`day, end, year, label, month, precision`) ; l'objet reçu, passé par Zod, suit l'ordre du schéma (`year, month, day, precision, end, label`). Chaînes toujours différentes : refus `forbidden_field_change` pour **tout** personnage né. Constaté sur la vraie base (Terk, 21/5/1398, et deux autres fiches).
- **Correction** : `sameGameDate` (`src/core/calendar/sameGameDate.ts`), comparaison champ par champ, `end` et `label` absents valent `null`. 7 tests écrits d'abord, dont la date de Terk telle que Postgres la rend.
- **Vérifié** : typecheck, lint, tests unitaires. Pas de test d'intégration pour la montée de niveau.
- **Reste** : refaire la montée de Terk au navigateur, après déploiement.

### V3.1-188 — Le Wiki du joueur ne s'ouvre plus en édition (9 novembre)

**Modèle conseillé : Opus** — fait par Opus seul (petit, contexte chargé). Demande de l'auteur : quand un joueur peut modifier une fiche, l'édition s'ouvrait aussi dans l'onglet Wiki ; elle ne doit plus vivre que dans l'onglet Édition, le Wiki étant une visualisation comme le public.
- **Page** `app/m/[worldSlug]/joueur/wiki/[entitySlug]/page.tsx` : la branche `canUserEditEntity` → `EditEntityForm` est retirée ; la fiche passe toujours par `getPlayerEntityDetail` + `PublicEntityBody`.
- **Rien de perdu** : l'onglet Édition (`joueur/fiche`) liste les mêmes fiches (`listPlayerEditableEntities` : personnage revendiqué et octrois du MJ, les cas 3 et 4 de `canEditEntity`).
- **Sécurité** : aucune barrière ne bouge. Le Wiki n'envoie plus, pour toutes les fiches, que ce que la résolution de visibilité joueur autorise ; l'édition et ses droits sont inchangés.
- **`CABLAGE.md`** : les deux mentions de cette page mises à jour.
- **Vérifié** : typecheck, lint, tests unitaires.
- **Reste** : au navigateur, en Testeuse A : son PJ s'ouvre en lecture dans Wiki, en édition dans Édition.

### V3.1-189 — Bloc image : le placer dans le texte, à la souris, comme dans Word (9 novembre)

**Modèle conseillé : Opus** — fait par Opus seul (format du texte, visibilité, éditeur : contexte chargé, rien de délégable sans tout reprendre).

Demande de l'auteur : l'aperçu de placement dans le bloc image (curseur à crans + miniature) laisse place à un placement **dans le texte**, par cliquer-glisser. Cliquer l'image dans le texte ouvre une bulle d'habillage, dans le style de la bulle de mise en forme. Le bloc image dit seulement dans quel bloc texte l'image apparaît, et garde ses trois modes de fond, le flou, le fondu et la parallaxe.

**Esquisses validées par l'auteur** (9 novembre, « elles reflètent exactement ma vision ») : planche « Image dans le texte ».

**Décision (9 novembre) : option B**, n'importe où dans une phrase (ADR 0079). Règle de visibilité de l'auteur : une image cachée à un lecteur l'est partout, texte compris ; le texte se comporte comme si elle n'était pas là.

**Fait :**
- **Format** : nœud de segment `{ t: "image", blockId }` (`zSegmentContentNode`) ; les valeurs d'infobox gardent un format sans image (`zMentionNode`). `nodeText` remplace cinq aplatissements « paragraphe → texte ». `SCHEMA.md` §6.
- **Noyau** (tests d'abord) : `src/core/images/inlineImage.ts` (images citées, visibilité), `inlineImagePlacement.ts` (choisir le bloc texte), `src/core/linker/remapBlockIds.ts` ; `planImageAnchors` sort du fil une image citée par le texte, qui prime sur l'ancien ancrage ; aller-retour Tiptap (`tiptapSync`).
- **Serveur** : `applyInlineImageVisibility` sur le chemin joueur (`playerEntityDetail`) et le partage public (`publicShare`). Une image cachée est retirée du texte (paragraphe vide supprimé) ; une image posée dans un paragraphe caché disparaît avec lui ; une image de fond y reste un fond.
- **Duplications** : fiche et monde recalent les blocs cités (et l'ancien `anchor.blockId`, qu'elles ne recalaient pas) ; l'export porte l'id d'origine du bloc (`ref`, facultatif).
- **Lecture** : `PublicInlineImage` (que des `<span>`, valides dans un `<p>`), parallaxe comprise.
- **Éditeur** : extension `inlineImage` (`components/entities/richtext/InlineImage.tsx`), toujours chargée ; glisser-déposer natif ; bulle d'habillage (texte à gauche, à droite, haut et bas + alignement, taille −/+, « Bloc image », « Retirer du texte » ; au téléphone, ▲ ▼ d'un paragraphe).
- **Bloc image allégé** : « Seule, à sa place » / « Dans un bloc de texte » + liste des blocs texte ; curseur à crans, aperçu et barre retirés ; légende, parallaxe, fond, flou et fondu gardés.

**Vérifié** :
- typecheck, lint, tests unitaires.
- **Au navigateur** (Banc d'essai, fiche d'essai supprimée ensuite) :
  - en Testeur MJ, poser l'image depuis le bloc image, l'ouvrir dans la bulle, la glisser au milieu d'une phrase du second paragraphe, texte à gauche, 80 % : enregistré tel quel en base ;
  - en Testeuse A, l'image s'affiche dans la phrase ; bloc image passé en MJ seulement : légende et nœud absents du HTML reçu, le texte se referme (« …montées en une seule nuit… »).

**Reste** :
- Les boutons ▲ ▼ du téléphone n'ont pas été essayés au navigateur.
- ~~Planche du catalogue~~ **faite le 9 novembre** : section « Bloc Image et image dans le texte » de `WikiVisuel.dc.html` réécrite d'après le code (bulle d'habillage, bloc allégé), CSS du catalogue recompilé, planche publiée sur le canevas (hauteur mesurée : +130 px, 7 900 px, sous la limite).
- Le cadre doré autour de l'éditeur pendant une sélection vient de la règle globale `:focus-visible`, antérieure à ce ticket (tous les éditeurs de texte l'ont).

### V3.1-190 — Calendrier réel : plusieurs demandes de dates en même temps (9 novembre)

**Modèle conseillé : Opus** — migration, RLS et service ; l'écran pourra aller à Sonnet une fois les esquisses validées.

Demande de l'auteur : pouvoir lancer plusieurs demandes de dates de séance à la fois, et voir, côté MJ comme côté joueur, les demandes en cours et qui a répondu ou non (notifications).

**Esquisses** (9 novembre, refaites en écran complet à la demande de l'auteur, à valider) : planche « Calendrier réel, demandes multiples ».
1. **MJ, écran Calendrier réel complet** : sous l'intro, une rangée « Demandes en cours » (une carte par demande : « Prête à fixer » ou « En attente », réponses 6/6, 3/6, 1/6) et « + Nouvelle demande ». La demande choisie garde l'écran d'aujourd'hui tel quel : en-tête (créneau, réponses, durée visée, « Annuler la demande »), grille horaire « Mes disponibilités / Toute la table » (avec, en plus, une ligne « Réponses : ✓ … » par joueuse), « Dates possibles » avec « Fixer cette date », puis « Régler une date à la main », « Séances à venir », « Déjà jouées ».
2. **Joueur, écran Prochaine session complet** : la prochaine séance, la rangée « Demandes du MJ » (« À répondre », « ✓ Répondu »), puis pour la demande choisie : en-tête, « Aucune date ne me va », la même grille (une grille par demande), « Les dates qui se dessinent », « Séances à venir », « Déjà jouées ».
3. **Notifications** :
   - joueur : le point rouge du rail devient le nombre de demandes sans réponse ;
   - MJ : une pastille « N à fixer » sur l'outil Calendrier réel ;
   - téléphone : la liste des demandes, une demande en pleine page.

**Décisions de l'auteur (9 novembre)** : les esquisses telles quelles. Donc « Aucune date ne me va » ; pastille MJ « N à fixer » (demandes où tout le monde a répondu) ; fixer une date ferme sa demande, les autres restent ouvertes. ADR 0080.

**Fait :**
- **Migration** `20261109150000_availability_requests_multiples.sql` : index « une seule ouverte » retiré ; `real_session_availabilities` prend un `id`, unicité (demande, joueuse, jour) ; table `availability_declines` (RLS : lecture membres, écriture de sa propre ligne ; clé composée vers la demande et sa campagne). `SCHEMA.md` et `src/types/database.ts` (à la main) à jour.
- **Noyau** (tests d'abord) : `src/core/scheduling/requestStatus.ts` (qui est attendu, qui a répondu, qui manque, « prête à fixer » ; nombre de demandes sans réponse).
- **Service** : `getSchedulingBoard` (toutes les demandes et celle affichée, en un appel), `respondToRequest`, `clearAvailability`, `declineRequest`, `countUnansweredRequests`, `countRequestsReadyToFix` ; chaque geste vérifie que la demande est ouverte et de cette campagne. `createRealSession` ferme la demande nommée.
- **Routes** : `requests/open?requestId=`, `availability` (POST avec `requestId`), `availability/[date]?requestId=`, `requests/[requestId]/decline` ; `worlds/[slug]/scheduling/open-request` retirée. Toutes validées par Zod.
- **Écrans** : rangée des demandes (`RequestTabs`) côté MJ et joueur ; ligne « Réponses » côté MJ ; « Aucune date ne me va » côté joueur ; pastille chiffrée du rail joueur ; pastille « à fixer » de l'outil MJ (rail).
- **Test d'intégration** `schedulingMultiRequests.integration.test.ts` (deux demandes ouvertes, même jour sans écrasement, « aucune date », RLS, demande close).

**Reste :**
- **Appliquer la migration** (l'auteur), puis lancer le test d'intégration, puis vérifier au navigateur (Testeur MJ, Testeuse A).
- La barre du téléphone côté MJ ne porte pas la pastille « à fixer » (montée par `AppShell`, hors du layout MJ).
- Planche du catalogue : la section « Calendrier réel » d'`OutilsMJ.dc.html` est à jour dans le dépôt (rangée des demandes, ligne « Réponses »), **pas encore publiée** : la version en ligne de cette planche porte des ajouts d'une autre session (V3.1-173 à 183, branche `claude/quirky-turing-hb12f2`) absents du dépôt, et le dépôt une section « plan-combat » absente de la version en ligne. À publier une fois les deux branches fusionnées.

**Sous-tâches Haiku** : planche du catalogue d'après le code écrit.
