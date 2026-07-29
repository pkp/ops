// @ts-check
/**
 * @file playwright/pages/UsersAndRolesPage.js
 *
 * Copyright (c) 2014-2026 Simon Fraser University
 * Copyright (c) 2003-2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * Settings → Users & Roles, "Users" tab. Two features meet on this one screen:
 *
 *   - *User invitations* (U6) owns everything above the Current Users table —
 *     the Invitations table and the "Invite to a role" button;
 *   - *Users management* (U53) owns the Current Users table itself: its search,
 *     its per-row options menu, and the email / disable / enable / remove /
 *     merge operations those rows drive.
 *
 * OPS-local on purpose. The screen is shared code, but the campaign builds one
 * suite per app (PRINCIPLES multi-app convention 1) and the labels this POM
 * names are the app's own — "Preprint Server manager", "Moderator", "Server
 * Masthead". A shared POM would have to launder exactly the vocabulary the OPS
 * suite exists to check.
 *
 * Scratch servers are single-locale, so their URLs are the BARE form; the
 * `/en/`-prefixed form is what a multilingual context needs (parallel lesson 9).
 *
 * Four locator hazards on this page, all met live and all handled below:
 *
 * - **Three tables.** Invitations, Current Users and the Roles tab's own table
 *   share header names; both user tables carry "Email". Each is addressed by its
 *   accessible name, never by index.
 * - **Two search inputs.** The page chrome contributes a hidden
 *   `input[type=search]` placeholdered "Search submissions"; an unqualified
 *   `input[type=search]` picks it and every fill times out. The users search is
 *   addressed by its own placeholder.
 * - **The row-options button has no usable accessible name** — it is handed the
 *   raw key `##userAccess.management.options##` (register A3, 🐞). A test must
 *   not spell that key: the button is located structurally, as the last cell's
 *   button, so the suite keeps working the day the string is fixed.
 * - **The merge grid's row actions carry no `href`**, so `getByRole('link')`
 *   matches nothing, and they live in a control row that stays hidden until the
 *   row's "Settings" expander is clicked.
 */

const {BasePage} = require('../../lib/pkp/playwright/pages/BasePage.js');

class UsersAndRolesPage extends BasePage {
	/**
	 * @param {import('@playwright/test').Page} page
	 * @param {string} contextPath url path of the preprint server
	 */
	constructor(page, contextPath) {
		super(page);
		this.contextPath = contextPath;

		this.heading = page.getByRole('heading', {name: 'Users & Roles', level: 1});
		this.inviteButton = page.getByRole('button', {name: 'Invite to a role'});

		// Both headings carry their own item count, e.g. "Invitations (2)".
		this.invitationsHeading = page.getByRole('heading', {
			name: /^Invitations \(\d+\)$/,
		});
		this.invitationsTable = page.getByRole('table', {name: /^Invitations/});
		this.usersTable = page.getByRole('table', {name: /^Current Users/});

		this.usersHeading = page.getByRole('heading', {
			name: /^Current Users \(\d+\)$/,
		});

		// The page chrome hides a second search box ("Search submissions"); this
		// one is the users list's, named by its own hint.
		this.searchField = page.getByPlaceholder(/^Enter a user's name/);
	}

	/** @param {string} contextPath */
	static url(contextPath) {
		return BasePage.contextUrl(contextPath, '/management/settings/access');
	}

	async goto() {
		await this.page.goto(UsersAndRolesPage.url(this.contextPath));
		await this.invitationsHeading.waitFor();
	}

	/**
	 * A row of the Invitations table, found by the invitee's address.
	 *
	 * `filter({hasText})` rather than a row-name regex: the addresses carry `@`
	 * and `.`, which a name regex would have to escape.
	 *
	 * @param {string} email
	 */
	invitationRow(email) {
		return this.invitationsTable.locator('tbody tr').filter({hasText: email});
	}

	/**
	 * A row of the Current Users table, found by the user's address.
	 *
	 * @param {string} email
	 */
	userRow(email) {
		return this.usersTable.locator('tbody tr').filter({hasText: email});
	}

	/**
	 * Open a pending invitation's "Invitation management options" menu and pick
	 * one of its two items ("Edit", "Cancel Invite").
	 *
	 * The menu portals to the document root, so the item lookup is scoped to the
	 * page rather than to the row (patterns: headlessui menus).
	 *
	 * @param {string} email
	 * @param {string} action
	 */
	async chooseRowAction(email, action) {
		await this.invitationRow(email)
			.getByRole('button', {name: 'Invitation management options'})
			.click();
		await this.page.getByRole('menuitem', {name: action, exact: true}).click();
	}

	/** The "Cancel Invitation" confirmation dialog opened by "Cancel Invite". */
	get cancelDialog() {
		return this.page.getByRole('dialog', {name: 'Cancel Invitation'});
	}

	/** The cancel-and-resend warning dialog opened by "Edit". */
	get editDialog() {
		return this.page.getByRole('dialog', {name: 'Edit Invitation'});
	}

	//
	// Users management (U53) — the Current Users table
	//

	/**
	 * The number in the "Current Users (N)" heading. It follows the current
	 * search, and it counts ROWS: a Remove leaves the row (and the number)
	 * alone, a merge takes one away.
	 */
	async userCount() {
		const heading = (await this.usersHeading.textContent()) ?? '';
		const match = heading.match(/\((\d+)\)/);

		if (!match) {
			throw new Error(`No count in the users heading: ${JSON.stringify(heading)}`);
		}

		return Number(match[1]);
	}

	/**
	 * Search the users list. It runs on Enter only — typing changes nothing and
	 * the field offers no button — so the Enter press is the search.
	 *
	 * @param {string} term matched against names, roles and affiliations
	 */
	async searchUsers(term) {
		await this.searchField.fill(term);
		await this.searchField.press('Enter');
	}

	/**
	 * The row's options button: the last cell's button. Located structurally on
	 * purpose — its accessible name is an untranslated key (register A3).
	 *
	 * @param {string} email
	 */
	rowOptionsButton(email) {
		return this.userRow(email).locator('td').last().locator('button').first();
	}

	/**
	 * The action labels the row's options menu offers, in screen order.
	 *
	 * The menu portals to the document root, so its items are read from the page
	 * rather than from the row; it is closed again before returning so the next
	 * row can be opened.
	 *
	 * @param {string} email
	 * @returns {Promise<string[]>}
	 */
	async userActions(email) {
		await this.rowOptionsButton(email).click();
		await this.page.getByRole('menuitem').first().waitFor();

		const labels = (await this.page.getByRole('menuitem').allTextContents()).map(
			(label) => label.trim(),
		);

		await this.page.keyboard.press('Escape');
		await this.page.getByRole('menuitem').first().waitFor({state: 'hidden'});

		return labels;
	}

	/**
	 * @param {string} email
	 * @param {string} action one of Edit · Email · Login As · Remove User ·
	 *   Disable User · Enable User · Merge user
	 */
	async chooseUserAction(email, action) {
		await this.rowOptionsButton(email).click();
		await this.page.getByRole('menuitem', {name: action, exact: true}).click();
	}

	/**
	 * The red mark the Name cell gains while the account is disabled. It carries
	 * no text alternative, so presence is all a test can read from it.
	 *
	 * @param {string} email
	 */
	disabledMark(email) {
		return this.userRow(email).locator('.text-negative');
	}

	/** The "Email" form opened from a row. */
	get emailForm() {
		return this.page.locator('#sendEmailForm');
	}

	/**
	 * Fill and send the row's email.
	 *
	 * @param {{subject: string, body: string}} message
	 */
	async sendEmail({subject, body}) {
		await this.emailForm.locator('input[name=subject]').fill(subject);
		await this.page
			.frameLocator('#sendEmailForm iframe[title="Rich Text Area"]')
			.locator('body')
			.fill(body);
		await this.emailForm.getByRole('button', {name: 'Send Email'}).click();
		await this.emailForm.waitFor({state: 'hidden'});
	}

	/**
	 * Side modals wrap the whole backend chrome, so a dialog is identified by
	 * something only it says rather than by `.last()`.
	 *
	 * @param {string|RegExp} text
	 */
	dialogSaying(text) {
		return this.page.locator('[role=dialog]').filter({hasText: text});
	}

	get disableDialog() {
		return this.dialogSaying('Reason for disabling user');
	}

	get enableDialog() {
		return this.dialogSaying('Reason for enabling user');
	}

	get removeDialog() {
		return this.dialogSaying(
			'This action will unenroll the user from all roles',
		);
	}

	/** The second user list, "Merge into this User". */
	get mergeModal() {
		return this.dialogSaying('Merge into this User');
	}

	get mergeConfirmDialog() {
		return this.dialogSaying('This action is not reversible');
	}

	/**
	 * A row of the merge target grid, by username (its own column, and unique).
	 *
	 * @param {string} username
	 */
	mergeCandidateRow(username) {
		return this.mergeModal.locator('tr.gridRow').filter({hasText: username});
	}

	/**
	 * Choose a surviving account in the merge target grid.
	 *
	 * Two hazards in three lines: the action lives in a control row that is only
	 * emitted/shown once the row's "Settings" expander is clicked, and the anchor
	 * carries no `href` — a role-based link lookup matches nothing, so it is
	 * addressed by its link-action class.
	 *
	 * @param {string} username the survivor
	 */
	async mergeInto(username) {
		const row = this.mergeCandidateRow(username);

		await row.locator('a.show_extras').click();

		await row
			.locator('xpath=following-sibling::tr[1]')
			.locator('a.pkp_linkaction_mergeUser')
			.click();
	}
}

module.exports = {UsersAndRolesPage};
