<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Models\Inbox;
use App\Models\User;
use App\Services\TotpService;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password as PasswordBroker;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:190', 'unique:users,email'],
            'password' => ['required', 'confirmed', Password::min(8)],
            'workspace' => ['required', 'string', 'max:120'],
        ]);

        $baseSlug = Str::slug($data['workspace']) ?: 'workspace';
        $slug = $baseSlug;
        $suffix = 1;
        while (Account::query()->where('slug', $slug)->exists()) {
            $slug = $baseSlug.'-'.$suffix;
            $suffix++;
        }

        /** @var User $user */
        $user = DB::transaction(function () use ($data, $slug) {
            $account = Account::query()->create([
                'name' => $data['workspace'],
                'slug' => $slug,
                'settings' => [],
            ]);

            Inbox::query()->create([
                'account_id' => $account->id,
                'name' => 'Website',
                'channel' => 'website',
                'widget_token' => Str::random(40),
            ]);

            return User::query()->create([
                'account_id' => $account->id,
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => $data['password'],
                'role' => 'admin',
            ]);
        });

        $user->load(['account', 'customRole']);
        $token = $user->createToken('staff-dashboard')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $this->userPayload($user),
        ], 201);
    }

    public function login(Request $request, TotpService $totp): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'otp' => ['nullable', 'string'],
            'recovery_code' => ['nullable', 'string'],
        ]);

        /** @var User|null $user */
        $user = User::query()->where('email', $credentials['email'])->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        $user->load(['account', 'customRole']);
        $require2fa = (bool) (($user->account?->settings['security']['require_2fa'] ?? false));
        $userHas2fa = $user->hasTwoFactorEnabled();

        if (($require2fa || $userHas2fa) && $userHas2fa) {
            $otp = $credentials['otp'] ?? null;
            $recovery = $credentials['recovery_code'] ?? null;

            if (! $otp && ! $recovery) {
                $challenge = Str::random(40);
                Cache::put('2fa_challenge:'.$challenge, $user->id, now()->addMinutes(10));

                return response()->json([
                    'requires_2fa' => true,
                    'challenge' => $challenge,
                    'message' => 'Enter authenticator code to continue',
                ], 200);
            }

            $ok = false;
            if ($otp && $user->two_factor_secret) {
                $ok = $totp->verify((string) $user->two_factor_secret, (string) $otp);
            }
            if (! $ok && $recovery) {
                $ok = $user->consumeRecoveryCode((string) $recovery);
            }
            if (! $ok) {
                throw ValidationException::withMessages([
                    'otp' => ['Invalid authentication code.'],
                ]);
            }
        } elseif ($require2fa && ! $userHas2fa && ! $user->isSuperAdmin()) {
            // Policy requires 2FA but user not enrolled — issue limited token flag
            $token = $user->createToken('staff-dashboard')->plainTextToken;

            return response()->json([
                'token' => $token,
                'user' => $this->userPayload($user),
                'must_enroll_2fa' => true,
            ]);
        }

        $token = $user->createToken('staff-dashboard')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $this->userPayload($user),
        ]);
    }

    public function verifyTwoFactor(Request $request, TotpService $totp): JsonResponse
    {
        $data = $request->validate([
            'challenge' => ['required', 'string'],
            'otp' => ['nullable', 'string'],
            'recovery_code' => ['nullable', 'string'],
        ]);

        $userId = Cache::pull('2fa_challenge:'.$data['challenge']);
        abort_unless($userId, 422, 'Challenge expired');

        /** @var User $user */
        $user = User::query()->findOrFail($userId);
        $user->load(['account', 'customRole']);

        $ok = false;
        if (! empty($data['otp']) && $user->two_factor_secret) {
            $ok = $totp->verify((string) $user->two_factor_secret, (string) $data['otp']);
        }
        if (! $ok && ! empty($data['recovery_code'])) {
            $ok = $user->consumeRecoveryCode((string) $data['recovery_code']);
        }
        abort_unless($ok, 422, 'Invalid authentication code');

        $token = $user->createToken('staff-dashboard')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $this->userPayload($user),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $user->load(['account', 'customRole']);

        return response()->json([
            'user' => $this->userPayload($user),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['message' => 'Logged out']);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate([
            'email' => ['required', 'email'],
        ]);

        PasswordBroker::sendResetLink($request->only('email'));

        return response()->json([
            'message' => 'If that email exists, a reset link was sent.',
        ]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'confirmed', Password::min(8)],
        ]);

        $status = PasswordBroker::reset(
            $data,
            function (User $user, string $password) {
                $user->forceFill([
                    'password' => $password,
                    'remember_token' => Str::random(60),
                ])->save();

                $user->tokens()->delete();

                event(new PasswordReset($user));
            }
        );

        if ($status !== PasswordBroker::PASSWORD_RESET) {
            throw ValidationException::withMessages([
                'email' => [__($status)],
            ]);
        }

        return response()->json(['message' => 'Password updated. You can sign in now.']);
    }

    private function userPayload(User $user): array
    {
        $user->loadMissing('customRole');

        return [
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
        ];
    }
}
