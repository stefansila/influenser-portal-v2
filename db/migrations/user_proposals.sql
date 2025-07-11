-- Create a junction table to manage proposal visibility per user
CREATE TABLE proposal_visibility (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_proposal_user UNIQUE (proposal_id, user_id)
);

-- Create index for better performance
CREATE INDEX idx_proposal_visibility_proposal_id ON proposal_visibility(proposal_id);
CREATE INDEX idx_proposal_visibility_user_id ON proposal_visibility(user_id);

-- Enable RLS on the table
ALTER TABLE proposal_visibility ENABLE ROW LEVEL SECURITY;

-- Create policies for proposal_visibility table
CREATE POLICY proposal_visibility_select_policy ON proposal_visibility
    FOR SELECT USING (
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY proposal_visibility_insert_admin_policy ON proposal_visibility
    FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    ));

CREATE POLICY proposal_visibility_delete_admin_policy ON proposal_visibility
    FOR DELETE USING (EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    ));

-- Update the proposals RLS policy to check the junction table
DROP POLICY IF EXISTS proposals_select_policy ON proposals;
CREATE POLICY proposals_select_policy ON proposals
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM proposal_visibility
            WHERE proposal_id = proposals.id
            AND user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Modify the notification function to only notify selected users
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
            '/dashboard/proposals/' || NEW.id,
            NEW.id
        FROM proposal_visibility pv
        WHERE pv.proposal_id = NEW.id;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO notifications (recipient_id, title, message, type, link_url, related_proposal_id)
        SELECT 
            pv.user_id,
            'Proposal Updated',
            'A proposal has been updated: ' || NEW.title,
            'info',
            '/dashboard/proposals/' || NEW.id,
            NEW.id
        FROM proposal_visibility pv
        WHERE pv.proposal_id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql'; 