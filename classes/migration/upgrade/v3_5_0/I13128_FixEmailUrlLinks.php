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
 * @brief Adds the replacements that only occur in the translations shipped with OPS.
 */

namespace APP\migration\upgrade\v3_5_0;

class I13128_FixEmailUrlLinks extends \PKP\migration\upgrade\v3_5_0\I13128_FixEmailUrlLinks
{
    public function up(): void
    {
        parent::up();

        // The Spanish translation kept the variable of the email template this one
        // replaced, which the application does not provide
        $this->replace('USER_VALIDATE_CONTEXT', '{$enableUrl}', '<a href="{$activateUrl}">{$activateUrl}</a>');
    }
}
