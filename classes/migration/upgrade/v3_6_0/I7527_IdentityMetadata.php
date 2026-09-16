<?php

/**
 * @file classes/migration/upgrade/v3_6_0/I7527_IdentityMetadata.php
 *
 * Copyright (c) 2026 Simon Fraser University
 * Copyright (c) 2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class I7527_IdentityMetadata
 *
 * @brief Add the publisher location (from the CitationStyleLanguage plugin) to the stamped
 *   publication metadata.
 */

namespace APP\migration\upgrade\v3_6_0;

use Illuminate\Support\Facades\DB;

class I7527_IdentityMetadata extends \PKP\migration\upgrade\v3_6_0\I7527_IdentityMetadata
{
    protected function getIdentitySettings(string $settingsTable, string $idColumn, int $contextId): array
    {
        $settings = parent::getIdentitySettings($settingsTable, $idColumn, $contextId);

        // Publisher location is stored by the CitationStyleLanguage plugin
        $publisherLocation = DB::table('plugin_settings')
            ->where('plugin_name', 'citationstylelanguageplugin')
            ->where('context_id', $contextId)
            ->where('setting_name', 'publisherLocation')
            ->value('setting_value');
        if ($publisherLocation !== null && $publisherLocation !== '') {
            $settings['publisherLocation'] = $publisherLocation;
        }

        return $settings;
    }
}
