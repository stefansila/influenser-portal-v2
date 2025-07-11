-- COMPLETE CHAT SYSTEM REBUILD
-- This script will rebuild the chat system to ensure each user has their own chat with the admin

-- 1. Create backup tables
CREATE TABLE IF NOT EXISTS chats_backup AS SELECT * FROM chats;
CREATE TABLE IF NOT EXISTS chat_messages_backup AS SELECT * FROM chat_messages;

-- 2. Identify admin users (creators of proposals)
CREATE TEMPORARY TABLE admin_users AS
SELECT DISTINCT created_by AS user_id FROM proposals;

-- 3. Get a list of all proposal participants (non-admin users who responded to proposals)
CREATE TEMPORARY TABLE proposal_participants AS
SELECT DISTINCT r.proposal_id, r.user_id
FROM responses r
WHERE r.user_id NOT IN (SELECT user_id FROM admin_users);

-- 4. Drop existing chat-related objects
DROP TRIGGER IF EXISTS create_chat_after_response ON responses;
DROP FUNCTION IF EXISTS create_chat_on_response();

DROP POLICY IF EXISTS "Users can view messages in their chats" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert messages into their chats" ON chat_messages;
DROP POLICY IF EXISTS "Users can view their own chats" ON chats;

-- 5. Delete all chats and messages (they're backed up)
DELETE FROM chat_messages;
DELETE FROM chats;

-- 6. Now create individual chats for each user-proposal pair
INSERT INTO chats (id, proposal_id, user_id, created_at)
SELECT 
    uuid_generate_v4(), 
    pp.proposal_id, 
    pp.user_id, 
    NOW()
FROM proposal_participants pp;

-- 7. For each original chat message, create a new message in the appropriate chat
-- First, identify all non-admin message senders
CREATE TEMPORARY TABLE chat_participants AS
SELECT DISTINCT 
    cm.chat_id, 
    c.proposal_id,
    cm.user_id
FROM chat_messages_backup cm
JOIN chats_backup c ON c.id = cm.chat_id
WHERE cm.user_id NOT IN (SELECT user_id FROM admin_users);

-- Create a mapping between old chats and new chats
CREATE TEMPORARY TABLE chat_mapping AS
SELECT 
    cp.chat_id AS old_chat_id,
    cp.proposal_id,
    cp.user_id AS participant_id,
    nc.id AS new_chat_id
FROM chat_participants cp
JOIN chats nc ON nc.proposal_id = cp.proposal_id AND nc.user_id = cp.user_id;

-- Now copy messages to the right chats
DO $$
DECLARE
    admin_users_array UUID[];
    r RECORD;
BEGIN
    -- Get array of admin user IDs
    SELECT ARRAY(SELECT user_id FROM admin_users) INTO admin_users_array;
    
    -- For each original message
    FOR r IN 
        SELECT * FROM chat_messages_backup
    LOOP
        -- If it's from an admin
        IF r.user_id = ANY(admin_users_array) THEN
            -- Copy to each user's chat for this proposal
            INSERT INTO chat_messages (id, chat_id, user_id, message, created_at, is_read)
            SELECT 
                uuid_generate_v4(),
                cm.new_chat_id,
                r.user_id,
                r.message,
                r.created_at,
                r.is_read
            FROM chat_mapping cm
            WHERE cm.old_chat_id = r.chat_id;
        ELSE
            -- It's from a regular user, so copy only to their chat
            INSERT INTO chat_messages (id, chat_id, user_id, message, created_at, is_read)
            SELECT 
                uuid_generate_v4(),
                cm.new_chat_id,
                r.user_id,
                r.message,
                r.created_at,
                r.is_read
            FROM chat_mapping cm
            WHERE cm.old_chat_id = r.chat_id AND cm.participant_id = r.user_id;
        END IF;
    END LOOP;
END $$;

-- 8. Add/ensure constraints
ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_proposal_user_unique;
ALTER TABLE chats ADD CONSTRAINT chats_proposal_user_unique UNIQUE(proposal_id, user_id);

-- 9. Create index for better performance
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_proposal_id ON chats(proposal_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_is_read ON chat_messages(is_read);

-- 10. Recreate RLS policies
CREATE POLICY "Users can view their own chats" ON chats
FOR SELECT
USING (
    user_id = auth.uid() OR
    proposal_id IN (
        SELECT id FROM proposals WHERE created_by = auth.uid()
    )
);

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

-- 11. Recreate trigger function to create chats when new responses are submitted
CREATE OR REPLACE FUNCTION create_chat_on_response()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if the user creating the response is not an admin for this proposal
    IF NEW.user_id != (SELECT created_by FROM proposals WHERE id = NEW.proposal_id) THEN
        -- Create a new chat for this specific user and proposal
        INSERT INTO chats (proposal_id, user_id)
        VALUES (NEW.proposal_id, NEW.user_id)
        ON CONFLICT (proposal_id, user_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 12. Recreate trigger
CREATE TRIGGER create_chat_after_response
AFTER INSERT ON responses
FOR EACH ROW
EXECUTE PROCEDURE create_chat_on_response();

-- 13. Drop temporary tables
DROP TABLE admin_users;
DROP TABLE proposal_participants;
DROP TABLE chat_participants;
DROP TABLE chat_mapping; 