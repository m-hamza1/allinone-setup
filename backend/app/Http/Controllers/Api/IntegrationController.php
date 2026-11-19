<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Models\User;
use App\Services\IntegrationDispatcher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class IntegrationController extends Controller
{
    /**
     * @var array<int, array{
     *   key: string,
     *   name: string,
     *   category: string,
     *   description: string,
     *   fields: array<int, array{key: string, label: string, type?: string, placeholder?: string, optional?: bool}>
     * }>
     */
    private const CATALOG = [
        [
            'key' => 'slack',
            'name' => 'Slack',
            'category' => 'collaboration',
            'description' => 'Post conversation alerts and agent mentions into a Slack channel.',
            'fields' => [
                ['key' => 'webhook_url', 'label' => 'Incoming webhook URL', 'placeholder' => 'https://hooks.slack.com/services/…', 'type' => 'password'],
                ['key' => 'channel', 'label' => 'Default channel', 'placeholder' => '#support', 'optional' => true],
            ],
        ],
        [
            'key' => 'dialogflow',
            'name' => 'Dialogflow',
            'category' => 'bot',
            'description' => 'Route inbound messages to a Dialogflow CX / ES agent.',
            'fields' => [
                ['key' => 'project_id', 'label' => 'Project ID', 'placeholder' => 'my-gcp-project'],
                ['key' => 'language_code', 'label' => 'Language code', 'placeholder' => 'en', 'optional' => true],
                ['key' => 'credentials_json', 'label' => 'Service account JSON', 'placeholder' => '{ "type": "service_account", … }', 'type' => 'textarea'],
            ],
        ],
        [
            'key' => 'openai',
            'name' => 'OpenAI',
            'category' => 'ai',
            'description' => 'Use GPT for suggested replies and agent assist.',
            'fields' => [
                ['key' => 'api_key', 'label' => 'API key', 'placeholder' => 'sk-…', 'type' => 'password'],
                ['key' => 'model', 'label' => 'Model', 'placeholder' => 'gpt-4o-mini', 'optional' => true],
            ],
        ],
        [
            'key' => 'google_translate',
            'name' => 'Google Translate',
            'category' => 'ai',
            'description' => 'Auto-translate customer messages for agents.',
            'fields' => [
                ['key' => 'api_key', 'label' => 'API key', 'placeholder' => 'AIza…', 'type' => 'password'],
                ['key' => 'default_target', 'label' => 'Default target language', 'placeholder' => 'en', 'optional' => true],
            ],
        ],
        [
            'key' => 'webhooks',
            'name' => 'Webhooks',
            'category' => 'developer',
            'description' => 'Send conversation events to your own HTTP endpoint.',
            'fields' => [
                ['key' => 'url', 'label' => 'Endpoint URL', 'placeholder' => 'https://example.com/hooks/allin'],
                ['key' => 'secret', 'label' => 'Signing secret', 'placeholder' => 'whsec_…', 'type' => 'password', 'optional' => true],
            ],
        ],
        [
            'key' => 'linear',
            'name' => 'Linear',
            'category' => 'ticketing',
            'description' => 'Create Linear issues from conversations.',
            'fields' => [
                ['key' => 'api_key', 'label' => 'API key', 'placeholder' => 'lin_api_…', 'type' => 'password'],
                ['key' => 'team_id', 'label' => 'Team ID', 'placeholder' => 'TEAM-…'],
            ],
        ],
        [
            'key' => 'shopify',
            'name' => 'Shopify',
            'category' => 'ecommerce',
            'description' => 'Look up customer orders inside the inbox.',
            'fields' => [
                ['key' => 'shop_domain', 'label' => 'Shop domain', 'placeholder' => 'store.myshopify.com'],
                ['key' => 'access_token', 'label' => 'Admin API access token', 'placeholder' => 'shpat_…', 'type' => 'password'],
            ],
        ],
        [
            'key' => 'dyte',
            'name' => 'Dyte',
            'category' => 'video',
            'description' => 'Start video calls with customers from a conversation.',
            'fields' => [
                ['key' => 'organization_id', 'label' => 'Organization ID', 'placeholder' => 'org_…'],
                ['key' => 'api_key', 'label' => 'API key', 'placeholder' => '••••••••', 'type' => 'password'],
            ],
        ],
    ];

    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin() || $user->canPermission('integration_manage'), 403);

        $account = Account::query()->findOrFail($user->account_id);
        $settingsIntegrations = $account->settings['integrations'] ?? [];

        $data = collect(self::CATALOG)->map(function (array $item) use ($settingsIntegrations) {
            $stored = $settingsIntegrations[$item['key']] ?? [];
            $credentials = is_array($stored['credentials'] ?? null) ? $stored['credentials'] : [];
            $enabled = (bool) ($stored['enabled'] ?? false);
            $configured = $credentials !== [];

            return [
                'key' => $item['key'],
                'name' => $item['name'],
                'category' => $item['category'],
                'description' => $item['description'],
                'fields' => $item['fields'],
                'enabled' => $enabled,
                'status' => $enabled ? ($configured ? 'connected' : 'enabled') : ($configured ? 'configured' : 'disconnected'),
                'has_credentials' => $configured,
                'credentials' => $credentials,
            ];
        });

        return response()->json(['data' => $data]);
    }

    public function update(Request $request, string $key): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin() || $user->canPermission('integration_manage'), 403);

        $definition = collect(self::CATALOG)->firstWhere('key', $key);
        abort_unless($definition, 404, 'Unknown integration');

        $data = $request->validate([
            'enabled' => ['sometimes', 'boolean'],
            'credentials' => ['nullable', 'array'],
        ]);

        $account = Account::query()->findOrFail($user->account_id);
        $settings = $account->settings ?? [];
        $integrations = $settings['integrations'] ?? [];

        $existing = $integrations[$key] ?? [];
        if (array_key_exists('enabled', $data)) {
            $existing['enabled'] = $data['enabled'];
        }
        if (array_key_exists('credentials', $data)) {
            $allowed = collect($definition['fields'])->pluck('key')->all();
            $incoming = $data['credentials'] ?? [];
            $filtered = [];
            foreach ($allowed as $fieldKey) {
                if (array_key_exists($fieldKey, $incoming) && $incoming[$fieldKey] !== null && $incoming[$fieldKey] !== '') {
                    $filtered[$fieldKey] = $incoming[$fieldKey];
                }
            }
            // Merge so clearing a field is intentional (empty string omitted keeps previous)
            $existing['credentials'] = array_merge($existing['credentials'] ?? [], $filtered);
            foreach ($allowed as $fieldKey) {
                if (array_key_exists($fieldKey, $incoming) && ($incoming[$fieldKey] === null || $incoming[$fieldKey] === '')) {
                    unset($existing['credentials'][$fieldKey]);
                }
            }
        }

        $integrations[$key] = $existing;
        $settings['integrations'] = $integrations;
        $account->update(['settings' => $settings]);

        return response()->json([
            'data' => [
                'key' => $key,
                'enabled' => (bool) ($existing['enabled'] ?? false),
                'credentials' => $existing['credentials'] ?? new \stdClass,
                'status' => ! empty($existing['enabled']) ? 'connected' : 'disconnected',
            ],
        ]);
    }

    public function test(Request $request, string $key, IntegrationDispatcher $dispatcher): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin() || $user->canPermission('integration_manage'), 403);

        $definition = collect(self::CATALOG)->firstWhere('key', $key);
        abort_unless($definition, 404, 'Unknown integration');

        $account = Account::query()->findOrFail($user->account_id);
        $result = $dispatcher->test($account, $key);

        return response()->json(['data' => $result]);
    }
}

