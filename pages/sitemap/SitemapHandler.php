<?php

/**
 * @file pages/sitemap/SitemapHandler.php
 *
 * Copyright (c) 2014-2021 Simon Fraser University
 * Copyright (c) 2003-2021 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class SitemapHandler
 *
 * @ingroup pages_sitemap
 *
 * @brief Produce a sitemap in XML format for submitting to search engines.
 */

namespace APP\pages\sitemap;

use APP\core\Application;
use APP\core\Request;
use APP\facades\Repo;
use APP\submission\Submission;
use DOMDocument;
use Illuminate\Support\Collection;
use PKP\pages\sitemap\PKPSitemapHandler;
use PKP\plugins\Hook;

class SitemapHandler extends PKPSitemapHandler
{
    /** Number of submissions whose URLs are read with one set of queries */
    public const SUBMISSIONS_PER_BATCH = 1000;

    /**
     * @copydoc PKPSitemapHandler_createContextSitemap()
     *
     * @hook SitemapHandler::createServerSitemap [[&$doc]]
     */
    public function _createContextSitemap($request)
    {
        $doc = parent::_createContextSitemap($request);
        $root = $doc->documentElement;

        $server = $request->getServer();

        // Search
        $root->appendChild($this->_createUrlTree($doc, $request->url($server->getPath(), 'search')));

        // Preprints. Only the best ids are read here: loading the submissions
        // would also load every publication with its authors, DOIs and metadata.
        $submissionBestIds = Repo::submission()
            ->getCollector()
            ->filterByContextIds([$server->getId()])
            ->filterByStatus([Submission::STATUS_PUBLISHED])
            ->getBestIds();
        foreach ($submissionBestIds->chunk(self::SUBMISSIONS_PER_BATCH) as $batch) {
            $this->_addSubmissionUrls($doc, $request, $batch);
        }

        $doc->appendChild($root);

        // Enable plugins to change the sitemap
        Hook::call('SitemapHandler::createServerSitemap', [&$doc]);

        return $doc;
    }

    /**
     * Add the preprint and galley URLs of published submissions, in the given order
     *
     * @param Collection<int,object{currentPublicationId:?int,bestId:int|string}> $submissionBestIds See Submission\DAO::getBestIds()
     */
    protected function _addSubmissionUrls(DOMDocument $doc, Request $request, Collection $submissionBestIds): void
    {
        $root = $doc->documentElement;
        $serverPath = $request->getServer()->getPath();

        $galleyBestIds = Repo::galley()
            ->getCollector()
            ->filterByPublicationIds($submissionBestIds->pluck('currentPublicationId')->filter()->all())
            ->getBestIds()
            ->groupBy('publicationId');

        foreach ($submissionBestIds as $submissionBestId) {
            // Abstract
            $root->appendChild($this->_createUrlTree($doc, $request->url($serverPath, 'preprint', 'view', [$submissionBestId->bestId])));
            // Galley files
            foreach ($galleyBestIds->get($submissionBestId->currentPublicationId, []) as $galleyBestId) {
                // Same PDF URL as citation_pdf_url, which Google Scholar indexes
                $url = $galleyBestId->mimetype === 'application/pdf'
                    ? $request->getDispatcher()->url($request, Application::ROUTE_PAGE, $serverPath, 'preprint', 'download', [$submissionBestId->bestId, $galleyBestId->bestId], urlLocaleForPage: '')
                    : $request->url($serverPath, 'preprint', 'view', [$submissionBestId->bestId, $galleyBestId->bestId]);
                $root->appendChild($this->_createUrlTree($doc, $url));
            }
        }
    }
}
