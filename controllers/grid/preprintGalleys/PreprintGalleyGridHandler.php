<?php

/**
 * @file controllers/grid/preprintGalleys/PreprintGalleyGridHandler.php
 *
 * Copyright (c) 2016-2021 Simon Fraser University
 * Copyright (c) 2000-2021 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class PreprintGalleyGridHandler
 *
 * @ingroup controllers_grid_preprintGalleys
 *
 * @brief Handle preprint galley grid requests.
 */

namespace APP\controllers\grid\preprintGalleys;

use APP\controllers\grid\preprintGalleys\form\PreprintGalleyForm;
use APP\controllers\tab\pubIds\form\PublicIdentifiersForm;
use APP\core\Application;
use APP\core\Request;
use APP\facades\Repo;
use APP\notification\NotificationManager;
use APP\publication\Publication;
use APP\submission\Submission;
use APP\template\TemplateManager;
use PKP\controllers\grid\feature\OrderGridItemsFeature;
use PKP\controllers\grid\GridColumn;
use PKP\controllers\grid\GridHandler;
use PKP\core\JSONMessage;
use PKP\db\DAO;
use PKP\db\DAORegistry;
use PKP\galley\Galley;
use PKP\linkAction\LinkAction;
use PKP\linkAction\request\AjaxModal;
use PKP\notification\Notification;
use PKP\plugins\PluginRegistry;
use PKP\security\authorization\internal\RepresentationRequiredPolicy;
use PKP\security\authorization\PublicationAccessPolicy;
use PKP\security\authorization\WorkflowStageAccessPolicy;
use PKP\security\Role;
use PKP\submission\GenreDAO;
use PKP\submission\PKPSubmission;

class PreprintGalleyGridHandler extends GridHandler
{
    /** @var Request */
    public $_request;

    /**
     * Constructor
     */
    public function __construct()
    {
        parent::__construct();
        $this->addRoleAssignment(
            [Role::ROLE_ID_MANAGER, Role::ROLE_ID_SUB_EDITOR, Role::ROLE_ID_ASSISTANT, Role::ROLE_ID_AUTHOR],
            ['fetchGrid', 'fetchRow', 'addGalley', 'editGalley', 'editGalleyTab', 'updateGalley', 'deleteGalley', 'identifiers', 'updateIdentifiers', 'clearPubId', 'saveSequence']
        );
    }


    //
    // Getters/Setters
    //
    /**
     * Get the authorized submission.
     *
     */
    public function getSubmission(): Submission
    {
        return $this->getAuthorizedContextObject(Application::ASSOC_TYPE_SUBMISSION);
    }

    /**
     * Get the authorized publication.
     *
     */
    public function getPublication(): Publication
    {
        return $this->getAuthorizedContextObject(Application::ASSOC_TYPE_PUBLICATION);
    }

    /**
     * Get the authorized galley.
     *
     * @return Galley
     */
    public function getGalley()
    {
        return $this->getAuthorizedContextObject(Application::ASSOC_TYPE_REPRESENTATION);
    }


    //
    // Overridden methods from PKPHandler.
    //
    /**
     * @see GridHandler::getJSHandler()
     */
    public function getJSHandler()
    {
        return '$.pkp.controllers.grid.preprintGalleys.PreprintGalleyGridHandler';
    }

    /**
     * @copydoc PKPHandler::authorize()
     */
    public function authorize($request, &$args, $roleAssignments)
    {
        $this->_request = $request;

        $this->addPolicy(new WorkflowStageAccessPolicy($request, $args, $roleAssignments, 'submissionId', WORKFLOW_STAGE_ID_PRODUCTION));

        $this->addPolicy(new PublicationAccessPolicy($request, $args, $roleAssignments));

        if ($request->getUserVar('representationId')) {
            $this->addPolicy(new RepresentationRequiredPolicy($request, $args));
        }

        return parent::authorize($request, $args, $roleAssignments);
    }

    /**
     * @copydoc GridHandler::initialize()
     *
     * @param null|mixed $args
     */
    public function initialize($request, $args = null)
    {
        parent::initialize($request, $args);
        $this->setTitle('submission.files');

        $cellProvider = new PreprintGalleyGridCellProvider($this->getSubmission(), $this->getPublication(), $this->canEdit());

        // Columns
        $this->addColumn(new GridColumn(
            'label',
            'common.name',
            null,
            null,
            $cellProvider
        ));

        $this->addColumn(new GridColumn(
            'language',
            'common.language',
            null,
            null,
            $cellProvider
        ));

        if ($this->canEdit()) {
            $this->addAction(new LinkAction(
                'addGalley',
                new AjaxModal(
                    $request->getRouter()->url($request, null, null, 'addGalley', null, $this->getRequestArgs()),
                    __('common.addFile'),
                ),
                __('common.addFile'),
                'add_item'
            ));
        }
    }

    //
    // Overridden methods from GridHandler
    //
    /**
     * @copydoc GridHandler::initFeatures()
     */
    public function initFeatures($request, $args)
    {
        if ($this->canEdit()) {
            return [new OrderGridItemsFeature()];
        }

        return [];
    }

    /**
     * @copydoc GridHandler::getDataElementSequence()
     */
    public function getDataElementSequence($row)
    {
        return $row->getSequence();
    }

    /**
     * @copydoc GridHandler::setDataElementSequence()
     */
    public function setDataElementSequence($request, $rowId, $gridDataElement, $newSequence)
    {
        $galley = Repo::galley()->get((int) $rowId);
        Repo::galley()->edit($galley, ['seq' => $newSequence]);
    }

    //
    // Overridden methods from GridHandler
    //
    /**
     * @copydoc GridHandler::getRowInstance()
     *
     * @return PreprintGalleyGridRow
     */
    public function getRowInstance()
    {
        return new PreprintGalleyGridRow(
            $this->getSubmission(),
            $this->getPublication(),
            $this->canEdit()
        );
    }

    /**
     * Get the arguments that will identify the data in the grid.
     * Overridden by child grids.
     *
     * @return array
     */
    public function getRequestArgs()
    {
        return [
            'submissionId' => $this->getSubmission()->getId(),
            'publicationId' => $this->getPublication()->getId(),
        ];
    }

    /**
     * @copydoc GridHandler::loadData()
     *
     * @param null|mixed $filter
     */
    public function loadData($request, $filter = null)
    {
        return Repo::galley()
            ->getCollector()
            ->filterByPublicationIds([$this->getPublication()->getId()])
            ->getMany();
    }

    //
    // Public Galley Grid Actions
    //
    /**
     * Edit preprint galley pub ids
     *
     * @param array $args
     * @param Request $request
     *
     * @return JSONMessage JSON object
     */
    public function identifiers($args, $request)
    {
        $form = new PublicIdentifiersForm($this->getGalley(), null, null, $this->canEdit());
        $form->initData();
        return new JSONMessage(true, $form->fetch($request));
    }

    /**
     * Update preprint galley pub ids
     *
     * @param array $args
     * @param Request $request
     *
     * @return JSONMessage JSON object
     */
    public function updateIdentifiers($args, $request)
    {
        $representation = $this->getGalley();
        $form = new PublicIdentifiersForm($representation, null, array_merge($this->getRequestArgs(), ['representationId' => $representation->getId()]), $this->canEdit());
        $form->readInputData();
        if ($form->validate()) {
            $form->execute();
            $json = DAO::getDataChangedEvent();
            $json->setGlobalEvent('galley:edited', $this->getGalleyData($representation->getId()));
            return $json;
        } else {
            return new JSONMessage(true, $form->fetch($request));
        }
    }

    /**
     * Clear galley pub id
     *
     * @param array $args
     * @param Request $request
     *
     * @return JSONMessage JSON object
     */
    public function clearPubId($args, $request)
    {
        if (!$request->checkCSRF()) {
            return new JSONMessage(false);
        }

        $representation = $this->getGalley();
        $form = new PublicIdentifiersForm($representation, null, null, $this->canEdit());
        $form->clearPubId($request->getUserVar('pubIdPlugIn'));
        $json = new JSONMessage(true);
        $json->setGlobalEvent('galley:edited', $this->getGalleyData($representation->getId()));
        return $json;
    }

    /**
     * Add a galley
     *
     * @param array $args
     * @param Request $request
     *
     * @return JSONMessage JSON object
     */
    public function addGalley($args, $request)
    {
        $galleyForm = new PreprintGalleyForm(
            $request,
            $this->getSubmission(),
            $this->getPublication()
        );
        $galleyForm->initData();
        return new JSONMessage(true, $galleyForm->fetch($request));
    }

    /**
     * Delete a galley.
     *
     * @param array $args
     * @param Request $request
     *
     * @return JSONMessage JSON object
     */
    public function deleteGalley($args, $request)
    {
        $galley = $this->getGalley();
        if (!$galley || !$request->checkCSRF()) {
            return new JSONMessage(false);
        }

        Repo::galley()->delete($galley);

        Notification::withAssoc(Application::ASSOC_TYPE_REPRESENTATION, $galley->getId())->delete();

        if ($this->getSubmission()->getData('stageId') == WORKFLOW_STAGE_ID_EDITING ||
            $this->getSubmission()->getData('stageId') == WORKFLOW_STAGE_ID_PRODUCTION) {
            $notificationMgr = new NotificationManager();
            $notificationMgr->updateNotification(
                $request,
                [Notification::NOTIFICATION_TYPE_AWAITING_REPRESENTATIONS],
                null,
                Application::ASSOC_TYPE_SUBMISSION,
                $this->getSubmission()->getId()
            );
        }

        $json = DAO::getDataChangedEvent($galley->getId());
        $json->setGlobalEvent('galley:deleted', ['id' => $galley->getId()]);
        return $json;
    }

    /**
     * Edit a galley metadata modal
     *
     * @param array $args
     * @param Request $request
     *
     * @return JSONMessage JSON object
     */
    public function editGalley($args, $request)
    {
        $galley = $this->getGalley();

        // Check if this is a remote galley
        $templateMgr = TemplateManager::getManager($request);
        $templateMgr->assign([
            'submissionId' => $this->getSubmission()->getId(),
            'publicationId' => $this->getPublication()->getId(),
            'representationId' => $galley->getId(),
        ]);
        $publisherIdEnabled = in_array('galley', (array) $request->getContext()->getData('enablePublisherId'));
        $pubIdsEnabled = false;
        $pubIdPlugins = PluginRegistry::loadCategory('pubIds', true, $request->getContext()->getId());
        foreach ($pubIdPlugins as $pubIdPlugin) {
            if ($pubIdPlugin->isObjectTypeEnabled('Representation', $request->getContext()->getId())) {
                $pubIdsEnabled = true;
                break;
            }
        }
        if ($publisherIdEnabled || $pubIdsEnabled) {
            $templateMgr->assign('enableIdentifiers', true);
        }
        return new JSONMessage(true, $templateMgr->fetch('controllers/grid/preprintGalleys/editFormat.tpl'));
    }

    /**
     * Edit a galley
     *
     * @param array $args
     * @param Request $request
     *
     * @return JSONMessage JSON object
     */
    public function editGalleyTab($args, $request)
    {
        // Form handling
        $galleyForm = new PreprintGalleyForm(
            $request,
            $this->getSubmission(),
            $this->getPublication(),
            $this->getGalley(),
            $this->canEdit()
        );
        $galleyForm->initData();
        return new JSONMessage(true, $galleyForm->fetch($request));
    }

    /**
     * Save a galley
     *
     * @param array $args
     * @param Request $request
     *
     * @return JSONMessage JSON object
     */
    public function updateGalley($args, $request)
    {
        $galley = $this->getGalley();

        $galleyForm = new PreprintGalleyForm($request, $this->getSubmission(), $this->getPublication(), $galley, $this->canEdit());
        $galleyForm->readInputData();

        if ($galleyForm->validate()) {
            $galley = $galleyForm->execute();

            if ($this->getSubmission()->getData('stageId') == WORKFLOW_STAGE_ID_EDITING ||
                $this->getSubmission()->getData('stageId') == WORKFLOW_STAGE_ID_PRODUCTION) {
                $notificationMgr = new NotificationManager();
                $notificationMgr->updateNotification(
                    $request,
                    [Notification::NOTIFICATION_TYPE_AWAITING_REPRESENTATIONS],
                    null,
                    Application::ASSOC_TYPE_SUBMISSION,
                    $this->getSubmission()->getId()
                );
            }

            $json = DAO::getDataChangedEvent($galley->getId());
            if ($this->getGalley()) {
                $json->setGlobalEvent('galley:edited', $this->getGalleyData($galley->getId()));
            } else {
                $json->setGlobalEvent('galley:added', $this->getGalleyData($galley->getId()));
            }
            return $json;
        }
        return new JSONMessage(true, $galleyForm->fetch($request));
    }

    /**
     * @copydoc GridHandler::fetchRow()
     */
    public function fetchRow($args, $request)
    {
        $json = parent::fetchRow($args, $request);
        if ($row = $this->getRequestedRow($request, $args)) {
            $galley = $row->getData();
            if (!$galley->getData('urlRemote') && !$galley->getData('submissionFileId')) {
                $json->setEvent('uploadFile', $galley->getId());
            }
        }

        return $json;
    }

    /**
     * Can the current user edit the galleys in this grid?
     *
     * The user must have an allowed role in one of the assigned stages.
     * If the user is not assigned, they can edit if they are an editor
     * or admin.
     *
     * @return bool
     */
    public function canEdit()
    {
        $request = Application::get()->getRequest();
        $user = $request->getUser();
        $publication = $this->getPublication();
        $submission = $this->getSubmission();
        $userRoles = $this->getAuthorizedContextObject(Application::ASSOC_TYPE_USER_ROLES);


        if (in_array(Role::ROLE_ID_SITE_ADMIN, $userRoles)) {
            return true;
        }

        // if it is published, allow managers or sub-editors
        if ($publication->getData('status') === PKPSubmission::STATUS_PUBLISHED) {
            // allow these roles to edit galleys even if published
            if (
                in_array(Role::ROLE_ID_MANAGER, $userRoles) ||
                in_array(Role::ROLE_ID_SUB_EDITOR, $userRoles)
            ) {
                return true;
            }
            // otherwise block
            return false;
        }

        if ($submission->getData('dateSubmitted') == null) {
            return true;
        }

        if (Repo::submission()->canEditPublication($submission->getId(), $user->getId())) {
            return true;
        }

        // Default: Read-only.
        return false;
    }

    /**
     * Get the galley data to return in a global event
     *
     * This is used to pass updated galley to the UI's state
     */
    protected function getGalleyData(int $id): array
    {
        $galley = Repo::galley()->get($id);

        if (!$galley) {
            return [];
        }

        /** @var GenreDAO $genreDao */
        $genreDao = DAORegistry::getDAO('GenreDAO');
        $genres = $genreDao->getByContextId(Application::get()->getRequest()->getContext()->getId())->toAssociativeArray();

        return Repo::galley()
            ->getSchemaMap($this->getSubmission(), $this->getPublication(), $genres)
            ->map($galley);
    }
}
