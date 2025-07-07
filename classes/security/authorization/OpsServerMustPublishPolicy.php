<?php

/**
 * @file classes/security/authorization/OpsServerMustPublishPolicy.php
 *
 * Copyright (c) 2014-2021 Simon Fraser University
 * Copyright (c) 2000-2021 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class OpsServerMustPublishPolicy
 *
 * @ingroup security_authorization
 *
 * @brief Access policy to limit access to servers that do not publish online.
 */

namespace APP\security\authorization;

use APP\core\Application;
use APP\core\Request;
use PKP\security\authorization\AuthorizationPolicy;
use PKP\security\Role;

class OpsServerMustPublishPolicy extends AuthorizationPolicy
{
    public $_context;

    /**
     * Constructor
     *
     * @param Request $request
     */
    public function __construct($request)
    {
        parent::__construct('user.authorization.serverDoesNotPublish');
        $this->_context = $request->getContext();
    }

    //
    // Implement template methods from AuthorizationPolicy
    //
    public function effect(): int
    {
        if (!$this->_context) {
            return AuthorizationPolicy::AUTHORIZATION_DENY;
        }

        // Certain roles are allowed to see unpublished content.
        $userRoles = (array) $this->getAuthorizedContextObject(Application::ASSOC_TYPE_USER_ROLES);
        if (count(array_intersect(
            $userRoles,
            [
                Role::ROLE_ID_MANAGER,
                Role::ROLE_ID_SITE_ADMIN,
                Role::ROLE_ID_ASSISTANT,
                Role::ROLE_ID_SUB_EDITOR,
            ]
        )) > 0) {
            return AuthorizationPolicy::AUTHORIZATION_PERMIT;
        }

        if ($this->_context->getData('publishingMode') == \APP\server\Server::PUBLISHING_MODE_NONE) {
            return AuthorizationPolicy::AUTHORIZATION_DENY;
        }

        return AuthorizationPolicy::AUTHORIZATION_PERMIT;
    }
}
