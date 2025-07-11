-- Create enums for various status types
CREATE TYPE user_role AS ENUM ('admin', 'user');
CREATE TYPE response_status AS ENUM ('accepted', 'rejected');
CREATE TYPE admin_response_status AS ENUM ('approved', 'rejected', 'pending');
CREATE TYPE notification_type AS ENUM ('info', 'action', 'popup');

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'user',
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create proposals table
CREATE TABLE proposals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    logo_url TEXT,
    company_name TEXT NOT NULL,
    campaign_start_date DATE NOT NULL,
    campaign_end_date DATE NOT NULL,
    short_description TEXT NOT NULL,
    content JSONB NOT NULL,
    created_by UUID REFERENCES users(id) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT date_check CHECK (campaign_end_date >= campaign_start_date)
);

-- Create responses table
CREATE TABLE responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proposal_id UUID REFERENCES proposals(id) NOT NULL,
    user_id UUID REFERENCES users(id) NOT NULL,
    status response_status NOT NULL,
    quote TEXT,
    proposed_publish_date DATE,
    platforms TEXT[] NOT NULL,
    video_link TEXT,
    payment_method TEXT NOT NULL,
    uploaded_video_url TEXT,
    message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_proposal UNIQUE (user_id, proposal_id)
);

-- Create admin_responses table
CREATE TABLE admin_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    response_id UUID REFERENCES responses(id) NOT NULL,
    status admin_response_status NOT NULL DEFAULT 'pending',
    message_to_user TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_response UNIQUE (response_id)
);

-- Create notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_id UUID REFERENCES users(id) NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type notification_type NOT NULL,
    link_url TEXT,
    related_proposal_id UUID REFERENCES proposals(id),
    related_response_id UUID REFERENCES responses(id),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_proposals_created_by ON proposals(created_by);
CREATE INDEX idx_responses_proposal_id ON responses(proposal_id);
CREATE INDEX idx_responses_user_id ON responses(user_id);
CREATE INDEX idx_admin_responses_response_id ON admin_responses(response_id);
CREATE INDEX idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);

-- Create function for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatically updating updated_at
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

CREATE TRIGGER update_proposals_updated_at
BEFORE UPDATE ON proposals
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

CREATE TRIGGER update_responses_updated_at
BEFORE UPDATE ON responses
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

CREATE TRIGGER update_admin_responses_updated_at
BEFORE UPDATE ON admin_responses
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- RLS (Row Level Security) Policies

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
CREATE POLICY users_select_policy ON users
    FOR SELECT USING (true);  -- Everyone can see user profiles

CREATE POLICY users_update_own_policy ON users
    FOR UPDATE USING (auth.uid() = id);  -- Users can only update their own profile

-- Create policies for proposals table
CREATE POLICY proposals_select_policy ON proposals
    FOR SELECT USING (true);  -- Everyone can see proposals

CREATE POLICY proposals_insert_admin_policy ON proposals
    FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    ));  -- Only admins can create proposals

CREATE POLICY proposals_update_admin_policy ON proposals
    FOR UPDATE USING (EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    ));  -- Only admins can update proposals

-- Create policies for responses table
CREATE POLICY responses_select_own_policy ON responses
    FOR SELECT USING (
        auth.uid() = user_id OR  -- User can see their own responses
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')  -- Admins can see all responses
    );

CREATE POLICY responses_insert_own_policy ON responses
    FOR INSERT WITH CHECK (auth.uid() = user_id);  -- Users can only create their own responses

CREATE POLICY responses_update_own_policy ON responses
    FOR UPDATE USING (auth.uid() = user_id);  -- Users can only update their own responses

-- Create policies for admin_responses table
CREATE POLICY admin_responses_select_admin_policy ON admin_responses
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    ));  -- Admins can see all admin responses

CREATE POLICY admin_responses_select_own_policy ON admin_responses
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM responses WHERE id = admin_responses.response_id AND user_id = auth.uid()
    ));  -- Users can see admin responses to their own responses

CREATE POLICY admin_responses_insert_admin_policy ON admin_responses
    FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    ));  -- Only admins can create admin responses

CREATE POLICY admin_responses_update_admin_policy ON admin_responses
    FOR UPDATE USING (EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    ));  -- Only admins can update admin responses

-- Create policies for notifications table
CREATE POLICY notifications_select_own_policy ON notifications
    FOR SELECT USING (auth.uid() = recipient_id);  -- Users can only see their own notifications

CREATE POLICY notifications_update_own_policy ON notifications
    FOR UPDATE USING (auth.uid() = recipient_id);  -- Users can only update their own notifications (e.g., mark as read)

-- Create functions for notification triggers
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
        '/dashboard/proposals/' || NEW.proposal_id,
        NEW.proposal_id,
        NEW.id
    FROM users
    WHERE role = 'admin';
    
    RETURN NEW;
END;
$$ language 'plpgsql';

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
            '/dashboard/proposals/' || NEW.id,
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
            '/dashboard/proposals/' || NEW.id,
            NEW.id
        FROM users
        WHERE role = 'user';
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

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
        '/dashboard/proposals/' || response_record.proposal_id,
        response_record.proposal_id,
        response_record.id
    );
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for notifications
CREATE TRIGGER response_notification_trigger
AFTER INSERT OR UPDATE ON responses
FOR EACH ROW EXECUTE PROCEDURE notify_admin_on_response();

CREATE TRIGGER proposal_notification_trigger
AFTER INSERT OR UPDATE ON proposals
FOR EACH ROW EXECUTE PROCEDURE notify_users_on_proposal();

CREATE TRIGGER admin_response_notification_trigger
AFTER INSERT OR UPDATE ON admin_responses
FOR EACH ROW EXECUTE PROCEDURE notify_user_on_admin_response(); 