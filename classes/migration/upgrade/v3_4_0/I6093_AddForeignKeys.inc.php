<?php

/**
 * @file classes/migration/upgrade/v3_4_0/I6093_AddForeignKeys.inc.php
 *
 * Copyright (c) 2014-2021 Simon Fraser University
 * Copyright (c) 2000-2021 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class I6093_AddForeignKeys
 * @brief Describe upgrade/downgrade operations for introducing foreign key definitions to existing database relationships.
 */

namespace APP\migration\upgrade\v3_4_0;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use PKP\install\DowngradeNotSupportedException;

class I6093_AddForeignKeys extends \PKP\migration\Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('announcement_types', function (Blueprint $table) {
            $table->foreign('context_id')->references('server_id')->on('servers');
        });

        Schema::table('categories', function (Blueprint $table) {
            $table->foreign('context_id')->references('server_id')->on('servers');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        throw new DowngradeNotSupportedException('Downgrade unsupported due to removed data');
    }
}
