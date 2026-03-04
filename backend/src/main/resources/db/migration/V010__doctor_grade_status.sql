-- RepNexa: Doctor master-data completeness for analytics + admin filtering
-- Adds grade (A/B/C) and status (ACTIVE/RETIRED). Grade is nullable until backfilled.

ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS grade varchar(1);

ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS status varchar(16) NOT NULL DEFAULT 'ACTIVE';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_doctors_grade') THEN
    ALTER TABLE doctors ADD CONSTRAINT ck_doctors_grade
      CHECK (grade IS NULL OR grade IN ('A','B','C'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_doctors_status') THEN
    ALTER TABLE doctors ADD CONSTRAINT ck_doctors_status
      CHECK (status IN ('ACTIVE','RETIRED'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_doctors_grade_active  ON doctors(grade)  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_doctors_status_active ON doctors(status) WHERE deleted_at IS NULL;
