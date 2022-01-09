<?php

/**
 * @file classes/migration/upgrade/3_4_0/I7599_UpdateInvalidStageId.inc.php
 *
 * Copyright (c) 2014-2021 Simon Fraser University
 * Copyright (c) 2000-2021 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class I7599_UpdateInvalidStageId
 * @brief Ensure there's no data assigned to the submission stage in order to address the issue pkp/pkp-lib#7599.
 */

namespace APP\migration\upgrade\v3_4_0;

use Exception;
use Illuminate\Support\Facades\DB;
use PKP\install\DowngradeNotSupportedException;

class I7599_UpdateInvalidStageId extends \PKP\migration\Migration
{
    /**
     * Run the migration.
     */
    public function up(): void
    {
        // Ensure there's no data assigned to tables which would be risky to update by ourselves
        $riskyTables = array_filter(
            ['review_round_files', 'review_assignments', 'edit_decisions', 'review_rounds'],
            fn ($table) => DB::table($table)->where('stage_id', '<>', '5')->count() > 0
        );
        if (count($riskyTables)) {
            throw new Exception(
                'The upgrade is unable to proceed safely due to the existence of records using a'
                . ' non-production stage (all records should have stage_id = 5) in the following'
                . ' tables (the records must be updated/merged/removed manually before attempting to upgrade again): '
                . implode(', ', $riskyTables)
            );
        }

        // Update any stage to WORKFLOW_STAGE_ID_PRODUCTION
        DB::statement('UPDATE submissions SET stage_id = 5 WHERE stage_id <> 5');
        DB::statement('UPDATE queries SET stage_id = 5 WHERE stage_id <> 5');
        // Remove records which don't have the stage_id equals to WORKFLOW_STAGE_ID_PRODUCTION
        DB::statement('DELETE FROM email_templates_default WHERE stage_id <> 5');
        DB::statement('DELETE FROM user_group_stage WHERE stage_id <> 5');
    }

    /**
     * Reverse the downgrades
     */
    public function down(): void
    {
        throw new DowngradeNotSupportedException();
    }
}
