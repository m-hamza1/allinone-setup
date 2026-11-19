<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            $table->string('priority', 16)->nullable()->default('none')->after('status');
            $table->timestamp('snoozed_until')->nullable()->after('priority');
            $table->boolean('muted')->default(false)->after('snoozed_until');
        });
    }

    public function down(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            $table->dropColumn(['priority', 'snoozed_until', 'muted']);
        });
    }
};
