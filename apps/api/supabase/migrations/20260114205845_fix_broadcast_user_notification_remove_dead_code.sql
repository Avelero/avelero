-- =============================================
-- FIX: Remove unused payload variable from broadcast_user_notification
--
-- The original migration built a `payload` jsonb variable but never used it,
-- passing full NEW/OLD records to broadcast_changes instead.
-- This removes the dead code for clarity.
-- =============================================

CREATE OR REPLACE FUNCTION realtime.broadcast_user_notification()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_id_value uuid;
BEGIN
  -- Get user_id from new record (INSERT) or old record (DELETE)
  user_id_value := COALESCE(NEW.user_id, OLD.user_id);

  -- Skip if no user_id (shouldn't happen, but safety check)
  IF user_id_value IS NULL THEN
    RETURN NULL;
  END IF;

  -- Broadcast to user-specific channel
  -- Topic format: notifications:{user_id}
  -- Note: Full record is passed to broadcast_changes for flexibility.
  -- RLS policies on realtime.messages ensure users only receive their own notifications.
  IF TG_OP = 'DELETE' THEN
    PERFORM realtime.broadcast_changes(
      'notifications:' || user_id_value::text,
      TG_OP,
      TG_OP,
      TG_TABLE_NAME,
      TG_TABLE_SCHEMA,
      NULL::record,
      OLD
    );
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM realtime.broadcast_changes(
      'notifications:' || user_id_value::text,
      TG_OP,
      TG_OP,
      TG_TABLE_NAME,
      TG_TABLE_SCHEMA,
      NEW,
      NULL::record
    );
  ELSE -- UPDATE
    PERFORM realtime.broadcast_changes(
      'notifications:' || user_id_value::text,
      TG_OP,
      TG_OP,
      TG_TABLE_NAME,
      TG_TABLE_SCHEMA,
      NEW,
      OLD
    );
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION realtime.broadcast_user_notification() IS
  'Broadcasts user notification changes to user-specific realtime channels. Uses notifications:{user_id} topic format for personal notifications.';
