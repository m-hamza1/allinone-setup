<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccountSettingsController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $account = $this->resolveAccount($user);

        return response()->json([
            'data' => [
                'id' => $account->id,
                'name' => $account->name,
                'slug' => $account->slug,
                'settings' => $account->settings ?? $this->defaults(),
            ],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin(), 403);
        $account = $this->resolveAccount($user);

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:120'],
            'settings' => ['sometimes', 'array'],
            'settings.timezone' => ['nullable', 'string', 'max:64'],
            'settings.brand_color' => ['nullable', 'string', 'max:32'],
            'settings.reply_greeting' => ['nullable', 'string', 'max:500'],
            'settings.widget_title' => ['nullable', 'string', 'max:120'],
            'settings.widget_tagline' => ['nullable', 'string', 'max:255'],
            'settings.enable_csat' => ['sometimes', 'boolean'],
            'settings.widget_primary_color' => ['nullable', 'string', 'max:32'],
            'settings.widget_bubble_position' => ['nullable', 'in:left,right'],
            'settings.widget_collect_name' => ['sometimes', 'boolean'],
            'settings.widget_collect_email' => ['sometimes', 'boolean'],
            'settings.widget_require_email' => ['sometimes', 'boolean'],
            'settings.security' => ['sometimes', 'array'],
            'settings.sso' => ['sometimes', 'array'],
            'settings.captain' => ['sometimes', 'array'],
        ]);

        if (isset($data['name'])) {
            $account->name = $data['name'];
        }
        if (isset($data['settings'])) {
            $account->settings = array_merge($this->defaults(), $account->settings ?? [], $data['settings']);
        }
        $account->save();

        return response()->json([
            'data' => [
                'id' => $account->id,
                'name' => $account->name,
                'slug' => $account->slug,
                'settings' => $account->settings,
            ],
        ]);
    }

    private function resolveAccount(User $user): Account
    {
        if ($user->account_id) {
            return Account::query()->findOrFail($user->account_id);
        }

        abort_unless($user->isSuperAdmin(), 422, 'No account');

        return Account::query()->firstOrFail();
    }

    private function defaults(): array
    {
        return [
            'timezone' => 'UTC',
            'brand_color' => '#0f6e56',
            'reply_greeting' => '',
            'widget_title' => 'Chat with us',
            'widget_tagline' => 'We usually reply in a few minutes',
            'enable_csat' => true,
        ];
    }
}
