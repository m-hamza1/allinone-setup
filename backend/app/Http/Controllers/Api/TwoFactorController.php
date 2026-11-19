<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\TotpService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TwoFactorController extends Controller
{
    public function status(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'data' => [
                'enabled' => $user->hasTwoFactorEnabled(),
                'confirmed_at' => $user->two_factor_confirmed_at,
            ],
        ]);
    }

    public function setup(Request $request, TotpService $totp): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $secret = $totp->generateSecret();
        $user->forceFill([
            'two_factor_secret' => $secret,
            'two_factor_confirmed_at' => null,
            'two_factor_recovery_codes' => null,
        ])->save();

        return response()->json([
            'data' => [
                'secret' => $secret,
                'otpauth_url' => $totp->provisioningUri($secret, $user->email),
            ],
        ]);
    }

    public function confirm(Request $request, TotpService $totp): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $data = $request->validate([
            'otp' => ['required', 'string'],
        ]);

        abort_unless($user->two_factor_secret, 422, 'Run setup first');
        abort_unless($totp->verify((string) $user->two_factor_secret, $data['otp']), 422, 'Invalid code');

        $codes = $totp->recoveryCodes();
        $user->forceFill([
            'two_factor_confirmed_at' => now(),
            'two_factor_recovery_codes' => array_map(fn ($c) => hash('sha256', strtoupper($c)), $codes),
        ])->save();

        return response()->json([
            'data' => [
                'enabled' => true,
                'recovery_codes' => $codes,
            ],
        ]);
    }

    public function disable(Request $request, TotpService $totp): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $data = $request->validate([
            'otp' => ['required', 'string'],
        ]);

        abort_unless($user->hasTwoFactorEnabled(), 422, '2FA not enabled');
        abort_unless($totp->verify((string) $user->two_factor_secret, $data['otp']), 422, 'Invalid code');

        $user->forceFill([
            'two_factor_secret' => null,
            'two_factor_confirmed_at' => null,
            'two_factor_recovery_codes' => null,
        ])->save();

        return response()->json(['ok' => true]);
    }
}
