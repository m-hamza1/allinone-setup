<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('help_center_portals', function (Blueprint $table) {
            if (! Schema::hasColumn('help_center_portals', 'default_locale')) {
                $table->string('default_locale', 12)->default('en')->after('headline');
            }
            if (! Schema::hasColumn('help_center_portals', 'locales')) {
                $table->json('locales')->nullable()->after('default_locale');
            }
        });

        Schema::table('help_center_articles', function (Blueprint $table) {
            if (! Schema::hasColumn('help_center_articles', 'locale')) {
                $table->string('locale', 12)->default('en')->after('status');
            }
        });

        Schema::table('sla_policies', function (Blueprint $table) {
            if (! Schema::hasColumn('sla_policies', 'business_hours')) {
                $table->json('business_hours')->nullable()->after('only_during_business_hours');
            }
        });

        Schema::table('conversations', function (Blueprint $table) {
            if (! Schema::hasColumn('conversations', 'first_response_due_at')) {
                $table->timestamp('first_response_due_at')->nullable()->after('sla_due_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('help_center_portals', function (Blueprint $table) {
            if (Schema::hasColumn('help_center_portals', 'locales')) {
                $table->dropColumn('locales');
            }
            if (Schema::hasColumn('help_center_portals', 'default_locale')) {
                $table->dropColumn('default_locale');
            }
        });

        Schema::table('help_center_articles', function (Blueprint $table) {
            if (Schema::hasColumn('help_center_articles', 'locale')) {
                $table->dropColumn('locale');
            }
        });

        Schema::table('sla_policies', function (Blueprint $table) {
            if (Schema::hasColumn('sla_policies', 'business_hours')) {
                $table->dropColumn('business_hours');
            }
        });

        Schema::table('conversations', function (Blueprint $table) {
            if (Schema::hasColumn('conversations', 'first_response_due_at')) {
                $table->dropColumn('first_response_due_at');
            }
        });
    }
};
