// @ts-check
/**
 * @file playwright/pages/InvitationWizardPage.js
 *
 * Copyright (c) 2014-2026 Simon Fraser University
 * Copyright (c) 2003-2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * The send-invitation wizard, "Invite user to take a role":
 *
 *   invite mode    /{ctx}/invitation/create/userRoleAssignment   3 steps
 *   edit mode      /{ctx}/invitation/edit/{id}                   2 steps (no search)
 *   edit-user mode /{ctx}/management/settings/user/{userId}      the page the
 *                                                                users list's row
 *                                                                "Edit" opens
 *
 * The third is where *Users management* (U53) meets this page: the row's "Edit"
 * lands on the same details step, preloaded with the account, and its roles
 * table is the only screen that drives U53's single-role operations (its Rule 8)
 * — "Remove Role" per row, and the Server Masthead selector beside it.
 *
 * Both modes share every control, so the step-numbered headings are matched with
 * `STEP \d+` — in edit mode "Enter details" is step 1 and the composer step 2.
 *
 * Two things learned by watching the live wizard, both encoded here:
 *
 * - The "Server Masthead" select renders EMPTY (no option selected, no
 *   placeholder) and holds no value until one is chosen; leaving it alone fails
 *   the step with "This field is required." An earlier note here claimed it
 *   looks pre-filled with "Appear on the masthead" — a top-up probe on
 *   2026-07-28 disproved that on both OPS and OJS.
 * - Controls in a role row added by "Add Another Role" carry NO accessible name
 *   — only the first row's do — so rows are addressed by their form-field names
 *   (`userGroupId` / `dateStart` / `masthead`), not by role+label.
 */

const {BasePage} = require('../../lib/pkp/playwright/pages/BasePage.js');

class InvitationWizardPage extends BasePage {
	/** @param {import('@playwright/test').Page} page */
	constructor(page) {
		super(page);

		this.pageHeading = page.getByRole('heading', {
			name: 'Invite user to take a role',
			level: 1,
		});

		// Step 1 (invite mode only) — Search User.
		this.searchStepHeading = page.getByRole('heading', {
			name: /^STEP \d+ - Search User$/,
		});
		this.searchField = page.getByRole('textbox', {
			name: /^Search for a user by email address/,
		});
		this.searchButton = page.getByRole('button', {
			name: 'Search User',
			exact: true,
		});

		// Step 2 — Enter details and invite for roles.
		this.detailsStepHeading = page.getByRole('heading', {
			name: /^STEP \d+ - Enter details and invite for roles$/,
		});
		this.newcomerNotice = page.getByText(
			'The user does not have a role in this server',
		);
		this.existingUserNotice = page.getByText(
			'The user already exists in the server',
		);
		this.emailField = page.getByRole('textbox', {name: /^Email/});
		this.givenNameField = page.getByRole('textbox', {name: 'Given Name'});
		this.familyNameField = page.getByRole('textbox', {name: 'Family Name'});
		this.roleTable = page.locator('main table').first();
		/** Rows offering a role to ADD (an existing user's current roles have no role select). */
		this.newRoleRows = this.roleTable
			.locator('tbody tr')
			.filter({has: page.locator('select[name="userGroupId"]')});
		this.addAnotherRoleButton = page.getByRole('button', {
			name: 'Add Another Role',
		});
		this.saveAndContinueButton = page.getByRole('button', {
			name: 'Save And Continue',
			exact: true,
		});

		// Step 3 — the email composer (whose tab still reads "Review & invite for roles").
		this.composerHeading = page.getByRole('heading', {
			name: /^STEP \d+ - Modify email shared with the user$/,
		});
		this.templateResults = page.getByRole('list', {name: 'Search Results'});
		this.subjectField = page.getByRole('textbox', {name: 'Subject'});
		this.bodyEditor = page
			.frameLocator('iframe[title="Rich Text Area"]')
			.locator('body');
		this.sendButton = page.getByRole('button', {
			name: 'Invite user to the role',
			exact: true,
		});
		this.sentDialog = page.getByRole('dialog', {name: 'Invitation Sent'});
	}

	/** @param {string} contextPath */
	static createUrl(contextPath) {
		return BasePage.contextUrl(
			contextPath,
			'/invitation/create/userRoleAssignment',
		);
	}

	/** @param {string} contextPath */
	async gotoCreate(contextPath) {
		await this.page.goto(InvitationWizardPage.createUrl(contextPath));
		await this.searchStepHeading.waitFor();
	}

	/**
	 * Run the search step. The wizard decides the next step's shape from the
	 * result: a role-holder in THIS server gets the read-only identity panel,
	 * anyone else the blank newcomer form.
	 *
	 * @param {string} term email address, username or ORCID iD
	 */
	async search(term) {
		await this.searchField.fill(term);
		await this.searchButton.click();
		await this.detailsStepHeading.waitFor();
	}

	/**
	 * Fill one role row of the "Enter details" step.
	 *
	 * @param {number} index position among the rows offering a role to add
	 * @param {{role: string, startDate: string, masthead?: string}} values
	 */
	async fillRoleRow(index, {role, startDate, masthead = 'Appear on the masthead'}) {
		const row = this.newRoleRows.nth(index);

		await row.locator('select[name="userGroupId"]').selectOption({label: role});
		await row.locator('input[name="dateStart"]').fill(startDate);
		await row.locator('select[name="masthead"]').selectOption({label: masthead});
	}

	/** Role labels the row at `index` offers. */
	async roleOptions(index = 0) {
		return this.newRoleRows
			.nth(index)
			.locator('select[name="userGroupId"] option')
			.allTextContents();
	}

	/**
	 * Leave the details step for the composer, and wait until the template has
	 * loaded into the editor — a send fired before that posts an empty body.
	 */
	async continueToComposer() {
		await this.saveAndContinueButton.click();
		await this.composerHeading.waitFor();
		await this.bodyEditor.getByText('Invitation to New Role').waitFor();
	}

	/** Send the invitation and wait for the "Invitation Sent" dialog. */
	async send() {
		await this.sendButton.click();
		await this.sentDialog.waitFor();
	}

	//
	// Edit-user mode — the page the Users & Roles row's "Edit" opens
	//

	/**
	 * @param {string} contextPath
	 * @param {number} userId
	 */
	static editUserUrl(contextPath, userId) {
		return BasePage.contextUrl(
			contextPath,
			`/management/settings/user/${userId}`,
		);
	}

	/**
	 * A row of the roles table, by role label.
	 *
	 * @param {string} role e.g. "Moderator", "Reader"
	 */
	roleRow(role) {
		return this.roleTable.locator('tbody tr').filter({hasText: role});
	}

	/** The confirmation "Remove Role" opens. */
	get removeRoleDialog() {
		return this.page
			.locator('[role=dialog]')
			.filter({hasText: 'Are you sure you want to remove this role?'});
	}

	/**
	 * End ONE of the user's roles — U53 Rule 8a. It takes effect immediately, on
	 * this page, before any invitation business is saved.
	 *
	 * @param {string} role
	 */
	async removeRole(role) {
		await this.roleRow(role).getByRole('button', {name: 'Remove Role'}).click();
		await this.removeRoleDialog
			.getByRole('button', {name: 'Remove Role', exact: true})
			.click();
		await this.removeRoleDialog.waitFor({state: 'hidden'});
	}
}

module.exports = {InvitationWizardPage};
