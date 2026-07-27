// @ts-check
/**
 * @file playwright/support/app.context.js
 *
 * Copyright (c) 2014-2026 Simon Fraser University
 * Copyright (c) 2003-2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * What the shared `lib/pkp/playwright` layer is allowed to know about OPS.
 *
 * Shared code gates on CAPABILITIES and resolves people through ARCHETYPES; it
 * never asks which app it is running in. OJS and OMP ship the same three keys
 * with their own values, so a shared spec written once runs in all three fleets
 * and skips itself where the capability does not hold.
 *
 * The capability names are canonical in `lib/pkp/docs/product/APP-GLOSSARY.md`
 * §2 and are spelled here VERBATIM from that table's OPS column. Adding a
 * capability means adding a glossary row first, then the same key in all three
 * app contexts.
 *
 * OPS is the app that catches assumptions: no review stage, no copyediting, no
 * issues, no reviewer group, and a SINGLE workflow stage (Production). A shared
 * spec that quietly assumes any of those is a shared spec that is wrong.
 */

const {bootstrapPayload} = require('../fixtures/bootstrap.js');

const appContext = {
	app: 'ops',

	/** APP-GLOSSARY.md §2, OPS column. */
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

	/**
	 * APP-GLOSSARY.md §1, OPS column. Vocabulary never gates anything — it is
	 * what a shared spec puts in a label or a payload so the same test reads
	 * correctly in each app.
	 *
	 * `issue` is null, not a synonym: OPS posts continuously (glossary: "a '—'
	 * cell means the concept does not exist in that app").
	 */
	vocab: {
		context: 'preprint server',
		contextPlural: 'preprint servers',
		submission: 'preprint',
		sectionGrouping: 'section',
		issue: null,
		galley: 'galley',
		publishAction: 'Post the preprint',
	},

	seed: {
		/** The shared base context every fleet seeds at the same url path. */
		contextPath: 'publicknowledge',
		contextName: 'Public Knowledge Preprint Server',
		primaryLocale: 'en',
		supportedLocales: ['en', 'fr_CA'],

		/**
		 * Archetype → seeded username, or null where OPS has no such account.
		 *
		 * Shared code asks for `actors.reviewer`, not for a username: the
		 * archetype exists in every app's vocabulary even when the account does
		 * not, and OPS is where most of them do not. The KEYS are the same in all
		 * three apps; only the values differ.
		 *
		 * `sectionEditor*` resolves to OPS's MODERATORS — the Moderator group is
		 * the sub-editor slot (APP-GLOSSARY §1), and the shared roster is keyed by
		 * permission archetype rather than by an app's label for it.
		 *
		 * An OPS suite may name these usernames directly; only shared code has to
		 * go through the archetype.
		 */
		actors: {
			siteAdmin: 'admin',
			manager: 'manager.maya',
			// No editor group in OPS.
			editor: null,
			sectionEditor: 'sectioneditor.ana',
			sectionEditor2: 'sectioneditor.ravi',
			// Enrolled as a Moderator but assigned to no section — the negative
			// control for "an assigned moderator sees the preprint".
			sectionEditor3: 'sectioneditor.omar',
			// No reviewer group in OPS: no review stage to review in.
			reviewer: null,
			reviewer2: null,
			reviewer3: null,
			reviewer4: null,
			// No copyediting stage, so none of its people.
			copyeditor: null,
			copyeditor2: null,
			layoutEditor: null,
			proofreader: null,
			author: 'author.alex',
			author2: 'author.bea',
			// OPS's assistant-role group is Editorial Board Member, which is
			// declared with NO workflow stages — the archetype resolves, but it
			// carries far less than OJS's assistant does.
			assistant: 'assistant.rita',
			reader: 'reader.rosa',
			// No payments code at all in OPS.
			subscriptionManager: null,
		},

		/** Section abbreviations the base seed creates. OPS has exactly one. */
		sections: ['PRE'],
	},

	/** The base seed, as data. See playwright/fixtures/bootstrap.js. */
	bootstrapPayload,
};

module.exports = {appContext};
