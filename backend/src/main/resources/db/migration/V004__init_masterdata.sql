CREATE TABLE IF NOT EXISTS doctors (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  specialty VARCHAR(120) NULL,
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doctors_deleted_at ON doctors(deleted_at);
CREATE INDEX IF NOT EXISTS idx_doctors_name_lower ON doctors (lower(name));

CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(160) NOT NULL,
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_products_code_active
ON products(code)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON products(deleted_at);
CREATE INDEX IF NOT EXISTS idx_products_name_lower ON products (lower(name));
CREATE INDEX IF NOT EXISTS idx_products_code_lower ON products (lower(code));

-- Chemists are single-route for MVP
CREATE TABLE IF NOT EXISTS chemists (
  id BIGSERIAL PRIMARY KEY,
  route_id BIGINT NOT NULL REFERENCES routes(id),
  name VARCHAR(160) NOT NULL,
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chemists_deleted_at ON chemists(deleted_at);
CREATE INDEX IF NOT EXISTS idx_chemists_route_id ON chemists(route_id);
CREATE INDEX IF NOT EXISTS idx_chemists_name_lower ON chemists (lower(name));

-- Doctors are many-to-many with routes
CREATE TABLE IF NOT EXISTS doctor_routes (
  doctor_id BIGINT NOT NULL REFERENCES doctors(id),
  route_id BIGINT NOT NULL REFERENCES routes(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (doctor_id, route_id)
);

CREATE INDEX IF NOT EXISTS idx_doctor_routes_route_doctor ON doctor_routes(route_id, doctor_id);
