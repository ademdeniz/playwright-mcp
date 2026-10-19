import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Page object for https://the-internet.herokuapp.com/login and the /secure
 * area behind it. Selectors and flash messages verified against the live site.
 */
export class LoginPage {
  readonly username: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly flash: Locator;
  readonly logout: Locator;
  readonly secureHeading: Locator;

  constructor(private readonly page: Page) {
    this.username = page.locator('#username');
    this.password = page.locator('#password');
    this.submit = page.locator('button[type="submit"]');
    this.flash = page.locator('#flash');
    this.logout = page.locator('a[href="/logout"]');
    // exact: true — the login page's own subheader ("...log into the secure
    // area.") would otherwise match this role+name substring.
    this.secureHeading = page.getByRole('heading', { name: 'Secure Area', exact: true });
  }

  async goto() {
    await this.page.goto('/login');
  }

  async gotoSecure() {
    await this.page.goto('/secure');
  }

  async login(user: string, pass: string) {
    await this.username.fill(user);
    await this.password.fill(pass);
    await this.submit.click();
  }

  async loginAsValidUser() {
    await this.login(CREDENTIALS.username, CREDENTIALS.password);
    await expect(this.secureHeading).toBeVisible();
  }

  async expectFlash(message: string) {
    await expect(this.flash).toContainText(message);
  }

  async expectOnLoginPage() {
    await expect(this.page).toHaveURL(/\/login$/);
  }

  async expectOnSecurePage() {
    await expect(this.page).toHaveURL(/\/secure$/);
  }
}

export const CREDENTIALS = {
  username: 'tomsmith',
  password: 'SuperSecretPassword!',
} as const;

export const FLASH = {
  loggedIn: 'You logged into a secure area!',
  loggedOut: 'You logged out of the secure area!',
  mustLogin: 'You must login to view the secure area!',
  badUsername: 'Your username is invalid!',
  badPassword: 'Your password is invalid!',
} as const;
