<?php

namespace App\Providers;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        ResetPassword::createUrlUsing(function (object $user, string $token) {
            $frontend = rtrim((string) env('FRONTEND_URL', 'http://localhost:3000'), '/');
            $email = urlencode((string) $user->getEmailForPasswordReset());

            return "{$frontend}/reset-password?token={$token}&email={$email}";
        });
    }
}
