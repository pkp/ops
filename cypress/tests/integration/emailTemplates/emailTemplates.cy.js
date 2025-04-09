/**
 * @file cypress/tests/integration/emailTemplates/emailTemplates.cy.js
 *
 * Copyright (c) 2014-2025 Simon Fraser University
 * Copyright (c) 2000-2025 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 */

describe('Email Template Access Tests', function() {
	it('Checks that user cannot access restricted template not assigned to their group', () => {
		cy.login('admin', 'admin', 'publicknowledge');
		cy.visit('/index.php/publicknowledge/management/settings/manageEmails');

		cy.openEmailTemplate('Discussion (Production)', 'Editor Assigned');
		// Remove all existing access
		cy.setEmailTemplateUnrestrictedTo(false);
		cy.get('input[name="assignedUserGroupIds"]')
			.as('checkboxes')
			.uncheck({force: true});

		cy.contains('button', 'Save').click();
		cy.logout();

		// Login as user without access - Moderator
		cy.login('dbuskins');
		cy.visit(
			'index.php/publicknowledge/en/dashboard/editorial?currentViewId=assigned-to-me'
		);
		cy.contains('button', 'View').first().click();
		cy.contains('a', 'Production').click();
		cy.contains('a', 'Add discussion').click();

		cy.get('select#template').find('option').contains('Editor Assigned').should('not.exist');
	});

	it('Checks that user can access unrestricted template not specifically assigned to their group', () => {
		cy.login('admin', 'admin', 'publicknowledge');
		cy.visit('/index.php/publicknowledge/management/settings/manageEmails');

		cy.openEmailTemplate('Discussion (Production)', 'Editor Assigned');

		cy.get('input[name="assignedUserGroupIds"]')
			.as('checkboxes')
			.uncheck({force: true});

		cy.contains('button', 'Save').click();
		cy.reload();

		cy.openEmailTemplate('Discussion (Production)', 'Editor Assigned');
		cy.setEmailTemplateUnrestrictedTo(true);

		cy.contains('button', 'Save').click();
		cy.logout();

		// Login as user with access - Moderator
		cy.login('dbuskins');
		cy.visit(
			'index.php/publicknowledge/en/dashboard/editorial?currentViewId=assigned-to-me'
		);
		cy.contains('button', 'View').first().click();
		cy.contains('a', 'Production').click();
		cy.contains('a', 'Add discussion').click();

		cy.get('select#template').find('option').contains('Editor Assigned').should('to.exist');
	});

	it('Checks that user can access template assigned to their group', () => {
		cy.login('admin', 'admin', 'publicknowledge');
		cy.visit('/index.php/publicknowledge/management/settings/manageEmails');

		cy.openEmailTemplate('Discussion (Production)', 'Editor Assigned');
		cy.setEmailTemplateUnrestrictedTo(false);
		cy.contains('label', 'Moderator').find('input[type="checkbox"]').check({force: true});
		cy.contains('button', 'Save').click();
		cy.logout();

		// Login as user with access - Moderator
		cy.login('dbuskins');
		cy.visit(
			'index.php/publicknowledge/en/dashboard/editorial?currentViewId=assigned-to-me'
		);
		cy.contains('button', 'View').first().click();
		cy.contains('a', 'Production').click();
		cy.contains('a', 'Add discussion').click();

		cy.get('select#template').find('option').contains('Editor Assigned').should('to.exist');
	});
});
