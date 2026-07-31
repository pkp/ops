/**
 * @file playwright/support/fixtures.js
 *
 * The OPS test extension — layers OPS fixtures on top of the shared base.
 */
const base = require('../../lib/pkp/playwright/support/base-test.js');

const test = base.test.extend({
    // OPS alias for the shared test-API client.
    opsApi: async ({pkpApi}, use) => {
        await use(pkpApi);
    },
});

module.exports = {test, expect: base.expect};
