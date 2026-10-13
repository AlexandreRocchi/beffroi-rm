-- Rôles et base de Beffroi RM au moindre privilège (idempotent : peut être rejoué).
-- À exécuter en super-utilisateur PostgreSQL avec :
--   psql -v owner_pw=… -v app_pw=… -f roles.sql
--  - beffroi_owner : propriétaire du schéma, utilisé uniquement pour les migrations ;
--  - beffroi_app   : rôle de l'application, sans droit sur le schéma ni sur la modification du journal
--                    (droits accordés par « server.js --migrate »).
\set ON_ERROR_STOP on

SELECT 'CREATE ROLE beffroi_owner' WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'beffroi_owner') \gexec
SELECT 'CREATE ROLE beffroi_app' WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'beffroi_app') \gexec
ALTER ROLE beffroi_owner LOGIN PASSWORD :'owner_pw' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE beffroi_app LOGIN PASSWORD :'app_pw' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 50;

SELECT 'CREATE DATABASE beffroi OWNER beffroi_owner' WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'beffroi') \gexec
REVOKE ALL ON DATABASE beffroi FROM PUBLIC;
GRANT CONNECT ON DATABASE beffroi TO beffroi_owner, beffroi_app;

\connect beffroi
REVOKE ALL ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO beffroi_owner;
GRANT USAGE ON SCHEMA public TO beffroi_app;
