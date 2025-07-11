-- Create a function that allows admins to complete offers
-- This function runs with elevated privileges and bypasses RLS
CREATE OR REPLACE FUNCTION complete_offer(
  response_id UUID,
  admin_response_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER -- This allows the function to run with elevated privileges
AS $$
DECLARE
  current_user_role TEXT;
  result JSON;
BEGIN
  -- Check if the current user is an admin
  SELECT role INTO current_user_role 
  FROM users 
  WHERE id = auth.uid();
  
  IF current_user_role != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;
  
  -- Update the response progress_status to completed
  UPDATE responses 
  SET 
    progress_status = 'completed',
    campaign_completed_at = NOW()
  WHERE id = response_id;
  
  -- Update admin_response status if provided
  IF admin_response_id IS NOT NULL THEN
    UPDATE admin_responses 
    SET status = 'completed'
    WHERE id = admin_response_id;
  END IF;
  
  -- Return success result
  result := json_build_object(
    'success', true,
    'message', 'Offer completed successfully',
    'response_id', response_id,
    'admin_response_id', admin_response_id
  );
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    -- Return error result
    result := json_build_object(
      'success', false,
      'error', SQLERRM,
      'response_id', response_id
    );
    RETURN result;
END;
$$;

-- Grant execute permission to authenticated users (the function itself checks for admin role)
GRANT EXECUTE ON FUNCTION complete_offer(UUID, UUID) TO authenticated; 