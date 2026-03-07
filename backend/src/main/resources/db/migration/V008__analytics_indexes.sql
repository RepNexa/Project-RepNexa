-- Milestone 6: analytics indexes supporting time + route aggregations

-- doctor_calls already has (rep_user_id, route_id, call_date) and (rep_user_id, call_date) etc,
-- but route/date grouping is common for Company Overview charts.
create index if not exists idx_doctor_calls_route_date
    on doctor_calls (route_id, call_date);