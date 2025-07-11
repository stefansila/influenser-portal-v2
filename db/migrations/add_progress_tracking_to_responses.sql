-- Add progress tracking fields to responses table

-- First, create the enum for progress status
CREATE TYPE progress_status AS ENUM ('no_response', 'accepted', 'live', 'completed');

-- Add progress_status column to responses table
ALTER TABLE responses 
ADD COLUMN progress_status progress_status DEFAULT 'no_response',
ADD COLUMN admin_approved_at TIMESTAMPTZ,
ADD COLUMN campaign_completed_at TIMESTAMPTZ;

-- Update existing responses to have proper progress_status values
UPDATE responses 
SET progress_status = CASE 
    WHEN status = 'rejected' THEN 'no_response'
    WHEN status = 'accepted' THEN 
        CASE 
            WHEN EXISTS (
                SELECT 1 FROM admin_responses ar 
                WHERE ar.response_id = responses.id 
                AND ar.status = 'approved'
            ) THEN 'live'
            ELSE 'accepted'
        END
    ELSE 'no_response'
END;

-- Set admin_approved_at for responses that have been approved
UPDATE responses 
SET admin_approved_at = (
    SELECT ar.created_at 
    FROM admin_responses ar 
    WHERE ar.response_id = responses.id 
    AND ar.status = 'approved'
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1 FROM admin_responses ar 
    WHERE ar.response_id = responses.id 
    AND ar.status = 'approved'
);

-- Create function to automatically update campaigns to completed when they expire
CREATE OR REPLACE FUNCTION update_completed_campaigns()
RETURNS void AS $$
BEGIN
    UPDATE responses 
    SET progress_status = 'completed',
        campaign_completed_at = NOW()
    WHERE progress_status = 'live'
    AND EXISTS (
        SELECT 1 FROM proposals p 
        WHERE p.id = responses.proposal_id 
        AND p.campaign_end_date < CURRENT_DATE
    )
    AND campaign_completed_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update progress when admin approves
CREATE OR REPLACE FUNCTION update_progress_on_admin_response()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'approved' THEN
        UPDATE responses 
        SET progress_status = 'live',
            admin_approved_at = NOW()
        WHERE id = NEW.response_id;
    ELSIF NEW.status = 'rejected' THEN
        UPDATE responses 
        SET progress_status = 'accepted'
        WHERE id = NEW.response_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for admin responses
DROP TRIGGER IF EXISTS trigger_update_progress_on_admin_response ON admin_responses;
CREATE TRIGGER trigger_update_progress_on_admin_response
    AFTER INSERT OR UPDATE ON admin_responses
    FOR EACH ROW
    EXECUTE FUNCTION update_progress_on_admin_response(); 