-- Step 0: additive, reversible backup of all existing public tables.
CREATE SCHEMA IF NOT EXISTS audit_backup;

REVOKE ALL ON SCHEMA audit_backup FROM PUBLIC;
GRANT USAGE ON SCHEMA audit_backup TO service_role;

CREATE TABLE IF NOT EXISTS audit_backup.backup_manifest (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  taken_on date NOT NULL DEFAULT current_date,
  source_table text NOT NULL,
  backup_table text NOT NULL,
  row_count bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (taken_on, source_table)
);
GRANT ALL ON audit_backup.backup_manifest TO service_role;

DO $$
DECLARE
  r record;
  suffix text := to_char(current_date, 'YYYYMMDD');
  bt text;
  n bigint;
BEGIN
  FOR r IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  LOOP
    bt := left(r.table_name, 40) || '_' || suffix;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'audit_backup' AND table_name = bt
    ) THEN
      EXECUTE format('CREATE TABLE audit_backup.%I AS TABLE public.%I', bt, r.table_name);
      EXECUTE format('GRANT ALL ON audit_backup.%I TO service_role', bt);
    END IF;
    EXECUTE format('SELECT count(*) FROM audit_backup.%I', bt) INTO n;
    INSERT INTO audit_backup.backup_manifest (taken_on, source_table, backup_table, row_count)
    VALUES (current_date, r.table_name, bt, n)
    ON CONFLICT (taken_on, source_table)
      DO UPDATE SET backup_table = EXCLUDED.backup_table, row_count = EXCLUDED.row_count;
  END LOOP;
END $$;