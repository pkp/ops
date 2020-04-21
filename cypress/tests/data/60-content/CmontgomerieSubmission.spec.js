/**
 * @file cypress/tests/data/60-content/CmontgomerieSubmission.spec.js
 *
 * Copyright (c) 2014-2020 Simon Fraser University
 * Copyright (c) 2000-2020 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 */

describe('Data suite tests', function() {
	it('Create a submission', function() {
		var title = 'Computer Skill Requirements for New and Existing Teachers: Implications for Policy and Practice';
		cy.register({
			'username': 'cmontgomerie',
			'givenName': 'Craig',
			'familyName': 'Montgomerie',
			'affiliation': 'University of Alberta',
			'country': 'Canada'
		});

		cy.createSubmission({
			title,
			'section': 'Preprints',
			'abstract': 'The integration of technology into the classroom is a major issue in education today. Many national and provincial initiatives specify the technology skills that students must demonstrate at each grade level. The Government of the Province of Alberta in Canada, has mandated the implementation of a new curriculum which began in September of 2000, called Information and Communication Technology. This curriculum is infused within core courses and specifies what students are “expected to know, be able to do, and be like with respect to technology” (Alberta Learning, 2000). Since teachers are required to implement this new curriculum, school jurisdictions are turning to professional development strategies and hiring standards to upgrade teachers’ computer skills to meet this goal. This paper summarizes the results of a telephone survey administered to all public school jurisdictions in the Province of Alberta with a 100% response rate. We examined the computer skills that school jurisdictions require of newly hired teachers, and the support strategies employed for currently employed teachers.',
			'keywords': [
				'Integrating Technology',
				'Computer Skills',
				'Survey',
				'Alberta',
				'National',
				'Provincial',
				'Professional Development'
			],
			'additionalAuthors': [
				{
					'givenName': 'Mark',
					'familyName': 'Irvine',
					'country': 'Canada',
					'affiliation': 'University of Victoria',
					'email': 'mirvine@mailinator.com'
				}
			]
		});
		cy.logout();

		cy.findSubmissionAsEditor('dbarnes', null, title);
		cy.get('ul.pkp_workflow_decisions button:contains("Schedule For Publication")').click();
		cy.get('div.pkpPublication button:contains("Schedule For Publication"):visible').click();
		cy.get('div:contains("All requirements have been met. Are you sure you want to publish this?")');
		cy.get('button:contains("Publish")').click();
		cy.logout();
		
		cy.login('dbarnes', 'dbarnesdbarnes', 'publicknowledge');
		cy.get('button[id="archive-button"]').click();
		cy.get('div[id=archive]').find('div').contains(title).parent().parent().click();

		cy.get('#publication-button').click();
		cy.get('div.pkpPublication button:contains("Unpublish"):visible').click();
		cy.get('div:contains("Are you sure you don\'t want this to be published?")');
		cy.get('.pkpModalConfirmButton').click();

		cy.get('#metadata-button').click();
		cy.get('#metadata-keywords-control-en_US').type('empl', {delay: 0});
		cy.wait(500);
		cy.get('li').contains('employees').click({force: true});
		cy.get('#metadata-keywords-control-en_US').type('social{downarrow}{downarrow}{enter}', {delay: 0});
		cy.get('#metadata button').contains('Save').click();
		cy.contains('The metadata have been updated.');
		cy.get('#metadata-keywords-selected-en_US').contains('Professional Development');
		cy.get('#metadata-keywords-selected-en_US').contains('employees');
		cy.get('div.pkpPublication button:contains("Schedule For Publication"):visible').click();
		cy.get('div:contains("All requirements have been met. Are you sure you want to publish this?")');
		cy.get('button:contains("Publish")').click();

		cy.get('div.pkpPublication button:contains("Create New Version"):visible').click();
		cy.get('div:contains("Are you sure you want to create a new version?")');
		cy.get('.pkpModalConfirmButton').click();
		cy.get('#license-button').click();
		cy.get('input[id^="publicationLicense-copyrightHolder-control-en_US"').clear()
		cy.get('input[id^="publicationLicense-copyrightHolder-control-en_US"').type('Craig Montgomerie', {delay: 0});
		cy.get('#license button').contains('Save').click();
		cy.contains('The copyright and license information have been updated.');
		cy.get('div.pkpPublication button:contains("Schedule For Publication"):visible').click();
		cy.get('div:contains("All requirements have been met. Are you sure you want to publish this?")');
		cy.get('button:contains("Publish")').click();
		

	});
})
