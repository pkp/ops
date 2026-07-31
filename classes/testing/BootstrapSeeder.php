<?php

/**
 * @file classes/testing/BootstrapSeeder.php
 *
 * Copyright (c) 2026 Simon Fraser University
 * Copyright (c) 2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class BootstrapSeeder
 *
 * @brief OPS base seed: sections (abbrev + path — OPS sections carry both).
 */

namespace APP\testing;

use APP\facades\Repo;
use PKP\context\Context;
use PKP\testing\PKPBootstrapSeeder;
use PKP\testing\Spec;

class BootstrapSeeder extends PKPBootstrapSeeder
{
    protected function structureKey(): string
    {
        return 'sections';
    }

    protected function parseStructure(Spec $spec): array
    {
        return [
            'abbrev' => (string) $spec->require('abbrev'),
            'path' => $spec->get('path'),
            'title' => $spec->get('title'),
            'policy' => $spec->get('policy'),
        ];
    }

    protected function addStructure(Context $context, array $plan, int $sequence): int
    {
        return self::addSection($context, $plan, $sequence);
    }

    protected function resolveStructureId(Context $context, string $identifier): ?int
    {
        return self::findSectionId($context, $identifier);
    }

    public static function addSection(Context $context, array $plan, int $sequence): int
    {
        $locale = $context->getPrimaryLocale();
        $localize = fn ($value, $default = null) => is_array($value) ? $value : [$locale => $value ?? $default];

        // The Context::add hook already created the default "Preprints"
        // section; the FIRST declared section renames/updates it instead of
        // seeding a same-abbrev duplicate.
        if ($sequence === 1) {
            $existing = Repo::section()->getCollector()
                ->filterByContextIds([$context->getId()])
                ->getMany();
            if ($existing->count() === 1) {
                $params = [
                    'title' => $localize($plan['title'], $plan['abbrev']),
                    'abbrev' => $localize($plan['abbrev']),
                    'path' => $plan['path'] ?? strtolower($plan['abbrev']),
                ];
                if (($plan['policy'] ?? null) !== null) {
                    $params['policy'] = $localize($plan['policy']);
                }
                $defaultSection = $existing->first();
                Repo::section()->edit($defaultSection, $params);
                return $defaultSection->getId();
            }
        }

        $section = Repo::section()->newDataObject();
        $section->setData('contextId', $context->getId());
        $section->setData('sequence', $sequence);
        $section->setData('editorRestricted', false);
        $section->setData('metaIndexed', true);
        $section->setData('path', $plan['path'] ?? strtolower($plan['abbrev']));
        foreach ($localize($plan['title'], $plan['abbrev']) as $l => $value) {
            $section->setData('title', $value, $l);
        }
        foreach ($localize($plan['abbrev']) as $l => $value) {
            $section->setData('abbrev', $value, $l);
        }
        if (($plan['policy'] ?? null) !== null) {
            foreach ($localize($plan['policy']) as $l => $value) {
                $section->setData('policy', $value, $l);
            }
        }
        return Repo::section()->add($section);
    }

    /** Match a section by abbrev (any locale) or path, case-insensitively. */
    public static function findSectionId(Context $context, string $identifier): ?int
    {
        $sections = Repo::section()->getCollector()
            ->filterByContextIds([$context->getId()])
            ->getMany();
        foreach ($sections as $section) {
            if (strcasecmp((string) $section->getData('path'), $identifier) === 0) {
                return $section->getId();
            }
            foreach ((array) ($section->getData('abbrev') ?? []) as $abbrev) {
                if (strcasecmp((string) $abbrev, $identifier) === 0) {
                    return $section->getId();
                }
            }
        }
        return null;
    }
}
