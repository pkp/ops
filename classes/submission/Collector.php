<?php

/**
 * @file classes/submission/Collector.php
 *
 * Copyright (c) 2014-2021 Simon Fraser University
 * Copyright (c) 2000-2021 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class Collector
 *
 * @brief A helper class to configure a Query Builder to get a collection of submissions
 */

namespace APP\submission;

use APP\core\Application;
use APP\facades\Repo;
use APP\publication\Publication;
use Illuminate\Database\Query\Builder;

class Collector extends \PKP\submission\Collector
{
    /**  */
    public ?array $sectionIds = null;

    public function __construct(DAO $dao)
    {
        $this->dao = $dao;
    }

    /**
     * Limit results to submissions assigned to these sections
     */
    public function filterBySectionIds(array $sectionIds): self
    {
        $this->sectionIds = $sectionIds;
        return $this;
    }

    /**
     * @copydoc CollectorInterface::getQueryBuilder()
     */
    public function getQueryBuilder(): Builder
    {
        $q = parent::getQueryBuilder();

        if (is_array($this->sectionIds)) {
            $sectionIds = $this->sectionIds;
            $q->leftJoin('publications as section_p', 'section_p.submission_id', '=', 's.submission_id')
                ->whereIn('section_p.section_id', $sectionIds);
        }

        return $q;
    }

    /**
     * Add APP-specific filtering methods for submission sub objects DOI statuses
     *
     */
    protected function addDoiStatusFilterToQuery(Builder $q)
    {
        $q->whereIn('s.current_publication_id', function (Builder $q) {
            $q->select('current_p.publication_id')
                ->from('publications as current_p')
                ->leftJoin('publication_galleys as current_g', 'current_g.publication_id', '=', 'current_p.publication_id')
                ->leftJoin('dois as pd', 'pd.doi_id', '=', 'current_p.doi_id')
                ->leftJoin('dois as gd', 'gd.doi_id', '=', 'current_g.doi_id')
                ->whereIn('pd.status', $this->doiStatuses)
                ->orWhereIn('gd.status', $this->doiStatuses);
        });
    }

    /**
     * Add APP-specific filtering methods for checking if submission sub objects have DOIs assigned
     */
    protected function addHasDoisFilterToQuery(Builder $q)
    {
        $q->whereIn('s.current_publication_id', function (Builder $q) {
            $q->select('current_p.publication_id')
                ->from('publications', 'current_p')
                ->leftJoin('submissions as current_s', 'current_s.current_publication_id', '=', 'current_p.publication_id')
                ->leftJoin('publication_galleys as current_g', 'current_g.publication_id', '=', 'current_p.publication_id')
                ->where(function (Builder $q) {
                    $q->when($this->hasDois === true, function (Builder $q) {
                        $q->when(in_array(Repo::doi()::TYPE_PUBLICATION, $this->enabledDoiTypes), function (Builder $q) {
                            $q->whereNotNull('current_p.doi_id');
                        });
                        $q->when(in_array(Repo::doi()::TYPE_REPRESENTATION, $this->enabledDoiTypes), function (Builder $q) {
                            $q->orWhereNotNull('current_g.doi_id');
                        });
                    });
                    $q->when($this->hasDois === false, function (Builder $q) {
                        $q->when(in_array(Repo::doi()::TYPE_PUBLICATION, $this->enabledDoiTypes), function (Builder $q) {
                            $q->whereNull('current_p.doi_id');
                        });
                        $q->when(in_array(Repo::doi()::TYPE_REPRESENTATION, $this->enabledDoiTypes), function (Builder $q) {
                            $q->orWhere(function (Builder $q) {
                                $q->whereNull('current_g.doi_id');
                                $q->whereNotNull('current_g.galley_id');
                            });
                        });
                    });
                });
        });
    }

    /**
     * APP-specific filtering for submissions that should be listed on the DOI management page.
     * Those are:
     * submissions in the workflow production stage,
     * submissions that have a published publication, and
     * submissions whose sub objects have a DOI.
     */
    protected function addOnDoiPageFilterToQuery(Builder $q)
    {
        $q->where(function (Builder $q) {
            $q->whereIn('s.stage_id', [WORKFLOW_STAGE_ID_PRODUCTION])
                ->orWhereIn('s.submission_id', function (Builder $q) {
                    $q->select('pOnDoiPage.submission_id')
                        ->from('publications as pOnDoiPage')
                        ->where('pOnDoiPage.status', '=', Publication::STATUS_PUBLISHED);
                    $q->when(in_array(Repo::doi()::TYPE_PUBLICATION, $this->enabledDoiTypes), function (Builder $q) {
                        $q->orWhereNotNull('pOnDoiPage.doi_id');
                    });
                    $q->when(in_array(Repo::doi()::TYPE_REPRESENTATION, $this->enabledDoiTypes), function (Builder $q) {
                        $q->leftJoin('publication_galleys as pgOnDoiPage', 'pgOnDoiPage.publication_id', '=', 'pOnDoiPage.publication_id')
                            ->orWhereNotNull('pgOnDoiPage.doi_id');
                    });
                });
        });
    }

    /** @copydoc PKP/classes/submission/Collector::getAllowedDoiTypes() */
    protected function getAllowedDoiTypes(): array
    {
        return [
            Repo::doi()::TYPE_PUBLICATION,
            Repo::doi()::TYPE_REPRESENTATION,
        ];
    }

    /** @copydoc PKP/classes/submission/Collector::addFilterByAssociatedDoiIdsToQuery() */
    protected function addFilterByAssociatedDoiIdsToQuery(Builder $q)
    {
        // Does two things:
        // 1 - Defaults to empty result when no DOIs are enabled.
        // 2 - Ensures that the union clause can be safely used if a query with a union clause is the only one that is executed.
        $q->selectRaw('NULL AS submission_id')->whereRaw('1 = 0');

        $q->whereIn('s.submission_id', function (Builder $query) {
            $context = Application::get()->getRequest()->getContext();

            $query->when($context->isDoiTypeEnabled(Repo::doi()::TYPE_REPRESENTATION), function (Builder $q) {
                $q->select('p.submission_id')
                    ->from('publication_galleys AS g')
                    ->join('dois AS d', 'g.doi_id', '=', 'd.doi_id')
                    ->join('publications AS p', 'g.publication_id', '=', 'p.publication_id')
                    ->whereLike('d.doi', "{$this->searchPhrase}%");
            })
                ->when($context->isDoiTypeEnabled(Repo::doi()::TYPE_PUBLICATION), function (Builder $q) {
                    $q->union(function (Builder $query) {
                        $query->select('p.submission_id')
                            ->from('publications AS p')
                            ->join('dois AS d', 'p.doi_id', '=', 'd.doi_id')
                            ->whereLike('d.doi', "{$this->searchPhrase}%");
                    });
                });
        });
    }
}
