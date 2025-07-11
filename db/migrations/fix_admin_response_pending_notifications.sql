-- Fix admin response notifications to not trigger on pending status
-- Users should only get notifications when admin actually responds (approved/rejected), not when status is set to pending

-- Update the function to only send notifications for meaningful admin actions
CREATE OR REPLACE FUNCTION notify_user_on_admin_response()
RETURNS TRIGGER AS $$
DECLARE
    response_record RECORD;
    notification_message TEXT;
BEGIN
    -- Get the relevant response
    SELECT * INTO response_record
    FROM responses
    WHERE id = NEW.response_id;
    
    -- Only send notifications for actual admin decisions, not pending status
    -- Pending status is set automatically when user edits response, not when admin responds
    IF NEW.status = 'pending' THEN
        RETURN NEW; -- Exit without creating notification
    END IF;
    
    -- For UPDATE, first delete any existing unread notifications for this admin_response
    -- to prevent duplicates
    IF TG_OP = 'UPDATE' THEN
        DELETE FROM notifications 
        WHERE related_response_id = response_record.id
        AND recipient_id = response_record.user_id 
        AND title = 'Admin responded to your reply'
        AND is_read = false;
    END IF;
    
    -- Set notification message based on admin action
    IF NEW.status = 'approved' THEN
        notification_message := 'Your response has been approved';
    ELSIF NEW.status = 'rejected' THEN
        notification_message := 'Your response has been rejected. You may edit your response if you wish';
    ELSE
        -- This should not happen since we exit early for pending, but just in case
        notification_message := 'Admin has responded to your reply';
    END IF;
    
    -- Insert notification for the user ONLY if they have access to the proposal
    INSERT INTO notifications (
        recipient_id, 
        title, 
        message, 
        type, 
        link_url, 
        related_proposal_id, 
        related_response_id
    )
    SELECT
        response_record.user_id,
        'Admin responded to your reply',
        notification_message,
        'popup',
        '/dashboard/view-response?id=' || response_record.id,
        response_record.proposal_id,
        response_record.id
    FROM proposal_visibility pv
    WHERE pv.proposal_id = response_record.proposal_id
    AND pv.user_id = response_record.user_id;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Recreate the trigger
DROP TRIGGER IF EXISTS admin_response_notification_trigger ON admin_responses;

CREATE TRIGGER admin_response_notification_trigger
AFTER INSERT OR UPDATE ON admin_responses
FOR EACH ROW EXECUTE PROCEDURE notify_user_on_admin_response();

-- Clean up any existing notifications that were created for pending status
DELETE FROM notifications 
WHERE title = 'Admin responded to your reply'
AND message = 'Admin has responded to your reply'
AND is_read = false
AND EXISTS (
    SELECT 1 FROM admin_responses ar
    JOIN responses r ON ar.response_id = r.id
    WHERE ar.status = 'pending'
    AND r.id = notifications.related_response_id
);

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Admin response notification fix completed successfully';
    RAISE NOTICE 'Key improvements:';
    RAISE NOTICE '1. Users no longer receive notifications when admin_response is set to pending';
    RAISE NOTICE '2. Notifications only sent for actual admin decisions (approved/rejected)';
    RAISE NOTICE '3. Cleaned up existing pending notifications';
    RAISE NOTICE '4. Improved notification messages for approved/rejected responses';
END $$; 