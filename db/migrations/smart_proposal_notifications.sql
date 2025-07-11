-- Smart proposal notifications - only notify users for meaningful changes
-- 1. Only notify when user-visible fields change (not when admin changes visibility)
-- 2. Only notify newly added users when access is granted

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
DROP FUNCTION IF EXISTS notify_users_on_proposal CASCADE;

CREATE OR REPLACE FUNCTION notify_users_on_proposal()
RETURNS TRIGGER AS $$
BEGIN
    -- For INSERT, create notifications for all users with access
    IF TG_OP = 'INSERT' THEN
        INSERT INTO notifications (recipient_id, title, message, type, link_url, related_proposal_id)
        SELECT 
            pv.user_id,
            'New Proposal Available',
            'A new proposal has been made available to you: ' || NEW.title,
            'info',
            '/dashboard/proposal/' || NEW.id,
            NEW.id
        FROM proposal_visibility pv
        WHERE pv.proposal_id = NEW.id;
    
    -- For UPDATE, only notify if user-visible fields have changed
    ELSIF TG_OP = 'UPDATE' THEN
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

-- Recreate the trigger
DROP TRIGGER IF EXISTS proposal_notification_trigger ON proposals;

CREATE TRIGGER proposal_notification_trigger
AFTER INSERT OR UPDATE ON proposals
FOR EACH ROW EXECUTE PROCEDURE notify_users_on_proposal();

-- Create a function to handle proposal_visibility changes
-- This will notify only newly added users
CREATE OR REPLACE FUNCTION notify_user_on_proposal_access_granted()
RETURNS TRIGGER AS $$
DECLARE
    proposal_record RECORD;
BEGIN
    -- Only handle INSERT operations (when access is granted)
    IF TG_OP = 'INSERT' THEN
        -- Get the proposal details
        SELECT * INTO proposal_record
        FROM proposals
        WHERE id = NEW.proposal_id;
        
        -- Notify the newly added user
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
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for proposal_visibility INSERT
DROP TRIGGER IF EXISTS proposal_access_granted_notification_trigger ON proposal_visibility;

CREATE TRIGGER proposal_access_granted_notification_trigger
AFTER INSERT ON proposal_visibility
FOR EACH ROW EXECUTE PROCEDURE notify_user_on_proposal_access_granted();

-- Update the existing access revoked function to only clean up notifications
-- (keeping the existing function but ensuring it doesn't create new notifications)
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

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Smart proposal notifications migration completed successfully';
    RAISE NOTICE 'Users will now only receive notifications for:';
    RAISE NOTICE '1. Meaningful proposal updates (content, dates, etc.)';
    RAISE NOTICE '2. When they are newly granted access to a proposal';
END $$; 