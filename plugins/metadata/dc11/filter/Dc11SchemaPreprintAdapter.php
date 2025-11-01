<?php

/**
 * @file plugins/metadata/dc11/filter/Dc11SchemaPreprintAdapter.php
 *
 * Copyright (c) 2014-2022 Simon Fraser University
 * Copyright (c) 2000-2022 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class Dc11SchemaPreprintAdapter
 *
 * @ingroup plugins_metadata_dc11_filter
 *
 * @see Preprint
 * @see PKPDc11Schema
 *
 * @brief Abstract base class for meta-data adapters that
 *  injects/extracts Dublin Core schema compliant meta-data into/from
 *  a Submission object.
 */

namespace APP\plugins\metadata\dc11\filter;

use APP\core\Application;
use APP\facades\Repo;
use APP\oai\ops\OAIDAO;
use APP\plugins\PubIdPlugin;
use APP\submission\Submission;
use PKP\db\DAORegistry;
use PKP\metadata\MetadataDataObjectAdapter;
use PKP\metadata\MetadataDescription;
use PKP\plugins\Hook;
use PKP\plugins\PluginRegistry;

class Dc11SchemaPreprintAdapter extends MetadataDataObjectAdapter
{
    //
    // Implement template methods from MetadataDataObjectAdapter
    //
    /**
     * @see MetadataDataObjectAdapter::injectMetadataIntoDataObject()
     *
     * @param MetadataDescription $metadataDescription
     * @param Submission $targetDataObject
     */
    public function &injectMetadataIntoDataObject(&$metadataDescription, &$targetDataObject)
    {
        // Not implemented
        assert(false);
    }

    /**
     * @see MetadataDataObjectAdapter::extractMetadataFromDataObject()
     *
     * @param Submission $submission
     *
     * @return MetadataDescription
     *
     * @hook Dc11SchemaPreprintAdapter::extractMetadataFromDataObject [[$this, $submission, $server, &$dc11Description]]
     */
    public function &extractMetadataFromDataObject(&$submission)
    {
        assert($submission instanceof Submission);

        // Retrieve data that belongs to the submission.
        // FIXME: Retrieve this data from the respective entity DAOs rather than
        // from the OAIDAO once we've migrated all OAI providers to the
        // meta-data framework. We're using the OAIDAO here because it
        // contains cached entities and avoids extra database access if this
        // adapter is called from an OAI context.
        $oaiDao = DAORegistry::getDAO('OAIDAO'); /** @var OAIDAO $oaiDao */
        $server = $oaiDao->getServer($submission->getData('contextId'));
        $section = $oaiDao->getSection($submission->getSectionId());

        $publication = $submission->getCurrentPublication();

        $dc11Description = $this->instantiateMetadataDescription();

        // Title
        $this->_addLocalizedElements($dc11Description, 'dc:title', $publication->getFullTitles());

        // Creator
        foreach ($publication->getData('authors') as $author) {
            $this->_addLocalizedElements($dc11Description, 'dc:creator', $author->getFullNames(false, true));
        }

        // Subject
        $subjects = array_merge_recursive(
            collect($publication->getData('keywords'))
                ->map(
                    fn (array $items): array => collect($items)
                        ->pluck('name')
                        ->all()
                )
                ->all(),
            collect($publication->getData('subjects'))
                ->map(
                    fn (array $items): array => collect($items)
                        ->pluck('name')
                        ->all()
                )
                ->all()
        );
        $this->_addLocalizedElements($dc11Description, 'dc:subject', $subjects);

        // Description
        $this->_addLocalizedElements($dc11Description, 'dc:description', $publication->getData('abstract'));

        // Publisher
        $publisherInstitution = $server->getData('publisherInstitution');
        if (!empty($publisherInstitution)) {
            $publishers = [$server->getPrimaryLocale() => $publisherInstitution];
        } else {
            $publishers = $server->getName(null); // Default
        }
        $this->_addLocalizedElements($dc11Description, 'dc:publisher', $publishers);

        // Contributor
        $contributors = (array) $publication->getData('sponsor');
        foreach ($contributors as $locale => $contributor) {
            $contributors[$locale] = array_map(trim(...), explode(';', $contributor));
        }
        $this->_addLocalizedElements($dc11Description, 'dc:contributor', $contributors);


        // Date
        if ($datePublished = $submission->getCurrentPublication()->getData('datePublished')) {
            $dc11Description->addStatement('dc:date', date('Y-m-d', strtotime($datePublished)));
        }

        // Type
        $driverType = 'info:eu-repo/semantics/preprint';
        $dc11Description->addStatement('dc:type', $driverType, MetadataDescription::METADATA_DESCRIPTION_UNKNOWN_LOCALE);
        $driverVersion = 'info:eu-repo/semantics/draft';
        $dc11Description->addStatement('dc:type', $driverVersion, MetadataDescription::METADATA_DESCRIPTION_UNKNOWN_LOCALE);

        $galleys = Repo::galley()->getCollector()
            ->filterByPublicationIds([$publication->getId()])
            ->getMany();

        // Format
        foreach ($galleys as $galley) {
            $dc11Description->addStatement('dc:format', $galley->getFileType());
        }

        // Identifier: URL
        $request = Application::get()->getRequest();
        $includeUrls = $server->getSetting('publishingMode') != \APP\server\Server::PUBLISHING_MODE_NONE;
        $dc11Description->addStatement('dc:identifier', $request->getDispatcher()->url($request, Application::ROUTE_PAGE, $server->getPath(), 'preprint', 'view', [$submission->getBestId()], urlLocaleForPage: ''));

        // Language
        collect($galleys)
            ->map(fn ($g) => $g->getData('locale'))
            ->push($publication->getData('locale'))
            ->filter()
            ->unique()
            ->each(fn ($l) => $dc11Description->addStatement('dc:language', $l));

        // Relation
        // full text URLs
        if ($includeUrls) {
            foreach ($galleys as $galley) {
                $relation = $request->getDispatcher()->url($request, Application::ROUTE_PAGE, $server->getPath(), 'preprint', 'view', [$submission->getBestId(), $galley->getBestGalleyId()], urlLocaleForPage: '');
                $dc11Description->addStatement('dc:relation', $relation);
            }
        }

        // Public identifiers
        $publicIdentifiers = array_map(fn (PubIdPlugin $plugin) => $plugin->getPubIdType(), (array) PluginRegistry::loadCategory('pubIds', true, $submission->getId()));
        if ($server->areDoisEnabled()) {
            $publicIdentifiers[] = 'doi';
        }
        foreach ($publicIdentifiers as $publicIdentifier) {
            if ($pubPreprintId = $submission->getStoredPubId($publicIdentifier)) {
                $dc11Description->addStatement('dc:identifier', $pubPreprintId);
            }
            foreach ($galleys as $galley) {
                if ($pubGalleyId = $galley->getStoredPubId($publicIdentifier)) {
                    $dc11Description->addStatement('dc:relation', $pubGalleyId);
                }
            }
        }

        // Coverage
        $this->_addLocalizedElements($dc11Description, 'dc:coverage', (array) $publication->getData('coverage'));

        // Rights: Add both copyright statement and license
        $copyrightHolder = $publication->getLocalizedData('copyrightHolder');
        $copyrightYear = $publication->getData('copyrightYear');
        if (!empty($copyrightHolder) && !empty($copyrightYear)) {
            $dc11Description->addStatement('dc:rights', __('submission.copyrightStatement', ['copyrightHolder' => $copyrightHolder, 'copyrightYear' => $copyrightYear]));
        }
        if ($licenseUrl = $publication->getData('licenseUrl')) {
            $dc11Description->addStatement('dc:rights', $licenseUrl);
        }

        Hook::call('Dc11SchemaPreprintAdapter::extractMetadataFromDataObject', [$this, $submission, $server, &$dc11Description]);

        return $dc11Description;
    }

    /**
     * @see MetadataDataObjectAdapter::getDataObjectMetadataFieldNames()
     *
     * @param bool $translated
     */
    public function getDataObjectMetadataFieldNames($translated = true)
    {
        // All DC fields are mapped.
        return [];
    }


    //
    // Private helper methods
    //
    /**
     * Add an array of localized values to the given description.
     *
     * @param MetadataDescription $description
     * @param string $propertyName
     * @param array $localizedValues
     */
    public function _addLocalizedElements(&$description, $propertyName, $localizedValues)
    {
        foreach (stripAssocArray((array) $localizedValues) as $locale => $values) {
            if (is_scalar($values)) {
                $values = [$values];
            }
            foreach ($values as $value) {
                if (!empty($value)) {
                    $description->addStatement($propertyName, $value, $locale);
                }
            }
        }
    }
}
