<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assignment_policies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('account_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('strategy')->default('round_robin'); // round_robin|least_busy|manual
            $table->boolean('active')->default(true);
            $table->json('config')->nullable();
            $table->timestamps();
        });

        Schema::create('message_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('account_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('channel')->default('whatsapp');
            $table->string('language')->default('en');
            $table->text('body');
            $table->string('status')->default('draft'); // draft|approved|rejected
            $table->timestamps();
        });

        Schema::create('agent_bots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('account_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('bot_type')->default('webhook'); // webhook|csat|faq
            $table->string('outgoing_url')->nullable();
            $table->boolean('active')->default(true);
            $table->json('config')->nullable();
            $table->timestamps();
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('account_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action');
            $table->string('auditable_type')->nullable();
            $table->unsignedBigInteger('auditable_id')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();
            $table->index(['account_id', 'created_at']);
        });

        Schema::create('custom_roles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('account_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('description')->nullable();
            $table->json('permissions')->nullable();
            $table->timestamps();
        });

        if (! Schema::hasColumn('conversations', 'participant_ids')) {
            Schema::table('conversations', function (Blueprint $table) {
                $table->json('participant_ids')->nullable()->after('assignee_id');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('custom_roles');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('agent_bots');
        Schema::dropIfExists('message_templates');
        Schema::dropIfExists('assignment_policies');
        if (Schema::hasColumn('conversations', 'participant_ids')) {
            Schema::table('conversations', function (Blueprint $table) {
                $table->dropColumn('participant_ids');
            });
        }
    }
};
