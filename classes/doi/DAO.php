<?php

/**
 * @file classes/doi/DAO.php
 *
 * Copyright (c) 2014-2021 Simon Fraser University
 * Copyright (c) 2000-2021 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class DAO
 *
 * @ingroup doi
 *
 * @see Doi
 *
 * @brief Operations for retrieving and modifying Doi objects.
 */

namespace APP\doi;

use APP\facades\Repo;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use PKP\context\Context;
use PKP\doi\Doi;
use PKP\submission\PKPSubmission;

class DAO extends \PKP\doi\DAO
{
    /**
     * Gets all depositable submission IDs along with all associated DOI IDs for use in DOI bulk deposit jobs.
     * This method is used to collect all valid submissions/IDs in a single query specifically for use with
     * queued jobs for depositing DOIs with a registration agency.
     *
     */
    public function getAllDepositableSubmissionIds(Context $context): Collection
    {
        $enabledDoiTypes = $context->getData(Context::SETTING_ENABLED_DOI_TYPES) ?? [];
        $doiVersioning = (bool) $context->getData(Context::SETTING_DOI_VERSIONING);

        $q = DB::table($this->table, 'd')
            // Minor versions share their major version's DOIs, so a DOI can match several publications/galleys
            ->leftJoin('publications as p', 'd.doi_id', '=', 'p.doi_id')
            ->leftJoin('publication_galleys as gd', 'd.doi_id', '=', 'gd.doi_id')
            ->leftJoin('publications as gp', 'gd.publication_id', '=', 'gp.publication_id')
            ->where('d.context_id', '=', $context->getId())
            ->where(function (Builder $q) use ($enabledDoiTypes, $doiVersioning) {
                // Publication DOIs
                $q->when(in_array(Repo::doi()::TYPE_PUBLICATION, $enabledDoiTypes), function (Builder $q) use ($doiVersioning) {
                    $q->whereIn('d.doi_id', function (Builder $q) use ($doiVersioning) {
                        $q->select('p.doi_id')
                            ->from('publications', 'p')
                            ->whereNotNull('p.doi_id')
                            ->where('p.status', '=', PKPSubmission::STATUS_PUBLISHED);
                        $this->whereDepositablePublication($q, $doiVersioning);
                    });
                })
                    // Galley DOIs
                    ->when(in_array(Repo::doi()::TYPE_REPRESENTATION, $enabledDoiTypes), function (Builder $q) use ($doiVersioning) {
                        $q->orWhereIn('d.doi_id', function (Builder $q) use ($doiVersioning) {
                            $q->select('g.doi_id')
                                ->from('publication_galleys', 'g')
                                ->join('publications as p', 'g.publication_id', '=', 'p.publication_id')
                                ->whereNotNull('g.doi_id')
                                ->where('p.status', '=', PKPSubmission::STATUS_PUBLISHED);
                            $this->whereDepositablePublication($q, $doiVersioning, false);
                        });
                    });
            });
        $q->whereIn('d.status', [Doi::STATUS_UNREGISTERED, Doi::STATUS_ERROR, Doi::STATUS_STALE]);
        return $q->distinct()->get([DB::raw('COALESCE(p.submission_id, gp.submission_id) AS submission_id'), 'd.doi_id']);
    }
}
