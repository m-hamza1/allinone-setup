<?php

namespace App\Support;

class PermissionCatalog
{
    /**
     * Chatwoot-style permission keys available for custom roles.
     *
     * @return array<int, array{key: string, label: string, group: string}>
     */
    public static function definitions(): array
    {
        return [
            ['key' => 'conversation_manage', 'label' => 'Manage conversations', 'group' => 'inbox'],
            ['key' => 'conversation_unassigned_manage', 'label' => 'Manage unassigned conversations', 'group' => 'inbox'],
            ['key' => 'contact_manage', 'label' => 'Manage contacts', 'group' => 'crm'],
            ['key' => 'report_manage', 'label' => 'View reports', 'group' => 'analytics'],
            ['key' => 'label_manage', 'label' => 'Manage labels', 'group' => 'settings'],
            ['key' => 'canned_response_manage', 'label' => 'Manage canned responses', 'group' => 'settings'],
            ['key' => 'automation_manage', 'label' => 'Manage automations', 'group' => 'settings'],
            ['key' => 'campaign_manage', 'label' => 'Manage campaigns', 'group' => 'growth'],
            ['key' => 'knowledge_base_manage', 'label' => 'Manage help center', 'group' => 'growth'],
            ['key' => 'inbox_manage', 'label' => 'Manage inboxes & channels', 'group' => 'admin'],
            ['key' => 'team_manage', 'label' => 'Manage team members', 'group' => 'admin'],
            ['key' => 'integration_manage', 'label' => 'Manage integrations', 'group' => 'admin'],
            ['key' => 'role_manage', 'label' => 'Manage custom roles', 'group' => 'admin'],
        ];
    }

    /**
     * @return list<string>
     */
    public static function keys(): array
    {
        return array_column(self::definitions(), 'key');
    }

    /**
     * Default permissions for staff without a custom role.
     *
     * @return list<string>
     */
    public static function staffDefaults(): array
    {
        return [
            'conversation_manage',
            'conversation_unassigned_manage',
            'contact_manage',
            'label_manage',
            'canned_response_manage',
            'report_manage',
        ];
    }
}
