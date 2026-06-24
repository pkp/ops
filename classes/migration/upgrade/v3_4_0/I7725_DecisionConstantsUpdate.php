<?php

/**
 * @file classes/migration/upgrade/v3_4_0/I7725_DecisionConstantsUpdate.php
 *
 * Copyright (c) 2014-2023 Simon Fraser University
 * Copyright (c) 2000-2023 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class I7725_DecisionConstantsUpdate
 *
 * @brief Editorial decision constant sync up across all application
 *
 * @see https://github.com/pkp/pkp-lib/issues/7725
 */

namespace APP\migration\upgrade\v3_4_0;

class I7725_DecisionConstantsUpdate extends \PKP\migration\upgrade\v3_4_0\I7725_DecisionConstantsUpdate
{
    public function getDecisionMappings(): array
    {
        return [
            // \PKP\decision\Decision::INITIAL_DECLINE
            [
                'stage_id' => WORKFLOW_STAGE_ID_PRODUCTION,
                'current_value' => 9,
                'updated_value' => 8,
            ],
            // \PKP\decision\Decision::REVERT_DECLINE to \PKP\decision\Decision::REVERT_INITIAL_DECLINE
            // \PKP\decision\Decision::REVERT_DECLINE removed in 3.4
            [
                'stage_id' => WORKFLOW_STAGE_ID_PRODUCTION,
                'current_value' => 17,
                'updated_value' => 16,
            ]
        ];
    }
}
