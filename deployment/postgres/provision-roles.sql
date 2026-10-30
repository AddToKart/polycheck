\set ON_ERROR_STOP on
\getenv runtime_password RUNTIME_DATABASE_PASSWORD
\getenv migrator_password MIGRATOR_DATABASE_PASSWORD
\getenv backup_password BACKUP_DATABASE_PASSWORD
BEGIN;
SELECT pg_advisory_xact_lock(72318401);
SELECT 'CREATE ROLE polycheck_runtime LOGIN' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'polycheck_runtime') \gexec
SELECT 'CREATE ROLE polycheck_migrator LOGIN' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'polycheck_migrator') \gexec
SELECT 'CREATE ROLE polycheck_backup LOGIN REPLICATION' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'polycheck_backup') \gexec
ALTER ROLE polycheck_runtime NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD :'runtime_password';
ALTER ROLE polycheck_migrator NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD :'migrator_password';
ALTER ROLE polycheck_backup NOSUPERUSER NOCREATEDB NOCREATEROLE REPLICATION PASSWORD :'backup_password';
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE polycheck TO polycheck_runtime, polycheck_migrator, polycheck_backup;
ALTER SCHEMA public OWNER TO polycheck_migrator;
-- Transfer only application objects in this database, never cluster ownership.
SELECT format('ALTER TABLE public.%I OWNER TO polycheck_migrator', tablename)
FROM pg_tables WHERE schemaname = 'public' AND tableowner = 'polycheck' \gexec
SELECT format('ALTER SEQUENCE public.%I OWNER TO polycheck_migrator', sequencename)
FROM pg_sequences WHERE schemaname = 'public' AND sequenceowner = 'polycheck' \gexec
SELECT format('ALTER TYPE public.%I OWNER TO polycheck_migrator', t.typname)
FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public' AND t.typtype = 'e' AND t.typowner = (SELECT oid FROM pg_roles WHERE rolname = 'polycheck') \gexec
GRANT USAGE ON SCHEMA public TO polycheck_runtime, polycheck_backup;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO polycheck_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO polycheck_runtime;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO polycheck_backup;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO polycheck_backup;
ALTER DEFAULT PRIVILEGES FOR ROLE polycheck_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO polycheck_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE polycheck_migrator IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO polycheck_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE polycheck_migrator IN SCHEMA public GRANT SELECT ON TABLES TO polycheck_backup;
ALTER DEFAULT PRIVILEGES FOR ROLE polycheck_migrator IN SCHEMA public GRANT SELECT ON SEQUENCES TO polycheck_backup;
COMMIT;
