<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'two_factor_secret')) {
                $table->text('two_factor_secret')->nullable()->after('password');
            }
            if (! Schema::hasColumn('users', 'two_factor_confirmed_at')) {
                $table->timestamp('two_factor_confirmed_at')->nullable()->after('two_factor_secret');
            }
            if (! Schema::hasColumn('users', 'two_factor_recovery_codes')) {
                $table->json('two_factor_recovery_codes')->nullable()->after('two_factor_confirmed_at');
            }
            if (! Schema::hasColumn('users', 'google_id')) {
                $table->string('google_id')->nullable()->unique()->after('email');
            }
        });

        if (! Schema::hasTable('platform_api_tokens')) {
            Schema::create('platform_api_tokens', function (Blueprint $table) {
                $table->id();
                $table->foreignId('account_id')->constrained('accounts')->cascadeOnDelete();
                $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('name');
                $table->string('token_prefix', 16);
                $table->string('token_hash', 64)->unique();
                $table->json('abilities')->nullable();
                $table->timestamp('last_used_at')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_api_tokens');

        Schema::table('users', function (Blueprint $table) {
            foreach (['two_factor_secret', 'two_factor_confirmed_at', 'two_factor_recovery_codes', 'google_id'] as $col) {
                if (Schema::hasColumn('users', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
