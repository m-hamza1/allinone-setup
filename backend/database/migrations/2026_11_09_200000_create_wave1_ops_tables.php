<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('accounts', function (Blueprint $table) {
            $table->json('settings')->nullable()->after('slug');
        });

        Schema::table('contacts', function (Blueprint $table) {
            $table->json('custom_attributes')->nullable()->after('phone');
        });

        Schema::create('teams', function (Blueprint $table) {
            $table->id();
            $table->foreignId('account_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('description')->nullable();
            $table->boolean('allow_auto_assign')->default(true);
            $table->timestamps();

            $table->unique(['account_id', 'name']);
        });

        Schema::create('team_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('team_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['team_id', 'user_id']);
        });

        Schema::table('conversations', function (Blueprint $table) {
            $table->foreignId('team_id')->nullable()->after('assignee_id')->constrained()->nullOnDelete();
            $table->foreignId('locked_by')->nullable()->after('team_id')->constrained('users')->nullOnDelete();
            $table->timestamp('locked_at')->nullable()->after('locked_by');
            $table->unsignedTinyInteger('csat_score')->nullable()->after('status');
            $table->timestamp('csat_submitted_at')->nullable()->after('csat_score');
        });

        Schema::create('message_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('message_id')->constrained()->cascadeOnDelete();
            $table->string('disk')->default('public');
            $table->string('path');
            $table->string('original_name');
            $table->string('mime_type', 120)->nullable();
            $table->unsignedBigInteger('size')->default(0);
            $table->timestamps();
        });

        Schema::create('contact_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('account_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contact_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->text('body');
            $table->timestamps();
        });

        Schema::create('custom_attribute_definitions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('account_id')->constrained()->cascadeOnDelete();
            $table->string('key');
            $table->string('label');
            $table->string('attribute_type', 32)->default('text'); // text|number|link|list
            $table->json('options')->nullable();
            $table->timestamps();

            $table->unique(['account_id', 'key']);
        });

        Schema::create('custom_views', function (Blueprint $table) {
            $table->id();
            $table->foreignId('account_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->json('filters');
            $table->boolean('is_shared')->default(false);
            $table->timestamps();
        });

        Schema::create('macros', function (Blueprint $table) {
            $table->id();
            $table->foreignId('account_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('visibility', 32)->default('account'); // account|personal
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->json('actions');
            $table->timestamps();
        });

        Schema::create('message_mentions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('message_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['message_id', 'user_id']);
        });

        Schema::create('csat_responses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('account_id')->constrained()->cascadeOnDelete();
            $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contact_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedTinyInteger('score');
            $table->string('feedback')->nullable();
            $table->timestamps();
        });

        Schema::create('conversation_viewers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('last_seen_at');
            $table->timestamps();

            $table->unique(['conversation_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('conversation_viewers');
        Schema::dropIfExists('csat_responses');
        Schema::dropIfExists('message_mentions');
        Schema::dropIfExists('macros');
        Schema::dropIfExists('custom_views');
        Schema::dropIfExists('custom_attribute_definitions');
        Schema::dropIfExists('contact_notes');
        Schema::dropIfExists('message_attachments');

        Schema::table('conversations', function (Blueprint $table) {
            $table->dropConstrainedForeignId('team_id');
            $table->dropConstrainedForeignId('locked_by');
            $table->dropColumn(['locked_at', 'csat_score', 'csat_submitted_at']);
        });

        Schema::dropIfExists('team_user');
        Schema::dropIfExists('teams');

        Schema::table('contacts', function (Blueprint $table) {
            $table->dropColumn('custom_attributes');
        });

        Schema::table('accounts', function (Blueprint $table) {
            $table->dropColumn('settings');
        });
    }
};
