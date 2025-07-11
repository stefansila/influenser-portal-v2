-- SQL za pregled svih postojećih trigera na proposal_visibility tabeli
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_orientation,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'proposal_visibility'
ORDER BY trigger_name;

-- SQL za pregled svih funkcija koje manipulišu notifikacijama
SELECT 
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND (p.proname LIKE '%notification%' OR p.proname LIKE '%notify%')
ORDER BY p.proname; 