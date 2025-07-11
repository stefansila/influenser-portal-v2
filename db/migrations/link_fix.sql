-- Fix notification links in trigger functions

-- Update notify_admin_on_response function to use correct links
CREATE OR REPLACE FUNCTION notify_admin_on_response()
RETURNS TRIGGER AS $$
BEGIN
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

-- Update notify_users_on_proposal function to use correct links
CREATE OR REPLACE FUNCTION notify_users_on_proposal()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert notification for all users when an admin creates or updates a proposal
    IF TG_OP = 'INSERT' THEN
        INSERT INTO notifications (recipient_id, title, message, type, link_url, related_proposal_id)
        SELECT 
            id,
            'New Proposal Published',
            'A new proposal has been published: ' || NEW.title,
            'info',
            '/dashboard/proposal/' || NEW.id,
            NEW.id
        FROM users
        WHERE role = 'user';
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO notifications (recipient_id, title, message, type, link_url, related_proposal_id)
        SELECT 
            id,
            'Proposal Updated',
            'A proposal has been updated: ' || NEW.title,
            'info',
            '/dashboard/proposal/' || NEW.id,
            NEW.id
        FROM users
        WHERE role = 'user';
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Update notify_user_on_admin_response function to use correct links
CREATE OR REPLACE FUNCTION notify_user_on_admin_response()
RETURNS TRIGGER AS $$
DECLARE
    response_record RECORD;
BEGIN
    -- Get the relevant response
    SELECT * INTO response_record
    FROM responses
    WHERE id = NEW.response_id;
    
    -- Insert notification for the user
    INSERT INTO notifications (
        recipient_id, 
        title, 
        message, 
        type, 
        link_url, 
        related_proposal_id, 
        related_response_id
    )
    VALUES (
        response_record.user_id,
        'Admin responded to your reply',
        'An admin has reviewed your response to a proposal',
        'popup',
        '/dashboard/view-response?id=' || response_record.id,
        response_record.proposal_id,
        response_record.id
    );
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Optional: Update existing notification records in the database
UPDATE notifications
SET link_url = '/dashboard/proposal/' || related_proposal_id
WHERE related_proposal_id IS NOT NULL
AND link_url LIKE '/dashboard/proposals/%';

UPDATE notifications
SET link_url = '/dashboard/view-response?id=' || related_response_id
WHERE related_response_id IS NOT NULL
AND related_proposal_id IS NOT NULL
AND link_url LIKE '/dashboard/proposals/%'; 