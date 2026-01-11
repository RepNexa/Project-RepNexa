-- DCR submissions (immutable)
CREATE TABLE IF NOT EXISTS dcr_submissions (
  id BIGSERIAL PRIMARY KEY,
  rep_user_id BIGINT NOT NULL REFERENCES users(id),
  rep_route_assignment_id BIGINT NOT NULL REFERENCES rep_route_assignments(id),
  call_date DATE NOT NULL,
  idempotency_key VARCHAR(120) NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_dcr_submissions_rep_idem
ON dcr_submissions(rep_user_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dcr_submissions_rep_date ON dcr_submissions(rep_user_id, call_date DESC);
CREATE INDEX IF NOT EXISTS idx_dcr_submissions_assignment ON dcr_submissions(rep_route_assignment_id);

-- Doctor calls (denormalize rep_user_id + route_id + call_date for uniqueness + analytics)
CREATE TABLE IF NOT EXISTS doctor_calls (
  id BIGSERIAL PRIMARY KEY,
  submission_id BIGINT NOT NULL REFERENCES dcr_submissions(id) ON DELETE RESTRICT,
  rep_user_id BIGINT NOT NULL REFERENCES users(id),
  route_id BIGINT NOT NULL REFERENCES routes(id),
  call_date DATE NOT NULL,
  doctor_id BIGINT NOT NULL REFERENCES doctors(id),
  call_type VARCHAR(40) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ux_doctor_calls_rep_doctor_date UNIQUE (rep_user_id, doctor_id, call_date),
  CONSTRAINT fk_doctor_calls_doctor_route_membership
    FOREIGN KEY (doctor_id, route_id) REFERENCES doctor_routes(doctor_id, route_id)
);

CREATE INDEX IF NOT EXISTS idx_doctor_calls_submission ON doctor_calls(submission_id);
CREATE INDEX IF NOT EXISTS idx_doctor_calls_rep_date ON doctor_calls(rep_user_id, call_date);
CREATE INDEX IF NOT EXISTS idx_doctor_calls_doctor_date ON doctor_calls(doctor_id, call_date);

-- Doctor call products (optional / multi)
CREATE TABLE IF NOT EXISTS doctor_call_products (
  doctor_call_id BIGINT NOT NULL REFERENCES doctor_calls(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id),
  PRIMARY KEY (doctor_call_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_doctor_call_products_product ON doctor_call_products(product_id);

-- Missed doctors (also denormalize for uniqueness + analytics)
CREATE TABLE IF NOT EXISTS missed_doctors (
  id BIGSERIAL PRIMARY KEY,
  submission_id BIGINT NOT NULL REFERENCES dcr_submissions(id) ON DELETE RESTRICT,
  rep_user_id BIGINT NOT NULL REFERENCES users(id),
  route_id BIGINT NOT NULL REFERENCES routes(id),
  missed_date DATE NOT NULL,
  doctor_id BIGINT NOT NULL REFERENCES doctors(id),
  reason VARCHAR(240) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ux_missed_doctors_rep_doctor_date UNIQUE (rep_user_id, doctor_id, missed_date),
  CONSTRAINT fk_missed_doctors_doctor_route_membership
    FOREIGN KEY (doctor_id, route_id) REFERENCES doctor_routes(doctor_id, route_id)
);

CREATE INDEX IF NOT EXISTS idx_missed_doctors_submission ON missed_doctors(submission_id);
CREATE INDEX IF NOT EXISTS idx_missed_doctors_rep_date ON missed_doctors(rep_user_id, missed_date);

-- Consistency triggers to ensure denormalized columns match the submission + assignment route.
-- This prevents “fake” route_id/rep_user_id/call_date on child rows.
CREATE OR REPLACE FUNCTION fn_enforce_doctor_calls_consistency()
RETURNS TRIGGER AS $$
DECLARE
  v_rep BIGINT;
  v_date DATE;
  v_route BIGINT;
BEGIN
  SELECT s.rep_user_id, s.call_date, a.route_id
    INTO v_rep, v_date, v_route
  FROM dcr_submissions s
  JOIN rep_route_assignments a ON a.id = s.rep_route_assignment_id
  WHERE s.id = NEW.submission_id;

  IF v_rep IS NULL THEN
    RAISE EXCEPTION 'submission_not_found';
  END IF;

  IF NEW.rep_user_id <> v_rep OR NEW.call_date <> v_date OR NEW.route_id <> v_route THEN
    RAISE EXCEPTION 'doctor_calls_inconsistent_with_submission';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_doctor_calls_consistency ON doctor_calls;
CREATE TRIGGER tg_doctor_calls_consistency
BEFORE INSERT OR UPDATE ON doctor_calls
FOR EACH ROW EXECUTE FUNCTION fn_enforce_doctor_calls_consistency();

CREATE OR REPLACE FUNCTION fn_enforce_missed_doctors_consistency()
RETURNS TRIGGER AS $$
DECLARE
  v_rep BIGINT;
  v_date DATE;
  v_route BIGINT;
BEGIN
  SELECT s.rep_user_id, s.call_date, a.route_id
    INTO v_rep, v_date, v_route
  FROM dcr_submissions s
  JOIN rep_route_assignments a ON a.id = s.rep_route_assignment_id
  WHERE s.id = NEW.submission_id;

  IF v_rep IS NULL THEN
    RAISE EXCEPTION 'submission_not_found';
  END IF;

  IF NEW.rep_user_id <> v_rep OR NEW.missed_date <> v_date OR NEW.route_id <> v_route THEN
    RAISE EXCEPTION 'missed_doctors_inconsistent_with_submission';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_missed_doctors_consistency ON missed_doctors;
CREATE TRIGGER tg_missed_doctors_consistency
BEFORE INSERT OR UPDATE ON missed_doctors
FOR EACH ROW EXECUTE FUNCTION fn_enforce_missed_doctors_consistency();
