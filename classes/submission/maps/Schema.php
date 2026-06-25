<?php

/**
 * @file classes/submission/maps/Schema.php
 *
 * Copyright (c) 2014-2020 Simon Fraser University
 * Copyright (c) 2000-2020 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class Schema
 *
 * @brief Map submissions to the properties defined in the submission schema
 */

namespace APP\submission\maps;

use APP\core\Application;
use APP\decision\Decision;
use APP\decision\types\Decline;
use APP\decision\types\RevertDecline;
use APP\facades\Repo;
use APP\submission\Submission;
use Illuminate\Support\Collection;
use PKP\decision\DecisionType;
use PKP\decision\types\ReturnToDone;
use PKP\decision\types\ReturnToWorkflow;
use PKP\plugins\Hook;
use PKP\security\Role;
use PKP\stageAssignment\StageAssignment;

class Schema extends \PKP\submission\maps\Schema
{
    /**
     * @copydoc \PKP\submission\maps\Schema::mapByProperties()
     */
    protected function mapByProperties(array $props, Submission $submission, bool|Collection $anonymizeReviews = false): array
    {
        $output = parent::mapByProperties($props, $submission, $anonymizeReviews);
        if (in_array('urlPublished', $props)) {
            $output['urlPublished'] = $this->request->getDispatcher()->url(
                $this->request,
                Application::ROUTE_PAGE,
                $this->context->getPath(),
                'preprint',
                'view',
                [$submission->getBestId()]
            );
        }

        $locales = $this->context->getSupportedSubmissionMetaDataLocales();

        if (!in_array($submissionLocale = $submission->getData('locale'), $locales)) {
            $locales[] = $submissionLocale;
        }

        $output = $this->schemaService->addMissingMultilingualValues($this->schemaService::SCHEMA_SUBMISSION, $output, $locales);

        ksort($output);

        return $this->withExtensions($output, $submission);
    }


    /**
     * Gets the Editorial decisions available to editors for a given stage of a submission
     *
     * This method returns decisions only for active stages. For inactive stages, it returns an empty array.
     *
     * @return DecisionType[]
     *
     * @hook Workflow::Decisions [[&$decisionTypes, $stageId]]
     */
    protected function getAvailableEditorialDecisions(int $stageId, Submission $submission): array
    {
        $request = Application::get()->getRequest();
        $user = $request->getUser();
        $isActiveStage = $submission->getData('stageId') == $stageId;
        $userHasAccessibleRoles = $user->hasRole([Role::ROLE_ID_SUB_EDITOR, Role::ROLE_ID_MANAGER, Role::ROLE_ID_SITE_ADMIN, Role::ROLE_ID_ASSISTANT], $request->getContext()->getId());
        $permissions = $this->checkDecisionPermissions($stageId, $submission, $user, $request->getContext()->getId());

        // Done has no stage assignments, so checkDecisionPermissions returns false for canMakeDecision
        // for assigned sub-editors. Grant decision access to any editor assigned to this submission.
        if ($stageId === WORKFLOW_STAGE_ID_DONE && !$permissions['canMakeDecision']) {
            $isAssignedEditor = StageAssignment::withSubmissionIds([$submission->getId()])
                ->withUserId($user->getId())
                ->withRoleIds([Role::ROLE_ID_MANAGER, Role::ROLE_ID_SUB_EDITOR])
                ->exists();
            if ($isAssignedEditor) {
                $permissions['canMakeDecision'] = true;
            }
        }

        /** Only the production and done stages are supported in OPS.*/
        if (!in_array($stageId, [WORKFLOW_STAGE_ID_PRODUCTION, WORKFLOW_STAGE_ID_DONE]) || !$userHasAccessibleRoles || !$isActiveStage || !$permissions['canMakeDecision']) {
            return [];
        }

        $isOnlyRecommending = $permissions['isOnlyRecommending'];
        $decisionTypes = []; /** @var DecisionType[] $decisionTypes */

        if ($isOnlyRecommending) {
            $decisionTypes[] = Repo::decision()->getDecisionTypesMadeByRecommendingUsers($stageId);
        } else {
            switch ($submission->getData('status')) {
                case Submission::STATUS_DECLINED:
                    $decisionTypes[] = new RevertDecline();
                    break;
                case Submission::STATUS_QUEUED:
                    $decisionTypes[] = new Decline();
                    break;
            }

            if ($stageId === WORKFLOW_STAGE_ID_DONE) {
                $decisionTypes = [new ReturnToWorkflow()];
            }
        }

        // Offer ReturnToDone in any active stage when the submission was previously in Done.
        if ($stageId !== WORKFLOW_STAGE_ID_DONE && $submission->getData('stageId') === $stageId) {
            if (Repo::decision()->hasDoneHistory($submission->getId())) {
                $decisionTypes[] = new ReturnToDone();
            }
        }

        Hook::call('Workflow::Decisions', [&$decisionTypes, $stageId]);

        return $decisionTypes;
    }
}
