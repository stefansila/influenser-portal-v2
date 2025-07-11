-- Create a function that handles access revocation by only removing existing notifications
CREATE OR REPLACE FUNCTION notify_user_on_proposal_access_revoked()
RETURNS TRIGGER AS $$
BEGIN
    -- Delete any existing notifications for this user and proposal
    -- They shouldn't see notifications for proposals they can't access
    DELETE FROM notifications
    WHERE recipient_id = OLD.user_id
    AND related_proposal_id = OLD.proposal_id;
    
    RETURN OLD;
END;
$$ language 'plpgsql';

-- Create a trigger to execute the function when a record is deleted from proposal_visibility
DROP TRIGGER IF EXISTS proposal_access_revoked_notification_trigger ON proposal_visibility;

CREATE TRIGGER proposal_access_revoked_notification_trigger
AFTER DELETE ON proposal_visibility
FOR EACH ROW
EXECUTE PROCEDURE notify_user_on_proposal_access_revoked(); 