<?php
/**
 * @file pages/dashboard/DashboardHandlerNext.php
 *
 * Copyright (c) 2014-2021 Simon Fraser University
 * Copyright (c) 2003-2021 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class DashboardHandlerNext
 *
 * @ingroup pages_dashboard
 *
 * @brief Handle requests for user's dashboard.
 */

namespace APP\pages\dashboard;

use APP\components\forms\dashboard\SubmissionFilters;
use APP\core\Request;
use APP\facades\Repo;
use APP\template\TemplateManager;
use PKP\pages\dashboard\PKPDashboardHandlerNext;

class DashboardHandlerNext extends PKPDashboardHandlerNext
{
    /**
     * Setup variables for the template
     *
     * @param Request $request
     */
    public function setupIndex($request)
    {
        parent::setupIndex($request);

        $templateMgr = TemplateManager::getManager($request);

        $relationForm = new \APP\components\forms\publication\RelationForm('emit');

        $pageInitConfig = $templateMgr->getState('pageInitConfig');
        $pageInitConfig['componentForms']['relationForm'] = $relationForm->getConfig();
        $templateMgr->setState(['pageInitConfig' => $pageInitConfig]);

        $templateMgr->assign([
            'pageComponent' => 'Page',
        ]);

        $templateMgr->setConstants([

        ]);
    }


    protected function getSubmissionFiltersForm($userRoles, $context)
    {

        $sections = Repo::section()
            ->getCollector()
            ->filterByContextIds([$context->getId()])
            ->getMany();

        $categories = Repo::category()
            ->getCollector()
            ->filterByContextIds([$context->getId()])
            ->getMany();

        return new SubmissionFilters(
            $context,
            $userRoles,
            $sections,
            $categories
        );
    }


}
