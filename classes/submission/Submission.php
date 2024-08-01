<?php

/**
 * @defgroup submission Submission
 * Preprints, OMP's extension of the generic Submission class in lib-pkp, are
 * implemented here.
 */

/**
 * @file classes/submission/Submission.php
 *
 * Copyright (c) 2014-2021 Simon Fraser University
 * Copyright (c) 2003-2021 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class Submission
 *
 * @ingroup submission
 *
 * @see DAO
 *
 * @brief Preprint class.
 */

namespace APP\submission;

use APP\facades\Repo;
use APP\publication\Publication;
use APP\statistics\StatisticsHelper;
use PKP\facades\Locale;
use PKP\submission\PKPSubmission;

class Submission extends PKPSubmission
{
    // Author display in ToC
    public const AUTHOR_TOC_DEFAULT = 0;
    public const AUTHOR_TOC_HIDE = 1;
    public const AUTHOR_TOC_SHOW = 2;

    // Article access constants -- see Publication::getData('accessStatus')
    public const PREPRINT_ACCESS_OPEN = 1;

    //
    // Get/set methods
    //

    /**
     * Get the value of a license field from the containing context.
     *
     * @param string $locale Locale code
     * @param int $field PERMISSIONS_FIELD_...
     * @param Publication $publication
     *
     * @return string|array|null
     */
    public function _getContextLicenseFieldValue($locale, $field, $publication = null)
    {
        $context = app()->get('context')->get($this->getData('contextId'));
        $fieldValue = null; // Scrutinizer
        switch ($field) {
            case Submission::PERMISSIONS_FIELD_LICENSE_URL:
                $fieldValue = $context->getData('licenseUrl');
                break;
            case Submission::PERMISSIONS_FIELD_COPYRIGHT_HOLDER:
                switch ($context->getData('copyrightHolderType')) {
                    case 'author':
                        if (!$publication) {
                            $publication = $this->getCurrentPublication();
                        }
                        $authorUserGroups = Repo::userGroup()->getCollector()->filterByRoleIds([\PKP\security\Role::ROLE_ID_AUTHOR])->filterByContextIds([$context->getId()])->getMany();
                        $fieldValue = [$context->getPrimaryLocale() => $publication->getAuthorString($authorUserGroups)];
                        break;
                    case 'context':
                    case null:
                        $fieldValue = $context->getName(null);
                        break;
                    default:
                        $fieldValue = $context->getData('copyrightHolderOther');
                        break;
                }
                break;
            case Submission::PERMISSIONS_FIELD_COPYRIGHT_YEAR:
                // Default copyright year to current year
                $fieldValue = date('Y');

                // Use preprint publish date of current publication
                if (!$publication) {
                    $publication = $this->getCurrentPublication();
                }
                if ($publication) {
                    $fieldValue = date('Y', strtotime($publication->getData('datePublished')));
                }
                break;
            default: assert(false);
        }

        // Return the fetched license field
        if ($locale === null) {
            return $fieldValue;
        }
        if (isset($fieldValue[$locale])) {
            return $fieldValue[$locale];
        }
        return null;
    }

    /**
     * Get ID of preprint's section.
     *
     * @return int
     */
    public function getSectionId()
    {
        $publication = $this->getCurrentPublication();
        if (!$publication) {
            return 0;
        }
        return $publication->getData('sectionId');
    }

    /**
     * Get total galley views for the preprint
     *
     * Used in templates/frontend/objects/preprint_summary.tpl
     *
     * @return int
     */
    public function getTotalGalleyViews()
    {
        $fileIds = [];
        $publications = $this->getPublishedPublications();
        foreach ($publications as $publication) {
            foreach ($publication->getData('galleys') as $galley) {
                $file = $galley->getFile();
                if (!$galley->getData('urlRemote') && $file && !in_array($file->getId(), $fileIds)) {
                    $fileIds[] = $file->getId();
                }
            }
        }
        $filters = [
            'dateStart' => StatisticsHelper::STATISTICS_EARLIEST_DATE,
            'dateEnd' => date('Y-m-d', strtotime('yesterday')),
            'contextIds' => [$this->getData('contextId')],
            'fileIds' => $fileIds,
        ];
        $metrics = app()->get('publicationStats')
            ->getQueryBuilder($filters)
            ->getSum([])
            ->value('metric');
        return $metrics ? $metrics : 0;
    }
}

if (!PKP_STRICT_MODE) {
    class_alias('\APP\submission\Submission', '\Submission');
    foreach ([
        'AUTHOR_TOC_DEFAULT',
        'AUTHOR_TOC_HIDE',
        'AUTHOR_TOC_SHOW',
        'PREPRINT_ACCESS_OPEN',
    ] as $constantName) {
        define($constantName, constant('\Submission::' . $constantName));
    }
}
