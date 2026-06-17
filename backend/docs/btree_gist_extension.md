# btree_gist PostgreSQL Extension

Required for the concurrent leave overlap exclusion constraint in Phase 1.
Run this SQL on your PostgreSQL instance before applying migrations:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
```

This enables the GiST index on daterange columns needed for:

```sql
ALTER TABLE leave_applications
ADD CONSTRAINT no_overlapping_approved_leave
EXCLUDE USING gist (
    employee_id WITH =,
    daterange(from_date, to_date, '[]') WITH &&
) WHERE (status IN ('SUBMITTED','UNDER_REVIEW','APPROVED'));
```

Note: btree_gist is included in the standard PostgreSQL contrib package.
- Docker: the postgres:16-alpine image includes it by default.
- Windows: included with the standard PostgreSQL 16 installer.