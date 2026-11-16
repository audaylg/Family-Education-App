# E2E test report (2026-11-16T13:27:48.635Z)
Base: http://localhost:3000

| Result | Test | Note |
|---|---|---|
| PASS | env NEXT_PUBLIC_SUPABASE_URL is set |  |
| PASS | env NEXT_PUBLIC_SUPABASE_ANON_KEY is set |  |
| PASS | env SUPABASE_SERVICE_ROLE_KEY is set |  |
| PASS | parent 1 registration via /api/register | HTTP 200 |
| PASS | parent 2 registration |  |
| PASS | invalid registration rejected | HTTP 400 |
| PASS | parents can sign in |  |
| PASS | parent creates child and gets invite code |  |
| PASS | parent cannot create child in another family |  |
| PASS | student registration with invite code | HTTP 200 |
| PASS | invite code cannot be reused | HTTP 400 |
| PASS | wrong invite code rejected | HTTP 400 |
| PASS | student can sign in |  |
| PASS | student sees only own homework |  |
| PASS | student sees only own student row |  |
| PASS | student can mark own homework done |  |
| PASS | student cannot add points |  |
| PASS | student cannot edit own points |  |
| PASS | student cannot delete own record |  |
| PASS | student cannot read answer keys |  |
| PASS | other family cannot see this family data |  |
| PASS | parent adds points and balance updates (trigger) | balance=50 |
| PASS | anonymous user cannot read students |  |
| PASS | parent-side deletion of student + account (service role) |  |
