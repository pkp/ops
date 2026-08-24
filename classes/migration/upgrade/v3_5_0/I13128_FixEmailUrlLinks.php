<?php

/**
 * @file classes/migration/upgrade/v3_5_0/I13128_FixEmailUrlLinks.php
 *
 * Copyright (c) 2026 Simon Fraser University
 * Copyright (c) 2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class I13128_FixEmailUrlLinks
 *
 * @brief Adds the replacements that only occur in the OPS translations.
 */

namespace APP\migration\upgrade\v3_5_0;

class I13128_FixEmailUrlLinks extends \PKP\migration\upgrade\v3_5_0\I13128_FixEmailUrlLinks
{
    public function up(): void
    {
        parent::up();

        $this->replace('POSTED_ACK', '{$submissionUrl}', '<a href="{$submissionUrl}">{$submissionUrl}</a>', 'href="{$submissionUrl}"');

        // es kept a variable from the old template, which no longer exists
        $this->replace('USER_VALIDATE_CONTEXT', '{$enableUrl}', '<a href="{$activateUrl}">{$activateUrl}</a>', '', 'es');
    }

    public function down(): void
    {
        $this->replace('POSTED_ACK', '<a href="{$submissionUrl}">{$submissionUrl}</a>', '{$submissionUrl}');

        parent::down();
    }
}
