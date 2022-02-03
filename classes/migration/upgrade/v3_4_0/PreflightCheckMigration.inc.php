<?php

/**
 * @file classes/migration/upgrade/v3_4_0/PreflightCheckMigration.inc.php
 *
 * Copyright (c) 2014-2021 Simon Fraser University
 * Copyright (c) 2000-2021 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class PreflightCheckMigration
 * @brief Check for common problems early in the upgrade process.
 */

namespace APP\migration\upgrade\v3_4_0;

use Illuminate\Support\Facades\DB;

use PKP\db\DAORegistry;

class PreflightCheckMigration extends \PKP\migration\Migration
{
    private const ASSOC_TYPE_JOURNAL = 0x0000100;
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        try {
            // pkp/pkp-lib#6903 Prepare to add foreign key relationships
            // Clean orphaned assoc_type/assoc_id data in announcement_types
            $orphanedIds = DB::table('announcement_types AS at')->leftJoin('journals AS c', 'at.assoc_id', '=', 'c.journal_id')->whereNull('c.journal_id')->orWhere('at.assoc_type', '<>', static::ASSOC_TYPE_JOURNAL)->distinct()->pluck('at.type_id');
            foreach ($orphanedIds as $typeId) {
                $this->_installer->log("Removing orphaned announcement type ID ${typeId} with no matching context ID.");
                DB::table('announcement_types')->where('type_id', '=', $typeId)->delete();
            }
        } catch (\Exception $e) {
            if ($fallbackVersion = $this->setFallbackVersion()) {
                $this->_installer->log("A pre-flight check failed. The software was successfully upgraded to ${fallbackVersion} but could not be upgraded further (to " . $this->_installer->newVersion->getVersionString() . '). Check and correct the error, then try again.');
            }
            throw $e;
        }
    }

    /**
     * Rollback the migrations.
     */
    public function down(): void
    {
        if ($fallbackVersion = $this->setFallbackVersion()) {
            $this->_installer->log("An upgrade step failed! Fallback set to ${fallbackVersion}. Check and correct the error and try the upgrade again. We recommend restoring from backup, though you may be able to continue without doing so.");
            // Prevent further downgrade migrations from executing.
            $this->_installer->migrations = [];
        }
    }

    /**
     * Store the fallback version in the database, permitting resumption of partial upgrades.
     *
     * @return ?string Fallback version, if one was identified
     */
    protected function setFallbackVersion(): ?string
    {
        if ($fallbackVersion = $this->_attributes['fallback'] ?? null) {
            $versionDao = DAORegistry::getDAO('VersionDAO'); /** @var VersionDAO $versionDao */
            $versionDao->insertVersion(\PKP\site\Version::fromString($fallbackVersion));
            return $fallbackVersion;
        }
        return null;
    }
}
