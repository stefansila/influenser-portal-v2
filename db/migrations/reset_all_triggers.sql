-- Potpuno čišćenje svih trigera i funkcija vezanih za notifikacije
-- i postavka novih koji nikada ne šalju "Access Revoked" notifikacije

-- 1. Uklanjanje svih trigera vezanih za notifikacije
DROP TRIGGER IF EXISTS proposal_access_revoked_notification_trigger ON proposal_visibility;
DROP TRIGGER IF EXISTS proposal_notification_trigger ON proposals;
DROP TRIGGER IF EXISTS response_notification_trigger ON responses;
DROP TRIGGER IF EXISTS admin_response_notification_trigger ON admin_responses;

-- 2. Uklanjanje svih funkcija za notifikacije
DROP FUNCTION IF EXISTS notify_user_on_proposal_access_revoked CASCADE;
DROP FUNCTION IF EXISTS notify_users_on_proposal CASCADE;
DROP FUNCTION IF EXISTS notify_admin_on_response CASCADE;
DROP FUNCTION IF EXISTS notify_user_on_admin_response CASCADE;

-- 3. Brisanje svih postojećih "Access Revoked" notifikacija
DELETE FROM notifications WHERE title = 'Access Revoked';

-- 4. Kreiranje nove funkcije za brisanje notifikacija bez kreiranja "Access Revoked"
CREATE OR REPLACE FUNCTION notify_user_on_proposal_access_revoked()
RETURNS TRIGGER AS $$
BEGIN
    -- Samo brisanje svih notifikacija vezanih za predlog
    DELETE FROM notifications
    WHERE recipient_id = OLD.user_id
    AND related_proposal_id = OLD.proposal_id;
    
    RETURN OLD;
END;
$$ language 'plpgsql';

-- 5. Kreiranje osveženog trigera koji se izvršava kada se ukine pristup predlogu
CREATE TRIGGER proposal_access_revoked_notification_trigger
AFTER DELETE ON proposal_visibility
FOR EACH ROW
EXECUTE PROCEDURE notify_user_on_proposal_access_revoked();

-- 6. Ponovno kreiranje funkcije za notifikacije o ažuriranju predloga
CREATE OR REPLACE FUNCTION notify_users_on_proposal()
RETURNS TRIGGER AS $$
BEGIN
    -- Samo korisnici koji imaju pristup dobijaju notifikacije
    IF TG_OP = 'INSERT' THEN
        INSERT INTO notifications (recipient_id, title, message, type, link_url, related_proposal_id)
        SELECT 
            pv.user_id,
            'New Proposal Published',
            'A new proposal has been published: ' || NEW.title,
            'info',
            '/dashboard/proposal/' || NEW.id,
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
            '/dashboard/proposal/' || NEW.id,
            NEW.id
        FROM proposal_visibility pv
        WHERE pv.proposal_id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 7. Kreiranje trigera za predloge
CREATE TRIGGER proposal_notification_trigger
AFTER INSERT OR UPDATE ON proposals
FOR EACH ROW EXECUTE PROCEDURE notify_users_on_proposal();

-- 8. Kreiranje funkcije za notifikacije administratorima o odgovorima
CREATE OR REPLACE FUNCTION notify_admin_on_response()
RETURNS TRIGGER AS $$
BEGIN
    -- Notifikacija za sve administratore
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
        '/dashboard/proposal/' || NEW.proposal_id,
        NEW.proposal_id,
        NEW.id
    FROM users
    WHERE role = 'admin';
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 9. Kreiranje trigera za odgovore
CREATE TRIGGER response_notification_trigger
AFTER INSERT OR UPDATE ON responses
FOR EACH ROW EXECUTE PROCEDURE notify_admin_on_response();

-- 10. Kreiranje funkcije za notifikacije korisnicima o administratorskom odgovoru
CREATE OR REPLACE FUNCTION notify_user_on_admin_response()
RETURNS TRIGGER AS $$
DECLARE
    response_record RECORD;
BEGIN
    -- Dohvatanje odgovora
    SELECT * INTO response_record
    FROM responses
    WHERE id = NEW.response_id;
    
    -- Slanje notifikacije korisniku samo ako i dalje ima pristup predlogu
    INSERT INTO notifications (
        recipient_id, 
        title, 
        message, 
        type, 
        link_url, 
        related_proposal_id, 
        related_response_id
    )
    SELECT
        response_record.user_id,
        'Admin responded to your reply',
        'An admin has reviewed your response to a proposal',
        'popup',
        '/dashboard/view-response?id=' || response_record.id,
        response_record.proposal_id,
        response_record.id
    FROM proposal_visibility pv
    WHERE pv.proposal_id = response_record.proposal_id
    AND pv.user_id = response_record.user_id;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 11. Kreiranje trigera za administratorske odgovore
CREATE TRIGGER admin_response_notification_trigger
AFTER INSERT OR UPDATE ON admin_responses
FOR EACH ROW EXECUTE PROCEDURE notify_user_on_admin_response();

-- 12. Izvršavanje debugovanja
DO $$
BEGIN
    RAISE NOTICE 'Svi trigeri i funkcije za notifikacije su resetovani.';
    RAISE NOTICE 'Access Revoked notifikacije su potpuno uklonjene.';
END $$; 