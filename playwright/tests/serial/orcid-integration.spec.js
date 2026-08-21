// @ts-check
/**
 * @file playwright/tests/serial/orcid-integration.spec.js
 *
 * ORCID integration — the one OPS canonical scenario that asserts on ORCID
 * request EMAIL (spec scenario 4). Every ORCID mailable is queued-job mail
 * and the fleets run with `[queues] job_runner = Off`, so nothing reaches
 * Mailpit until `php lib/pkp/tools/jobs.php run` drains the queue — and that
 * drain pops the SHARED queue, so it must never run while parallel agents
 * seed. Hence the serial project (patterns.md parallel lesson 7).
 * Spec: lib/pkp/docs/e2e/specs/U04-orcid-integration.md
 *
 * Coverage boundaries are declared in the parallel suite's header
 * (playwright/tests/orcid-integration.spec.js); this file adds only:
 * - S4's emailed authorization link is recorded, never followed (OAuth
 *   cannot complete on the egress-firewalled fleets).
 * - OPS2 🐞 is about the Emails settings SCREEN's missing rows — this test's
 *   delivered "Submission ORCID" mail is the finding's live positive half
 *   (delivery works from the seeded texts), asserted here as spec contract
 *   (Rules 8 and 14), never the roster gap itself.
 *
 * Mailpit is shared across fleets and workers: the assertion is scoped by a
 * unique throwaway recipient (the seeded contributor's address carries app +
 * scenario + run).
 */
const {test, expect} = require('../../support/fixtures.js');
const {
    openEditorialWorkflow,
    openContributors,
    openContributorEditor,
    orcidField,
} = require('../../pages/OrcidPages.js');
const {runJobs} = require('../../../lib/pkp/playwright/support/jobs.js');

/** Unique per-run tag: single alphanumeric token, carries app + scenario. */
function makeTag(scenario, testInfo) {
    return `u4${scenario}opsw${testInfo.parallelIndex}${Math.random().toString(36).slice(2, 8)}`;
}

// Suite disabled 2026-08-20 (maintainer): pending a decision on how ORCID's
// external communication is handled in tests (mock server vs dead-port proxy).
test.describe.skip('ORCID integration (queued email)', () => {
    test('S4: "Request verification" emails the contributor an authorization link', async ({asUser, opsApi, pkpMail}, testInfo) => {
        test.slow();
        const tag = makeTag('s4', testInfo);
        const manager = `mgr${tag}`;
        const author = `aut${tag}`;
        const recipient = `${author}@mail.test`; // seeded contributor address
        await opsApi.createContext({
            tag,
            users: [
                {username: manager, roles: ['manager']},
                {username: author, roles: ['author']},
            ],
            orcid: {}, // enabled, Public Sandbox → the "Submission ORCID" template (Rule 14)
        });
        const {submissionId} = await opsApi.createSubmission({
            tag,
            context: tag,
            submitter: author,
        });

        const managerPage = await (await asUser(manager)).newPage();
        await openEditorialWorkflow(managerPage, tag, submissionId);
        await openContributors(managerPage);
        let modal = await openContributorEditor(managerPage, author);

        // No iD → "Request verification"; the confirm dialog carries the
        // Rule 8 question; confirming flips the field to the requested state.
        const field = orcidField(modal);
        await field.getByRole('button', {name: 'Request verification'}).click();
        const dialog = managerPage
            .getByRole('dialog')
            .filter({hasText: 'Would you like to send an email to this author requesting they verify their ORCID?'});
        await expect(dialog).toContainText('Request ORCID verification');
        const requested = managerPage.waitForResponse(
            (response) => response.url().includes('/orcid/requestAuthorVerification/') && response.ok()
        );
        await dialog.getByRole('button', {name: 'Yes', exact: true}).click();
        await requested;
        await expect(field).toContainText('ORCID Verification has been requested!');
        await expect(field.getByText('Resend Verification Email')).toBeVisible();

        // Save; the requested state persists on reopen. (The seeded
        // auto-author carries no country and the form requires one — filling
        // it is form furniture, not the behavior under test.)
        await modal.locator('#contributor-country-control').selectOption({label: 'Canada'});
        await modal.getByRole('button', {name: 'Save', exact: true}).click();
        await expect(modal).toHaveCount(0);
        modal = await openContributorEditor(managerPage, author);
        await expect(orcidField(modal)).toContainText('ORCID Verification has been requested!');

        // The mail is queued-job mail: drain the queue, then read the
        // contributor's mailbox (recipient-scoped).
        runJobs();
        const summary = await pkpMail.find({to: recipient, subject: 'Submission ORCID'});
        const full = await pkpMail.fullMessage(summary.ID);
        const authLink = pkpMail.extractLink(full.HTML, /Register or connect your ORCID iD/);
        expect(authLink).toContain('sandbox.orcid.org'); // leads to ORCID's (sandbox) site
        const aboutLink = pkpMail.extractLink(full.HTML, /More information about ORCID/);
        expect(aboutLink).toContain(`/${tag}/orcid/about`);
        // Recorded, never followed: OAuth cannot complete from this install.
    });
});
