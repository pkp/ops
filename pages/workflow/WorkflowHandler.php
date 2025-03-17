<?php

/**
 * @file pages/workflow/WorkflowHandler.php
 *
 * Copyright (c) 2014-2021 Simon Fraser University
 * Copyright (c) 2003-2021 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class WorkflowHandler
 *
 * @ingroup pages_reviewer
 *
 * @brief Handle requests for the submission workflow.
 */

namespace APP\pages\workflow;

use APP\core\Application;
use APP\facades\Repo;
use APP\file\PublicFileManager;
use APP\publication\Publication;
use APP\submission\Submission;
use APP\template\TemplateManager;
use Exception;
use PKP\components\forms\publication\TitleAbstractForm;
use PKP\context\Context;
use PKP\notification\Notification;
use PKP\pages\workflow\PKPWorkflowHandler;
use PKP\security\Role;

class WorkflowHandler extends PKPWorkflowHandler
{
    /**
     * Constructor
     */
    public function __construct()
    {
        parent::__construct();

        $this->addRoleAssignment(
            [Role::ROLE_ID_SUB_EDITOR, Role::ROLE_ID_MANAGER, Role::ROLE_ID_SITE_ADMIN, Role::ROLE_ID_ASSISTANT],
            [
                'access', 'index', 'submission',
                'editorDecisionActions', // Submission & review
                'externalReview', // review
                'editorial',
                'production',
            ]
        );
    }

    /**
     * Setup variables for the template
     *
     * @param \APP\core\Request $request
     */
    public function setupIndex($request)
    {
        parent::setupIndex($request);

        $templateMgr = TemplateManager::getManager($request);
        $submission = $this->getAuthorizedContextObject(Application::ASSOC_TYPE_SUBMISSION);

        $submissionContext = $request->getContext();
        if ($submission->getData('contextId') !== $submissionContext->getId()) {
            $submissionContext = app()->get('context')->get($submission->getData('contextId'));
        }

        $latestPublication = $submission->getLatestPublication();

        $submissionLocale = $submission->getData('locale');
        $locales = collect($submissionContext->getSupportedSubmissionMetadataLocaleNames() + $submission->getPublicationLanguageNames())
            ->map(fn (string $name, string $locale) => ['key' => $locale, 'label' => $name])
            ->sortBy('key')
            ->values()
            ->toArray();

        $latestPublicationApiUrl = $request->getDispatcher()->url($request, Application::ROUTE_API, $submissionContext->getPath(), 'submissions/' . $submission->getId() . '/publications/' . $latestPublication->getId());
        $temporaryFileApiUrl = $request->getDispatcher()->url($request, Application::ROUTE_API, $submissionContext->getPath(), 'temporaryFiles');
        $relatePublicationApiUrl = $request->getDispatcher()->url($request, Application::ROUTE_API, $submissionContext->getPath(), 'submissions/' . $submission->getId() . '/publications/' . $latestPublication->getId()) . '/relate';

        $publicFileManager = new PublicFileManager();
        $baseUrl = $request->getBaseUrl() . '/' . $publicFileManager->getContextFilesPath($submissionContext->getId());

        $issueEntryForm = new \APP\components\forms\publication\IssueEntryForm($latestPublicationApiUrl, $locales, $latestPublication, $submissionContext, $baseUrl, $temporaryFileApiUrl);
        $relationForm = new \APP\components\forms\publication\RelationForm($relatePublicationApiUrl, $latestPublication);

        $templateMgr->setConstants([
            'FORM_ISSUE_ENTRY' => $issueEntryForm::FORM_ISSUE_ENTRY,
            'FORM_ID_RELATION' => $relationForm::FORM_ID_RELATION,
        ]);

        $sectionWordLimits = [];
        $sectionIterator = Repo::section()
            ->getCollector()
            ->filterByContextIds([$submissionContext->getId()])
            ->getMany();
        foreach ($sectionIterator as $section) {
            $sectionWordLimits[$section->getId()] = (int) $section->getAbstractWordCount() ?? 0;
        }


        // Add the word limit to the existing title/abstract form
        $components = $templateMgr->getState('components');
        if (!empty($components[TitleAbstractForm::FORM_TITLE_ABSTRACT]) &&
                array_key_exists($submission->getLatestPublication()->getData('sectionId'), $sectionWordLimits)) {
            $limit = (int) $sectionWordLimits[$submission->getLatestPublication()->getData('sectionId')];
            foreach ($components[TitleAbstractForm::FORM_TITLE_ABSTRACT]['fields'] as $key => $field) {
                if ($field['name'] === 'abstract') {
                    $components[TitleAbstractForm::FORM_TITLE_ABSTRACT]['fields'][$key]['wordLimit'] = $limit;
                    break;
                }
            }
        }
        $components[$issueEntryForm::FORM_ISSUE_ENTRY] = $this->getLocalizedForm($issueEntryForm, $submissionLocale, $locales);
        $components[$relationForm::FORM_ID_RELATION] = $relationForm->getConfig();

        $publicationFormIds = $templateMgr->getState('publicationFormIds');
        $publicationFormIds[] = $issueEntryForm::FORM_ISSUE_ENTRY;

        $templateMgr->setState([
            'components' => $components,
            'publicationFormIds' => $publicationFormIds,
            'sectionWordLimits' => $sectionWordLimits,
        ]);
    }


    //
    // Protected helper methods
    //
    /**
     * Return the editor assignment notification type based on stage id.
     */
    protected function getEditorAssignmentNotificationTypeByStageId($stageId)
    {
        if ($stageId !== WORKFLOW_STAGE_ID_PRODUCTION) {
            throw new Exception('Only the production stage is supported in OPS.');
        }
        switch ($stageId) {
            case WORKFLOW_STAGE_ID_PRODUCTION:
                return Notification::NOTIFICATION_TYPE_EDITOR_ASSIGNMENT_PRODUCTION;
        }
        return null;
    }

    protected function _getRepresentationsGridUrl($request, $submission)
    {
        return $request->getDispatcher()->url(
            $request,
            Application::ROUTE_COMPONENT,
            null,
            'grid.preprintGalleys.PreprintGalleyGridHandler',
            'fetchGrid',
            null,
            [
                'submissionId' => $submission->getId(),
                'publicationId' => '__publicationId__',
            ]
        );
    }

    protected function getTitleAbstractForm(string $latestPublicationApiUrl, array $locales, Publication $latestPublication, Context $context): TitleAbstractForm
    {
        $section = Repo::section()->get($latestPublication->getData('sectionId'), $context->getId());

        return new TitleAbstractForm(
            $latestPublicationApiUrl,
            $locales,
            $latestPublication,
            (int) $section->getData('wordCount'),
            !$section->getData('abstractsNotRequired')
        );
    }
}
