/**
 * @file cypress/tests/data/60-content/CmontgomerieSubmission.cy.js
 *
 * Copyright (c) 2014-2025 Simon Fraser University
 * Copyright (c) 2000-2025 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 */

describe('Data suite: Cmontgomerie', function() {

	let submission;

	before(function() {
		const title = 'Computer Skill Requirements for New and Existing Teachers: Implications for Policy and Practice';
		submission = {
			id: 0,
			section: 'Preprints',
			prefix: '',
			title: title,
			subtitle: '',
			abstract: 'The integration of technology into the classroom is a major issue in education today. Many national and provincial initiatives specify the technology skills that students must demonstrate at each grade level. The Government of the Province of Alberta in Canada, has mandated the implementation of a new curriculum which began in September of 2000, called Information and Communication Technology. This curriculum is infused within core courses and specifies what students are “expected to know, be able to do, and be like with respect to technology” (Alberta Learning, 2000). Since teachers are required to implement this new curriculum, school jurisdictions are turning to professional development strategies and hiring standards to upgrade teachers’ computer skills to meet this goal. This paper summarizes the results of a telephone survey administered to all public school jurisdictions in the Province of Alberta with a 100% response rate. We examined the computer skills that school jurisdictions require of newly hired teachers, and the support strategies employed for currently employed teachers.',
			shortAuthorString: 'Montgomerie et al.',
			authorNames: ['Craig Montgomerie', 'Mark Irvine'],
			sectionId: 1,
			assignedAuthorNames: ['Craig Montgomerie'],
			additionalAuthors: [
				{
					givenName: {en: 'Mark'},
					familyName: {en: 'Irvine'},
					country: 'CA',
					affiliations: [
						{
							name: {en: 'University of Victoria'}
						}
					],
					email: 'mirvine@mailinator.com',
					userGroupId: Cypress.env('authorUserGroupId')
				}
			],
			files: [
				{
					'file': 'dummy.pdf',
					'fileName': title + '.pdf',
					'mimeType': 'application/pdf',
					'genre': Cypress.env('defaultGenre')
				},
			],
			keywords: [
				'Integrating Technology',
				'Computer Skills',
				'Survey',
				'Alberta',
				'National',
				'Provincial',
				'Professional Development'
			]
		};
	});

	it('Create a submission', function() {

		cy.register({
			'username': 'cmontgomerie',
			'givenName': 'Craig',
			'familyName': 'Montgomerie',
			'affiliation': 'University of Alberta',
			'country': 'Canada'
		});

		cy.getCsrfToken();
		cy.window()
			.then(() => {
				return cy.createSubmissionWithApi(submission, this.csrfToken);
			})
			.then(xhr => {
				return cy.submitSubmissionWithApi(submission.id, this.csrfToken);
			});

		cy.logout();
		cy.findSubmissionAsEditor('dbarnes', null, 'Montgomerie');
		cy.get('button:contains("Post the preprint")').click();
		cy.get('button:contains("Post")').should('be.visible').click();
		cy.get('div:contains("All requirements have been met. Are you sure you want to post this?")');
		cy.get('[id^="publish"] button:contains("Post")').click();
		cy.logout();

		// Unpost 1st version
		cy.findSubmissionAsEditor('dbarnes', null, 'Montgomerie',  null, 'Published');
		cy.openWorkflowMenu('Author Original 1.0', 'Title & Abstract')
		cy.get('button:contains("Unpost")').should('be.visible').click();
		cy.get('div:contains("Are you sure you don\'t want this to be posted?")');
		cy.get('[data-cy=dialog] button').contains('Unpost').click();
		cy.get('div:contains("This version has been posted and can not be edited.")').should('not.exist');

		// Edit metadata in 1st version
		cy.openWorkflowMenu('Author Original 1.0', 'Metadata')
		cy.get('#metadata-keywords-control-en').type('employees{enter}');
		cy.wait(500);
		cy.get('button').contains('Save').click();
		cy.get('[role="status"]').contains('Saved');
		cy.get('#metadata-keywords-selected-en').contains('employees');
		cy.wait(1500);

		// Publish 1st version again
		cy.get('button:contains("Post")').click();
		cy.get('div:contains("All requirements have been met. Are you sure you want to post this?")');
		cy.get('[id^="publish"] button:contains("Post")').click();

		// Create 2nd version and change copyright holder
		cy.get(`[data-cy="active-modal"] nav a:contains('Create New Version')`).click();
		cy.assignPublicationStage('AO', 'false');
		// wait for the new publication data to appear on the side menu
		cy.get('body').then($body =>
			cy.get('span:contains("Unpublished")')
		);

		cy.openWorkflowMenu('Author Original 2.0', 'Permissions & Disclosure');
		cy.get('input[id^="publicationLicense-copyrightHolder-control-en"').clear();
		cy.get('input[id^="publicationLicense-copyrightHolder-control-en"').type('Craig Montgomerie');
		cy.get('button').contains('Save').click();
		cy.wait(1500)

		// Publish 2nd version
		cy.get('button').contains('Post').click();
		cy.contains('All requirements have been met.');
		cy.get('.pkpWorkflow__publishModal button').contains('Post').click();

	});
})
