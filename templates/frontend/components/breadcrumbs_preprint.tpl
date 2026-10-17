{**
 * templates/frontend/components/breadcrumbs_preprint.tpl
 *
 * Copyright (c) 2014-2021 Simon Fraser University
 * Copyright (c) 2003-2021 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @brief Display a breadcrumb nav item showing the current page. This basic
 *  version is for top-level pages which only need to show the Home link. For
 *  category- and series-specific breadcrumb generation, see
 *  templates/frontend/components/breadcrumbs_catalog.tpl.
 *
 * @uses $currentTitle string The title to use for the current page.
 * @uses $currentTitleKey string Translation key for title of current page.
 *}
{assign var=preprintPath value=$preprint->getBestId()}
<nav class="cmp_breadcrumbs" aria-label="{translate key="navigation.breadcrumbLabel"}">
	<ol>
		<li>
			<a href="{url page="index" router=PKPApplication::ROUTE_PAGE}">
				{translate key="common.homepageNavigationLabel"}
			</a>
			<span class="separator" aria-hidden="true">{translate key="navigation.breadcrumbSeparator"}</span>
		</li>
		<li class="current" aria-current="page">
			<a aria-current="page" id="preprint-{$preprint->getId()}" {if $server}href="{url server=$server->getPath() page="preprint" op="view" path=$preprintPath}"{else}href="{url page="preprint" op="view" path=$preprintPath}"{/if}>
				{assign var=publication value=$preprint->getCurrentPublication()}
				{$publication->getLocalizedTitle(null, 'html')|strip_unsafe_html}
				{if $currentTitleKey}
					{translate key=$currentTitleKey}
				{else}
					{$publication->getLocalizedSubtitle(null, 'html')|strip_unsafe_html}
				{/if}
			</a>
		</li>
	</ol>
</nav>
