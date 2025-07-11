-- Update the notification message for admin responses to user replies

-- Drop and recreate the function with conditional messages based on response status
DROP FUNCTION IF EXISTS notify_user_on_admin_response CASCADE;

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
    
    -- For UPDATE, first delete any existing unread notifications for this admin_response
    -- to prevent duplicates
    IF TG_OP = 'UPDATE' THEN
        DELETE FROM notifications 
        WHERE related_response_id = response_record.id
        AND recipient_id = response_record.user_id 
        AND title = 'Admin responded to your reply'
        AND is_read = false;
    END IF;
    
    -- Set notification message based on response status and admin action
    -- Give priority to pending_update status over admin response status
    IF response_record.status = 'pending_update' THEN
        -- If user response is set to pending_update, this means admin is requesting changes
        notification_message := 'Admin is allowing you to edit your response';
    -- If not pending_update, then check admin response status
    ELSIF NEW.status = 'approved' THEN
        notification_message := 'Your response has been approved';
    ELSIF NEW.status = 'rejected' THEN
        notification_message := 'Your response has been rejected. You may edit your response if you wish';
    ELSE
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