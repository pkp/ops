<?php

/**
 * @file classes/migration/upgrade/v3_4_0/I7725_DecisionConstantsUpdate.php
 *
 * Copyright (c) 2014-2022 Simon Fraser University
 * Copyright (c) 2000-2022 John Willinsky
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
    /**
     * Get the decisions constants mappings
     *
     * OPS only has 2 decisions at PRODUCTION stage: INITIAL_DECLINE and REVERT_DECLINE.
     * No stage_id filtering needed: only 2 unique values with no collision risk,
     * and the parent class's updated_at tracking prevents any issues.
     * See https://github.com/pkp/pkp-lib/issues/12357
     */
    public function getDecisionMappings(): array
    {
        return [
            ['current_value' => 9,  'updated_value' => 8],   // INITIAL_DECLINE
            ['current_value' => 17, 'updated_value' => 16],   // REVERT_INITIAL_DECLINE (was REVERT_DECLINE in 3.3)
        ];
    }
}
