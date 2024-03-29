<?php
/**
 * @defgroup api_v1_i18n Backend i18n API requests
 */

/**
 * @file api/v1/_i18n/index.php
 *
 * Copyright (c) 2023 Simon Fraser University
 * Copyright (c) 2023 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @ingroup api_v1_i18n
 *
 * @brief Handle API requests for backend i18n operations.
 */


return new \PKP\handler\APIHandler(new \PKP\API\v1\_i18n\I18nController());
