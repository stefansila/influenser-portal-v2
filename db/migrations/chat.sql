-- Create chats table
CREATE TABLE chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proposal_id UUID REFERENCES proposals(id) NOT NULL,
    user_id UUID REFERENCES users(id) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(proposal_id, user_id)
);

-- Create chat_messages table
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID REFERENCES chats(id) NOT NULL,
    user_id UUID REFERENCES users(id) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_read BOOLEAN NOT NULL DEFAULT FALSE
);

-- Create indexes for better performance
CREATE INDEX idx_chats_proposal_id ON chats(proposal_id);
CREATE INDEX idx_chats_user_id ON chats(user_id);
CREATE INDEX idx_chat_messages_chat_id ON chat_messages(chat_id);
CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX idx_chat_messages_is_read ON chat_messages(is_read);

-- Enable RLS on the new tables
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Create policy for chats
-- Users can only see their own chats
CREATE POLICY "Users can view their own chats" ON chats
FOR SELECT
USING (
    user_id = auth.uid() OR
    proposal_id IN (
        SELECT id FROM proposals WHERE created_by = auth.uid()
    )
);

-- Create policy for chat messages
-- Users can insert messages into their own chats
CREATE POLICY "Users can insert messages into their chats" ON chat_messages
FOR INSERT
WITH CHECK (
    chat_id IN (
        SELECT id FROM chats 
        WHERE user_id = auth.uid() OR
        proposal_id IN (
            SELECT id FROM proposals WHERE created_by = auth.uid()
        )
    )
);

-- Users can view messages in their own chats
CREATE POLICY "Users can view messages in their chats" ON chat_messages
FOR SELECT
USING (
    chat_id IN (
        SELECT id FROM chats 
        WHERE user_id = auth.uid() OR
        proposal_id IN (
            SELECT id FROM proposals WHERE created_by = auth.uid()
        )
    )
);

-- Trigger function to create chat automatically when a response is created
CREATE OR REPLACE FUNCTION create_chat_on_response()
RETURNS TRIGGER AS $$
BEGIN
    -- Create a new chat for this specific user and proposal
    INSERT INTO chats (proposal_id, user_id)
    VALUES (NEW.proposal_id, NEW.user_id)
    ON CONFLICT (proposal_id, user_id) DO NOTHING;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a trigger to automatically create a chat when a response is submitted
CREATE TRIGGER create_chat_after_response
AFTER INSERT ON responses
FOR EACH ROW
EXECUTE PROCEDURE create_chat_on_response(); 