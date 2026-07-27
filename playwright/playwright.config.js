// @ts-check
/**
 * @file playwright/playwright.config.js
 *
 * Copyright (c) 2014-2026 Simon Fraser University
 * Copyright (c) 2003-2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * OPS's Playwright configuration. Everything of substance lives in the shared
 * factory; this file only says which app this is and where it listens.
 *
 * Port 8200 is OPS's slot in the fleet (OJS 8000, OMP 8100) — the three suites
 * run side by side against separate databases and one shared Mailpit.
 */

const path = require('path');
const {definePkpConfig} = require('../lib/pkp/playwright/config-factory.js');

module.exports = definePkpConfig({
	appName: 'ops',
	appRoot: path.join(__dirname, '..'),
	basePort: Number(process.env.PLAYWRIGHT_BASE_PORT || 8200),
});
