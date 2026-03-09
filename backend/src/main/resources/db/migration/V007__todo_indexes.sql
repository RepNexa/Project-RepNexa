-- Milestone 5: indexes to support MR todo queries

CREATE INDEX IF NOT EXISTS idx_doctor_calls_rep_route_date
ON doctor_calls (rep_user_id, route_id, call_date);

CREATE INDEX IF NOT EXISTS idx_doctor_routes_route_doctor
ON doctor_routes (route_id, doctor_id);