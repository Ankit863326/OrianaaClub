import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const viewports = [
  { name: '320x740', width: 320, height: 740 },
  { name: '360x740', width: 360, height: 740 },
  { name: '390x844', width: 390, height: 844 },
  { name: '412x844', width: 412, height: 844 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '1280x800', width: 1280, height: 800 },
];

const pages = [
  { name: 'home', path: '/' },
  { name: 'destination', path: '/#destinations' },
  { name: 'experiences', path: '/experiences' },
  { name: 'event', path: '/events' },
  { name: 'blog', path: '/blog' },
  { name: 'membership-benefits', path: '/membership-benefits' },
  { name: 'room-categories', path: '/resorts' },
  { name: 'login', path: '/login' },
  { name: 'activate-legacy-redirect', path: '/activate?token=fixture-activation-token' },
  { name: 'set-password', path: '/set-password?token=fixture-activation-token' },
  { name: 'forgot-password', path: '/forgot-password' },
  { name: 'reset-password', path: '/reset-password?token=fixture-reset-token' },
  { name: 'luxury-membership-step-1', path: '/luxury-membership?step=1' },
  { name: 'luxury-membership-step-2', path: '/luxury-membership?step=2' },
  { name: 'luxury-membership-step-3', path: '/luxury-membership?step=3' },
  { name: 'luxury-membership-step-4', path: '/luxury-membership?step=4' },
  { name: 'luxury-membership-step-5', path: '/luxury-membership?step=5' },
  { name: 'luxury-membership-step-6', path: '/luxury-membership?step=6' },
  { name: 'dashboard', path: '/dashboard', member: true },
];

const fixtureUser = {
  _id: 'fixture-member-id',
  email: 'member@example.test',
  firstName: 'Sample',
  status: 'active',
  emailVerified: true,
};

const fixturePlan = {
  _id: 'fixture-plan-id',
  slug: 'sample-membership',
  name: 'Sample Membership',
  title: 'Sample Membership',
  subtitle: 'A thoughtful stay, made yours',
  price: 100000,
  maxFamilyMembers: 4,
  benefits: [{ points: 50000, label: 'Joining points' }],
};

const respond = (body, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

async function mockApi(page, loggedIn = false) {
  await page.route('**/*', async (route) => {
    const requestUrl = new URL(route.request().url());
    const pathName = requestUrl.pathname;
    if (!pathName.startsWith('/api/')) {
      if (requestUrl.origin === 'http://127.0.0.1:4173') {
        await route.continue();
      } else {
        await route.abort();
      }
      return;
    }

    const path = pathName.slice('/api'.length);
    const method = route.request().method();
    let body = { data: {} };
    let status = 200;

    if (path === '/auth/me') {
      if (loggedIn) body = { user: fixtureUser };
      else {
        body = { message: 'Not signed in' };
        status = 401;
      }
    } else if (path === '/auth/refresh') {
      body = { message: 'No active session' };
      status = 401;
    } else if (path === '/auth/activate/verify') {
      body = { email: 'new-member@example.test', firstName: 'Sample' };
    } else if (path === '/auth/forgot-password') {
      body = { message: 'If your account is eligible, a reset link is on its way.' };
    } else if (path === '/auth/reset-password' || path === '/auth/activate') {
      body = { message: 'The request was completed.' };
    } else if (path === '/member/me') {
      body = {
        data: {
          profile: {
            fullName: 'Sample Member',
            gender: 'female',
            countryCode: '+91',
            mobile: '9000000000',
            dob: '1990-10-14',
            interestArea: 'Luxury Stays',
          },
          membership: {
            _id: 'fixture-membership-id',
            status: 'draft',
            plan: fixturePlan,
          },
          family: [],
        },
      };
    } else if (path === '/plans' || path === '/membership/plans') {
      body = { data: [fixturePlan] };
    } else if (path === '/membership/draft' && method === 'GET') {
      const step = new URL(route.request().url()).searchParams.get('step');
      body = { data: {
        email: 'member@example.test',
        status: step === '6' ? 'payment_submitted' : 'draft',
        paymentMethod: 'bank_transfer',
        profile: {
          fullName: 'Sample Member',
          gender: 'female',
          countryCode: '+91',
          mobile: '9000000000',
          dob: '1990-10-14',
          interestArea: 'Luxury Stays',
        },
        family: [],
        planId: fixturePlan._id,
        identity: { status: 'not_submitted', panMask: '', idType: '', idMask: '', documents: [] },
        emailVerified: true,
      } };
    } else if (path === '/membership/draft/quote') {
      body = { data: {
        planId: fixturePlan._id,
        planFee: 10000000,
        gstEnabled: true,
        gstPercent: 18,
        gstLabel: 'GST',
        gst: 1800000,
        total: 11800000,
        currency: 'INR',
      } };
    } else if (path === '/member/points') {
      body = {
        data: {
          balance: 12500,
          membership: {
            status: 'active',
            memberNumber: 'OC-FIXTURE-01',
            plan: { title: 'Sample Membership', subtitle: 'A thoughtful stay, made yours' },
          },
          history: {
            items: [{
              _id: 'fixture-transaction',
              createdAt: '2026-09-12T10:00:00Z',
              type: 'credit',
              category: 'membership_award',
              reason: 'Joining award',
              amount: 12500,
              balanceAfter: 12500,
            }],
            total: 1,
            page: 1,
            pages: 1,
          },
        },
      };
    } else if (path === '/posts') {
      body = {
        data: {
          items: [{
            _id: 'fixture-post',
            title: 'A Quiet Weekend Away',
            category: 'Wellness',
            excerpt: 'A restorative escape in nature.',
            content: 'An unhurried weekend, thoughtfully planned.',
            publishedAt: '2026-09-12',
          }],
        },
      };
    } else if (path === '/events') {
      body = {
        data: {
          items: [{
            _id: 'fixture-event',
            title: 'A Garden Gathering',
            description: 'A relaxed celebration beneath the trees.',
            date: '2026-11-10',
            time: '6 PM',
            location: 'Pune',
          }],
        },
      };
    } else if (path === '/enquiries' && method === 'POST') {
      body = { success: true, message: 'Thank you. Your enquiry has been sent.' };
    } else if (
      path.startsWith('/member/') ||
      path.startsWith('/payments/') ||
      path.startsWith('/auth/')
    ) {
      body = { data: {}, message: 'Fixture request completed.' };
    }

    await route.fulfill(respond(body, status));
  });
}

async function preparePage(page, loggedIn = false) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockApi(page, loggedIn);
}

async function assertResponsiveLayout(page, { mobile }) {
  const findings = await page.evaluate(() => {
    const width = window.innerWidth;
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity) > 0.05
        && rect.width > 0
        && rect.height > 0;
    };
    const documentWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
    );
    const protrusions = [...document.body.querySelectorAll('*')]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        let ancestor = element;
        let visiblyRendered = true;
        while (ancestor && ancestor !== document.body) {
          const ancestorStyle = getComputedStyle(ancestor);
          if (
            ancestorStyle.display === 'none' ||
            ancestorStyle.visibility === 'hidden' ||
            Number(ancestorStyle.opacity) <= 0.05
          ) {
            visiblyRendered = false;
            break;
          }
          ancestor = ancestor.parentElement;
        }
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          rect.right > width + 1 &&
          visiblyRendered &&
          !element.closest('.login-page__bg, .exp-hero__bg, .mb-hero__bg, .lux-contact__bg-image, .lux-contact__bg-overlay, .gold-wave-watermark, .dashboard-table-wrap, .join-stepper') &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          Number(style.opacity) > 0.05
        );
      })
      .slice(0, 8)
      .map((element) => ({
        tag: element.tagName,
        className: typeof element.className === 'string' ? element.className : '',
        right: Math.round(element.getBoundingClientRect().right),
        width: Math.round(element.getBoundingClientRect().width),
        parent: element.parentElement?.className?.baseVal ?? element.parentElement?.className ?? '',
        parentLeft: Math.round(element.parentElement?.getBoundingClientRect().left || 0),
        parentRight: Math.round(element.parentElement?.getBoundingClientRect().right || 0),
        grandparent: element.parentElement?.parentElement?.className?.baseVal ?? element.parentElement?.parentElement?.className ?? '',
        grandparentRight: Math.round(element.parentElement?.parentElement?.getBoundingClientRect().right || 0),
        ancestors: [element.parentElement, element.parentElement?.parentElement, element.parentElement?.parentElement?.parentElement]
          .filter(Boolean)
          .map((ancestor) => ({
            className: typeof ancestor.className === 'string' ? ancestor.className : '',
            left: Math.round(ancestor.getBoundingClientRect().left),
            right: Math.round(ancestor.getBoundingClientRect().right),
            width: Math.round(ancestor.getBoundingClientRect().width),
          })),
      }));
    const clipping = [...document.querySelectorAll('h1,h2,h3,p,button,a,th,td')]
      .filter(visible)
      .filter((element) => !element.classList.contains('truncate')
          && !element.closest('.overflow-x-auto')
          && !element.closest('table'))
      .filter((element) => {
          const style = getComputedStyle(element);
          const clipsX = ['hidden', 'clip'].includes(style.overflowX)
            && element.scrollWidth > element.clientWidth + 2;
          const clipsY = ['hidden', 'clip'].includes(style.overflowY)
            && element.scrollHeight > element.clientHeight + 2;
          return clipsX || clipsY || (style.textOverflow === 'ellipsis'
            && element.scrollWidth > element.clientWidth + 2);
      })
      .map((element) => `${element.tagName}: ${element.textContent.trim().slice(0, 40)}`);
    const textElements = [...document.querySelectorAll('h1,h2,h3,p,button,a')]
      .filter(visible)
      .filter((element) => !element.closest('.overflow-x-auto'));
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
    const fixedOutside = [...document.querySelectorAll('.fixed')]
      .filter(visible)
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.left < -1 || rect.top < -1 || rect.right > width + 1 || rect.bottom > window.innerHeight + 1);
    const mediaOverflow = [...document.querySelectorAll('img, video, iframe')]
      .filter(visible)
      .filter((element) => {
          const rect = element.getBoundingClientRect();
          let ancestor = element.parentElement;
          let clippedByAncestor = false;
          while (ancestor && ancestor !== document.body) {
            const ancestorStyle = getComputedStyle(ancestor);
            if (['hidden', 'clip'].includes(ancestorStyle.overflowX)) {
              const ancestorRect = ancestor.getBoundingClientRect();
              clippedByAncestor = rect.left < ancestorRect.left || rect.right > ancestorRect.right;
              if (clippedByAncestor) break;
            }
            ancestor = ancestor.parentElement;
          }
          return (((rect.left < -1 || rect.right > width + 1) && !clippedByAncestor)
            || ((element.tagName === 'IMG' || element.tagName === 'VIDEO')
              && element.naturalWidth > 0
              && element.naturalHeight > 0
              && getComputedStyle(element).objectFit === 'fill'
              && Math.abs(rect.width / rect.height - element.naturalWidth / element.naturalHeight) > 0.02));
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          className: element.className,
          objectFit: getComputedStyle(element).objectFit,
          displayRatio: Number((rect.width / rect.height).toFixed(2)),
          sourceRatio: element.naturalWidth && element.naturalHeight
            ? Number((element.naturalWidth / element.naturalHeight).toFixed(2))
            : null,
        };
      });
    const tablesWithoutScroller = [...document.querySelectorAll('table')].filter((table) => {
      if (table.scrollWidth <= table.parentElement.clientWidth) return false;
      let parent = table.parentElement;
      while (parent && parent !== document.body) {
        const overflowX = getComputedStyle(parent).overflowX;
        if (overflowX === 'auto' || overflowX === 'scroll') {
          return false;
        }
        parent = parent.parentElement;
      }
      return table.scrollWidth > table.clientWidth;
    }).length;
    const formControls = [...document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]), select, textarea')]
      .filter((element) => element.getBoundingClientRect().width > 0)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const field = element.closest('label, .form-group, .lux-contact__field-body')
          || element.closest('.form-input-wrap');
        const fieldWidth = field?.getBoundingClientRect().width || rect.width;
        return {
          tag: element.tagName,
          height: Math.round(rect.height),
          fontSize: parseFloat(getComputedStyle(element).fontSize),
          fullWidth: rect.width >= fieldWidth * (element.classList.contains('lux-contact__phone-input') ? 0.4 : 0.75),
          hasLabel: Boolean(element.labels?.length
            || element.getAttribute('aria-label')
            || element.getAttribute('aria-labelledby')
            || element.getAttribute('placeholder')
            || [...(field?.querySelectorAll('label') ?? [])].some((label) => visible(label) && label.textContent.trim())),
        };
      });
    const undersizedButtons = [...document.querySelectorAll('button')]
      .filter(visible)
      .filter((element) => element.getBoundingClientRect().height < 40)
      .map((element) => ({
        text: element.getAttribute('aria-label') || element.textContent.trim().slice(0, 30),
        height: Math.round(element.getBoundingClientRect().height),
        minHeight: getComputedStyle(element).minHeight,
        className: element.className,
      }));
    const undersizedNavigationLinks = [...document.querySelectorAll(
      '.home-nav__links a, .home-nav__mobile-menu a, footer a',
    )]
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return rect.width > 0
          && rect.height < 40
          && style.display !== 'none'
          && style.visibility !== 'hidden'
          && Number(style.opacity) > 0.05;
      })
      .map((element) => element.textContent.trim().slice(0, 30));
    return {
      width,
      documentWidth,
      protrusions,
      clipping,
      textOverlaps,
      fixedOutside,
      mediaOverflow,
      tablesWithoutScroller,
      bodyFontSize: parseFloat(getComputedStyle(document.body).fontSize),
      formControls,
      undersizedButtons,
      undersizedNavigationLinks,
    };
  });

  expect(findings.documentWidth, 'document should not scroll horizontally').toBeLessThanOrEqual(findings.width);
  expect(findings.protrusions, 'visible content should not protrude past the viewport right edge').toEqual([]);
  expect(findings.clipping, 'visible text should not be cut off').toEqual([]);
  expect(findings.textOverlaps, 'visible text should not overlap').toEqual([]);
  expect(findings.fixedOutside, 'fixed drawers and dialogs should fit the viewport').toEqual([]);
  expect(findings.mediaOverflow, 'media should fit within the viewport').toEqual([]);
  expect(findings.tablesWithoutScroller, 'wide tables should use a working internal scroller').toBe(0);

  if (mobile) {
    expect(findings.bodyFontSize, 'mobile body text should remain readable').toBeGreaterThanOrEqual(14);
    for (const control of findings.formControls) {
      expect(control.height, `${control.tag} control should be a comfortable touch target`).toBeGreaterThanOrEqual(40);
      expect(control.fontSize, `${control.tag} should avoid mobile input zoom`).toBeGreaterThanOrEqual(16);
      expect(control.fullWidth, `${control.tag} should use the available form width`).toBe(true);
      expect(control.hasLabel, `${control.tag} should have an associated visible or accessible label: ${JSON.stringify(control)}`).toBe(true);
    }
    expect(findings.undersizedButtons, 'mobile buttons should be at least 40px tall').toEqual([]);
    expect(findings.undersizedNavigationLinks, 'mobile navigation and footer links should be at least 40px tall').toEqual([]);
  }
}

async function saveResponsiveScreenshot(page, pageName, viewportName, state = 'page') {
  const screenshotDirectory = path.resolve('test-results/responsive');
  await mkdir(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: path.join(screenshotDirectory, `${pageName}-${state}-${viewportName}.png`),
    fullPage: true,
    animations: 'disabled',
  });
}

for (const viewport of viewports) {
  test.describe(`responsive ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const pageCase of pages) {
      test(`${pageCase.name} page renders without responsive overflow`, async ({ page }) => {
        await preparePage(page, pageCase.member);
        await page.goto(pageCase.path, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('main, .login-page')).toBeVisible();
        if (pageCase.name === 'activate-legacy-redirect') {
          await expect(page).toHaveURL(/\/set-password\?token=fixture-activation-token$/);
        }
        if (pageCase.name === 'luxury-membership-step-6' && viewport.width < 640) {
          await expect(page.locator('.join-mobile-stepper')).toBeVisible();
          await expect(page.locator('.join-stepper')).toBeHidden();
        }
        if (pageCase.name === 'luxury-membership-step-6' && viewport.width >= 640) {
          await expect(page.locator('.join-stepper')).toBeVisible();
          await expect(page.locator('.join-mobile-stepper')).toBeHidden();
        }
        if (pageCase.name === 'set-password' && viewport.width <= 640) {
          const buttonWidths = await page.evaluate(() => ({
            button: document.querySelector('.login-submit-btn')?.getBoundingClientRect().width || 0,
            form: document.querySelector('.login-form')?.getBoundingClientRect().width || 0,
          }));
          expect(buttonWidths.button).toBeGreaterThanOrEqual(buttonWidths.form - 2);
        }
        await page.waitForTimeout(100);
        await assertResponsiveLayout(page, { mobile: viewport.width <= 767 });
        await saveResponsiveScreenshot(page, pageCase.name, viewport.name);
      });
    }
  });
}

for (const viewport of viewports) {
  test.describe(`experience enquiry form ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('form is usable without responsive overflow', async ({ page }) => {
      await preparePage(page);
      await page.goto('/tests/responsive/experience-inquiry-harness.html', {
        waitUntil: 'domcontentloaded',
      });
      await expect(page.getByRole('heading', { name: 'Request an Exclusive Experience' })).toBeVisible();
      await assertResponsiveLayout(page, { mobile: viewport.width <= 767 });
      await saveResponsiveScreenshot(page, 'experience-inquiry', viewport.name);
    });
  });

  test.describe(`responsive shared states ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('navbar opens and closes on mobile', async ({ page }) => {
      test.skip(viewport.width > 1100, 'The mobile navigation is shown at narrower widths.');
      await preparePage(page);
      await page.goto('/');
      const menuToggle = page.getByRole('button', { name: 'Open navigation' });
      await expect(menuToggle).toBeVisible();
      await menuToggle.click();
      await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toHaveClass(/is-open/);
      await assertResponsiveLayout(page, { mobile: viewport.width <= 767 });
      await saveResponsiveScreenshot(page, 'home', viewport.name, 'navbar-open');
      await page.getByRole('button', { name: 'Close navigation' }).click();
      await expect(page.locator('.home-nav__mobile-menu')).not.toHaveClass(/is-open/);
      await saveResponsiveScreenshot(page, 'home', viewport.name, 'navbar-closed');
    });

    test('contact drawer and enquiry form fit the viewport', async ({ page }) => {
      await preparePage(page);
      await page.goto('/#enquiry');
      const openDrawer = page.getByRole('button', { name: /get in touch/i });
      await expect(openDrawer).toBeVisible();
      await openDrawer.click();
      await expect(page.getByRole('heading', { name: 'Get In Touch' })).toBeVisible();
      await assertResponsiveLayout(page, { mobile: viewport.width <= 767 });
      await saveResponsiveScreenshot(page, 'home', viewport.name, 'contact-drawer');
      await page.getByLabel('Full name').fill('Sample Visitor');
      await page.getByLabel('Email Id').fill('visitor@example.test');
      await page.getByLabel('Mobile no.').fill('9000000000');
      await page.getByLabel('Date of Birth').fill('1990-10-14');
      await page.locator('label[for="lux-agree"]').click();
      await page.getByRole('button', { name: 'Submit' }).click();
      await expect(page.getByRole('heading', { name: 'Your enquiry is with us.' })).toBeVisible();
      await page.getByRole('button', { name: 'Close', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Get In Touch' })).toBeHidden();
    });

    test('footer and back-to-top remain reachable', async ({ page }) => {
      await preparePage(page);
      await page.goto('/');
      await page.locator('footer').scrollIntoViewIfNeeded();
      await expect(page.locator('footer')).toBeVisible();
      await assertResponsiveLayout(page, { mobile: viewport.width <= 767 });
      await saveResponsiveScreenshot(page, 'home', viewport.name, 'footer');
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const backToTop = page.getByRole('button', { name: 'Back to top' });
      await expect(backToTop).toBeVisible();
      const coveredButtons = await page.evaluate(() => {
        const floating = document.querySelector('button[aria-label="Back to top"]');
        const floatingRect = floating.getBoundingClientRect();
        return [...document.querySelectorAll('button')]
          .filter((button) => button !== floating)
          .filter((button) => {
            const style = getComputedStyle(button);
            const rect = button.getBoundingClientRect();
            return style.display !== 'none'
              && style.visibility !== 'hidden'
              && Number(style.opacity) > 0.05
              && rect.width > 0
              && rect.height > 0
              && Math.min(rect.right, floatingRect.right) - Math.max(rect.left, floatingRect.left) > 2
              && Math.min(rect.bottom, floatingRect.bottom) - Math.max(rect.top, floatingRect.top) > 2;
          })
          .map((button) => button.getAttribute('aria-label') || button.textContent.trim().slice(0, 30));
      });
      expect(coveredButtons, 'Back to Top should not cover another button').toEqual([]);
      await backToTop.click();
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(20);
      await saveResponsiveScreenshot(page, 'home', viewport.name, 'back-to-top');
    });
  });
}
