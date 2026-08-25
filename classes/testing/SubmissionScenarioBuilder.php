<?php

/**
 * @file classes/testing/SubmissionScenarioBuilder.php
 *
 * Copyright (c) 2026 Simon Fraser University
 * Copyright (c) 2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class SubmissionScenarioBuilder
 *
 * @brief OPS submission scenario: `section` overlay (abbrev/path; defaults to
 * the server's first section). OPS has no review stage, so the `reviewRounds`
 * key is REJECTED outright — never silently ignored. The workflow start stage
 * (production) comes from the OPS submission schema default, not from this
 * builder.
 */

namespace APP\testing;

use APP\facades\Repo;
use PKP\context\Context;
use PKP\testing\PKPSubmissionScenarioBuilder;
use PKP\testing\Spec;
use PKP\testing\SpecException;

class SubmissionScenarioBuilder extends PKPSubmissionScenarioBuilder
{
    protected function parsePublicationOverlay(Context $context, Spec $root): array
    {
        $abbrev = $root->get('section');
        if ($abbrev !== null) {
            $sectionId = BootstrapSeeder::findSectionId($context, (string) $abbrev);
            if (!$sectionId) {
                throw new SpecException('section', "Unknown section \"{$abbrev}\" in context \"{$context->getPath()}\"");
            }
            return ['sectionId' => $sectionId];
        }
        $firstSection = Repo::section()->getCollector()
            ->filterByContextIds([$context->getId()])
            ->getMany()
            ->first();
        return $firstSection ? ['sectionId' => $firstSection->getId()] : [];
    }

    protected function assertReviewRoundsSupported(Spec $root): void
    {
        throw new SpecException('reviewRounds', 'OPS has no review stage — reviewRounds cannot be seeded on this app');
    }
}
