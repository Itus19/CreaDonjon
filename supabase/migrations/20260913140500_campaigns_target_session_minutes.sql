-- V2.1-4 — duree de session visee, reglable par table plutot que figee a 5h
-- (retour utilisateur : "une session normale est de 5h total" decrit CETTE
-- table, pas une regle universelle). Sert a classer un jour candidat en
-- "session complete" ou "raccourcie" (src/core/scheduling/overlap.ts).
alter table campaigns add column target_session_minutes int not null default 300 check (target_session_minutes > 0);
