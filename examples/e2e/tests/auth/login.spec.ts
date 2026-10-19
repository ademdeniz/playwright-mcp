import { expect, test } from '@playwright/test';
import { CREDENTIALS, FLASH, LoginPage } from '../../pages/LoginPage';

/**
 * P1 scenarios from docs/test-plans/login.md (LOGIN-1 .. LOGIN-5).
 * Each test maps 1:1 to a case ID in that plan.
 */
test.describe('Login', () => {
  test.beforeEach(async ({ page }) => {
    // Guarantee a logged-out starting state; /logout always lands on /login.
    await page.goto('/logout');
  });

  test('LOGIN-1 @smoke valid credentials land on the secure area', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(CREDENTIALS.username, CREDENTIALS.password);

    await login.expectOnSecurePage();
    await login.expectFlash(FLASH.loggedIn);
    await expect(login.secureHeading).toBeVisible();
  });

  test('LOGIN-2 @smoke secure area is protected when logged out', async ({ page }) => {
    const login = new LoginPage(page);
    await login.gotoSecure();

    await login.expectOnLoginPage();
    await login.expectFlash(FLASH.mustLogin);
  });

  test('LOGIN-3 @smoke valid username with wrong password is rejected', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(CREDENTIALS.username, 'WrongPassword!');

    await login.expectOnLoginPage();
    await login.expectFlash(FLASH.badPassword);
    await expect(login.secureHeading).toBeHidden();
  });

  test('LOGIN-4 @smoke unknown username is rejected', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login('nosuchuser', CREDENTIALS.password);

    await login.expectOnLoginPage();
    await login.expectFlash(FLASH.badUsername);
    await expect(login.secureHeading).toBeHidden();
  });

  test('LOGIN-5 @smoke logout ends the session', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.loginAsValidUser();

    await login.logout.click();
    await login.expectOnLoginPage();
    await login.expectFlash(FLASH.loggedOut);

    // The session must really be gone, not just navigated away from.
    await login.gotoSecure();
    await login.expectOnLoginPage();
    await login.expectFlash(FLASH.mustLogin);
  });
});
