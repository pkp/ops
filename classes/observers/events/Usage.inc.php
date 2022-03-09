<?php

/**
 * @file classes/observers/events/Usage.inc.php
 *
 * Copyright (c) 2014-2021 Simon Fraser University
 * Copyright (c) 2000-2021 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class Usage
 * @ingroup observers_events
 *
 * @brief Usage event.
 *
 */

namespace APP\observers\events;

use APP\submission\Submission;
use PKP\context\Context;
use PKP\observers\traits\UsageEvent;
use PKP\submission\Representation;
use PKP\submissionFile\SubmissionFile;

class Usage
{
    use UsageEvent;

    public function __construct(int $assocType, Context $context, Submission $submission = null, Representation $publicationFormat = null, SubmissionFile $submissionFile = null)
    {
        $this->constructUsageEvent($assocType, $context, $submission, $publicationFormat, $submissionFile);
    }
}
