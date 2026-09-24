BEGIN;

-- Grant only the runtime permissions required by the catalog and cart APIs.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'orbital_app') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA public TO orbital_app';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA public TO orbital_app';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE carts, cart_items TO orbital_app';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT ON TABLES TO orbital_app';
  END IF;
END
$$;

COMMIT;
