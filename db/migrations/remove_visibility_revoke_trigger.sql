-- Uklanjanje triggera i funkcije koja kreira "Access Revoked" notifikacije

-- 1. Pronađimo sve triggere na proposal_visibility tabeli
DO $$
DECLARE
    trigger_record RECORD;
BEGIN
    FOR trigger_record IN 
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_table = 'proposal_visibility'
        AND action_timing = 'AFTER'
        AND event_manipulation = 'DELETE'
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || trigger_record.trigger_name || ' ON proposal_visibility;';
        RAISE NOTICE 'Dropped trigger: %', trigger_record.trigger_name;
    END LOOP;
END
$$;

-- 2. Eksplicitno uklanjanje funkcije notify_user_on_visibility_revoke
DROP FUNCTION IF EXISTS notify_user_on_visibility_revoke CASCADE;

-- 3. Očistimo postojeće "Access Revoked" notifikacije
DELETE FROM notifications WHERE title = 'Access Revoked';

-- 4. Kreirajmo novu funkciju koja će biti vezana na DELETE event za proposal_visibility
-- ali neće kreirati nikakve notifikacije, samo će brisati postojeće
CREATE OR REPLACE FUNCTION notify_user_on_visibility_revoke()
RETURNS TRIGGER AS $$
BEGIN
    -- Samo brisanje svih notifikacija vezanih za predlog
    DELETE FROM notifications
    WHERE recipient_id = OLD.user_id
    AND related_proposal_id = OLD.proposal_id;
    
    RETURN OLD;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in notify_user_on_visibility_revoke: %', SQLERRM;
        RETURN OLD;
END;
$$ language 'plpgsql';

-- 5. Kreirajmo novi trigger koji poziva ovu funkciju
CREATE TRIGGER proposal_visibility_delete_trigger
AFTER DELETE ON proposal_visibility
FOR EACH ROW
EXECUTE PROCEDURE notify_user_on_visibility_revoke();

-- 6. Verifikujmo da li još uvek postoje triggeri vezani za brisanje u proposal_visibility
DO $$
DECLARE
    trigger_record RECORD;
BEGIN
    RAISE NOTICE 'Checking remaining triggers:';
    FOR trigger_record IN 
        SELECT trigger_name, event_manipulation 
        FROM information_schema.triggers 
        WHERE event_object_table = 'proposal_visibility'
    LOOP
        RAISE NOTICE 'Trigger: % for %', trigger_record.trigger_name, trigger_record.event_manipulation;
    END LOOP;
END
$$; 