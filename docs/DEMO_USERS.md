# Demo Users

The following test users are available in non-production environments for testing different roles and approval workflows. These users are automatically created by the seed script (`backend/seeds/versions/007_test_users.py`).

| Role | Username | Password | Email | Employee Code |
| :--- | :--- | :--- | :--- | :--- |
| **STAFF** | `staff` | `password` (Note: Forced to change on first login. Typically `NewPassword123!`) | staff@test.com | TEST_STAFF |
| **HOD** | `hod` | `password` | hod@test.com | TEST_HOD |
| **ESTABLISHMENT OFFICER** | `estab` | `password` | estab@test.com | TEST_ESTAB |
| **REGISTRAR** | `registrar` | `password` | registrar@test.com | TEST_REGISTRAR |
| **DEAN ACADEMIC** | `dean` | `password` | dean@test.com | TEST_DEAN |
| **DIRECTOR** | `director` | `password` | director@test.com | TEST_DIRECTOR |
| **ADMIN** | `admin` | `password` | admin@test.com | TEST_ADMIN |

> **Note:** The `staff` user account is pre-seeded with 10 Earned Leave (EL) days for the year 2026 to facilitate testing leave applications right away. All other users can be used to test the approval chains.
