<?php

/**
 * @file plugins/generic/webFeed/WebFeedGatewayPlugin.inc.php
 *
 * Copyright (c) 2014-2021 Simon Fraser University
 * Copyright (c) 2003-2021 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class WebFeedGatewayPlugin
 * @ingroup plugins_generic_webFeed
 *
 * @brief Gateway component of web feed plugin
 *
 */

import('lib.pkp.classes.plugins.GatewayPlugin');

class WebFeedGatewayPlugin extends GatewayPlugin {
	const DEFAULT_RECENT_ITEMS = 30;

	/** @var WebFeedPlugin Parent plugin */
	protected $_parentPlugin;

	/**
	 * @param WebFeedPlugin $parentPlugin
	 */
	public function __construct($parentPlugin) {
		parent::__construct();
		$this->_parentPlugin = $parentPlugin;
	}

	/**
	 * Hide this plugin from the management interface (it's subsidiary)
	 */
	public function getHideManagement() {
		return true;
	}

	/**
	 * Get the name of this plugin. The name must be unique within
	 * its category.
	 * @return string name of plugin
	 */
	public function getName() {
		return 'WebFeedGatewayPlugin';
	}

	/**
	 * @copydoc Plugin::getDisplayName()
	 */
	public function getDisplayName() {
		return __('plugins.generic.webfeed.displayName');
	}

	/**
	 * @copydoc Plugin::getDescription()
	 */
	public function getDescription() {
		return __('plugins.generic.webfeed.description');
	}

	/**
	 * Override the builtin to get the correct plugin path.
	 * @return string
	 */
	public function getPluginPath() {
		return $this->_parentPlugin->getPluginPath();
	}

	/**
	 * Get whether or not this plugin is enabled. (Should always return true, as the
	 * parent plugin will take care of loading this one when needed)
	 * @param int $contextId Context ID (optional)
	 * @return boolean
	 */
	public function getEnabled($contextId = null) {
		return $this->_parentPlugin->getEnabled($contextId);
	}

	/**
	 * Handle fetch requests for this plugin.
	 * @param array $args Arguments.
	 * @param Request $request Request object.
	 */
	public function fetch($args, $request) {
		$server = $request->getJournal();
		if (!$server) {
			return false;
		}

		if (!$this->_parentPlugin->getEnabled($server->getId())) {
			return false;
		}

		// Make sure the feed type is specified and valid
		$type = array_shift($args);
		$templateConfig = [
			'rss' => ['template' => 'rss.tpl', 'mimeType' => 'application/rdf+xml'],
			'rss2' => ['template' => 'rss2.tpl', 'mimeType' => 'application/rss+xml'],
			'atom' => ['template' => 'atom.tpl', 'mimeType' => 'application/atom+xml']
		][$type] ?? null;

		if (!$templateConfig) {
			return false;
		}

		// Get limit setting from web feeds plugin
		$recentItems = (int) $this->_parentPlugin->getSetting($server->getId(), 'recentItems');
		if ($recentItems < 1) {
			$recentItems = self::DEFAULT_RECENT_ITEMS;
		}

		import('classes.submission.Submission'); // STATUS_PUBLISHED constant
		/** @var SectionDAO */
		$sectionDao = DAORegistry::getDAO('SectionDAO');
		/** @var CategoryDAO */
		$categoryDao = DAORegistry::getDAO('CategoryDAO');
		$submissionsIterator = Services::get('submission')->getMany([
			'contextId' => $server->getId(),
			'status' => STATUS_PUBLISHED,
			'count' => $recentItems,
			'orderBy' => 'datePublished',
			'orderDirection' => 'DESC'
		]);
		$sections = [];
		$submissions = [];
		$latestDate = null;
		/** @var Submission */
		foreach ($submissionsIterator as $submission) {
			$latestDate = $latestDate ?? $submission->getLastModified();
			$identifiers = [];
			/** @var ?Section */
			$section = ($sectionId = $submission->getSectionId())
				? $sections[$sectionId] ?? $sections[$sectionId] = $sectionDao->getById($sectionId)
				: null;
			if ($section) {
				$identifiers[] = ['type' => 'section', 'value' => $section->getLocalizedTitle()];
			}

			$publication = $submission->getCurrentPublication();
			$categories = $categoryDao->getByPublicationId($publication->getId())->toIterator();
			/** @var Category */
			foreach ($categories as $category) {
				$identifiers[] = ['type' => 'category', 'value' => $category->getLocalizedTitle()];
			}

			foreach (['keywords', 'subjects', 'disciplines'] as $type) {
				$values = $publication->getLocalizedData($type) ?? [];
				foreach ($values as $value) {
					$identifiers[] = ['type' => $type, 'value' => $value];
				}
			}

			$submissions[] = [
				'submission' => $submission,
				'identifiers' => $identifiers
			];
		}

		/** @var VersionDAO */
		$versionDao = DAORegistry::getDAO('VersionDAO');
		$version = $versionDao->getCurrentVersion();

		$templateMgr = TemplateManager::getManager($request);
		$templateMgr->assign([
			'systemVersion' => $version->getVersionString(),
			'submissions' => $submissions,
			'server' => $server,
			'latestDate' => $latestDate,
			'feedUrl' => $request->getRequestUrl()
		]);

		AppLocale::requireComponents(LOCALE_COMPONENT_PKP_SUBMISSION); // submission.copyrightStatement

		$templateMgr->display($this->_parentPlugin->getTemplateResource($templateConfig['template']), $templateConfig['mimeType']);

		return true;
	}
}
