<?php

/**
 * @file api/v1/_test/ServerScenarioController.php
 *
 * Copyright (c) 2023-2026 Simon Fraser University
 * Copyright (c) 2023-2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class ServerScenarioController
 *
 * @ingroup api_v1__test
 *
 * @brief OPS overlay for the shared context scenario endpoint.
 *
 * The app-neutral spec knows about a "context"; this subclass declares the OPS
 * concepts on top of it as OVERLAY PROPERTIES, so a spec that names them is
 * validated here and rejected as an unknown key on an app that has no such
 * concept — and, symmetrically, an OJS `issues` or an OMP `series` block sent to
 * OPS is rejected rather than silently dropped.
 *
 * What OPS declares and what it deliberately does not:
 *
 *   sections               — OPS keeps sections (APP-GLOSSARY §1: "section
 *                            (unchanged)"). Creating a server already makes one,
 *                            titled "Preprints"/PRE, so a spec naming PRE edits
 *                            that one rather than leaving a duplicate behind.
 *   enableAuthorScreening  — OPS-only. Whether posting is moderated before it
 *   postedAcknowledgement    reaches the public site, and whether the author is
 *                            told when it does. The base seed states both, since
 *                            a server that leaves its moderation posture
 *                            implicit is a half-configured fixture.
 *   issues                 — NOT declared. OPS posts continuously.
 *   galleys                — OPS HAS galleys, but they are not step-2 schema in
 *                            any app; the key is undeclared everywhere.
 *   publishingMode / ISSNs — NOT declared. No subscriptions, no issue-level
 *                            access model.
 */

namespace APP\API\v1\_test;

use APP\core\Application;
use APP\facades\Repo;
use PKP\API\v1\_test\PKPContextScenarioController;
use PKP\context\Context;
use PKP\context\SubEditorsDAO;
use PKP\db\DAORegistry;
use PKP\security\Role;
use PKP\testing\scenario\ScenarioException;
use PKP\user\User;
use PKP\userGroup\UserGroup;

class ServerScenarioController extends PKPContextScenarioController
{
    /**
     * @copydoc \PKP\API\v1\_test\PKPTestApiController::schemaOverlayProperties()
     */
    public function schemaOverlayProperties(): array
    {
        return [
            'sections' => [
                'type' => 'array',
                'description' => 'OPS overlay. Sections of the preprint server, matched to existing sections by abbrev so the default section created with the server is edited rather than duplicated.',
                'items' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['title', 'abbrev'],
                    'properties' => [
                        'title' => ['type' => 'string', 'minLength' => 1],
                        'abbrev' => ['type' => 'string', 'minLength' => 1],
                        'path' => ['type' => 'string', 'minLength' => 1],
                        'description' => ['type' => 'string'],
                        'policy' => ['type' => 'string'],
                        'editorRestricted' => ['type' => 'boolean'],
                        'abstractsNotRequired' => ['type' => 'boolean'],
                        'wordCount' => ['type' => 'integer'],
                        'identifyType' => ['type' => 'string'],
                    ],
                ],
            ],
            'enableAuthorScreening' => [
                'type' => 'boolean',
                'description' => 'OPS overlay. Whether author screening (moderation before posting) is on.',
            ],
            'postedAcknowledgement' => [
                'type' => 'boolean',
                'description' => 'OPS overlay. Whether the authors are emailed when the first version of their preprint is posted.',
            ],
        ];
    }

    /**
     * @copydoc \PKP\API\v1\_test\PKPTestApiController::userSchemaOverlayProperties()
     */
    public function userSchemaOverlayProperties(): array
    {
        return [
            'sections' => [
                'type' => 'array',
                'description' => 'OPS overlay. Abbreviations of the sections this user moderates, as the Sections settings form assigns section editors. The user must already be enrolled in an editorially assignable role.',
                'items' => ['type' => 'string', 'minLength' => 1],
            ],
        ];
    }

    /**
     * Assign a seeded user as a section editor (an OPS Moderator) of the sections
     * it names.
     *
     * Mirrors PKPSectionForm::execute(): the assignment is a row in
     * subeditor_submission_group keyed by the user group it was made under, and
     * only users enrolled in an assignable role may be assigned.
     *
     * This is not cosmetic on OPS. `SubEditorsDAO::assignEditors()` — run by the
     * AssignEditors listener when a submission is submitted — is what puts a
     * moderator on the submission's participant list, and a moderator holds
     * ROLE_ID_SUB_EDITOR, so an unassigned moderator sees nothing in the
     * editorial dashboard. The seeded assignment is what makes a seeded preprint
     * visible to the same people a real one would be visible to.
     *
     * @throws ScenarioException
     */
    protected function afterUserSeeded(Context $context, array $userSpec, User $user, string $specKey): void
    {
        $abbrevs = $userSpec['sections'] ?? [];

        if (empty($abbrevs)) {
            return;
        }

        $locale = $context->getPrimaryLocale();
        $sections = Repo::section()->getCollector()->filterByContextIds([$context->getId()])->getMany();
        $group = $this->assignableUserGroupFor($context, $user, "{$specKey}.sections");
        /** @var SubEditorsDAO $subEditorsDao */
        $subEditorsDao = DAORegistry::getDAO('SubEditorsDAO');

        foreach (array_values($abbrevs) as $index => $abbrev) {
            $section = $sections->first(fn ($section) => $section->getAbbrev($locale) === $abbrev);

            if (!$section) {
                throw new ScenarioException(
                    "Context '{$context->getPath()}' has no section with abbreviation '{$abbrev}'. Available: "
                        . $sections->map(fn ($section) => $section->getAbbrev($locale))->filter()->join(', ') . '.',
                    "{$specKey}.sections.{$index}"
                );
            }

            $assigned = $subEditorsDao
                ->getBySubmissionGroupIds([$section->getId()], Application::ASSOC_TYPE_SECTION, $context->getId())
                ->contains(fn ($row) => (int) $row->userId === $user->getId());

            if ($assigned) {
                continue;
            }

            $subEditorsDao->insertEditor(
                $context->getId(),
                $section->getId(),
                $user->getId(),
                Application::ASSOC_TYPE_SECTION,
                $group->id
            );
        }
    }

    /**
     * The user group a section assignment is recorded under.
     *
     * The Sections form offers only groups in PKPSectionForm::$assignableRoles and
     * stores the assignment against one of them; the sub-editor slot — which on
     * OPS is the Moderator group — is the natural one, with manager and assistant
     * groups as the fallbacks the form also offers. A user with none of those
     * roles is a spec error, not a silent skip.
     *
     * @throws ScenarioException
     */
    protected function assignableUserGroupFor(Context $context, User $user, string $specKey): UserGroup
    {
        $preference = [Role::ROLE_ID_SUB_EDITOR, Role::ROLE_ID_MANAGER, Role::ROLE_ID_ASSISTANT];

        $group = UserGroup::withContextIds([$context->getId()])
            ->withUserIds([$user->getId()])
            ->withRoleIds($preference)
            ->get()
            ->sortBy(fn (UserGroup $group) => array_search($group->roleId, $preference))
            ->first();

        if (!$group) {
            throw new ScenarioException(
                "User '{$user->getUsername()}' cannot be assigned to a section: it is not enrolled in any "
                    . 'editorially assignable role (moderator, manager or assistant) in context '
                    . "'{$context->getPath()}'.",
                $specKey
            );
        }

        return $group;
    }

    /**
     * @copydoc \PKP\API\v1\_test\PKPContextScenarioController::nonSettingOverlayKeys()
     */
    protected function nonSettingOverlayKeys(): array
    {
        return ['sections'];
    }

    /**
     * @copydoc \PKP\API\v1\_test\PKPContextScenarioController::afterContextCreated()
     */
    protected function afterContextCreated(Context $context, array $spec, string $specKeyPrefix): void
    {
        $key = fn (string $name) => $specKeyPrefix === '' ? $name : "{$specKeyPrefix}.{$name}";

        $this->seededSectionIds = $this->seedSections($context, $spec['sections'] ?? [], $key('sections'));
    }

    /** @var array<string, int> abbrev => sectionId */
    protected array $seededSectionIds = [];

    /**
     * @copydoc \PKP\API\v1\_test\PKPContextScenarioController::contextEcho()
     */
    protected function contextEcho(Context $context, array $spec): array
    {
        return array_filter([
            'sections' => $this->seededSectionIds,
        ]);
    }

    /**
     * Seed sections, editing the default section the server was created with when
     * its abbreviation matches — the same thing a moderator does rather than
     * leaving a stray second section behind.
     *
     * OPS sections carry a `path` (they are addressable on the reader side), so
     * one is derived from the abbreviation when the spec does not name it.
     *
     * @return array<string, int> abbrev => sectionId
     */
    protected function seedSections(Context $context, array $sectionSpecs, string $specKeyPrefix): array
    {
        if (empty($sectionSpecs)) {
            return [];
        }

        $locale = $context->getPrimaryLocale();
        $existing = Repo::section()->getCollector()->filterByContextIds([$context->getId()])->getMany();
        $ids = [];

        foreach (array_values($sectionSpecs) as $index => $sectionSpec) {
            $abbrev = $sectionSpec['abbrev'];
            $match = $existing->first(fn ($section) => $section->getAbbrev($locale) === $abbrev);

            $props = [
                'title' => [$locale => $sectionSpec['title']],
                'abbrev' => [$locale => $abbrev],
                'policy' => [$locale => $sectionSpec['policy'] ?? ''],
                'path' => $sectionSpec['path'] ?? $this->slug($abbrev),
                'editorRestricted' => (bool) ($sectionSpec['editorRestricted'] ?? false),
                'abstractsNotRequired' => (bool) ($sectionSpec['abstractsNotRequired'] ?? false),
                'wordCount' => (int) ($sectionSpec['wordCount'] ?? 0),
                'metaIndexed' => true,
                'metaReviewed' => true,
                'hideTitle' => false,
            ];

            if (isset($sectionSpec['description'])) {
                $props['description'] = [$locale => $sectionSpec['description']];
            }

            if (isset($sectionSpec['identifyType'])) {
                $props['identifyType'] = [$locale => $sectionSpec['identifyType']];
            }

            if ($match) {
                Repo::section()->edit($match, $props);
                $ids[$abbrev] = $match->getId();

                continue;
            }

            $section = Repo::section()->newDataObject($props);
            $section->setContextId($context->getId());
            $section->setSequence(REALLY_BIG_NUMBER);
            $ids[$abbrev] = Repo::section()->add($section);
        }

        return $ids;
    }
}
