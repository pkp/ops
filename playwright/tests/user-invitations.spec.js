// @ts-check
/**
 * @file playwright/tests/user-invitations.spec.js
 *
 * U6 — User invitations, OPS suite. One test per canonical scenario of
 * lib/pkp/docs/product/specs/user-invitations.md (common scenarios 1–8 in OPS
 * vocabulary — preprint server, Moderators — plus the OPS-specific scenario 9,
 * register OPS1). Every mutating flow runs on its own scratch preprint server
 * seeded through the scenario endpoint with throwaway users; `publicknowledge`
 * and the seeded roster are touched read-only (scenario 9 only browses).
 *
 * Deliberately NOT covered here (spec's Findings register is the record —
 * 🐞 findings are never asserted as contract, ❓ questions are parked):
 * - A3: the exact error shape of a replaced invitation's dead links (scenario
 *   6 asserts only that the old link no longer opens the accept flow, with the
 *   new link as the same-way positive control).
 * - A4: the post-accept landing on the sign-in screen (scenarios 2–3 stop at
 *   the working boundary: the closing dialog, then a fresh sign-in proves the
 *   credentials/roles; where the dialog button lands is not asserted).
 * - A5: the "Invitation Sent" dialog's promised decision updates (dialog
 *   presence is asserted, its promises are not), and its "View All Users"
 *   button behavior — tests navigate back to Users & Roles themselves.
 * - A6 / Rule 14: the disabled-user paths (need a mutation of a user's
 *   disabled flag mid-flow; deferred with the user-management feature).
 * - A7: wording/untranslated-token defects.
 * - OMP1: the masthead-change/role-removal immediate actions on the user-row
 *   wizard — the fatal also affects OPS, so scenario 8 asserts the controls
 *   are offered and stops (never drives the masthead confirmation).
 * - A1 (wizard address gate) and A2 (draft cleanup): open questions; A1's
 *   live outcomes live in the maintainer's private security file.
 * - Rule 2/4 expiry timing and the daily cleanup task: need a per-invitation
 *   expiry scenario key (PRINCIPLES D9), not a config edit.
 */
const {test, expect} = require('../support/fixtures.js');
const {LoginPage} = require('../../lib/pkp/playwright/pages/LoginPage.js');
const {
    UsersRolesPage,
    SendInvitationWizard,
    AcceptInvitationWizard,
    InvitationUnavailablePage,
    DeclineInvitationPage,
} = require('../pages/UserInvitationPages.js');

const APP = 'ops';
const ROLE_MODERATOR = 'Moderator';
const MASTHEAD_SHOW = 'Appear on the masthead';
const MASTHEAD_HIDE = 'Does not appear on the masthead';

/** Single hyphenless alphanumeric token — tag conventions in patterns.md. */
function makeTag(prefix) {
    return prefix + Math.random().toString(36).replace(/[^a-z0-9]/g, '').slice(0, 7);
}

/** Today as YYYY-MM-DD in the local timezone (native date input format). */
function today() {
    return new Intl.DateTimeFormat('en-CA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());
}

/**
 * Seed a scratch preprint server with a throwaway manager (+ extras).
 * Passwords follow the harness rule (username doubled), so asUser() works.
 */
async function seedServer(pkpApi, tag, extraUsers = []) {
    const manager = `m${tag}`;
    await pkpApi.createContext({
        tag,
        users: [{username: manager, roles: ['manager']}, ...extraUsers],
    });
    return {path: tag, manager};
}

/**
 * Drive the send wizard from Users & Roles through the final "Invitation
 * Sent" dialog. `existing: true` expects the searched address to resolve to
 * an account (details shown read-only); otherwise the newcomer form is used.
 */
async function sendInvitation(page, path, {email, role, marker, givenName, existing = false}) {
    const users = new UsersRolesPage(page, path);
    await users.goto();
    await users.inviteToRoleButton.click();
    const wizard = new SendInvitationWizard(page);
    await wizard.expectSearchStep();
    await wizard.searchAndContinue(email);
    if (existing) {
        await expect(wizard.userFoundMessage).toBeVisible();
    } else {
        await expect(wizard.userNotFoundMessage).toBeVisible();
        await expect(wizard.emailField).toHaveValue(email);
        if (givenName) {
            await wizard.fillGivenName(givenName);
        }
    }
    await wizard.fillNewRoleRow(0, {role, dateStart: today(), masthead: MASTHEAD_SHOW});
    await wizard.saveAndContinueButton.click();
    await wizard.setSubject(`Invitation ${marker}`);
    await wizard.sendAndAwaitConfirmation();
    return wizard;
}

/** Pull the invitation email (scoped by throwaway recipient + subject marker) and extract both links. */
async function fetchInvitationLinks(pkpMail, {to, marker}) {
    const message = await pkpMail.find({to, contains: marker});
    const full = await pkpMail.fullMessage(message.ID);
    const acceptUrl = pkpMail.extractLink(full.HTML, 'Accept Invitation');
    const declineUrl = pkpMail.extractLink(full.HTML, 'Decline Invitation');
    expect(acceptUrl, 'invitation email must carry the accept link').toContain('/invitation/accept');
    expect(declineUrl, 'invitation email must carry the decline link').toContain('/invitation/decline');
    return {acceptUrl, declineUrl, html: full.HTML};
}

test.describe('user invitations (U6)', () => {
    test('scenario 1: manager invites a newcomer to a role', async ({asUser, pkpApi, pkpMail}) => {
        const tag = makeTag('u6s1');
        const {path, manager} = await seedServer(pkpApi, tag);
        const email = `${tag}-${APP}@mail.test`;

        const page = await (await asUser(manager)).newPage();
        const users = new UsersRolesPage(page, path);
        await users.goto();
        await expect(users.inviteToRoleButton).toBeVisible();
        await users.inviteToRoleButton.click();

        const wizard = new SendInvitationWizard(page);
        await wizard.expectSearchStep();
        await wizard.searchAndContinue(email);
        // The wizard reports the address is not known to the server and moves on to Enter details.
        await expect(wizard.userNotFoundMessage).toBeVisible();
        await expect(wizard.emailField).toHaveValue(email);
        await wizard.fillGivenName(`New${tag}`);
        await wizard.fillNewRoleRow(0, {
            role: ROLE_MODERATOR,
            dateStart: today(),
            masthead: MASTHEAD_SHOW,
        });
        await wizard.saveAndContinueButton.click();
        // Compose step: adjust the subject for this send.
        await wizard.setSubject(`Invitation ${tag}`);
        await wizard.sendAndAwaitConfirmation();

        // Back on Users & Roles (on our own — see header note on A5), the
        // Invitations table lists the pending row as "Invited {date}".
        await users.goto();
        const row = users.invitationRow(email);
        await expect(row).toBeVisible();
        await expect(row).toContainText(/Invited/);
        await expect(row).toContainText(ROLE_MODERATOR);

        // The recipient's mailbox holds the invitation listing the offered role and two links.
        const {html} = await fetchInvitationLinks(pkpMail, {to: email, marker: tag});
        expect(html).toContain(ROLE_MODERATOR);
    });

    test('scenario 2: newcomer accepts and gets an account', async ({page, asUser, pkpApi, pkpMail}) => {
        test.slow();
        const tag = makeTag('u6s2');
        const {path, manager} = await seedServer(pkpApi, tag);
        const email = `${tag}-${APP}@mail.test`;
        const givenName = `Nu${tag}`;

        const managerPage = await (await asUser(manager)).newPage();
        await sendInvitation(managerPage, path, {
            email,
            role: ROLE_MODERATOR,
            marker: tag,
            givenName,
        });
        const {acceptUrl} = await fetchInvitationLinks(pkpMail, {to: email, marker: tag});

        // Signed-out visitor walks the accept wizard.
        const wizard = new AcceptInvitationWizard(page);
        await wizard.open(acceptUrl);
        const username = `u${tag}`;
        const password = `pw${tag}${tag}`;
        await wizard.createAccount({username, password});
        await wizard.fillDetails({givenName, country: 'Iceland'});

        // Review & create account: the summary shows the chosen username and
        // the offered role; its Edit button reopens the details step.
        await expect(wizard.reviewHeading).toBeVisible();
        await expect(page.getByText(username, {exact: true})).toBeVisible();
        await expect(page.getByText(ROLE_MODERATOR)).toBeVisible();
        await page.getByRole('button', {name: 'Edit', exact: true}).click();
        await expect(page.getByLabel(/^Given Name/).first()).toBeVisible();
        await wizard.saveAndContinueButton.click();
        await expect(wizard.reviewHeading).toBeVisible();

        await wizard.acceptAndAwaitConfirmation();
        await wizard.acceptedDialog.getByRole('button', {name: 'View All Submissions'}).click();

        // Working boundary (A4 🐞 not asserted): wherever the dialog button
        // lands, signing in with the new credentials succeeds.
        await page.context().clearCookies();
        const login = new LoginPage(page);
        await login.goto();
        await login.signIn(username, password);

        // Manager side: the pending row is gone and the account holds the
        // offered role under Current Users.
        const users = new UsersRolesPage(managerPage, path);
        await users.goto();
        await expect(users.invitationRow(email)).toHaveCount(0);
        await users.searchUsers(givenName);
        const userRow = users.userRow(givenName);
        await expect(userRow).toBeVisible();
        await expect(userRow).toContainText(ROLE_MODERATOR);
    });

    test('scenario 3: existing user accepts an additional role', async ({page, asUser, pkpApi, pkpMail}) => {
        test.slow();
        const tag = makeTag('u6s3');
        const member = `mem${tag}`;
        const memberEmail = `${tag}mem-${APP}@mail.test`;
        const memberName = `Mem${tag}`;
        const {path, manager} = await seedServer(pkpApi, tag, [
            {username: member, roles: ['author'], givenName: memberName, email: memberEmail},
        ]);

        // Manager invites the member, found by exact email; the wizard
        // confirms the user exists and shows their details read-only.
        const managerPage = await (await asUser(manager)).newPage();
        const users = new UsersRolesPage(managerPage, path);
        await users.goto();
        await users.inviteToRoleButton.click();
        const sendWizard = new SendInvitationWizard(managerPage);
        await sendWizard.expectSearchStep();
        await sendWizard.searchAndContinue(memberEmail);
        await expect(sendWizard.userFoundMessage).toBeVisible();
        await expect(managerPage.getByText(memberEmail)).toBeVisible();
        // Read-only: no editable personal fields for an existing user.
        await expect(managerPage.getByLabel(/^Given Name/)).toHaveCount(0);
        await sendWizard.fillNewRoleRow(0, {
            role: ROLE_MODERATOR,
            dateStart: today(),
            masthead: MASTHEAD_SHOW,
        });
        await sendWizard.saveAndContinueButton.click();
        await sendWizard.setSubject(`Invitation ${tag}`);
        await sendWizard.sendAndAwaitConfirmation();

        const {acceptUrl} = await fetchInvitationLinks(pkpMail, {to: memberEmail, marker: tag});

        // Recipient (signed out): the review step opens directly — no
        // password prompt, no account fields.
        const wizard = new AcceptInvitationWizard(page);
        await wizard.open(acceptUrl);
        await expect(wizard.acceptButton).toBeVisible();
        await expect(page.getByText(ROLE_MODERATOR)).toBeVisible();
        await expect(wizard.usernameInput).toHaveCount(0);
        await expect(wizard.passwordInput).toHaveCount(0);
        await wizard.acceptAndAwaitConfirmation();

        // Working boundary (A4 🐞 not asserted): signing in the usual way works.
        await page.context().clearCookies();
        const login = new LoginPage(page);
        await login.goto();
        await login.signIn(member, member + member);

        // Manager sees the member under Current Users with both roles.
        await users.goto();
        await expect(users.invitationRow(memberEmail)).toHaveCount(0);
        await users.searchUsers(memberName);
        const memberRow = users.userRow(memberName);
        await expect(memberRow).toBeVisible();
        await expect(memberRow).toContainText('Author');
        await expect(memberRow).toContainText(ROLE_MODERATOR);
    });

    test('scenario 4: recipient declines', async ({page, asUser, pkpApi, pkpMail}) => {
        const tag = makeTag('u6s4');
        const {path, manager} = await seedServer(pkpApi, tag);
        const email = `${tag}-${APP}@mail.test`;

        const managerPage = await (await asUser(manager)).newPage();
        await sendInvitation(managerPage, path, {email, role: ROLE_MODERATOR, marker: tag});
        const {acceptUrl, declineUrl} = await fetchInvitationLinks(pkpMail, {to: email, marker: tag});

        // The decline link opens a confirmation page; only confirming declines.
        await page.goto(declineUrl);
        const decline = new DeclineInvitationPage(page);
        await expect(decline.heading).toBeVisible();
        await expect(decline.description).toBeVisible();
        await decline.confirmButton.click();
        // The browser moves to the sign-in page (Rule 10).
        await page.waitForURL(/\/login/, {waitUntil: 'commit'});

        // The pending row is gone (no account was created for the newcomer —
        // the decline flow never asked for credentials).
        const users = new UsersRolesPage(managerPage, path);
        await users.goto();
        await expect(users.invitationRow(email)).toHaveCount(0);

        // Both emailed links now show "Invitation Unavailable".
        const unavailable = new InvitationUnavailablePage(page);
        await page.goto(acceptUrl);
        await unavailable.expectShown();
        await page.goto(declineUrl);
        await unavailable.expectShown();
    });

    test('scenario 5: manager cancels a pending invitation', async ({page, asUser, pkpApi, pkpMail}) => {
        const tag = makeTag('u6s5');
        const {path, manager} = await seedServer(pkpApi, tag);
        const email = `${tag}-${APP}@mail.test`;

        const managerPage = await (await asUser(manager)).newPage();
        await sendInvitation(managerPage, path, {email, role: ROLE_MODERATOR, marker: tag});
        const {acceptUrl} = await fetchInvitationLinks(pkpMail, {to: email, marker: tag});

        const users = new UsersRolesPage(managerPage, path);
        await users.goto();
        await users.openInvitationAction(email, 'Cancel Invite');

        // The confirmation dialog recaps the invitee: email, role, status, affiliation.
        const dialog = managerPage.getByRole('dialog').filter({hasText: 'Cancel Invitation'});
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText(email);
        await expect(dialog).toContainText(ROLE_MODERATOR);
        await expect(dialog).toContainText(/Invited/);
        await expect(dialog).toContainText('Affiliation');

        // Confirm; the row disappears (bounded by the list's own refetch).
        const refetch = managerPage.waitForResponse(
            (r) => r.url().includes('/invitations/userRoleAssignment') && r.request().method() === 'GET'
        );
        await dialog.getByRole('button', {name: 'Cancel Invitation', exact: true}).click();
        await refetch;
        await expect(users.invitationRow(email)).toHaveCount(0);
        await expect(users.invitationsHeading).toBeVisible();

        // The recipient's accept link now shows "Invitation Unavailable" with
        // Login and Register buttons.
        await page.goto(acceptUrl);
        await new InvitationUnavailablePage(page).expectShown();
    });

    test('scenario 6: manager edits a pending invitation', async ({page, asUser, pkpApi, pkpMail}) => {
        test.slow();
        const tag = makeTag('u6s6');
        const {path, manager} = await seedServer(pkpApi, tag);
        const email = `${tag}-${APP}@mail.test`;
        const markerA = `${tag}a`;
        const markerB = `${tag}b`;

        const managerPage = await (await asUser(manager)).newPage();
        await sendInvitation(managerPage, path, {email, role: ROLE_MODERATOR, marker: markerA});
        const first = await fetchInvitationLinks(pkpMail, {to: email, marker: markerA});

        const users = new UsersRolesPage(managerPage, path);
        await users.goto();
        await users.openInvitationAction(email, 'Edit');

        // A dialog warns the current invitation will be canceled and a new one sent.
        const editDialog = managerPage.getByRole('dialog').filter({hasText: 'Edit Invitation'});
        await expect(editDialog).toBeVisible();
        await expect(editDialog).toContainText('the current invitation will be canceled');
        await editDialog.getByRole('button', {name: 'Edit Invitation'}).click();
        await managerPage.waitForURL(/\/invitation\/edit\/\d+/, {waitUntil: 'commit'});

        // The wizard reopens prefilled, without the search step.
        const wizard = new SendInvitationWizard(managerPage);
        await expect(wizard.emailField).toHaveValue(email);
        await expect(wizard.searchInput).toHaveCount(0);
        await expect(wizard.searchStepText).toHaveCount(0);
        // Change the role set: keep Moderator, add a second role.
        await wizard.addAnotherRoleButton.click();
        await wizard.fillNewRoleRow(1, {
            role: 'Author',
            dateStart: today(),
            masthead: MASTHEAD_HIDE,
        });
        await wizard.saveAndContinueButton.click();
        await wizard.setSubject(`Invitation ${markerB}`);
        await wizard.sendAndAwaitConfirmation();

        // The mailbox holds a second invitation whose links work…
        const second = await fetchInvitationLinks(pkpMail, {to: email, marker: markerB});
        const acceptWizard = new AcceptInvitationWizard(page);
        await acceptWizard.open(second.acceptUrl);
        await expect(acceptWizard.createAccountHeading).toBeVisible();

        // …while the first email's links no longer do. Working boundary
        // (A3 🐞 not asserted): the replaced link must not open the accept
        // flow — the second link, taken the same way, is the positive control.
        await page.goto(first.acceptUrl);
        await expect(acceptWizard.createAccountHeading).toHaveCount(0);
        await expect(acceptWizard.acceptButton).toHaveCount(0);
    });

    test('scenario 7: wrong person signed in', async ({page, asUser, pkpApi, pkpMail}) => {
        test.slow();
        const tag = makeTag('u6s7');
        const member = `mem${tag}`;
        const memberEmail = `${tag}mem-${APP}@mail.test`;
        const bystander = `by${tag}`;
        const {path, manager} = await seedServer(pkpApi, tag, [
            {username: member, roles: ['author'], givenName: `Mem${tag}`, email: memberEmail},
            {username: bystander, roles: ['reader']},
        ]);

        const managerPage = await (await asUser(manager)).newPage();
        await sendInvitation(managerPage, path, {
            email: memberEmail,
            role: ROLE_MODERATOR,
            marker: tag,
            existing: true,
        });
        const {acceptUrl} = await fetchInvitationLinks(pkpMail, {to: memberEmail, marker: tag});

        // A signed-in user who is not the invitee opens the accept link: refused.
        const bystanderPage = await (await asUser(bystander)).newPage();
        const wizard = new AcceptInvitationWizard(bystanderPage);
        await wizard.open(acceptUrl);
        await expect(wizard.refusalDialog).toBeVisible();
        await expect(wizard.refusalDialog).toContainText(
            'Please log out and sign in with the correct account'
        );

        // The Logout action genuinely ends that session.
        await wizard.refusalDialog.getByRole('button', {name: 'Logout'}).click();
        await bystanderPage.waitForURL((url) => !url.href.includes('/invitation/accept'), {
            waitUntil: 'commit',
        });
        await bystanderPage.goto(`/index.php/${path}/user/profile`);
        await bystanderPage.waitForURL(/\/login/, {waitUntil: 'commit'});

        // Reopening the link signed out starts the real (existing-user) flow.
        await wizard.open(acceptUrl);
        await expect(wizard.acceptButton).toBeVisible();
        await expect(bystanderPage.getByText(ROLE_MODERATOR)).toBeVisible();
    });

    test('scenario 8: propose a role via the user row', async ({page, asUser, pkpApi, pkpMail}) => {
        test.slow();
        const tag = makeTag('u6s8');
        const member = `mem${tag}`;
        const memberEmail = `${tag}mem-${APP}@mail.test`;
        const memberName = `Mem${tag}`;
        const {path, manager} = await seedServer(pkpApi, tag, [
            {username: member, roles: ['author'], givenName: memberName, email: memberEmail},
        ]);

        const managerPage = await (await asUser(manager)).newPage();
        const users = new UsersRolesPage(managerPage, path);
        await users.goto();
        await users.searchUsers(memberName);
        await users.openUserEdit(memberName);

        // The wizard opens on the member's details with no search step.
        const wizard = new SendInvitationWizard(managerPage);
        await expect(managerPage.getByText(memberEmail)).toBeVisible();
        await expect(wizard.searchInput).toHaveCount(0);
        await expect(wizard.searchStepText).toHaveCount(0);

        // The roles table offers the immediate Remove Role / masthead controls
        // (presence only — the masthead confirmation fatal is OMP1's record;
        // working boundary, not driven here).
        const currentRoleRow = managerPage.getByRole('row').filter({hasText: 'Author'});
        await expect(currentRoleRow.getByRole('button', {name: 'Remove Role'})).toBeVisible();
        // The current-role masthead control (combobox — its label association
        // is unreliable across duplicate rows, so located by role).
        await expect(currentRoleRow.getByRole('combobox')).toBeVisible();

        // The send path stays inactive until a new role row is added.
        await expect(wizard.saveAndContinueButton).toBeDisabled();
        await wizard.addAnotherRoleButton.click();
        await expect(wizard.saveAndContinueButton).toBeEnabled();
        await wizard.fillNewRoleRow(0, {
            role: ROLE_MODERATOR,
            dateStart: today(),
            masthead: MASTHEAD_SHOW,
        });
        await wizard.saveAndContinueButton.click();
        await wizard.setSubject(`Invitation ${tag}`);
        await wizard.sendAndAwaitConfirmation();

        // The member is emailed, but the role is only a proposal: not on the
        // account until accepted.
        const {acceptUrl} = await fetchInvitationLinks(pkpMail, {to: memberEmail, marker: tag});
        await users.goto();
        await users.searchUsers(memberName);
        const memberRow = users.userRow(memberName);
        await expect(memberRow).toBeVisible();
        await expect(memberRow).toContainText('Author');
        await expect(memberRow).not.toContainText(ROLE_MODERATOR);

        // Accept (scenario 3's flow) — then the role appears on the account.
        const acceptWizard = new AcceptInvitationWizard(page);
        await acceptWizard.open(acceptUrl);
        await expect(acceptWizard.acceptButton).toBeVisible();
        await acceptWizard.acceptAndAwaitConfirmation();

        await users.goto();
        await users.searchUsers(memberName);
        await expect(memberRow).toBeVisible();
        await expect(memberRow).toContainText(ROLE_MODERATOR);
    });

    test('scenario 9 {OPS}: the invitation template is missing from the Emails screen', async ({asUser}) => {
        // Read-only browsing on the seeded server as its Preprint Server
        // Manager. Deliverability of the invitation email on this same server
        // is scenario 1's assertion (the spec names it as this scenario's
        // send-side positive control).
        const page = await (await asUser('manager.maya')).newPage();
        await page.goto('/index.php/publicknowledge/management/settings/manageEmails');
        await expect(page.getByRole('heading', {name: 'Manage Emails'})).toBeVisible();

        // The Search component submits the phrase only on Enter (Search.vue).
        const search = page.getByRole('searchbox');

        // Positive control, taken the same way: another stored template is
        // findable and offers Edit.
        await search.pressSequentially('Password Reset Confirm', {delay: 20});
        await search.press('Enter');
        await expect(page.getByText('Password Reset Confirm', {exact: true})).toBeVisible();
        await expect(
            page.getByRole('button', {name: 'Edit Password Reset Confirm'})
        ).toBeVisible();
        // The filter is genuinely applied (other templates are gone) before
        // the absence claim is made the same way.
        await expect(page.getByText('Statistics Report Notification', {exact: true})).toHaveCount(0);

        // The invitation template has no row: the list answers "No items found."
        await search.fill('');
        await search.pressSequentially('User Invited to Role Notification', {delay: 20});
        await search.press('Enter');
        await expect(page.getByText('No items found.')).toBeVisible();
        await expect(page.getByText('User Invited to Role Notification')).toHaveCount(0);
    });
});
