-- Rate-limit public blog contact submissions without storing raw visitor IPs.
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.blog_contact_rate_limits (
  fingerprint text PRIMARY KEY CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count >= 1)
);

REVOKE ALL ON TABLE private.blog_contact_rate_limits FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE OR REPLACE FUNCTION private.consume_blog_contact_rate_limit(p_fingerprint text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private
AS $function$
DECLARE
  current_time_value timestamptz := pg_catalog.now();
  current_count integer;
BEGIN
  IF p_fingerprint IS NULL OR p_fingerprint !~ '^[0-9a-f]{64}$' THEN
    RETURN false;
  END IF;

  INSERT INTO private.blog_contact_rate_limits AS current_limit (
    fingerprint,
    window_started_at,
    request_count
  )
  VALUES (p_fingerprint, current_time_value, 1)
  ON CONFLICT (fingerprint) DO UPDATE
  SET
    window_started_at = CASE
      WHEN current_limit.window_started_at <= current_time_value - interval '1 hour'
        THEN current_time_value
      ELSE current_limit.window_started_at
    END,
    request_count = CASE
      WHEN current_limit.window_started_at <= current_time_value - interval '1 hour'
        THEN 1
      ELSE current_limit.request_count + 1
    END
  RETURNING request_count INTO current_count;

  DELETE FROM private.blog_contact_rate_limits
  WHERE window_started_at < current_time_value - interval '2 days';

  RETURN current_count <= 3;
END;
$function$;

REVOKE ALL ON FUNCTION private.consume_blog_contact_rate_limit(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.consume_blog_contact_rate_limit(text) TO service_role;

CREATE OR REPLACE FUNCTION public.consume_blog_contact_rate_limit(p_fingerprint text)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, private
AS $function$
  SELECT private.consume_blog_contact_rate_limit(p_fingerprint);
$function$;

REVOKE ALL ON FUNCTION public.consume_blog_contact_rate_limit(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_blog_contact_rate_limit(text) TO service_role;