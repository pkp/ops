<?php

/**
 * @file classes/migration/upgrade/v3_4_0/I6782_OrphanedMetrics.inc.php
 *
 * Copyright (c) 2014-2021 Simon Fraser University
 * Copyright (c) 2000-2021 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class I6782_OrphanedMetrics
 * @briefMigrate metrics data from objects that do not exist any more into a temporary table.
 */

namespace APP\migration\upgrade\v3_4_0;

class I6782_OrphanedMetrics extends \PKP\migration\upgrade\v3_4_0\I6782_OrphanedMetrics
{
    protected function getContextTable(): string
    {
        return 'servers';
    }

    protected function getContextKeyField(): string
    {
        return 'server_id';
    }

    protected function getRepresentationTable(): string
    {
        return 'publication_galleys';
    }

    protected function getRepresentationKeyField(): string
    {
        return 'galley_id';
    }
}
