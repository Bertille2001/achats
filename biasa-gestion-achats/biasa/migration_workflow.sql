-- ATTENTION — obsolete pour un premier deploiement.
-- Ce script ajoute d'anciens noms de valeurs d'enum ('en_commande', 'livree',
-- 'prise_en_charge', 'livraison_confirmee', 'reception_confirmee') qui ne
-- correspondent PLUS au schema actuel (app/models/models.py utilise deja
-- 'recue', 'bc_cree', 'commande_passee', 'livraison_recue',
-- 'confirmation_reception_demandeur/acheteur' directement dans l'enum
-- Python). Sur une base neuve, les tables/enums sont crees directement avec
-- les bonnes valeurs (via create_all au demarrage) : ce script n'est pas
-- necessaire et ne doit PAS etre execute contre une base fraiche.
-- Il ne serait utile que pour migrer une tres vieille base de donnees
-- BIASA qui aurait encore l'ancien schema — ce qui n'est pas le cas ici.
-- Migration : extension du workflow de demandes d'achat
-- A exécuter UNE SEULE FOIS contre la base PostgreSQL BIASA
-- Commande : psql -U postgres -d biasa_db -f migration_workflow.sql

-- Nouveaux statuts
ALTER TYPE statutda ADD VALUE IF NOT EXISTS 'en_commande';
ALTER TYPE statutda ADD VALUE IF NOT EXISTS 'livree';
ALTER TYPE statutda ADD VALUE IF NOT EXISTS 'recue';

-- Nouvelles actions historique
ALTER TYPE actionhistorique ADD VALUE IF NOT EXISTS 'prise_en_charge';
ALTER TYPE actionhistorique ADD VALUE IF NOT EXISTS 'livraison_confirmee';
ALTER TYPE actionhistorique ADD VALUE IF NOT EXISTS 'reception_confirmee';
