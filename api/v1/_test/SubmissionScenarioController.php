<?php

/**
 * @file api/v1/_test/SubmissionScenarioController.php
 *
 * Copyright (c) 2023-2026 Simon Fraser University
 * Copyright (c) 2023-2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class SubmissionScenarioController
 *
 * @ingroup api_v1__test
 *
 * @brief OPS overlay for the shared submission scenario endpoint.
 *
 * A preprint has ONE app concept the app-neutral spec does not carry — the
 * SECTION it is filed under — and that is the whole overlay. Two absences are
 * as much a part of the contract as the presence:
 *
 * 1. **No promoting decision.** OPS has a single Production stage and its whole
 *    decision roster is Decline / Revert Decline (plus the workflow-bookkeeping
 *    MoveToDone / ReturnToWorkflow / ReturnToDone). Nothing opens peer review,
 *    so `promoteToReviewDecision()` stays null — the base class's default — and
 *    a spec carrying `reviewRounds` is refused by the shared builder, which
 *    finds no review stage in `Application::getReviewStages()`. That refusal is
 *    the point: silently dropping a reviewer block once cost a real
 *    investigation (PRINCIPLES design record 4).
 * 2. **No `issue`.** OPS posts continuously; `published: true` alone is the
 *    whole of "post the preprint", and the shared builder's publish path
 *    (validatePublish + publish, acting as an editorial user) is the real post
 *    path.
 *
 * "Staged" on OPS therefore means one thing only: a submitted preprint sitting
 * in Production, the app's single stage. Nothing here names that stage id — the
 * shared layer reads it from `Application::getApplicationStages()`, which is the
 * fix for the recorded trap where a hard-coded initial stage made every seeded
 * OPS submission invisible.
 */

namespace APP\API\v1\_test;

use APP\facades\Repo;
use PKP\API\v1\_test\PKPSubmissionScenarioController;
use PKP\context\Context;
use PKP\testing\scenario\ScenarioException;

class SubmissionScenarioController extends PKPSubmissionScenarioController
{
    /**
     * @copydoc \PKP\API\v1\_test\PKPTestApiController::schemaOverlayProperties()
     */
    public function schemaOverlayProperties(): array
    {
        return [
            'section' => [
                'type' => 'string',
                'description' => 'OPS overlay. Abbreviation of the section to submit to; defaults to the server\'s first section.',
            ],
        ];
    }

    /**
     * @copydoc \PKP\API\v1\_test\PKPSubmissionScenarioController::applyPublicationOverlay()
     *
     * @throws ScenarioException
     */
    protected function applyPublicationOverlay(array $spec, Context $context, array &$publicationProps): void
    {
        $publicationProps['sectionId'] = $this->resolveSectionId($spec, $context);
    }

    /**
     * @throws ScenarioException
     */
    protected function resolveSectionId(array $spec, Context $context): int
    {
        $locale = $context->getPrimaryLocale();
        $sections = Repo::section()->getCollector()->filterByContextIds([$context->getId()])->getMany();

        if ($sections->isEmpty()) {
            throw new ScenarioException("Server '{$context->getPath()}' has no sections.", 'context');
        }

        if (!isset($spec['section'])) {
            return $sections->first()->getId();
        }

        $match = $sections->first(fn ($section) => $section->getAbbrev($locale) === $spec['section']);

        if (!$match) {
            throw new ScenarioException(
                "Server '{$context->getPath()}' has no section with abbreviation '{$spec['section']}'. Available: "
                    . $sections->map(fn ($section) => $section->getAbbrev($locale))->implode(', ') . '.',
                'section'
            );
        }

        return $match->getId();
    }

    /**
     * @copydoc \PKP\API\v1\_test\PKPSubmissionScenarioController::submissionEcho()
     */
    protected function submissionEcho(\APP\submission\Submission $submission, array $spec): array
    {
        $publication = $submission->getCurrentPublication();

        return array_filter([
            'sectionId' => $publication?->getData('sectionId'),
        ]);
    }
}
