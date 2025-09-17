<?php

declare(strict_types=1);

/**
 * @file classes/observers/listeners/AssignDOIsOnSubmission.php
 *
 * Copyright (c) 2014-2025 Simon Fraser University
 * Copyright (c) 2000-2025 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class AssignDOIsOnSubmission
 *
 * @ingroup core
 *
 * @brief Assigns DOIs when a submission is created as OPS submissions enter production stage immediately
 */

namespace APP\observers\listeners;

use APP\facades\Repo;
use Illuminate\Events\Dispatcher;
use PKP\context\Context;
use PKP\observers\events\SubmissionSubmitted;

class AssignDOIsOnSubmission
{
    public function subscribe(Dispatcher $events): void
    {
        $events->listen(
            SubmissionSubmitted::class,
            AssignDOIsOnSubmission::class
        );
    }

    public function handle(SubmissionSubmitted $event)
    {
        $context = $event->context;
        $doiCreationTime = $context->getData(Context::SETTING_DOI_CREATION_TIME);
        if ($doiCreationTime === Repo::doi()::CREATION_TIME_COPYEDIT) {
            Repo::submission()->createDois($event->submission);
        }
    }
}
