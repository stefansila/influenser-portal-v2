-- Migration to add get_table_columns function
-- This function retrieves column information for debugging purposes

-- Function to get table columns
CREATE OR REPLACE FUNCTION get_table_columns(table_name text)
RETURNS TABLE (
  column_name text,
  data_type text,
  is_nullable boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cols.column_name::text,
    cols.data_type::text,
    (cols.is_nullable = 'YES')::boolean
  FROM 
    information_schema.columns cols
  WHERE 
    cols.table_name = table_name
    AND cols.table_schema = 'public'
  ORDER BY 
    cols.ordinal_position;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_table_columns(text) TO authenticated; 