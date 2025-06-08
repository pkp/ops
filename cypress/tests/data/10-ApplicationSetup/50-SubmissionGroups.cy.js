/**
 * @file cypress/tests/data/50-SubmissionGroups.cy.js
 *
 * Copyright (c) 2014-2021 Simon Fraser University
 * Copyright (c) 2000-2021 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 */

describe('Data suite tests', function() {
	it('Creates/configures sections', function() {
		cy.login('admin', 'admin');
		cy.get('a').contains('admin').click();
		cy.get('a').contains('Dashboard').click();
		cy.get('nav').contains('Settings').click();
		// Ensure submenu item click despite animation
		cy.get('nav').contains('Server').click({ force: true });
		cy.get('button[id="sections-button"]').click();

		// Edit Preprints section to add section editors
		cy.get('div#sections a[class=show_extras]').click();
		cy.get('a[id^=component-grid-settings-sections-sectiongrid-row-1-editSection-button-]').click();
		cy.wait(1000); // Avoid occasional failure due to form init taking time
		cy.get('label').contains('David Buskins').click();
		cy.get('label').contains('Stephanie Berardo').click();
		cy.get('form[id=sectionForm]').contains('Save').click();

	});
	it('Creates/configures categories', function() {
		cy.login('admin', 'admin');
		cy.get('a').contains('admin').click();
		cy.get('a').contains('Dashboard').click();
		cy.get('nav').contains('Settings').click();
		// Ensure submenu item click despite animation
		cy.get('nav').contains('Server').click({ force: true });
		cy.get('button[id="categories-button"]').click();

		// Create a Science category
		cy.addCategory('Social Sciences', 'social-sciences');

		// Create a Sociology subcategory
		cy.addCategory('Sociology', 'sociology', 'Social Sciences');
		cy.addCategory('Anthropology', 'anthropology', 'Social Sciences');

		// Create an Applied Science category
		cy.addCategory('Applied Science', 'applied-science');
		// Create a Computer Science subcategory
		cy.addCategory('Computer Science', 'comp-sci', 'Applied Science');

		// Create a Computer Vision subcategory within Computer Science
		cy.addCategory('Computer Vision', 'computer-vision', 'Computer Science');

		// Create an Engineering category
		cy.addCategory('Engineering', 'eng', 'Applied Science');
	});
})
