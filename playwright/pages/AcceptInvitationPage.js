// @ts-check
/**
 * @file playwright/pages/AcceptInvitationPage.js
 *
 * Copyright (c) 2014-2026 Simon Fraser University
 * Copyright (c) 2003-2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * Everything the recipient of an invitation email can land on:
 *
 *   /{ctx}/invitation/accept?id&key    the acceptance flow — 3 steps for a
 *                                      newcomer, 1 review step for someone who
 *                                      already has an account
 *   /{ctx}/invitation/decline?id&key   the decline confirmation page
 *   either link, once spent or lapsed  the "Invitation Unavailable" page
 *
 * No sign-in is involved: the link is the credential. The one exception is the
 * refusal shown when SOMEONE ELSE is signed in, which this POM also names.
 *
 * On OPS every app-named string says OPS ("Create OPS account", "Accept And
 * Continue to OPS") — one of the places the app's vocabulary reaches the
 * recipient, which is why this POM is the OPS suite's and not shared.
 */

const {BasePage} = require('../../lib/pkp/playwright/pages/BasePage.js');

class AcceptInvitationPage extends BasePage {
	/** @param {import('@playwright/test').Page} page */
	constructor(page) {
		super(page);

		// --- acceptance flow, newcomer branch -------------------------------
		this.accountStepHeading = page.getByRole('heading', {
			name: /^STEP \d+ - Create OPS account$/,
		});
		this.usernameField = page.getByRole('textbox', {name: /^Username/});
		this.passwordField = page.getByRole('textbox', {name: /^Password/});
		this.privacyConsent = page.getByRole('checkbox', {
			name: /I agree to have my data collected/,
		});
		this.detailsStepHeading = page.getByRole('heading', {
			name: /^STEP \d+ - Enter details$/,
		});
		this.givenNameField = page.getByRole('textbox', {name: /^Given Name/});
		this.familyNameField = page.getByRole('textbox', {name: /^Family Name/});
		this.countryField = page.getByRole('combobox', {
			name: /^Country of affiliation/,
		});
		this.saveAndContinueButton = page.getByRole('button', {
			name: 'Save and continue',
		});

		// --- acceptance flow, review step (both branches) --------------------
		this.reviewStepHeading = page.getByRole('heading', {
			name: /^STEP \d+ - Review & create account$/,
		});
		this.rolesTable = page.getByRole('table', {name: 'Roles'});
		this.acceptButton = page.getByRole('button', {
			name: 'Accept And Continue to OPS',
		});
		this.successDialog = page.getByRole('dialog', {
			name: /been assigned a new role in OPS/,
		});

		// --- the other landings ----------------------------------------------
		this.unavailableHeading = page.getByRole('heading', {
			name: 'Invitation Unavailable',
		});
		this.loginLink = page.getByRole('link', {name: 'Login', exact: true});
		this.registerLink = page.getByRole('link', {name: 'Register', exact: true});

		this.declineHeading = page.getByRole('heading', {
			name: 'Decline Invitation',
		});
		this.confirmDeclineButton = page.getByRole('button', {
			name: 'Confirm Decline Invitation',
		});

		this.wrongUserDialog = page.getByRole('dialog', {
			name: /logged in as a different user/,
		});
		this.logoutButton = this.wrongUserDialog.getByRole('button', {
			name: 'Logout',
		});
	}

	/**
	 * The account step of the newcomer branch. The Privacy Consent tick is the
	 * flow's only client-side rule — unticked, the step never reaches the server.
	 *
	 * @param {{username: string, password: string}} account
	 */
	async createAccount({username, password}) {
		await this.usernameField.fill(username);
		await this.passwordField.fill(password);
		await this.privacyConsent.check();
		await this.saveAndContinueButton.click();
		await this.detailsStepHeading.waitFor();
	}

	/**
	 * The details step of the newcomer branch.
	 *
	 * @param {{givenName?: string, familyName?: string, country: string}} details
	 */
	async enterDetails({givenName, familyName, country}) {
		if (givenName !== undefined) {
			await this.givenNameField.fill(givenName);
		}

		if (familyName !== undefined) {
			await this.familyNameField.fill(familyName);
		}

		await this.countryField.selectOption({label: country});
		await this.saveAndContinueButton.click();
		await this.reviewStepHeading.waitFor();
	}

	/**
	 * Accept from the review step and wait for the success dialog.
	 *
	 * The dialog's "View All Submissions" button is deliberately NOT followed:
	 * where it lands is a register finding (A12), not this suite's contract.
	 */
	async accept() {
		await this.acceptButton.click();
		await this.successDialog.waitFor();
	}
}

module.exports = {AcceptInvitationPage};
