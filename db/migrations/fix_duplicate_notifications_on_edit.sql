-- Fix duplicate notifications when editing proposal access rights
-- This migration creates the missing handle_proposal_visibility_update function

-- First, disable the automatic triggers that cause duplicates
DROP TRIGGER IF EXISTS proposal_access_granted_notification_trigger ON proposal_visibility;

-- Create the manual function to handle proposal visibility updates
CREATE OR REPLACE FUNCTION handle_proposal_visibility_update(
    p_proposal_id UUID,
    p_old_user_ids UUID[],
    p_new_user_ids UUID[]
)
RETURNS VOID AS $$
DECLARE
    proposal_record RECORD;
    user_id UUID;
    existing_notification_count INTEGER;
BEGIN
    -- Get the proposal details
    SELECT * INTO proposal_record
    FROM proposals
    WHERE id = p_proposal_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Proposal not found: %', p_proposal_id;
    END IF;
    
    -- Remove notifications for users who lost access
    DELETE FROM notifications
    WHERE related_proposal_id = p_proposal_id
    AND recipient_id = ANY(
        SELECT unnest(p_old_user_ids) 
        EXCEPT 
        SELECT unnest(p_new_user_ids)
    );
    
    -- Add notifications for newly added users only
    FOREACH user_id IN ARRAY p_new_user_ids
    LOOP
        -- Check if this user was already in the old list
        IF NOT (user_id = ANY(p_old_user_ids)) THEN
            -- This is a newly added user
            -- Check if they already have a notification for this proposal
            SELECT COUNT(*) INTO existing_notification_count
            FROM notifications
            WHERE recipient_id = user_id
            AND related_proposal_id = p_proposal_id
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
                    user_id,
                    'New Proposal Available',
                    'A new proposal has been made available to you: ' || proposal_record.title,
                    'info',
                    '/dashboard/proposal/' || p_proposal_id,
                    p_proposal_id
                );
            END IF;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Proposal visibility update completed for proposal %', p_proposal_id;
END;
$$ language 'plpgsql';

-- Create the function for handling new proposal notifications
CREATE OR REPLACE FUNCTION handle_new_proposal_notifications(
    p_proposal_id UUID,
    p_user_ids UUID[]
)
RETURNS VOID AS $$
DECLARE
    proposal_record RECORD;
    user_id UUID;
    existing_notification_count INTEGER;
BEGIN
    -- Get the proposal details
    SELECT * INTO proposal_record
    FROM proposals
    WHERE id = p_proposal_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Proposal not found: %', p_proposal_id;
    END IF;
    
    -- Add notifications for all specified users
    FOREACH user_id IN ARRAY p_user_ids
    LOOP
        -- Check if they already have a notification for this proposal
        SELECT COUNT(*) INTO existing_notification_count
        FROM notifications
        WHERE recipient_id = user_id
        AND related_proposal_id = p_proposal_id
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
                user_id,
                'New Proposal Available',
                'A new proposal has been made available to you: ' || proposal_record.title,
                'info',
                '/dashboard/proposal/' || p_proposal_id,
                p_proposal_id
            );
        END IF;
    END LOOP;
    
    RAISE NOTICE 'New proposal notifications created for proposal %', p_proposal_id;
END;
$$ language 'plpgsql';

-- Update the proposal update trigger to only handle content changes, not visibility changes
CREATE OR REPLACE FUNCTION notify_users_on_proposal_content_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Only notify if user-visible fields have changed (not visibility changes)
    IF proposal_user_visible_fields_changed(OLD, NEW) THEN
        -- Delete existing "Proposal Updated" notifications to prevent duplicates
        DELETE FROM notifications 
        WHERE related_proposal_id = NEW.id 
        AND title = 'Proposal Updated'
        AND is_read = false;
        
        -- Insert new notifications only for users who have access
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
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Update the proposal trigger to use the new function
DROP TRIGGER IF EXISTS proposal_notification_trigger ON proposals;

CREATE TRIGGER proposal_notification_trigger
AFTER UPDATE ON proposals
FOR EACH ROW EXECUTE PROCEDURE notify_users_on_proposal_content_update();

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
    RAISE NOTICE 'Duplicate notification fix migration completed successfully';
    RAISE NOTICE 'Key improvements:';
    RAISE NOTICE '1. Created handle_proposal_visibility_update function for manual notification management';
    RAISE NOTICE '2. Created handle_new_proposal_notifications function for new proposals';
    RAISE NOTICE '3. Disabled automatic triggers that caused duplicates';
    RAISE NOTICE '4. Only content changes trigger update notifications';
    RAISE NOTICE '5. Cleaned up existing duplicate notifications';
END $$; 