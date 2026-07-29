// @ts-check
/**
 * @file playwright/pages/HostedServersPage.js
 *
 * Copyright (c) 2014-2026 Simon Fraser University
 * Copyright (c) 2003-2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * The OLDER of *Users management*'s two surfaces: Administration → Hosted
 * Servers → a server's settings wizard → the "Users" tab. It is a site
 * administrator's screen only, and it is the one place in the application where
 * an account can be CREATED outright ("Add User"); the Users & Roles list offers
 * no such thing — new people are invited there.
 *
 * Everything here is the legacy jQuery grid stack, which has its own manners:
 *
 * - **Row actions hide in a following-sibling row.** A grid row's controls are
 *   emitted in a `-control-row` `<tr>` immediately after it, hidden until the
 *   row's own "Settings" expander (`a.show_extras`) is clicked. That is true of
 *   the Hosted Servers rows and of the Users grid rows alike.
 * - **The way into a server's settings is "Settings wizard".** The collapsed row
 *   shows only the expander, whose screen-reader text is "Settings"; expanding it
 *   reveals three actions — Edit · Remove · Settings wizard — of which the last
 *   is the door.
 * - **These pages answer at the SITE's address only.** `/index/admin/wizard/{id}`
 *   works; the same path typed after a server's own address is refused.
 *
 * OPS-local: the vocabulary is the app's own ("Hosted Servers", the five roles
 * a preprint server ships, "Server Registration" as the welcome mail's subject).
 */

const {BasePage} = require('../../lib/pkp/playwright/pages/BasePage.js');

class HostedServersPage extends BasePage {
	/** @param {import('@playwright/test').Page} page */
	constructor(page) {
		super(page);

		this.hostedServersLink = page.getByRole('link', {name: /Hosted Servers/});

		// The settings wizard, once reached.
		this.usersTabButton = page.locator('#users-button');
		this.usersGrid = page.locator('#userGridContainer');
		this.usersGridHeading = this.usersGrid.locator('.header h4');
		this.gridActions = this.usersGrid.locator('.header ul.actions a');
		this.addUserLink = this.gridActions.filter({hasText: 'Add User'});

		// The account form, in the side modal "Add User" opens.
		this.accountForm = page.locator('#userDetailsFormContainer');
		this.accountFormHeading = this.accountForm.locator('h3');
		this.notifyUserCheckbox = page.locator('#sendNotify');

		// Step 2, once the details are saved.
		this.roleForm = page.locator('#userRoleForm');
		this.roleFormHeading = this.roleForm.locator('h3');
		/** Two lists in this order: "User Roles", then "Appear on Masthead". */
		this.roleLists = this.roleForm.locator('ul.checkbox_and_radiobutton');
	}

	static administrationUrl() {
		return BasePage.siteUrl('/admin');
	}

	async gotoAdministration() {
		await this.page.goto(HostedServersPage.administrationUrl());
	}

	/** Administration → Hosted Servers. */
	async openHostedServers() {
		await this.hostedServersLink.click();
		await this.page.waitForURL(/\/admin\/contexts/);
	}

	/**
	 * A row of the Hosted Servers list, by the server's url path.
	 *
	 * @param {string} urlPath
	 */
	serverRow(urlPath) {
		return this.page.locator('tr.gridRow').filter({hasText: urlPath});
	}

	/**
	 * Expand a server's row and take its "Settings wizard" action, landing on the
	 * settings pages this feature's second surface lives in.
	 *
	 * The grid pages at 25 rows and orders servers oldest first, so on a
	 * long-lived test database a freshly seeded server sits on the LAST page.
	 * When it is not on the page in view, the grid's own "last page" link is
	 * taken — the same click an administrator would make. On a database with one
	 * page this is a no-op.
	 *
	 * @param {string} urlPath
	 */
	async openSettingsWizard(urlPath) {
		await this.page.locator('tr.gridRow').first().waitFor();

		if ((await this.serverRow(urlPath).count()) === 0) {
			const lastPage = this.page
				.locator('.gridPages a')
				.filter({hasText: '>>'})
				.last();

			if (await lastPage.count()) {
				await lastPage.click();
			}
		}

		const row = this.serverRow(urlPath);

		await row.waitFor();
		await row.locator('a.show_extras').click();
		await row
			.locator('xpath=following-sibling::tr[1]')
			.locator('a')
			.filter({hasText: 'Settings wizard'})
			.click();
		await this.page.waitForURL(/\/admin\/wizard\/\d+/);
	}

	async openUsersTab() {
		await this.usersTabButton.click();
		await this.usersGrid.waitFor();
	}

	/**
	 * A row of the Users grid, by any text it carries (a username or address).
	 *
	 * @param {string} text
	 */
	userRow(text) {
		return this.usersGrid.locator('tr.gridRow').filter({hasText: text});
	}

	/** Open "Add User" and wait for step 1 of the account form. */
	async openAddUser() {
		await this.addUserLink.click();
		await this.accountForm.waitFor();
	}

	/**
	 * Fill step 1 of the account form and save it.
	 *
	 * Given Name is per-locale (`givenName[en]`); the rest are plain. Country is
	 * left alone deliberately — it is optional, and a save without it is part of
	 * what this exercises.
	 *
	 * @param {{givenName: string, username: string, email: string,
	 *   password: string, notify?: boolean}} details
	 */
	async fillAccountDetails({givenName, username, email, password, notify = false}) {
		await this.accountForm.locator('input[name="givenName[en]"]').fill(givenName);
		await this.accountForm.locator('input[name=username]').fill(username);
		await this.accountForm.locator('input[name=email]').fill(email);
		await this.accountForm.locator('input[name=password]').fill(password);
		await this.accountForm.locator('input[name=password2]').fill(password);

		if (notify) {
			await this.notifyUserCheckbox.check();
		}

		await this.accountForm.getByRole('button', {name: 'OK', exact: true}).click();
		await this.roleForm.waitFor();
	}

	/**
	 * The role labels the "User Roles" list offers — a preprint server's own five.
	 *
	 * The list carries its own group label ("User Roles") among the row labels,
	 * so that one is dropped.
	 */
	async offeredRoles() {
		const labels = await this.roleLists.first().locator('label').allTextContents();

		return labels
			.map((label) => label.replace(/\s+/g, ' ').trim())
			.filter((label) => label && label !== 'User Roles');
	}

	/**
	 * Tick a role in the "User Roles" list and save step 2.
	 *
	 * @param {string} role
	 */
	async assignRole(role) {
		await this.roleLists.first().getByText(role, {exact: true}).click();
		await this.roleForm.getByRole('button', {name: 'Save', exact: true}).click();
		await this.roleForm.waitFor({state: 'hidden'});
	}
}

module.exports = {HostedServersPage};
