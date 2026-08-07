// @ts-check
/**
 * @file playwright/tests/reviewer-assignment-absence.spec.js
 *
 * U27 — Reviewer assignment & management
 * (lib/pkp/docs/product/specs/reviewer-assignment-and-management.md): the OPS
 * ABSENCE test, spec scenario 15. OPS installs no review stage and no
 * reviewer role (spec footnote p, install facts) — no "Reviewers" panel
 * exists on any preprint workflow screen and Users & Roles offers no
 * reviewer group — so per RUNBOOK multi-app rule 3 the whole feature costs
 * this ONE absence test, with a positive control per assertion (Production's
 * own controls render; a Moderator-role search returns users).
 *
 * Deliberately NOT covered here (and why):
 * - The entire feature — the Reviewers panel, Add Reviewer window (search,
 *   Create New Reviewer, Enroll Existing User), row statuses and actions,
 *   reminders, read/confirm/thank, unassign/cancel/reinstate/resend, log
 *   response, history, editorial notes (spec scenarios 1–14, Rules 1–23):
 *   none of these surfaces exist on OPS. The OJS and OMP suites own them.
 * - The spec's Findings register entries (A1–A17, OMP1–2): all concern
 *   OJS/OMP reviewer surfaces; nothing to assert or park on OPS.
 * - The install nuance recorded in spec footnote p — the generic "Create New
 *   Role" form's permission-level list still offering "Reviewer" (an
 *   application-level enum, with no reviewer group seeded or reachable) —
 *   is a recorded fact, not a contract this suite freezes; the create-role
 *   modal is not opened. The Roles-tab assertions below scope to the grid's
 *   rows for the same reason (the grid's filter select carries the same
 *   application-wide enum).
 * - The review-stage absence itself (stage menu, rounds, decision buttons)
 *   is the neighboring feature's record — asserted by
 *   review-stage-absence.spec.js (U26 scenario 14), not restated here.
 *
 * Seeding: a scratch preprint server (throwaway manager/moderator/author) +
 * one submitted preprint via the scenario endpoints. `publicknowledge` and
 * the seeded roster are not touched.
 */
const {test, expect} = require('../support/fixtures.js');
const {UsersRolesPage} = require('../pages/UserInvitationPages.js');

/** Single hyphenless alphanumeric token — tag conventions in patterns.md. */
function makeTag(prefix) {
    return prefix + Math.random().toString(36).replace(/[^a-z0-9]/g, '').slice(0, 7);
}

test.describe('reviewer-assignment & management (U27) — OPS absence', () => {
    test('scenario 15 {OPS}: no reviewer surfaces on a preprint server', async ({asUser, pkpApi}) => {
        const tag = makeTag('u27s15');
        const manager = `m${tag}`;
        const moderator = `mod${tag}`;
        const moderatorName = `Mod${tag}`;
        const author = `a${tag}`;

        // Scratch preprint server with a throwaway Preprint Server Manager, a
        // Moderator (the positive control for the role search) and an author;
        // one seeded (submitted, unposted) preprint — on OPS it lands directly
        // on the Production stage.
        await pkpApi.createContext({
            tag,
            users: [
                {username: manager, roles: ['manager']},
                {username: moderator, roles: ['sectionEditor'], givenName: moderatorName},
                {username: author, roles: ['author']},
            ],
        });
        const seeded = await pkpApi.createSubmission({
            tag,
            context: tag,
            submitter: author,
        });

        // ── Surface 1: the preprint workflow ────────────────────────────────
        // Preprint Server Manager opens the preprint's workflow.
        const page = await (await asUser(manager)).newPage();
        await page.goto(
            `/index.php/${tag}/dashboard/editorial?workflowSubmissionId=${seeded.submissionId}`
        );

        const workflow = page.locator('[data-cy="active-modal"]');
        // Arrival: the workflow dialog opened on the Production stage (the
        // side-modal wrapper reports visibility:hidden — anchor on inner
        // content, patterns.md pitfall 5).
        await expect(
            workflow.getByRole('heading', {name: /Workflow: Production/})
        ).toBeVisible();

        // Positive control (the workflow screen demonstrably works): the
        // Production stage's own controls render — the posting and declining
        // actions, and the stage's panel area with its Discussions panel.
        const actionArea = workflow.locator('[data-cy="workflow-action-items"]');
        await expect(
            actionArea.getByRole('button', {name: 'Post the preprint'})
        ).toBeVisible();
        await expect(
            actionArea.getByRole('button', {name: 'Decline Submission'})
        ).toBeVisible();
        await expect(
            workflow.locator('[data-cy="workflow-primary-items"] [data-cy="discussion-manager"]')
        ).toBeVisible();

        // …and no "Reviewers" panel or reviewer control anywhere in the
        // dialog (bounded by the controls just rendered): no panel heading,
        // no Add Reviewer entry, no reviewer row machinery.
        await expect(workflow.getByText('Reviewers', {exact: true})).toHaveCount(0);
        await expect(workflow.getByRole('button', {name: 'Add Reviewer'})).toHaveCount(0);
        await expect(workflow.getByText('Reviewer status')).toHaveCount(0);

        // ── Surface 2: Users & Roles ────────────────────────────────────────
        // Users tab. Positive control: searching the Current Users list for
        // the throwaway Moderator returns them, holding the Moderator role —
        // the users surface and its role rendering demonstrably work.
        const users = new UsersRolesPage(page, tag);
        await users.goto();
        await users.searchUsers(moderatorName);
        const moderatorRow = users.userRow(moderatorName);
        await expect(moderatorRow).toBeVisible();
        await expect(moderatorRow).toContainText('Moderator');
        // No user of this server holds any reviewer role (bounded by the same
        // table having just rendered the Moderator row).
        await expect(
            page.getByRole('row').filter({hasText: /Reviewer/})
        ).toHaveCount(0);

        // Roles tab: the server's role roster offers no reviewer group.
        await page.getByRole('tab', {name: 'Roles', exact: true}).click();
        const roleRows = page.locator('#roleGridContainer tr.gridRow');
        // Positive control, taken the same way: the seeded default groups
        // list — the Moderator group's row renders.
        await expect(roleRows.filter({hasText: 'Moderator'})).toBeVisible();
        await expect(roleRows.filter({hasText: 'Preprint Server manager'})).toBeVisible();
        // …and no group row names any reviewer role (bounded by the same
        // grid's rendered rows; scoped to rows — see header note on the
        // filter's application-wide enum).
        await expect(roleRows.filter({hasText: /Review/i})).toHaveCount(0);
    });
});
