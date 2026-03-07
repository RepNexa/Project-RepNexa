-- Minimal dev geo seed data (territories + routes).
-- Purpose: make assignment flows + scope checks runnable in dev.
--
-- Dependencies:
-- - users table must contain fm@repnexa.local (role=FM) from R__010_seed_users.sql
--
-- Idempotency:
-- - Uses natural keys (code) with ON CONFLICT DO UPDATE
-- - Resets soft-delete columns to active (deleted_at = NULL)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM users
    WHERE username = 'fm@repnexa.local'
      AND role = 'FM'
  ) THEN
    RAISE EXCEPTION 'Dev seed requires FM user fm@repnexa.local (role=FM) to exist. Ensure R__010_seed_users.sql runs first.';
  END IF;
END $$;

-- 1) Upsert territories (separate statement so later inserts can reliably resolve territory ids)
WITH fm AS (
  SELECT id AS fm_id
  FROM users
  WHERE username = 'fm@repnexa.local'
    AND role = 'FM'
  LIMIT 1
)
INSERT INTO territories (code, name, owner_user_id, deleted_at)
VALUES
  ('TERR_COL_01', 'Colombo Territory 01', (SELECT fm_id FROM fm), NULL),
  ('TERR_COL_02', 'Colombo Territory 02', (SELECT fm_id FROM fm), NULL)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  owner_user_id = EXCLUDED.owner_user_id,
  deleted_at = NULL,
  updated_at = NOW();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM territories WHERE code = 'TERR_COL_01') THEN
    RAISE EXCEPTION 'Expected territory TERR_COL_01 to exist after seed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM territories WHERE code = 'TERR_COL_02') THEN
    RAISE EXCEPTION 'Expected territory TERR_COL_02 to exist after seed';
  END IF;
END $$;

-- 2) Upsert routes (territory_id resolved via join on territory code)
INSERT INTO routes (territory_id, code, name, deleted_at)
SELECT
  t.id AS territory_id,
  v.route_code AS code,
  v.route_name AS name,
  NULL::timestamptz AS deleted_at
FROM (VALUES
  ('TERR_COL_01', 'ROUTE_COL_01A', 'Colombo Route 01A'),
  ('TERR_COL_01', 'ROUTE_COL_01B', 'Colombo Route 01B'),
  ('TERR_COL_02', 'ROUTE_COL_02A', 'Colombo Route 02A')
) v(territory_code, route_code, route_name)
JOIN territories t ON t.code = v.territory_code
ON CONFLICT (code) DO UPDATE
SET
  territory_id = EXCLUDED.territory_id,
  name = EXCLUDED.name,
  deleted_at = NULL,
  updated_at = NOW();