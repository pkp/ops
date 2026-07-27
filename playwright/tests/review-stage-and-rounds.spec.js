// @ts-check
/**
 * @file playwright/tests/review-stage-and-rounds.spec.js
 *
 * Copyright (c) 2014-2026 Simon Fraser University
 * Copyright (c) 2003-2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * U26 "Review stage & rounds" — the OPS side of the spec
 * (`lib/pkp/docs/product/specs/review-stage-and-rounds.md`).
 *
 * OPS DOES NOT INSTALL THIS FEATURE, so the whole OPS suite for U26 is ONE
 * absence test: the spec's scenario 13, "{OPS} Absence check". Everything else
 * in the spec — rounds, round status, review files, reviewer panels, round
 * decisions, recommendations, the author's read-review and notifications
 * panels — is implemented in the OJS and OMP suites and is deliberately NOT
 * covered here: a preprint server has a single Production stage, no review
 * stage, no reviewer group and no review decision, so there is nothing to
 * assert but the absence.
 *
 * ## How the absence is proved
 *
 * PRINCIPLES multi-app convention 4: every negative is paired with a POSITIVE
 * CONTROL taken the same way, so "nothing found" can never be confused with
 * "nothing rendered / nothing loaded". Each block below asserts the OPS
 * surface that DOES exist first, from the same locator root, then the review
 * surface that does not.
 *
 * The spec's own positive control ("the same walk on a journal shows the
 * Review stage") cannot be taken from an OPS suite — a per-app suite drives
 * one fleet. The OJS suite's U26 specs are that control; here the control is
 * in-app and per assertion, as the campaign brief requires.
 *
 * ## Isolation
 *
 * The test seeds its OWN preprint through the scenario endpoint and asserts
 * only against it. The base server `publicknowledge` and its seeded accounts
 * are read-only; nothing here mutates server-level state, so no scratch server
 * is needed (PRINCIPLES architecture principle 1 — the isolation unit is the
 * submission).
 */

const {test, expect} = require('../support/fixtures.js');

// The Preprint Server Manager is scenario 13's actor (APP-GLOSSARY §1: OPS's
// name for the Journal Manager slot).
test.use({user: 'manager.maya'});

/** Decision buttons the spec's Rule 10 offers on a journal's review round. */
const REVIEW_DECISION_LABELS = [
	'Send for Review',
	'Send to External Review',
	'Send to Internal Review',
	'Request Revisions',
	'Accept Submission',
	'Create New Review Round',
	'Cancel Review Round',
	'Recommend Revisions',
	'Recommend Accept',
	'Recommend Decline',
];

/** Panel titles the spec's Rules 3–4 mount on a journal's review round. */
const REVIEW_PANEL_HEADINGS = [
	/Round \d+ Status/i,
	/^Files for Review$/i,
	/^Revisions Uploaded$/i,
	/^Reviewers$/i,
	/^Reviewers Suggested by Author$/i,
	/^Review Tasks & Discussions$/i,
	/^Recommendation$/i,
	/^Notifications$/i,
];

/**
 * Open the seeded preprint's workflow and return the locators the assertions
 * share. The workflow screen renders as a side modal inside the editorial
 * dashboard.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} submissionId
 */
async function openWorkflow(page, submissionId) {
	await page.goto(
		`/index.php/publicknowledge/en/dashboard/editorial?workflowSubmissionId=${submissionId}`,
	);

	const modal = page.locator('[data-cy="active-modal"]');

	return {
		modal,
		// The side menu's "Workflow" group. PanelMenu renders each group as a
		// labelled region holding one treeitem per stage.
		workflowGroup: modal.getByRole('region', {name: 'Workflow', exact: true}),
		sideMenu: modal.locator('nav'),
		actions: modal.locator('[data-cy="workflow-action-items"]'),
	};
}

/**
 * The whole of scenario 13, asserted for both roles that hold an OPS workflow.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} submissionId
 * @param {string} role human-readable role name, for assertion messages
 */
async function expectNoReviewSurface(page, submissionId, role) {
	const {modal, workflowGroup, sideMenu, actions} = await openWorkflow(
		page,
		submissionId,
	);

	// --- Side menu -------------------------------------------------------
	// POSITIVE CONTROL: the menu renders and its Workflow group offers
	// Production. This also bounds every negative below — the menu is loaded.
	await expect(
		workflowGroup.getByRole('treeitem'),
		`${role}: the Workflow group lists Production and nothing else`,
	).toHaveText(['Production']);

	// POSITIVE CONTROL for the negative below: the same locator shape — a menu
	// entry matched by name — does find the stage that exists.
	await expect(
		sideMenu.getByRole('link', {name: /production/i}),
		`${role}: the side menu offers Production`,
	).toHaveCount(1);

	// NEGATIVE: no review stage and no review rounds anywhere in the menu.
	await expect(
		sideMenu.getByRole('link', {name: /review/i}),
		`${role}: no review stage or "Review Round N" entry in the side menu`,
	).toHaveCount(0);

	// --- Workflow column heading ----------------------------------------
	// POSITIVE CONTROL: the stage view rendered, headed for Production.
	await expect(
		modal.getByRole('heading', {name: /Workflow:\s*Production/i}),
		`${role}: the workflow column is headed "Workflow: Production"`,
	).toBeVisible();

	// NEGATIVE: never the spec's Rule 2 heading "Workflow: Review (Round N)".
	await expect(
		modal.getByRole('heading', {name: /Workflow:\s*(External )?Review/i}),
		`${role}: no "Workflow: Review (Round N)" heading`,
	).toHaveCount(0);

	// --- Panels ----------------------------------------------------------
	// POSITIVE CONTROL: Production's own panel roster is on screen — the
	// primary column's discussions panel and the side column's Participants.
	await expect(
		modal.getByRole('heading', {name: 'Production Tasks & Discussions'}),
		`${role}: the Production discussions panel renders`,
	).toBeVisible();
	await expect(
		modal.getByRole('heading', {name: /^Participants$/i}),
		`${role}: the side column renders Participants`,
	).toBeVisible();

	// NEGATIVE: none of the round's panels (Rules 3–4, 11, 14) exist.
	for (const heading of REVIEW_PANEL_HEADINGS) {
		await expect(
			modal.getByRole('heading', {name: heading}),
			`${role}: no review panel matching ${heading}`,
		).toHaveCount(0);
	}

	// --- Decision controls -----------------------------------------------
	// POSITIVE CONTROL + exhaustive negative in one: the action area offers
	// exactly OPS's two decisions (APP-GLOSSARY §1 "Workflow stages and
	// decisions": Post the preprint / Decline).
	await expect(
		actions.getByRole('button'),
		`${role}: the only workflow actions are OPS's own two`,
	).toHaveText(['Post the preprint', 'Decline Submission']);

	// POSITIVE CONTROL for the named negatives below: an exact-name button
	// lookup over the whole modal does find the decision that is offered.
	await expect(
		modal.getByRole('button', {name: 'Decline Submission', exact: true}),
		`${role}: "Decline Submission" is offered on the workflow screen`,
	).toHaveCount(1);

	// NEGATIVE, named: no Rule 10 decision or Rule 11 recommendation control
	// anywhere on the screen, not merely outside the action area.
	for (const label of REVIEW_DECISION_LABELS) {
		await expect(
			modal.getByRole('button', {name: label, exact: true}),
			`${role}: no "${label}" control on the workflow screen`,
		).toHaveCount(0);
	}
}

test(
	'U26/13 a preprint server offers no review stage, no rounds and no review decision',
	{tag: '@regression'},
	async ({page, opsApi, asUser}) => {
		const tag = `u26w${test.info().parallelIndex}${Math.random()
			.toString(36)
			.slice(2, 8)}`;

		// The spec under test, minus the review block — this POST succeeding is
		// the POSITIVE CONTROL for the endpoint refusal asserted at the end.
		const spec = {
			tag,
			context: 'publicknowledge',
			submitter: 'author.alex',
			title: `Review absence check ${tag}`,
		};
		const preprint = await opsApi.createSubmission(spec);

		// The seeded preprint sits in OPS's single stage, with no rounds — the
		// server's own account of the same absence.
		expect(preprint.reviewRounds, 'a seeded preprint has no review rounds')
			.toEqual([]);

		// Scenario 13's actor: the Preprint Server Manager.
		await expectNoReviewSurface(
			page,
			preprint.submissionId,
			'Preprint Server Manager',
		);

		// The same walk as the Moderator — OPS's sub-editor slot, auto-assigned
		// to this preprint as a participant of section PRE.
		const moderatorContext = await asUser('sectioneditor.ana');
		const moderatorPage = await moderatorContext.newPage();

		await expectNoReviewSurface(
			moderatorPage,
			preprint.submissionId,
			'Moderator',
		);

		// --- The server side of the same request ------------------------------
		// The screen offers no review surface because the application has no
		// review stage to offer: the identical seed spec plus a review block is
		// REFUSED, naming the key rather than silently dropping it (PRINCIPLES
		// scenario-endpoint design record 4).
		await expect(
			opsApi.createSubmission({
				...spec,
				tag: `${tag}x`,
				reviewRounds: [{reviewers: []}],
			}),
			'the scenario endpoint refuses reviewRounds on a preprint server',
		).rejects.toThrow(/reviewRounds|no review stage/i);
	},
);
