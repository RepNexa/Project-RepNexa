CREATE TABLE IF NOT EXISTS rep_route_assignments (
  id BIGSERIAL PRIMARY KEY,
  rep_user_id BIGINT NOT NULL REFERENCES users(id),
  route_id BIGINT NOT NULL REFERENCES routes(id),
  assigned_by_user_id BIGINT NOT NULL REFERENCES users(id),
  start_date DATE NOT NULL,
  end_date DATE NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_rep_route_assignments_date_range
    CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_rra_rep_user_id ON rep_route_assignments(rep_user_id);
CREATE INDEX IF NOT EXISTS idx_rra_route_id ON rep_route_assignments(route_id);

-- DB guard: prevent duplicate open-ended "active" assignment for same (rep, route)
CREATE UNIQUE INDEX IF NOT EXISTS ux_rra_open_ended_active
ON rep_route_assignments (rep_user_id, route_id)
WHERE enabled = TRUE AND end_date IS NULL;
