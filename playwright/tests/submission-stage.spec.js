// @ts-check
/**
 * @file playwright/tests/submission-stage.spec.js
 *
 * U25 — Submission stage
 * (lib/pkp/docs/product/specs/submission-stage.md): the OPS ABSENCE suite.
 * OPS runs a single-stage workflow — Production only, register OPS1 — so no
 * preprint ever occupies a Submission stage and none of the spec's panels or
 * decision buttons render here. Per RUNBOOK multi-app rule 3 the feature
 * costs OPS one absence test (spec scenario 9) with a positive control per
 * assertion, plus the one rule where the spec claims live OPS behavior:
 * Rule 11, the legacy author-dashboard address forwarding to the current
 * workflow view (on OPS, the submission's publication tabs).
 *
 * Deliberately NOT covered here (and why):
 * - The whole Submission-stage feature — the Submission Files / Desk Review
 *   Tasks & Discussions / Participants / Reviewers Suggested by Author
 *   panels, the decision buttons and their transitions, the author view, the
 *   Delete flow, the Schedule For Publication shortcut (spec scenarios 1–8,
 *   Rules 1–10): none of these screens exist on OPS. The OJS and OMP suites
 *   own them.
 * - Findings A1 (Schedule For Publication on a declined submission) and A2
 *   (recommend-only editor's buttons): OJS/OMP surfaces with no OPS
 *   counterpart. A3 (a deleted submission's address opens an empty page):
 *   OPS's delete button lives on the Production stage — that stage's spec
 *   owns it; nothing to assert or park here.
 * - OPS Production's own controls beyond their use as positive controls
 *   ("Post the preprint", "Decline Submission"): their behavior belongs to
 *   *Production stage* and *Publish, schedule & versions* (register OPS1).
 *
 * Seeding: each test builds its own scratch preprint server + one submitted
 * preprint via the scenario endpoints (throwaway users). `publicknowledge`
 * and the seeded roster are not touched.
 */
const {test, expect} = require('../support/fixtures.js');

/** Single hyphenless alphanumeric token — tag conventions in patterns.md. */
function makeTag(prefix) {
    return prefix + Math.random().toString(36).replace(/[^a-z0-9]/g, '').slice(0, 7);
}

test.describe('submission stage (U25) — OPS absence', () => {
    test('scenario 9 {OPS}: no Submission stage on a preprint server', async ({
        asUser,
        pkpApi,
    }) => {
        const tag = makeTag('u25s9');
        const manager = `m${tag}`;
        const author = `a${tag}`;

        // Scratch preprint server with a throwaway Preprint Server Manager
        // and author; one seeded (submitted, unposted) preprint — on OPS it
        // lands directly on the Production stage.
        await pkpApi.createContext({
            tag,
            users: [
                {username: manager, roles: ['manager']},
                {username: author, roles: ['author']},
            ],
        });
        const seeded = await pkpApi.createSubmission({
            tag,
            context: tag,
            submitter: author,
        });

        // Preprint Server Manager opens the preprint's workflow.
        const page = await (await asUser(manager)).newPage();
        await page.goto(
            `/index.php/${tag}/dashboard/editorial?workflowSubmissionId=${seeded.submissionId}`
        );

        const workflow = page.locator('[data-cy="active-modal"]');
        // Arrival: the workflow dialog opened directly on the Production
        // stage — there is no Submission stage to land on (the side-modal
        // wrapper reports visibility:hidden — anchor on inner content,
        // patterns.md pitfall 5).
        await expect(
            workflow.getByRole('heading', {name: /Workflow: Production/})
        ).toBeVisible();

        // Positive control (the workflow screen demonstrably works): the
        // Production stage's own controls render. "Decline Submission" here
        // is the Production stage's decision (register OPS1) — the shared
        // label, not a Submission-stage button.
        const actionArea = workflow.locator('[data-cy="workflow-action-items"]');
        await expect(
            actionArea.getByRole('button', {name: 'Post the preprint'})
        ).toBeVisible();
        await expect(
            actionArea.getByRole('button', {name: 'Decline Submission'})
        ).toBeVisible();

        // The stage menu offers Production (control, taken the same way)…
        const stageMenu = workflow.locator('nav');
        await expect(stageMenu.getByText('Production', {exact: true})).toBeVisible();
        // …and no Submission entry (the stage-1 menu label on OJS/OMP is
        // exactly "Submission").
        await expect(stageMenu.getByText('Submission', {exact: true})).toHaveCount(0);

        // The Submission stage's panels render nowhere. Positive control:
        // the Production stage's discussions panel is present under its own
        // heading — so panels as such do render.
        await expect(
            workflow.getByText('Production Tasks & Discussions')
        ).toBeVisible();
        await expect(workflow.getByText('Desk Review Tasks & Discussions')).toHaveCount(0);
        await expect(workflow.getByText('Submission Files')).toHaveCount(0);

        // None of the Submission-stage decision buttons (OJS or OMP variant)
        // exist anywhere in the dialog — bounded by the same dialog having
        // just rendered its Production controls above. "Schedule For
        // Publication" is the OJS shortcut label; OPS relabels that action
        // "Post the preprint" (asserted present above).
        await expect(workflow.getByText('Send for Review')).toHaveCount(0);
        await expect(workflow.getByText('Send to External Review')).toHaveCount(0);
        await expect(workflow.getByText('Send to Internal Review')).toHaveCount(0);
        await expect(workflow.getByText('Accept and Skip Review')).toHaveCount(0);
        await expect(workflow.getByText('Schedule For Publication')).toHaveCount(0);
    });

    test('rule 11 {OPS}: legacy author-dashboard address forwards to the publication tabs', async ({
        asUser,
        pkpApi,
    }) => {
        const tag = makeTag('u25r11');
        const author = `a${tag}`;

        await pkpApi.createContext({
            tag,
            users: [{username: author, roles: ['author']}],
        });
        const seeded = await pkpApi.createSubmission({
            tag,
            context: tag,
            submitter: author,
        });

        // The submitter types the old author-dashboard address.
        const page = await (await asUser(author)).newPage();
        await page.goto(
            `/index.php/${tag}/authorDashboard/submission/${seeded.submissionId}`
        );

        // It forwards to the current dashboard with the submission's
        // workflow open (Rule 11).
        await page.waitForURL(
            (url) =>
                url.pathname.includes('dashboard/mySubmissions') &&
                url.searchParams.get('workflowSubmissionId') ===
                    String(seeded.submissionId),
            {timeout: 15_000, waitUntil: 'commit'}
        );

        // Positive control: the modern workflow dialog rendered, landing on
        // the submission's publication tabs (the OPS author view — Title &
        // Abstract is the initial entry).
        const workflow = page.locator('[data-cy="active-modal"]');
        await expect(
            workflow.locator('nav').getByText('Title & Abstract')
        ).toBeVisible();

        // The legacy author-dashboard page and its file grids render
        // nowhere: no legacy page body class, no legacy grid container
        // (bounded by the modern dialog just asserted).
        await expect(page.locator('body.pkp_page_authorDashboard')).toHaveCount(0);
        await expect(page.locator('#submissionFilesGridDiv')).toHaveCount(0);
    });
});
