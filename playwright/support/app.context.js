/**
 * @file playwright/support/app.context.js
 *
 * OPS capability map + seeded-actor roster. Capability names are canonical in
 * lib/pkp/docs/e2e/specs/GLOSSARY.md Part II §2 — verbatim.
 *
 * OPS has no review stage, no copyediting, no reviewer groups and no
 * editor/copyeditor/layout/proofreader accounts — those archetypes map to
 * null. `sectioneditor.*` are enrolled as Moderators (the OPS sectionEditor
 * group): ana/ravi assigned to section PRE, omar deliberately unassigned as a
 * visibility control. `assistant.rita` is an Editorial Board Member (assistant
 * slot, NO stage access).
 */
const bootstrap = require('../fixtures/bootstrap.js');

module.exports = {
    appName: 'ops',
    contextPath: 'publicknowledge',
    capabilities: {
        hasReviewStage: false,
        hasInternalReview: false,
        hasCopyediting: false,
        hasProduction: true,
        hasIssues: false,
        hasGalleys: true,
        hasSubscriptions: false,
        hasSections: true,
        hasReviewerRoles: false,
    },
    seed: {
        actors: {
            admin: 'admin',
            manager: 'manager.maya',
            editor: null,
            sectionEditor: 'sectioneditor.ana',
            reviewer: null,
            copyeditor: null,
            layoutEditor: null,
            proofreader: null,
            assistant: 'assistant.rita',
            author: 'author.alex',
            reader: 'reader.rosa',
        },
        bootstrap,
    },
};
