<?php

/**
 * @file classes/migration/upgrade/v3_4_0/I11759_RemoveDuplicateFilters.php
 *
 * Copyright (c) 2026 Simon Fraser University
 * Copyright (c) 2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class I11759_RemoveDuplicateFilters
 *
 * @brief Handles accidental retention of old-style Crossref filter class name
 */

namespace APP\migration\upgrade\v3_4_0;

use Illuminate\Support\Facades\DB;
use PKP\install\DowngradeNotSupportedException;
use PKP\migration\Migration;

class I11759_RemoveDuplicateFilters extends Migration
{
    /**
     * @inheritDoc
     */
    public function up(): void
    {
        DB::table('filters')
            ->where('class_name', '=', 'plugins.generic.crossref.filter.PreprintCrossrefXmlFilter')
            ->delete();
    }

    /**
     * @inheritDoc
     */
    public function down(): void
    {
        throw new DowngradeNotSupportedException();
    }
}
