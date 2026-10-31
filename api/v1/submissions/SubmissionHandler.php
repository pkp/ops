<?php

/**
 * @file api/v1/submissions/PKPSubmissionHandler.php
 *
 * Copyright (c) 2014-2021 Simon Fraser University
 * Copyright (c) 2003-2021 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class SubmissionHandler
 *
 * @ingroup api_v1_submission
 *
 * @brief Handle API requests for submission operations.
 *
 */

namespace APP\API\v1\submissions;

use APP\core\Application;
use APP\core\Services;
use APP\facades\Repo;
use APP\submission\Submission;
use PKP\core\APIResponse;
use PKP\db\DAORegistry;
use PKP\security\Role;
use PKP\services\PKPSchemaService;
use PKP\submission\GenreDAO;
use Slim\Http\Request as SlimRequest;

class SubmissionHandler extends \PKP\API\v1\submissions\PKPSubmissionHandler
{
    /**
     * Constructor
     */
    public function __construct()
    {
        $this->requiresSubmissionAccess[] = 'relatePublication';
        $this->requiresProductionStageAccess[] = 'relatePublication';
        $this->productionStageAccessRoles[] = Role::ROLE_ID_AUTHOR;
        parent::__construct();
    }

    /**
     * Modify submission endpoints
     */
    public function setupEndpoints()
    {
        // Add endpoints
        $this->_endpoints['PUT'][] = [
            'pattern' => $this->getEndpointPattern() . '/{submissionId:\d+}/publications/{publicationId:\d+}/relate',
            'handler' => [$this, 'relatePublication'],
            'roles' => [Role::ROLE_ID_MANAGER, Role::ROLE_ID_SITE_ADMIN, Role::ROLE_ID_SUB_EDITOR, Role::ROLE_ID_ASSISTANT, Role::ROLE_ID_AUTHOR],
        ];

        // Allow authors to create and publish versions
        $this->_endpoints['POST'] = array_map(function ($endpoint) {
            if (in_array($endpoint['handler'][1], ['addPublication', 'versionPublication'])) {
                $endpoint['roles'][] = Role::ROLE_ID_AUTHOR;
            }
            return $endpoint;
        }, $this->_endpoints['POST']);
        $this->_endpoints['PUT'] = array_map(function ($endpoint) {
            if (in_array($endpoint['handler'][1], ['publishPublication', 'unpublishPublication'])) {
                $endpoint['roles'][] = Role::ROLE_ID_AUTHOR;
            }
            return $endpoint;
        }, $this->_endpoints['PUT']);

        parent::setupEndpoints();
    }

    /**
     * Add a new publication to this submission
     *
     * Authors may add a publication, but only a moderator or an author allowed
     * to post (Publication::canAuthorPublish) may give it any status other
     * than queued.
     *
     * @param SlimRequest $slimRequest Slim request object
     * @param APIResponse $response object
     * @param array $args arguments
     *
     * @return APIResponse
     */
    public function addPublication($slimRequest, $response, $args)
    {
        $submission = $this->getAuthorizedContextObject(Application::ASSOC_TYPE_SUBMISSION);
        $params = (array) $slimRequest->getParsedBody();

        if (array_key_exists('status', $params)
            && (int) $params['status'] !== Submission::STATUS_QUEUED
            && !Repo::publication()->canCurrentUserPublish($submission->getId())) {
            return $response->withStatus(403)->withJsonError('api.publication.403.cantEditStatus');
        }

        return parent::addPublication($slimRequest, $response, $args);
    }

    /**
     * Unpublish one of this submission's publications
     *
     * Authors who may not post their own preprint may not unpost it either.
     *
     * @param SlimRequest $slimRequest Slim request object
     * @param APIResponse $response object
     * @param array $args arguments
     *
     * @return APIResponse
     */
    public function unpublishPublication($slimRequest, $response, $args)
    {
        $submission = $this->getAuthorizedContextObject(Application::ASSOC_TYPE_SUBMISSION);

        if (!Repo::publication()->canCurrentUserPublish($submission->getId())) {
            return $response->withStatus(403)->withJsonError('api.403.unauthorized');
        }

        return parent::unpublishPublication($slimRequest, $response, $args);
    }

    /**
     * Create relations for publications
     *
     * @param SlimRequest $slimRequest Slim request object
     * @param APIResponse $response object
     * @param array $args arguments
     *
     * @return APIResponse
     */
    public function relatePublication($slimRequest, $response, $args)
    {
        $request = $this->getRequest();
        $submission = $this->getAuthorizedContextObject(Application::ASSOC_TYPE_SUBMISSION);
        $publication = Repo::publication()->get((int) $args['publicationId']);

        if (!$publication) {
            return $response->withStatus(404)->withJsonError('api.404.resourceNotFound');
        }

        if ($submission->getId() !== $publication->getData('submissionId')) {
            return $response->withStatus(403)->withJsonError('api.publications.403.submissionsDidNotMatch');
        }

        // Only accept publication props for relations
        $params = array_intersect_key($slimRequest->getParsedBody(), array_flip(['relationStatus', 'vorDoi']));

        $params = $this->convertStringsToSchema(PKPSchemaService::SCHEMA_PUBLICATION, $params);

        // Required in this handler
        if (!isset($params['relationStatus'])) {
            return $response->withStatus(400)->withJson(['relationStatus' => [__('validator.filled')]]);
        }

        // Validate against the schema
        $submissionContext = $request->getContext();
        if (!$submissionContext || $submissionContext->getId() !== $submission->getData('contextId')) {
            $submissionContext = Services::get('context')->get($submission->getData('contextId'));
        }

        $errors = Repo::publication()->validate($publication, $params, $submission, $submissionContext);

        if (!empty($errors)) {
            return $response->withStatus(400)->withJson($errors);
        }

        Repo::publication()->relate(
            $publication,
            $params['relationStatus'],
            $params['vorDoi'] ?? ''
        );

        $publication = Repo::publication()->get($publication->getId());

        $userGroups = Repo::userGroup()->getCollector()
            ->filterByContextIds([$submission->getData('contextId')])
            ->getMany();

        /** @var GenreDAO $genreDao */
        $genreDao = DAORegistry::getDAO('GenreDAO');
        $genres = $genreDao->getByContextId($request->getContext()->getId())->toArray();

        return $response->withJson(
            Repo::publication()->getSchemaMap($submission, $userGroups, $genres)->map($publication),
            200
        );
    }
}
