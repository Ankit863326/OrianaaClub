import fs from 'node:fs/promises';
import path from 'node:path';
import { test, expect } from '@playwright/test';

const viewports = [
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
];

const user = {
  id: 'fixture-admin-01',
  _id: 'fixture-admin-01',
  firstName: 'Taylor',
  email: 'admin.fixture@example.test',
  role: 'admin',
};

const plan = {
  _id: 'fixture-plan-01',
  id: 'orchid',
  slug: 'orchid',
  title: 'Orchid Membership',
  subtitle: 'Fixture membership',
  price: 12000,
  planFee: 500,
  gstPercent: 18,
  maxFamilyMembers: 2,
  isActive: true,
  isFeatured: false,
  sortOrder: 1,
  pointsTiers: [],
};

const member = {
  _id: 'fixture-member-01',
  firstName: 'Avery',
  email: 'avery.fixture@example.test',
  status: 'active',
  profile: {
    fullName: 'Avery Fixture',
    mobile: '9000000001',
    countryCode: '+91',
    interestArea: 'Wellness',
  },
  membership: {
    memberId: 'OC-FIXTURE-01',
    status: 'active',
    pointsBalance: 320,
    plan,
    startDate: '2025-01-10T00:00:00.000Z',
    endDate: '2026-01-10T00:00:00.000Z',
  },
};

const safePayment = {
  _id: 'fixture-payment-01',
  createdAt: '2025-01-10T10:30:00.000Z',
  user: { firstName: 'Avery' },
  plan: { title: 'Orchid Membership' },
  method: 'bank_transfer',
  status: 'pending_verification',
  baseAmount: 1200000,
  gstAmount: 216000,
  totalAmount: 1416000,
  invoiceNumber: 'FIXTURE-INV-001',
  utr: 'FIXTURE-UTR-001',
  proofUrl: '/fixtures/safe-proof.png',
};

const paged = (items) => ({ items, page: 1, pages: 1, total: items.length });
const safeContent = {
  _id: 'fixture-content-01',
  title: 'Fixture journal entry',
  slug: 'fixture-journal-entry',
  excerpt: 'Safe test content for responsive checks.',
  content: 'This record contains no real member information.',
  category: 'Wellness',
  status: 'draft',
  updatedAt: '2025-01-10T10:30:00.000Z',
};
const safeEvent = {
  _id: 'fixture-event-01',
  title: 'Fixture event',
  slug: 'fixture-event',
  description: 'Safe test event content.',
  location: 'Test venue',
  date: '2025-02-15T10:30:00.000Z',
  status: 'draft',
  updatedAt: '2025-01-10T10:30:00.000Z',
};
const enquiry = {
  _id: 'fixture-enquiry-01',
  name: 'Jordan Fixture',
  email: 'jordan.fixture@example.test',
  mobile: '9000000002',
  type: 'contact',
  status: 'new',
  createdAt: '2025-01-10T10:30:00.000Z',
  message: 'This is a safe, fictional enquiry for UI tests.',
  internalNotes: [],
};
const safeAdmin = { _id: user.id, firstName: user.firstName, email: user.email, status: 'active', emailVerified: true };

const dashboard = {
  revenue: {
    totalAmount: 141600000,
    paidPayments: 37,
    monthly: [{ month: '2025-01', totalAmount: 141600000 }],
  },
  pendingBankTransfers: 1,
  points: { issued: 5800, spent: 1250 },
  members: {
    total: 48,
    byStatus: { active: 40 },
    signupsLast30Days: [{ date: '2025-01-01', count: 2 }, { date: '2025-01-10', count: 4 }],
  },
  planCounts: [{ plan: 'Orchid Membership', count: 40 }],
};

async function installApiMocks(page, authenticated = true) {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/fixtures/safe-proof.png') {
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p2sAAAAASUVORK5CYII=',
        'base64',
      );
      await route.fulfill({ status: 200, contentType: 'image/png', body: png });
      return;
    }
    if (url.origin === 'http://127.0.0.1:5174') {
      await route.continue();
      return;
    }

    if (url.origin !== 'http://localhost:5000' || !url.pathname.startsWith('/api/admin/')) {
      await route.abort();
      return;
    }

    const pathname = url.pathname.replace(/^\/api/, '');
    let response;
    if (pathname === '/admin/auth/me') {
      if (authenticated) await route.fulfill({ json: user });
      else await route.fulfill({ status: 401, json: { message: 'Not signed in' } });
      return;
    }
    if (pathname === '/admin/auth/forgot-password') {
      await route.fulfill({ json: { message: 'If the address is registered, a reset link will be sent.' } });
      return;
    }
    if (pathname === '/admin/auth/login') {
      await route.fulfill({ json: user });
      return;
    }
    if (pathname === '/admin/auth/logout' || pathname === '/admin/auth/refresh') {
      await route.fulfill({ json: { success: true } });
      return;
    }
    if (pathname === '/admin/dashboard') response = dashboard;
    else if (pathname === '/admin/members') response = paged([{ ...member, membership: { ...member.membership, plan } }]);
    else if (pathname === '/admin/members/fixture-member-01') {
      response = {
        user: { _id: member._id, firstName: member.firstName, email: member.email, status: member.status },
        profile: member.profile,
        membership: member.membership,
        family: [],
        payments: [],
        points: [],
      };
    } else if (pathname === '/admin/plans') response = paged([plan]);
    else if (pathname === '/admin/payments') response = paged([safePayment]);
    else if (pathname === '/admin/payments/fixture-payment-01') response = safePayment;
    else if (pathname === '/admin/posts') response = paged([safeContent]);
    else if (pathname === '/admin/events') response = paged([safeEvent]);
    else if (pathname === '/admin/enquiries') response = paged([enquiry]);
    else if (pathname === '/admin/admins') response = paged([safeAdmin]);
    else if (pathname === '/admin/audit-logs') {
      response = paged([{
        _id: 'fixture-audit-01',
        createdAt: '2025-01-10T10:30:00.000Z',
        admin: { email: user.email },
        action: 'member.updated',
        entityType: 'member',
        summary: 'Updated a fixture record.',
      }]);
    } else if (pathname === '/admin/email-logs') {
      response = paged([{
        _id: 'fixture-email-01',
        createdAt: '2025-01-10T10:30:00.000Z',
        to: 'avery.fixture@example.test',
        template: 'activation',
        status: 'sent',
        error: '',
      }]);
    } else if (pathname === '/admin/reports') {
      response = {
        membersByPlan: [{ plan: 'Orchid Membership', members: 40 }],
        revenueByMonth: [{ _id: '2025-01', totalPaise: 141600000, payments: 37 }],
        pointsByMonth: [{ month: '2025-01', issued: 5800, spent: 1250 }],
      };
    } else response = {};
    await route.fulfill({ json: { data: response } });
  });
}

async function checkLayout(page, viewport) {
  const measurements = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const textSelectors = 'h1,h2,h3,p,button,a,th,td';
    const clipping = [...document.querySelectorAll(textSelectors)]
      .filter(visible)
      .filter((element) => !element.classList.contains('truncate')
        && !element.closest('.overflow-x-auto')
        && !element.closest('table'))
      .filter((element) => element.scrollWidth > element.clientWidth + 2
        || element.scrollHeight > element.clientHeight + 2)
      .map((element) => ({ tag: element.tagName, text: element.textContent.trim().slice(0, 50) }));
    const textElements = [...document.querySelectorAll('h1,h2,h3,p,button,a')]
      .filter(visible)
      .filter((element) => !element.closest('.overflow-x-auto') && !element.classList.contains('float-right'));
    const textOverlaps = [];
    for (let first = 0; first < textElements.length; first += 1) {
      for (let second = first + 1; second < textElements.length; second += 1) {
        const left = textElements[first];
        const right = textElements[second];
        if (left.parentElement !== right.parentElement) continue;
        const leftBox = left.getBoundingClientRect();
        const rightBox = right.getBoundingClientRect();
        if (Math.min(leftBox.right, rightBox.right) - Math.max(leftBox.left, rightBox.left) > 2
          && Math.min(leftBox.bottom, rightBox.bottom) - Math.max(leftBox.top, rightBox.top) > 2) {
          textOverlaps.push(`${left.tagName}:${left.textContent.trim().slice(0, 20)} / ${right.tagName}:${right.textContent.trim().slice(0, 20)}`);
        }
      }
    }
    const protrusions = [...document.querySelectorAll('body *')]
      .filter(visible)
      .filter((element) => !element.closest('.overflow-x-auto'))
      .map((element) => ({ tag: element.tagName, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.right > viewportWidth + 1);
    const fixedOutside = [...document.querySelectorAll('.fixed')]
      .filter(visible)
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.left < -1 || rect.top < -1 || rect.right > viewportWidth + 1 || rect.bottom > viewportHeight + 1);
    const inaccessibleControls = [...document.querySelectorAll('input,select,textarea')]
      .filter(visible)
      .filter((element) => !element.labels?.length
        && !element.getAttribute('aria-label')
        && !element.getAttribute('aria-labelledby')
        && !element.getAttribute('placeholder'));
    const mediaOverflow = [...document.querySelectorAll('img,video,canvas')]
      .filter(visible)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const parentRect = element.parentElement.getBoundingClientRect();
        return rect.width > parentRect.width + 1
          || ((element.tagName === 'IMG' || element.tagName === 'VIDEO')
            && element.naturalWidth > 0
            && element.naturalHeight > 0
            && getComputedStyle(element).objectFit === 'fill'
            && Math.abs(rect.width / rect.height - element.naturalWidth / element.naturalHeight) > 0.02);
      });
    const formControls = [...document.querySelectorAll('form input:not([type=checkbox]):not([type=radio]),form select,form textarea')]
      .filter(visible)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const field = element.closest('label') || element.parentElement;
        const fieldWidth = field?.getBoundingClientRect().width || rect.width;
        return {
          tag: element.tagName,
          fullWidth: rect.width >= Math.min(fieldWidth * 0.75, fieldWidth - 24),
        };
      });
    const wideTables = [...document.querySelectorAll('table')]
      .filter((table) => table.scrollWidth > 600);
    const tableWrappers = wideTables
      .map((table) => table.parentElement)
      .filter((parent) => parent.scrollWidth > parent.clientWidth + 2).length;
    const undersizedControls = [...document.querySelectorAll('button,input:not([type=checkbox]):not([type=radio]),select,textarea')]
      .filter(visible)
      .filter((element) => element.getBoundingClientRect().height < 40);
    const undersizedLinks = [...document.querySelectorAll('main a')]
      .filter(visible)
      .filter((element) => element.getBoundingClientRect().height < 40)
      .map((element) => element.textContent.trim().slice(0, 30));

    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth,
      bodyFontSize: Number.parseFloat(getComputedStyle(document.body).fontSize),
      clipping,
      textOverlaps,
      protrusions: protrusions.slice(0, 10).map(({ tag, rect }) => ({ tag, right: rect.right })),
      fixedOutside,
      inaccessibleControls: inaccessibleControls.map((element) => element.outerHTML.slice(0, 120)),
      mediaOverflow,
      formControls,
      wideTableCount: wideTables.length,
      tableWrappers,
      undersizedControls: undersizedControls.map((element) => ({ tag: element.tagName, text: element.textContent.trim().slice(0, 30) })),
      undersizedLinks,
    };
  });

  expect(measurements.documentWidth, JSON.stringify(measurements.protrusions)).toBeLessThanOrEqual(measurements.viewportWidth);
  expect(measurements.protrusions, 'visible elements should not protrude past the viewport right edge').toEqual([]);
  expect(measurements.clipping, 'visible text should not be clipped').toEqual([]);
  expect(measurements.textOverlaps, 'sibling text elements should not overlap').toEqual([]);
  expect(measurements.fixedOutside, 'fixed dialogs and drawers should fit the viewport').toEqual([]);
  expect(measurements.inaccessibleControls, 'form controls should have labels or accessible names').toEqual([]);
  expect(measurements.mediaOverflow, 'images and media should scale to their containers').toEqual([]);
  expect(measurements.formControls.filter((control) => !control.fullWidth), 'form inputs should use the available field width').toEqual([]);
  if (viewport.width <= 767) {
    expect(measurements.bodyFontSize, 'mobile body text should be at least 14px').toBeGreaterThanOrEqual(14);
    expect(measurements.undersizedControls, 'mobile controls should be at least 40px tall').toEqual([]);
    expect(measurements.undersizedLinks, 'mobile links should be at least 40px tall').toEqual([]);
  }
  if (viewport.width <= 390 && measurements.wideTableCount > 0) {
    expect(measurements.tableWrappers, 'wide tables should scroll inside their own container').toBeGreaterThan(0);
  }
}

const pages = [
  { name: 'login-sign-in', path: '/login', auth: false, heading: 'OrianaaClub' },
  { name: 'login-forgot-password', path: '/login', auth: false, heading: 'OrianaaClub', action: 'forgot' },
  { name: 'dashboard', path: '/', heading: 'Dashboard' },
  { name: 'members', path: '/members', heading: 'Members' },
  { name: 'member-detail', path: '/members/fixture-member-01', heading: 'Avery Fixture' },
  { name: 'plans', path: '/plans', heading: 'Plans' },
  { name: 'points', path: '/points', heading: 'Points' },
  { name: 'payments', path: '/payments', heading: 'Payments' },
  { name: 'blog-posts', path: '/posts', heading: 'Blog Posts' },
  { name: 'events', path: '/events', heading: 'Events' },
  { name: 'enquiries', path: '/enquiries', heading: 'Enquiries' },
  { name: 'administrators', path: '/admins', heading: 'Administrators' },
  { name: 'reports', path: '/reports', heading: 'Reports' },
  { name: 'audit-log', path: '/audit-log', heading: 'Audit Log' },
  { name: 'email-log', path: '/email-log', heading: 'Email Log' },
  { name: 'open-dialog', path: '/members/fixture-member-01', heading: 'Avery Fixture', action: 'dialog' },
  { name: 'payment-review', path: '/payments', heading: 'Payments', action: 'payment-review' },
];

for (const viewport of viewports) {
  for (const pageCase of pages) {
    test(`${pageCase.name} at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await installApiMocks(page, pageCase.auth !== false);
      await page.goto(pageCase.path);
      await expect(page.locator('h1').first()).toContainText(pageCase.heading);

      if (pageCase.action === 'forgot') {
        await page.getByRole('button', { name: 'Forgot password?' }).click();
        await expect(page.getByRole('button', { name: 'Send reset link' })).toBeVisible();
      } else if (pageCase.action === 'dialog') {
        await page.getByRole('button', { name: 'Suspend' }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.getByRole('button', { name: 'Cancel' }).click();
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await page.getByRole('button', { name: 'Suspend' }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
      } else if (pageCase.action === 'payment-review') {
        await page.getByRole('button', { name: 'Review' }).click();
        const details = page.locator('aside[aria-label="Payment details"]');
        await expect(details).toBeVisible();
        await expect(page.getByRole('img', { name: 'Uploaded bank-transfer proof' })).toBeVisible();
        await page.getByRole('button', { name: 'Close' }).click();
        await expect(details).toHaveCount(0);
        await page.getByRole('button', { name: 'Review' }).click();
        await expect(details).toBeVisible();
      }

      await checkLayout(page, viewport);
      const directory = path.resolve('test-results', 'responsive');
      await fs.mkdir(directory, { recursive: true });
      await page.screenshot({
        path: path.join(directory, `${pageCase.name}-${viewport.width}x${viewport.height}.png`),
        fullPage: true,
        animations: 'disabled',
      });
    });
  }

  test(`sidebar navigation at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await installApiMocks(page);
    await page.goto('/');
    await expect(page.locator('h1').first()).toContainText('Dashboard');

    if (viewport.width < 1024) {
      await page.getByRole('button', { name: 'Open navigation' }).click();
      const drawer = page.locator('.fixed.inset-0.z-40');
      await expect(drawer).toBeVisible();
      await expect(drawer.getByRole('link', { name: 'Members' })).toBeVisible();
      await drawer.getByRole('button', { name: 'Close menu' }).click();
      await expect(drawer).toHaveCount(0);
      await page.getByRole('button', { name: 'Open navigation' }).click();
      await expect(page.locator('.fixed.inset-0.z-40')).toBeVisible();
    } else {
      await expect(page.getByRole('navigation').getByRole('link', { name: 'Members' })).toBeVisible();
    }

    await checkLayout(page, viewport);
    const directory = path.resolve('test-results', 'responsive');
    await fs.mkdir(directory, { recursive: true });
    await page.screenshot({
      path: path.join(directory, `sidebar-navigation-${viewport.width}x${viewport.height}.png`),
      fullPage: true,
      animations: 'disabled',
    });
  });
}
