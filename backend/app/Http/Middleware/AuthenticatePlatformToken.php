<?php

namespace App\Http\Middleware;

use App\Models\PlatformApiToken;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticatePlatformToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $header = (string) $request->header('Authorization', '');
        $token = null;
        if (preg_match('/^Bearer\s+(\S+)/i', $header, $m)) {
            $token = $m[1];
        }
        $token = $token ?: (string) $request->header('X-Allin-Token', '');

        abort_unless($token !== '', 401, 'Platform API token required');

        $model = PlatformApiToken::findByPlainToken($token);
        abort_unless($model, 401, 'Invalid platform token');

        $model->forceFill(['last_used_at' => now()])->save();
        $request->attributes->set('platform_token', $model);
        $request->attributes->set('platform_account_id', $model->account_id);

        return $next($request);
    }
}
