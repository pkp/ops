// @ts-check
/**
 * @file playwright/fixtures/bootstrap.js
 *
 * Copyright (c) 2014-2026 Simon Fraser University
 * Copyright (c) 2003-2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * The OPS base seed, as data.
 *
 * `POST /api/v1/_test/bootstrap` walks the application to this state through its
 * real services, so what follows is the whole definition of the world every OPS
 * test starts in. Two rules govern it:
 *
 * 1. **The base server is READ-ONLY.** No test may change its settings, its
 *    section, its categories or its seeded users — a test that needs
 *    server-level mutations creates a scratch server instead. That is what makes
 *    parallel workers safe.
 * 2. **Richer defaults are deliberate.** The seed enables what most real
 *    preprint servers enable, so tests exercise representative configuration
 *    rather than an empty install. A change here means re-checking every
 *    implemented spec against the new defaults.
 */

const {users, byUsername} = require('../../lib/pkp/playwright/data/users.js');

/**
 * How each seeded user is enrolled in `publicknowledge`.
 *
 * Keys are OPS user-group name keys (`registry/userGroups.xml`, minus the
 * `default.groups.name.` prefix) — resolution is by that key, not by role id or
 * translated name. OPS ships exactly five groups:
 *
 *   manager              Preprint Server Manager   ROLE_ID_MANAGER
 *   sectionEditor        Moderator                 ROLE_ID_SUB_EDITOR
 *   author               Author                    ROLE_ID_AUTHOR
 *   reader               Reader                    ROLE_ID_READER
 *   editorialBoardMember Editorial Board Member    ROLE_ID_ASSISTANT
 *
 * There is **no editor group and no reviewer group** (APP-GLOSSARY §1), so
 * `editor.diana` and every `reviewer.*` account from the shared roster is
 * deliberately absent here and null in `seed.actors`.
 *
 * MODERATOR = THE SUB-EDITOR SLOT. OPS's on-screen "Moderator" is the group
 * whose name key is `sectionEditor`, which is why the shared roster's
 * `sectioneditor.*` accounts fill it: the roster is keyed by permission
 * ARCHETYPE, not by an app's label for it.
 *
 * `sections` assigns the user as an editor of those sections, exactly as the
 * Sections settings form does. On OPS that is not decoration: a Moderator holds
 * ROLE_ID_SUB_EDITOR, so they see only submissions they are assigned to, and
 * `SubEditorsDAO::assignEditors()` (run when a preprint is submitted) is what
 * assigns them. `sectioneditor.omar` is deliberately left UNASSIGNED so a test
 * has a same-role negative control for visibility.
 *
 * `admin` is absent on purpose: the installer creates it, and creating the
 * server enrols the creating user as its manager.
 *
 * @type {Record<string, {roles: string[], sections?: string[]}>}
 */
const enrolments = {
	'manager.maya': {roles: ['manager']},
	'sectioneditor.ana': {roles: ['sectionEditor'], sections: ['PRE']},
	'sectioneditor.ravi': {roles: ['sectionEditor'], sections: ['PRE']},
	// The same role, no section assignment — the control that makes an
	// "assigned moderator can see it" assertion mean something.
	'sectioneditor.omar': {roles: ['sectionEditor']},
	'author.alex': {roles: ['author']},
	'author.bea': {roles: ['author']},
	// OPS's only assistant-role group is Editorial Board Member, and it is
	// declared with NO workflow stages at all (`stages=""` in
	// registry/userGroups.xml) — unlike OJS's Funding coordinator, which reaches
	// the review stage. Seeded under the same roster name so the archetype is
	// available, but a test must not assume workflow access from it.
	'assistant.rita': {roles: ['editorialBoardMember']},
	'reader.rosa': {roles: ['reader']},
};

/** The seeded accounts, in roster order. */
function bootstrapUsers() {
	return users
		.filter((user) => enrolments[user.username])
		.map((user) => ({
			username: user.username,
			givenName: user.givenName,
			familyName: user.familyName,
			email: user.email,
			affiliation: 'Public Knowledge Project',
			country: 'CA',
			...enrolments[user.username],
		}));
}

/**
 * The full bootstrap payload.
 *
 * @returns {object}
 */
function bootstrapPayload() {
	return {
		context: {
			urlPath: 'publicknowledge',
			name: 'Public Knowledge Preprint Server',
			acronym: 'PKPS',
			description:
				'The Public Knowledge Preprint Server is the test fixture server every OPS end-to-end test starts from.',
			primaryLocale: 'en',
			// Multilingual on purpose: a bare front-end URL 302s to the
			// locale-prefixed form only on a multi-locale context, and that
			// difference has bitten enough probes to be worth having in the base.
			supportedLocales: ['en', 'fr_CA'],

			// A context with no contact address cannot accept a submission: the
			// acknowledgement mail fails for want of a From header AFTER the
			// submission is marked submitted.
			contactName: 'Ramiro Vaca',
			contactEmail: 'rvaca@mailinator.com',
			supportName: 'Ramiro Vaca',
			supportEmail: 'rvaca@mailinator.com',
			mailingAddress: '123 456th Street\nBurnaby, British Columbia\nCanada',

			copyrightNotice:
				'Authors who post to this server agree to the terms of the test fixture licence.',

			enableAnnouncements: true,
			enablePublicComments: true,
			disableSubmissions: false,

			keywords: 'request',
			citations: 'request',

			// OPS overlay. The two settings that decide what "post the preprint"
			// means on this server: screening off (a moderator posts, authors do
			// not post themselves) and the author told when the first version
			// goes live. Stated rather than left implicit, because the whole
			// workflow story turns on them.
			enableAuthorScreening: false,
			postedAcknowledgement: true,

			// ONE section. Creating a server already creates it — "Preprints",
			// abbreviated PRE — so naming PRE here EDITS that section instead of
			// leaving a second one behind. OPS posts continuously; there are no
			// issues to seed.
			sections: [
				{
					title: 'Preprints',
					abbrev: 'PRE',
					path: 'preprints',
					policy: 'Section default policy for preprints.',
					editorRestricted: false,
					abstractsNotRequired: false,
				},
			],

			// Parents first: a child names its parent by path.
			categories: [
				{
					path: 'applied-science',
					title: 'Applied Science',
					description: 'Applied science research.',
				},
				{
					path: 'comp-sci',
					title: 'Computer Science',
					parentPath: 'applied-science',
				},
				{
					path: 'computer-vision',
					title: 'Computer Vision',
					parentPath: 'comp-sci',
				},
				{
					path: 'eng',
					title: 'Engineering',
					parentPath: 'applied-science',
				},
				{
					path: 'social-sciences',
					title: 'Social Sciences',
					description: 'Social science research.',
				},
				{
					path: 'sociology',
					title: 'Sociology',
					parentPath: 'social-sciences',
				},
				{
					path: 'anthropology',
					title: 'Anthropology',
					parentPath: 'social-sciences',
				},
			],
		},

		users: bootstrapUsers(),
	};
}

module.exports = {bootstrapPayload, bootstrapUsers, enrolments, byUsername};
