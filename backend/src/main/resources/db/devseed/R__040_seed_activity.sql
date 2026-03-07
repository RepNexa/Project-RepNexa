-- RepNexa: seed ACTIVITY data so HO analytics + drilldowns are non-empty in dev.
-- Idempotent + trigger-safe:
-- - uses deterministic idempotency_key for submissions
-- - uses ON CONFLICT for doctor_calls/doctor_call_products/stock_flags/mileage
-- - uses NOT EXISTS for chemist_visits (no unique constraint)
--
-- Assumes base seeds exist (users/routes/assignments/masterdata). If not, it raises.

DO $$
DECLARE
  v_cm_id bigint;
BEGIN
  SELECT id INTO v_cm_id FROM users WHERE username='cm@repnexa.local' LIMIT 1;
  IF v_cm_id IS NULL THEN
    RAISE EXCEPTION 'Seed requires cm@repnexa.local. Ensure R__010_seed_users.sql ran.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM routes WHERE code IN ('ROUTE_COL_01A','ROUTE_COL_01B','ROUTE_COL_02A') AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Seed requires routes ROUTE_COL_01A/01B/02A. Ensure R__020_seed_geo.sql ran.';
  END IF;
END $$;

-- 1) Add extra MR users so rep tables/charts aren’t trivial
-- Reuse the same bcrypt hash as mr@repnexa.local (MR@1234) for dev convenience.
INSERT INTO users (username, password_hash, role, enabled, must_change_password)
VALUES
  ('mr2@repnexa.local', '$2b$10$h8FLDE3l0GpcyGISiDvqi.dsgMgEW6AQa82twd6gJRhTRoi.fwpTa', 'MR', TRUE, FALSE),
  ('mr3@repnexa.local', '$2b$10$h8FLDE3l0GpcyGISiDvqi.dsgMgEW6AQa82twd6gJRhTRoi.fwpTa', 'MR', TRUE, FALSE)
ON CONFLICT (username) DO UPDATE
SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  enabled = EXCLUDED.enabled,
  must_change_password = EXCLUDED.must_change_password,
  updated_at = NOW();

-- 2) Ensure products exist (safe upsert without relying on partial unique index inference)


-- 3) Ensure a richer doctor set exists (keyed by deterministic name)

-- 4) Map doctors to routes (doctor_routes FK requirement for doctor_calls)
WITH routes AS (
  SELECT id, code FROM routes WHERE code IN ('ROUTE_COL_01A','ROUTE_COL_01B','ROUTE_COL_02A') AND deleted_at IS NULL
),
doc_map(route_code, doctor_name) AS (
  VALUES
    ('ROUTE_COL_01A','Dr Colombo 01A-01'),
    ('ROUTE_COL_01A','Dr Colombo 01A-02'),
    ('ROUTE_COL_01A','Dr Colombo 01A-03'),
    ('ROUTE_COL_01A','Dr Colombo 01A-04'),
    ('ROUTE_COL_01A','Dr Colombo 01A-05'),

    ('ROUTE_COL_01B','Dr Colombo 01B-01'),
    ('ROUTE_COL_01B','Dr Colombo 01B-02'),
    ('ROUTE_COL_01B','Dr Colombo 01B-03'),
    ('ROUTE_COL_01B','Dr Colombo 01B-04'),

    ('ROUTE_COL_02A','Dr Colombo 02A-01'),
    ('ROUTE_COL_02A','Dr Colombo 02A-02'),
    ('ROUTE_COL_02A','Dr Colombo 02A-03'),
    ('ROUTE_COL_02A','Dr Colombo 02A-04')
),
resolved AS (
  SELECT r.id AS route_id, d.id AS doctor_id
  FROM doc_map m
  JOIN routes r ON r.code = m.route_code
  JOIN doctors d ON lower(d.name) = lower(m.doctor_name)
)
INSERT INTO doctor_routes (doctor_id, route_id)
SELECT doctor_id, route_id
FROM resolved x
WHERE NOT EXISTS (
  SELECT 1 FROM doctor_routes dr WHERE dr.doctor_id = x.doctor_id AND dr.route_id = x.route_id
);

-- 5) Ensure chemists exist per route (for chemist visits)


-- 6) Ensure MR route assignments exist (more coverage for overview filters)
WITH cm AS (
  SELECT id AS cm_id FROM users WHERE username='cm@repnexa.local' LIMIT 1
),
routes AS (
  SELECT id, code FROM routes WHERE code IN ('ROUTE_COL_01A','ROUTE_COL_01B','ROUTE_COL_02A') AND deleted_at IS NULL
),
reps AS (
  SELECT id, username FROM users WHERE username IN ('mr@repnexa.local','mr2@repnexa.local','mr3@repnexa.local')
),
pairs AS (
  SELECT r.id AS rep_user_id, rt.id AS route_id, (SELECT cm_id FROM cm) AS assigned_by_user_id,
         (CURRENT_DATE - 45) AS start_date
  FROM reps r
  JOIN routes rt ON (
    (r.username='mr@repnexa.local'  AND rt.code='ROUTE_COL_01A') OR
    (r.username='mr2@repnexa.local' AND rt.code='ROUTE_COL_01B') OR
    (r.username='mr3@repnexa.local' AND rt.code='ROUTE_COL_02A')
  )
)
INSERT INTO rep_route_assignments (rep_user_id, route_id, assigned_by_user_id, start_date, end_date, enabled)
SELECT rep_user_id, route_id, assigned_by_user_id, start_date, NULL, TRUE
FROM pairs
ON CONFLICT (rep_user_id, route_id) WHERE enabled=TRUE AND end_date IS NULL
DO UPDATE SET
  assigned_by_user_id = EXCLUDED.assigned_by_user_id,
  start_date = LEAST(rep_route_assignments.start_date, EXCLUDED.start_date),
  enabled = TRUE,
  updated_at = NOW();

-- 7) Seed DCR submissions (this month + last month)
WITH active_assign AS (
  SELECT a.id AS assignment_id, a.rep_user_id, a.route_id
  FROM rep_route_assignments a
  JOIN users u ON u.id=a.rep_user_id AND u.role='MR'
  WHERE a.enabled=TRUE AND a.end_date IS NULL
),
dates_this AS (
  SELECT (date_trunc('month', CURRENT_DATE)::date + (g*2))::date AS call_date
  FROM generate_series(0, 12) g
  WHERE (date_trunc('month', CURRENT_DATE)::date + (g*2))::date <= (CURRENT_DATE - 1)
),
dates_prev AS (
  SELECT ((date_trunc('month', CURRENT_DATE) - interval '1 month')::date + (g*3))::date AS call_date
  FROM generate_series(0, 10) g
  WHERE ((date_trunc('month', CURRENT_DATE) - interval '1 month')::date + (g*3))::date < date_trunc('month', CURRENT_DATE)::date
),
seed AS (
  SELECT
    aa.rep_user_id,
    aa.assignment_id AS rep_route_assignment_id,
    d.call_date,
    ('SEED_DCR_'||aa.rep_user_id||'_'||to_char(d.call_date,'YYYYMMDD')) AS idempotency_key
  FROM active_assign aa
  CROSS JOIN (
    SELECT call_date FROM dates_this
    UNION ALL
    SELECT call_date FROM dates_prev
  ) d
)
INSERT INTO dcr_submissions (rep_user_id, rep_route_assignment_id, call_date, idempotency_key)
SELECT rep_user_id, rep_route_assignment_id, call_date, idempotency_key
FROM seed
ON CONFLICT (rep_user_id, idempotency_key) WHERE idempotency_key IS NOT NULL
DO NOTHING;

-- 8) Seed doctor_calls (trigger-safe: route/rep/date derived from submission+assignment)
WITH subs AS (
  SELECT s.id AS submission_id, s.rep_user_id, s.call_date, a.route_id
  FROM dcr_submissions s
  JOIN rep_route_assignments a ON a.id = s.rep_route_assignment_id
  WHERE s.idempotency_key LIKE 'SEED_DCR_%'
),
route_docs AS (
  SELECT dr.route_id, d.id AS doctor_id,
         row_number() OVER (PARTITION BY dr.route_id ORDER BY d.id) AS rn
  FROM doctor_routes dr
  JOIN doctors d ON d.id = dr.doctor_id
  WHERE d.deleted_at IS NULL AND d.status = 'ACTIVE'
),
to_insert AS (
  SELECT s.submission_id, s.rep_user_id, s.route_id, s.call_date, rd.doctor_id, 'REGULAR'::varchar(40) AS call_type
  FROM subs s
  JOIN route_docs rd ON rd.route_id = s.route_id AND rd.rn <= 3
)
INSERT INTO doctor_calls (submission_id, rep_user_id, route_id, call_date, doctor_id, call_type)
SELECT submission_id, rep_user_id, route_id, call_date, doctor_id, call_type
FROM to_insert
ON CONFLICT (rep_user_id, doctor_id, call_date)
DO NOTHING;

-- 9) Seed doctor_call_products
WITH seed_calls AS (
  SELECT c.id
  FROM doctor_calls c
  JOIN dcr_submissions s ON s.id = c.submission_id
  WHERE s.idempotency_key LIKE 'SEED_DCR_%'
),
p1 AS (SELECT min(id) AS id FROM products WHERE deleted_at IS NULL),
p2 AS (SELECT id FROM products WHERE deleted_at IS NULL ORDER BY id OFFSET 1 LIMIT 1)
INSERT INTO doctor_call_products (doctor_call_id, product_id)
SELECT sc.id, p1.id
FROM seed_calls sc, p1
ON CONFLICT DO NOTHING;

WITH seed_calls AS (
  SELECT c.id
  FROM doctor_calls c
  JOIN dcr_submissions s ON s.id = c.submission_id
  WHERE s.idempotency_key LIKE 'SEED_DCR_%'
),
p2 AS (SELECT id FROM products WHERE deleted_at IS NULL ORDER BY id OFFSET 1 LIMIT 1)
INSERT INTO doctor_call_products (doctor_call_id, product_id)
SELECT sc.id, p2.id
FROM seed_calls sc, p2
WHERE (sc.id % 2 = 0)
ON CONFLICT DO NOTHING;


-- 10) Seed missed_doctors (supports MR todo / missed lists if used)
WITH subs AS (
  SELECT s.id AS submission_id, s.rep_user_id, s.call_date AS missed_date, a.route_id
  FROM dcr_submissions s
  JOIN rep_route_assignments a ON a.id = s.rep_route_assignment_id
  WHERE s.idempotency_key LIKE 'SEED_DCR_%'
),
route_docs AS (
  SELECT dr.route_id, d.id AS doctor_id,
         row_number() OVER (PARTITION BY dr.route_id ORDER BY d.id) AS rn
  FROM doctor_routes dr
  JOIN doctors d ON d.id = dr.doctor_id
  WHERE d.deleted_at IS NULL AND d.status = 'ACTIVE'
),
to_miss AS (
  SELECT s.submission_id, s.rep_user_id, s.route_id, s.missed_date, rd.doctor_id, 'Not available'::varchar(240) AS reason
  FROM subs s
  JOIN route_docs rd ON rd.route_id = s.route_id AND rd.rn = 4
)
INSERT INTO missed_doctors (submission_id, rep_user_id, route_id, missed_date, doctor_id, reason)
SELECT submission_id, rep_user_id, route_id, missed_date, doctor_id, reason
FROM to_miss
ON CONFLICT (rep_user_id, doctor_id, missed_date)
DO NOTHING;

-- 11) Seed chemist submissions + visits + stock flags
WITH active_assign AS (
  SELECT a.id AS assignment_id, a.rep_user_id, a.route_id
  FROM rep_route_assignments a
  JOIN users u ON u.id=a.rep_user_id AND u.role='MR'
  WHERE a.enabled=TRUE AND a.end_date IS NULL
),
dates_this AS (
  SELECT (date_trunc('month', CURRENT_DATE)::date + (g*5))::date AS visit_date
  FROM generate_series(0, 6) g
  WHERE (date_trunc('month', CURRENT_DATE)::date + (g*5))::date <= (CURRENT_DATE - 1)
),
dates_prev AS (
  SELECT ((date_trunc('month', CURRENT_DATE) - interval '1 month')::date + (g*7))::date AS visit_date
  FROM generate_series(0, 5) g
  WHERE ((date_trunc('month', CURRENT_DATE) - interval '1 month')::date + (g*7))::date < date_trunc('month', CURRENT_DATE)::date
),
seed AS (
  SELECT
    aa.rep_user_id,
    aa.assignment_id AS rep_route_assignment_id,
    d.visit_date,
    ('SEED_CHM_'||aa.rep_user_id||'_'||to_char(d.visit_date,'YYYYMMDD')) AS idempotency_key
  FROM active_assign aa
  CROSS JOIN (
    SELECT visit_date FROM dates_this
    UNION ALL
    SELECT visit_date FROM dates_prev
  ) d
)
INSERT INTO chemist_report_submissions (rep_user_id, rep_route_assignment_id, visit_date, idempotency_key)
SELECT rep_user_id, rep_route_assignment_id, visit_date, idempotency_key
FROM seed
ON CONFLICT (rep_user_id, idempotency_key) WHERE idempotency_key IS NOT NULL
DO NOTHING;

WITH subs AS (
  SELECT s.id AS submission_id, s.rep_user_id, s.visit_date, s.rep_route_assignment_id
  FROM chemist_report_submissions s
  WHERE s.idempotency_key LIKE 'SEED_CHM_%'
),
assign AS (
  SELECT id AS assignment_id, route_id
  FROM rep_route_assignments
  WHERE enabled=TRUE AND end_date IS NULL
),
chemist_pick AS (
  SELECT c.route_id, min(c.id) AS chemist_id
  FROM chemists c
  WHERE c.deleted_at IS NULL
  GROUP BY c.route_id
),
ins_visits AS (
  SELECT
    s.submission_id,
    s.rep_user_id,
    a.route_id,
    s.visit_date,
    cp.chemist_id
  FROM subs s
  JOIN assign a ON a.assignment_id = s.rep_route_assignment_id
  JOIN chemist_pick cp ON cp.route_id = a.route_id
)
INSERT INTO chemist_visits (submission_id, rep_user_id, route_id, visit_date, chemist_id)
SELECT v.submission_id, v.rep_user_id, v.route_id, v.visit_date, v.chemist_id
FROM ins_visits v
WHERE NOT EXISTS (
  SELECT 1 FROM chemist_visits x
  WHERE x.submission_id = v.submission_id AND x.chemist_id = v.chemist_id
);

WITH seed_visits AS (
  SELECT v.id
  FROM chemist_visits v
  JOIN chemist_report_submissions s ON s.id = v.submission_id
  WHERE s.idempotency_key LIKE 'SEED_CHM_%'
),
p1 AS (SELECT min(id) AS id FROM products WHERE deleted_at IS NULL),
p2 AS (SELECT id FROM products WHERE deleted_at IS NULL ORDER BY id OFFSET 1 LIMIT 1)
INSERT INTO chemist_stock_flags (visit_id, product_id, status)
SELECT sv.id, p1.id, 'OOS'
FROM seed_visits sv, p1
ON CONFLICT (visit_id, product_id)
DO NOTHING;

WITH seed_visits AS (
  SELECT v.id
  FROM chemist_visits v
  JOIN chemist_report_submissions s ON s.id = v.submission_id
  WHERE s.idempotency_key LIKE 'SEED_CHM_%'
),
p2 AS (SELECT id FROM products WHERE deleted_at IS NULL ORDER BY id OFFSET 1 LIMIT 1)
INSERT INTO chemist_stock_flags (visit_id, product_id, status)
SELECT sv.id, p2.id, 'LOW'
FROM seed_visits sv, p2
WHERE (sv.id % 2 = 1)
ON CONFLICT (visit_id, product_id)
DO NOTHING;


-- 12) Seed mileage entries (so rep mileage UI isn’t empty)
WITH active_assign AS (
  SELECT a.id AS assignment_id, a.rep_user_id, a.route_id
  FROM rep_route_assignments a
  JOIN users u ON u.id=a.rep_user_id AND u.role='MR'
  WHERE a.enabled=TRUE AND a.end_date IS NULL
),
dates AS (
  SELECT (date_trunc('month', CURRENT_DATE)::date + g)::date AS entry_date
  FROM generate_series(0, 12) g
  WHERE (date_trunc('month', CURRENT_DATE)::date + g)::date <= (CURRENT_DATE - 1)
)
INSERT INTO mileage_entries (rep_user_id, rep_route_assignment_id, route_id, entry_date, km)
SELECT
  aa.rep_user_id,
  aa.assignment_id,
  aa.route_id,
  d.entry_date,
  (12.5 + ((aa.rep_user_id % 5) * 2))::numeric(10,2) AS km
FROM active_assign aa
CROSS JOIN dates d
ON CONFLICT (rep_user_id, route_id, entry_date)
DO UPDATE SET
  km = EXCLUDED.km;