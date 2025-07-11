-- Fix to prevent duplicate notifications when updating proposals and responses

-- 1. Update the function for handling proposal notifications to prevent duplicates
DROP FUNCTION IF EXISTS notify_users_on_proposal CASCADE;

CREATE OR REPLACE FUNCTION notify_users_on_proposal()
RETURNS TRIGGER AS $$
BEGIN
    -- For INSERT, just create notifications normally
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
    -- For UPDATE, first delete any existing "Proposal Updated" notifications for this proposal
    -- before creating new ones to prevent duplicates
    ELSIF TG_OP = 'UPDATE' THEN
        -- Delete existing "Proposal Updated" notifications to prevent duplicates
        DELETE FROM notifications 
        WHERE related_proposal_id = NEW.id 
        AND title = 'Proposal Updated'
        AND is_read = false;
        
        -- Then insert new notifications
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

-- Recreate the trigger
DROP TRIGGER IF EXISTS proposal_notification_trigger ON proposals;

CREATE TRIGGER proposal_notification_trigger
AFTER INSERT OR UPDATE ON proposals
FOR EACH ROW EXECUTE PROCEDURE notify_users_on_proposal();

-- 2. Update the function for handling admin responses to prevent duplicates
DROP FUNCTION IF EXISTS notify_user_on_admin_response CASCADE;

CREATE OR REPLACE FUNCTION notify_user_on_admin_response()
RETURNS TRIGGER AS $$
DECLARE
    response_record RECORD;
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
        'An admin has reviewed your response to a proposal',
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

-- 3. Update the function for notifying admins about user responses to prevent duplicates
DROP FUNCTION IF EXISTS notify_admin_on_response CASCADE;

CREATE OR REPLACE FUNCTION notify_admin_on_response()
RETURNS TRIGGER AS $$
BEGIN
    -- For UPDATE, first delete any existing unread notifications for this response update
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