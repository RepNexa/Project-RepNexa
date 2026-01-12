-- Chemist report submissions (immutable)
CREATE TABLE IF NOT EXISTS chemist_report_submissions (
  id BIGSERIAL PRIMARY KEY,
  rep_user_id BIGINT NOT NULL REFERENCES users(id),
  rep_route_assignment_id BIGINT NOT NULL REFERENCES rep_route_assignments(id),
  visit_date DATE NOT NULL,
  idempotency_key VARCHAR(120) NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_chemist_report_submissions_rep_idem
ON chemist_report_submissions(rep_user_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chemist_report_submissions_rep_date
ON chemist_report_submissions(rep_user_id, visit_date DESC);

CREATE INDEX IF NOT EXISTS idx_chemist_report_submissions_assignment
ON chemist_report_submissions(rep_route_assignment_id);

-- Chemist visits (one per chemist per submission; no uniqueness required by spec)
CREATE TABLE IF NOT EXISTS chemist_visits (
  id BIGSERIAL PRIMARY KEY,
  submission_id BIGINT NOT NULL REFERENCES chemist_report_submissions(id) ON DELETE RESTRICT,
  rep_user_id BIGINT NOT NULL REFERENCES users(id),
  route_id BIGINT NOT NULL REFERENCES routes(id),
  visit_date DATE NOT NULL,
  chemist_id BIGINT NOT NULL REFERENCES chemists(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chemist_visits_submission ON chemist_visits(submission_id);
CREATE INDEX IF NOT EXISTS idx_chemist_visits_route_date ON chemist_visits(route_id, visit_date);
CREATE INDEX IF NOT EXISTS idx_chemist_visits_chemist_date ON chemist_visits(chemist_id, visit_date);

-- Stock flags: exactly one status per (visit, product)
CREATE TABLE IF NOT EXISTS chemist_stock_flags (
  id BIGSERIAL PRIMARY KEY,
  visit_id BIGINT NOT NULL REFERENCES chemist_visits(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id),
  status VARCHAR(10) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_chemist_stock_flags_status CHECK (status IN ('OOS', 'LOW')),
  CONSTRAINT ux_chemist_stock_flags_visit_product UNIQUE (visit_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_chemist_stock_flags_visit ON chemist_stock_flags(visit_id);
CREATE INDEX IF NOT EXISTS idx_chemist_stock_flags_product ON chemist_stock_flags(product_id);

-- Mileage entries: UNIQUE(rep, route, date)
CREATE TABLE IF NOT EXISTS mileage_entries (
  id BIGSERIAL PRIMARY KEY,
  rep_user_id BIGINT NOT NULL REFERENCES users(id),
  rep_route_assignment_id BIGINT NOT NULL REFERENCES rep_route_assignments(id),
  route_id BIGINT NOT NULL REFERENCES routes(id),
  entry_date DATE NOT NULL,
  km NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_mileage_km_positive CHECK (km > 0),
  CONSTRAINT ux_mileage_entries_rep_route_date UNIQUE (rep_user_id, route_id, entry_date)
);

CREATE INDEX IF NOT EXISTS idx_mileage_entries_rep_date ON mileage_entries(rep_user_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_mileage_entries_route_date ON mileage_entries(route_id, entry_date DESC);

-- Guardrails: ensure denormalized columns match the submission + assignment route
CREATE OR REPLACE FUNCTION fn_enforce_chemist_visit_consistency()
RETURNS TRIGGER AS $$
DECLARE
  v_rep BIGINT;
  v_date DATE;
  v_route BIGINT;
BEGIN
  SELECT s.rep_user_id, s.visit_date, a.route_id
    INTO v_rep, v_date, v_route
  FROM chemist_report_submissions s
  JOIN rep_route_assignments a ON a.id = s.rep_route_assignment_id
  WHERE s.id = NEW.submission_id;

  IF v_rep IS NULL THEN
    RAISE EXCEPTION 'submission_not_found';
  END IF;

  IF NEW.rep_user_id <> v_rep OR NEW.visit_date <> v_date OR NEW.route_id <> v_route THEN
    RAISE EXCEPTION 'chemist_visit_inconsistent_with_submission';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_chemist_visits_consistency ON chemist_visits;
CREATE TRIGGER tg_chemist_visits_consistency
BEFORE INSERT OR UPDATE ON chemist_visits
FOR EACH ROW EXECUTE FUNCTION fn_enforce_chemist_visit_consistency();

CREATE OR REPLACE FUNCTION fn_enforce_mileage_consistency()
RETURNS TRIGGER AS $$
DECLARE
  v_rep BIGINT;
  v_route BIGINT;
BEGIN
  SELECT a.rep_user_id, a.route_id
    INTO v_rep, v_route
  FROM rep_route_assignments a
  WHERE a.id = NEW.rep_route_assignment_id;

  IF v_rep IS NULL THEN
    RAISE EXCEPTION 'assignment_not_found';
  END IF;

  IF NEW.rep_user_id <> v_rep OR NEW.route_id <> v_route THEN
    RAISE EXCEPTION 'mileage_inconsistent_with_assignment';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_mileage_consistency ON mileage_entries;
CREATE TRIGGER tg_mileage_consistency
BEFORE INSERT OR UPDATE ON mileage_entries
FOR EACH ROW EXECUTE FUNCTION fn_enforce_mileage_consistency();
