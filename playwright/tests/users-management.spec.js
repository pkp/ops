// @ts-check
/**
 * @file playwright/tests/users-management.spec.js
 *
 * Copyright (c) 2014-2026 Simon Fraser University
 * Copyright (c) 2003-2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * U53 "Users management" — the OPS side of the spec
 * (`lib/pkp/docs/product/specs/users-management.md`).
 *
 * The spec's eight COMMON scenarios, each run in OPS's own world: a preprint
 * server, a Preprint Server Manager, Moderators, "Remove this user from this
 * server?", "Server Registration". The spec lists no app-specific scenarios for
 * this feature — OPS's differences here are reductions (no reviewer group, so no
 * Editorial Notes and no locked reviewer masthead row) and register entries, not
 * flows of their own. One test per scenario:
 *
 *   1  find a user and open their record                        U53/1
 *   2  email a user from the list                               U53/2
 *   3  disable an account, then re-enable it                    U53/3
 *   4  remove a user from the preprint server                   U53/4
 *   5  merge a duplicate account                                U53/5
 *   6  add a user from Site Administration                      U53/6
 *   7  a manager meets a shared user                            U53/7
 *   8  one role ended, then all of them                         U53/8
 *
 * ## Isolation, and the destructive half of this feature
 *
 * This feature disables accounts, ends roles and MERGES — which deletes an
 * account permanently and cannot be undone. So: **every account any test here
 * acts on is one that test seeded itself**, in a preprint server that test
 * seeded itself, under the reserved `u53tops` prefix. The shared
 * `publicknowledge` server and its 18 seeded accounts are read-only for this
 * suite (PRINCIPLES principle 1), and the installer's `admin` is never a target:
 * it is the install's only permanent site administrator, and the suite must
 * leave it enabled and unmerged. Where a scenario needs an administrator, it
 * seeds a THROWAWAY one through `users[].roles: ['siteAdmin']` — the only way to
 * get a second administrator, since no screen in any of the three apps grants
 * that role.
 *
 * U53/5 additionally re-reads both usernames out of the merge confirmation and
 * refuses to confirm unless both belong to this test's own namespace. The guard
 * is cheap and the mistake it prevents is not recoverable.
 *
 * Mail is scoped by a unique throwaway recipient address that carries both the
 * app and the test (`u53topsw0abcdmgr@mail.test`): this install has NO Mailpit
 * tags (`GET /api/v1/tags` → `[]`), and one Mailpit serves all three fleets at
 * once. Every silence claim is bounded by a positive control taken the same way.
 *
 * ## What this suite deliberately does NOT cover, and why
 *
 * **Register defects are never asserted as contract** (multi-app convention 3).
 * Three of them stand in this feature's road and the tests read past each:
 *
 *   - **A5 🐞 — the masthead change on OPS.** Changing whether a role shows the
 *     person on the server masthead SAVES and then shows the manager a raw error
 *     naming an internal migration script, and the person it concerns is never
 *     told. That is a confirmed defect, so Rule 8b's masthead half is not
 *     exercised at all here; U53/8 drives only the other single-role operation,
 *     ending a role. **A9 🐞** (the same confirmation says "journal masthead" on
 *     a preprint server, and promises a notice OPS never sends) rides on the
 *     same screen and is likewise unasserted.
 *   - **A3 🐞 — the row-options button's accessible name** is the raw key
 *     `##userAccess.management.options##`. No locator in this suite spells it:
 *     the button is found structurally, so the suite survives the fix.
 *   - **A4 🐞 — the search hint** offers "Journal editor" as its example on a
 *     preprint server. U53/1 searches through that field and never asserts its
 *     text.
 *
 * **Claims parked on an open ❓ are not covered.** A claim the team has not
 * settled is not this suite's to freeze:
 *
 *   - **A2 ❓** — that "Disable User" stays offered on a row the manager can only
 *     partly administer, and refuses inside the dialog. U53/7 asserts the half
 *     that is contract and stable under either resolution: Merge user and
 *     Login As ARE withheld there (against a positive control), and Remove User
 *     is tolerated. Whether Disable dangles is left to the register.
 *   - **A1 ❓ — the notification asymmetry.** U53/4 asserts Remove's silence and
 *     U53/8 asserts that ending one role notifies the person; neither test
 *     asserts that the asymmetry between them is intended, which is the actual
 *     open question.
 *   - **A6 ❓** (a users spreadsheet at a typed address no screen offers),
 *     **A8 ❓** (the two lists describe a site administrator differently) and
 *     **OPS1 ❓'s listing half** (neither role-change notice has a row on OPS's
 *     Manage Emails screen) — none is asserted. OPS1's CONFIRMED half is: the
 *     role-ended notice is still SENT on OPS even though it cannot be edited
 *     there, and U53/8 asserts exactly that.
 *
 * **Out of scope for this suite** (owned elsewhere, or unreachable here):
 * the "Confirm Access" password re-prompt (A7 ✅ — it needs a server
 * configuration change, which a retained test may never make: PRINCIPLES design
 * record 9); the Hosted Servers users filter's own controls (role dropdown,
 * "Include users with no roles in this server.") and its collapse behaviour;
 * pagination past 25 users; the ORCID mark in the Name cell; "Login As", which
 * renders among these row actions but belongs to *Login & sessions*; the user
 * edit page's own shape, which is *User invitations*' (its Rule 4b) — this suite
 * uses only the two operations that page drives for U53; the Editorial Notes
 * field and the locked reviewer masthead row, which cannot exist on OPS because
 * it ships no reviewer group; and the second, older address to Users & Roles.
 *
 * **One spec claim this suite contradicts.** Scenario 1 says the row's "Edit"
 * opens the user's edit page "headed with their name". On OPS it does not: the
 * page's `<h1>` is EMPTY (the missing heading *User invitations* records in its
 * Rule 4b), the breadcrumb reads "Users & Roles / Invite user to take a role"
 * and the only heading is the step's, "STEP 1 - Enter details and invite for
 * roles". U53/1 therefore asserts that the page opened is the right user's — by
 * the account it carries — and not that it is headed with their name.
 */

const base = require('../support/fixtures.js');
const {LoginPage} = require('../../lib/pkp/playwright/pages/LoginPage.js');
const {UsersAndRolesPage} = require('../pages/UsersAndRolesPage.js');
const {InvitationWizardPage} = require('../pages/InvitationWizardPage.js');
const {HostedServersPage} = require('../pages/HostedServersPage.js');

const expect = base.expect;

/**
 * The suite's own fixtures: sessions for THROWAWAY accounts.
 *
 * `asUser` is the wrong tool — it caches a storage state per username, and these
 * usernames exist for one test only. `signIn` expects the sign-in to succeed;
 * `submitCredentials` does not, which is what a disabled account needs.
 */
const test = base.test.extend({
	session: async ({browser, baseURL}, use) => {
		/** @type {import('@playwright/test').BrowserContext[]} */
		const opened = [];

		await use(async () => {
			const context = await browser.newContext({
				baseURL,
				storageState: {cookies: [], origins: []},
			});
			opened.push(context);

			return context.newPage();
		});

		for (const context of opened) {
			await context.close();
		}
	},

	signIn: async ({session}, use) => {
		await use(async (username) => {
			const page = await session();
			await new LoginPage(page).login(username, `${username}${username}`);

			return page;
		});
	},

	/** Submit the sign-in form and return, whatever the server answers. */
	submitCredentials: async ({session}, use) => {
		await use(async (username) => {
			const page = await session();
			const login = new LoginPage(page);

			await login.goto();
			await login.username.fill(username);
			await login.fillPassword(`${username}${username}`);
			await login.submitButton.click();

			return page;
		});
	},
});

/** The five roles a preprint server ships, in the order its screens list them. */
const OPS_ROLES = [
	'Preprint Server manager',
	'Moderator',
	'Author',
	'Reader',
	'Editorial Board Member',
];

/** Every action the list offers on a row the viewer fully administers. */
const FULL_ROW_ACTIONS = [
	'Edit',
	'Email',
	'Login As',
	'Remove User',
	'Disable User',
	'Merge user',
];

/**
 * A single hyphenless alphanumeric token, per worker and per run. It is the
 * server's url path, every throwaway's username stem, every mail address and
 * every Mailpit scope — so one token keeps this test's world apart from the two
 * sibling fleets seeding at the same moment.
 */
function makeTag() {
	return `u53topsw${test.info().parallelIndex}${Math.random()
		.toString(36)
		.slice(2, 7)}`;
}

/** Today, in the form the list's Start Date column prints. */
function today() {
	const date = new Date();

	return [
		date.getFullYear(),
		String(date.getMonth() + 1).padStart(2, '0'),
		String(date.getDate()).padStart(2, '0'),
	].join('-');
}

/**
 * A scratch preprint server with its own throwaway manager.
 *
 * The manager is a throwaway rather than `admin`: `admin` is auto-enrolled as
 * every scratch server's manager (so it is always in these lists, +1 on every
 * count) and using it would quietly substitute a site administrator for the
 * Preprint Server Manager the scenarios name.
 *
 * @param {any} opsApi
 * @param {string} tag
 * @param {{users?: object[], contact?: boolean, name?: string}} [extra]
 */
async function seedServer(opsApi, tag, extra = {}) {
	return opsApi.createContext({
		tag,
		urlPath: tag,
		name: extra.name ?? `U53 preprint server ${tag}`,
		...(extra.contact
			? {
					contactName: 'U53 Contact Person',
					contactEmail: `${tag}contact@mail.test`,
				}
			: {}),
		users: [
			{
				username: `${tag}mgr`,
				givenName: 'Mona',
				familyName: 'Manager',
				email: `${tag}mgr@mail.test`,
				roles: ['manager'],
			},
			...(extra.users ?? []),
		],
	});
}

/**
 * Send a message from a row of the users list, as a POSITIVE CONTROL bounding a
 * silence claim: it proves mail from this screen, this session and this moment
 * really does reach Mailpit, so "nothing arrived for the target" means nothing
 * was sent rather than nothing has arrived yet.
 *
 * @param {UsersAndRolesPage} usersAndRoles
 * @param {string} email the control recipient
 * @param {string} marker
 */
async function sendControlMessage(usersAndRoles, email, marker) {
	await usersAndRoles.goto();
	await usersAndRoles.chooseUserAction(email, 'Email');
	await usersAndRoles.emailForm.waitFor();
	await usersAndRoles.sendEmail({
		subject: marker,
		body: `Positive control for ${marker}.`,
	});
}

test.describe('U53 users management', () => {
	test(
		'U53/1 a manager finds a user by searching the list and opens their record',
		{tag: '@smoke'},
		async ({opsApi, signIn}) => {
			const tag = makeTag();
			const target = `${tag}two@mail.test`;

			const {users} = await seedServer(opsApi, tag, {
				users: [
					{
						username: `${tag}two`,
						givenName: 'Tara',
						familyName: 'Tworole',
						email: target,
						affiliation: 'Zeppelin Institute',
						roles: ['sectionEditor', 'reader'],
					},
					// Two bystanders, so "the list narrowed" is a real narrowing.
					{
						username: `${tag}oth`,
						givenName: 'Otto',
						familyName: 'Othername',
						email: `${tag}oth@mail.test`,
						affiliation: 'Marlowe College',
						roles: ['author'],
					},
					{
						username: `${tag}thi`,
						givenName: 'Thea',
						familyName: 'Thirdname',
						email: `${tag}thi@mail.test`,
						affiliation: 'Marlowe College',
						roles: ['reader'],
					},
				],
			});

			const managerPage = await signIn(`${tag}mgr`);
			const usersAndRoles = new UsersAndRolesPage(managerPage, tag);

			await usersAndRoles.goto();
			await expect(usersAndRoles.heading).toBeVisible();

			// The heading counts what the list currently holds: the three
			// throwaways, their manager, and the administrator every scratch server
			// enrols as its creator.
			const everyone = await usersAndRoles.userCount();
			expect(everyone).toBeGreaterThanOrEqual(4);

			// Search runs on Enter — the field offers no button, and typing alone
			// changes nothing.
			await usersAndRoles.searchUsers('Tworole');
			await expect(usersAndRoles.usersHeading).toHaveText('Current Users (1)');

			const row = usersAndRoles.userRow(target);

			await expect(row).toHaveCount(1);
			await expect(row).toContainText('Tara Tworole');
			await expect(row).toContainText(target);
			// Each current role, with the date it began, and the affiliation.
			await expect(row).toContainText('Moderator');
			await expect(row).toContainText('Reader');
			await expect(row).toContainText(today());
			await expect(row).toContainText('Zeppelin Institute');

			// The search matches role labels and affiliations too, in the app's own
			// vocabulary: OPS has Moderators where OJS has Section editors.
			await usersAndRoles.searchUsers('Marlowe College');
			await expect(usersAndRoles.usersHeading).toHaveText('Current Users (2)');

			await usersAndRoles.searchUsers('Moderator');
			await expect(usersAndRoles.usersHeading).toHaveText('Current Users (1)');
			await expect(usersAndRoles.userRow(target)).toHaveCount(1);

			// --- open the record ------------------------------------------------
			await usersAndRoles.chooseUserAction(target, 'Edit');

			const wizard = new InvitationWizardPage(managerPage);

			await managerPage.waitForURL(
				new RegExp(`/management/settings/user/${users[`${tag}two`]}$`),
			);
			await expect(wizard.detailsStepHeading).toBeVisible();

			// The page carries THIS user: their address, their name, their roles.
			// It is not headed with their name — see the file header's note on the
			// spec's scenario 1.
			// An account that already holds a role here is shown read-only, so the
			// identity is text on the page rather than fields.
			await expect(managerPage.locator('main')).toContainText(target);
			await expect(managerPage.locator('main')).toContainText('Tara');
			await expect(managerPage.locator('main')).toContainText('Tworole');
			await expect(wizard.roleRow('Moderator')).toHaveCount(1);
			await expect(wizard.roleRow('Reader')).toHaveCount(1);
		},
	);

	test(
		'U53/2 a manager emails a user from the list, and from their own row',
		{tag: '@regression'},
		async ({opsApi, pkpMail, signIn}) => {
			const tag = makeTag();
			const target = `${tag}tgt@mail.test`;
			const manager = `${tag}mgr@mail.test`;

			await seedServer(opsApi, tag, {
				users: [
					{
						username: `${tag}tgt`,
						givenName: 'Tess',
						familyName: 'Target',
						email: target,
						roles: ['sectionEditor'],
					},
				],
			});

			const managerPage = await signIn(`${tag}mgr`);
			const usersAndRoles = new UsersAndRolesPage(managerPage, tag);

			await usersAndRoles.goto();
			await usersAndRoles.chooseUserAction(target, 'Email');
			await usersAndRoles.emailForm.waitFor();

			// Subject and Body are the manager's to fill; To is fixed, naming the
			// recipient in full, and cannot be edited.
			const to = usersAndRoles.emailForm.locator('input[name=user]');

			await expect(to).toHaveValue(`Tess Target <${target}>`);
			await expect(to).toBeDisabled();
			expect(
				await usersAndRoles.emailForm.locator('label').allTextContents(),
			).toEqual(['Subject*', 'To', 'Body*']);

			const subject = `${tag} message to a user`;

			await usersAndRoles.sendEmail({
				subject,
				body: `Body of ${tag}, typed by the manager.`,
			});

			const [delivered] = await pkpMail.find({to: target, subject});
			const full = await pkpMail.fullMessage(delivered.ID);

			expect(delivered.Subject).toBe(subject);
			// From the manager's OWN address — a reply reaches the person who wrote.
			expect(full.From.Address).toBe(manager);
			expect(full.Text).toContain(`Body of ${tag}, typed by the manager.`);

			// The one action with no target-based restriction: the manager's own row
			// offers exactly Edit and Email, and the Email really sends.
			await usersAndRoles.goto();
			expect(await usersAndRoles.userActions(manager)).toEqual(['Edit', 'Email']);

			const ownSubject = `${tag} message to myself`;

			await usersAndRoles.chooseUserAction(manager, 'Email');
			await usersAndRoles.emailForm.waitFor();
			await usersAndRoles.sendEmail({
				subject: ownSubject,
				body: `Body of ${tag}, to my own account.`,
			});

			const [self] = await pkpMail.find({to: manager, subject: ownSubject});

			expect(self.Subject).toBe(ownSubject);
		},
	);

	test(
		'U53/3 a manager disables an account and later re-enables it',
		{tag: '@regression'},
		async ({opsApi, pkpMail, signIn, submitCredentials}) => {
			const tag = makeTag();
			const victim = `${tag}dis@mail.test`;
			const control = `${tag}ctl@mail.test`;
			const reason = `${tag} kept signing in from two places at once`;

			await seedServer(opsApi, tag, {
				users: [
					{
						username: `${tag}dis`,
						givenName: 'Dee',
						familyName: 'Disabled',
						email: victim,
						roles: ['sectionEditor'],
					},
					{
						username: `${tag}ctl`,
						givenName: 'Cora',
						familyName: 'Control',
						email: control,
						roles: ['reader'],
					},
				],
			});

			const managerPage = await signIn(`${tag}mgr`);
			const usersAndRoles = new UsersAndRolesPage(managerPage, tag);

			await usersAndRoles.goto();

			// The account holds roles in this server and nowhere else, so this
			// manager fully administers it.
			expect(await usersAndRoles.userActions(victim)).toEqual(FULL_ROW_ACTIONS);

			await usersAndRoles.chooseUserAction(victim, 'Disable User');
			await expect(usersAndRoles.disableDialog).toContainText('Disable Dee Disabled');
			await expect(usersAndRoles.disableDialog).toContainText(
				'Current Roles : Moderator',
			);

			// A form, not a yes/no confirmation.
			await usersAndRoles.disableDialog.locator('textarea').fill(reason);
			await usersAndRoles.disableDialog
				.getByRole('button', {name: 'OK', exact: true})
				.click();
			await expect(usersAndRoles.disableDialog).toBeHidden();

			await usersAndRoles.goto();
			await expect(usersAndRoles.disabledMark(victim)).toHaveCount(1);
			expect(await usersAndRoles.userActions(victim)).toEqual([
				'Edit',
				'Email',
				'Login As',
				'Remove User',
				'Enable User',
				'Merge user',
			]);

			// --- as the person: refused, with the manager's reason quoted back ---
			const refused = await submitCredentials(`${tag}dis`);

			await expect(
				refused.getByText(
					`Your account has been disabled for the following reason: ${reason}`,
				),
			).toBeVisible();
			await expect(refused.locator('form#login')).toBeVisible();

			// --- and no mail told them, nor the enable that follows --------------
			await sendControlMessage(usersAndRoles, control, `${tag} control disable`);
			await pkpMail.expectNone({
				to: victim,
				contains: tag,
				afterControl: {to: control, subject: `${tag} control disable`},
			});

			// --- enable again: the earlier reason is still in the box ------------
			await usersAndRoles.goto();
			await usersAndRoles.chooseUserAction(victim, 'Enable User');
			await expect(usersAndRoles.enableDialog).toContainText('Enable Dee Disabled');
			await expect(usersAndRoles.enableDialog.locator('textarea')).toHaveValue(
				reason,
			);

			await usersAndRoles.enableDialog
				.getByRole('button', {name: 'OK', exact: true})
				.click();
			await expect(usersAndRoles.enableDialog).toBeHidden();

			await usersAndRoles.goto();
			await expect(usersAndRoles.disabledMark(victim)).toHaveCount(0);

			// The person signs in again, exactly as before.
			const restored = await signIn(`${tag}dis`);

			await expect(restored).not.toHaveURL(/\/login/);
		},
	);

	test(
		'U53/4 a manager removes a user from the preprint server',
		{tag: '@regression'},
		async ({opsApi, pkpMail, signIn}) => {
			const tag = makeTag();
			const target = `${tag}rem@mail.test`;
			const control = `${tag}ctl@mail.test`;

			await seedServer(opsApi, tag, {
				users: [
					{
						username: `${tag}rem`,
						givenName: 'Rita',
						familyName: 'Removed',
						email: target,
						roles: ['sectionEditor'],
					},
					{
						username: `${tag}ctl`,
						givenName: 'Cora',
						familyName: 'Control',
						email: control,
						roles: ['reader'],
					},
				],
			});

			const managerPage = await signIn(`${tag}mgr`);
			const usersAndRoles = new UsersAndRolesPage(managerPage, tag);

			await usersAndRoles.goto();

			const before = await usersAndRoles.userCount();

			await expect(usersAndRoles.userRow(target)).toContainText('Moderator');

			await usersAndRoles.chooseUserAction(target, 'Remove User');

			// One confirmation, in the preprint server's own words.
			await expect(usersAndRoles.removeDialog).toContainText(
				'Remove this user from this server? This action will unenroll the user from all roles within this server.',
			);
			await usersAndRoles.removeDialog
				.getByRole('button', {name: 'OK', exact: true})
				.click();
			await expect(usersAndRoles.removeDialog).toBeHidden();

			// The row stays, its Roles and Start Date cells now empty, and the count
			// does not move — the account survives, only its roles here ended.
			await usersAndRoles.goto();
			await expect(usersAndRoles.userRow(target)).toHaveCount(1);
			await expect(usersAndRoles.userRow(target)).not.toContainText('Moderator');
			await expect(usersAndRoles.userRow(target)).not.toContainText(today());
			expect(await usersAndRoles.userCount()).toBe(before);

			// With no active role left here, the action is no longer offered.
			expect(await usersAndRoles.userActions(target)).not.toContain('Remove User');

			// Nothing was mailed to them, bounded by a control sent from this very
			// screen moments later.
			await sendControlMessage(usersAndRoles, control, `${tag} control remove`);
			await pkpMail.expectNone({
				to: target,
				contains: tag,
				afterControl: {to: control, subject: `${tag} control remove`},
			});

			// And the account still signs in.
			const stillWorks = await signIn(`${tag}rem`);

			await expect(stillWorks).not.toHaveURL(/\/login/);
		},
	);

	test(
		'U53/5 an administrator merges a duplicate account into the one that survives',
		{tag: '@regression'},
		async ({opsApi, signIn, submitCredentials}) => {
			const tag = makeTag();
			const duplicateName = `${tag}dup`;
			const survivorName = `${tag}sur`;
			const duplicate = `${duplicateName}@mail.test`;
			const survivor = `${survivorName}@mail.test`;

			await seedServer(opsApi, tag, {
				users: [
					// The actor: a THROWAWAY site administrator. The install's own
					// `admin` is never used for this — a merge deletes an account, and
					// this suite must leave the only permanent administrator untouched.
					// It also holds the manager role, so reaching the server's own
					// settings screen is not the thing under test.
					{
						username: `${tag}adm`,
						givenName: 'Ada',
						familyName: 'Administrator',
						email: `${tag}adm@mail.test`,
						roles: ['siteAdmin', 'manager'],
					},
					{
						username: duplicateName,
						givenName: 'Dana',
						familyName: 'Duplicate',
						email: duplicate,
						roles: ['sectionEditor'],
					},
					{
						username: survivorName,
						givenName: 'Sven',
						familyName: 'Survivor',
						email: survivor,
						roles: ['author'],
					},
				],
			});

			const adminPage = await signIn(`${tag}adm`);
			const usersAndRoles = new UsersAndRolesPage(adminPage, tag);

			await usersAndRoles.goto();

			const before = await usersAndRoles.userCount();

			await usersAndRoles.chooseUserAction(duplicate, 'Merge user');
			await expect(usersAndRoles.mergeModal).toBeVisible();

			// A second user list. The duplicate is listed among the candidates —
			// only its own action is withheld, so it cannot be merged into itself.
			await expect(usersAndRoles.mergeCandidateRow(duplicateName)).toHaveCount(1);
			await expect(
				usersAndRoles.mergeCandidateRow(duplicateName).locator('a.show_extras'),
			).toHaveCount(0);

			await usersAndRoles.mergeInto(survivorName);

			// The confirmation names both accounts and says what it means.
			await expect(usersAndRoles.mergeConfirmDialog).toContainText(
				`Are you sure you wish to merge the account with the username "${duplicateName}" into the account with the username "${survivorName}"? The account with the username "${duplicateName}" will not exist afterwards. This action is not reversible.`,
			);

			// GUARD. A merge cannot be undone, so the two usernames are read back
			// out of the rendered dialog and matched against this test's own
			// namespace before anything is confirmed.
			const named = (
				(await usersAndRoles.mergeConfirmDialog.innerText()).match(/"([^"]+)"/g) ??
				[]
			).map((quoted) => quoted.replaceAll('"', ''));

			expect(new Set(named), 'the merge names only this test’s own accounts').toEqual(
				new Set([duplicateName, survivorName]),
			);

			await usersAndRoles.mergeConfirmDialog
				.getByRole('button', {name: 'OK', exact: true})
				.click();
			await expect(usersAndRoles.mergeConfirmDialog).toBeHidden();

			// The duplicate's row is gone at once and the count drops by one.
			await expect(usersAndRoles.userRow(duplicate)).toHaveCount(0);
			await expect
				.poll(async () => usersAndRoles.userCount())
				.toBe(before - 1);

			// Its username is thereafter refused as unknown — not as disabled: the
			// account is gone.
			const refused = await submitCredentials(duplicateName);

			await expect(
				refused.getByText('Invalid username/email or password. Please try again.'),
			).toBeVisible();

			// The survivor now carries the duplicate's role beside its own, dated as
			// it always was.
			await usersAndRoles.goto();

			const survivingRow = usersAndRoles.userRow(survivor);

			await expect(survivingRow).toContainText('Author');
			await expect(survivingRow).toContainText('Moderator');
			await expect(survivingRow).toContainText(today());
		},
	);

	test(
		'U53/6 a site administrator adds a user from Administration → Hosted Servers',
		{tag: '@regression'},
		async ({opsApi, pkpMail, signIn}) => {
			const tag = makeTag();
			const newUser = `${tag}new`;
			const newAddress = `${newUser}@mail.test`;

			await seedServer(opsApi, tag, {
				contact: true,
				users: [
					{
						username: `${tag}adm`,
						givenName: 'Ada',
						familyName: 'Administrator',
						email: `${tag}adm@mail.test`,
						roles: ['siteAdmin'],
					},
				],
			});

			// A throwaway administrator with no role in the server at all — this
			// surface is the site's, not the server's.
			const adminPage = await signIn(`${tag}adm`);
			const hosted = new HostedServersPage(adminPage);

			await hosted.gotoAdministration();
			await hosted.openHostedServers();
			await hosted.openSettingsWizard(tag);
			await hosted.openUsersTab();

			// The older list: same accounts, different dressing — five columns, and
			// an "Add User" the Users & Roles list does not offer.
			await expect(hosted.usersGridHeading).toHaveText('Current Users');
			expect(
				(
					await hosted.usersGrid.locator('table thead th').allTextContents()
				).map((column) => column.replace(/\s+/g, ' ').trim()),
			).toEqual(['Given Name', 'Family Name', 'Username', 'Roles', 'Email']);

			await hosted.openAddUser();
			await expect(hosted.accountFormHeading).toHaveText(
				'Step #1: Fill in User Details',
			);

			// Country is left blank on purpose: it is optional, and the save must
			// not complain.
			await hosted.fillAccountDetails({
				givenName: 'Nina',
				username: newUser,
				email: newAddress,
				password: 'U53topsPassword1',
				notify: true,
			});

			await expect(hosted.roleFormHeading).toHaveText(
				'Step #2: Add User Roles to Nina',
			);
			// A preprint server ships exactly five roles, and step 2 offers those.
			expect(await hosted.offeredRoles()).toEqual(OPS_ROLES);

			await hosted.assignRole('Author');

			await expect(hosted.userRow(newUser)).toContainText('Author');
			await expect(hosted.userRow(newUser)).toContainText(newAddress);

			// The welcome email reaches the address, in the preprint server's own
			// words, with the server's contact address to reply to.
			const [welcome] = await pkpMail.find({
				to: newAddress,
				subject: 'Server Registration',
			});
			const full = await pkpMail.fullMessage(welcome.ID);

			expect(full.ReplyTo[0].Address).toBe(`${tag}contact@mail.test`);
			expect(full.Text).toContain(newUser);

			// And the account is in the server's own Users & Roles list, with the
			// role that was ticked.
			const managerPage = await signIn(`${tag}mgr`);
			const usersAndRoles = new UsersAndRolesPage(managerPage, tag);

			await usersAndRoles.goto();

			const row = usersAndRoles.userRow(newAddress);

			await expect(row).toContainText('Nina');
			await expect(row).toContainText('Author');
		},
	);

	test(
		'U53/7 a manager meets a user who also belongs to another preprint server',
		{tag: '@regression'},
		async ({opsApi, signIn}) => {
			const tag = makeTag();
			const otherTag = `${tag}b`;
			const shared = `${tag}sh@mail.test`;
			const hereOnly = `${tag}loc@mail.test`;

			await seedServer(opsApi, tag, {
				users: [
					{
						username: `${tag}sh`,
						givenName: 'Sasha',
						familyName: 'Shared',
						email: shared,
						roles: ['sectionEditor'],
					},
					{
						username: `${tag}loc`,
						givenName: 'Lena',
						familyName: 'Localonly',
						email: hereOnly,
						roles: ['sectionEditor'],
					},
				],
			});

			// A second preprint server, with its own manager, where the same person
			// holds a role this manager has no say over.
			await opsApi.createContext({
				tag: otherTag,
				urlPath: otherTag,
				name: `U53 preprint server ${otherTag}`,
				users: [
					{
						username: `${otherTag}mgr`,
						givenName: 'Bruno',
						familyName: 'Bmanager',
						email: `${otherTag}mgr@mail.test`,
						roles: ['manager'],
					},
					{username: `${tag}sh`, roles: ['author']},
				],
			});

			const managerPage = await signIn(`${tag}mgr`);
			const usersAndRoles = new UsersAndRolesPage(managerPage, tag);

			await usersAndRoles.goto();

			// This manager only partly administers the shared account, and the list
			// withholds the two actions that need full administration.
			const sharedActions = await usersAndRoles.userActions(shared);

			expect(sharedActions).not.toContain('Merge user');
			expect(sharedActions).not.toContain('Login As');

			// POSITIVE CONTROL, same list, same session: a user whose only roles are
			// here offers both. The withholding tracks the target, not the screen.
			expect(await usersAndRoles.userActions(hereOnly)).toEqual(FULL_ROW_ACTIONS);

			// Remove needs only this server's say-so, and it is accepted.
			await usersAndRoles.chooseUserAction(shared, 'Remove User');
			await usersAndRoles.removeDialog
				.getByRole('button', {name: 'OK', exact: true})
				.click();
			await expect(usersAndRoles.removeDialog).toBeHidden();

			await usersAndRoles.goto();
			await expect(usersAndRoles.userRow(shared)).toHaveCount(1);
			await expect(usersAndRoles.userRow(shared)).not.toContainText('Moderator');

			// The other server's role is untouched — read from that server's own
			// list, as its own manager.
			const otherManagerPage = await signIn(`${otherTag}mgr`);
			const otherList = new UsersAndRolesPage(otherManagerPage, otherTag);

			await otherList.goto();
			await expect(otherList.userRow(shared)).toContainText('Author');

			// And the account itself is unharmed: it still signs in.
			const stillWorks = await signIn(`${tag}sh`);

			await expect(stillWorks).not.toHaveURL(/\/login/);
		},
	);

	test(
		'U53/8 one role is ended and the person is told; then Remove ends the rest',
		{tag: '@regression'},
		async ({opsApi, pkpMail, signIn}) => {
			const tag = makeTag();
			const target = `${tag}two@mail.test`;

			const {users} = await seedServer(opsApi, tag, {
				users: [
					{
						username: `${tag}two`,
						givenName: 'Tara',
						familyName: 'Tworole',
						email: target,
						roles: ['sectionEditor', 'reader'],
					},
				],
			});

			const managerPage = await signIn(`${tag}mgr`);
			const usersAndRoles = new UsersAndRolesPage(managerPage, tag);
			const wizard = new InvitationWizardPage(managerPage);

			// --- end ONE role, from the user's own record ------------------------
			await managerPage.goto(
				InvitationWizardPage.editUserUrl(tag, users[`${tag}two`]),
			);
			await expect(wizard.detailsStepHeading).toBeVisible();

			await expect(wizard.removeRoleDialog).toHaveCount(0);
			await wizard.roleRow('Reader').getByRole('button', {name: 'Remove Role'}).click();
			await expect(wizard.removeRoleDialog).toContainText(
				'Are you sure you want to remove this role? The user will lose access and permissions associated with it.',
			);
			await wizard.removeRoleDialog
				.getByRole('button', {name: 'Remove Role', exact: true})
				.click();
			await expect(wizard.removeRoleDialog).toBeHidden();

			// The ended role keeps its history: it stays on the record with an end
			// date and a badge in place of its button.
			await expect(wizard.roleRow('Reader')).toContainText(
				'User Removed From Role',
			);
			await expect(wizard.roleRow('Moderator')).toContainText('Remove Role');

			// Ending ONE role always tells the person. On OPS this is the confirmed
			// half of OPS1: the notice is still sent here, even though a manager
			// finds no row for it on this app's Manage Emails screen (whether that
			// absence is intended is the register's open question, not this test's).
			const [notice] = await pkpMail.find({
				to: target,
				subject: 'You have been removed from a role',
				contains: tag,
			});
			const full = await pkpMail.fullMessage(notice.ID);

			expect(full.From.Address).toBe(`${tag}mgr@mail.test`);
			expect(full.Text).toContain('Reader');

			// --- then Remove, which ends what is left in one stroke --------------
			await usersAndRoles.goto();
			await expect(usersAndRoles.userRow(target)).toContainText('Moderator');

			await usersAndRoles.chooseUserAction(target, 'Remove User');
			await usersAndRoles.removeDialog
				.getByRole('button', {name: 'OK', exact: true})
				.click();
			await expect(usersAndRoles.removeDialog).toBeHidden();

			await usersAndRoles.goto();
			await expect(usersAndRoles.userRow(target)).toHaveCount(1);
			await expect(usersAndRoles.userRow(target)).not.toContainText('Moderator');

			// The account survives both operations.
			const stillWorks = await signIn(`${tag}two`);

			await expect(stillWorks).not.toHaveURL(/\/login/);
		},
	);
});
