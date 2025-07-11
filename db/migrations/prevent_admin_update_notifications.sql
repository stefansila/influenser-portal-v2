-- Prevent admin notifications when admin updates user response status

-- Update the function to track changes from admin vs user
DROP FUNCTION IF EXISTS notify_admin_on_response CASCADE;

CREATE OR REPLACE FUNCTION notify_admin_on_response()
RETURNS TRIGGER AS $$
DECLARE
    admin_triggered BOOLEAN;
BEGIN
    -- Check if this update was triggered by an admin action
    -- If the status changed to 'pending_update', it was likely an admin action
    admin_triggered := (TG_OP = 'UPDATE' AND NEW.status = 'pending_update' AND OLD.status != 'pending_update');
    
    -- Skip notification if this was an admin-triggered update
    IF admin_triggered THEN
        RETURN NEW;
    END IF;
    
    -- For normal user UPDATE, first delete any existing unread notifications
    -- to prevent duplicates
    IF TG_OP = 'UPDATE' THEN
        DELETE FROM notifications 
        WHERE related_response_id = NEW.id
        AND title = 'Response Updated'
        AND is_read = false;
    END IF;

    -- Insert notification for all admins when a user submits or updates a response
    INSERT INTO notifications (recipient_id, title, message, type, link_url, related_proposal_id, related_response_id)
    SELECT 
        id,
        CASE
            WHEN TG_OP = 'INSERT' THEN 'New Response Submitted'
            WHEN TG_OP = 'UPDATE' THEN 'Response Updated'
        END,
        CASE
            WHEN TG_OP = 'INSERT' THEN 'A user has submitted a new response to a proposal'
            WHEN TG_OP = 'UPDATE' THEN 'A user has updated their response to a proposal'
        END,
        'action',
        '/dashboard/proposal/' || NEW.proposal_id,
        NEW.proposal_id,
        NEW.id
    FROM users
    WHERE role = 'admin';
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Recreate the trigger
DROP TRIGGER IF EXISTS response_notification_trigger ON responses;

CREATE TRIGGER response_notification_trigger
AFTER INSERT OR UPDATE ON responses
FOR EACH ROW EXECUTE PROCEDURE notify_admin_on_response(); 