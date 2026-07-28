// @ts-check
/**
 * @file playwright/pages/UsersAndRolesPage.js
 *
 * Copyright (c) 2014-2026 Simon Fraser University
 * Copyright (c) 2003-2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * Settings → Users & Roles, "Users" tab — the inviter's screen: the Invitations
 * table at the top, the "Invite to a role" button above it, and the Current
 * Users table below (which is where an accepted invitation becomes visible).
 *
 * OPS-local on purpose. The screen is shared code, but the campaign builds one
 * suite per app (PRINCIPLES multi-app convention 1) and the labels this POM
 * names are the app's own — "Preprint Server manager", "Moderator", "Server
 * Masthead". A shared POM would have to launder exactly the vocabulary the OPS
 * suite exists to check.
 *
 * Scratch servers are single-locale, so their URLs are the BARE form; the
 * `/en/`-prefixed form is what a multilingual context needs (parallel lesson 9).
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
}

module.exports = {UsersAndRolesPage};
