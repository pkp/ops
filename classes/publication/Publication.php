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
use PKP\context\Context;
use PKP\plugins\PluginRegistry;
use PKP\publication\HasContextIdentityMetadata;
use PKP\publication\PKPPublication;

class Publication extends PKPPublication
{
    use HasContextIdentityMetadata;

    public const DEFAULT_VERSION_STAGE = VersionStage::AUTHOR_ORIGINAL;

    public const PUBLICATION_RELATION_UNKNOWN = 0;
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

    /**
     * Stamp the server identity metadata. The publisher location is taken from the CSL plugin
     * settings if that plugin is enabled, and cleared otherwise.
     */
    public function stampContextIdentity(Context $context): void
    {
        parent::stampContextIdentity($context);

        // Always set, so a re-stamp does not keep an old location when CSL provides none
        $cslPlugin = PluginRegistry::getPlugin('generic', 'citationstylelanguageplugin');
        $publisherLocation = $cslPlugin?->getEnabled($context->getId()) ? $cslPlugin->getSetting($context->getId(), 'publisherLocation') : null;
        $this->setData('publisherLocation', $publisherLocation ?: null);
    }
}
