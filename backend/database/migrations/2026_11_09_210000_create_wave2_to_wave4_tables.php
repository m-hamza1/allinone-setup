<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inboxes', function (Blueprint $table) {
            $table->json('channel_config')->nullable()->after('widget_token');
        });

        Schema::create('channel_connections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('account_id')->constrained()->cascadeOnDelete();
            $table->foreignId('inbox_id')->nullable()->constrained()->nullOnDelete();
            $table->string('provider', 40); // email|whatsapp|instagram|facebook|sms
            $table->string('status', 32)->default('disconnected'); // connected|disconnected|error
            $table->json('credentials')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();
        });

        Schema::create('sla_policies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('account_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->unsignedInteger('first_response_minutes')->default(15);
            $table->unsignedInteger('resolution_minutes')->default(1440);
            $table->boolean('only_during_business_hours')->default(false);
            $table->timestamps();
        });

        Schema::table('conversations', function (Blueprint $table) {
            $table->foreignId('sla_policy_id')->nullable()->after('team_id')->constrained()->nullOnDelete();
            $table->timestamp('first_reply_at')->nullable()->after('last_activity_at');
            $table->timestamp('sla_due_at')->nullable()->after('first_reply_at');
        });

        Schema::create('help_center_portals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('account_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('slug');
            $table->string('headline')->nullable();
            $table->boolean('is_published')->default(false);
            $table->timestamps();

            $table->unique(['account_id', 'slug']);
        });

        Schema::create('help_center_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('portal_id')->constrained('help_center_portals')->cascadeOnDelete();
            $table->string('name');
            $table->string('slug');
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();

            $table->unique(['portal_id', 'slug']);
        });

        Schema::create('help_center_articles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('portal_id')->constrained('help_center_portals')->cascadeOnDelete();
            $table->foreignId('category_id')->nullable()->constrained('help_center_categories')->nullOnDelete();
            $table->string('title');
            $table->string('slug');
            $table->longText('body')->nullable();
            $table->string('status', 32)->default('draft'); // draft|published
            $table->timestamps();

            $table->unique(['portal_id', 'slug']);
        });

        Schema::create('campaigns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('account_id')->constrained()->cascadeOnDelete();
            $table->foreignId('inbox_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title');
            $table->string('campaign_type', 32)->default('ongoing'); // ongoing|one_off
            $table->string('status', 32)->default('draft'); // draft|active|completed|disabled
            $table->text('message');
            $table->json('audience')->nullable();
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('campaigns');
        Schema::dropIfExists('help_center_articles');
        Schema::dropIfExists('help_center_categories');
        Schema::dropIfExists('help_center_portals');

        Schema::table('conversations', function (Blueprint $table) {
            $table->dropConstrainedForeignId('sla_policy_id');
            $table->dropColumn(['first_reply_at', 'sla_due_at']);
        });

        Schema::dropIfExists('sla_policies');
        Schema::dropIfExists('channel_connections');

        Schema::table('inboxes', function (Blueprint $table) {
            $table->dropColumn('channel_config');
        });
    }
};
