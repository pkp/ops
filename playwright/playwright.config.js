/**
 * @file playwright/playwright.config.js
 *
 * OPS fleet: port 8200 (+parallelIndex per worker). All harness mechanics live
 * in the shared factory.
 */
const path = require('path');
const {definePkpConfig} = require('../lib/pkp/playwright/config-factory.js');

module.exports = definePkpConfig({
    appName: 'ops',
    appRoot: path.resolve(__dirname, '..'),
    basePort: 8200,
});
