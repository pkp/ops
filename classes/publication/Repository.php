<?php

/**
 * @file classes/publication/Repository.php
 *
 * Copyright (c) 2014-2021 Simon Fraser University
 * Copyright (c) 2000-2021 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class Repository
 *
 * @brief Get publications and information about publications
 */

namespace APP\publication;

use APP\core\Application;
use APP\facades\Repo;
use APP\publication\enums\VersionStage;
use APP\server\Server;
use APP\server\ServerDAO;
use APP\submission\Submission;
use Illuminate\Support\Facades\App;
use PKP\context\Context;
use PKP\core\Core;
use PKP\doi\exceptions\DoiException;
use PKP\plugins\Hook;
use PKP\publication\Collector;
use PKP\security\Role;
use PKP\stageAssignment\StageAssignment;
use PKP\user\User;

class Repository extends \PKP\publication\Repository
{
    /** @copydoc \PKP\submission\Repository::$schemaMap */
    public $schemaMap = maps\Schema::class;

    public function getCollector(): Collector
    {
        return App::makeWith(Collector::class, ['dao' => $this->dao]);
    }

    /** @copydoc PKP\publication\Repository::validate() */
    public function validate($publication, array $props, Submission $submission, Context $context): array
    {
        $errors = parent::validate($publication, $props, $submission, $context);
        $submissionLocale = $submission->getData('locale');

        // Ensure that the specified section exists
        $section = null;
        if (isset($props['sectionId'])) {
            $section = Repo::section()->get($props['sectionId']);
            if (!$section) {
                $errors['sectionId'] = [__('publication.invalidSection')];
            }
        }

        // Get the section so we can validate section abstract requirements
        if (!$section && !is_null($publication)) {
            $section = Repo::section()->get($publication->getData('sectionId'));
        }

        // Only validate section settings for completed submissions
        if ($section && !$submission->getData('submissionProgress')) {
            // Require abstracts if the section requires them
            if (is_null($publication) && !$section->getData('abstractsNotRequired') && empty($props['abstract'])) {
                $errors['abstract'][$submissionLocale] = [__('author.submit.form.abstractRequired')];
            }

            if (isset($props['abstract']) && empty($errors['abstract'])) {
                // Require abstracts in the primary language if the section requires them
                if (!$section->getData('abstractsNotRequired')) {
                    if (empty($props['abstract'][$submissionLocale])) {
                        if (!isset($errors['abstract'])) {
                            $errors['abstract'] = [];
                        };
                        $errors['abstract'][$submissionLocale] = [__('author.submit.form.abstractRequired')];
                    }
                }

                // Check the word count on abstracts
                $wordCountLimit = $section->getData('wordCount');
                if ($wordCountLimit) {
                    $abstractErrors = $this->validateWordCount(
                        $context,
                        $submission,
                        $wordCountLimit,
                        'publication.abstract.wordCountLong',
                        $props['abstract']
                    );
                    if (count($abstractErrors)) {
                        $errors['abstract'] = $abstractErrors;
                    }
                }
            }
        }

        if (isset($props['plainLanguageSummary'])) {
            // Check the word count on plain language summary
            $wordCountLimit = $section->getData('wordCount');
            if ($wordCountLimit) {
                $plainLanguageSummaryErrors = $this->validateWordCount(
                    $context,
                    $submission,
                    $wordCountLimit,
                    'publication.plainLanguageSummary.wordCountLong',
                    $props['plainLanguageSummary']
                );
                if (count($plainLanguageSummaryErrors)) {
                    $errors['plainLanguageSummary'] = $plainLanguageSummaryErrors;
                }
            }
        }

        return $errors;
    }

    /** @copydoc \PKP\publication\Repository::version() */
    public function version(Publication $publication, ?VersionStage $versionStage = null, bool $isMinorVersion = true, ?int $submissionStatus = null): int
    {
        $newId = parent::version($publication, $versionStage, $isMinorVersion, $submissionStatus);

        $context = Application::get()->getRequest()->getContext();

        $galleys = $publication->getData('galleys');
        $isDoiVersioningEnabled = $context->getData(Context::SETTING_DOI_VERSIONING);
        if (!empty($galleys)) {
            foreach ($galleys as $galley) {
                $newGalley = clone $galley;
                $newGalley->setData('id', null);
                $newGalley->setData('publicationId', $newId);
                if ($isDoiVersioningEnabled) {
                    $newGalley->setData('doiId', null);
                }
                Repo::galley()->add($newGalley);
            }
        }

        return $newId;
    }

    public function validatePublish(Publication $publication, Submission $submission, array $allowedLocales, string $primaryLocale): array
    {
        $errors = parent::validatePublish($publication, $submission, $allowedLocales, $primaryLocale);

        if (!$this->canCurrentUserPublish($submission->getId())) {
            $errors['authorCheck'] = __('author.submit.authorsCanNotPublish');
        }

        return $errors;
    }

    /** @copydoc \PKP\publication\Repository::setStatusOnPublish() */
    protected function setStatusOnPublish(Publication $publication)
    {
        // If the publish date is in the future, set the status to scheduled
        $datePublished = $publication->getData('datePublished');
        if ($datePublished && strtotime($datePublished) > strtotime(Core::getCurrentDate())) {
            $publication->setData('status', Submission::STATUS_SCHEDULED);
        } else {
            $publication->setData('status', Submission::STATUS_PUBLISHED);
        }

        // If there is no publish date, set it
        if (!$publication->getData('datePublished')) {
            $publication->setData('datePublished', Core::getCurrentDate());
        }
    }

    /** @copydoc \PKP\publication\Repository::delete() */
    public function delete(Publication $publication, false|int|null $submissionStatus = null): void
    {
        $galleys = Repo::galley()->getCollector()
            ->filterByPublicationIds([$publication->getId()])
            ->getMany();

        foreach ($galleys as $galley) {
            Repo::galley()->delete($galley);
        }

        parent::delete($publication, $submissionStatus);
    }

    /**
     * Set the DOI of a related preprint
     */
    public function relate(Publication $publication, int $relationStatus, ?string $vorDoi = '')
    {
        if ($relationStatus !== Publication::PUBLICATION_RELATION_PUBLISHED) {
            $vorDoi = '';
        }
        $this->edit($publication, [
            'relationStatus' => $relationStatus,
            'vorDoi' => $vorDoi,
        ]);
    }

    /**
     * Check if the current user can publish this submission
     *
     * Do not use this as a general authorization check. This does not
     * check whether the current user is actually assigned to the
     * submission in a role that is allowed to publish. It is only used
     * in a few places to see if the current user is an author who can
     * publish, based on automated moderation tools that use the hook
     * Publication::canAuthorPublish.
     *
     * @deprecated 3.4
     *
     * @hook Publication::canAuthorPublish [[$this]]
     */
    public function canCurrentUserPublish(int $submissionId, ?User $user = null): bool
    {
        $user = $user ?? Application::get()->getRequest()->getUser();

        // Check if current user is an author
        $isAuthor = false;

        $submitterAssignments = StageAssignment::withSubmissionIds([$submissionId])
            ->withRoleIds([Role::ROLE_ID_AUTHOR])
            ->get();

        foreach ($submitterAssignments as $submitterAssignment) {
            if ($user->getId() == $submitterAssignment->userId) {
                $isAuthor = true;
            }
        }

        // By default authors can not publish, but this can be overridden in screening plugins with the hook Publication::canAuthorPublish
        if ($isAuthor) {
            return (bool) Hook::call('Publication::canAuthorPublish', [$this]);
        }

        // If the user is not an author, has to be an editor, return true
        return true;
    }

    /**
     * @copydoc \PKP\publication\Repository::getErrorMessageOverrides
     */
    protected function getErrorMessageOverrides(): array
    {
        $overrides = parent::getErrorMessageOverrides();
        $overrides['relationStatus'] = __('validation.invalidOption');
        return $overrides;
    }

    /**
     * Create all DOIs associated with the publication
     */
    public function createDois(Publication $publication): array
    {
        $submission = Repo::submission()->get($publication->getData('submissionId'));

        /** @var ServerDAO $contextDao */
        $contextDao = Application::getContextDAO();
        /** @var Server $context */
        $context = $contextDao->getById($submission->getData('contextId'));

        $doiCreationFailures = [];

        if ($context->isDoiTypeEnabled(Repo::doi()::TYPE_PUBLICATION) && empty($publication->getData('doiId'))) {
            try {
                $doiId = Repo::doi()->mintPublicationDoi($publication, $submission, $context);
                Repo::publication()->edit($publication, ['doiId' => $doiId]);
            } catch (DoiException $exception) {
                $doiCreationFailures[] = $exception;
            }
        }

        // Preprint Galleys
        if ($context->isDoiTypeEnabled(Repo::doi()::TYPE_REPRESENTATION)) {
            $galleys = $publication->getData('galleys');

            foreach ($galleys as $galley) {
                if (empty($galley->getData('doiId'))) {
                    try {
                        $doiId = Repo::doi()->mintGalleyDoi($galley, $publication, $submission, $context);
                        Repo::galley()->edit($galley, ['doiId' => $doiId]);
                    } catch (DoiException $exception) {
                        $doiCreationFailures[] = $exception;
                    }
                }
            }
        }

        return $doiCreationFailures;
    }
}
