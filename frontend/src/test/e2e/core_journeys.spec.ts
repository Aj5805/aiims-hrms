import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

const STAFF_NEW_PASSWORD = 'newpassword123';

interface LeaveApplicationRequestBody {
  employee_id?: string;
}

async function newIsolatedContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({
    baseURL: 'http://localhost:5173',
  });
}

async function login(page: Page, username: string, password: string) {
  await page.goto('/login');
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.locator('button[type="submit"]').click();
}

test.describe.serial('Core Journeys E2E', () => {
  let appNumber = '';

  test('J1: Staff login, password change, apply leave', async ({ browser }) => {
    const context = await newIsolatedContext(browser);
    const page = await context.newPage();

    await login(page, 'staff', 'password');
    await expect(page.locator('h1', { hasText: 'Update Password' })).toBeVisible();

    await page.locator('#current_password').first().fill('password');
    await page.locator('#new_password').first().fill(STAFF_NEW_PASSWORD);
    await page.locator('#confirm_password').first().fill(STAFF_NEW_PASSWORD);
    await Promise.all([
      page.waitForURL('http://localhost:5173/'),
      page.locator('#confirm_password').first().press('Enter'),
    ]);

    await login(page, 'staff', STAFF_NEW_PASSWORD);
    await expect(page.locator('a', { hasText: 'Apply' })).toBeVisible();

    let submittedBody: LeaveApplicationRequestBody | null = null;
    await page.route('**/api/v1/leave-applications', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        submittedBody = request.postDataJSON() as LeaveApplicationRequestBody;
      }
      await route.continue();
    });

    await page.goto('/apply');
    await expect(page.locator('h2', { hasText: 'Apply for Leave' })).toBeVisible();
    await expect(page.getByPlaceholder('Employee ID (UUID for now)')).toHaveCount(0);

    const dateInputs = page.locator('input[type="date"]');
    await dateInputs.nth(0).fill('2026-07-21');
    await dateInputs.nth(1).fill('2026-07-22');
    await page.locator('textarea[placeholder="Reason *"]').fill('Taking personal time');
    await page.locator('button', { hasText: 'Submit Application' }).click();

    const msg = page.locator('.bg-blue-50');
    await expect(msg).toContainText('Submitted! App #');
    await expect.poll(() => submittedBody?.employee_id ?? '').toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );

    const text = await msg.innerText();
    const match = text.match(/App #: (HRMS\/\d+\/\d+)/);
    expect(match).not.toBeNull();
    appNumber = match![1];
    expect(appNumber).toMatch(/^HRMS\/2026\/\d+$/);

    await context.close();
  });

  test('J2: Approve chain (HOD -> ESTAB -> REGISTRAR)', async ({ browser }) => {
    for (const role of ['hod', 'estab', 'registrar']) {
      const context = await newIsolatedContext(browser);
      const page = await context.newPage();

      await login(page, role, 'password');
      await expect(page.locator('a', { hasText: 'Inbox' })).toBeVisible();

      await page.goto('/inbox');
      await expect(page.locator('h2', { hasText: 'Approval Inbox' })).toBeVisible();

      const inboxItem = page.locator('.bg-white.rounded-lg.shadow.p-4').filter({ hasText: 'Staff User' }).first();
      await expect(inboxItem).toBeVisible();
      await inboxItem.locator('input[placeholder="Remarks"]').fill(`${role} approved`);
      await inboxItem.locator('button', { hasText: 'Approve' }).click();
      await expect(inboxItem).toBeHidden();

      await context.close();
    }
  });

  test('J3: Staff checks balance after approval', async ({ browser }) => {
    const context = await newIsolatedContext(browser);
    const page = await context.newPage();

    await login(page, 'staff', STAFF_NEW_PASSWORD);
    await expect(page.locator('a', { hasText: 'Account' })).toBeVisible();

    await page.goto('/leave-account');
    await expect(page.locator('button', { hasText: 'Load Account' })).toBeVisible();
    await page.locator('button', { hasText: 'Load Account' }).click();

    const elCard = page.locator('.bg-white').filter({ hasText: 'EL' }).first();
    await expect(elCard).toContainText('Used 2.0');
    await expect(elCard).toContainText('8.0');

    await context.close();
  });

  test('J4: Admin views another employee account and ledger', async ({ browser }) => {
    const context = await newIsolatedContext(browser);
    const page = await context.newPage();

    await login(page, 'admin', 'password');
    await expect(page.locator('a', { hasText: 'Account' })).toBeVisible();

    await page.goto('/leave-account');
    await page.getByPlaceholder('Search by employee code or name').fill('staff');
    await page.locator('button', { hasText: 'Search' }).first().click();
    await page.locator('select').nth(0).selectOption({ index: 1 });
    await page.locator('button', { hasText: 'Load Account' }).click();

    const elCard = page.locator('.rounded-xl').filter({ hasText: 'EL' }).first();
    await expect(elCard).toBeVisible();
    await page.getByRole('button', { name: 'Show Ledger' }).first().click();
    await expect(page.getByText('Ledger', { exact: true })).toBeVisible();
    await expect(page.locator('table')).toBeVisible();

    await context.close();
  });

  test('J5: Establishment user opens reports and triggers leave-register download', async ({ browser }) => {
    const context = await newIsolatedContext(browser);
    const page = await context.newPage();

    await login(page, 'estab', 'password');
    await expect(page.locator('a', { hasText: 'Reports' })).toBeVisible();

    await page.goto('/reports');
    await expect(page.locator('h2', { hasText: 'Reports & Payroll Export' })).toBeVisible();

    const dateInputs = page.locator('input[type="date"]');
    await dateInputs.nth(0).fill('2026-07-01');
    await dateInputs.nth(1).fill('2026-07-31');

    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/v1/reports/leave-register') && response.request().method() === 'GET'
    );
    const downloadPromise = page.waitForEvent('download');

    await page.getByRole('button', { name: 'Download Current Output' }).first().click();

    const [response, download] = await Promise.all([responsePromise, downloadPromise]);
    expect(response.ok()).toBeTruthy();

    const body = await response.body();
    expect(body.byteLength).toBeGreaterThan(0);
    expect(await download.suggestedFilename()).toContain('leave-register');

    await context.close();
  });
});
