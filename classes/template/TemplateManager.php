<?php

/**
 * @file classes/template/TemplateManager.php
 *
 * Copyright (c) 2014-2021 Simon Fraser University
 * Copyright (c) 2003-2021 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class TemplateManager
 *
 * @ingroup template
 *
 * @brief Class for accessing the underlying template engine.
 * Currently integrated with Smarty (from http://smarty.php.net/).
 *
 */

namespace APP\template;

use APP\core\Application;
use APP\file\PublicFileManager;
use PKP\core\PKPApplication;
use PKP\core\PKPSessionGuard;
use PKP\facades\Locale;
use PKP\i18n\LocaleMetadata;
use PKP\site\Site;
use PKP\template\PKPTemplateManager;

class TemplateManager extends PKPTemplateManager
{
    /**
     * Initialize template engine and assign basic template variables.
     *
     * @param \APP\core\Request $request
     */
    public function initialize($request)
    {
        parent::initialize($request);

        if (!PKPSessionGuard::isSessionDisable()) {
            /**
             * Kludge to make sure no code that tries to connect to
             * the database is executed (e.g., when loading
             * installer pages).
             */

            $context = $request->getContext();
            $site = $request->getSite(); /** @var Site $site */

            $publicFileManager = new PublicFileManager();
            $siteFilesDir = $request->getBaseUrl() . '/' . $publicFileManager->getSiteFilesPath();
            $this->assign('sitePublicFilesDir', $siteFilesDir);
            $this->assign('publicFilesDir', $siteFilesDir); // May be overridden by server

            if ($site->getData('styleSheet')) {
                $this->addStyleSheet(
                    'siteStylesheet',
                    $request->getBaseUrl() . '/' . $publicFileManager->getSiteFilesPath() . '/' . $site->getData('styleSheet')['uploadName'],
                    ['priority' => self::STYLE_SEQUENCE_LATE]
                );
            }

            // Pass app-specific details to template
            $this->assign([
                'brandImage' => 'templates/images/ops_brand.png',
                'packageKey' => 'common.software',
            ]);

            if (isset($context)) {
                $this->assign([
                    'currentServer' => $context,
                    'siteTitle' => $context->getLocalizedName(),
                    'publicFilesDir' => $request->getBaseUrl() . '/' . $publicFileManager->getContextFilesPath($context->getId()),
                    'primaryLocale' => $context->getPrimaryLocale(),
                    'supportedLocales' => $context->getSupportedLocaleNames(LocaleMetadata::LANGUAGE_LOCALE_ONLY),
                    'numPageLinks' => $context->getData('numPageLinks'),
                    'itemsPerPage' => $context->getData('itemsPerPage'),
                    'enableAnnouncements' => $context->getData('enableAnnouncements'),
                    'disableUserReg' => $context->getData('disableUserReg'),
                ]);

                // Get a link to the settings page for the current context.
                // This allows us to reduce template duplication by using this
                // variable in templates/common/header.tpl, instead of
                // reproducing a lot of OMP/OPS-specific logic there.
                $dispatcher = $request->getDispatcher();
                $this->assign([
                    'contextSettingsUrl' => $dispatcher->url($request, PKPApplication::ROUTE_PAGE, null, 'management', 'settings', ['context']),
                    'pageFooter' => $context->getLocalizedData('pageFooter')
                ]);
            } else {
                // Check if registration is open for any contexts
                $contextDao = Application::getContextDAO();
                $contexts = $contextDao->getAll(true)->toArray();
                $contextsForRegistration = [];
                foreach ($contexts as $context) {
                    if (!$context->getData('disableUserReg')) {
                        $contextsForRegistration[] = $context;
                    }
                }

                $this->assign([
                    'contexts' => $contextsForRegistration,
                    'disableUserReg' => empty($contextsForRegistration),
                    'siteTitle' => $site->getLocalizedTitle(),
                    'primaryLocale' => $site->getPrimaryLocale(),
                    'supportedLocales' => Locale::getFormattedDisplayNames(
                        $site->getSupportedLocales(),
                        Locale::getLocales(),
                        LocaleMetadata::LANGUAGE_LOCALE_ONLY
                    ),
                    'pageFooter' => $site->getLocalizedData('pageFooter'),
                ]);
            }
        }
    }
}
