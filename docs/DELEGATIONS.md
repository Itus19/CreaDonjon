# Journal des délégations

Une ligne par ticket délégué (skill `deleguer`, §6 ; ADR 0053). Sert à ajuster le tri sur des chiffres : ce qui revient souvent monte d'un cran, ce qui passe toujours peut descendre.

Issue : **accepté** (tel quel) · **corrigé** (retouche locale par Opus) · **renvoyé** (même agent, avec la raison) · **repris** (Opus a fini lui-même).

| Date | Ticket | Agent | Jetons | Issue | Remarque |
|---|---|---|---|---|---|
| 2026-10-13 | V3.1-125 | dev-sonnet | 34 474 | repris | S'est arrêté à bon droit : pas de bug de conversion, la donnée `srd-2024.json` était fausse (3 armes). Opus a vérifié contre le SRD 5.2.1 et corrigé en quelques lignes. Diagnostic utile, brief à revoir : il supposait un bug de code |
| 2026-10-13 | V3.1-126 | dev-sonnet | 73 623 | corrigé | ~35 muets traités dans une quarantaine de fichiers, cliquet `catchMuets` ajouté ; Opus a traité les 2 restants du noyau (dossier interdit au brief) et abaissé le plafond à 0 |
| 2026-10-13 | V3.1-24 | dev-sonnet | 231 567 | corrigé | Cinq points livrés, choix douteux tous signalés. Opus a corrigé deux défauts locaux : un soin ressuscitait un mort (repos long compris), et un `fetch` sans capture réseau dans l'inventaire |
