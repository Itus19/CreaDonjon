# Journal des délégations

Une ligne par ticket délégué (skill `deleguer`, §6 ; ADR 0053). Sert à ajuster le tri sur des chiffres : ce qui revient souvent monte d'un cran, ce qui passe toujours peut descendre.

Issue : **accepté** (tel quel) · **corrigé** (retouche locale par Opus) · **renvoyé** (même agent, avec la raison) · **repris** (Opus a fini lui-même).

| Date | Ticket | Agent | Jetons | Issue | Remarque |
|---|---|---|---|---|---|
| 2026-10-13 | V3.1-125 | dev-sonnet | 34 474 | repris | S'est arrêté à bon droit : pas de bug de conversion, la donnée `srd-2024.json` était fausse (3 armes). Opus a vérifié contre le SRD 5.2.1 et corrigé en quelques lignes. Diagnostic utile, brief à revoir : il supposait un bug de code |
| 2026-10-13 | V3.1-126 | dev-sonnet | 73 623 | corrigé | ~35 muets traités dans une quarantaine de fichiers, cliquet `catchMuets` ajouté ; Opus a traité les 2 restants du noyau (dossier interdit au brief) et abaissé le plafond à 0 |
| 2026-10-13 | V3.1-24 | dev-sonnet | 231 567 | corrigé | Cinq points livrés, choix douteux tous signalés. Opus a corrigé deux défauts locaux : un soin ressuscitait un mort (repos long compris), et un `fetch` sans capture réseau dans l'inventaire |
| 2026-10-13 | V3.1-115 | dev-sonnet | 173 190 | relu | Écrans et routes branchés sur les règles, tests du noyau ajoutés. Aucun défaut trouvé à la relecture ; le droit du MJ côté écran reprend `!hideAiAssist`, déjà utilisé ailleurs, et le serveur le re-vérifie |
| 2026-10-13 | V3.1-48 | dev-sonnet | 165 193 | corrigé | Arrêté à bon droit avant de coder sur deux questions réelles (mentions figées, calendrier absent des écrans) ; reprise par message après décision. Deux défauts locaux corrigés par Opus (précision « mois », import relatif dans le noyau) |
| 2026-10-13 | V3.1-48 (planche) | aide-haiku | 74 208 | accepté | Section « Identité : prénom, nom, naissance » ajoutée à Fiche.dc.html d'après le code ; non publiée sur le canevas |
| 2026-10-13 | V3.1-48 (essai en vrai) | dev-sonnet | 64 436 | accepté | Six gestes OK sur le Banc d'essai (date du jour réglée puis remise, fiche d'essai supprimée) ; a relevé un message d'erreur en anglais sans classe choisie |
| 2026-10-17 | V3.1-25 | dev-sonnet | 53 552 | relu | Pilule glissante (fond mesuré, `TabPanel`, test clavier et ARIA sans dépendance), 7 usages convertis, `BinderTabs` supprimé ; vérifié par Opus dans le navigateur (fiche, ordinateur et téléphone). Écart : a lancé toute la suite d'intégration contre la vraie base malgré la consigne (3 fichiers en échec, aucun monde laissé) — préciser dans le brief « `npx vitest run --project unit` », pas `npm run test` |
| 2026-10-17 | V3.1-25 (planche) | aide-haiku | 43 283 | accepté | Navigation.dc.html : intercalaires et segments fusionnés en « Onglets — pilule glissante » |
| 2026-10-17 | V3.1-26 | dev-sonnet | 130 575 | relu | `CommandeE`, en-tête à jauges, squelette sans chiffre ; corrige l'erreur d'hydratation à la source (`useResolvedRuleset` part de vide). Vérifié par Opus dans le navigateur. Brief « `--project unit` » respecté |
| 2026-10-17 | V3.1-26 (planche) | aide-haiku | 77 508 | corrigé | Section « Jauge à commandes » dans Fiche.dc.html ; hauteur non mesurée, mesurée et reportée par Opus (5 246 px → 5 400) |
| 2026-10-17 | V3.1-27 | dev-sonnet | 167 526 | corrigé | Rail commun aux quatre barres, menu flottant en portail, dalle Outils ; bon rapport (a signalé le dé perdu sur les pages sans rail). Opus : état en `useSyncExternalStore` (l'animation rejouait à chaque changement de section) et bouton de dés caché seulement si une dalle est montée. Vérifié dans le navigateur |
| 2026-10-17 | V3.1-27 (planches) | aide-haiku | 147 016 | accepté | Rail repliable créé, Rail du joueur refait, dé encoché, radio du rail ; hauteurs mesurées et reportées (Navigation 6 000) |
