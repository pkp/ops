/**
 * @file playwright/pages/UserInvitationPages.js
 *
 * OPS feature POMs for the user-invitations suite (U6).
 *
 * Three surfaces:
 * - UsersRolesPage — Settings → Users & Roles (Users tab): the Invitations
 *   table + "Invite to a role" button (UserInvitationManager.vue) above the
 *   Current Users list (UserAccessManager.vue).
 * - SendInvitationWizard — {ctx}/invitation/create/userRoleAssignment (and the
 *   edit/editUser modes of the same wizard).
 * - AcceptInvitationWizard — the emailed accept-link flow
 *   ({ctx}/invitation/accept?id=…&key=…).
 *
 * Selector sources: lib/ui-library/src/managers/UserInvitationManager/*,
 * src/pages/userInvitation/*, src/pages/acceptInvitation/*; English strings
 * from lib/pkp/locale/en/invitation.po + the OPS overrides in
 * locale/en/invitation.po ("Create OPS account", "Accept And Continue to OPS",
 * "Server Masthead", "The user does not have a role in this server", …).
 */
const {expect} = require('@playwright/test');
const {BasePage} = require('../../lib/pkp/playwright/pages/BasePage.js');

exports.UsersRolesPage = class UsersRolesPage extends BasePage {
    /**
     * @param {import('@playwright/test').Page} page
     * @param {string} contextPath
     */
    constructor(page, contextPath) {
        super(page);
        this.contextPath = contextPath;
        this.inviteToRoleButton = page.getByRole('button', {name: 'Invite to a role'});
        this.invitationsHeading = page.getByRole('heading', {name: /^Invitations/});
        this.currentUsersHeading = page.getByRole('heading', {name: /^Current Users/});
        // The Current Users search (the Invitations table has none).
        this.userSearchInput = page.getByRole('searchbox');
    }

    /** Navigate to Users & Roles and wait for the Invitations table fetch. */
    async goto() {
        const invitationsFetch = this.page.waitForResponse(
            (r) => r.url().includes('/invitations/userRoleAssignment') && r.request().method() === 'GET'
        );
        await this.page.goto(this.contextUrl(this.contextPath, '/management/settings/access'));
        await invitationsFetch;
        await expect(this.invitationsHeading).toBeVisible();
    }

    /**
     * A pending-invitation row (status cell always reads "Invited {date}",
     * which distinguishes it from a Current Users row with the same email).
     *
     * @param {string} email
     */
    invitationRow(email) {
        return this.page.getByRole('row').filter({hasText: email}).filter({hasText: 'Invited'});
    }

    /**
     * Open an action from a pending invitation row's ⋯ menu.
     *
     * @param {string} email
     * @param {string} actionLabel 'Edit' | 'Cancel Invite'
     */
    async openInvitationAction(email, actionLabel) {
        await this.invitationRow(email)
            .getByRole('button', {name: 'Invitation management options'})
            .click();
        await this.page.getByRole('menuitem', {name: actionLabel, exact: true}).click();
    }

    /**
     * Filter the Current Users list. The Search component submits the phrase
     * only on Enter (Search.vue), so type and press Enter.
     *
     * @param {string} phrase
     */
    async searchUsers(phrase) {
        await this.userSearchInput.fill('');
        await this.userSearchInput.pressSequentially(phrase, {delay: 20});
        await this.userSearchInput.press('Enter');
    }

    /**
     * A Current Users row: carries at least one held role name, never the
     * "Invited {date}" status text.
     *
     * @param {string} text e.g. the user's unique given name
     */
    userRow(text) {
        return this.page
            .getByRole('row')
            .filter({hasText: text})
            .filter({hasNotText: 'Invited'});
    }

    /**
     * Open the row's ⋯ menu → Edit on a Current Users row (routes to the send
     * wizard in editUser mode at management/settings/user/{id}).
     * The row has exactly one button (the actions dropdown); its accessible
     * name is not relied on (the label's locale key renders raw — spec A7).
     *
     * @param {string} text unique row text (given name)
     */
    async openUserEdit(text) {
        const row = this.userRow(text);
        await expect(row).toBeVisible();
        await row.getByRole('button').click();
        await this.page.getByRole('menuitem', {name: 'Edit', exact: true}).click();
        await this.page.waitForURL(/management\/settings\/user\/\d+/, {waitUntil: 'commit'});
    }
};

exports.SendInvitationWizard = class SendInvitationWizard extends BasePage {
    constructor(page) {
        super(page);
        this.searchInput = page.getByLabel(/Search for a user by email address/);
        this.searchUserButton = page.getByRole('button', {name: 'Search User', exact: true});
        this.saveAndContinueButton = page.getByRole('button', {name: 'Save And Continue'});
        this.sendButton = page.getByRole('button', {name: 'Invite user to the role'});
        this.addAnotherRoleButton = page.getByRole('button', {name: 'Add Another Role'});
        this.userNotFoundMessage = page.getByText('The user does not have a role in this server');
        this.userFoundMessage = page.getByText('The user already exists in the server');
        // Accessible names of required form fields include the "* Required" suffix.
        this.emailField = page.getByLabel(/^Email/);
        this.subjectInput = page.locator('input[name="subject"]');
        this.sentDialog = page.getByRole('dialog').filter({hasText: 'Invitation Sent'});
        this.searchStepText = page.getByText('Search User');
        // New-role rows are the ones carrying the "Select a new role" field
        // (current-role rows render the role and dates as plain text).
        // Matched by text, not label: duplicate field ids across rows break
        // the label-for association on every row after the first.
        this.newRoleRows = page.getByRole('row').filter({hasText: 'Select a new role'});
    }

    async expectSearchStep() {
        await expect(this.searchInput).toBeVisible();
    }

    /** Step 1: enter the phrase and advance (one click shows the found/not-found note and moves to Enter details). */
    async searchAndContinue(phrase) {
        await this.searchInput.fill(phrase);
        await this.searchUserButton.click();
    }

    /** New-invitee details form (existing users show read-only text instead). */
    async fillGivenName(name) {
        await this.page.getByLabel(/^Given Name/).first().fill(name);
    }

    /**
     * Fill the i-th NEW role row (0-based). Assumes the row exists — create
     * mode starts with one empty row; use addAnotherRole() otherwise.
     *
     * @param {number} i
     * @param {{role: string, dateStart: string, masthead: string}} options
     *   masthead: 'Appear on the masthead' | 'Does not appear on the masthead'
     */
    async fillNewRoleRow(i, {role, dateStart, masthead}) {
        // All controls located positionally within the row (see newRoleRows
        // note): comboboxes are [role, masthead]; the only textbox is the
        // Start Date input.
        const row = this.newRoleRows.nth(i);
        await row.getByRole('combobox').first().selectOption({label: role});
        await row.getByRole('textbox').fill(dateStart);
        await row.getByRole('combobox').last().selectOption({label: masthead});
    }

    /**
     * Compose step: wait for the stored template to finish loading (filling
     * earlier would be overwritten), then replace the subject.
     */
    async setSubject(subject) {
        await expect(this.subjectInput).toBeVisible();
        await expect(this.page.locator('.composer__loadingTemplateMask')).toHaveCount(0);
        await this.subjectInput.fill(subject);
    }

    /** Final send; resolves once the "Invitation Sent" dialog is up. */
    async sendAndAwaitConfirmation() {
        await this.sendButton.click();
        await expect(this.sentDialog).toBeVisible();
        await expect(this.sentDialog.getByRole('button', {name: 'View All Users'})).toBeVisible();
    }
};

exports.AcceptInvitationWizard = class AcceptInvitationWizard extends BasePage {
    constructor(page) {
        super(page);
        this.skipOrcidButton = page.getByRole('button', {name: 'Skip ORCID verification'});
        this.createAccountHeading = page.getByRole('heading', {name: /Create OPS account/});
        // Required-field accessible names carry the "* Required" suffix.
        this.usernameInput = page.getByLabel(/^Username/);
        this.passwordInput = page.getByLabel(/^Password/);
        this.privacyCheckbox = page.getByRole('checkbox');
        this.saveAndContinueButton = page.getByRole('button', {name: 'Save and continue'});
        this.reviewHeading = page.getByRole('heading', {name: /Review & create account/});
        this.acceptButton = page.getByRole('button', {name: 'Accept And Continue to OPS'});
        this.acceptedDialog = page
            .getByRole('dialog')
            .filter({hasText: "You've been assigned a new role in OPS"});
        this.refusalDialog = page
            .getByRole('dialog')
            .filter({hasText: "Invitation not accepted. You're logged in as a different user."});
    }

    /**
     * Open an emailed accept link and wait for the wizard's invitation fetch.
     * Passes the ORCID step if the server offers it (the shipped test
     * contexts have ORCID off, so it normally does not appear — Rule 5).
     */
    async open(url) {
        const receive = this.page.waitForResponse((r) => /\/invitations\/\d+\/key\//.test(r.url()));
        await this.page.goto(url);
        await receive.catch(() => {});
        if (await this.skipOrcidButton.isVisible().catch(() => false)) {
            await this.skipOrcidButton.click();
        }
    }

    /** "Create OPS account" step for a new invitee. */
    async createAccount({username, password}) {
        await expect(this.createAccountHeading).toBeVisible();
        await this.usernameInput.fill(username);
        await this.passwordInput.fill(password);
        await this.privacyCheckbox.check();
        await this.saveAndContinueButton.click();
    }

    /** "Enter details" step for a new invitee. */
    async fillDetails({givenName, country}) {
        await this.page.getByLabel(/^Given Name/).first().fill(givenName);
        await this.page.getByLabel('Country of affiliation').selectOption({label: country});
        await this.saveAndContinueButton.click();
    }

    /** Final accept; resolves once the new-role dialog is up. */
    async acceptAndAwaitConfirmation() {
        await this.acceptButton.click();
        await expect(this.acceptedDialog).toBeVisible();
        await expect(
            this.acceptedDialog.getByRole('button', {name: 'View All Submissions'})
        ).toBeVisible();
    }
};

/** The generic invitation-link landing for spent links (Rule 4). */
exports.InvitationUnavailablePage = class InvitationUnavailablePage extends BasePage {
    constructor(page) {
        super(page);
        this.heading = page.getByRole('heading', {name: 'Invitation Unavailable'});
        this.description = page.getByText('This invitation is no longer available');
        this.loginButton = page.getByRole('link', {name: 'Login', exact: true});
        this.registerButton = page.getByRole('link', {name: 'Register', exact: true});
    }

    async expectShown() {
        await expect(this.heading).toBeVisible();
        await expect(this.description).toBeVisible();
        await expect(this.loginButton).toBeVisible();
        await expect(this.registerButton).toBeVisible();
    }
};

/** The emailed decline-link confirmation page (Rule 10). */
exports.DeclineInvitationPage = class DeclineInvitationPage extends BasePage {
    constructor(page) {
        super(page);
        this.heading = page.getByRole('heading', {name: 'Decline Invitation'});
        this.description = page.getByText('Are you sure you want to decline this invitation?');
        this.confirmButton = page.getByRole('button', {name: 'Confirm Decline Invitation'});
    }
};
