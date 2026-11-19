-- Make sure every ticket code is unique, so a QR code can only ever be checked in once.
-- Run in the Supabase SQL editor. Safe to run more than once.

-- STEP 1: look for duplicate codes first. This should return NO rows.
select code, count(*) as copies
from public.tickets
group by code
having count(*) > 1;

-- STEP 2: if step 1 returned nothing, add the guarantee.
-- (If step 1 returned rows, do not run this: the index would fail. Send me the rows and we fix them first.)
create unique index if not exists tickets_code_unique on public.tickets (code);
