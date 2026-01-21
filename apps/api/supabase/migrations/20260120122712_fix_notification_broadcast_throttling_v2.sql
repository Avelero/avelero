-- =============================================
-- FIX: Notification Broadcast Throttling (v2)
-- =============================================
-- Problem: User notifications are not being throttled, resulting in
-- thousands of messages during bulk operations.
--
-- Solution: Update broadcast_user_notification() to properly implement
-- throttling using the same pattern as broadcast_domain_changes().
-- Uses realtime.send() for direct payload control.
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
  -- Use advisory lock to prevent race conditions between concurrent transactions.
  -- pg_try_advisory_xact_lock returns FALSE immediately if lock is held by another transaction.
  -- The lock is automatically released when the transaction commits/rollbacks.

  IF pg_try_advisory_xact_lock(hashtext(domain_name || ':' || user_id_value::text)) THEN
    -- We acquired the lock, check if we should broadcast

    -- Get last broadcast time for this domain/user (scope_id = user_id for notifications)
    SELECT last_broadcast_at INTO last_broadcast
    FROM realtime.broadcast_throttle
    WHERE domain = domain_name AND scope_id = user_id_value;

    -- Broadcast if:
    -- 1. No previous broadcast exists (last_broadcast IS NULL), OR
    -- 2. Enough time has passed since last broadcast (>= throttle_ms)
    IF last_broadcast IS NULL OR
       (EXTRACT(EPOCH FROM (clock_timestamp() - last_broadcast)) * 1000) >= throttle_ms THEN
      should_broadcast := true;

      -- Update/insert the throttle timestamp
      INSERT INTO realtime.broadcast_throttle (domain, scope_id, last_broadcast_at)
      VALUES (domain_name, user_id_value, clock_timestamp())
      ON CONFLICT (domain, scope_id)
      DO UPDATE SET last_broadcast_at = clock_timestamp();
    END IF;
  END IF;
  -- If we couldn't get the lock, another transaction is handling this user's notifications

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
  'Broadcasts user notification changes using realtime.send() with 1-second throttling. Uses notifications:{user_id} topic format. Payload: { id, type, title, message }.';
