-- Step 1: Identify the current state
WITH CurrentState AS (
  SELECT cm.chat_id, c.proposal_id, array_agg(DISTINCT cm.user_id) AS user_ids
  FROM chat_messages cm
  JOIN chats c ON c.id = cm.chat_id
  GROUP BY cm.chat_id, c.proposal_id
  HAVING count(DISTINCT cm.user_id) > 1
)
SELECT * FROM CurrentState;

-- Step 2: Create backup of existing messages
CREATE TABLE IF NOT EXISTS chat_messages_backup AS 
SELECT * FROM chat_messages;

-- Step 3: Create new chats for each user-proposal pair where needed
DO $$
DECLARE
  shared_chat record;
  user_id_val uuid;
  new_chat_id uuid;
BEGIN
  -- For each shared chat (a chat with messages from multiple users)
  FOR shared_chat IN 
    SELECT cm.chat_id, c.proposal_id, array_agg(DISTINCT cm.user_id) AS user_ids
    FROM chat_messages cm
    JOIN chats c ON c.id = cm.chat_id
    GROUP BY cm.chat_id, c.proposal_id
    HAVING count(DISTINCT cm.user_id) > 1
  LOOP
    RAISE NOTICE 'Processing shared chat: %', shared_chat.chat_id;
    
    -- For each user in this chat
    FOREACH user_id_val IN ARRAY shared_chat.user_ids
    LOOP
      -- Skip admin users (check if they created the proposal)
      IF EXISTS (
        SELECT 1 FROM proposals 
        WHERE id = shared_chat.proposal_id AND created_by = user_id_val
      ) THEN
        RAISE NOTICE 'Skipping admin user: %', user_id_val;
        CONTINUE;
      END IF;
      
      -- Check if this user already has their own chat for this proposal
      IF NOT EXISTS (
        SELECT 1 FROM chats 
        WHERE proposal_id = shared_chat.proposal_id AND user_id = user_id_val
      ) THEN
        -- Create a new chat for this user
        new_chat_id := uuid_generate_v4();
        
        RAISE NOTICE 'Creating new chat for user % and proposal %', user_id_val, shared_chat.proposal_id;
        
        INSERT INTO chats (id, proposal_id, user_id, created_at)
        VALUES (
          new_chat_id, 
          shared_chat.proposal_id, 
          user_id_val,
          NOW()
        );
        
        -- Copy messages for this user to their new chat
        INSERT INTO chat_messages (
          id, chat_id, user_id, message, created_at, is_read
        )
        SELECT 
          uuid_generate_v4(), 
          new_chat_id, 
          cm.user_id, 
          cm.message, 
          cm.created_at, 
          cm.is_read
        FROM chat_messages cm
        WHERE 
          cm.chat_id = shared_chat.chat_id 
          AND (
            cm.user_id = user_id_val 
            OR cm.user_id IN (
              SELECT created_by FROM proposals WHERE id = shared_chat.proposal_id
            )
          );
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Step 4: Add the constraint to ensure this doesn't happen again
ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_proposal_user_unique;
ALTER TABLE chats ADD CONSTRAINT chats_proposal_user_unique UNIQUE(proposal_id, user_id);

-- Step 5: Update RLS policies to ensure users can only see their own chats
DROP POLICY IF EXISTS "Users can view their own chats" ON chats;
CREATE POLICY "Users can view their own chats" ON chats
FOR SELECT
USING (
    user_id = auth.uid() OR
    proposal_id IN (
        SELECT id FROM proposals WHERE created_by = auth.uid()
    )
);

-- Update chat messages policies
DROP POLICY IF EXISTS "Users can insert messages into their chats" ON chat_messages;
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

DROP POLICY IF EXISTS "Users can view messages in their chats" ON chat_messages;
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

-- Update trigger function to handle unique constraint
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

-- Step 6: Update the trigger
DROP TRIGGER IF EXISTS create_chat_after_response ON responses;
CREATE TRIGGER create_chat_after_response
AFTER INSERT ON responses
FOR EACH ROW
EXECUTE PROCEDURE create_chat_on_response(); 