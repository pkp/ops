/**
 * @file cypress/tests/data/60-content/CkwantesSubmission.spec.js
 *
 * Copyright (c) 2014-2020 Simon Fraser University
 * Copyright (c) 2000-2020 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 */

describe('Data suite tests', function() {
	it('Create a submission', function() {
		var title = 'The Facets Of Job Satisfaction: A Nine-Nation Comparative Study Of Construct Equivalence';
		cy.register({
			'username': 'ckwantes',
			'givenName': 'Catherine',
			'familyName': 'Kwantes',
			'affiliation': 'University of Windsor',
			'country': 'Canada'
		});

		cy.createSubmission({
			title,
			'section': 'Preprints',
			'abstract': 'Archival data from an attitude survey of employees in a single multinational organization were used to examine the degree to which national culture affects the nature of job satisfaction. Responses from nine countries were compiled to create a benchmark against which nations could be individually compared. Factor analysis revealed four factors: Organizational Communication, Organizational Efficiency/Effectiveness, Organizational Support, and Personal Benefit. Comparisons of factor structures indicated that Organizational Communication exhibited the most construct equivalence, and Personal Benefit the least. The most satisfied employees were those from China, and the least satisfied from Brazil, consistent with previous findings that individuals in collectivistic nations report higher satisfaction. The research findings suggest that national cultural context exerts an effect on the nature of job satisfaction.',
			'keywords': [
				'employees',
				'survey'
			]
		});
	
		cy.get('a').contains('Review this submission').click();

		// Edit metadata
		cy.get('button#metadata-button').click();
		cy.get('#metadata-keywords-control-en_US').type('multinational{enter}', {delay: 0});
		cy.wait(100);
		cy.get('#metadata button').contains('Save').click();
		cy.contains('The metadata have been updated.');
		cy.get('#metadata-keywords-selected-en_US').contains('multinational');

		// Edit Contributors
		cy.wait(1500);
		cy.get('button#contributors-button').click();
		cy.get('a[id^="component-grid-users-author-authorgrid-addAuthor-button-"]').click();
		cy.wait(250);
		cy.get('input[id^="givenName-en_US-"]').type('Urho', {delay: 0});
		cy.get('input[id^="familyName-en_US-"]').type('Kekkonen', {delay: 0});
		cy.get('select[id=country]').select('Finland');
		cy.get('input[id^="email"]').type('ukk@mailinator.com', {delay: 0});
		cy.get('input[id^="affiliation-en_US-"]').type('Academy of Finland', {delay: 0});
		cy.get('label').contains('Author').click();
		cy.get('form#editAuthor').find('button:contains("Save")').click();
		cy.contains('Author added.');
		cy.wait(500);
		cy.get('[id*="authorgrid-row"] span').contains('Urho Kekkonen');

		// Edit title
		cy.get('button#titleAbstract-button').click();
		cy.get('input[id^="titleAbstract-title-control-en_US"').clear()
		cy.get('input[id^="titleAbstract-title-control-en_US"').type('The Facets Of Job Satisfaction', {delay: 0});
		cy.get('input[id^="titleAbstract-subtitle-control-en_US"').type('A Nine-Nation Comparative Study Of Construct Equivalence', {delay: 0});
		cy.get('#titleAbstract button').contains('Save').click();
		cy.contains('The title and abstract have been updated.');
		cy.wait(500);
		cy.logout();
	});

	it('Publish submission', function() {
		cy.findSubmissionAsEditor('dbarnes', null, 'The Facets Of Job Satisfaction');
		cy.get('ul.pkp_workflow_decisions button:contains("Schedule For Publication")').click();
		cy.get('div.pkpPublication button:contains("Schedule For Publication"):visible').click();
		cy.get('div:contains("All requirements have been met. Are you sure you want to publish this?")');
		cy.get('button:contains("Publish")').click();
	});



})
