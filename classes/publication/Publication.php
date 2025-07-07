<?php

/**
 * @file classes/publication/Publication.php
 *
 * Copyright (c) 2016-2021 Simon Fraser University
 * Copyright (c) 2003-2021 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class Publication
 *
 * @ingroup publication
 *
 * @see DAO
 *
 * @brief Class for Publication.
 */

namespace APP\publication;

use APP\core\Application;
use APP\file\PublicFileManager;
use APP\publication\enums\VersionStage;
use PKP\publication\PKPPublication;

class Publication extends PKPPublication
{
    public const DEFAULT_VERSION_STAGE = VersionStage::AUTHOR_ORIGINAL;

    public const PUBLICATION_RELATION_NONE = 1;
    public const PUBLICATION_RELATION_PUBLISHED = 3;

    /**
     * Get the URL to a localized cover image
     *
     * @return string
     */
    public function getLocalizedCoverImageUrl(int $contextId)
    {
        $coverImage = $this->getLocalizedData('coverImage');

        if (!$coverImage) {
            return '';
        }

        $publicFileManager = new PublicFileManager();

        return join('/', [
            Application::get()->getRequest()->getBaseUrl(),
            $publicFileManager->getContextFilesPath($contextId),
            $coverImage['uploadName'],
        ]);
    }
}

if (!PKP_STRICT_MODE) {
    class_alias('\APP\publication\Publication', '\Publication');
}
