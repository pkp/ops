<?php

/**
 * @file classes/core/Application.php
 *
 * Copyright (c) 2014-2021 Simon Fraser University
 * Copyright (c) 2003-2021 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class Application
 *
 * @ingroup core
 *
 * @see PKPApplication
 *
 * @brief Class describing this application.
 *
 */

namespace APP\core;

use APP\facades\Repo;
use APP\search\PreprintSearchDAO;
use APP\search\PreprintSearchIndex;
use APP\server\ServerDAO;
use PKP\context\Context;
use PKP\core\PKPApplication;
use PKP\db\DAORegistry;
use PKP\facades\Locale;
use PKP\galley\DAO;
use PKP\submission\RepresentationDAOInterface;

class Application extends PKPApplication
{
    public const ASSOC_TYPE_PREPRINT = self::ASSOC_TYPE_SUBMISSION;
    public const ASSOC_TYPE_GALLEY = self::ASSOC_TYPE_REPRESENTATION;
    public const ASSOC_TYPE_SERVER = 0x0000100;
    public const REQUIRES_XSL = false;

    /**
     * Constructor
     */
    public function __construct()
    {
        parent::__construct();
        if (!PKP_STRICT_MODE) {
            foreach ([
                'REQUIRES_XSL',
                'ASSOC_TYPE_PREPRINT',
                'ASSOC_TYPE_GALLEY',
                'ASSOC_TYPE_SERVER',
            ] as $constantName) {
                if (!defined($constantName)) {
                    define($constantName, constant('self::' . $constantName));
                }
            }
        }

        // Add application locales
        Locale::registerPath(BASE_SYS_DIR . '/locale');
    }

    /**
     * Get the name of the application context.
     */
    public function getContextName(): string
    {
        return 'server';
    }

    /**
     * Get the symbolic name of this application
     */
    public static function getName(): string
    {
        return 'ops';
    }

    /**
     * Get the locale key for the name of this application.
     */
    public function getNameKey(): string
    {
        return('common.software');
    }

    /**
     * Get the URL to the XML descriptor for the current version of this
     * application.
     */
    public function getVersionDescriptorUrl(): string
    {
        return 'https://pkp.sfu.ca/ops/xml/ops-version.xml';
    }

    /**
     * Get the map of DAOName => full.class.Path for this application.
     */
    public function getDAOMap(): array
    {
        return array_merge(parent::getDAOMap(), [
            'PreprintSearchDAO' => 'APP\search\PreprintSearchDAO',
            'ServerDAO' => 'APP\server\ServerDAO',
            'OAIDAO' => 'APP\oai\ops\OAIDAO',
            'TemporaryTotalsDAO' => 'APP\statistics\TemporaryTotalsDAO',
            'TemporaryItemInvestigationsDAO' => 'APP\statistics\TemporaryItemInvestigationsDAO',
            'TemporaryItemRequestsDAO' => 'APP\statistics\TemporaryItemRequestsDAO',
        ]);
    }

    /**
     * Get the list of plugin categories for this application.
     */
    public function getPluginCategories(): array
    {
        return [
            // NB: Meta-data plug-ins are first in the list as this
            // will make them load (and install) first.
            // This is necessary as several other plug-in categories
            // depend on meta-data. This is a very rudimentary type of
            // dependency management for plug-ins.
            'metadata',
            'blocks',
            'gateways',
            'generic',
            'importexport',
            'oaiMetadataFormats',
            'paymethod',
            'pubIds',
            'reports',
            'themes'
        ];
    }

    /**
     * Get the top-level context DAO.
     */
    public static function getContextDAO(): ServerDAO
    {
        return DAORegistry::getDAO('ServerDAO');
    }

    /**
     * Get the representation DAO.
     *
     * @return DAO|RepresentationDAOInterface
     */
    public static function getRepresentationDAO(): RepresentationDAOInterface
    {
        return Repo::galley()->dao;
    }

    /**
     * Get a SubmissionSearchIndex instance.
     */
    public static function getSubmissionSearchIndex(): PreprintSearchIndex
    {
        return new PreprintSearchIndex();
    }

    /**
     * Get a SubmissionSearchDAO instance.
     */
    public static function getSubmissionSearchDAO(): PreprintSearchDAO
    {
        return DAORegistry::getDAO('PreprintSearchDAO');
    }

    /**
     * Get the stages used by the application.
     */
    public static function getApplicationStages(): array
    {
        // Only one stage in OPS
        return [
            WORKFLOW_STAGE_ID_PRODUCTION
        ];
    }

    /**
     * Returns the context type for this application.
     *
     * @return int Application::ASSOC_TYPE_...
     */
    public static function getContextAssocType(): int
    {
        return static::ASSOC_TYPE_SERVER;
    }

    /**
     * Get the file directory array map used by the application.
     */
    public static function getFileDirectories(): array
    {
        return ['context' => '/contexts/', 'submission' => '/submissions/'];
    }

    /**
     * Define if the application has customizable reviewer recommendation functionality
     */
    public function hasCustomizableReviewerRecommendation(): bool
    {
        return true;
    }

    /**
     * Get the help URL of this application
     */
    public static function getHelpUrl(): string
    {
        return 'https://docs.pkp.sfu.ca/learning-ops/en/';
    }
}
