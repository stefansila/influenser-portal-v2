-- Completely remove any access revoked notifications
-- First drop the existing trigger
DROP TRIGGER IF EXISTS proposal_access_revoked_notification_trigger ON proposal_visibility;

-- Then recreate the function with a detailed debug log and only deletion of notifications
CREATE OR REPLACE FUNCTION notify_user_on_proposal_access_revoked()
RETURNS TRIGGER AS $$
BEGIN
    -- Log the deletion for debugging
    RAISE NOTICE 'Removing notifications for user % and proposal %', OLD.user_id, OLD.proposal_id;
    
    -- Delete ALL existing notifications for this user and proposal
    DELETE FROM notifications
    WHERE recipient_id = OLD.user_id
    AND related_proposal_id = OLD.proposal_id;
    
    -- Log completion
    RAISE NOTICE 'Successfully removed notifications without creating new ones';
    
    RETURN OLD;
END;
$$ language 'plpgsql';

-- Recreate the trigger
CREATE TRIGGER proposal_access_revoked_notification_trigger
AFTER DELETE ON proposal_visibility
FOR EACH ROW
EXECUTE PROCEDURE notify_user_on_proposal_access_revoked();

-- Also, clean up any existing "Access Revoked" notifications
DELETE FROM notifications 
WHERE title = 'Access Revoked';

-- Add debug message
DO $$
BEGIN
    RAISE NOTICE 'Migration completed: Access revoked notifications completely removed';
END $$; 