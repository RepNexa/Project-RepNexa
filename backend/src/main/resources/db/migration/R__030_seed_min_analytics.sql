-- Minimal dev analytics seed data (doctor + doctor_routes + MR route assignment + chemist).
-- Purpose:
-- - Make Milestone 7 drilldowns testable in dev even when full business data is not seeded.
-- - Make drilldowns + rep submissions testable in dev even when full business data is not seeded.
-- - Ensure at least one doctor exists so visit-log endpoints can be exercised.
--
-- Preconditions:
-- - R__010_seed_users.sql provides cm@repnexa.local and mr@repnexa.local.
-- - R__020_seed_geo.sql provides ROUTE_COL_01A.
--
-- Idempotency:
-- - Reuses existing seeded doctor if found by a deterministic key (prefers doctors.code if present, else doctors.name).
-- - Avoids duplicate doctor_routes and chemists via NOT EXISTS checks.
-- - rep_route_assignments uses ON CONFLICT against ux_rra_open_ended_active.
--
DO $$
DECLARE
  v_route_id bigint;
  v_cm_id bigint;
  v_mr_id bigint;

  v_key_col text;
  v_key_val text;
  v_doctor_id bigint;

  v_p_key_col text;
  v_p_key_val text;
  v_p_name text;
  v_product_id bigint;
  i int;

  cols text := '';
  vals text := '';

  col record;
  is_required boolean;

  fk_ref_table text;
  fk_ref_col text;
  fk_expr text;

  type_is_enum boolean;
BEGIN
  -- Resolve required route + users
  SELECT id INTO v_route_id
  FROM routes
  WHERE code = 'ROUTE_COL_01A'
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_route_id IS NULL THEN
    RAISE EXCEPTION 'Dev seed requires route ROUTE_COL_01A. Ensure R__020_seed_geo.sql runs first.';
  END IF;

  SELECT id INTO v_cm_id FROM users WHERE username='cm@repnexa.local' LIMIT 1;
  SELECT id INTO v_mr_id FROM users WHERE username='mr@repnexa.local' LIMIT 1;

  IF v_cm_id IS NULL OR v_mr_id IS NULL THEN
    RAISE EXCEPTION 'Dev seed requires users cm@repnexa.local and mr@repnexa.local. Ensure R__010_seed_users.sql runs first.';
  END IF;

  -- Seed minimal products (needed by DCR + chemist submissions + product drilldowns).
  -- Idempotent: reuses deterministic code if available, else falls back to name.
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='products'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='products' AND column_name='code'
    ) THEN
      v_p_key_col := 'code';
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='products' AND column_name='product_code'
    ) THEN
      v_p_key_col := 'product_code';
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='products' AND column_name='sku'
    ) THEN
      v_p_key_col := 'sku';
    ELSE
      v_p_key_col := NULL;
    END IF;

    FOR i IN 1..3 LOOP
      v_p_key_val := 'PRD_SEED_' || lpad(i::text, 2, '0');
      v_p_name := 'Seed Product ' || lpad(i::text, 2, '0');
      v_product_id := NULL;

      -- Try key lookup first
      IF v_p_key_col IS NOT NULL THEN
        EXECUTE format('SELECT id FROM products WHERE %I = $1 LIMIT 1', v_p_key_col)
          INTO v_product_id USING v_p_key_val;
      END IF;

      -- Fallback: name lookup if present
      IF v_product_id IS NULL AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='products' AND column_name='name'
      ) THEN
        EXECUTE 'SELECT id FROM products WHERE lower(name)=lower($1) LIMIT 1'
          INTO v_product_id USING v_p_name;
      END IF;

      -- Undelete if soft-deleted
      IF v_product_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='products' AND column_name='deleted_at'
      ) THEN
        EXECUTE 'UPDATE products SET deleted_at = NULL, updated_at = NOW() WHERE id = $1'
          USING v_product_id;
      END IF;

      -- Insert product if missing (fills required cols safely via information_schema).
      IF v_product_id IS NULL THEN
        cols := '';
        vals := '';

        -- Always include deterministic key col/value if available
        IF v_p_key_col IS NOT NULL THEN
          cols := cols || quote_ident(v_p_key_col) || ',';
          vals := vals || quote_literal(v_p_key_val) || ',';
        END IF;

        -- Prefer name column if exists
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='products' AND column_name='name'
        ) THEN
          cols := cols || 'name,';
          vals := vals || quote_literal(v_p_name) || ',';
        END IF;

        FOR col IN
          SELECT column_name, data_type, udt_name, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema='public' AND table_name='products'
          ORDER BY ordinal_position
        LOOP
          IF col.column_name = 'id' THEN
            CONTINUE;
          END IF;
          IF v_p_key_col IS NOT NULL AND col.column_name = v_p_key_col THEN
            CONTINUE;
          END IF;
          IF col.column_name = 'name' THEN
            CONTINUE;
          END IF;

          is_required := (col.is_nullable = 'NO' AND col.column_default IS NULL);
          IF NOT is_required THEN
            CONTINUE;
          END IF;

          -- Detect FK requirement and choose an existing referenced id
          SELECT ccu.table_name, ccu.column_name
            INTO fk_ref_table, fk_ref_col
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
          WHERE tc.table_schema='public'
            AND tc.table_name='products'
            AND tc.constraint_type='FOREIGN KEY'
            AND kcu.column_name = col.column_name
          LIMIT 1;

          cols := cols || quote_ident(col.column_name) || ',';

          IF fk_ref_table IS NOT NULL THEN
            IF EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name=fk_ref_table AND column_name='deleted_at'
            ) THEN
              fk_expr := format('(SELECT min(%I) FROM %I WHERE deleted_at IS NULL)', fk_ref_col, fk_ref_table);
            ELSE
              fk_expr := format('(SELECT min(%I) FROM %I)', fk_ref_col, fk_ref_table);
            END IF;
            vals := vals || fk_expr || ',';
            fk_ref_table := NULL;
            fk_ref_col := NULL;
            CONTINUE;
          END IF;

          type_is_enum := EXISTS (
            SELECT 1
            FROM pg_type t
            WHERE t.typname = col.udt_name
              AND t.typtype = 'e'
          );

          IF type_is_enum THEN
            vals := vals || format(
              '(SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname=%L ORDER BY enumsortorder LIMIT 1)::%I,',
              col.udt_name,
              col.udt_name
            );
          ELSIF col.data_type IN ('character varying','text') THEN
            IF col.column_name ILIKE '%name%' THEN
              vals := vals || quote_literal(v_p_name) || ',';
            ELSIF col.column_name ILIKE '%code%' OR col.column_name ILIKE '%sku%' THEN
              vals := vals || quote_literal(v_p_key_val) || ',';
            ELSE
              vals := vals || quote_literal('SEED') || ',';
            END IF;
          ELSIF col.data_type = 'boolean' THEN
            vals := vals || 'TRUE,';
          ELSIF col.data_type = 'date' THEN
            vals := vals || 'CURRENT_DATE,';
          ELSIF col.data_type LIKE 'timestamp%' THEN
            vals := vals || 'NOW(),';
          ELSE
            vals := vals || '1,';
          END IF;
        END LOOP;

        IF cols = '' THEN
          EXECUTE 'INSERT INTO products DEFAULT VALUES RETURNING id' INTO v_product_id;
        ELSE
          cols := left(cols, length(cols)-1);
          vals := left(vals, length(vals)-1);
          EXECUTE format('INSERT INTO products (%s) VALUES (%s) RETURNING id', cols, vals)
            INTO v_product_id;
        END IF;
      END IF;
    END LOOP;
  END IF;


  -- Pick a deterministic doctor key column if available.
  -- Prefer doctors.code (or doctor_code) so we can reliably find the row without creating duplicates.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='doctors' AND column_name='code'
  ) THEN
    v_key_col := 'code';
    v_key_val := 'DOC_SEED_01';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='doctors' AND column_name='doctor_code'
  ) THEN
    v_key_col := 'doctor_code';
    v_key_val := 'DOC_SEED_01';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='doctors' AND column_name='name'
  ) THEN
    v_key_col := 'name';
    v_key_val := 'Dr Seed 01';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='doctors' AND column_name='full_name'
  ) THEN
    v_key_col := 'full_name';
    v_key_val := 'Dr Seed 01';
  ELSE
    v_key_col := NULL;
    v_key_val := NULL;
  END IF;

  -- Try to find existing seeded doctor
  IF v_key_col IS NOT NULL THEN
    EXECUTE format('SELECT id FROM doctors WHERE %I = $1 LIMIT 1', v_key_col)
      INTO v_doctor_id USING v_key_val;
  END IF;

  -- If found and doctors has soft delete, undelete it
  IF v_doctor_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='doctors' AND column_name='deleted_at'
  ) THEN
    EXECUTE 'UPDATE doctors SET deleted_at = NULL, updated_at = NOW() WHERE id = $1'
      USING v_doctor_id;
  END IF;

  -- Insert doctor if missing
  IF v_doctor_id IS NULL THEN
    cols := '';
    vals := '';

    -- Always include key col/value if available (even if nullable) so we can find this row later.
    IF v_key_col IS NOT NULL THEN
      cols := cols || quote_ident(v_key_col) || ',';
      vals := vals || quote_literal(v_key_val) || ',';
    END IF;

    -- Populate required (NOT NULL + no default) columns with reasonable dev values.
    FOR col IN
      SELECT column_name, data_type, udt_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='doctors'
      ORDER BY ordinal_position
    LOOP
      IF col.column_name = 'id' THEN
        CONTINUE;
      END IF;
      IF v_key_col IS NOT NULL AND col.column_name = v_key_col THEN
        CONTINUE;
      END IF;

      is_required := (col.is_nullable = 'NO' AND col.column_default IS NULL);
      IF NOT is_required THEN
        CONTINUE;
      END IF;

      -- Detect if this required column is a FK (so we choose an existing referenced id).
      SELECT ccu.table_name, ccu.column_name
        INTO fk_ref_table, fk_ref_col
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      WHERE tc.table_schema='public'
        AND tc.table_name='doctors'
        AND tc.constraint_type='FOREIGN KEY'
        AND kcu.column_name = col.column_name
      LIMIT 1;

      cols := cols || quote_ident(col.column_name) || ',';

      IF fk_ref_table IS NOT NULL THEN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name=fk_ref_table AND column_name='deleted_at'
        ) THEN
          fk_expr := format('(SELECT min(%I) FROM %I WHERE deleted_at IS NULL)', fk_ref_col, fk_ref_table);
        ELSE
          fk_expr := format('(SELECT min(%I) FROM %I)', fk_ref_col, fk_ref_table);
        END IF;
        vals := vals || fk_expr || ',';
        fk_ref_table := NULL;
        fk_ref_col := NULL;
        CONTINUE;
      END IF;

      -- USER-DEFINED often means enum types in Postgres; choose first enum label.
      type_is_enum := EXISTS (
        SELECT 1
        FROM pg_type t
        WHERE t.typname = col.udt_name
          AND t.typtype = 'e'
      );

      IF type_is_enum THEN
        vals := vals || format(
          '(SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname=%L ORDER BY enumsortorder LIMIT 1)::%I,',
          col.udt_name,
          col.udt_name
        );
      ELSIF col.data_type IN ('character varying','text') THEN
        IF col.column_name ILIKE '%name%' THEN
          vals := vals || quote_literal('Dr Seed 01') || ',';
        ELSIF col.column_name ILIKE '%email%' THEN
          vals := vals || quote_literal('seed.doctor@repnexa.local') || ',';
        ELSIF col.column_name ILIKE '%phone%' OR col.column_name ILIKE '%mobile%' THEN
          vals := vals || quote_literal('0700000000') || ',';
        ELSIF col.column_name ILIKE '%special%' THEN
          vals := vals || quote_literal('General') || ',';
        ELSIF col.column_name ILIKE '%code%' THEN
          vals := vals || quote_literal('DOC_SEED_01') || ',';
        ELSE
          vals := vals || quote_literal('SEED') || ',';
        END IF;
      ELSIF col.data_type = 'boolean' THEN
        vals := vals || 'TRUE,';
      ELSIF col.data_type = 'date' THEN
        vals := vals || 'CURRENT_DATE,';
      ELSIF col.data_type LIKE 'timestamp%' THEN
        vals := vals || 'NOW(),';
      ELSE
        -- numeric / other scalar types
        vals := vals || '1,';
      END IF;
    END LOOP;

    -- If doctors has no required cols without defaults, DEFAULT VALUES is enough.
    IF cols = '' THEN
      EXECUTE 'INSERT INTO doctors DEFAULT VALUES RETURNING id' INTO v_doctor_id;
    ELSE
      cols := left(cols, length(cols)-1);
      vals := left(vals, length(vals)-1);
      EXECUTE format('INSERT INTO doctors (%s) VALUES (%s) RETURNING id', cols, vals)
        INTO v_doctor_id;
    END IF;
  END IF;

  -- Ensure doctor is mapped to the seeded route (required by doctor_calls consistency FK).
  IF NOT EXISTS (
    SELECT 1 FROM doctor_routes WHERE doctor_id = v_doctor_id AND route_id = v_route_id
  ) THEN
    INSERT INTO doctor_routes (doctor_id, route_id)
    VALUES (v_doctor_id, v_route_id);
  END IF;
  -- Ensure MR has an active route assignment (helps MR-scoped flows and future seeds).
  PERFORM 1
  FROM rep_route_assignments
  WHERE rep_user_id = v_mr_id
    AND route_id = v_route_id
    AND enabled = TRUE
    AND end_date IS NULL;

  IF FOUND THEN
    UPDATE rep_route_assignments
    SET
      assigned_by_user_id = v_cm_id,
      start_date = CURRENT_DATE - 30,
      enabled = TRUE,
      updated_at = NOW()
    WHERE rep_user_id = v_mr_id
      AND route_id = v_route_id
      AND enabled = TRUE
      AND end_date IS NULL;
  ELSE
    INSERT INTO rep_route_assignments (
      rep_user_id, route_id, assigned_by_user_id, start_date, end_date, enabled
    ) VALUES (
      v_mr_id, v_route_id, v_cm_id, CURRENT_DATE - 30, NULL, TRUE
    );
  END IF;

  -- Minimal chemist for the route (useful for UI + future tests; independent of doctor_calls schema).
  IF NOT EXISTS (
    SELECT 1
    FROM chemists
    WHERE route_id = v_route_id
      AND deleted_at IS NULL
      AND lower(name) = lower('Seed Pharmacy 01')
  ) THEN
    INSERT INTO chemists (route_id, name, deleted_at)
    VALUES (v_route_id, 'Seed Pharmacy 01', NULL);
  END IF;
END $$;