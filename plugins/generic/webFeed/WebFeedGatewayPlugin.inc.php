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
	public const ATOM = 'atom';
	public const RSS = 'rss';
	public const RSS2 = 'rss2';

	public const FEED_MIME_TYPE = [
		self::ATOM => 'application/atom+xml',
		self::RSS => 'application/rdf+xml',
		self::RSS2 => 'application/rss+xml'
	];

	public const DEFAULT_RECENT_ITEMS = 30;

	/** @var WebFeedPlugin Parent plugin */
	protected $parentPlugin;

	/**
	 * @param WebFeedPlugin $parentPlugin
	 */
	public function __construct($parentPlugin) {
		parent::__construct();
		$this->parentPlugin = $parentPlugin;
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
		return $this->parentPlugin->getPluginPath();
	}

	/**
	 * Get whether or not this plugin is enabled. (Should always return true, as the
	 * parent plugin will take care of loading this one when needed)
	 * @param int $contextId Context ID (optional)
	 * @return boolean
	 */
	public function getEnabled($contextId = null) {
		return $this->parentPlugin->getEnabled($contextId);
	}

	/**
	 * Handle fetch requests for this plugin.
	 * @param array $args Arguments.
	 * @param Request $request Request object.
	 */
	public function fetch($args, $request) {
		$server = $request->getJournal();
		if (!$server || !$this->parentPlugin->getEnabled($server->getId())) {
			return false;
		}

		// Make sure the feed type is specified and valid
		$feedType = array_shift($args);
		if (!in_array($feedType, array_keys(static::FEED_MIME_TYPE))) {
			throw new Exception('Invalid feed format');
		}

		// Get limit setting from web feeds plugin
		$recentItems = (int) $this->parentPlugin->getSetting($server->getId(), 'recentItems');
		if ($recentItems < 1) {
			$recentItems = self::DEFAULT_RECENT_ITEMS;
		}
		$includeIdentifiers = (bool) $this->parentPlugin->getSetting($server->getId(), 'includeIdentifiers');

		import('classes.submission.Submission'); // STATUS_PUBLISHED constant
		$submissionsIterator = Services::get('submission')->getMany([
			'contextId' => $server->getId(),
			'status' => STATUS_PUBLISHED,
			'count' => $recentItems,
			'orderBy' => 'lastModified',
			'orderDirection' => 'DESC'
		]);
		$submissions = [];
		$latestDate = null;
		/** @var Submission */
		foreach ($submissionsIterator as $submission) {
			$latestDate = $latestDate ?? $submission->getCurrentPublication()->getData('lastModified');
			$submissions[] = ['submission' => $submission, 'identifiers' => $this->_getIdentifiers($submission)];
		}

		/** @var UserGroupDAO */
		$userGroupDao = DAORegistry::getDAO('UserGroupDAO');
		$userGroups = $userGroupDao->getByContextId($server->getId())->toArray();

		AppLocale::requireComponents(LOCALE_COMPONENT_PKP_SUBMISSION); // submission.copyrightStatement

		/** @var VersionDAO */
		$versionDao = DAORegistry::getDAO('VersionDAO');
		$version = $versionDao->getCurrentVersion();

		TemplateManager::getManager($request)
			->assign(
				[
					'systemVersion' => $version->getVersionString(),
					'submissions' => $submissions,
					'server' => $server,
					'latestDate' => $latestDate,
					'feedUrl' => $request->getRequestUrl(),
					'userGroups' => $userGroups,
					'includeIdentifiers' => $includeIdentifiers
				]
			)
			->setHeaders(['content-type: ' . static::FEED_MIME_TYPE[$feedType] . '; charset=' . Config::getVar('i18n', 'client_charset')])
			->display($this->parentPlugin->getTemplateResource("{$feedType}.tpl"));
		return true;
	}

	/**
	 * Retrieves the identifiers assigned to a submission
	 */
	private function _getIdentifiers(Submission $submission): array
	{
		$identifiers = [];
		if ($section = $this->_getSection($submission->getSectionId())) {
			$identifiers[] = ['type' => 'section', 'label' => __('section.section'), 'values' => [$section->getLocalizedTitle()]];
		}

		$publication = $submission->getCurrentPublication();
		/** @var CategoryDAO */
		$categoryDao = DAORegistry::getDAO('CategoryDAO');
		$categoryList = $categoryDao->getByPublicationId($publication->getId())->toIterator();
		$categories = [];
		/** @var Category */
		foreach ($categoryList as $category) {
			$categories[] = $category->getLocalizedTitle();
		}
		if (count($categories)) {
			$identifiers[] = ['type' => 'category', 'label' => __('category.categories'), 'values' => $categories];
		}

		foreach (['keywords' => 'common.keywords', 'subjects' => 'common.subjects', 'disciplines' => 'search.discipline'] as $field => $label) {
			$values = $publication->getLocalizedData($field) ?? [];
			if (count($values)) {
				$identifiers[] = ['type' => $field, 'label' => __($label), 'values' => $values];
			}
		}

		return $identifiers;
	}

	/**
	 * Retrieves a section
	 */
	private function _getSection(?int $sectionId): ?Section
	{
		static $sections = [];
		/** @var SectionDAO */
		$sectionDao = DAORegistry::getDAO('SectionDAO');
		return $sectionId
			? $sections[$sectionId] = $sections[$sectionId] ?? $sectionDao->getById($sectionId)
			: null;
	}
}
