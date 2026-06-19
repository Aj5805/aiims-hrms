# Leave Policy Matrix And Approver Dashboard Notes

Working note for the next design pass on leave-policy administration and approver-facing operational visibility.

## 1. Proposed admin control surface

Primary page name:
- `Leave Policy Matrix`

Recommended placement:
- Under `Admin`
- Not under generic `Masters`

Recommended interaction model:
- Top row tabs for staff categories
- One tab per category:
  - `FACULTY`
  - `NURSING`
  - `ADMIN`
  - `JR_ACAD`
  - `SR_ACAD`
  - `JR_NA`
  - `SR_NA`
- Main table inside each tab:
  - rows = leave types
  - columns = policy attributes

Recommended core columns:
- `Leave Type`
- `Eligibility`
- `Credit Frequency`
- `Credit Qty`
- `Max At A Time`
- `Max Per Year`
- `Carry Forward`
- `Max Accumulation`
- `Half Day Allowed`
- `MC Required`
- `Workflow`
- `Active`

Recommended simple eligibility field for v1:
- dropdown values:
  - `ALL`
  - `NONE`
  - `MALE_ONLY`
  - `FEMALE_ONLY`

Reason:
- simple for admins
- easy to validate in backend
- avoids premature rule-engine complexity

Suggested backend naming:
- page label: `Leave Policy Matrix`
- technical resource: `leave_policy_rules`

## 2. Why category-first is preferred

Primary admin questions are usually category-first:
- what can residents apply for
- what are faculty leave rules
- what is nursing policy this year

So the preferred main UX is:
- category tabs first
- leave types as rows

Leave-type-first comparison can be added later as a secondary analysis tool, not the primary editing surface.

## 3. Approver dashboard requirement

New requirement:
- each approver should have a dashboard showing the overall leave scenario of staff under that approver

This should not be only an inbox of pending approvals.
It should be an operational visibility dashboard.

## 4. Recommended approver dashboard design

Page name candidates:
- `Approver Dashboard`
- `Team Leave Dashboard`
- `Leave Overview`

Best user-facing name:
- `Team Leave Dashboard`

Reason:
- clearer and less technical than `Approver Dashboard`
- reflects that the user is supervising a team or scope, not just clicking approve/reject

## 5. What the dashboard should show

### A. Summary strip

At the top:
- `On Leave Today`
- `Pending My Approval`
- `Upcoming Leaves`
- `Employees With Low Balance`
- `Employees Absent This Week`

### B. Team leave table

Main table should show staff within the approver's scope.

Recommended columns:
- `Emp Code`
- `Name`
- `Department`
- `Category`
- `Current Status`
- `On Leave Today`
- `Upcoming Leave`
- `Pending Applications`
- `Leave Balance Snapshot`
- `Last Action Needed`

### C. Calendar / timeline view

Useful secondary view:
- weekly or monthly team leave calendar
- quick clash visibility
- helps HODs and approving officers spot concentration risk

### D. Approval risk / attention panel

Useful widgets:
- applications nearing SLA breach
- overlapping team absences
- too many people away from one department/unit
- modified or recalled applications requiring attention

### E. Balance insight

Approvers usually need a light balance summary, not full payroll-style detail.

Useful snapshot:
- `EL`
- `HPL`
- `CL`
- any category-specific major leave buckets

## 6. Scope by role

Dashboard scope should depend on role:

- `HOD`
  - own department staff
- `DEAN_ACADEMIC`
  - residents
- `ESTABLISHMENT_OFFICER`
  - regular staff / institution-wide operational scope as defined
- `REGISTRAR`
  - regular staff / higher-level institutional scope
- `DIRECTOR`
  - institution-wide summary, not necessarily row-level overload by default

Important:
- dashboard scope must use the same enforced scope model as approval and reporting
- it must not rely only on frontend filtering

## 7. Better than a simple approver dashboard

A better model is:
- `Team Leave Dashboard` for operational visibility
- `Approval Inbox` for action queue

These should be related but not the same page.

Why:
- inbox answers: what needs my action now
- dashboard answers: what is happening in my team overall

Recommended nav structure:
- `Inbox`
- `Team Leave Dashboard`

## 8. Recommended improvements over the current direction

- Do not make approvers read raw application rows only.
- Add team-level summary first, then drill down.
- Provide both table and calendar views.
- Add conflict signals:
  - too many staff off on same dates
  - key staff off together
  - low-balance risk
  - pending approvals close to SLA limit
- Make the dashboard role-scoped and trust backend scope enforcement.
- Keep dashboard separate from policy configuration.

## 9. Open discussion points

Items to decide next:
- exact page name:
  - `Team Leave Dashboard` vs `Approver Dashboard`
- whether directors should see full drill-down or only summary-first
- whether balance snapshot should be compact chips or expandable detail
- whether category tabs are enough or department filters are also needed
- whether calendar view is in v1 or later
- whether clash thresholds should be configurable

## 10. Ideal admin scope

`ADMIN` should act as the in-app control owner for leave policy, workflow setup, operational monitoring, and governance.

Admin should be able to:

- control leave policy
  - manage the `Leave Policy Matrix`
  - define leave-type applicability by staff category
  - maintain eligibility, credit frequency, credit quantity, limits, carry-forward, accumulation, half-day, and MC rules
- control organization setup
  - manage employee master
  - manage departments
  - manage designations
  - manage category mappings and employee-to-user consistency
- control workflow and approvals
  - configure approval chains
  - simulate routing before publishing
  - identify missing approvers, self-approval risk, and broken chains
- monitor operations
  - track pending approvals, SLA risk, leave load, low balances, notification failures, and data-quality gaps
- control governance
  - manage users and roles
  - force password reset or logout
  - view audit trail
  - review sensitive configuration changes

## 11. Ideal admin dashboard

Admin dashboard should be a control center, not a raw table dump.

Recommended top summary cards:
- `Employees Active`
- `Applications Pending`
- `Approvals Near SLA`
- `On Leave Today`
- `Low Balance Cases`
- `Policy Exceptions`
- `Notification Failures`
- `Recent Config Changes`

Recommended dashboard sections:

### A. Policy control

Quick entry points:
- `Leave Policy Matrix`
- `Workflow Policy`
- `Holiday Master`
- `Opening Balances`
- `Policy Simulation`

### B. Operations overview

Should show:
- pending applications by stage
- today and upcoming leave load
- departments with high absence
- applications stuck in review
- modified, recalled, and rejected counts

### C. People and access

Should show:
- active users by role
- employees without user mapping
- inactive employees linked to active users
- users needing password reset
- recent role changes

### D. Risk and alerts

Should show:
- missing workflow chain
- approver role with no active user
- self-approval risk
- overlapping heavy leave in same unit
- failed notifications
- master-data inconsistencies

### E. Audit and change feed

Should show recent:
- policy edits
- workflow edits
- user and role changes
- force-logout and password-reset actions
- imports and bulk operations

## 12. Main controls placement

Main admin controls should be placed as a top horizontal tab/action strip, but not as floating action buttons.

Recommended pattern:
- a fixed top horizontal control bar inside the admin area
- each item behaves like a section tab or primary module switch

Recommended items:
- `Dashboard`
- `Leave Policy Matrix`
- `Workflow Policy`
- `Employees`
- `Users & Roles`
- `Calendars & Holidays`
- `Balances & Credits`
- `Audit & Health`

Why this works:
- these are primary work areas, not one-off actions
- admins need fast lateral switching between them
- horizontal top placement makes the information architecture visible

What to avoid:
- floating action buttons for these controls
- hiding primary controls inside dropdowns
- mixing module navigation with small record-level actions

Use floating action buttons only for local page actions such as:
- `Add Holiday`
- `Create Workflow`
- `Add Employee`
- `Publish Policy`

So the better model is:
- horizontal top strip for main admin modules
- local buttons inside each page for record-level actions

## 13. Recommended admin information architecture

Admin area should be a dedicated workspace with a stable horizontal module bar.

Recommended module order:
- `Dashboard`
- `Leave Policy Matrix`
- `Workflow Policy`
- `Employees`
- `Users & Roles`
- `Calendars & Holidays`
- `Balances & Credits`
- `Audit & Health`

Recommended module behavior:
- module bar stays visible while inside admin
- active module is visually strong and persistent
- each module has its own local toolbar beneath the main strip
- breadcrumb is not necessary if module naming is clear

Recommended responsive behavior:
- desktop:
  - full horizontal module bar
- tablet:
  - horizontally scrollable module pills
- mobile:
  - horizontally scrollable pills plus compact summary-first layout

## 14. UX rules for the admin area

### A. Separate navigation from actions

Use:
- top horizontal strip for modules
- local page toolbar for actions

Do not use:
- floating action buttons for top-level navigation
- mixed controls where `Dashboard` appears beside `Add Employee`

### B. Show decision surfaces first

Every admin module should start with:
- summary state
- current risk or exceptions
- the most common next actions

Admins should not land first on raw table dumps unless the module itself is inherently list-first.

### C. Keep read, edit, and publish states explicit

For configuration-heavy pages:
- `View`
- `Edit`
- `Save Draft`
- `Publish`
- `Discard Changes`

Avoid silent auto-save for policy-critical pages.

### D. Always expose scope and version

Config pages should visibly show:
- current policy version
- effective date
- draft vs published state
- affected category or workflow scope

### E. Prefer inline editing only for low-risk fields

Inline editing is acceptable for:
- simple dropdowns
- boolean toggles
- numbers with tight validation

Use side panel or modal for:
- workflow chain editing
- advanced policy rule details
- bulk copy or publish operations

## 15. Leave Policy Matrix UX spec

### A. Page structure

Recommended page layout:

1. Page header
- title: `Leave Policy Matrix`
- subtitle:
  - current policy version
  - effective date
  - draft or published status

2. Header actions
- `Copy From Category`
- `Compare Leave Type`
- `Save Draft`
- `Publish Policy`

3. Category tabs
- one tab per staff category

4. Matrix table
- leave types as rows
- policy attributes as columns

5. Row detail drawer
- advanced validation and routing details

### B. Recommended columns for v1

Keep the first visible set practical:
- `Leave Type`
- `Eligibility`
- `Credit Frequency`
- `Credit Qty`
- `Max At A Time`
- `Carry Forward`
- `Max Accumulation`
- `Half Day`
- `MC Rule`
- `Workflow`
- `Active`

Move advanced items to row expansion:
- `Max Per Year`
- `Special Validation`
- `Remarks`
- `Audit Info`

### C. Row interactions

Each row should support:
- toggle active/inactive
- change eligibility dropdown
- edit numeric fields inline
- open advanced side panel

Advanced side panel should show:
- rule source
- effective version
- workflow mapping
- validation summary
- last changed by / when

### D. Bulk tools

Required bulk tools:
- `Copy category policy`
- `Reset category to defaults`
- `Apply column value to selected rows`
- `Export matrix`

Optional later:
- import from spreadsheet
- compare current draft vs published

### E. Empty and risk states

If a category has missing rules:
- show a warning banner:
  - `Some leave types have no active policy rules`

If workflow mapping is missing:
- show row-level warning chip:
  - `No workflow`

If a rule is invalid:
- show row-level error chip:
  - `Publish blocked`

## 16. Workflow Policy UX spec

Workflow should be a separate module, but tightly linked from the matrix.

Recommended page structure:
- left panel:
  - workflow list
  - filters for category, leave type, active status
- main panel:
  - selected workflow chain visualization
- right panel or drawer:
  - step editor

Recommended chain visualization:
- vertical approval ladder
- one card per step
- clear final authority indicator
- clear self-applicant skip flag
- clear specific-user assignments

Required workflow actions:
- `Create Workflow`
- `Duplicate Workflow`
- `Edit Step`
- `Delete Step`
- `Simulate Routing`
- `Publish`

Simulation panel should accept:
- category
- leave type
- days
- applicant role
- optional employee context

Simulation result should show:
- matched workflow
- approver sequence
- skipped steps
- warnings:
  - missing approver
  - self-approval risk
  - no matching chain

## 17. Employees module UX spec

Employees should become a proper admin work area, not just a simple list.

Recommended top sections:
- summary cards:
  - active employees
  - inactive employees
  - employees without users
  - employees with invalid master mappings

Recommended main table columns:
- `Emp Code`
- `Name`
- `Department`
- `Designation`
- `Category`
- `Role`
- `User Linked`
- `Status`
- `Actions`

Recommended toolbar actions:
- `Add Employee`
- `Import Employees`
- `Export`
- `Fix Mapping`

Recommended detail drawer:
- employee profile
- linked user account
- leave category and designation mapping
- reporting structure
- leave balance summary

## 18. Users & Roles module UX spec

This should be governance-oriented, not only a CRUD list.

Recommended views:
- `All Users`
- `Role Assignments`
- `Pending Reset`
- `Deactivated`

Recommended columns:
- `Username`
- `Employee`
- `Role`
- `Department`
- `Status`
- `Must Change Password`
- `Last Login`
- `Actions`

Sensitive actions should require confirmation:
- change role
- deactivate user
- force password reset
- force logout

If `ADMIN` role is changed:
- show elevated confirmation
- require reason field

## 19. Calendars & Holidays module UX spec

This module should combine:
- holiday management
- leave calendar visibility

Recommended sub-tabs:
- `Holiday Master`
- `Institution Calendar`
- `Department Calendar`

Holiday Master view:
- year selector
- list/table
- add, edit, delete

Calendar view:
- monthly grid
- filters by department and category
- approved leaves only by default
- conflict highlights

## 20. Balances & Credits module UX spec

This module should support both setup and supervision.

Recommended sub-tabs:
- `Opening Balances`
- `Year-End Processing`
- `Credits Run`
- `Balance Exceptions`

Recommended summary cards:
- employees with no balance
- negative or inconsistent balances
- pending credit actions
- carry-forward exceptions

Recommended tools:
- import opening balances
- run preview
- validate before commit
- export exception list

## 21. Audit & Health module UX spec

This module should merge governance and operational health.

Recommended sub-tabs:
- `Audit Log`
- `System Health`
- `Notification Queue`
- `Config Changes`

Audit Log should support filters:
- entity type
- actor
- date range
- action type

System Health should show:
- pending notification count
- failed notification count
- recent error rate
- last backup
- database connection health

## 22. Team Leave Dashboard UX spec

Recommended page layout:

1. Header
- title: `Team Leave Dashboard`
- visible scope label:
  - `Department: General Medicine`
  - or `Scope: Residents`

2. Summary strip
- `On Leave Today`
- `Pending My Approval`
- `Upcoming This Week`
- `Low Balance Cases`
- `Overlap Alerts`

3. Main content with two primary views:
- `Table View`
- `Calendar View`

4. Secondary side panel:
- `Attention Needed`
- `SLA Risk`
- `Team Gaps`

### Table View columns

- `Emp Code`
- `Name`
- `Department`
- `Category`
- `Today`
- `Next Leave`
- `Pending`
- `Balance Snapshot`
- `Attention`

### Calendar View behavior

- weekly default
- monthly optional
- highlight approved and pending separately
- color conflict clusters

### Attention panel behavior

Show:
- pending approvals nearing SLA
- too many concurrent absences
- employees with repeated short absences
- low-balance staff with planned leave

## 23. Approval Inbox UX spec

Inbox should remain action-first.

Recommended sections:
- `Pending`
- `Forwarded`
- `Modified`
- `Urgent`

Recommended list fields:
- applicant
- department
- leave type
- dates
- days
- current step
- pending hours
- reason preview

Recommended quick actions:
- approve
- reject
- modify
- forward
- open full detail

Recommended support panel:
- balance summary
- team calendar snippet
- overlap warning
- prior leave history summary

## 24. Visual design direction

The admin and approver surfaces should feel structured and operational, not generic CRUD.

Recommended visual direction:
- strong horizontal module strip
- compact, information-dense cards
- clear chips for risk states
- table-first layouts with expandable side detail
- muted neutral base with selective alert colors

Recommended status colors:
- blue:
  - informational
- green:
  - healthy / approved
- amber:
  - warning / pending / nearing SLA
- red:
  - blocked / invalid / failed

Avoid:
- decorative motion that slows usage
- deep nesting
- giant forms on first render

## 25. First implementation priority order

If redesign work starts, the preferred order is:

1. `Admin module bar and IA`
2. `Leave Policy Matrix`
3. `Workflow Policy`
4. `Team Leave Dashboard`
5. `Approval Inbox refinement`
6. `Employees`
7. `Users & Roles`
8. `Calendars & Holidays`
9. `Balances & Credits`
10. `Audit & Health`

Reason:
- this sequence fixes the product shape first
- it aligns policy, routing, and operational supervision before secondary cleanup

## 26. Immediate decisions captured

Current preferred direction:
- category-first `Leave Policy Matrix`
- `Eligibility` as a simple dropdown for v1
- top horizontal admin module strip
- separate `Team Leave Dashboard` and `Approval Inbox`
- admin as control-center role
- workflow kept as a dedicated module linked from policy rows

## 27. Session handover

### What was completed in this session

- created and expanded this design note into the main working knowledge surface for:
  - admin information architecture
  - leave policy matrix
  - workflow policy UX
  - team leave dashboard
  - approval inbox refinement
- replaced the old flat admin frontend page with a new admin workspace shell in:
  - [frontend/src/pages/Phase678Pages.tsx](/c:/Users/aiims/Desktop/FS/HRMS/aiims-hrms/frontend/src/pages/Phase678Pages.tsx:1)
- new admin frontend now includes:
  - horizontal admin module strip
  - dashboard summary cards
  - policy/workflow/employees/users/calendar/balances/audit module shells
  - first-pass `Leave Policy Matrix` UX shell
  - stronger visual hierarchy and clearer admin control framing
- restarted the frontend dev server and verified the Vite-served source includes the new admin strings

### What was verified

- `npx eslint src/pages/Phase678Pages.tsx` passed
- Vite dev server is serving the updated frontend on:
  - `http://127.0.0.1:5173`
- verified served module contains:
  - `Admin Workspace`
  - `Leave Policy Matrix`
  - `Control center for policy, workflow, and governance`

### Important discovery from user feedback

The user initially could not see the expected admin change because:
- the app shell still has the old global top-row navigation in [frontend/src/App.tsx](/c:/Users/aiims/Desktop/FS/HRMS/aiims-hrms/frontend/src/App.tsx:1)
- the new admin workspace is rendered inside the existing `/admin` route
- this makes the new UX appear as if it is "inside the admin tab" rather than truly taking over the admin area

User observation:
- "there a admin fab on top row in admin. all all ur works sitting there."

Interpretation:
- the admin workspace page itself is rendering
- but the surrounding layout still feels structurally wrong

### Most important next step

Fix the app shell so admin becomes a proper workspace.

Recommended next implementation:
- update [frontend/src/App.tsx](/c:/Users/aiims/Desktop/FS/HRMS/aiims-hrms/frontend/src/App.tsx:1)
- detect when route starts with `/admin`
- reduce or suppress conflicting global top-row nav items while inside admin
- let the admin module strip become the dominant primary navigation for that area

This is the next required UX correction before drilling deeper into module internals.

### Secondary next step after shell fix

Once the admin shell takeover is correct:
- drill into `Leave Policy Matrix` first
- make it a dedicated, production-grade screen
- define exact row schema, inline edit rules, row drawer, and draft/publish behavior

### Known technical blocker unrelated to this UX slice

Full frontend build is still blocked by an existing unrelated TypeScript issue:
- [frontend/src/pages/ChangePasswordPage.tsx](/c:/Users/aiims/Desktop/FS/HRMS/aiims-hrms/frontend/src/pages/ChangePasswordPage.tsx:12)
- error:
  - unused `token`

This did not block the Vite dev server, but it does block `npm run build`.

### Current recommendation for next session

Work order:
1. fix admin route shell takeover in `frontend/src/App.tsx`
2. verify visually that `/admin` now reads as a standalone workspace
3. deepen `Leave Policy Matrix`
4. only after that, revisit workflow, team dashboard, and backend alignment
