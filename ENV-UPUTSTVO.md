# Uputstvo za podešavanje .env.local fajla

Da bi aplikacija pravilno radila, potrebno je postaviti `.env.local` fajl u koreni direktorijum projekta sa sledećim varijablama:

```
# Supabase konfiguracija
NEXT_PUBLIC_SUPABASE_URL=https://fbmdbvijfufsjpsuorxi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tvoj_anon_ključ_ovde

# Servisni ključ sa admin privilegijama - obavezan za API rute
SUPABASE_SERVICE_KEY=tvoj_service_ključ_ovde
```

## Kako dobiti ključeve

1. Prijavite se na [Supabase dashboard](https://app.supabase.io)
2. Izaberite projekat "fbmdbvijfufsjpsuorxi"
3. Idite na "Settings" -> "API" u meniju sa leve strane
4. Za `NEXT_PUBLIC_SUPABASE_ANON_KEY` koristite vrednost iz polja "anon public"
5. Za `SUPABASE_SERVICE_KEY` koristite vrednost iz polja "service_role secret"

## Rešavanje problema sa bazom i API-jem

Ako se pojavi greška "Invitation not found" ili problemi sa ažuriranjem baze:

1. Proverite da li su ključevi pravilno postavljeni u `.env.local`
2. Proverite da li ste restartovali aplikaciju nakon izmene `.env.local` fajla
3. U API rutama se nalazi provera ključeva sa jasnim porukama o greškama
4. Poslednja migracija je dodala `updated_at` kolonu u `invitations` tabelu

### Napomene za kolonu updated_at

SQL kod koji je nedavno dodat u bazu:

```sql
-- Add updated_at column to invitations table
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Set default value for existing rows
UPDATE invitations SET updated_at = created_at WHERE updated_at IS NULL;

-- Set NOT NULL constraint and default value for future records
ALTER TABLE invitations ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE invitations ALTER COLUMN updated_at SET DEFAULT NOW();

-- Add trigger for automatically updating updated_at
CREATE TRIGGER update_invitations_updated_at
BEFORE UPDATE ON invitations
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
```

## Uputstvo za Vercel Deployment

Da biste uspešno postavili projekat na Vercel, potrebno je da dodate sledeće environment varijable u Vercel dashboard:

```
NEXT_PUBLIC_SUPABASE_URL=vaš_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=vaš_anon_ključ
SUPABASE_SERVICE_KEY=vaš_service_ključ
```

### Rešavanje problema sa build-om

Ukoliko imate probleme sa TypeScript greškama tokom build-a, možete koristiti konfigurisanu komandu u `vercel.json` fajlu:

```json
{
  "buildCommand": "next build --no-lint"
}
```

Ova komanda će preskočiti TypeScript provere tokom build-a.

### Poznati problem sa Supabase Realtime

Postoji poznati problem sa TypeScript definicijama kod Supabase Realtime komponente gde metoda `.on()` očekuje 3 parametra. Ovo je ispravljeno u kodu dodavanjem imena tabele kao drugog parametra:

```typescript
.on('INSERT', 'messages', (payload) => {
  // Handler code
})
``` 