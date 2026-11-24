---
title: Let Postgres RLS be your authorization layer
summary: An API in front of Supabase forwards the caller's JWT, so row-level security decides — not hand-written checks.
tags: [supabase, postgres, fastapi, security]
date: 2026-11-24
---

# Let Postgres RLS be your authorization layer

## Problem
An API sitting in front of Supabase tends to use the service (secret) key everywhere, then re-implements "can this user edit this row?" in Python. One forgotten check = a data leak.

## Why
The secret key **bypasses RLS**. Every endpoint then carries its own authorization logic, which is easy to get wrong and hard to review.

## Fix
- Verify the user's JWT in the API (locally, via the project's JWKS — no network round-trip).
- Forward **the caller's token** on data calls, so Postgres evaluates RLS as that user.
- Keep the secret key for a short, explicit list of admin operations, behind a visible flag.

```python
async def list_my_items(user = Depends(get_current_user)):
    # RLS: "owner_id = auth.uid()" decides what comes back
    return await sb.select("items", token=user.token)

async def delete_account(user = Depends(get_current_user)):
    # One of the few documented admin operations
    await sb.auth_admin_delete(user.id, admin=True)
```

```sql
alter table items enable row level security;
create policy "owners edit their items" on items
  for update using (owner_id = (select auth.uid()));
```

## Check
- `grep -rn "admin=True"` lists every privileged call — review that list, not the whole API.
- Run the security advisors after each migration; every table keeps RLS on.
- Test with two accounts: B must get `404`/empty, never A's rows.
