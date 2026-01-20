-- =============================================
-- USE realtime.send() FOR NOTIFICATION BROADCASTS
-- =============================================
-- Changes the notification broadcast trigger from broadcast_changes() to
-- realtime.send() for simpler, more flexible payload structure.
--
-- Rationale:
-- - broadcast_changes() is designed for database change notifications with
--   nested new/old record structure
-- - realtime.send() allows direct control over the payload structure
-- - Notifications need a flat payload { id, type, title, message } for toast display
-- - The frontend can read payload.payload directly without nested navigation
-- =============================================

CREATE OR REPLACE FUNCTION realtime.broadcast_user_notification()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = realtime, public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  user_id_value uuid;
  domain_name text := 'notifications';
  topic text;
  payload jsonb;
  -- Throttle variables
  last_broadcast timestamptz;
  throttle_ms integer := 1000; -- 1 second throttle
  should_broadcast boolean := false;
BEGIN
  -- Get user_id from new record (INSERT) or old record (DELETE)
  user_id_value := COALESCE(NEW.user_id, OLD.user_id);

  -- Skip if no user_id (shouldn't happen, but safety check)
  IF user_id_value IS NULL THEN
    RETURN NULL;
  END IF;

  -- Build topic name
  topic := 'notifications:' || user_id_value::text;

  -- =============================================
  -- THROTTLE LOGIC
  -- =============================================
  IF pg_try_advisory_xact_lock(hashtext(domain_name || ':' || user_id_value::text)) THEN
    SELECT last_broadcast_at INTO last_broadcast
    FROM realtime.broadcast_throttle
    WHERE domain = domain_name AND scope_id = user_id_value;

    IF last_broadcast IS NULL OR
       (EXTRACT(EPOCH FROM (clock_timestamp() - last_broadcast)) * 1000) >= throttle_ms THEN
      should_broadcast := true;

      INSERT INTO realtime.broadcast_throttle (domain, scope_id, last_broadcast_at)
      VALUES (domain_name, user_id_value, clock_timestamp())
      ON CONFLICT (domain, scope_id)
      DO UPDATE SET last_broadcast_at = clock_timestamp();
    END IF;
  END IF;

  -- =============================================
  -- BUILD PAYLOAD AND BROADCAST
  -- =============================================
  IF should_broadcast THEN
    -- Build flat payload with fields needed for toast display
    IF TG_OP = 'DELETE' THEN
      payload := jsonb_build_object(
        'id', OLD.id,
        'type', OLD.type,
        'title', OLD.title,
        'message', OLD.message
      );
    ELSE
      payload := jsonb_build_object(
        'id', NEW.id,
        'type', NEW.type,
        'title', NEW.title,
        'message', NEW.message
      );
    END IF;

    -- Use realtime.send() for direct payload control
    -- Payload structure: { id, type, title, message }
    -- Client receives this at payload.payload
    PERFORM realtime.send(
      payload,    -- JSONB payload
      TG_OP,      -- Event: INSERT, UPDATE, DELETE
      topic,      -- Topic: notifications:{user_id}
      true        -- Private channel (requires auth)
    );
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION realtime.broadcast_user_notification() IS
  'Broadcasts user notification changes using realtime.send() for flat payload structure. Includes throttling to prevent message flooding during bulk operations.';
