// @ts-check
/**
 * @file playwright/tests/login-and-sessions.spec.js
 *
 * U1 — Login & sessions, OPS suite. One test per canonical scenario of
 * lib/pkp/docs/e2e/specs/U01-login-and-sessions.md, in OPS vocabulary
 * (preprint server, Moderators; the reduced roster has no editor/reviewer/
 * copyeditor accounts). Scenario 6 is {OJS OMP} — its Create New Reviewer
 * path does not exist on a preprint server, so it costs one absence test
 * with positive controls (RUNBOOK multi-app rule 3). Impersonation tests
 * sign their actors in through the real login form in the test's own
 * context — never through the cached .auth storage states, which
 * signInAsUser/signOutAsUser would invalidate.
 *
 * Deliberately NOT covered here (and why):
 * - Scenario 9 / Rule 16 (Confirm Access): gated by `[security]
 *   password_timeout`, which is off in this fleet's config.test.inc.php.
 *   Editing the running config is global across workers and fleets
 *   (PRINCIPLES D9), so the gate stays uncovered rather than
 *   covered unsafely.
 * - Rule 5 / Rule 18 session lifetimes and teardowns (idle expiry,
 *   remember-me window, session_expire_on_close, session_check_ip, the
 *   Expire User Sessions tool): config- and clock-gated, same reasoning.
 * - Spam checks (reCAPTCHA / ALTCHA) and sign-in rate limiting: config- and
 *   site-setting-gated; A6 (❓ correct password refused during cool-down) is
 *   parked on the register.
 * - Register findings never asserted as contract: A1 (32-char password boxes
 *   — the harness LoginPage lifts the attribute), A2 ("Keep me logged in"
 *   pre-ticked), A3 (raw locale key in the reset page's browser tab —
 *   scenario 4 asserts the page heading only), A4 (second Login As offered
 *   mid-impersonation), A5 (no screen sets the forced-change flag — an open
 *   question; scenario 6 covers the OPS-side absence).
 * - Rule 2's disabled-account refusal: disabling an account belongs to the
 *   users-management feature (no mutation path in this spec's screens).
 * - Rule 11's forced-change form itself: with no OPS screen setting the
 *   flag, the flow is exercised by the OJS/OMP suites for this feature.
 */
const {test, expect} = require('../support/fixtures.js');
const {LoginPage} = require('../../lib/pkp/playwright/pages/LoginPage.js');
const {getPassword, getEmail} = require('../../lib/pkp/playwright/data/users.js');
const {UsersRolesPage} = require('../pages/UserInvitationPages.js');

const APP = 'ops';
const GENERIC_ERROR = 'Invalid username/email or password. Please try again.';
const CONFIRMATION_SENT =
    'A confirmation has been sent to your email address if a matching account was found. Please follow the instructions in the email to reset your password.';
const PASSWORD_UPDATED =
    'Password has been updated successfully. Please login with updated password.';
const INVALID_HASH =
    'Sorry, the link you clicked on has expired or is not valid. Please try resetting your password again.';
const CONFIRM_LOGIN_AS =
    'Log in as this user? All actions you perform will be attributed to this user.';
const RESET_SUBJECT = 'Password Reset Confirmation';

/** Single hyphenless alphanumeric token — tag conventions in patterns.md. */
function makeTag(prefix) {
    return prefix + Math.random().toString(36).replace(/[^a-z0-9]/g, '').slice(0, 7);
}

/** The top-right user menu (initials button + dropdown). */
function userNav(page) {
    return page.locator('[data-cy="app-user-nav"]');
}

async function openUserMenu(page) {
    await userNav(page).getByRole('button').click();
}

/**
 * Sign in through a context's own Login page (the real form — no storage
 * state involved). Ends once the browser has left /login.
 */
async function signInVia(page, contextPath, username, password = undefined) {
    const login = new LoginPage(page);
    await page.goto(`/index.php/${contextPath}/login`);
    await login.usernameInput.fill(username);
    await login.fillPassword(password ?? getPassword(username));
    await login.submitButton.click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
        timeout: 15_000,
        waitUntil: 'commit',
    });
}

/**
 * Walk the lost-password flow up to the confirmation sentence and return the
 * emailed reset link (Rules 7–8). The recipient address is the test's unique
 * throwaway (app + test in the address) — the only Mailpit scoping this
 * install supports.
 */
async function requestResetLink(page, pkpMail, {contextPath, email}) {
    await page.goto(`/index.php/${contextPath}/login`);
    await page.getByRole('link', {name: 'Forgot your password?'}).click();
    await expect(page.getByRole('heading', {name: 'Reset Password'})).toBeVisible();
    await expect(
        page.getByText(
            'Enter your account email address below and an email will be sent with instructions on how to reset your password.'
        )
    ).toBeVisible();
    await page.locator('input#email').fill(email);
    await page.locator('form#lostPasswordForm button[type="submit"]').click();
    await expect(page.getByText(CONFIRMATION_SENT)).toBeVisible();
    // The message's own back-link (the site header carries a second Login link).
    await expect(
        page.getByRole('main').getByRole('link', {name: 'Login', exact: true})
    ).toBeVisible();

    const message = await pkpMail.find({to: email, subject: RESET_SUBJECT});
    const full = await pkpMail.fullMessage(message.ID);
    const haystack = `${full.HTML || ''}\n${full.Text || ''}`;
    const match = haystack.match(/https?:\/\/[^\s"'<>]*\/login\/resetPassword\/[^\s"'<>]+/);
    expect(match, 'reset email must carry the single reset link').not.toBeNull();
    return match[0].replace(/&amp;/g, '&');
}

test.describe('login & sessions (U1) — OPS', () => {
    test('scenario 1: moderator signs in and lands on the Dashboard', async ({page, appContext}) => {
        // OPS's stand-in for the spec's Editor: a Moderator (sectionEditor).
        const username = appContext.seed.actors.sectionEditor;
        const login = new LoginPage(page);
        await page.goto('/index.php/publicknowledge/login');

        // Wrong password: the one generic failure, username kept filled (Rule 2).
        await login.usernameInput.fill(username);
        await login.fillPassword('not-the-password');
        await login.submitButton.click();
        await expect(page.getByText(GENERIC_ERROR)).toBeVisible();
        await expect(page).toHaveURL(/\/login/);
        await expect(login.usernameInput).toHaveValue(username);

        // Correct password: lands on the Dashboard (Rule 3).
        await login.fillPassword(getPassword(username));
        await login.submitButton.click();
        await page.waitForURL(/\/dashboard/, {waitUntil: 'commit'});
        await expect(userNav(page)).toBeVisible();
    });

    test('scenario 2: sign out from the user menu', async ({page}) => {
        const username = 'author.alex';
        await signInVia(page, 'publicknowledge', username);
        await expect(page).toHaveURL(/\/dashboard/);

        // The user menu (top-right initials) offers "Logout" (Rule 6).
        await openUserMenu(page);
        await page.getByRole('link', {name: 'Logout', exact: true}).click();
        await page.waitForURL(/\/login/, {waitUntil: 'commit'});

        // The login form arrives with the departed account's EMAIL prefilled —
        // even though the sign-in above used the username (Rule 6).
        const login = new LoginPage(page);
        await expect(login.usernameInput).toHaveValue(getEmail(username));

        // A dashboard address now shows the Login page, not the dashboard.
        await page.goto('/index.php/publicknowledge/dashboard/mySubmissions');
        await page.waitForURL(/\/login/, {waitUntil: 'commit'});
        await expect(login.usernameInput).toBeVisible();
    });

    test('scenario 3: a bookmarked private address waits for sign-in', async ({page, opsApi}) => {
        const tag = makeTag('u1s3');
        const manager = `m${tag}`;
        const author = `a${tag}`;
        await opsApi.createContext({
            tag,
            users: [
                {username: manager, roles: ['manager']},
                {username: author, roles: ['author']},
            ],
        });
        const seeded = await opsApi.createSubmission({tag, context: tag, submitter: author});
        const workflowUrl = `/index.php/${tag}/dashboard/editorial?workflowSubmissionId=${seeded.submissionId}`;

        // Signed out, the workflow address shows the plain Login page (Rule 4).
        await page.goto(workflowUrl);
        await page.waitForURL(/\/login/, {waitUntil: 'commit'});
        const login = new LoginPage(page);
        await expect(login.usernameInput).toBeVisible();

        // Signing in continues to the held address — not to the Dashboard.
        await login.usernameInput.fill(manager);
        await login.fillPassword(getPassword(manager));
        await login.submitButton.click();
        await page.waitForURL(
            (url) => url.search.includes(`workflowSubmissionId=${seeded.submissionId}`),
            {waitUntil: 'commit'}
        );
        await expect(
            page
                .locator('[data-cy="active-modal"]')
                .getByRole('heading', {name: /Workflow: Production/})
        ).toBeVisible();
    });

    test('scenario 4: recover a forgotten password', async ({page, opsApi, pkpMail}) => {
        test.slow();
        const tag = makeTag('u1s4');
        const username = `r${tag}`;
        const email = `${tag}-${APP}@mail.test`;
        // Scratch user — never reset a roster password (cached sign-ins of
        // other tests depend on the deterministic rule).
        await opsApi.createContext({
            tag,
            users: [{username, roles: ['author'], email}],
        });

        const resetUrl = await requestResetLink(page, pkpMail, {contextPath: tag, email});

        // The link opens the set-a-new-password form ("Reset Password" page
        // heading; the raw-key tab title is A3's record, not asserted).
        await page.goto(resetUrl);
        await expect(page.getByRole('heading', {name: 'Reset Password'})).toBeVisible();
        const newPassword = `Np${tag}`;
        await page.locator('input[name="password"]').fill(newPassword);
        await page.locator('input[name="password2"]').fill(newPassword);
        await page.getByRole('button', {name: 'Save'}).click();

        // Saved: the success sentence with a "Login" link — NOT signed in
        // (Rule 9; the login form below rendering at all proves it: a
        // signed-in visitor is bounced off the Login page, Rule 1).
        await expect(page.getByText(PASSWORD_UPDATED)).toBeVisible();
        await expect(
            page.getByRole('main').getByRole('link', {name: 'Login', exact: true})
        ).toBeVisible();

        // The old password now fails with the generic error…
        const login = new LoginPage(page);
        await page.goto(`/index.php/${tag}/login`);
        await login.usernameInput.fill(username);
        await login.fillPassword(username + username);
        await login.submitButton.click();
        await expect(page.getByText(GENERIC_ERROR)).toBeVisible();

        // …and the new one signs in.
        await login.usernameInput.fill(username);
        await login.fillPassword(newPassword);
        await login.submitButton.click();
        await page.waitForURL((url) => !url.pathname.includes('/login'), {
            waitUntil: 'commit',
        });
        await expect(page).toHaveURL(/\/dashboard/);
    });

    test('scenario 5: a stale or altered reset link is refused', async ({page, browser, baseURL, opsApi, pkpMail}) => {
        test.slow();
        const tag = makeTag('u1s5');
        const username = `r${tag}`;
        const email = `${tag}-${APP}@mail.test`;
        await opsApi.createContext({
            tag,
            users: [{username, roles: ['author'], email}],
        });

        const resetUrl = await requestResetLink(page, pkpMail, {contextPath: tag, email});

        // Positive control in a second signed-out context: the link is live
        // before anything kills it — it opens the set-a-new-password form.
        const visitorContext = await browser.newContext({
            baseURL,
            storageState: {cookies: [], origins: []},
        });
        try {
            const visitor = await visitorContext.newPage();
            await visitor.goto(resetUrl);
            await expect(visitor.getByRole('heading', {name: 'Reset Password'})).toBeVisible();
            await expect(visitor.locator('input[name="password"]')).toBeVisible();

            // The account signs in — an outstanding link dies early (Rule 8).
            await signInVia(page, tag, username);

            // The same link now answers the dead-link page (Rule 10), with a
            // "Reset Password" link back to the lost-password form.
            await visitor.goto(resetUrl);
            await expect(visitor.getByText(INVALID_HASH)).toBeVisible();
            await expect(
                visitor.getByRole('main').getByRole('link', {name: 'Reset Password'})
            ).toBeVisible();

            // A link with a mangled code answers the same.
            const mangled = resetUrl.replace(
                /confirm=(.{6})/,
                (whole, lead) => `confirm=${lead === 'abcdef' ? 'fedcba' : 'abcdef'}`
            );
            expect(mangled).not.toBe(resetUrl);
            await visitor.goto(mangled);
            await expect(visitor.getByText(INVALID_HASH)).toBeVisible();
        } finally {
            await visitorContext.close();
        }
    });

    test('scenario 6 {OJS OMP}: no OPS screen offers the Create New Reviewer path that sets the forced-change flag (absence)', async ({asUser, opsApi}) => {
        // A preprint server has no review stage, so the one screen-driven
        // path that flags an account for a forced password change (the
        // review stage's "Create New Reviewer") does not exist — the flow
        // itself is covered by the OJS and OMP suites.
        const tag = makeTag('u1s6');
        const manager = `m${tag}`;
        const author = `a${tag}`;
        await opsApi.createContext({
            tag,
            users: [
                {username: manager, roles: ['manager']},
                {username: author, roles: ['author']},
            ],
        });
        const seeded = await opsApi.createSubmission({tag, context: tag, submitter: author});

        const page = await (await asUser(manager)).newPage();
        await page.goto(
            `/index.php/${tag}/dashboard/editorial?workflowSubmissionId=${seeded.submissionId}`
        );
        const workflow = page.locator('[data-cy="active-modal"]');
        await expect(
            workflow.getByRole('heading', {name: /Workflow: Production/})
        ).toBeVisible();

        // Positive control: the workflow's own controls render.
        await expect(
            workflow
                .locator('[data-cy="workflow-action-items"]')
                .getByRole('button', {name: 'Post the preprint'})
        ).toBeVisible();

        // The stage menu offers Production (control, taken the same way) and
        // no Review entry; nothing on the screen offers a reviewer surface —
        // so no "Add Reviewer" window and no "Create New Reviewer" form.
        const stageMenu = workflow.locator('nav');
        await expect(stageMenu.getByText('Production', {exact: true})).toBeVisible();
        await expect(stageMenu.getByText(/review/i)).toHaveCount(0);
        await expect(workflow.getByRole('button', {name: /Add Reviewer/})).toHaveCount(0);
        await expect(workflow.getByText('Create New Reviewer')).toHaveCount(0);
    });

    test('scenario 7: administrator impersonates a user and returns', async ({page, opsApi}) => {
        test.slow();
        const tag = makeTag('u1s7');
        const author = `a${tag}`;
        const authorName = `Aut${tag}`;
        // Scratch server so no shared surface is touched (admin is
        // auto-enrolled as its manager by the context scenario).
        await opsApi.createContext({
            tag,
            users: [
                {username: author, roles: ['author'], givenName: authorName, familyName: 'Impersonatee'},
            ],
        });

        // Fresh UI login — impersonation migrates sessions, so the cached
        // .auth storage states stay out of this test.
        const login = new LoginPage(page);
        await login.goto();
        await login.signIn('admin', getPassword('admin'));

        // Users & Roles offers Login As on the author's row (Rule 14).
        const users = new UsersRolesPage(page, tag);
        await users.goto();
        const row = users.userRow(authorName);
        await expect(row).toBeVisible();
        await row.getByRole('button').click();
        await page.getByRole('menuitem', {name: 'Login As'}).click();

        // The confirmation dialog warns about attribution (Rule 12); OK.
        const dialog = page.getByRole('dialog').filter({hasText: CONFIRM_LOGIN_AS});
        await expect(dialog).toBeVisible();
        await dialog.getByRole('button', {name: 'OK'}).click();

        // The browser is now the author's session, landed per Rule 3, and
        // the user menu says so, naming the impersonated account (Rule 13).
        await page.waitForURL(/\/dashboard/, {waitUntil: 'commit'});
        await openUserMenu(page);
        await expect(page.getByText(`You are currently logged in as ${author}`)).toBeVisible();

        // "Logout as {username}" restores the administrator, no password
        // asked (Rule 15).
        await page.getByRole('link', {name: `Logout as ${author}`}).first().click();
        await expect(userNav(page)).toBeVisible();
        await openUserMenu(page);
        await expect(page.getByText(/You are currently logged in as/)).toHaveCount(0);
        await expect(page.getByRole('link', {name: 'Logout', exact: true})).toBeVisible();
        await page.keyboard.press('Escape');

        // Restored identity, proven by an administrator-only screen opening.
        await page.goto('/index.php/index/admin');
        await expect(page.getByRole('heading', {name: 'Administration'})).toBeVisible();
    });

    test('scenario 8: manager impersonates a participant from the Participants panel', async ({page, opsApi}) => {
        test.slow();
        const tag = makeTag('u1s8');
        // Seeded on the shared server, where the real submit auto-assigns the
        // PRE section's Moderators (sectioneditor.ana/ravi) as participants.
        // A scratch server cannot host this scenario: sub-editor
        // auto-assignment silently fails there (SubEditorsDAO::assignEditors
        // group-id filter defect — reported outside this suite), and the
        // participant would never appear. The submission is this test's own;
        // nothing on the seeded server is mutated.
        const moderator = 'sectioneditor.ana';
        const modFullName = 'Ana Section Editor';
        const author = 'author.alex';
        const authorFullName = 'Alex Author';
        const seeded = await opsApi.createSubmission({
            tag,
            context: 'publicknowledge',
            submitter: author,
        });

        const workflowUrl = `/index.php/publicknowledge/dashboard/editorial?workflowSubmissionId=${seeded.submissionId}`;

        // Fresh UI login for the impersonator (never the cached .auth state —
        // impersonation migrates the session it runs in).
        await signInVia(page, 'publicknowledge', 'manager.maya');
        await page.goto(workflowUrl);
        const workflow = page.locator('[data-cy="active-modal"]');
        await expect(
            workflow.getByRole('heading', {name: /Workflow: Production/})
        ).toBeVisible();
        const participants = page.locator('[data-cy="participant-manager"]');
        await expect(participants).toBeVisible();

        // {OJS OMP} reviewer variant: a preprint server has no Reviewers
        // table — the rendered Participants panel is the positive control.
        await expect(workflow.getByText('Reviewers', {exact: true})).toHaveCount(0);

        // Moderator participant's row menu → Login As → confirm.
        const modItem = participants.locator('li').filter({hasText: modFullName});
        await expect(modItem).toBeVisible();
        await modItem.getByRole('button', {name: `${modFullName} More Actions`}).click();
        await page.getByRole('menuitem', {name: 'Login As'}).click();
        const dialog = page.getByRole('dialog').filter({hasText: CONFIRM_LOGIN_AS});
        await expect(dialog).toBeVisible();
        await dialog.getByRole('button', {name: 'OK'}).click();

        // The browser lands on the same preprint as that participant, and the
        // top of the Participants panel offers "Logout as {participant}"
        // (Rule 13 — the label names the impersonated user's full name).
        const logoutAsEntry = participants.getByRole('button', {
            name: `Logout as ${modFullName}`,
        });
        await expect(logoutAsEntry).toBeVisible();
        await expect(page).toHaveURL(
            new RegExp(`workflowSubmissionId=${seeded.submissionId}`)
        );

        // Pressing it returns to the manager's view of the same preprint.
        await logoutAsEntry.click();
        await expect(
            workflow.getByRole('heading', {name: /Workflow: Production/})
        ).toBeVisible();
        await expect(participants).toBeVisible();
        await expect(participants.getByRole('button', {name: /^Logout as /})).toHaveCount(0);
        await expect(page).toHaveURL(
            new RegExp(`workflowSubmissionId=${seeded.submissionId}`)
        );

        // Author variant: impersonating the preprint's author lands on the
        // author's own view of it, which shows no Participants panel — the
        // way back is the user menu's "Logout as {author}" entry. (A fresh
        // load of the same address keeps the modal render stable after the
        // impersonation round-trip.)
        await page.goto(workflowUrl);
        const authorItem = participants.locator('li').filter({hasText: authorFullName});
        await expect(authorItem).toBeVisible();
        await authorItem.getByRole('button', {name: `${authorFullName} More Actions`}).click();
        await page.getByRole('menuitem', {name: 'Login As'}).click();
        const authorDialog = page.getByRole('dialog').filter({hasText: CONFIRM_LOGIN_AS});
        await expect(authorDialog).toBeVisible();
        await authorDialog.getByRole('button', {name: 'OK'}).click();

        await page.waitForURL(/\/dashboard\/mySubmissions/, {waitUntil: 'commit'});
        await expect(page).toHaveURL(
            new RegExp(`workflowSubmissionId=${seeded.submissionId}`)
        );
        // The author's view renders (anchored on inner content — the modal
        // wrapper's visibility is unreliable, patterns.md pitfall 5), and it
        // shows no Participants panel.
        await expect(page.getByText(`Submission ${tag}`).first()).toBeVisible();
        await expect(page.locator('[data-cy="participant-manager"]')).toHaveCount(0);

        await openUserMenu(page);
        await expect(page.getByText(`You are currently logged in as ${author}`)).toBeVisible();
        await page.getByRole('link', {name: `Logout as ${author}`}).first().click();

        // Back as the manager, on the same preprint's editorial view.
        await page.waitForURL(/\/dashboard\/editorial/, {waitUntil: 'commit'});
        await expect(
            page
                .locator('[data-cy="active-modal"]')
                .getByRole('heading', {name: /Workflow: Production/})
        ).toBeVisible();
        await openUserMenu(page);
        await expect(page.getByText(/You are currently logged in as/)).toHaveCount(0);
        await expect(page.getByRole('link', {name: 'Logout', exact: true})).toBeVisible();
    });
});
