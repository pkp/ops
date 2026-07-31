/**
 * @file playwright/fixtures/bootstrap.js
 *
 * Static seed data for the OPS base install (server `publicknowledge`).
 * READ-ONLY for tests — see the OJS twin for the policy notes.
 *
 * Subset-enrolled roster: no editor/reviewer/copyeditor/layout/proofreader
 * accounts (OPS ships no such groups); sectioneditor.* are Moderators —
 * ana/ravi assigned to section PRE, omar deliberately unassigned as a
 * visibility control; assistant.rita is an Editorial Board Member (no stage
 * access).
 */
const {getEmail} = require('../../lib/pkp/playwright/data/users.js');

const user = (username, givenName, familyName, roles, extra = {}) => ({
    username,
    givenName,
    familyName,
    email: getEmail(username),
    roles,
    ...extra,
});

module.exports = {
    context: {
        path: 'publicknowledge',
        name: {
            en: 'Public Knowledge Preprint Server',
            fr_CA: 'Serveur de prépublications de la connaissance du public',
        },
        acronym: {en: 'PKPS'},
        primaryLocale: 'en',
        supportedLocales: ['en', 'fr_CA'],
    },
    sections: [{abbrev: 'PRE', title: {en: 'Preprints', fr_CA: 'Prépublications'}}],
    categories: [
        {
            path: 'applied-science',
            title: {en: 'Applied Science'},
            children: [
                {
                    path: 'comp-sci',
                    title: {en: 'Computer Science'},
                    children: [{path: 'computer-vision', title: {en: 'Computer Vision'}}],
                },
                {path: 'eng', title: {en: 'Engineering'}},
            ],
        },
        {
            path: 'social-sciences',
            title: {en: 'Social Sciences'},
            children: [
                {path: 'sociology', title: {en: 'Sociology'}},
                {path: 'anthropology', title: {en: 'Anthropology'}},
            ],
        },
    ],
    users: [
        user('manager.maya', 'Maya', 'Manager', ['manager']),
        user('sectioneditor.ana', 'Ana', 'Section Editor', ['sectionEditor'], {sections: ['PRE']}),
        user('sectioneditor.ravi', 'Ravi', 'Section Editor', ['sectionEditor'], {sections: ['PRE']}),
        // deliberately unassigned to any section — visibility control
        user('sectioneditor.omar', 'Omar', 'Section Editor', ['sectionEditor']),
        user('author.alex', 'Alex', 'Author', ['author']),
        user('author.bea', 'Bea', 'Author', ['author']),
        // editorialBoardMember: OPS's only assistant-slot group (no stage access)
        user('assistant.rita', 'Rita', 'Assistant', ['editorialBoardMember']),
        user('reader.rosa', 'Rosa', 'Reader', ['reader']),
    ],
};
