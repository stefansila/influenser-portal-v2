-- Smart proposal notifications v2 - prevent duplicate notifications
-- This version handles the case where proposal creation and visibility grants happen simultaneously

-- First, let's create a function to detect if user-visible fields have changed
CREATE OR REPLACE FUNCTION proposal_user_visible_fields_changed(OLD proposals, NEW proposals)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if any user-visible fields have changed
    RETURN (
        OLD.title IS DISTINCT FROM NEW.title OR
        OLD.company_name IS DISTINCT FROM NEW.company_name OR
        OLD.campaign_start_date IS DISTINCT FROM NEW.campaign_start_date OR
        OLD.campaign_end_date IS DISTINCT FROM NEW.campaign_end_date OR
        OLD.short_description IS DISTINCT FROM NEW.short_description OR
        OLD.content IS DISTINCT FROM NEW.content OR
        OLD.logo_url IS DISTINCT FROM NEW.logo_url
    );
END;
$$ language 'plpgsql';

-- Update the main proposal notification function
-- This will NOT send notifications on INSERT to avoid duplicates with visibility grants
DROP FUNCTION IF EXISTS notify_users_on_proposal CASCADE;

CREATE OR REPLACE FUNCTION notify_users_on_proposal()
RETURNS TRIGGER AS $$
BEGIN
    -- For INSERT, do NOT create notifications here
    -- Notifications will be handled by the proposal_visibility INSERT trigger
    -- This prevents duplicate notifications when a proposal is created and users are granted access
    
    -- For UPDATE, only notify if user-visible fields have changed
    IF TG_OP = 'UPDATE' THEN
        -- Only proceed if user-visible fields have changed
        IF proposal_user_visible_fields_changed(OLD, NEW) THEN
            -- Delete existing "Proposal Updated" notifications to prevent duplicates
            DELETE FROM notifications 
            WHERE related_proposal_id = NEW.id 
            AND title = 'Proposal Updated'
            AND is_read = false;
            
            -- Insert new notifications only for users who still have access
            INSERT INTO notifications (recipient_id, title, message, type, link_url, related_proposal_id)
            SELECT 
                pv.user_id,
                'Proposal Updated',
                'A proposal has been updated: ' || NEW.title,
                'info',
                '/dashboard/proposal/' || NEW.id,
                NEW.id
            FROM proposal_visibility pv
            WHERE pv.proposal_id = NEW.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Recreate the trigger for proposals (only handles UPDATEs now)
DROP TRIGGER IF EXISTS proposal_notification_trigger ON proposals;

CREATE TRIGGER proposal_notification_trigger
AFTER UPDATE ON proposals
FOR EACH ROW EXECUTE PROCEDURE notify_users_on_proposal();

-- Create a function to handle proposal_visibility changes
-- This will notify newly added users and handle new proposal notifications
CREATE OR REPLACE FUNCTION notify_user_on_proposal_access_granted()
RETURNS TRIGGER AS $$
DECLARE
    proposal_record RECORD;
    existing_notification_count INTEGER;
BEGIN
    -- Only handle INSERT operations (when access is granted)
    IF TG_OP = 'INSERT' THEN
        -- Get the proposal details
        SELECT * INTO proposal_record
        FROM proposals
        WHERE id = NEW.proposal_id;
        
        -- Check if this user already has a "New Proposal Available" notification for this proposal
        -- This prevents duplicate notifications
        SELECT COUNT(*) INTO existing_notification_count
        FROM notifications
        WHERE recipient_id = NEW.user_id
        AND related_proposal_id = NEW.proposal_id
        AND title = 'New Proposal Available'
        AND is_read = false;
        
        -- Only create notification if one doesn't already exist
        IF existing_notification_count = 0 THEN
            INSERT INTO notifications (
                recipient_id, 
                title, 
                message, 
                type, 
                link_url, 
                related_proposal_id
            )
            VALUES (
                NEW.user_id,
                'New Proposal Available',
                'A new proposal has been made available to you: ' || proposal_record.title,
                'info',
                '/dashboard/proposal/' || NEW.proposal_id,
                NEW.proposal_id
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for proposal_visibility INSERT
DROP TRIGGER IF EXISTS proposal_access_granted_notification_trigger ON proposal_visibility;

CREATE TRIGGER proposal_access_granted_notification_trigger
AFTER INSERT ON proposal_visibility
FOR EACH ROW EXECUTE PROCEDURE notify_user_on_proposal_access_granted();

-- Update the existing access revoked function to only clean up notifications
DROP FUNCTION IF EXISTS notify_user_on_proposal_access_revoked CASCADE;

CREATE OR REPLACE FUNCTION notify_user_on_proposal_access_revoked()
RETURNS TRIGGER AS $$
BEGIN
    -- Only delete existing notifications when access is revoked
    DELETE FROM notifications
    WHERE recipient_id = OLD.user_id
    AND related_proposal_id = OLD.proposal_id;
    
    RETURN OLD;
END;
$$ language 'plpgsql';

-- Ensure the access revoked trigger exists
DROP TRIGGER IF EXISTS proposal_access_revoked_notification_trigger ON proposal_visibility;

CREATE TRIGGER proposal_access_revoked_notification_trigger
AFTER DELETE ON proposal_visibility
FOR EACH ROW EXECUTE PROCEDURE notify_user_on_proposal_access_revoked();

-- Clean up any existing duplicate notifications
DELETE FROM notifications n1
WHERE EXISTS (
    SELECT 1 FROM notifications n2
    WHERE n2.recipient_id = n1.recipient_id
    AND n2.related_proposal_id = n1.related_proposal_id
    AND n2.title = n1.title
    AND n2.title = 'New Proposal Available'
    AND n2.id > n1.id
    AND n2.is_read = false
    AND n1.is_read = false
);

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Smart proposal notifications v2 migration completed successfully';
    RAISE NOTICE 'Key improvements:';
    RAISE NOTICE '1. Users only receive notifications for meaningful proposal updates';
    RAISE NOTICE '2. Only newly granted users receive "New Proposal Available" notifications';
    RAISE NOTICE '3. Duplicate notifications are prevented';
    RAISE NOTICE '4. Existing duplicate notifications have been cleaned up';
END $$; 