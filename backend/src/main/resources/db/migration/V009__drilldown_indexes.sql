-- Milestone 7: drilldown/paged visit log indexes
-- Keep indexes narrow and aligned to the primary filters + ORDER BY.

create index if not exists idx_doctor_calls_doctor_date
  on doctor_calls (doctor_id, call_date desc);

create index if not exists idx_doctor_calls_route_date
  on doctor_calls (route_id, call_date desc);

create index if not exists idx_doctor_calls_rep_date
  on doctor_calls (rep_user_id, call_date desc);