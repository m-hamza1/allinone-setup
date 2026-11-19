<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('campaigns', 'launched_at')) {
            Schema::table('campaigns', function (Blueprint $table) {
                $table->timestamp('launched_at')->nullable()->after('scheduled_at');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('campaigns', 'launched_at')) {
            Schema::table('campaigns', function (Blueprint $table) {
                $table->dropColumn('launched_at');
            });
        }
    }
};
