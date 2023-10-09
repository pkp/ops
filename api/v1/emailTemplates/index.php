<?php
/**
 * @defgroup api_v1_emailTemplates Email templates API requests
 */

/**
 * @file api/v1/emailTemplates/index.php
 *
 * Copyright (c) 2023 Simon Fraser University
 * Copyright (c) 2023 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @ingroup api_v1_emailTemplates
 *
 * @brief Handle API requests for emailTemplates.
 */

return new \PKP\handler\APIHandler(new \PKP\API\v1\emailTemplates\PKPEmailTemplateController());
