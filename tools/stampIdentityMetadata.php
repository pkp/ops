<?php

/**
 * @file tools/stampIdentityMetadata.php
 *
 * Copyright (c) 2026 Simon Fraser University
 * Copyright (c) 2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class StampServerIdentityMetadata
 *
 * @ingroup tools
 *
 * @brief CLI tool to re-stamp the server identity metadata onto posted publications.
 *   Use this to backfill historical records or to correct stamps after a server identity change.
 */

use PKP\cliTool\StampIdentityMetadataTool;

require(dirname(__FILE__) . '/bootstrap.php');

class StampServerIdentityMetadata extends StampIdentityMetadataTool
{
    /**
     * @copydoc StampIdentityMetadataTool::getContextNoun()
     */
    protected function getContextNoun(): string
    {
        return 'server';
    }

    /**
     * @copydoc StampIdentityMetadataTool::getPublishedWord()
     */
    protected function getPublishedWord(): string
    {
        return 'posted';
    }
}

$tool = new StampServerIdentityMetadata($argv ?? []);
$tool->execute();
