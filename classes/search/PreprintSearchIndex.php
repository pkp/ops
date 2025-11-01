<?php

/**
 * @file classes/search/PreprintSearchIndex.php
 *
 * Copyright (c) 2014-2021 Simon Fraser University
 * Copyright (c) 2003-2021 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class PreprintSearchIndex
 *
 * @ingroup search
 *
 * @brief Class to maintain the preprint search index.
 */

namespace APP\search;

use APP\core\Application;
use APP\facades\Repo;
use APP\orcid\actions\SendSubmissionToOrcid;
use APP\server\Server;
use APP\server\ServerDAO;
use APP\submission\Submission;
use Exception;
use PKP\config\Config;
use PKP\db\DAORegistry;
use PKP\jobs\submissions\UpdateSubmissionSearchJob;
use PKP\plugins\Hook;
use PKP\search\SearchFileParser;
use PKP\search\SubmissionSearch;
use PKP\search\SubmissionSearchIndex;
use PKP\submissionFile\SubmissionFile;
use Throwable;

class PreprintSearchIndex extends SubmissionSearchIndex
{
    private const MINIMUM_DATA_LENGTH = 80 * 1024;

    /**
     * @copydoc SubmissionSearchIndex::submissionMetadataChanged()
     *
     * @hook PreprintSearchIndex::preprintMetadataChanged [[$submission]]
     */
    public function submissionMetadataChanged($submission)
    {
        // Check whether a search plug-in jumps in.
        if (Hook::ABORT === Hook::call('PreprintSearchIndex::preprintMetadataChanged', [$submission])) {
            return;
        }

        $publication = $submission->getCurrentPublication();

        // Build author keywords
        $authorText = [];
        foreach ($publication->getData('authors') as $author) {
            $authorText = array_merge(
                $authorText,
                array_values((array) $author->getData('givenName')),
                array_values((array) $author->getData('familyName')),
                array_values((array) $author->getData('preferredPublicName')),
                array_values(array_map(strip_tags(...), (array) $author->getData('affiliation'))),
                array_values(array_map(strip_tags(...), (array) $author->getData('biography')))
            );
        }

        // Update search index
        $submissionId = $submission->getId();
        $this->_updateTextIndex($submissionId, SubmissionSearch::SUBMISSION_SEARCH_AUTHOR, $authorText);
        $this->_updateTextIndex($submissionId, SubmissionSearch::SUBMISSION_SEARCH_TITLE, $publication->getFullTitles());
        $this->_updateTextIndex($submissionId, SubmissionSearch::SUBMISSION_SEARCH_ABSTRACT, $publication->getData('abstract'));

        $this->_updateTextIndex($submissionId, SubmissionSearch::SUBMISSION_SEARCH_SUBJECT, (array) $this->_flattenLocalizedArray($publication->getData('subjects')));
        $this->_updateTextIndex($submissionId, SubmissionSearch::SUBMISSION_SEARCH_KEYWORD, (array) $this->_flattenLocalizedArray($publication->getData('keywords')));
        $this->_updateTextIndex($submissionId, SubmissionSearch::SUBMISSION_SEARCH_DISCIPLINE, (array) $this->_flattenLocalizedArray($publication->getData('disciplines')));
        $this->_updateTextIndex($submissionId, SubmissionSearch::SUBMISSION_SEARCH_TYPE, (array) $publication->getData('type'));
        $this->_updateTextIndex($submissionId, SubmissionSearch::SUBMISSION_SEARCH_COVERAGE, (array) $publication->getData('coverage'));
        // FIXME Index sponsors too?

        $context = app()->get('context')->get($submission->getData('contextId'));
        if ($publication && $context) {
            (new SendSubmissionToOrcid($publication, $context))->execute();
        }
    }

    /**
     * Delete keywords from the search index.
     *
     * @param int $preprintId
     * @param int $type optional
     * @param int $assocId optional
     */
    public function deleteTextIndex($preprintId, $type = null, $assocId = null)
    {
        /** @var PreprintSearchDAO */
        $searchDao = DAORegistry::getDAO('PreprintSearchDAO');
        return $searchDao->deleteSubmissionKeywords($preprintId, $type, $assocId);
    }

    /**
     * Signal to the indexing back-end that an preprint file changed.
     *
     * @see PreprintSearchIndex::submissionMetadataChanged() above for more
     * comments.
     *
     * @param int $preprintId
     * @param int $type
     * @param SubmissionFile $submissionFile
     *
     * @hook PreprintSearchIndex::submissionFileChanged [[$preprintId, $type, $submissionFile->getId()]]
     */
    public function submissionFileChanged($preprintId, $type, $submissionFile)
    {
        // Check whether a search plug-in jumps in.
        if (Hook::ABORT === Hook::call('PreprintSearchIndex::submissionFileChanged', [$preprintId, $type, $submissionFile->getId()])) {
            return;
        }

        // If no search plug-in is activated then fall back to the default database search implementation.
        $parser = SearchFileParser::fromFile($submissionFile);
        if (!$parser) {
            error_log("Skipped indexation: No suitable parser for the submission file \"{$submissionFile->getData('path')}\"");
            return;
        }
        try {
            $parser->open();
            try {
                $searchDao = DAORegistry::getDAO('PreprintSearchDAO'); /** @var PreprintSearchDAO $searchDao */
                $objectId = $searchDao->insertObject($preprintId, $type, $submissionFile->getId());
                do {
                    for ($buffer = ''; ($chunk = $parser->read()) !== false && strlen($buffer .= $chunk) < static::MINIMUM_DATA_LENGTH;);
                    if (strlen($buffer)) {
                        $this->_indexObjectKeywords($objectId, $buffer);
                    }
                } while ($chunk !== false);
            } finally {
                $parser->close();
            }
        } catch (Throwable $e) {
            throw new Exception("Indexation failed for the file: \"{$submissionFile->getData('path')}\"", 0, $e);
        }
    }

    /**
     * Remove indexed file contents for a submission
     *
     * @param Submission $submission
     */
    public function clearSubmissionFiles($submission)
    {
        /** @var PreprintSearchDAO */
        $searchDao = DAORegistry::getDAO('PreprintSearchDAO');
        $searchDao->deleteSubmissionKeywords($submission->getId(), SubmissionSearch::SUBMISSION_SEARCH_GALLEY_FILE);
    }

    /**
     * Signal to the indexing back-end that all files (supplementary
     * and galley) assigned to an preprint changed and must be re-indexed.
     *
     * @see PreprintSearchIndex::submissionMetadataChanged() above for more
     * comments.
     *
     * @param Submission $preprint
     *
     * @hook PreprintSearchIndex::submissionFilesChanged [[$preprint]]
     */
    public function submissionFilesChanged($preprint)
    {
        // If a search plug-in is activated then skip the default database search implementation.
        if (Hook::ABORT === Hook::call('PreprintSearchIndex::submissionFilesChanged', [$preprint])) {
            return;
        }

        $submissionFiles = Repo::submissionFile()
            ->getCollector()
            ->filterBySubmissionIds([$preprint->getId()])
            ->filterByFileStages([SubmissionFile::SUBMISSION_FILE_PROOF])
            ->getMany();

        $exceptions = [];
        foreach ($submissionFiles as $submissionFile) {
            try {
                $this->submissionFileChanged($preprint->getId(), SubmissionSearch::SUBMISSION_SEARCH_GALLEY_FILE, $submissionFile);
            } catch (Throwable $e) {
                $exceptions[] = $e;
            }
            $dependentFiles = Repo::submissionFile()
                ->getCollector()
                ->filterByAssoc(
                    Application::ASSOC_TYPE_SUBMISSION_FILE,
                    [$submissionFile->getId()]
                )->filterBySubmissionIds([$preprint->getId()])
                ->filterByFileStages([SubmissionFile::SUBMISSION_FILE_DEPENDENT])
                ->includeDependentFiles()
                ->getMany();

            foreach ($dependentFiles as $dependentFile) {
                try {
                    $this->submissionFileChanged($preprint->getId(), SubmissionSearch::SUBMISSION_SEARCH_SUPPLEMENTARY_FILE, $dependentFile);
                } catch (Throwable $e) {
                    $exceptions[] = $e;
                }
            }
        }
        if (count($exceptions)) {
            $errorMessage = implode("\n\n", $exceptions);
            throw new Exception("The following errors happened while indexing the submission ID {$preprint->getId()}:\n{$errorMessage}");
        }
    }

    /**
     * Signal to the indexing back-end that a file was deleted.
     *
     * @see PreprintSearchIndex::submissionMetadataChanged() above for more
     * comments.
     *
     * @param int $preprintId
     * @param int $type optional
     * @param int $assocId optional
     *
     * @hook PreprintSearchIndex::submissionFileDeleted [[$preprintId, $type, $assocId]]
     */
    public function submissionFileDeleted($preprintId, $type = null, $assocId = null)
    {
        // If a search plug-in is activated then skip the default database search implementation.
        if (Hook::ABORT === Hook::call('PreprintSearchIndex::submissionFileDeleted', [$preprintId, $type, $assocId])) {
            return;
        }

        $searchDao = DAORegistry::getDAO('PreprintSearchDAO'); /** @var PreprintSearchDAO $searchDao */
        return $searchDao->deleteSubmissionKeywords($preprintId, $type, $assocId);
    }

    /**
     * Signal to the indexing back-end that the metadata of
     * a supplementary file changed.
     *
     * @see PreprintSearchIndex::submissionMetadataChanged() above for more
     * comments.
     *
     * @param int $preprintId
     *
     * @hook PreprintSearchIndex::preprintDeleted [[$preprintId]]
     */
    public function preprintDeleted($preprintId)
    {
        // Trigger a hook to let the indexing back-end know that
        // an preprint was deleted.
        Hook::call(
            'PreprintSearchIndex::preprintDeleted',
            [$preprintId]
        );

        // The default indexing back-end does nothing when an
        // preprint is deleted (FIXME?).
    }

    /**
     * @copydoc SubmissionSearchIndex::submissionChangesFinished()
     *
     * @hook PreprintSearchIndex::preprintChangesFinished []
     */
    public function submissionChangesFinished()
    {
        // Trigger a hook to let the indexing back-end know that
        // the index may be updated.
        Hook::call(
            'PreprintSearchIndex::preprintChangesFinished'
        );

        // The default indexing back-end works completely synchronously
        // and will therefore not do anything here.
    }

    /**
     * @copydoc SubmissionSearchIndex::submissionChangesFinished()
     */
    public function preprintChangesFinished()
    {
        if (Config::getVar('debug', 'deprecation_warnings')) {
            trigger_error('Deprecated call to preprintChangesFinished. Use submissionChangesFinished instead.');
        }
        $this->submissionChangesFinished();
    }

    /**
     * Rebuild the search index for one or all servers.
     *
     * @param bool $log Whether to display status information
     *  to stdout.
     * @param Server $server If given the user wishes to
     *  re-index only one server. Not all search implementations
     *  may be able to do so. Most notably: The default SQL
     *  implementation does not support server-specific re-indexing
     *  as index data is not partitioned by server.
     * @param array $switches Optional index administration switches.
     *
     * @hook PreprintSearchIndex::rebuildIndex [[$log, $server, $switches]]
     */
    public function rebuildIndex($log = false, $server = null, $switches = [])
    {
        if (Hook::ABORT === Hook::call('PreprintSearchIndex::rebuildIndex', [$log, $server, $switches])) {
            return;
        }

        // Check that no server was given as we do
        // not support server-specific re-indexing.
        if (is_a($server, 'Server')) {
            exit(__('search.cli.rebuildIndex.indexingByServerNotSupported') . "\n");
        }

        // Clear index
        if ($log) {
            echo __('search.cli.rebuildIndex.clearingIndex') . ' ... ';
        }
        /** @var PreprintSearchDAO */
        $searchDao = DAORegistry::getDAO('PreprintSearchDAO');
        $searchDao->clearIndex();
        if ($log) {
            echo __('search.cli.rebuildIndex.done') . "\n";
        }

        // Build index
        $serverDao = DAORegistry::getDAO('ServerDAO'); /** @var ServerDAO $serverDao */

        $servers = $serverDao->getAll()->toIterator();
        foreach ($servers as $server) {
            $numIndexed = 0;

            if ($log) {
                echo __('search.cli.rebuildIndex.indexing', ['serverName' => $server->getLocalizedName()]) . ' ... ';
            }

            $submissions = Repo::submission()
                ->getCollector()
                ->filterByContextIds([$server->getId()])
                ->getMany();

            foreach ($submissions as $submission) {
                dispatch(new UpdateSubmissionSearchJob($submission->getId()));
                ++$numIndexed;
            }

            if ($log) {
                echo __('search.cli.rebuildIndex.result', ['numIndexed' => $numIndexed]) . "\n";
            }
        }
    }


    //
    // Private helper methods
    //
    /**
     * Index a block of text for an object.
     *
     * @param int $objectId
     * @param string|array $text
     */
    protected function _indexObjectKeywords($objectId, $text)
    {
        /** @var PreprintSearchDAO */
        $searchDao = DAORegistry::getDAO('PreprintSearchDAO');
        $keywords = $this->filterKeywords($text);
        $searchDao->insertObjectKeywords($objectId, $keywords);
    }

    /**
     * Add a block of text to the search index.
     *
     * @param int $preprintId
     * @param int $type
     * @param string|string[] $text
     * @param int $assocId optional
     */
    protected function _updateTextIndex($preprintId, $type, $text, $assocId = null)
    {
        /** @var PreprintSearchDAO */
        $searchDao = DAORegistry::getDAO('PreprintSearchDAO');
        $objectId = $searchDao->insertObject($preprintId, $type, $assocId);
        $this->_indexObjectKeywords($objectId, $text);
    }

    /**
     * Flattens array of localized fields to a single, non-associative array of items
     *
     * @param array $arrayWithLocales Array of localized fields
     *
     * @return array
     */
    protected function _flattenLocalizedArray($arrayWithLocales)
    {
        $flattenedArray = [];

        foreach ($arrayWithLocales as $localeArray) {
            $names = array_map(
                static fn ($item) => $item['name'],
                $localeArray
            );

            $flattenedArray = array_merge($flattenedArray, $names);
        }

        return $flattenedArray;
    }
}
