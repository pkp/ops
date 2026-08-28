<?php

/**
 * @file classes/publication/DAO.php
 *
 * Copyright (c) 2014-2021 Simon Fraser University
 * Copyright (c) 2000-2021 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class DAO
 *
 * @brief Read and write publications to the database.
 */

namespace APP\publication;

use APP\facades\Repo;
use Illuminate\Support\LazyCollection;
use PKP\core\interfaces\CollectorInterface;

class DAO extends \PKP\publication\DAO
{
    /** @copydoc EntityDAO::$primaryTableColumns */
    public $primaryTableColumns = [
        'id' => 'publication_id',
        'accessStatus' => 'access_status',
        'datePublished' => 'date_published',
        'lastModified' => 'last_modified',
        'primaryContactId' => 'primary_contact_id',
        'sectionId' => 'section_id',
        'submissionId' => 'submission_id',
        'status' => 'status',
        'urlPath' => 'url_path',
        'doiId' => 'doi_id',
        'versionStage' => 'version_stage',
        'versionMinor' => 'version_minor',
        'versionMajor' => 'version_major',
        'updateType' => 'update_type',
        'createdAt' => 'created_at',
        'sourcePublicationId' => 'source_publication_id'
    ];

    /**
     * @copydoc SchemaDAO::_fromRow()
     */
    public function fromRow(object $row, array $ids, object $cache, ?CollectorInterface $query = null): Publication
    {
        $publication = parent::fromRow($row, $ids, $cache, $query);

        $publication->setData('galleys', LazyCollection::make(function () use ($row, $ids, $cache) {
            $cache->galleys ??= Repo::galley()->getCollector()->filterByPublicationIds($ids)->getMany()
                ->collect()
                ->groupBy(fn ($galley) => $galley->getData('publicationId'), true);
            yield from $cache->galleys->get($row->publication_id) ?? [];
        }));

        return $publication;
    }
}
