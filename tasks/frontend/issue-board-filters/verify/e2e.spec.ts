import { expect, type Page, test } from '@playwright/test';

// biome-ignore lint/suspicious/noUndeclaredEnvVars: the harness sets BASE_URL when it serves the run
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4174';

async function tabToTestId(page: Page, testId: string, maxTabs = 40): Promise<void> {
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press('Tab');
    const active = await page.evaluate(
      () => document.activeElement?.getAttribute('data-testid') ?? null,
    );
    if (active === testId) {
      return;
    }
  }
  throw new Error(`Could not reach data-testid="${testId}" by pressing Tab`);
}

function issueItems(page: Page) {
  return page.locator('[data-testid^="issue-item-"]');
}

test('label multi-select shows issues matching at least one selected label', async ({ page }) => {
  await page.goto(`${BASE_URL}/`);
  await page.getByTestId('filter-label-option-bug').check();
  await page.getByTestId('filter-label-option-docs').check();

  await expect(issueItems(page)).toHaveCount(20);
  await expect(page.getByTestId('issue-item-ISSUE-101')).toBeVisible();
  await expect(page.getByTestId('issue-item-ISSUE-103')).toBeVisible();
  await expect(page.getByTestId('issue-item-ISSUE-102')).toHaveCount(0);
});

test("assignee filter shows only that person's issues", async ({ page }) => {
  await page.goto(`${BASE_URL}/`);
  await page.getByTestId('filter-assignee').selectOption({ value: 'Priya Patel' });

  await expect(issueItems(page)).toHaveCount(5);
  for (const id of ['ISSUE-103', 'ISSUE-110', 'ISSUE-115', 'ISSUE-121', 'ISSUE-128']) {
    await expect(page.getByTestId(`issue-item-${id}`)).toBeVisible();
  }
  await expect(page.getByTestId('issue-item-ISSUE-101')).toHaveCount(0);
});

test('assignee filter supports the unassigned option', async ({ page }) => {
  await page.goto(`${BASE_URL}/`);
  await page.getByTestId('filter-assignee').selectOption({ value: 'unassigned' });

  await expect(issueItems(page)).toHaveCount(7);
  for (const id of [
    'ISSUE-105',
    'ISSUE-108',
    'ISSUE-111',
    'ISSUE-117',
    'ISSUE-122',
    'ISSUE-125',
    'ISSUE-129',
  ]) {
    await expect(page.getByTestId(`issue-item-${id}`)).toBeVisible();
  }
});

test('search filters issues by title case-insensitively', async ({ page }) => {
  await page.goto(`${BASE_URL}/`);
  await page.getByTestId('filter-search').fill('SESSION');

  await expect(issueItems(page)).toHaveCount(1);
  await expect(page.getByTestId('issue-item-ISSUE-116')).toBeVisible();
});

test('combining status, label, and search narrows results correctly', async ({ page }) => {
  await page.goto(`${BASE_URL}/`);
  await page.getByTestId('filter-status').selectOption({ value: 'open' });
  await page.getByTestId('filter-label-option-bug').check();
  await page.getByTestId('filter-search').fill('crash');

  await expect(issueItems(page)).toHaveCount(3);
  for (const id of ['ISSUE-101', 'ISSUE-107', 'ISSUE-126']) {
    await expect(page.getByTestId(`issue-item-${id}`)).toBeVisible();
  }
});

test('URL query params pre-populate the filters and the list on direct navigation', async ({
  page,
}) => {
  const url = `${BASE_URL}/?status=open&labels=bug&assignee=${encodeURIComponent('Ava Chen')}&q=login`;
  await page.goto(url);

  await expect(page.getByTestId('filter-status')).toHaveValue('open');
  await expect(page.getByTestId('filter-label-option-bug')).toBeChecked();
  await expect(page.getByTestId('filter-label-option-docs')).not.toBeChecked();
  await expect(page.getByTestId('filter-assignee')).toHaveValue('Ava Chen');
  await expect(page.getByTestId('filter-search')).toHaveValue('login');

  await expect(issueItems(page)).toHaveCount(2);
  await expect(page.getByTestId('issue-item-ISSUE-101')).toBeVisible();
  await expect(page.getByTestId('issue-item-ISSUE-130')).toBeVisible();
});

test('selecting a label updates the URL query string', async ({ page }) => {
  await page.goto(`${BASE_URL}/`);
  await page.getByTestId('filter-label-option-urgent').check();

  await expect(page).toHaveURL(/labels=urgent/);
});

test('shows the empty state when the filter combination matches nothing', async ({ page }) => {
  await page.goto(`${BASE_URL}/`);
  await page.getByTestId('filter-assignee').selectOption({ value: 'Jordan Lee' });
  await page.getByTestId('filter-label-option-docs').check();

  await expect(page.getByTestId('empty-state')).toBeVisible();
  await expect(issueItems(page)).toHaveCount(0);
  await expect(page.getByTestId('issue-list')).toHaveCount(0);
});

test('the label filter is operable with the keyboard alone', async ({ page }) => {
  await page.goto(`${BASE_URL}/`);
  await tabToTestId(page, 'filter-label-option-bug');
  await page.keyboard.press('Space');

  await expect(page.getByTestId('filter-label-option-bug')).toBeChecked();
  await expect(issueItems(page)).toHaveCount(13);
  await expect(page.getByTestId('issue-item-ISSUE-103')).toHaveCount(0);
});
