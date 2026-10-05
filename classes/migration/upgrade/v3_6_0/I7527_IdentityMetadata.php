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
    /**
     * @copydoc \PKP\migration\upgrade\v3_6_0\I7527_IdentityMetadata::getIdentitySettings()
     *
     * Adds the publisher location, if the CSL plugin is enabled.
     */
    protected function getIdentitySettings(string $settingsTable, string $idColumn, int $contextId): array
    {
        $settings = parent::getIdentitySettings($settingsTable, $idColumn, $contextId);

        // Publisher location is stored by the CitationStyleLanguage plugin; like stamping on publish,
        // it is only used while the plugin is enabled
        $cslSettings = DB::table('plugin_settings')
            ->where('plugin_name', 'citationstylelanguageplugin')
            ->where('context_id', $contextId)
            ->whereIn('setting_name', ['enabled', 'publisherLocation'])
            ->pluck('setting_value', 'setting_name');
        if ($cslSettings->get('enabled') && ($publisherLocation = $cslSettings->get('publisherLocation')) !== null && $publisherLocation !== '') {
            $settings['publisherLocation'] = $publisherLocation;
        }

        return $settings;
    }
}
