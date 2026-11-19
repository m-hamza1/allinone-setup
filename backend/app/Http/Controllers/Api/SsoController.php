<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class SsoController extends Controller
{
    public function providers(Request $request): JsonResponse
    {
        $account = $request->user()?->account;
        $sso = $account?->settings['sso'] ?? [];

        return response()->json([
            'data' => [
                'google' => [
                    'enabled' => (bool) ($sso['google_enabled'] ?? false) || filled(config('services.google.client_id')),
                    'configured' => filled(config('services.google.client_id')),
                ],
                'saml' => [
                    'enabled' => (bool) ($sso['saml_enabled'] ?? false),
                    'entity_id' => $sso['saml_entity_id'] ?? null,
                    'sso_url' => $sso['saml_sso_url'] ?? null,
                    'configured' => ! empty($sso['saml_sso_url']),
                ],
            ],
        ]);
    }

    public function googleRedirect(Request $request): JsonResponse
    {
        $clientId = config('services.google.client_id');
        if (! $clientId) {
            return response()->json([
                'ok' => false,
                'detail' => 'Set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in .env',
            ], 422);
        }

        $redirect = config('services.google.redirect');
        $state = Str::random(32);
        $url = 'https://accounts.google.com/o/oauth2/v2/auth?'.http_build_query([
            'client_id' => $clientId,
            'redirect_uri' => $redirect,
            'response_type' => 'code',
            'scope' => 'openid email profile',
            'state' => $state,
            'access_type' => 'online',
            'prompt' => 'select_account',
        ]);

        return response()->json(['data' => ['url' => $url, 'state' => $state]]);
    }

    /**
     * Exchange Google authorization code for an Allin API token.
     * Called by the Next.js page at /auth/google/callback (not by Google directly as HTML).
     */
    public function googleCallback(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string'],
        ]);

        $clientId = config('services.google.client_id');
        $clientSecret = config('services.google.client_secret');
        $redirect = config('services.google.redirect');

        abort_unless($clientId && $clientSecret, 422, 'Google OAuth not configured');

        $tokenRes = Http::asForm()->post('https://oauth2.googleapis.com/token', [
            'code' => $data['code'],
            'client_id' => $clientId,
            'client_secret' => $clientSecret,
            'redirect_uri' => $redirect,
            'grant_type' => 'authorization_code',
        ]);

        if (! $tokenRes->successful()) {
            return response()->json(['error' => 'token_exchange_failed', 'detail' => $tokenRes->body()], 422);
        }

        $access = $tokenRes->json('access_token');
        $profile = Http::withToken($access)->get('https://openidconnect.googleapis.com/v1/userinfo');
        abort_unless($profile->successful(), 422, 'Could not load Google profile');

        $email = strtolower((string) $profile->json('email'));
        $googleId = (string) $profile->json('sub');
        $name = (string) ($profile->json('name') ?? $email);

        $user = User::query()->where('google_id', $googleId)->orWhere('email', $email)->first();
        if (! $user) {
            $account = Account::query()->orderBy('id')->first();
            abort_unless($account, 422, 'No account available for SSO user');
            $user = User::query()->create([
                'account_id' => $account->id,
                'name' => $name,
                'email' => $email,
                'google_id' => $googleId,
                'password' => Hash::make(Str::random(32)),
                'role' => 'staff',
            ]);
        } else {
            $user->forceFill(['google_id' => $googleId])->save();
        }

        $user->load(['account', 'customRole']);
        $token = $user->createToken('staff-dashboard')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'custom_role_id' => $user->custom_role_id,
                'custom_role' => $user->customRole ? [
                    'id' => $user->customRole->id,
                    'name' => $user->customRole->name,
                    'permissions' => $user->customRole->permissions ?? [],
                ] : null,
                'permissions' => $user->permissionKeys(),
                'two_factor_enabled' => $user->hasTwoFactorEnabled(),
                'account' => $user->account ? [
                    'id' => $user->account->id,
                    'name' => $user->account->name,
                    'slug' => $user->account->slug,
                    'require_2fa' => (bool) ($user->account->settings['security']['require_2fa'] ?? false),
                ] : null,
            ],
        ]);
    }
}
