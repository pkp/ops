// @ts-check
/**
 * @file playwright/tests/orcid-integration.spec.js
 *
 * ORCID integration — OPS suite, one test per canonical scenario the spec
 * runs on a preprint server (vocabulary per the application glossary:
 * "journal" = preprint server, "Journal Manager" = Preprint Server Manager).
 * Parallel-safe scenarios live here (S1–S3, S5–S7, plus the two absence
 * tests for the scenarios OPS cannot run — S8 and S9); the one scenario that
 * asserts on queued-job ORCID email (S4) lives in
 * tests/serial/orcid-integration.spec.js — ORCID mail only reaches Mailpit
 * after an explicit queue-worker run, which must never happen while parallel
 * agents seed (patterns.md parallel lesson 7).
 * Spec: lib/pkp/docs/e2e/specs/U04-orcid-integration.md
 *
 * Deliberately NOT covered (one line per omission, citing the register ID):
 * - A4 🐞: S2 asserts the connect button's popup only; the "What is ORCID?"
 *   link's misrouted click is the open bug — the link's own target working by
 *   URL is S6's assertion.
 * - A8 🐞: S6 asserts the verification landing's heading and invalid-link
 *   sentence, NOT the closing contact sentence — its "journal manager"
 *   wording on a preprint server is the open bug's record.
 * - A2 🐞: the ORCID-denied landing needs ORCID's live consent screen —
 *   unreachable from the egress-firewalled fleets; the raw-placeholder
 *   rendering is the open bug.
 * - A5 🐞: the Assistant's refused-yet-reported-success contributor controls
 *   are the open bug; no test drives them.
 * - A3 ❓: whether a registration-connected iD should arrive verified is an
 *   open question needing the OAuth leg — not covered (S7 covers the
 *   registration block's presence/absence only).
 * - A9 ❓ / Rules 2–3 site-wide override: Site Settings → ORCID is a shared
 *   singleton across every parallel worker and fleet — site-level ORCID
 *   stays OFF and untouched; the server-tab lock state is unreachable
 *   without it. Deferred with the register's A9.
 * - OPS1 ❓: the settings tab's author-email toggle on a server that has no
 *   accepting decision is the open question's record — its presence/label is
 *   not asserted; the S8 ABSENCE test asserts the missing trigger instead.
 * - OPS2 🐞: the ORCID request emails' missing rows on the OPS Emails
 *   settings screen are the open bug — no test drives that screen (delivery
 *   itself is serial S4's positive territory). The Emails screen and A7 ❓
 *   otherwise belong to Emails management.
 * - OPS3 ✅ / Rule 16: the bundled legacy "ORCID Profile Plugin" row on the
 *   plugins list is an install fact no canonical scenario drives; the
 *   register entry and footnote f-ops3 hold the live-probed record.
 * - Rule 5/9 OAuth completion legs (verified-connect round trip, emailed-link
 *   verify success/duplicate): ORCID's sign-in cannot complete on an offline
 *   install — scenarios stop at the popup (spec footnote s); verified states
 *   are seeded.
 * - Rule 11 deposit outcomes (JOB-017/020): OPS deposits preprints on
 *   posting, but the background deposit needs ORCID's API —
 *   egress-firewalled; the spec's deposit claims rest on code (footnote j).
 * - Rule 15 riders (invitation ORCID step, reviewer-suggestion field) are
 *   owned by their own features' suites.
 *
 * Every test seeds its own scratch preprint server via the scenario
 * endpoints (publicknowledge and the seeded roster stay untouched); ORCID
 * enablement and iD fixture states use the U4 scenario passthroughs (context
 * `orcid`, users[] `orcid`/`orcidIsVerified`, submission `author`).
 */
const {test, expect} = require('../support/fixtures.js');
const {
    OrcidSettingsTab,
    ProfileIdentityPage,
    openEditorialWorkflow,
    openContributors,
    openContributorEditor,
    orcidField,
} = require('../pages/OrcidPages.js');

/** A seedable test iD (ORCID's own example iD, sandbox-hosted). */
const TEST_ORCID = 'https://sandbox.orcid.org/0000-0002-1825-0097';

const UNVERIFIED_NOTE =
    'This ORCID has not been verified. Please remove this unverified ORCID and request verification from the user/author directly.';

/** Unique per-run tag: single alphanumeric token, carries app + scenario + worker. */
function makeTag(scenario, testInfo) {
    return `u4${scenario}opsw${testInfo.parallelIndex}${Math.random().toString(36).slice(2, 8)}`;
}

// Suite disabled 2026-08-20 (maintainer): pending a decision on how ORCID's
// external communication is handled in tests (mock server vs dead-port proxy).
test.describe.skip('ORCID integration', () => {
    test('S1: turning ORCID on adds the profile block; off removes it', {tag: '@smoke'}, async ({asUser, opsApi}, testInfo) => {
        const tag = makeTag('s1', testInfo);
        const manager = `mgr${tag}`;
        // No orcid passthrough here — the settings tab itself is under test.
        await opsApi.createContext({tag, users: [{username: manager, roles: ['manager']}]});

        const managerPage = await (await asUser(manager)).newPage();
        const settings = new OrcidSettingsTab(managerPage, tag);
        await settings.goto();

        // Off by default; the API/credential fields only appear once ticked.
        await expect(settings.enableCheckbox).not.toBeChecked();
        await expect(settings.apiSelect).toHaveCount(0);
        await settings.enableCheckbox.check();
        await expect(settings.apiSelect).toBeVisible();
        await settings.apiSelect.selectOption({label: 'Public Sandbox'});
        await settings.clientIdInput.fill('APP-U4S1TEST');
        await settings.clientSecretInput.fill('u4s1-dummy-secret');
        await settings.save();

        // The profile's Identity tab now offers the connect block (Rule 5).
        const profile = new ProfileIdentityPage(managerPage, tag);
        await profile.goto();
        await expect(profile.connectButton).toBeVisible();
        await expect(profile.connectButton).toContainText('Create or Connect your ORCID iD');
        await expect(profile.aboutLink).toBeVisible();

        // Untick and save (control): the tab kept the saved state, and the
        // Identity tab shows no ORCID field at all (Rule 4).
        await settings.goto();
        await expect(settings.enableCheckbox).toBeChecked();
        await settings.enableCheckbox.uncheck();
        await settings.save();

        await profile.goto();
        await expect(profile.form.locator('input[name^="givenName"]')).toBeVisible();
        await expect(profile.orcidContainer).toHaveCount(0);
    });

    test('S2: the connect button opens the ORCID sign-in popup', async ({asUser, opsApi}, testInfo) => {
        const tag = makeTag('s2', testInfo);
        const author = `aut${tag}`;
        await opsApi.createContext({
            tag,
            users: [{username: author, roles: ['author']}],
            orcid: {},
        });

        const userPage = await (await asUser(author)).newPage();
        const profile = new ProfileIdentityPage(userPage, tag);
        await profile.goto();

        // Pressing the button opens a small popup on an ORCID sandbox sign-in
        // address (Public Sandbox config) while the profile stays put. On an
        // offline install the popup may show a connection error — the test
        // never drives past its address.
        const [popup] = await Promise.all([
            userPage.waitForEvent('popup'),
            profile.connectButton.click(),
        ]);
        await expect
            .poll(() => popup.url(), {timeout: 15_000})
            .toMatch(/sandbox\.orcid\.org\/[^?]*\?.*client_id=/);
        expect(popup.url()).toContain('authorizeOrcid');
        expect(userPage.url()).toContain('/user/profile');
        await popup.close();
        // The "What is ORCID?" link beside the button is register finding A4
        // (its click opens this same popup) — not asserted here; the page it
        // names is covered by URL in S6.
    });

    test('S3: a verified iD is removed from the profile via Delete', async ({asUser, opsApi}, testInfo) => {
        const tag = makeTag('s3', testInfo);
        const holder = `usr${tag}`;
        await opsApi.createContext({
            tag,
            users: [{username: holder, roles: ['author'], orcid: TEST_ORCID, orcidIsVerified: true}],
            orcid: {},
        });

        const userPage = await (await asUser(holder)).newPage();
        const profile = new ProfileIdentityPage(userPage, tag);
        await profile.goto();

        // Verified state: the bare-iD link plus Delete; the connect button
        // and the About link are gone (Rule 5).
        await expect(profile.orcidLink).toBeVisible();
        await expect(profile.orcidLink).toHaveAttribute('href', TEST_ORCID);
        await expect(profile.orcidLink).not.toContainText('(unauthenticated)');
        await expect(profile.deleteButton).toBeVisible();
        await expect(profile.connectButton).toHaveCount(0);
        await expect(profile.aboutLink).toHaveCount(0);

        // Delete asks for confirmation; confirming removes the iD at once —
        // no separate save (Rule 6c).
        await profile.deleteButton.click();
        const dialog = userPage
            .getByRole('dialog')
            .filter({hasText: 'Are you sure you want to remove this ORCID?'});
        await expect(dialog).toBeVisible();
        await dialog.getByRole('button', {name: 'OK', exact: true}).click();

        await expect(profile.connectButton).toBeVisible();
        await expect(profile.orcidLink).toHaveCount(0);

        // Persisted: a fresh load still shows the connect state.
        await profile.goto();
        await expect(profile.connectButton).toBeVisible();
        await expect(profile.connectButton).toContainText('Create or Connect your ORCID iD');
        await expect(profile.deleteButton).toHaveCount(0);
    });

    test('S5: a contributor\'s unauthenticated iD is removed via Delete', async ({asUser, opsApi}, testInfo) => {
        const tag = makeTag('s5', testInfo);
        const manager = `mgr${tag}`;
        const author = `aut${tag}`;
        await opsApi.createContext({
            tag,
            users: [
                {username: manager, roles: ['manager']},
                {username: author, roles: ['author']},
            ],
            orcid: {},
        });
        const {submissionId} = await opsApi.createSubmission({
            tag,
            context: tag,
            submitter: author,
            author: {orcid: TEST_ORCID, orcidIsVerified: false},
        });

        const managerPage = await (await asUser(manager)).newPage();
        await openEditorialWorkflow(managerPage, tag, submissionId);
        await openContributors(managerPage);
        const modal = await openContributorEditor(managerPage, author);

        // Unauthenticated state: the suffixed iD link, the not-verified
        // warning, and Delete (Fields table; Rule 8c).
        const field = orcidField(modal);
        const idLink = field.getByRole('link', {name: new RegExp(TEST_ORCID.split('/').pop())});
        await expect(idLink).toBeVisible();
        await expect(field).toContainText('(unauthenticated)');
        await expect(field).toContainText(UNVERIFIED_NOTE);

        await field.getByRole('button', {name: 'Delete', exact: true}).click();
        const dialog = managerPage
            .getByRole('dialog')
            .filter({hasText: 'Are you sure you want to remove this ORCID?'});
        await expect(dialog).toContainText('Delete ORCID');
        const deleted = managerPage.waitForResponse(
            (response) => response.url().includes('/orcid/deleteForAuthor/') && response.ok()
        );
        await dialog.getByRole('button', {name: 'Yes', exact: true}).click();
        await deleted;

        // The field reverts to the no-iD state offering a fresh request.
        await expect(field.getByRole('button', {name: 'Request verification'})).toBeVisible();
        await expect(idLink).toHaveCount(0);
        await expect(field).not.toContainText('(unauthenticated)');
    });

    test('S6: the public ORCID pages render by URL', async ({page, opsApi}, testInfo) => {
        const tag = makeTag('s6', testInfo);
        await opsApi.createContext({tag, orcid: {}});

        // Signed-out visitor (the default page carries no session), addresses
        // typed directly — both render inside the preprint server's chrome
        // (Rule 10; Rule 9's failure landing).
        await page.goto(`/index.php/${tag}/orcid/about`);
        await expect(page.getByRole('heading', {name: 'What is ORCID?'})).toBeVisible();
        await expect(page.getByText(`Scratch context ${tag}`).first()).toBeVisible();
        await expect(
            page.getByRole('heading', {name: 'How and why we collect ORCID iDs?'})
        ).toBeVisible();

        await page.goto(`/index.php/${tag}/orcid/verify`);
        await expect(page.getByRole('heading', {name: 'ORCID Authorization'})).toBeVisible();
        await expect(
            page.getByText('Your ORCID iD could not be verified. The link is no longer valid.')
        ).toBeVisible();
        // The page's closing contact sentence is register finding A8 🐞 (it
        // says "journal manager" verbatim on a preprint server) — not
        // asserted; see the header.
    });

    test('S7: a preprint server with ORCID off shows none of it', async ({page, asUser, opsApi}, testInfo) => {
        test.slow();
        const tagOff = makeTag('s7f', testInfo);
        const tagOn = makeTag('s7n', testInfo);
        const seedFor = (tag, orcid) =>
            opsApi.createContext({
                tag,
                users: [
                    {username: `mgr${tag}`, roles: ['manager']},
                    {username: `aut${tag}`, roles: ['author']},
                ],
                ...(orcid ? {orcid: {}} : {}),
            });
        await seedFor(tagOff, false);
        await seedFor(tagOn, true);
        const {submissionId: subOff} = await opsApi.createSubmission({
            tag: tagOff, context: tagOff, submitter: `aut${tagOff}`,
        });
        const {submissionId: subOn} = await opsApi.createSubmission({
            tag: tagOn, context: tagOn, submitter: `aut${tagOn}`,
        });

        // Registration page (signed out): no ORCID block on the off server;
        // the enabled server shows it (positive control).
        await page.goto(`/index.php/${tagOff}/user/register`);
        await expect(page.getByRole('button', {name: 'Register', exact: true})).toBeVisible();
        await expect(page.locator('#connect-orcid-button')).toHaveCount(0);
        await page.goto(`/index.php/${tagOn}/user/register`);
        await expect(page.locator('#connect-orcid-button')).toBeVisible();

        // Profile Identity tab: no ORCID field at all on the off server;
        // the connect block on the enabled one (Rules 4–5).
        const offProfile = new ProfileIdentityPage(
            await (await asUser(`aut${tagOff}`)).newPage(), tagOff
        );
        await offProfile.goto();
        await expect(offProfile.form.locator('input[name^="givenName"]')).toBeVisible();
        await expect(offProfile.orcidContainer).toHaveCount(0);
        const onProfile = new ProfileIdentityPage(
            await (await asUser(`aut${tagOn}`)).newPage(), tagOn
        );
        await onProfile.goto();
        await expect(onProfile.connectButton).toBeVisible();

        // Contributor form: no ORCID iD field on the off server; the field
        // with its request control on the enabled one (Rule 8).
        const offManagerPage = await (await asUser(`mgr${tagOff}`)).newPage();
        await openEditorialWorkflow(offManagerPage, tagOff, subOff);
        await openContributors(offManagerPage);
        const offModal = await openContributorEditor(offManagerPage, `aut${tagOff}`);
        await expect(offModal.locator('#contributor-email-control')).toBeVisible();
        await expect(offModal.getByText('ORCID iD')).toHaveCount(0);

        const onManagerPage = await (await asUser(`mgr${tagOn}`)).newPage();
        await openEditorialWorkflow(onManagerPage, tagOn, subOn);
        await openContributors(onManagerPage);
        const onModal = await openContributorEditor(onManagerPage, `aut${tagOn}`);
        await expect(orcidField(onModal).getByRole('button', {name: 'Request verification'})).toBeVisible();
    });

    test('S8 absence {OJS OMP}: no accepting decision exists to trigger the author emails', async ({asUser, opsApi}, testInfo) => {
        // Spec scenario 8 needs the decision Accept (or Skip Review) — the
        // Rule 13 trigger. A preprint server's decision roster has neither
        // (spec footnote f-ops1), so the scenario costs OPS this one absence
        // test: the trigger surface is not offered, each negative bounded by
        // a positive control taken the same way. The toggle the setting rides
        // on is register OPS1 ❓ — its presence/label is not asserted.
        const tag = makeTag('s8', testInfo);
        const manager = `mgr${tag}`;
        const author = `aut${tag}`;
        await opsApi.createContext({
            tag,
            users: [
                {username: manager, roles: ['manager']},
                {username: author, roles: ['author']},
            ],
            // The Rule 13 setting is seeded ON: even armed, the server offers
            // no decision that could ever fire it.
            orcid: {sendMailToAuthorsOnPublication: true},
        });
        const {submissionId} = await opsApi.createSubmission({
            tag,
            context: tag,
            submitter: author,
        });

        const managerPage = await (await asUser(manager)).newPage();
        const workflow = await openEditorialWorkflow(managerPage, tag, submissionId);

        // Positive control (the decision area demonstrably renders): the two
        // decisions a submitted, unposted preprint offers (probe-groupD
        // item 18).
        const actionArea = workflow.locator('[data-cy="workflow-action-items"]');
        await expect(
            actionArea.getByRole('button', {name: 'Post the preprint'})
        ).toBeVisible();
        await expect(
            actionArea.getByRole('button', {name: 'Decline Submission'})
        ).toBeVisible();

        // No accepting decision anywhere in the dialog — neither the review
        // accept nor the skip-review accept (the OJS/OMP button labels).
        await expect(workflow.getByText('Accept Submission')).toHaveCount(0);
        await expect(workflow.getByText('Accept and Skip Review')).toHaveCount(0);
    });

    test('S9 absence {OJS}: no review surface offers "Send Review To ORCID"', async ({asUser, opsApi}, testInfo) => {
        // Spec scenario 9 lives on the Reviewers table of a journal's review
        // stage. OPS installs no review stage, so the scenario costs OPS this
        // one absence test: the row action's surface does not exist, with a
        // positive control per assertion taken through the same dialog.
        const tag = makeTag('s9', testInfo);
        const manager = `mgr${tag}`;
        const author = `aut${tag}`;
        await opsApi.createContext({
            tag,
            users: [
                {username: manager, roles: ['manager']},
                {username: author, roles: ['author']},
            ],
            // Member API is Rule 12's precondition on a journal — seeded here
            // so the absence is not explained by a lesser configuration.
            orcid: {apiType: 'memberSandbox'},
        });
        const {submissionId} = await opsApi.createSubmission({
            tag,
            context: tag,
            submitter: author,
        });

        const managerPage = await (await asUser(manager)).newPage();
        const workflow = await openEditorialWorkflow(managerPage, tag, submissionId);

        // Positive control: the workflow's own controls render.
        const actionArea = workflow.locator('[data-cy="workflow-action-items"]');
        await expect(
            actionArea.getByRole('button', {name: 'Post the preprint'})
        ).toBeVisible();

        // No reviewers list and no ORCID review action anywhere in the
        // dialog (bounded by the control just rendered).
        await expect(workflow.getByText('Reviewers', {exact: true})).toHaveCount(0);
        await expect(workflow.getByText('Send Review To ORCID')).toHaveCount(0);

        // Positive control for the ORCID half (taken through the same
        // dialog): ORCID is live on this server — the contributor form
        // offers its ORCID iD field with the request control.
        await openContributors(managerPage);
        const modal = await openContributorEditor(managerPage, author);
        await expect(
            orcidField(modal).getByRole('button', {name: 'Request verification'})
        ).toBeVisible();
    });
});
