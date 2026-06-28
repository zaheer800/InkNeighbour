-- New owners should start as open (accepting orders) after registration.
-- Previously the default was 'OFF', requiring every new owner to manually
-- toggle themselves on before appearing in search results.
ALTER TABLE owners
  ALTER COLUMN manual_state SET DEFAULT 'ON';
