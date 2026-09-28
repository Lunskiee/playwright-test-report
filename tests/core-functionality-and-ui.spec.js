const { test, expect } = require('@playwright/test');

const BASE_URL = 'https://www.saucedemo.com';
const VALID_USER = 'standard_user';
const VALID_PASS = 'secret_sauce';
const LOCKED_USER = 'locked_out_user';

async function performLogin(page, username = VALID_USER, password = VALID_PASS) {
  await page.goto('/');
  await page.locator('[data-test="username"]').fill(username);
  await page.locator('[data-test="password"]').fill(password);
  await page.locator('[data-test="login-button"]').click();
}

test.describe('Part 1: Core Functionality Test Suite (10 Functional Checks)', () => {

  test('TC-FUNC-01: Valid User Authentication & Session Establishment', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-test="username"]').fill(VALID_USER);
    await page.locator('[data-test="password"]').fill(VALID_PASS);
    await page.locator('[data-test="login-button"]').click();

    await expect(page).toHaveURL(/.*\/inventory.html/);
    await expect(page.locator('.title')).toHaveText('Products');
    await expect(page.locator('.inventory_list')).toBeVisible();

    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === 'session-username');
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.value).toBe(VALID_USER);
  });

  test('TC-FUNC-02: Negative Authentication & Dynamic Error Handling', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-test="username"]').fill(LOCKED_USER);
    await page.locator('[data-test="password"]').fill(VALID_PASS);
    await page.locator('[data-test="login-button"]').click();

    const errorBanner = page.locator('[data-test="error"]');
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toContainText('Epic sadface: Sorry, this user has been locked out.');
    
    await expect(page).toHaveURL(`${BASE_URL}/`);
  });

  test('TC-FUNC-03: Product Catalog Dynamic Sorting (Low to High & High to Low)', async ({ page }) => {
    await performLogin(page);
    const sortDropdown = page.locator('[data-test="product-sort-container"]');

    await sortDropdown.selectOption('lohi');
    const pricesLowToHighRaw = await page.locator('.inventory_item_price').allTextContents();
    const pricesLowToHigh = pricesLowToHighRaw.map(p => parseFloat(p.replace('$', '')));
    const sortedLowToHigh = [...pricesLowToHigh].sort((a, b) => a - b);
    expect(pricesLowToHigh).toEqual(sortedLowToHigh);

    await sortDropdown.selectOption('hilo');
    const pricesHighToLowRaw = await page.locator('.inventory_item_price').allTextContents();
    const pricesHighToLow = pricesHighToLowRaw.map(p => parseFloat(p.replace('$', '')));
    const sortedHighToLow = [...pricesHighToLow].sort((a, b) => b - a);
    expect(pricesHighToLow).toEqual(sortedHighToLow);
  });

  test('TC-FUNC-04: Cart State Management (Add Items & Counter Update)', async ({ page }) => {
    await performLogin(page);
    
    await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    await page.locator('[data-test="add-to-cart-sauce-labs-bike-light"]').click();

    const badge = page.locator('.shopping_cart_badge');
    await expect(badge).toHaveText('2');

    await page.locator('.shopping_cart_link').click();
    await expect(page).toHaveURL(/.*\/cart.html/);
    
    const cartItems = page.locator('.cart_item');
    await expect(cartItems).toHaveCount(2);
    await expect(page.locator('.inventory_item_name')).toContainText([
      'Sauce Labs Backpack',
      'Sauce Labs Bike Light'
    ]);
  });

  test('TC-FUNC-05: Item Removal & Dynamic Cart State Synchronization', async ({ page }) => {
    await performLogin(page);

    await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    await page.locator('[data-test="add-to-cart-sauce-labs-bike-light"]').click();
    await expect(page.locator('.shopping_cart_badge')).toHaveText('2');

    await page.locator('[data-test="remove-sauce-labs-backpack"]').click();
    await expect(page.locator('.shopping_cart_badge')).toHaveText('1');

    await page.locator('.shopping_cart_link').click();
    await page.locator('[data-test="remove-sauce-labs-bike-light"]').click();

    await expect(page.locator('.cart_item')).toHaveCount(0);
    await expect(page.locator('.shopping_cart_badge')).toHaveCount(0);
  });

  test('TC-FUNC-06: Checkout Information Form Validation & Step Progression', async ({ page }) => {
    await performLogin(page);
    await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    await page.locator('.shopping_cart_link').click();
    await page.locator('[data-test="checkout"]').click();

    await expect(page).toHaveURL(/.*\/checkout-step-one.html/);

    await page.locator('[data-test="continue"]').click();
    await expect(page.locator('[data-test="error"]')).toContainText('Error: First Name is required');

    await page.locator('[data-test="firstName"]').fill('Nashville');
    await page.locator('[data-test="lastName"]').fill('Tester');
    await page.locator('[data-test="postalCode"]').fill('10001');
    await page.locator('[data-test="continue"]').click();

    await expect(page).toHaveURL(/.*\/checkout-step-two.html/);
    await expect(page.locator('.title')).toHaveText('Checkout: Overview');
  });

  test('TC-FUNC-07: Dynamic Financial Calculation & Order Summary Verification', async ({ page }) => {
    await performLogin(page);
    await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    await page.locator('[data-test="add-to-cart-sauce-labs-bolt-t-shirt"]').click();
    await page.locator('.shopping_cart_link').click();
    await page.locator('[data-test="checkout"]').click();

    await page.locator('[data-test="firstName"]').fill('John');
    await page.locator('[data-test="lastName"]').fill('Doe');
    await page.locator('[data-test="postalCode"]').fill('90210');
    await page.locator('[data-test="continue"]').click();

    const itemTotalText = await page.locator('.summary_subtotal_label').innerText();
    const taxText = await page.locator('.summary_tax_label').innerText();
    const totalText = await page.locator('.summary_total_label').innerText();

    const itemTotal = parseFloat(itemTotalText.replace('Item total: $', ''));
    const tax = parseFloat(taxText.replace('Tax: $', ''));
    const total = parseFloat(totalText.replace('Total: $', ''));

    expect(itemTotal).toBeCloseTo(29.99 + 15.99, 2);
    expect(total).toBeCloseTo(itemTotal + tax, 2);
  });

  test('TC-FUNC-08: Complete Order Dispatch & Post-Checkout State Reset', async ({ page }) => {
    await performLogin(page);
    await page.locator('[data-test="add-to-cart-sauce-labs-onesie"]').click();
    await page.locator('.shopping_cart_link').click();
    await page.locator('[data-test="checkout"]').click();

    await page.locator('[data-test="firstName"]').fill('Alice');
    await page.locator('[data-test="lastName"]').fill('Smith');
    await page.locator('[data-test="postalCode"]').fill('60601');
    await page.locator('[data-test="continue"]').click();

    await page.locator('[data-test="finish"]').click();
    await expect(page).toHaveURL(/.*\/checkout-complete.html/);

    await expect(page.locator('.complete-header')).toHaveText('Thank you for your order!');
    await expect(page.locator('.complete-text')).toContainText('Your order has been dispatched');

    await expect(page.locator('.shopping_cart_badge')).toHaveCount(0);
  });

  test('TC-FUNC-09: Navigation Drawer & Session Logout Lifecycle', async ({ page }) => {
    await performLogin(page);

    await page.locator('#react-burger-menu-btn').click();
    const logoutLink = page.locator('#logout_sidebar_link');
    await expect(logoutLink).toBeVisible();

    await logoutLink.click();

    await expect(page).toHaveURL(`${BASE_URL}/`);
    await expect(page.locator('[data-test="login-button"]')).toBeVisible();

    await page.goBack();
    await expect(page.locator('[data-test="login-button"]')).toBeVisible();
  });

  test('TC-FUNC-10: Route Guard & Direct Access Restriction to Protected Pages', async ({ page }) => {
    await page.goto('/inventory.html');

    await expect(page).toHaveURL(`${BASE_URL}/`);
    const errorMsg = page.locator('[data-test="error"]');
    await expect(errorMsg).toBeVisible();
    await expect(errorMsg).toContainText("You can only access '/inventory.html' when you are logged in.");
  });

});

test.describe('Part 2: UI & Visual Presentation Suite (10 UI Checks)', () => {

  test('TC-UI-01: Visual Branding & Header Logo Asset Rendering', async ({ page }) => {
    await page.goto('/');
    
    const loginLogo = page.locator('.login_logo');
    await expect(loginLogo).toBeVisible();
    await expect(loginLogo).toHaveText('Swag Labs');

    await performLogin(page);
    const appLogo = page.locator('.app_logo');
    await expect(appLogo).toBeVisible();
    await expect(appLogo).toHaveText('Swag Labs');
  });

  test('TC-UI-02: Input Fields Placeholder Text & Type Attributes', async ({ page }) => {
    await page.goto('/');

    const usernameInput = page.locator('[data-test="username"]');
    const passwordInput = page.locator('[data-test="password"]');
    const loginBtn = page.locator('[data-test="login-button"]');

    await expect(usernameInput).toHaveAttribute('placeholder', 'Username');
    await expect(usernameInput).toHaveAttribute('type', 'text');
    await expect(usernameInput).toHaveAttribute('autocapitalize', 'none');

    await expect(passwordInput).toHaveAttribute('placeholder', 'Password');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    await expect(loginBtn).toHaveAttribute('type', 'submit');
    await expect(loginBtn).toHaveAttribute('value', 'Login');
  });

  test('TC-UI-03: Error Notification Banner Styling & Error Indicators', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-test="login-button"]').click();

    const errorContainer = page.locator('.error-message-container');
    await expect(errorContainer).toBeVisible();
    await expect(errorContainer).toHaveClass(/error/);

    const errorIcons = page.locator('svg.error_icon');
    await expect(errorIcons).toHaveCount(2);
  });

  test('TC-UI-04: Product Card Grid Visual Structure & Component Integrity', async ({ page }) => {
    await performLogin(page);

    const inventoryList = page.locator('.inventory_list');
    await expect(inventoryList).toBeVisible();

    const items = page.locator('.inventory_item');
    await expect(items).toHaveCount(6);

    const firstItem = items.first();
    await expect(firstItem.locator('img.inventory_item_img')).toBeVisible();
    await expect(firstItem.locator('.inventory_item_name')).toBeVisible();
    await expect(firstItem.locator('.inventory_item_desc')).toBeVisible();
    await expect(firstItem.locator('.inventory_item_price')).toBeVisible();
    await expect(firstItem.locator('button.btn_inventory')).toBeVisible();

    const imgSrc = await firstItem.locator('img.inventory_item_img').getAttribute('src');
    expect(imgSrc).toBeTruthy();
  });

  test('TC-UI-05: Shopping Cart Badge Dynamic Visibility & Visual Presentation', async ({ page }) => {
    await performLogin(page);

    const cartLink = page.locator('.shopping_cart_link');
    await expect(cartLink).toBeVisible();

    await expect(page.locator('.shopping_cart_badge')).toHaveCount(0);

    await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    const badge = page.locator('.shopping_cart_badge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('1');
  });

  test('TC-UI-06: Button Interactive State Transformation (Add to Cart -> Remove)', async ({ page }) => {
    await performLogin(page);

    const btnBackpack = page.locator('[data-test="add-to-cart-sauce-labs-backpack"]');
    await expect(btnBackpack).toHaveText('Add to cart');
    await expect(btnBackpack).toHaveClass(/btn_primary/);

    await btnBackpack.click();

    const btnRemove = page.locator('[data-test="remove-sauce-labs-backpack"]');
    await expect(btnRemove).toBeVisible();
    await expect(btnRemove).toHaveText('Remove');
    await expect(btnRemove).toHaveClass(/btn_secondary/);
  });

  test('TC-UI-07: Responsive Layout & Mobile Viewport Adaptation', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await performLogin(page);

    const burgerBtn = page.locator('#react-burger-menu-btn');
    await expect(burgerBtn).toBeVisible();
    
    const cartContainer = page.locator('.shopping_cart_container');
    await expect(cartContainer).toBeVisible();

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.locator('.inventory_list')).toBeVisible();
  });

  test('TC-UI-08: Header and Footer Structural Component Rendering', async ({ page }) => {
    await performLogin(page);

    await expect(page.locator('.primary_header')).toBeVisible();
    await expect(page.locator('#react-burger-menu-btn')).toBeVisible();
    await expect(page.locator('.shopping_cart_link')).toBeVisible();

    const footer = page.locator('.footer');
    await expect(footer).toBeVisible();
    await expect(footer.locator('.footer_copy')).toContainText('Sauce Labs. All Rights Reserved.');

    const socialLinks = page.locator('ul.social li a');
    await expect(socialLinks).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      await expect(socialLinks.nth(i)).toBeVisible();
      await expect(socialLinks.nth(i)).toHaveAttribute('target', '_blank');
    }
  });

  test('TC-UI-09: Typography Hierarchy & Currency Formatting Validation', async ({ page }) => {
    await performLogin(page);

    const pageTitle = page.locator('.title');
    await expect(pageTitle).toBeVisible();
    await expect(pageTitle).toHaveText('Products');

    const priceLabels = await page.locator('.inventory_item_price').allTextContents();
    expect(priceLabels.length).toBeGreaterThan(0);
    
    const priceRegex = /^\$\d+\.\d{2}$/;
    for (const price of priceLabels) {
      expect(price).toMatch(priceRegex);
    }
  });

  test('TC-UI-10: Navigation Drawer Visual Presentation & Component State', async ({ page }) => {
    await performLogin(page);

    const burgerBtn = page.locator('#react-burger-menu-btn');
    await burgerBtn.click();

    const menuWrap = page.locator('.bm-menu-wrap');
    await expect(menuWrap).toBeVisible();
    await expect(menuWrap).toHaveAttribute('aria-hidden', 'false');

    const menuLinks = [
      { locator: page.locator('#inventory_sidebar_link'), text: 'All Items' },
      { locator: page.locator('#about_sidebar_link'), text: 'About' },
      { locator: page.locator('#logout_sidebar_link'), text: 'Logout' },
      { locator: page.locator('#reset_sidebar_link'), text: 'Reset App State' },
    ];

    for (const item of menuLinks) {
      await expect(item.locator).toBeVisible();
      await expect(item.locator).toHaveText(item.text);
    }

    const closeBtn = page.locator('#react-burger-cross-btn');
    await closeBtn.click();
    await expect(menuWrap).toHaveAttribute('aria-hidden', 'true');
  });

});
