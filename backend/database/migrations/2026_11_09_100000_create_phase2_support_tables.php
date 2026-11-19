<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('labels', function (Blueprint $table) {
            $table->id();
            $table->foreignId('account_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->string('color', 32)->default('#0f6e56');
            $table->string('description')->nullable();
            $table->timestamps();

            $table->unique(['account_id', 'title']);
        });

        Schema::create('conversation_label', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('label_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['conversation_id', 'label_id']);
        });

        Schema::create('canned_responses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('account_id')->constrained()->cascadeOnDelete();
            $table->string('short_code');
            $table->text('content');
            $table->timestamps();

            $table->unique(['account_id', 'short_code']);
        });

        Schema::table('messages', function (Blueprint $table) {
            $table->boolean('private')->default(false)->after('sender_type');
        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->dropColumn('private');
        });

        Schema::dropIfExists('canned_responses');
        Schema::dropIfExists('conversation_label');
        Schema::dropIfExists('labels');
    }
};
