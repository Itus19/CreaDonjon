-- V3.1-15 (ADR 0032, amende l'ADR 0031 §3) — le tag a 4 chiffres devient
-- visible du MJ de la campagne, dans la Gestion de campagne, pour distinguer
-- deux comptes de meme nom. Rien ne change en base : seul le commentaire de
-- colonne, pose par la migration 20260929130000 (appliquee, donc jamais
-- modifiee — regle absolue 14), decrivait l'ancienne regle.
comment on column profiles.handle_tag is '4 chiffres genere automatiquement (#0000-#9999), unique avec handle_name. Visible du compte concerne (reglages) et du MJ de ses campagnes (Gestion de campagne, ADR 0032) ; jamais d''une autre joueuse ni d''une attribution publique. Filtre cote serveur par /api/campaigns/[id].';
