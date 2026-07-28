// @ts-check
/**
 * @file playwright/tests/user-invitations.spec.js
 *
 * Copyright (c) 2014-2026 Simon Fraser University
 * Copyright (c) 2003-2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * U6 "User invitations" — the OPS side of the spec
 * (`lib/pkp/docs/product/specs/user-invitations.md`).
 *
 * The spec's seven COMMON scenarios, each run in OPS's own world — a preprint
 * server, a Preprint Server Manager, Moderators, a "Server Masthead" column —
 * plus scenario 8, OPS's own. One test per scenario:
 *
 *   1  a newcomer is invited and joins                         U6/1
 *   2  an existing user is invited to an additional role       U6/2
 *   3  an invitation is declined                               U6/3
 *   4  a pending invitation is cancelled                       U6/4
 *   5  a pending invitation is edited and resent               U6/5
 *   6  an accept link opened by the wrong signed-in user       U6/6
 *   7  an expired invitation                                   U6/7
 *   8  {OPS} five roles, a masthead selector on every row,     U6/8
 *      and the email that really arrives
 *
 * ## Isolation
 *
 * Every test seeds its OWN preprint server through the scenario endpoint, with
 * its own throwaway manager and its own invitees, and asserts only against
 * that. The shared `publicknowledge` server and its 18 seeded accounts are
 * never touched: an invitation ENROLS people, and enrolling a seeded user in a
 * new role would leak a global role into every other suite (PRINCIPLES
 * architecture principle 7). The manager is a throwaway `…mgr` account rather
 * than `admin`, whose auto-enrolment as every scratch server's manager would
 * quietly stand in for the role under test.
 *
 * Mail is scoped by recipient AND by the per-test tag, which begins `u6tops` —
 * the three fleets share one Mailpit and run at the same time.
 *
 * ## What this suite deliberately does NOT cover, and why
 *
 * **The one OPS-specific divergence is an OPEN QUESTION, so nothing here
 * asserts it.** OPS's email-templates screen lists no row for the invitation
 * email (register entry OPS1, ❓), so its template cannot be edited there.
 * Whether that is intended is unsettled, and an unresolved question is not
 * coverage a test may invent (multi-app convention 3). What scenario 8 CAN
 * check is the confirmed half — the composer offers the template with subject
 * and body filled, the mail sends, arrives and is acceptable — and that is
 * exactly what U6/8 asserts.
 *
 * **Register defects are never asserted as contract.** Several walks below pass
 * through one; the test asserts the part that is contract and stops there:
 *   - A12 (acceptance ends at a sign-in page, nobody signed in) — the tests
 *     assert the success dialog and the role that was really assigned, and never
 *     follow "View All Submissions".
 *   - A14 (a superseded invitation's links land on a bare not-found page) —
 *     U6/5 asserts only that the superseded link no longer opens the acceptance
 *     flow, not where it lands.
 *   - A5 (the step lists' accessible name is an untranslated raw key) and A11
 *     (the email greets a newcomer by their address, not the typed name) — the
 *     texts are read past, never asserted.
 *   - A7 ("Please contact the journal manager" on a preprint server) — U6/3,
 *     U6/4 and U6/7 assert the "Invitation Unavailable" heading and its Login /
 *     Register links, not that sentence.
 *
 * **Out of scope for this feature's suite** (each owned elsewhere or unwatched):
 * the ORCID steps of both wizards (ORCID is unconfigured on the test install,
 * so the step never renders — A13 stays unwatchable here); inviting a disabled
 * user (A10); the wizard reached by typing its address as a Moderator or an
 * Editorial Board Member (A1 ❓ / A8 🐞); the second, older address to Users &
 * Roles (A2 ❓) and the site-admin access difference (A4 ❓); the immediate
 * role-removal and masthead changes the details step drives (A3 ❓, and
 * *Users management*'s mechanics); the nightly job that deletes expired
 * invitations (a scheduled task — the serial project's business, and
 * `task_runner` is Off here); the password breach-list check (the test env's
 * egress is firewalled); and the Invitations table's pagination past five rows.
 */

const base = require('../support/fixtures.js');
const {LoginPage} = require('../../lib/pkp/playwright/pages/LoginPage.js');
const {UsersAndRolesPage} = require('../pages/UsersAndRolesPage.js');
const {InvitationWizardPage} = require('../pages/InvitationWizardPage.js');
const {AcceptInvitationPage} = require('../pages/AcceptInvitationPage.js');

const expect = base.expect;

/**
 * The suite's own fixture: sign a THROWAWAY account in, in its own context.
 *
 * `asUser` is the wrong tool here — it caches a storage state per username, and
 * these usernames exist for one test only. This is a one-off, so it lives in the
 * spec rather than in support/fixtures.js (PRINCIPLES principle 3's shape).
 */
const test = base.test.extend({
	signIn: async ({browser, baseURL}, use) => {
		/** @type {import('@playwright/test').BrowserContext[]} */
		const opened = [];

		await use(async (username) => {
			const context = await browser.newContext({
				baseURL,
				storageState: {cookies: [], origins: []},
			});
			opened.push(context);

			const page = await context.newPage();
			await new LoginPage(page).login(username, `${username}${username}`);

			return page;
		});

		for (const context of opened) {
			await context.close();
		}
	},
});

/** The five roles an OPS server ships — scenario 8's own claim. */
const OPS_ROLES = [
	'Preprint Server manager',
	'Moderator',
	'Author',
	'Reader',
	'Editorial Board Member',
];

/**
 * A single hyphenless alphanumeric token, per-worker and per-run: it is the
 * server's url path, the invitees' address prefix and the Mailpit scope.
 */
function makeTag() {
	return `u6topsw${test.info().parallelIndex}${Math.random()
		.toString(36)
		.slice(2, 7)}`;
}

/** Local calendar date, the form both the date fields and the tables use. */
function isoDate(daysFromToday = 0) {
	const date = new Date();
	date.setDate(date.getDate() + daysFromToday);

	return [
		date.getFullYear(),
		String(date.getMonth() + 1).padStart(2, '0'),
		String(date.getDate()).padStart(2, '0'),
	].join('-');
}

/**
 * A scratch preprint server with its own manager, plus whatever else the
 * scenario needs.
 *
 * @param {any} opsApi
 * @param {string} tag
 * @param {{users?: object[], invitations?: object[]}} [extra]
 */
async function seedServer(opsApi, tag, extra = {}) {
	return opsApi.createContext({
		tag,
		urlPath: tag,
		name: `U6 preprint server ${tag}`,
		users: [
			{
				username: `${tag}mgr`,
				givenName: 'Mona',
				familyName: 'Manager',
				email: `${tag}mgr@example.org`,
				roles: ['manager'],
			},
			...(extra.users ?? []),
		],
		...(extra.invitations ? {invitations: extra.invitations} : {}),
	});
}

/**
 * The "Accept Invitation" link of the message the app really sent.
 *
 * Seeded invitations hand their URLs back from the endpoint; this is for the
 * ones a test sends through the wizard, where the email is the only source.
 *
 * @param {any} pkpMail
 * @param {string} to
 * @param {string} tag
 * @param {'Accept Invitation'|'Decline Invitation'} linkText
 */
async function linkFromInvitationEmail(pkpMail, to, tag, linkText) {
	const [message] = await pkpMail.find({
		to,
		contains: tag,
		subject: 'You are invited to new roles',
	});
	const full = await pkpMail.fullMessage(message.ID);

	return {url: pkpMail.extractLink(full.HTML, linkText), message: full};
}

test.describe('U6 user invitations', () => {
	test(
		'U6/1 a newcomer is invited from Users & Roles and joins the preprint server',
		{tag: '@smoke'},
		async ({page, opsApi, pkpMail, signIn}) => {
			const tag = makeTag();
			const invitee = `${tag}nadia@example.org`;
			const startDate = isoDate(30);

			await seedServer(opsApi, tag);

			// --- the Preprint Server Manager sends -------------------------
			const managerPage = await signIn(`${tag}mgr`);
			const usersAndRoles = new UsersAndRolesPage(managerPage, tag);
			const wizard = new InvitationWizardPage(managerPage);

			await usersAndRoles.goto();
			await expect(usersAndRoles.heading).toBeVisible();
			await usersAndRoles.inviteButton.click();

			await expect(wizard.pageHeading).toBeVisible();
			await expect(wizard.searchStepHeading).toBeVisible();

			await wizard.search(invitee);

			// Nobody holds a role here under that address, so the wizard offers
			// the newcomer form with the searched address carried into it.
			await expect(wizard.newcomerNotice).toBeVisible();
			await expect(wizard.emailField).toHaveValue(invitee);

			await wizard.givenNameField.fill('Nadia');
			await wizard.familyNameField.fill('Newcomer');
			await wizard.fillRoleRow(0, {role: 'Moderator', startDate});
			await wizard.continueToComposer();
			await wizard.send();
			await expect(wizard.sentDialog).toContainText(invitee);

			// --- the invitation is now pending, and listed as such ----------
			await usersAndRoles.goto();
			const pendingRow = usersAndRoles.invitationRow(invitee);
			await expect(pendingRow).toContainText('Nadia Newcomer');
			await expect(pendingRow).toContainText('Moderator');
			await expect(pendingRow).toContainText(`Invited ${isoDate()}`);

			// --- the invitee's own journey, from the delivered email --------
			const {url: acceptUrl} = await linkFromInvitationEmail(
				pkpMail,
				invitee,
				tag,
				'Accept Invitation',
			);
			expect(acceptUrl, 'the email carries an Accept Invitation link').toBeTruthy();

			const accept = new AcceptInvitationPage(page);

			await page.goto(acceptUrl);
			await expect(accept.accountStepHeading).toBeVisible();
			await accept.createAccount({
				username: `${tag}nadia`,
				password: `${tag}nadiapass`,
			});
			await accept.enterDetails({
				givenName: 'Nadia',
				familyName: 'Newcomer',
				country: 'Canada',
			});
			await expect(accept.rolesTable).toContainText('Moderator');
			await expect(accept.rolesTable).toContainText(startDate);
			await accept.accept();
			await expect(accept.successDialog).toBeVisible();

			// Where the dialog's button leads is A12's business, not this test's.

			// --- the manager finds the newcomer among the server's users ----
			await usersAndRoles.goto();
			const userRow = usersAndRoles.userRow(invitee);
			await expect(userRow).toContainText('Nadia Newcomer');
			await expect(userRow).toContainText('Moderator');
			// The future start date the manager chose is carried through: the role
			// is attached, and dated ahead.
			await expect(userRow).toContainText(startDate);
		},
	);

	test(
		'U6/2 an existing user is invited to an additional role',
		{tag: '@regression'},
		async ({page, opsApi, pkpMail, signIn}) => {
			const tag = makeTag();
			const invitee = `${tag}ed@example.org`;

			await seedServer(opsApi, tag, {
				users: [
					{
						username: `${tag}ed`,
						givenName: 'Ed',
						familyName: 'Existing',
						email: invitee,
						roles: ['author'],
					},
				],
			});

			const managerPage = await signIn(`${tag}mgr`);
			const usersAndRoles = new UsersAndRolesPage(managerPage, tag);
			const wizard = new InvitationWizardPage(managerPage);

			await wizard.gotoCreate(tag);
			await wizard.search(invitee);

			// A role-holder in THIS server: identity read-only, current roles listed.
			await expect(wizard.existingUserNotice).toBeVisible();
			await expect(managerPage.getByRole('heading', {name: 'Given Name'})).toBeVisible();
			await expect(
				wizard.givenNameField,
				'an existing user’s name is shown, not offered for editing',
			).toHaveCount(0);
			await expect(wizard.roleTable).toContainText('Author');

			// Rule 5: the list offers this server's roles MINUS the ones already
			// held — the negative (no "Author") with its own positive control (the
			// four others are all there, from the same read).
			expect(await wizard.roleOptions(0)).toEqual(
				OPS_ROLES.filter((role) => role !== 'Author'),
			);

			await wizard.fillRoleRow(0, {role: 'Moderator', startDate: isoDate()});
			await wizard.continueToComposer();
			await wizard.send();

			// --- the invitee, signed out, gets a single review step ---------
			const {url: acceptUrl} = await linkFromInvitationEmail(
				pkpMail,
				invitee,
				tag,
				'Accept Invitation',
			);
			const accept = new AcceptInvitationPage(page);

			await page.goto(acceptUrl);
			await expect(accept.reviewStepHeading).toBeVisible();
			await expect(
				accept.accountStepHeading,
				'an existing account is offered no account step',
			).toHaveCount(0);
			await expect(
				accept.detailsStepHeading,
				'an existing account is offered no details step',
			).toHaveCount(0);
			await expect(accept.rolesTable).toContainText('Moderator');

			await accept.accept();
			await expect(accept.successDialog).toBeVisible();

			// --- the role is attached to the account they already had -------
			await usersAndRoles.goto();
			const userRow = usersAndRoles.userRow(invitee);
			await expect(userRow).toContainText('Author');
			await expect(userRow).toContainText('Moderator');
		},
	);

	test(
		'U6/3 an invitation is declined from the email’s decline link',
		{tag: '@regression'},
		async ({page, opsApi, signIn}) => {
			const tag = makeTag();
			const invitee = `${tag}dec@example.org`;
			const bystander = `${tag}keep@example.org`;

			const {invitations} = await seedServer(opsApi, tag, {
				invitations: [
					{
						email: invitee,
						roles: ['sectionEditor'],
						givenName: 'Dora',
						familyName: 'Decliner',
					},
					// The control row: a second pending invitation, so "the declined
					// row is gone" cannot be confused with "the table is empty".
					{email: bystander, roles: ['reader'], givenName: 'Ken', familyName: 'Keep'},
				],
			});
			const [declined, kept] = invitations;

			const decline = new AcceptInvitationPage(page);

			await page.goto(declined.declineUrl);
			await expect(decline.declineHeading).toBeVisible();
			await expect(
				page.getByText(/Are you sure you want to decline this invitation\?/),
			).toBeVisible();

			await decline.confirmDeclineButton.click();

			// Rule 11: confirming lands on the server's sign-in page. Nobody was
			// signed in and nobody is now — declining needs no account.
			await page.waitForURL(/\/login/);
			await expect(page.locator('form#login')).toBeVisible();

			// --- the manager's table drops the row --------------------------
			const managerPage = await signIn(`${tag}mgr`);
			const usersAndRoles = new UsersAndRolesPage(managerPage, tag);

			await usersAndRoles.goto();
			await expect(usersAndRoles.invitationRow(kept.email)).toHaveCount(1);
			await expect(usersAndRoles.invitationRow(invitee)).toHaveCount(0);

			// --- and the accept link is spent -------------------------------
			await page.goto(declined.acceptUrl);
			await expect(decline.unavailableHeading).toBeVisible();
			await expect(decline.loginLink).toBeVisible();
			await expect(decline.registerLink).toBeVisible();
		},
	);

	test(
		'U6/4 a pending invitation is cancelled from its row',
		{tag: '@regression'},
		async ({page, opsApi, signIn}) => {
			const tag = makeTag();
			const invitee = `${tag}can@example.org`;
			const bystander = `${tag}keep@example.org`;

			const {invitations} = await seedServer(opsApi, tag, {
				invitations: [
					{
						email: invitee,
						roles: ['sectionEditor'],
						givenName: 'Cara',
						familyName: 'Cancelled',
					},
					{email: bystander, roles: ['reader'], givenName: 'Ken', familyName: 'Keep'},
				],
			});
			const [cancelled, kept] = invitations;

			const managerPage = await signIn(`${tag}mgr`);
			const usersAndRoles = new UsersAndRolesPage(managerPage, tag);

			await usersAndRoles.goto();
			await usersAndRoles.chooseRowAction(invitee, 'Cancel Invite');

			// The dialog states the invitation it is about — email, roles, status.
			await expect(usersAndRoles.cancelDialog).toBeVisible();
			await expect(usersAndRoles.cancelDialog).toContainText(invitee);
			await expect(usersAndRoles.cancelDialog).toContainText('Moderator');
			await expect(usersAndRoles.cancelDialog).toContainText('Invited');

			await usersAndRoles.cancelDialog
				.getByRole('button', {name: 'Cancel Invitation', exact: true})
				.click();

			await expect(usersAndRoles.invitationRow(invitee)).toHaveCount(0);
			await expect(usersAndRoles.invitationRow(kept.email)).toHaveCount(1);

			// The email is already delivered; its link stops working all the same.
			const accept = new AcceptInvitationPage(page);

			await page.goto(cancelled.acceptUrl);
			await expect(accept.unavailableHeading).toBeVisible();
			await expect(accept.loginLink).toBeVisible();
			await expect(accept.registerLink).toBeVisible();
		},
	);

	test(
		'U6/5 a pending invitation is edited and resent',
		{tag: '@regression'},
		async ({page, opsApi, pkpMail, signIn}) => {
			const tag = makeTag();
			const invitee = `${tag}eve@example.org`;

			const {invitations} = await seedServer(opsApi, tag, {
				invitations: [
					{
						email: invitee,
						roles: ['sectionEditor'],
						givenName: 'Eve',
						familyName: 'Edited',
					},
				],
			});
			const [superseded] = invitations;

			const managerPage = await signIn(`${tag}mgr`);
			const usersAndRoles = new UsersAndRolesPage(managerPage, tag);
			const wizard = new InvitationWizardPage(managerPage);

			await usersAndRoles.goto();
			await usersAndRoles.chooseRowAction(invitee, 'Edit');

			await expect(usersAndRoles.editDialog).toContainText(
				'the current invitation will be canceled',
			);
			await usersAndRoles.editDialog
				.getByRole('button', {name: 'Edit Invitation', exact: true})
				.click();

			// The wizard reopens preloaded, on the details step: no search step,
			// because the invitee is already known.
			await managerPage.waitForURL(/\/invitation\/edit\/\d+/);
			await expect(wizard.detailsStepHeading).toBeVisible();
			await expect(
				wizard.searchStepHeading,
				'the search step is omitted when the invitee is known',
			).toHaveCount(0);
			await expect(wizard.emailField).toHaveValue(invitee);
			await expect(wizard.roleTable).toContainText('Moderator');

			await wizard.addAnotherRoleButton.click();
			await wizard.fillRoleRow(1, {
				role: 'Reader',
				startDate: isoDate(),
				masthead: 'Does not appear on the masthead',
			});
			await wizard.continueToComposer();
			await wizard.send();

			// One row per invitee, now carrying the newest invitation's roles.
			await usersAndRoles.goto();
			const row = usersAndRoles.invitationRow(invitee);
			await expect(usersAndRoles.invitationRow(invitee)).toHaveCount(1);
			await expect(row).toContainText('Moderator');
			await expect(row).toContainText('Reader');

			// The second email's link opens the acceptance flow...
			const {url: resentAcceptUrl} = await linkFromInvitationEmail(
				pkpMail,
				invitee,
				tag,
				'Accept Invitation',
			);
			const accept = new AcceptInvitationPage(page);

			await page.goto(resentAcceptUrl);
			await expect(accept.accountStepHeading).toBeVisible();

			// ...and the superseded one does not. WHERE it lands is A14 (a bare
			// not-found page instead of "Invitation Unavailable") — a register
			// defect, so this test asserts only that the dead link is dead.
			await page.goto(superseded.acceptUrl);
			await expect(accept.accountStepHeading).toHaveCount(0);
		},
	);

	test(
		'U6/6 an accept link opened while signed in as someone else is refused',
		{tag: '@regression'},
		async ({opsApi, signIn}) => {
			const tag = makeTag();
			const invitee = `${tag}ed@example.org`;

			const {invitations} = await seedServer(opsApi, tag, {
				users: [
					{
						username: `${tag}ed`,
						givenName: 'Ed',
						familyName: 'Existing',
						email: invitee,
						roles: ['author'],
					},
				],
				invitations: [{user: `${tag}ed`, roles: ['sectionEditor']}],
			});
			const [invitation] = invitations;

			// The manager is signed in — anyone who is not the invitee will do.
			const managerPage = await signIn(`${tag}mgr`);
			const accept = new AcceptInvitationPage(managerPage);

			await managerPage.goto(invitation.acceptUrl);
			await expect(accept.wrongUserDialog).toBeVisible();
			await expect(accept.logoutButton).toBeVisible();

			await accept.logoutButton.click();
			await managerPage.waitForURL(/\/login/);

			// Signed out, the same link resumes the normal acceptance flow.
			await managerPage.goto(invitation.acceptUrl);
			await expect(accept.reviewStepHeading).toBeVisible();
			await expect(accept.rolesTable).toContainText('Moderator');
			await expect(accept.wrongUserDialog).toHaveCount(0);
		},
	);

	test(
		'U6/7 an expired invitation is off the table and its link is dead',
		{tag: '@regression'},
		async ({page, opsApi, signIn}) => {
			const tag = makeTag();
			const lapsed = `${tag}old@example.org`;
			const live = `${tag}new@example.org`;

			// Seeded, never configured: the expiry state comes from the scenario
			// key, which slides one invitation past whatever validity window the
			// fleet is configured for. Shortening that window in the running config
			// would hit every worker and both other fleets (PRINCIPLES design
			// record 9).
			const {invitations} = await seedServer(opsApi, tag, {
				invitations: [
					{
						email: lapsed,
						roles: ['reader'],
						givenName: 'Lena',
						familyName: 'Lapsed',
						status: 'expired',
					},
					{
						email: live,
						roles: ['sectionEditor'],
						givenName: 'Nora',
						familyName: 'New',
					},
				],
			});
			const [expired, pending] = invitations;

			const accept = new AcceptInvitationPage(page);

			await page.goto(expired.acceptUrl);
			await expect(accept.unavailableHeading).toBeVisible();
			await expect(accept.loginLink).toHaveAttribute('href', /\/login$/);
			await expect(accept.registerLink).toHaveAttribute(
				'href',
				/\/user\/register$/,
			);

			// POSITIVE CONTROL, same link shape: the still-valid invitation opens
			// the acceptance flow, so "Unavailable" is about the expiry and not
			// about accept links in general.
			await page.goto(pending.acceptUrl);
			await expect(accept.accountStepHeading).toBeVisible();

			// The manager's table lists only what is still active.
			const managerPage = await signIn(`${tag}mgr`);
			const usersAndRoles = new UsersAndRolesPage(managerPage, tag);

			await usersAndRoles.goto();
			await expect(usersAndRoles.invitationsHeading).toHaveText(
				'Invitations (1)',
			);
			await expect(usersAndRoles.invitationRow(live)).toHaveCount(1);
			await expect(usersAndRoles.invitationRow(lapsed)).toHaveCount(0);
		},
	);

	test(
		'U6/8 inviting on a preprint server: five roles, a masthead selector on every row, and the email that arrives',
		{tag: '@regression'},
		async ({page, opsApi, pkpMail, signIn}) => {
			const tag = makeTag();
			const invitee = `${tag}opa@example.org`;

			await seedServer(opsApi, tag);

			const managerPage = await signIn(`${tag}mgr`);
			const usersAndRoles = new UsersAndRolesPage(managerPage, tag);
			const wizard = new InvitationWizardPage(managerPage);

			await usersAndRoles.goto();
			await usersAndRoles.inviteButton.click();
			await wizard.search(invitee);

			// A preprint server ships exactly five roles, and the wizard offers
			// those five and nothing else.
			expect(await wizard.roleOptions(0)).toEqual(OPS_ROLES);

			// OPS has no reviewer group, so no row can be the one that replaces the
			// masthead choice with fixed text: EVERY row shows the selector.
			await wizard.fillRoleRow(0, {role: 'Moderator', startDate: isoDate()});
			await wizard.addAnotherRoleButton.click();
			await expect(wizard.newRoleRows).toHaveCount(2);
			await expect(
				wizard.newRoleRows.locator('select[name="masthead"]'),
				'every role row offers the Server Masthead choice',
			).toHaveCount(2);
			expect(await wizard.roleOptions(1)).toEqual(OPS_ROLES);

			// Back to one row, so the invitation can be sent.
			await wizard.newRoleRows
				.nth(1)
				.getByRole('button', {name: 'Remove Role'})
				.click();
			await expect(wizard.newRoleRows).toHaveCount(1);

			// The composer step arrives filled in — the template is found, the
			// subject and body are populated before the manager touches anything.
			await wizard.continueToComposer();
			await expect(wizard.templateResults).toContainText(
				'User Invited to Role Notification',
			);
			await expect(wizard.subjectField).toHaveValue(
				'You are invited to new roles',
			);
			await expect(wizard.bodyEditor).toContainText('Invitation to New Role');

			await wizard.send();

			// The email really arrives, carrying both of the recipient's doors.
			const {url: acceptUrl, message} = await linkFromInvitationEmail(
				pkpMail,
				invitee,
				tag,
				'Accept Invitation',
			);
			const declineUrl = pkpMail.extractLink(message.HTML, 'Decline Invitation');

			expect(acceptUrl).toContain('/invitation/accept?id=');
			expect(declineUrl).toContain('/invitation/decline?id=');
			expect(message.Text).toContain('Moderator');

			// And the delivered link really opens the acceptance flow. Walking that
			// flow to its end is U6/1 — which IS this scenario's "run scenario 1 on
			// a preprint server", with the same wizard and the same email.
			const accept = new AcceptInvitationPage(page);

			await page.goto(acceptUrl);
			await expect(accept.accountStepHeading).toBeVisible();

			// NOT asserted here: that the invitation email has no row on OPS's
			// email-templates screen. That is register entry OPS1, an OPEN
			// QUESTION — the team has not settled whether the missing row is
			// intended, and a test must not turn an unsettled question into
			// contract.
		},
	);
});
