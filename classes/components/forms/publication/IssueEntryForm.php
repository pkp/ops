<?php

/**
 * @file classes/components/form/publication/IssueEntryForm.php
 *
 * Copyright (c) 2014-2021 Simon Fraser University
 * Copyright (c) 2000-2021 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class IssueEntryForm
 *
 * @ingroup classes_controllers_form
 *
 * @brief A preset form for setting a publication's section, categories etc.
 */

namespace APP\components\forms\publication;

use APP\facades\Repo;
use APP\publication\Publication;
use APP\server\Server;
use PKP\components\forms\FieldOptions;
use PKP\components\forms\FieldSelect;
use PKP\components\forms\FieldText;
use PKP\components\forms\FieldUploadImage;
use PKP\components\forms\FormComponent;

class IssueEntryForm extends FormComponent
{
    public const FORM_ISSUE_ENTRY = 'issueEntry';
    public $id = self::FORM_ISSUE_ENTRY;
    public $method = 'PUT';

    /**
     * Constructor
     *
     * @param string $action URL to submit the form to
     * @param array $locales Supported locales
     * @param Publication $publication The publication to change settings for
     * @param Server $publicationContext The context of the publication
     * @param string $baseUrl Site's base URL. Used for image previews.
     * @param string $temporaryFileApiUrl URL to upload files to
     */
    public function __construct($action, $locales, $publication, $publicationContext, $baseUrl, $temporaryFileApiUrl)
    {
        $this->action = $action;
        $this->locales = $locales;

        // Section options
        $sections = Repo::section()->getSectionList($publicationContext->getId());
        $sectionOptions = [];
        foreach ($sections as $section) {
            $sectionOptions[] = [
                'label' => (($section['group']) ? __('publication.inactiveSection', ['section' => $section['title']]) : $section['title']),
                'value' => (int) $section['id'],
            ];
        }
        $this->addField(new FieldSelect('sectionId', [
            'label' => __('section.section'),
            'options' => $sectionOptions,
            'value' => (int) $publication->getData('sectionId'),
        ]));

        // Categories
        $categoryOptions = [];
        $categories = Repo::category()->getCollector()
            ->filterByContextIds([$publicationContext->getId()])
            ->getMany();

        $categoriesBreadcrumb = Repo::category()->getBreadcrumbs($categories);
        foreach ($categoriesBreadcrumb as $categoryId => $breadcrumb) {
            $categoryOptions[] = [
                'value' => $categoryId,
                'label' => $breadcrumb,
            ];
        }

        $hasAllBreadcrumbs = count($categories) === $categoriesBreadcrumb->count();
        if (!empty($categoryOptions)) {
            $this->addField(new FieldOptions('categoryIds', [
                'label' => __('submission.submit.placement.categories'),
                'value' => (array) $publication->getData('categoryIds'),
                'description' => $hasAllBreadcrumbs ? '' : __('submission.categories.circularReferenceWarning'),
                'options' => $categoryOptions,
            ]));
        }

        $this->addField(new FieldUploadImage('coverImage', [
            'label' => __('editor.preprint.coverImage'),
            'value' => $publication->getData('coverImage'),
            'isMultilingual' => true,
            'baseUrl' => $baseUrl,
            'options' => [
                'url' => $temporaryFileApiUrl,
            ],
        ]))
            ->addField(new FieldText('urlPath', [
                'label' => __('publication.urlPath'),
                'description' => __('publication.urlPath.description'),
                'value' => $publication->getData('urlPath'),
            ]))
            ->addField(new FieldText('datePublished', [
                'label' => __('publication.datePublished'),
                'description' => __('publication.datePublished.description'),
                'value' => $publication->getData('datePublished'),
                'size' => 'small',
            ]));
    }
}
