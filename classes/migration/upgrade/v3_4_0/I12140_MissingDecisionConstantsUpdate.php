<?php

/**
 * @file classes/migration/upgrade/v3_4_0/I12140_MissingDecisionConstantsUpdate.php
 *
 * Copyright (c) 2025 Simon Fraser University
 * Copyright (c) 2025 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class I12140_MissingDecisionConstantsUpdate
 *
 * @brief Fixed the missing decisions data in stages
 *
 * @see https://github.com/pkp/pkp-lib/issues/12140
 */

namespace APP\migration\upgrade\v3_4_0;

use APP\core\Application;
use Illuminate\Support\Facades\DB;
use PKP\install\DowngradeNotSupportedException;

class I12140_MissingDecisionConstantsUpdate extends \PKP\migration\upgrade\v3_4_0\I7725_DecisionConstantsUpdate
{
    /**
     * Get the decisions constants mappings
     */
    public function getDecisionMappings(): array
    {
        return [
            // \PKP\decision\Decision::INITIAL_DECLINE
            [
                'stage_id' => [WORKFLOW_STAGE_ID_PRODUCTION],
                'current_value' => 9,
                'updated_value' => 8,
            ],
            // \PKP\decision\Decision::REVERT_INITIAL_DECLINE
            // Was REVERT_DECLINE (17) in OPS 3.3, maps to REVERT_INITIAL_DECLINE (16) in 3.4
            [
                'stage_id' => [WORKFLOW_STAGE_ID_PRODUCTION],
                'current_value' => 17,
                'updated_value' => 16,
            ],
        ];
    }

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // If the first installed version is 3.4.0+
        // no legacy data exists, nothing to do
        $firstInstalledVersion = DB::table('versions')
            ->where('product', Application::get()->getName())
            ->where('product_type', 'core')
            ->orderBy('date_installed')
            ->first();

        if ($firstInstalledVersion->major == 3 && $firstInstalledVersion->minor == 4) {
            return;
        }

        // Date-based filtering is not needed here (unlike OJS/OMP I12140).
        // In OJS/OMP, I7725 ran during the original 3.3→3.4 upgrade but had bugs,
        // so date filtering distinguishes "migrated correctly" vs "migrated incorrectly" rows.
        // For OPS, I7725 was entirely missing — it never ran at all for these installations.
        // So ALL rows with old values (9, 17) need migrating.
        // These old values are distinct from the new 3.4 values (8, 16),
        // so parent::up() only matches unmigrated legacy rows — no date filter required.
        parent::up();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        throw new DowngradeNotSupportedException();
    }
}
