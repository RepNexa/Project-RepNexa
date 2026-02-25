-- DEV/DEMO canonical dataset (idempotent)
-- Safe to re-run (uses ON CONFLICT / existence checks / stable keys)


DO $$
DECLARE
  -- Users
  v_cm  bigint := (SELECT id FROM users WHERE username='cm@repnexa.local');
  v_fm  bigint := (SELECT id FROM users WHERE username='fm@repnexa.local');
  v_mr1 bigint := (SELECT id FROM users WHERE username='mr@repnexa.local');   -- route 01A
  v_mr2 bigint := (SELECT id FROM users WHERE username='mr2@repnexa.local');  -- route 01B
  v_mr3 bigint := (SELECT id FROM users WHERE username='mr3@repnexa.local');  -- route 02A

  -- Routes by code (stable)
  v_route_01a bigint := (SELECT id FROM routes WHERE code='ROUTE_COL_01A'); -- id=2 in your dump
  v_route_01b bigint := (SELECT id FROM routes WHERE code='ROUTE_COL_01B'); -- id=1
  v_route_02a bigint := (SELECT id FROM routes WHERE code='ROUTE_COL_02A'); -- id=3

  -- Rep route assignments (open-ended enabled)
  v_rra_mr1 bigint;
  v_rra_mr2 bigint;
  v_rra_mr3 bigint;

  -- Products (existing + optional extras)
  v_p1 bigint := (SELECT id FROM products WHERE code='PRD_SEED_01' AND deleted_at IS NULL);
  v_p2 bigint := (SELECT id FROM products WHERE code='PRD_SEED_02' AND deleted_at IS NULL);
  v_p3 bigint := (SELECT id FROM products WHERE code='PRD_SEED_03' AND deleted_at IS NULL);
  v_p4 bigint;
  v_p5 bigint;

  -- Doctors (per route, active A/B/C)
  d01a_a bigint; d01a_b bigint; d01a_c bigint;
  d01b_a bigint; d01b_b bigint; d01b_c bigint;
  d02a_a bigint; d02a_b bigint; d02a_c bigint;

  -- One existing seed doctor (id 1 in your DB)
  v_seed_doc bigint := 1;

  -- Chemists (per route)
  c01a_1 bigint; c01a_2 bigint;
  c01b_1 bigint;
  c02a_1 bigint;

  -- temp holders
  v_sub bigint;
  v_call bigint;
  v_visit bigint;

BEGIN
  -- Hard guards (fail fast if assumptions break)
  IF v_cm IS NULL OR v_fm IS NULL OR v_mr1 IS NULL OR v_mr2 IS NULL OR v_mr3 IS NULL THEN
    RAISE EXCEPTION 'Expected seed users not found. Check R__010_seed_users.sql applied.';
  END IF;
  IF v_route_01a IS NULL OR v_route_01b IS NULL OR v_route_02a IS NULL THEN
    RAISE EXCEPTION 'Expected routes not found. Check R__020_seed_geo.sql applied.';
  END IF;
  IF v_p1 IS NULL OR v_p2 IS NULL OR v_p3 IS NULL THEN
    RAISE EXCEPTION 'Expected seed products PRD_SEED_01..03 not found.';
  END IF;

  SELECT id INTO v_rra_mr1
  FROM rep_route_assignments
  WHERE rep_user_id=v_mr1 AND route_id=v_route_01a AND enabled=true AND end_date IS NULL;

  SELECT id INTO v_rra_mr2
  FROM rep_route_assignments
  WHERE rep_user_id=v_mr2 AND route_id=v_route_01b AND enabled=true AND end_date IS NULL;

  SELECT id INTO v_rra_mr3
  FROM rep_route_assignments
  WHERE rep_user_id=v_mr3 AND route_id=v_route_02a AND enabled=true AND end_date IS NULL;

  IF v_rra_mr1 IS NULL OR v_rra_mr2 IS NULL OR v_rra_mr3 IS NULL THEN
    RAISE EXCEPTION 'Missing rep_route_assignments. Check R__040_seed_activity.sql or your assignments.';
  END IF;

  --------------------------------------------------------------------
  -- 1) Fix existing seed doctor grade (so analytics can count it)
  --------------------------------------------------------------------
  UPDATE doctors
     SET grade='C'
   WHERE id=v_seed_doc AND grade IS NULL;

  --------------------------------------------------------------------
  -- 2) Ensure extra products (optional but useful for coverage variance)
  --------------------------------------------------------------------
  INSERT INTO products(code,name)
  SELECT 'PRD_DEMO_04','Demo Product 04'
  WHERE NOT EXISTS (SELECT 1 FROM products WHERE code='PRD_DEMO_04' AND deleted_at IS NULL);

  INSERT INTO products(code,name)
  SELECT 'PRD_DEMO_05','Demo Product 05'
  WHERE NOT EXISTS (SELECT 1 FROM products WHERE code='PRD_DEMO_05' AND deleted_at IS NULL);

  v_p4 := (SELECT id FROM products WHERE code='PRD_DEMO_04' AND deleted_at IS NULL);
  v_p5 := (SELECT id FROM products WHERE code='PRD_DEMO_05' AND deleted_at IS NULL);

  --------------------------------------------------------------------
  -- 3) Ensure doctors (A/B/C per route, ACTIVE) + doctor_routes mapping
  --------------------------------------------------------------------
  -- ROUTE_COL_01A
  INSERT INTO doctors(name,specialty,grade,status)
  SELECT 'Dr Demo A - 01A','Cardiology','A','ACTIVE'
  WHERE NOT EXISTS (SELECT 1 FROM doctors WHERE name='Dr Demo A - 01A' AND deleted_at IS NULL);
  INSERT INTO doctors(name,specialty,grade,status)
  SELECT 'Dr Demo B - 01A','Dermatology','B','ACTIVE'
  WHERE NOT EXISTS (SELECT 1 FROM doctors WHERE name='Dr Demo B - 01A' AND deleted_at IS NULL);
  INSERT INTO doctors(name,specialty,grade,status)
  SELECT 'Dr Demo C - 01A','General Practice','C','ACTIVE'
  WHERE NOT EXISTS (SELECT 1 FROM doctors WHERE name='Dr Demo C - 01A' AND deleted_at IS NULL);

  d01a_a := (SELECT id FROM doctors WHERE name='Dr Demo A - 01A' AND deleted_at IS NULL ORDER BY id LIMIT 1);
  d01a_b := (SELECT id FROM doctors WHERE name='Dr Demo B - 01A' AND deleted_at IS NULL ORDER BY id LIMIT 1);
  d01a_c := (SELECT id FROM doctors WHERE name='Dr Demo C - 01A' AND deleted_at IS NULL ORDER BY id LIMIT 1);

  -- ROUTE_COL_01B
  INSERT INTO doctors(name,specialty,grade,status)
  SELECT 'Dr Demo A - 01B','Neurology','A','ACTIVE'
  WHERE NOT EXISTS (SELECT 1 FROM doctors WHERE name='Dr Demo A - 01B' AND deleted_at IS NULL);
  INSERT INTO doctors(name,specialty,grade,status)
  SELECT 'Dr Demo B - 01B','ENT','B','ACTIVE'
  WHERE NOT EXISTS (SELECT 1 FROM doctors WHERE name='Dr Demo B - 01B' AND deleted_at IS NULL);
  INSERT INTO doctors(name,specialty,grade,status)
  SELECT 'Dr Demo C - 01B','Pediatrics','C','ACTIVE'
  WHERE NOT EXISTS (SELECT 1 FROM doctors WHERE name='Dr Demo C - 01B' AND deleted_at IS NULL);

  d01b_a := (SELECT id FROM doctors WHERE name='Dr Demo A - 01B' AND deleted_at IS NULL ORDER BY id LIMIT 1);
  d01b_b := (SELECT id FROM doctors WHERE name='Dr Demo B - 01B' AND deleted_at IS NULL ORDER BY id LIMIT 1);
  d01b_c := (SELECT id FROM doctors WHERE name='Dr Demo C - 01B' AND deleted_at IS NULL ORDER BY id LIMIT 1);

  -- ROUTE_COL_02A
  INSERT INTO doctors(name,specialty,grade,status)
  SELECT 'Dr Demo A - 02A','Oncology','A','ACTIVE'
  WHERE NOT EXISTS (SELECT 1 FROM doctors WHERE name='Dr Demo A - 02A' AND deleted_at IS NULL);
  INSERT INTO doctors(name,specialty,grade,status)
  SELECT 'Dr Demo B - 02A','Orthopedics','B','ACTIVE'
  WHERE NOT EXISTS (SELECT 1 FROM doctors WHERE name='Dr Demo B - 02A' AND deleted_at IS NULL);
  INSERT INTO doctors(name,specialty,grade,status)
  SELECT 'Dr Demo C - 02A','Internal Medicine','C','ACTIVE'
  WHERE NOT EXISTS (SELECT 1 FROM doctors WHERE name='Dr Demo C - 02A' AND deleted_at IS NULL);

  d02a_a := (SELECT id FROM doctors WHERE name='Dr Demo A - 02A' AND deleted_at IS NULL ORDER BY id LIMIT 1);
  d02a_b := (SELECT id FROM doctors WHERE name='Dr Demo B - 02A' AND deleted_at IS NULL ORDER BY id LIMIT 1);
  d02a_c := (SELECT id FROM doctors WHERE name='Dr Demo C - 02A' AND deleted_at IS NULL ORDER BY id LIMIT 1);

  -- Ensure doctor_routes (required by FK fk_doctor_calls_doctor_route_membership)
  INSERT INTO doctor_routes(doctor_id, route_id) VALUES
    (d01a_a, v_route_01a),
    (d01a_b, v_route_01a),
    (d01a_c, v_route_01a),
    (d01b_a, v_route_01b),
    (d01b_b, v_route_01b),
    (d01b_c, v_route_01b),
    (d02a_a, v_route_02a),
    (d02a_b, v_route_02a),
    (d02a_c, v_route_02a),
    (v_seed_doc, v_route_01a)
  ON CONFLICT DO NOTHING;

  --------------------------------------------------------------------
  -- 4) Ensure chemists per route
  --------------------------------------------------------------------
  INSERT INTO chemists(route_id,name)
  SELECT v_route_01a,'Demo Pharmacy 01A-1'
  WHERE NOT EXISTS (SELECT 1 FROM chemists WHERE name='Demo Pharmacy 01A-1' AND deleted_at IS NULL);
  INSERT INTO chemists(route_id,name)
  SELECT v_route_01a,'Demo Pharmacy 01A-2'
  WHERE NOT EXISTS (SELECT 1 FROM chemists WHERE name='Demo Pharmacy 01A-2' AND deleted_at IS NULL);
  INSERT INTO chemists(route_id,name)
  SELECT v_route_01b,'Demo Pharmacy 01B-1'
  WHERE NOT EXISTS (SELECT 1 FROM chemists WHERE name='Demo Pharmacy 01B-1' AND deleted_at IS NULL);
  INSERT INTO chemists(route_id,name)
  SELECT v_route_02a,'Demo Pharmacy 02A-1'
  WHERE NOT EXISTS (SELECT 1 FROM chemists WHERE name='Demo Pharmacy 02A-1' AND deleted_at IS NULL);

  c01a_1 := (SELECT id FROM chemists WHERE name='Demo Pharmacy 01A-1' AND deleted_at IS NULL ORDER BY id LIMIT 1);
  c01a_2 := (SELECT id FROM chemists WHERE name='Demo Pharmacy 01A-2' AND deleted_at IS NULL ORDER BY id LIMIT 1);
  c01b_1 := (SELECT id FROM chemists WHERE name='Demo Pharmacy 01B-1' AND deleted_at IS NULL ORDER BY id LIMIT 1);
  c02a_1 := (SELECT id FROM chemists WHERE name='Demo Pharmacy 02A-1' AND deleted_at IS NULL ORDER BY id LIMIT 1);

  --------------------------------------------------------------------
  -- Helper: create/find DCR submission by (rep, idem), return v_sub
  --------------------------------------------------------------------
  -- We use unique index ux_dcr_submissions_rep_idem (partial) by always providing idempotency_key.
  --------------------------------------------------------------------

  --------------------------------------------------------------------
  -- 5) DCR SEEDING (Jan + Feb 2026)
  --    A=6 visits/month, B=4, C=2 across fixed dates.
  --    Each date = one submission, multiple doctor_calls possible.
  --------------------------------------------------------------------

  -- ========== MR1 (mr@, ROUTE 01A) ==========
  PERFORM 1;

  -- FEB (6/4/2) on <= Feb 23
  -- 2026-02-03: A
  v_sub := (SELECT id FROM dcr_submissions WHERE rep_user_id=v_mr1 AND idempotency_key='DEMO_DCR_MR1_20260203');
  IF v_sub IS NULL THEN
    INSERT INTO dcr_submissions(rep_user_id, rep_route_assignment_id, call_date, idempotency_key)
    VALUES (v_mr1, v_rra_mr1, DATE '2026-02-03', 'DEMO_DCR_MR1_20260203')
    RETURNING id INTO v_sub;
  END IF;

  v_call := NULL;
  INSERT INTO doctor_calls(submission_id, rep_user_id, route_id, call_date, doctor_id, call_type)
  VALUES (v_sub, v_mr1, v_route_01a, DATE '2026-02-03', d01a_a, 'REGULAR')
  ON CONFLICT ON CONSTRAINT ux_doctor_calls_rep_doctor_date DO NOTHING
  RETURNING id INTO v_call;
  IF v_call IS NULL THEN
    v_call := (SELECT id FROM doctor_calls WHERE rep_user_id=v_mr1 AND doctor_id=d01a_a AND call_date=DATE '2026-02-03');
  END IF;
  INSERT INTO doctor_call_products(doctor_call_id, product_id)
  VALUES (v_call, v_p1), (v_call, v_p2)
  ON CONFLICT DO NOTHING;

  -- 2026-02-06: A
  v_sub := (SELECT id FROM dcr_submissions WHERE rep_user_id=v_mr1 AND idempotency_key='DEMO_DCR_MR1_20260206');
  IF v_sub IS NULL THEN
    INSERT INTO dcr_submissions(rep_user_id, rep_route_assignment_id, call_date, idempotency_key)
    VALUES (v_mr1, v_rra_mr1, DATE '2026-02-06', 'DEMO_DCR_MR1_20260206')
    RETURNING id INTO v_sub;
  END IF;

  v_call := NULL;
  INSERT INTO doctor_calls(submission_id, rep_user_id, route_id, call_date, doctor_id, call_type)
  VALUES (v_sub, v_mr1, v_route_01a, DATE '2026-02-06', d01a_a, 'REGULAR')
  ON CONFLICT ON CONSTRAINT ux_doctor_calls_rep_doctor_date DO NOTHING
  RETURNING id INTO v_call;
  IF v_call IS NULL THEN
    v_call := (SELECT id FROM doctor_calls WHERE rep_user_id=v_mr1 AND doctor_id=d01a_a AND call_date=DATE '2026-02-06');
  END IF;
  INSERT INTO doctor_call_products(doctor_call_id, product_id)
  VALUES (v_call, v_p1)
  ON CONFLICT DO NOTHING;

  -- 2026-02-10: A + B (multi-call same day)
  v_sub := (SELECT id FROM dcr_submissions WHERE rep_user_id=v_mr1 AND idempotency_key='DEMO_DCR_MR1_20260210');
  IF v_sub IS NULL THEN
    INSERT INTO dcr_submissions(rep_user_id, rep_route_assignment_id, call_date, idempotency_key)
    VALUES (v_mr1, v_rra_mr1, DATE '2026-02-10', 'DEMO_DCR_MR1_20260210')
    RETURNING id INTO v_sub;
  END IF;

  -- A
  v_call := NULL;
  INSERT INTO doctor_calls(submission_id, rep_user_id, route_id, call_date, doctor_id, call_type)
  VALUES (v_sub, v_mr1, v_route_01a, DATE '2026-02-10', d01a_a, 'REGULAR')
  ON CONFLICT ON CONSTRAINT ux_doctor_calls_rep_doctor_date DO NOTHING
  RETURNING id INTO v_call;
  IF v_call IS NULL THEN
    v_call := (SELECT id FROM doctor_calls WHERE rep_user_id=v_mr1 AND doctor_id=d01a_a AND call_date=DATE '2026-02-10');
  END IF;
  INSERT INTO doctor_call_products(doctor_call_id, product_id)
  VALUES (v_call, v_p2)
  ON CONFLICT DO NOTHING;

  -- B
  v_call := NULL;
  INSERT INTO doctor_calls(submission_id, rep_user_id, route_id, call_date, doctor_id, call_type)
  VALUES (v_sub, v_mr1, v_route_01a, DATE '2026-02-10', d01a_b, 'REGULAR')
  ON CONFLICT ON CONSTRAINT ux_doctor_calls_rep_doctor_date DO NOTHING
  RETURNING id INTO v_call;
  IF v_call IS NULL THEN
    v_call := (SELECT id FROM doctor_calls WHERE rep_user_id=v_mr1 AND doctor_id=d01a_b AND call_date=DATE '2026-02-10');
  END IF;
  INSERT INTO doctor_call_products(doctor_call_id, product_id)
  VALUES (v_call, v_p1), (v_call, v_p4)
  ON CONFLICT DO NOTHING;

  -- 2026-02-11: B
  v_sub := (SELECT id FROM dcr_submissions WHERE rep_user_id=v_mr1 AND idempotency_key='DEMO_DCR_MR1_20260211');
  IF v_sub IS NULL THEN
    INSERT INTO dcr_submissions(rep_user_id, rep_route_assignment_id, call_date, idempotency_key)
    VALUES (v_mr1, v_rra_mr1, DATE '2026-02-11', 'DEMO_DCR_MR1_20260211')
    RETURNING id INTO v_sub;
  END IF;
  v_call := NULL;
  INSERT INTO doctor_calls(submission_id, rep_user_id, route_id, call_date, doctor_id, call_type)
  VALUES (v_sub, v_mr1, v_route_01a, DATE '2026-02-11', d01a_b, 'REGULAR')
  ON CONFLICT ON CONSTRAINT ux_doctor_calls_rep_doctor_date DO NOTHING
  RETURNING id INTO v_call;
  IF v_call IS NULL THEN
    v_call := (SELECT id FROM doctor_calls WHERE rep_user_id=v_mr1 AND doctor_id=d01a_b AND call_date=DATE '2026-02-11');
  END IF;
  INSERT INTO doctor_call_products(doctor_call_id, product_id)
  VALUES (v_call, v_p2)
  ON CONFLICT DO NOTHING;

  -- 2026-02-14: A
  v_sub := (SELECT id FROM dcr_submissions WHERE rep_user_id=v_mr1 AND idempotency_key='DEMO_DCR_MR1_20260214');
  IF v_sub IS NULL THEN
    INSERT INTO dcr_submissions(rep_user_id, rep_route_assignment_id, call_date, idempotency_key)
    VALUES (v_mr1, v_rra_mr1, DATE '2026-02-14', 'DEMO_DCR_MR1_20260214')
    RETURNING id INTO v_sub;
  END IF;
  v_call := NULL;
  INSERT INTO doctor_calls(submission_id, rep_user_id, route_id, call_date, doctor_id, call_type)
  VALUES (v_sub, v_mr1, v_route_01a, DATE '2026-02-14', d01a_a, 'REGULAR')
  ON CONFLICT ON CONSTRAINT ux_doctor_calls_rep_doctor_date DO NOTHING
  RETURNING id INTO v_call;
  IF v_call IS NULL THEN
    v_call := (SELECT id FROM doctor_calls WHERE rep_user_id=v_mr1 AND doctor_id=d01a_a AND call_date=DATE '2026-02-14');
  END IF;
  INSERT INTO doctor_call_products(doctor_call_id, product_id)
  VALUES (v_call, v_p1), (v_call, v_p5)
  ON CONFLICT DO NOTHING;

  -- 2026-02-17: B
  v_sub := (SELECT id FROM dcr_submissions WHERE rep_user_id=v_mr1 AND idempotency_key='DEMO_DCR_MR1_20260217');
  IF v_sub IS NULL THEN
    INSERT INTO dcr_submissions(rep_user_id, rep_route_assignment_id, call_date, idempotency_key)
    VALUES (v_mr1, v_rra_mr1, DATE '2026-02-17', 'DEMO_DCR_MR1_20260217')
    RETURNING id INTO v_sub;
  END IF;
  v_call := NULL;
  INSERT INTO doctor_calls(submission_id, rep_user_id, route_id, call_date, doctor_id, call_type)
  VALUES (v_sub, v_mr1, v_route_01a, DATE '2026-02-17', d01a_b, 'REGULAR')
  ON CONFLICT ON CONSTRAINT ux_doctor_calls_rep_doctor_date DO NOTHING
  RETURNING id INTO v_call;
  IF v_call IS NULL THEN
    v_call := (SELECT id FROM doctor_calls WHERE rep_user_id=v_mr1 AND doctor_id=d01a_b AND call_date=DATE '2026-02-17');
  END IF;
  INSERT INTO doctor_call_products(doctor_call_id, product_id)
  VALUES (v_call, v_p4)
  ON CONFLICT DO NOTHING;

  -- 2026-02-18: A + C
  v_sub := (SELECT id FROM dcr_submissions WHERE rep_user_id=v_mr1 AND idempotency_key='DEMO_DCR_MR1_20260218');
  IF v_sub IS NULL THEN
    INSERT INTO dcr_submissions(rep_user_id, rep_route_assignment_id, call_date, idempotency_key)
    VALUES (v_mr1, v_rra_mr1, DATE '2026-02-18', 'DEMO_DCR_MR1_20260218')
    RETURNING id INTO v_sub;
  END IF;

  -- A
  v_call := NULL;
  INSERT INTO doctor_calls(submission_id, rep_user_id, route_id, call_date, doctor_id, call_type)
  VALUES (v_sub, v_mr1, v_route_01a, DATE '2026-02-18', d01a_a, 'REGULAR')
  ON CONFLICT ON CONSTRAINT ux_doctor_calls_rep_doctor_date DO NOTHING
  RETURNING id INTO v_call;
  IF v_call IS NULL THEN
    v_call := (SELECT id FROM doctor_calls WHERE rep_user_id=v_mr1 AND doctor_id=d01a_a AND call_date=DATE '2026-02-18');
  END IF;
  INSERT INTO doctor_call_products(doctor_call_id, product_id)
  VALUES (v_call, v_p2)
  ON CONFLICT DO NOTHING;

  -- C
  v_call := NULL;
  INSERT INTO doctor_calls(submission_id, rep_user_id, route_id, call_date, doctor_id, call_type)
  VALUES (v_sub, v_mr1, v_route_01a, DATE '2026-02-18', d01a_c, 'REGULAR')
  ON CONFLICT ON CONSTRAINT ux_doctor_calls_rep_doctor_date DO NOTHING
  RETURNING id INTO v_call;
  IF v_call IS NULL THEN
    v_call := (SELECT id FROM doctor_calls WHERE rep_user_id=v_mr1 AND doctor_id=d01a_c AND call_date=DATE '2026-02-18');
  END IF;
  INSERT INTO doctor_call_products(doctor_call_id, product_id)
  VALUES (v_call, v_p3)
  ON CONFLICT DO NOTHING;

  -- 2026-02-19: C
  v_sub := (SELECT id FROM dcr_submissions WHERE rep_user_id=v_mr1 AND idempotency_key='DEMO_DCR_MR1_20260219');
  IF v_sub IS NULL THEN
    INSERT INTO dcr_submissions(rep_user_id, rep_route_assignment_id, call_date, idempotency_key)
    VALUES (v_mr1, v_rra_mr1, DATE '2026-02-19', 'DEMO_DCR_MR1_20260219')
    RETURNING id INTO v_sub;
  END IF;
  v_call := NULL;
  INSERT INTO doctor_calls(submission_id, rep_user_id, route_id, call_date, doctor_id, call_type)
  VALUES (v_sub, v_mr1, v_route_01a, DATE '2026-02-19', d01a_c, 'REGULAR')
  ON CONFLICT ON CONSTRAINT ux_doctor_calls_rep_doctor_date DO NOTHING
  RETURNING id INTO v_call;
  IF v_call IS NULL THEN
    v_call := (SELECT id FROM doctor_calls WHERE rep_user_id=v_mr1 AND doctor_id=d01a_c AND call_date=DATE '2026-02-19');
  END IF;
  INSERT INTO doctor_call_products(doctor_call_id, product_id)
  VALUES (v_call, v_p1)
  ON CONFLICT DO NOTHING;

  -- 2026-02-22: A
  v_sub := (SELECT id FROM dcr_submissions WHERE rep_user_id=v_mr1 AND idempotency_key='DEMO_DCR_MR1_20260222');
  IF v_sub IS NULL THEN
    INSERT INTO dcr_submissions(rep_user_id, rep_route_assignment_id, call_date, idempotency_key)
    VALUES (v_mr1, v_rra_mr1, DATE '2026-02-22', 'DEMO_DCR_MR1_20260222')
    RETURNING id INTO v_sub;
  END IF;
  v_call := NULL;
  INSERT INTO doctor_calls(submission_id, rep_user_id, route_id, call_date, doctor_id, call_type)
  VALUES (v_sub, v_mr1, v_route_01a, DATE '2026-02-22', d01a_a, 'REGULAR')
  ON CONFLICT ON CONSTRAINT ux_doctor_calls_rep_doctor_date DO NOTHING
  RETURNING id INTO v_call;
  IF v_call IS NULL THEN
    v_call := (SELECT id FROM doctor_calls WHERE rep_user_id=v_mr1 AND doctor_id=d01a_a AND call_date=DATE '2026-02-22');
  END IF;
  INSERT INTO doctor_call_products(doctor_call_id, product_id)
  VALUES (v_call, v_p1), (v_call, v_p2)
  ON CONFLICT DO NOTHING;

  -- 2026-02-23: B
  v_sub := (SELECT id FROM dcr_submissions WHERE rep_user_id=v_mr1 AND idempotency_key='DEMO_DCR_MR1_20260223');
  IF v_sub IS NULL THEN
    INSERT INTO dcr_submissions(rep_user_id, rep_route_assignment_id, call_date, idempotency_key)
    VALUES (v_mr1, v_rra_mr1, DATE '2026-02-23', 'DEMO_DCR_MR1_20260223')
    RETURNING id INTO v_sub;
  END IF;
  v_call := NULL;
  INSERT INTO doctor_calls(submission_id, rep_user_id, route_id, call_date, doctor_id, call_type)
  VALUES (v_sub, v_mr1, v_route_01a, DATE '2026-02-23', d01a_b, 'REGULAR')
  ON CONFLICT ON CONSTRAINT ux_doctor_calls_rep_doctor_date DO NOTHING
  RETURNING id INTO v_call;
  IF v_call IS NULL THEN
    v_call := (SELECT id FROM doctor_calls WHERE rep_user_id=v_mr1 AND doctor_id=d01a_b AND call_date=DATE '2026-02-23');
  END IF;
  INSERT INTO doctor_call_products(doctor_call_id, product_id)
  VALUES (v_call, v_p2), (v_call, v_p4)
  ON CONFLICT DO NOTHING;

  -- Missed doctor example (adds missed_doctors rows)
  v_sub := (SELECT id FROM dcr_submissions WHERE rep_user_id=v_mr1 AND idempotency_key='DEMO_MISSED_MR1_20260215');
  IF v_sub IS NULL THEN
    INSERT INTO dcr_submissions(rep_user_id, rep_route_assignment_id, call_date, idempotency_key)
    VALUES (v_mr1, v_rra_mr1, DATE '2026-02-15', 'DEMO_MISSED_MR1_20260215')
    RETURNING id INTO v_sub;
  END IF;
  INSERT INTO missed_doctors(submission_id, rep_user_id, route_id, missed_date, doctor_id, reason)
  VALUES (v_sub, v_mr1, v_route_01a, DATE '2026-02-15', d01a_c, 'Clinic closed')
  ON CONFLICT ON CONSTRAINT ux_missed_doctors_rep_doctor_date DO NOTHING;

  -- ========== MR2 (mr2@, ROUTE 01B) ==========
  -- Keep it compact but complete: seed a few Feb + Jan days including missed.
  -- FEB 2026-02-05: A+B
  v_sub := (SELECT id FROM dcr_submissions WHERE rep_user_id=v_mr2 AND idempotency_key='DEMO_DCR_MR2_20260205');
  IF v_sub IS NULL THEN
    INSERT INTO dcr_submissions(rep_user_id, rep_route_assignment_id, call_date, idempotency_key)
    VALUES (v_mr2, v_rra_mr2, DATE '2026-02-05', 'DEMO_DCR_MR2_20260205')
    RETURNING id INTO v_sub;
  END IF;

  v_call := NULL;
  INSERT INTO doctor_calls(submission_id, rep_user_id, route_id, call_date, doctor_id, call_type)
  VALUES (v_sub, v_mr2, v_route_01b, DATE '2026-02-05', d01b_a, 'REGULAR')
  ON CONFLICT ON CONSTRAINT ux_doctor_calls_rep_doctor_date DO NOTHING RETURNING id INTO v_call;
  IF v_call IS NULL THEN v_call := (SELECT id FROM doctor_calls WHERE rep_user_id=v_mr2 AND doctor_id=d01b_a AND call_date=DATE '2026-02-05'); END IF;
  INSERT INTO doctor_call_products(doctor_call_id, product_id) VALUES (v_call, v_p1) ON CONFLICT DO NOTHING;

  v_call := NULL;
  INSERT INTO doctor_calls(submission_id, rep_user_id, route_id, call_date, doctor_id, call_type)
  VALUES (v_sub, v_mr2, v_route_01b, DATE '2026-02-05', d01b_b, 'REGULAR')
  ON CONFLICT ON CONSTRAINT ux_doctor_calls_rep_doctor_date DO NOTHING RETURNING id INTO v_call;
  IF v_call IS NULL THEN v_call := (SELECT id FROM doctor_calls WHERE rep_user_id=v_mr2 AND doctor_id=d01b_b AND call_date=DATE '2026-02-05'); END IF;
  INSERT INTO doctor_call_products(doctor_call_id, product_id) VALUES (v_call, v_p2), (v_call, v_p4) ON CONFLICT DO NOTHING;

  -- FEB 2026-02-12: C + missed B
  v_sub := (SELECT id FROM dcr_submissions WHERE rep_user_id=v_mr2 AND idempotency_key='DEMO_DCR_MR2_20260212');
  IF v_sub IS NULL THEN
    INSERT INTO dcr_submissions(rep_user_id, rep_route_assignment_id, call_date, idempotency_key)
    VALUES (v_mr2, v_rra_mr2, DATE '2026-02-12', 'DEMO_DCR_MR2_20260212')
    RETURNING id INTO v_sub;
  END IF;
  v_call := NULL;
  INSERT INTO doctor_calls(submission_id, rep_user_id, route_id, call_date, doctor_id, call_type)
  VALUES (v_sub, v_mr2, v_route_01b, DATE '2026-02-12', d01b_c, 'REGULAR')
  ON CONFLICT ON CONSTRAINT ux_doctor_calls_rep_doctor_date DO NOTHING RETURNING id INTO v_call;
  IF v_call IS NULL THEN v_call := (SELECT id FROM doctor_calls WHERE rep_user_id=v_mr2 AND doctor_id=d01b_c AND call_date=DATE '2026-02-12'); END IF;
  INSERT INTO doctor_call_products(doctor_call_id, product_id) VALUES (v_call, v_p3) ON CONFLICT DO NOTHING;

  INSERT INTO missed_doctors(submission_id, rep_user_id, route_id, missed_date, doctor_id, reason)
  VALUES (v_sub, v_mr2, v_route_01b, DATE '2026-02-12', d01b_b, 'Doctor unavailable')
  ON CONFLICT ON CONSTRAINT ux_missed_doctors_rep_doctor_date DO NOTHING;

  -- JAN baseline
  v_sub := (SELECT id FROM dcr_submissions WHERE rep_user_id=v_mr2 AND idempotency_key='DEMO_DCR_MR2_20260116');
  IF v_sub IS NULL THEN
    INSERT INTO dcr_submissions(rep_user_id, rep_route_assignment_id, call_date, idempotency_key)
    VALUES (v_mr2, v_rra_mr2, DATE '2026-01-16', 'DEMO_DCR_MR2_20260116')
    RETURNING id INTO v_sub;
  END IF;
  v_call := NULL;
  INSERT INTO doctor_calls(submission_id, rep_user_id, route_id, call_date, doctor_id, call_type)
  VALUES (v_sub, v_mr2, v_route_01b, DATE '2026-01-16', d01b_a, 'REGULAR')
  ON CONFLICT ON CONSTRAINT ux_doctor_calls_rep_doctor_date DO NOTHING RETURNING id INTO v_call;
  IF v_call IS NULL THEN v_call := (SELECT id FROM doctor_calls WHERE rep_user_id=v_mr2 AND doctor_id=d01b_a AND call_date=DATE '2026-01-16'); END IF;
  INSERT INTO doctor_call_products(doctor_call_id, product_id) VALUES (v_call, v_p1), (v_call, v_p2) ON CONFLICT DO NOTHING;

  -- ========== MR3 (mr3@, ROUTE 02A) ==========
  v_sub := (SELECT id FROM dcr_submissions WHERE rep_user_id=v_mr3 AND idempotency_key='DEMO_DCR_MR3_20260207');
  IF v_sub IS NULL THEN
    INSERT INTO dcr_submissions(rep_user_id, rep_route_assignment_id, call_date, idempotency_key)
    VALUES (v_mr3, v_rra_mr3, DATE '2026-02-07', 'DEMO_DCR_MR3_20260207')
    RETURNING id INTO v_sub;
  END IF;
  v_call := NULL;
  INSERT INTO doctor_calls(submission_id, rep_user_id, route_id, call_date, doctor_id, call_type)
  VALUES (v_sub, v_mr3, v_route_02a, DATE '2026-02-07', d02a_a, 'REGULAR')
  ON CONFLICT ON CONSTRAINT ux_doctor_calls_rep_doctor_date DO NOTHING RETURNING id INTO v_call;
  IF v_call IS NULL THEN v_call := (SELECT id FROM doctor_calls WHERE rep_user_id=v_mr3 AND doctor_id=d02a_a AND call_date=DATE '2026-02-07'); END IF;
  INSERT INTO doctor_call_products(doctor_call_id, product_id) VALUES (v_call, v_p1), (v_call, v_p5) ON CONFLICT DO NOTHING;

  v_sub := (SELECT id FROM dcr_submissions WHERE rep_user_id=v_mr3 AND idempotency_key='DEMO_MISSED_MR3_20260208');
  IF v_sub IS NULL THEN
    INSERT INTO dcr_submissions(rep_user_id, rep_route_assignment_id, call_date, idempotency_key)
    VALUES (v_mr3, v_rra_mr3, DATE '2026-02-08', 'DEMO_MISSED_MR3_20260208')
    RETURNING id INTO v_sub;
  END IF;
  INSERT INTO missed_doctors(submission_id, rep_user_id, route_id, missed_date, doctor_id, reason)
  VALUES (v_sub, v_mr3, v_route_02a, DATE '2026-02-08', d02a_c, 'No time / traffic')
  ON CONFLICT ON CONSTRAINT ux_missed_doctors_rep_doctor_date DO NOTHING;

  --------------------------------------------------------------------
  -- 6) CHEMIST REPORTS (chemist_report_submissions -> chemist_visits -> stock_flags)
  -- Make sure OOS + LOW exist across routes/products.
  --------------------------------------------------------------------

  -- Helper pattern: for each submission key, ensure submission, ensure visit, then flags.

  -- MR1 Feb 2026-02-09 (01A) @ chemist c01a_1
  v_sub := (SELECT id FROM chemist_report_submissions WHERE rep_user_id=v_mr1 AND idempotency_key='DEMO_CH_MR1_20260209');
  IF v_sub IS NULL THEN
    INSERT INTO chemist_report_submissions(rep_user_id, rep_route_assignment_id, visit_date, idempotency_key)
    VALUES (v_mr1, v_rra_mr1, DATE '2026-02-09', 'DEMO_CH_MR1_20260209')
    RETURNING id INTO v_sub;
  END IF;

  v_visit := (SELECT id FROM chemist_visits WHERE submission_id=v_sub AND chemist_id=c01a_1);
  IF v_visit IS NULL THEN
    INSERT INTO chemist_visits(submission_id, rep_user_id, route_id, visit_date, chemist_id)
    VALUES (v_sub, v_mr1, v_route_01a, DATE '2026-02-09', c01a_1)
    RETURNING id INTO v_visit;
  END IF;

  -- Flags (idempotent by NOT EXISTS)
  INSERT INTO chemist_stock_flags(visit_id, product_id, status)
  SELECT v_visit, v_p1, 'OOS'
  WHERE NOT EXISTS (SELECT 1 FROM chemist_stock_flags WHERE visit_id=v_visit AND product_id=v_p1);
  INSERT INTO chemist_stock_flags(visit_id, product_id, status)
  SELECT v_visit, v_p2, 'LOW'
  WHERE NOT EXISTS (SELECT 1 FROM chemist_stock_flags WHERE visit_id=v_visit AND product_id=v_p2);

  -- MR2 Feb 2026-02-12 (01B) @ chemist c01b_1
  v_sub := (SELECT id FROM chemist_report_submissions WHERE rep_user_id=v_mr2 AND idempotency_key='DEMO_CH_MR2_20260212');
  IF v_sub IS NULL THEN
    INSERT INTO chemist_report_submissions(rep_user_id, rep_route_assignment_id, visit_date, idempotency_key)
    VALUES (v_mr2, v_rra_mr2, DATE '2026-02-12', 'DEMO_CH_MR2_20260212')
    RETURNING id INTO v_sub;
  END IF;

  v_visit := (SELECT id FROM chemist_visits WHERE submission_id=v_sub AND chemist_id=c01b_1);
  IF v_visit IS NULL THEN
    INSERT INTO chemist_visits(submission_id, rep_user_id, route_id, visit_date, chemist_id)
    VALUES (v_sub, v_mr2, v_route_01b, DATE '2026-02-12', c01b_1)
    RETURNING id INTO v_visit;
  END IF;

  INSERT INTO chemist_stock_flags(visit_id, product_id, status)
  SELECT v_visit, v_p1, 'LOW'
  WHERE NOT EXISTS (SELECT 1 FROM chemist_stock_flags WHERE visit_id=v_visit AND product_id=v_p1);
  INSERT INTO chemist_stock_flags(visit_id, product_id, status)
  SELECT v_visit, v_p4, 'OOS'
  WHERE NOT EXISTS (SELECT 1 FROM chemist_stock_flags WHERE visit_id=v_visit AND product_id=v_p4);

  -- MR3 Feb 2026-02-13 (02A) @ chemist c02a_1
  v_sub := (SELECT id FROM chemist_report_submissions WHERE rep_user_id=v_mr3 AND idempotency_key='DEMO_CH_MR3_20260213');
  IF v_sub IS NULL THEN
    INSERT INTO chemist_report_submissions(rep_user_id, rep_route_assignment_id, visit_date, idempotency_key)
    VALUES (v_mr3, v_rra_mr3, DATE '2026-02-13', 'DEMO_CH_MR3_20260213')
    RETURNING id INTO v_sub;
  END IF;

  v_visit := (SELECT id FROM chemist_visits WHERE submission_id=v_sub AND chemist_id=c02a_1);
  IF v_visit IS NULL THEN
    INSERT INTO chemist_visits(submission_id, rep_user_id, route_id, visit_date, chemist_id)
    VALUES (v_sub, v_mr3, v_route_02a, DATE '2026-02-13', c02a_1)
    RETURNING id INTO v_visit;
  END IF;

  INSERT INTO chemist_stock_flags(visit_id, product_id, status)
  SELECT v_visit, v_p5, 'OOS'
  WHERE NOT EXISTS (SELECT 1 FROM chemist_stock_flags WHERE visit_id=v_visit AND product_id=v_p5);
  INSERT INTO chemist_stock_flags(visit_id, product_id, status)
  SELECT v_visit, v_p2, 'LOW'
  WHERE NOT EXISTS (SELECT 1 FROM chemist_stock_flags WHERE visit_id=v_visit AND product_id=v_p2);

  --------------------------------------------------------------------
  -- 7) MILEAGE (idempotent by ux_mileage_entries_rep_route_date)
  --------------------------------------------------------------------
  INSERT INTO mileage_entries(rep_user_id, rep_route_assignment_id, route_id, entry_date, km)
  VALUES
    (v_mr1, v_rra_mr1, v_route_01a, DATE '2026-02-03', 12.50),
    (v_mr1, v_rra_mr1, v_route_01a, DATE '2026-02-10', 14.00),
    (v_mr2, v_rra_mr2, v_route_01b, DATE '2026-02-05', 20.50),
    (v_mr3, v_rra_mr3, v_route_02a, DATE '2026-02-07', 18.75),
    (v_mr2, v_rra_mr2, v_route_01b, DATE '2026-01-16', 19.25)
  ON CONFLICT ON CONSTRAINT ux_mileage_entries_rep_route_date DO NOTHING;

END $$;

