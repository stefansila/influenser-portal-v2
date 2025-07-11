-- Update the notify_users_on_proposal function to handle updates properly
-- and prevent sending update notifications when user's access is removed
DROP FUNCTION IF EXISTS notify_users_on_proposal CASCADE;

CREATE OR REPLACE FUNCTION notify_users_on_proposal()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert notification only for users that have access to this proposal
    IF TG_OP = 'INSERT' THEN
        INSERT INTO notifications (recipient_id, title, message, type, link_url, related_proposal_id)
        SELECT 
            pv.user_id,
            'New Proposal Published',
            'A new proposal has been published: ' || NEW.title,
            'info',
            '/dashboard/proposal/' || NEW.id,
            NEW.id
        FROM proposal_visibility pv
        WHERE pv.proposal_id = NEW.id;
    ELSIF TG_OP = 'UPDATE' THEN
        -- For updates, we need to ensure we only notify users who still have access
        -- and avoid notifying users who are losing access in this update
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
        -- Note: The above query already handles this correctly because it only 
        -- notifies users who are in the proposal_visibility table, which means
        -- they still have access post-update
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create or recreate the trigger
DROP TRIGGER IF EXISTS proposal_notification_trigger ON proposals;

CREATE TRIGGER proposal_notification_trigger
AFTER INSERT OR UPDATE ON proposals
FOR EACH ROW EXECUTE PROCEDURE notify_users_on_proposal(); 