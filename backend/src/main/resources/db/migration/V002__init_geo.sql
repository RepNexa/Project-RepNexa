CREATE TABLE IF NOT EXISTS territories (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  owner_user_id BIGINT NULL REFERENCES users(id),
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_territories_owner_user_id ON territories(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_territories_deleted_at ON territories(deleted_at);

CREATE TABLE IF NOT EXISTS routes (
  id BIGSERIAL PRIMARY KEY,
  territory_id BIGINT NOT NULL REFERENCES territories(id),
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_routes_territory_id ON routes(territory_id);
CREATE INDEX IF NOT EXISTS idx_routes_deleted_at ON routes(deleted_at);
