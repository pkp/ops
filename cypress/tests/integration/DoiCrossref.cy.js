/**
 * @file cypress/tests/integration/Crossref.cy.js
 *
 * Copyright (c) 2014-2021 Simon Fraser University
 * Copyright (c) 2000-2021 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 */

describe('Crossref tests', function () {
	const submissionId = 19;

	it('Check Crossref Configuration', function() {
		cy.login('dbarnes', null, 'publicknowledge');

		cy.get('nav').contains('Settings').click();
		// Ensure submenu item click despite animation
		cy.get('nav').contains('Website').click({ force: true });

		cy.waitJQuery();
		cy.get('button#plugins-button').click();

		// Crossref plugin is or can be enabled
		cy.get('input[id^=select-cell-crossrefplugin]').check();
		cy.get('input[id^=select-cell-crossrefplugin]').should('be.checked');

		// Crossref is enabled as DOI registration agency.
		cy.get('nav').contains('Settings').click();
		// Ensure submenu item click despite animation
		cy.get('nav').contains('Distribution').click({ force: true });
		cy.get('button#dois-button').click();
		cy.get(
			'#doiSetup input[name="enabledDoiTypes"][value="representation"]'
		).should('not.exist');

		cy.get('button#doisRegistration-button').click();

		cy.get('select#doiRegistrationSettings-registrationAgency-control').select('crossrefplugin');
		cy.get('input[name=depositorName]').focus().clear().type('admin');
		cy.get('input[name=depositorEmail]').focus().clear().type('pkpadmin@mailinator.com');

		// Save
		cy.get('#doisRegistration button').contains('Save').click();
		cy.get('#doisRegistration [role="status"]').contains('Saved');
		cy.get('select#doiRegistrationSettings-registrationAgency-control').should('have.value', 'crossrefplugin');

		cy.log('Check representation pubObject type disabled');
		cy.get('button#doisSetup-button').click();
		cy.get(
			'#doiSetup input[name="enabledDoiTypes"][value="representation"]'
		).should('not.exist');
		cy.logout();
	});

	it('Check Crossref Export', function() {
		cy.login('dbarnes', null, 'publicknowledge');

		// Submit export submission DOI XML request
		cy.window()
			.then((win) => {
				const csrfToken = win.pkp.currentUser.csrfToken;
				cy.request({
					url: '/index.php/publicknowledge/api/v1/dois/submissions/export',
					method: 'POST',
					headers: {
						'X-Csrf-Token': csrfToken,
						'X-Http-Method-Override': 'PUT'
					},
					body: {
						ids: [submissionId]
					}
				})
			})
			.then((response) => {
				expect(response.status).to.equal(200);
				expect(response.body).to.haveOwnProperty('temporaryFileId');
				expect(response.body.temporaryFileId).to.be.a('number');
			});

		cy.log('Deselect Crossref as registered agency for downstream tests');
		cy.get('nav').contains('Settings').click();
		// Ensure submenu item click despite animation
		cy.get('nav').contains('Distribution').click({ force: true });
		cy.get('button#dois-button').click();
		cy.get('button#doisRegistration-button').click();
		cy.get('select#doiRegistrationSettings-registrationAgency-control').select(
			'None'
		);
		// Save
		cy.get('#doisRegistration button').contains('Save').click();
		cy.get('#doisRegistration [role="status"]').contains('Saved');
		cy.logout();
	});
});
