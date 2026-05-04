# Migration Rollback Runbook

> **When to use this:** A migration deployed to staging or prod is causing
> errors and needs to be reversed. **Do not panic-revert** — wrong rollback
> mechanic destroys data. Read this file first.

---

## Decision tree (60-second triage)

```
Symptom: app is broken after a deploy
│
├─ Is the migration syntactically valid? (Did `prisma migrate deploy` succeed?)
│  ├─ NO  → release_command failed, app is on OLD image. Just `flyctl releases rollback`.
│  └─ YES → Migration applied. Continue ↓
│
├─ Is the issue caused by SCHEMA changes that the new code depends on?
│  ├─ YES → Code rollback alone won't help. You need to also undo the schema.
│  │       See "Path A: Schema rollback" below.
│  └─ NO  → It's a code bug, not a migration bug. Just `flyctl releases rollback`.
│
└─ Did the migration DROP or DESTRUCTIVELY ALTER existing data?
   ├─ YES → Data is gone. Only Neon point-in-time-restore can save you.
   │       See "Path B: Neon PITR" below.
   └─ NO  → Schema-only change (added column, new table). You can write a
            forward-fix migration that reverses it. See "Path C: Forward fix".
```

---

## Path A: Schema rollback (the migration ran but is wrong)

Use this when the migration succeeded but the resulting schema is broken
(wrong column type, missing constraint, etc.) AND no destructive change
happened (no DROP, no data loss).

> **DO NOT run `prisma migrate reset`.** It works against any database it
> can connect to, including prod. It's a developer-machine-only command.
> If you need it in your fingers as muscle memory, untrain it.

### A.1 — Code-rollback first (buys you time)

Get prod back on the previous, working app version while you fix the
migration on a branch:

```bash
flyctl releases list --app smart-apply-api
# Find the release ID of the LAST GREEN deploy. Look for v1.x.y in the
# message column and the "succeeded" status.
flyctl releases rollback <release-id> --app smart-apply-api
```

Effect: Fly redeploys the previous Docker image. The new (broken) schema
remains in the DB — but the old code knows nothing about it, so the app
behaves like it did before the broken release.

This works **only if** the migration was additive (added a column or
table). The old code ignores the new schema.

### A.2 — Write a forward-fix migration

```bash
git checkout main && git pull
git checkout -b fix/revert-broken-migration
cd apps/api

# Inspect the broken migration
ls prisma/migrations/<latest_timestamp>_*

# Create a NEW migration that reverses it
npx prisma migrate dev --name revert_<broken_migration_name>
```

Hand-edit the new migration's `migration.sql` to be the inverse of the
broken one. Example:

```sql
-- broken migration: ALTER TABLE "User" ADD COLUMN "preferred_language" VARCHAR(10);
-- forward fix:
ALTER TABLE "User" DROP COLUMN "preferred_language";
```

### A.3 — Verify on staging FIRST

```bash
git push -u origin fix/revert-broken-migration
gh pr create --fill
# Wait for the migration-check CI job (Phase 5) to confirm it applies clean
# Merge → staging redeploys → soak → confirm staging is healthy
```

### A.4 — Cut a hotfix release

Once staging proves the fix works, follow the normal release flow:
release-please opens a Release PR, you merge it, prod tag is created,
approve the deploy. ~15 min from PR open to prod.

---

## Path B: Neon point-in-time-restore (you lost data)

Use this when the migration DROP'd a column, TRUNCATE'd a table, or did
anything else that destroyed user data.

> **Time is critical.** Neon retains PITR for 30 days on the Launch plan,
> 7 days on Free. The clock starts at the moment of data loss. Don't
> spend hours debugging — restore first, debug after.

### B.1 — Estimate the lost-data timestamp

You need a UTC timestamp from BEFORE the bad deploy. Get it from:

```bash
# When did the broken deploy run?
flyctl releases list --app smart-apply-api | head -10
# Look for the release timestamp — restore to ~1 minute BEFORE that.
```

### B.2 — Create a branch from the snapshot

In Neon console:

1. **Branches** → click the parent branch (`main` for prod, `staging` for staging)
2. **Restore** → choose **Point-in-time restore**
3. Set the timestamp to ~1 minute before the bad deploy
4. **Restore as a new branch** — name it `restore-<date>` (e.g. `restore-2026-05-12-1430`)
5. Wait ~10 sec for the branch to provision

Or via CLI:

```bash
neon branches create --project-id <id> \
  --name restore-2026-05-12-1430 \
  --parent main \
  --parent-timestamp 2026-05-12T14:30:00Z
```

### B.3 — Decide: hot-swap or selective restore?

**Hot-swap** (fast, easy, accepts loss of any writes between bad-deploy and now):

1. Get the connection URL of the restore branch
2. Update prod Fly secrets to point at the restore branch:
   ```bash
   fly secrets set --app smart-apply-api \
     DATABASE_URL='<pooled URL of restore branch>' \
     DIRECT_URL='<direct URL of restore branch>'
   ```
3. Fly does a rolling restart — app now reads/writes the restored DB
4. Within 24h, in Neon console: rename the restore branch to `main` and the old `main` to `main-broken-<date>`. Then update Fly secrets back to the (now correct) `main` branch URL.

**Selective restore** (slow, manual, preserves writes since bad-deploy):

1. Connect to BOTH the restore branch and current `main`
2. Manually `INSERT ... SELECT` the missing rows from restore → main
3. Most useful when only one table was affected and writes since are
   important (orders, billing events, etc.)

This is bespoke per incident — no generic recipe.

### B.4 — After the dust settles

- Cleanup old restore branches: `neon branches delete restore-<old-date>` (Neon charges per active branch)
- Write a postmortem in `docs/postmortems/<date>-<title>.md`
- Add a `migration-check` test case that would have caught the bad migration

---

## Path C: Forward fix (additive change you want to undo)

Use this when the migration succeeded but you want to remove the new
schema element (e.g. you added a column that turned out to be unnecessary).

This is the same as Path A.2 — write an inverse migration. Don't bother
with code rollback if the new code doesn't depend on the schema change.

---

## Mistakes that make rollback worse

### "Just run `prisma migrate reset`"

`migrate reset` **drops the entire database** and reapplies all migrations
from scratch. On prod this is catastrophic. It exists for development only.
Treat it the way you treat `rm -rf /`.

### "Edit the migration file in-place to undo it"

Migrations are immutable history. Editing an applied migration:

- Breaks `prisma migrate deploy` on every other environment (the file's
  checksum no longer matches the `_prisma_migrations` table)
- Breaks new clones of the repo
- Breaks rollback ("which version of the migration is in prod?")

**Always write a new migration** that reverses the broken one.

### "Roll back the code without rolling back the schema"

Works only for **additive** changes (new column, new table). For any
schema change the old code depended on, you need both — or the old code
will hit the new schema and crash.

### "Truncate the broken column manually via psql"

Tempting but bypasses migration history. Now the DB schema is in a state
no migration file describes. The next `prisma migrate deploy` may try to
re-add the column you deleted, conflict, and fail. Always go through the
migration system.

### "Restore on prod first, then think about staging"

The opposite of right. **Verify the rollback recipe on staging first**:

1. Reproduce the issue on staging by re-applying the bad migration (if
   it was already there) or running the same broken `prisma migrate deploy`
2. Try your rollback recipe on staging
3. Only when staging works, apply the same recipe to prod

The 5-10 min you spend on staging saves you from a second outage when
the rollback itself goes wrong.

---

## Backwards-compatible migrations: how to avoid this entirely

The best rollback is the one you don't need. Adopt **expand → migrate → contract**:

### The pattern

A schema change that affects existing code happens across **two releases**, never one.

#### Release N (expand — backwards-compatible)

```sql
-- Add the new column. Don't touch the old one.
ALTER TABLE "User" ADD COLUMN "preferred_language_v2" VARCHAR(10);

-- Backfill from the old column.
UPDATE "User" SET "preferred_language_v2" = "preferred_language";
```

```ts
// Code reads from BOTH old and new (prefer new, fall back to old).
const lang = user.preferredLanguageV2 ?? user.preferredLanguage;

// Code writes to BOTH (so both columns stay in sync during the transition).
await prisma.user.update({
  data: {
    preferredLanguage: newValue,
    preferredLanguageV2: newValue,
  },
});
```

Deploy. Old code (still running on some machines briefly during rolling
restart) ignores the new column. New code uses it. Both work.

#### Release N+1 (contract — destructive, but safe now)

After Release N has been live for at least 1 day with no errors:

```sql
-- Stop reading old column (already done in code in this release).
ALTER TABLE "User" DROP COLUMN "preferred_language";
ALTER TABLE "User" RENAME COLUMN "preferred_language_v2" TO "preferred_language";
```

By the time this ships, no code references the old column. Drop is safe.

### When to use it

- Renaming a column
- Splitting one column into multiple (e.g. `name` → `firstName` + `lastName`)
- Changing a column type (NUMERIC → DECIMAL)
- Removing a column that current code uses

### When you can skip it (single-release safe)

- Adding a new nullable column
- Adding a new table
- Adding an index
- Removing a column that nothing reads
- Adding a constraint that current data already satisfies

The diagnostic question: **"If the old code (still on some pod for the
30 sec of rolling restart) hits the new schema, does it work?"** If yes,
single-release is fine. If no, expand/contract.

---

## Tooling we have to catch problems before they ship

| Tool                              | Catches                                              | Where it runs    |
| --------------------------------- | ---------------------------------------------------- | ---------------- |
| `prisma migrate dev` (local)      | Syntax errors, basic conflicts                       | Your laptop      |
| `migration-check` job (`ci.yml`)  | Migration applies clean against staging schema       | Every PR         |
| `prisma migrate diff`             | Schema drift between schema.prisma and the migrated DB | Same CI job    |
| Staging deploy                    | Migration applies clean against real staging Neon    | After PR merge   |
| Production approval gate          | Final human "is this safe to ship?" check            | Before prod tag  |

If you're hitting this runbook regularly, the layer that should have
caught it is failing — fix that layer first.

---

## Postmortem template

After any rollback, add `docs/postmortems/<YYYY-MM-DD>-<short-title>.md`:

```md
# <date> — <title>

## Impact
- Duration: <start> → <end> UTC
- Affected: <feature> for <user count>
- Severity: <SEV1/SEV2/SEV3>

## Timeline
- HH:MM — Deploy of v1.x.y went out
- HH:MM — First user report / monitoring alert
- HH:MM — Rollback initiated
- HH:MM — Service restored

## Root cause
<one paragraph>

## Why our checks didn't catch it
<one paragraph — what layer should have caught this>

## Action items
- [ ] Add a CI check that would have caught this
- [ ] Write a unit test for the regression
- [ ] Update this runbook with any new lesson

## What went well
<at least one thing — celebrate the fast rollback or good monitoring>
```
