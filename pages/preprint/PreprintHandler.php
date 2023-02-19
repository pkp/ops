<?php

/**
 * @file pages/preprint/PreprintHandler.php
 *
 * Copyright (c) 2014-2021 Simon Fraser University
 * Copyright (c) 2003-2021 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class PreprintHandler
 * @ingroup pages_preprint
 *
 * @brief Handle requests for preprint functions.
 *
 */

namespace APP\pages\preprint;

use APP\handler\Handler;

class PreprintHandler extends Handler
{
    /**
     * Redirect calls to preprints/preprintHandler
     * https://github.com/pkp/pkp-lib/issues/5932
     *
     * @deprecated 3.4
     *
     */
    public function view($args, $request)
    {
        header('HTTP/1.1 301 Moved Permanently');
        $request->redirect(null, 'preprints', 'view', $args);
    }

    /**
     * Redirect calls to preprints/preprintHandler
     * https://github.com/pkp/pkp-lib/issues/5932
     *
     * @deprecated 3.4
     *
     */
    public function download($args, $request)
    {
        header('HTTP/1.1 301 Moved Permanently');
        $request->redirect(null, 'preprints', 'download', $args);
    }
}
