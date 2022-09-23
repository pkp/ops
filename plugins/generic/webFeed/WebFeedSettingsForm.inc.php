<?php

/**
 * @file plugins/generic/webFeed/WebFeedSettingsForm.inc.php
 *
 * Copyright (c) 2014-2021 Simon Fraser University
 * Copyright (c) 2003-2021 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class WebFeedSettingsForm
 * @ingroup plugins_generic_webFeed
 *
 * @brief Form for managers to modify web feeds plugin settings
 */

import('lib.pkp.classes.form.Form');

class WebFeedSettingsForm extends Form {

	/** @var int Associated context ID */
	private $_contextId;

	/** @var WebFeedPlugin Web feed plugin */
	private $_plugin;

	/**
	 * Constructor
	 * @param WebFeedPlugin $plugin Web feed plugin
	 * @param int $contextId Context ID
	 */
	function __construct($plugin, $contextId) {
		$this->_contextId = $contextId;
		$this->_plugin = $plugin;

		parent::__construct($plugin->getTemplateResource('settingsForm.tpl'));
		$this->addCheck(new FormValidatorPost($this));
		$this->addCheck(new FormValidatorCSRF($this));
	}

	/**
	 * @copydoc Form::initData()
	 */
	function initData() {
		$contextId = $this->_contextId;
		$plugin = $this->_plugin;

		$this->setData('displayPage', $plugin->getSetting($contextId, 'displayPage'));
		$this->setData('recentItems', $plugin->getSetting($contextId, 'recentItems'));
		$this->setData('includeIdentifiers', $plugin->getSetting($contextId, 'includeIdentifiers'));
		parent::initData();
	}

	/**
	 * @copydoc Form::readInputData()
	 */
	function readInputData() {
		$this->readUserVars(['displayPage', 'recentItems', 'includeIdentifiers']);

		// check that recent items value is a positive integer
		if ((int) $this->getData('recentItems') <= 0) {
			$this->setData('recentItems', '');
		}

		$this->addCheck(new FormValidator($this, 'recentItems', 'required', 'plugins.generic.webfeed.settings.recentItemsRequired'));
	}

	/**
	 * Fetch the form.
	 * @copydoc Form::fetch()
	 */
	function fetch($request, $template = null, $display = false) {
		$templateMgr = TemplateManager::getManager($request);
		$templateMgr->assign('pluginName', $this->_plugin->getName());
		return parent::fetch($request, $template, $display);
	}

	/**
	 * @copydoc Form::execute()
	 */
	function execute(...$functionArgs) {
		$plugin = $this->_plugin;
		$contextId = $this->_contextId;

		$plugin->updateSetting($contextId, 'displayPage', $this->getData('displayPage'), 'string');
		$plugin->updateSetting($contextId, 'recentItems', $this->getData('recentItems'), 'int');
		$plugin->updateSetting($contextId, 'includeIdentifiers', $this->getData('includeIdentifiers'), 'bool');

		parent::execute(...$functionArgs);
	}
}
