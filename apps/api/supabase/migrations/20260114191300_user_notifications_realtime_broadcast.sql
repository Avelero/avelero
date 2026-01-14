-- =============================================
-- USER NOTIFICATIONS REALTIME BROADCAST
-- =============================================
-- This migration creates a dedicated broadcast function and trigger
-- for user notifications. Unlike other domain broadcasts which are
-- brand-scoped, notifications are USER-scoped (personal to each user).

-- =============================================
-- BROADCAST FUNCTION FOR USER NOTIFICATIONS
-- =============================================
-- Broadcasts to a user-specific channel: notifications:{user_id}
-- This is different from brand-scoped broadcasts which use: {domain}:{brand_id}

CREATE OR REPLACE FUNCTION realtime.broadcast_user_notification()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_id_value uuid;
  payload jsonb;
BEGIN
  -- Get user_id from new record (INSERT) or old record (DELETE)
  user_id_value := COALESCE(NEW.user_id, OLD.user_id);

  -- Skip if no user_id (shouldn't happen, but safety check)
  IF user_id_value IS NULL THEN
    RETURN NULL;
  END IF;

  -- Build lightweight payload (don't send full record for privacy)
  payload := jsonb_build_object(
    'id', COALESCE(NEW.id, OLD.id),
    'type', COALESCE(NEW.type, OLD.type),
    'resource_type', COALESCE(NEW.resource_type, OLD.resource_type),
    'resource_id', COALESCE(NEW.resource_id, OLD.resource_id)
  );

  -- Broadcast to user-specific channel
  -- Topic format: notifications:{user_id}
  PERFORM realtime.broadcast_changes(
    'notifications:' || user_id_value::text,  -- topic: e.g., "notifications:uuid"
    TG_OP,                                     -- event: INSERT/UPDATE/DELETE
    TG_OP,                                     -- operation
    TG_TABLE_NAME,                             -- table name
    TG_TABLE_SCHEMA,                           -- schema
    NEW,                                       -- new record
    OLD                                        -- old record
  );

  RETURN NULL;
END;
$$;

-- =============================================
-- TRIGGER FOR USER NOTIFICATIONS TABLE
-- =============================================
-- Fires on INSERT (new notification created) and UPDATE (marked as seen/dismissed)
-- DELETE is less critical since nothing needs to be pushed for deleted notifications

CREATE TRIGGER broadcast_user_notification
  AFTER INSERT OR UPDATE OR DELETE ON user_notifications
  FOR EACH ROW EXECUTE FUNCTION realtime.broadcast_user_notification();
