-- Known dev users:
-- CM: cm@repnexa.local / CM@1234
-- FM: fm@repnexa.local / FM@1234  (must_change_password=true)
-- MR: mr@repnexa.local / MR@1234

INSERT INTO users (username, password_hash, role, enabled, must_change_password)
VALUES
  ('cm@repnexa.local', '$2b$10$T5wxMqghgtRivi.9XpLNGO5QtoGlxncL6i89F/7d20Vk9Thg71rn6', 'CM', TRUE, FALSE),
  ('fm@repnexa.local', '$2b$10$Z6gAKdnil60xfd1Ho9cHEehOOBXIXXjbiEYHjWbRAL7hjnOn9C7MS', 'FM', TRUE, FALSE),
  ('mr@repnexa.local', '$2b$10$h8FLDE3l0GpcyGISiDvqi.dsgMgEW6AQa82twd6gJRhTRoi.fwpTa', 'MR', TRUE, FALSE)
ON CONFLICT (username) DO UPDATE
SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  enabled = EXCLUDED.enabled,
  must_change_password = EXCLUDED.must_change_password,
  updated_at = NOW();
