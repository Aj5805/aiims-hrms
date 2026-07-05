import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

const STAFF_NEW_PASSWORD = 'NewPassword123!';

interface LeaveApplicationRequestBody {
  employee_id?: string;
}

async function newIsolatedContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({
    baseURL: 'http://localhost:5173',
  });
}

async function login(
  page: Page,
  username: string,
  password: string,
  fallbackPassword?: string,
  options?: { handlePasswordChange?: boolean }
) {
  await page.goto('/login');
  await page.locator('#username').fill(username);
  const candidatePasswords = [password, ...(fallbackPassword && fallbackPassword !== password ? [fallbackPassword] : [])];
  let lastFailure: string | null = null;

  for (const candidatePassword of candidatePasswords) {
    await page.locator('#password').fill(candidatePassword);
    await page.locator('#login-submit').click();
    await page.waitForFunction(
      () => window.location.pathname !== '/login' || !!document.querySelector('.bg-red-50'),
      { timeout: 10000 }
    );

    if (new URL(page.url()).pathname !== '/login') {
      await page.waitForURL((url) => url.pathname === '/' || url.pathname === '/change-password', { timeout: 15000 });
      lastFailure = null;
      break;
    }

    lastFailure = await page.locator('.bg-red-50').textContent() || `Login failed for ${username}`;
    await expect(page.locator('#login-submit')).toBeEnabled();
  }

  if (lastFailure) {
    throw new Error(lastFailure);
  }

  if (options?.handlePasswordChange && (await page.locator('#current_password').count()) > 0) {
    await page.locator('#current_password').fill(password);
    await page.locator('#new_password').fill(STAFF_NEW_PASSWORD);
    await page.locator('#confirm_password').fill(STAFF_NEW_PASSWORD);
    await Promise.all([
      page.waitForURL('http://localhost:5173/'),
      page.locator('#change-password-submit').click(),
    ]);
  }
}

test.describe.serial('Core Journeys E2E', () => {
  let appNumber = '';

  test('J1: Staff login, password change, apply leave', async ({ browser }) => {
    const context = await newIsolatedContext(browser);
    const page = await context.newPage();

    await login(page, 'staff', 'password', undefined, { handlePasswordChange: true });
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
    await expect.poll(async () => page.locator('input[placeholder="Employee ID (UUID for now)"]').count()).toBe(0);

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


  test('J2: Approve chain (HOD -> Nodal Officer)', async ({ browser }) => {
    for (const role of ['hod', 'nodal']) {
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

  test('J5: Nodal officer opens reports and triggers leave-register download', async ({ browser }) => {
    const context = await newIsolatedContext(browser);
    const page = await context.newPage();

    await login(page, 'nodal', 'password');
    await expect(page.locator('a', { hasText: 'Reports' })).toBeVisible();

    await page.goto('/reports');
    await expect(page.locator('h2', { hasText: 'Reports' })).toBeVisible();

    const dateInputs = page.locator('input[type="date"]');
    await dateInputs.nth(0).fill('2026-07-01');
    await dateInputs.nth(1).fill('2026-07-31');

    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/v1/reports/leave-register') && response.request().method() === 'GET'
    );
    const downloadPromise = page.waitForEvent('download');

    await page.getByRole('button', { name: 'Export Excel' }).click();

    const [response, download] = await Promise.all([responsePromise, downloadPromise]);
    expect(response.ok()).toBeTruthy();
    expect(response.headers()['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    const body = await response.body();
    expect(body.byteLength).toBeGreaterThan(0);
    expect(await download.suggestedFilename()).toContain('.xlsx');

    await context.close();
  });

  test('J6: HOD sees new staff application notification and marks it read', async ({ browser }) => {
    const cleanupContext = await newIsolatedContext(browser);
    const cleanupPage = await cleanupContext.newPage();

    await login(cleanupPage, 'hod', 'password');
    await expect(cleanupPage.locator('button[aria-label="Notifications"]')).toBeVisible();
    if (await cleanupPage.locator('button[aria-label="Notifications"] span').count()) {
      await cleanupPage.locator('button[aria-label="Notifications"]').click();
      await cleanupPage.getByRole('button', { name: 'Mark all read' }).click();
      await expect(cleanupPage.locator('button[aria-label="Notifications"] span')).toHaveCount(0, { timeout: 10000 });
    }
    await cleanupContext.close();

    const staffContext = await newIsolatedContext(browser);
    const staffPage = await staffContext.newPage();

    await login(staffPage, 'staff', STAFF_NEW_PASSWORD);
    await expect(staffPage.locator('a', { hasText: 'Apply' })).toBeVisible();

    let submittedBody: LeaveApplicationRequestBody | null = null;
    await staffPage.route('**/api/v1/leave-applications', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        submittedBody = request.postDataJSON() as LeaveApplicationRequestBody;
      }
      await route.continue();
    });

    await staffPage.goto('/apply');
    await expect(staffPage.locator('h2', { hasText: 'Apply for Leave' })).toBeVisible();

    const dateInputs = staffPage.locator('input[type="date"]');
    await dateInputs.nth(0).fill('2026-08-03');
    await dateInputs.nth(1).fill('2026-08-04');
    await staffPage.locator('textarea[placeholder="Reason *"]').fill('Taking personal time');
    await staffPage.locator('button', { hasText: 'Submit Application' }).click();

    const msg = staffPage.locator('.bg-blue-50');
    await expect(msg).toContainText('Submitted! App #');
    await expect.poll(() => submittedBody?.employee_id ?? '').toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );

    const text = await msg.innerText();
    const match = text.match(/App #: (HRMS\/\d+\/\d+)/);
    expect(match).not.toBeNull();
    const appNumber = match![1];
    expect(appNumber).toMatch(/^HRMS\/2026\/\d+$/);
    await staffContext.close();

    const hodContext = await newIsolatedContext(browser);
    const hodPage = await hodContext.newPage();

    await login(hodPage, 'hod', 'password');
    await expect(hodPage.locator('button[aria-label="Notifications"]')).toBeVisible();
    const badge = hodPage.locator('button[aria-label="Notifications"] span');
    await expect(badge).toHaveCount(1);
    await expect(badge).not.toHaveText('0');

    await hodPage.locator('button[aria-label="Notifications"]').click();
    await expect(hodPage.getByText(`Application: ${appNumber}`)).toBeVisible();

    const markReadButton = hodPage.locator('button', { hasText: 'Mark read' }).first();
    const markReadRequest = hodPage.waitForResponse((response) =>
      response.url().includes('/api/v1/notifications/') && response.request().method() === 'PUT'
    );

    await markReadButton.click();
    const markReadResponse = await markReadRequest;
    expect(markReadResponse.ok()).toBeTruthy();

    await expect(hodPage.locator('button[aria-label="Notifications"] span')).toHaveCount(0, { timeout: 10000 });

    await hodContext.close();
  });
});
