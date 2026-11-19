<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class AuthBaselineTest extends TestCase
{
    use RefreshDatabase;

    public function test_register_creates_admin_workspace_and_inbox(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name' => 'Owner',
            'email' => 'owner@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'workspace' => 'Acme Support',
        ]);

        $response->assertCreated()
            ->assertJsonPath('user.role', 'admin')
            ->assertJsonPath('user.account.name', 'Acme Support');

        $this->assertDatabaseHas('inboxes', [
            'channel' => 'website',
        ]);
    }

    public function test_login_returns_token_for_seeded_style_user(): void
    {
        $user = User::factory()->create([
            'email' => 'agent@example.com',
            'password' => 'password',
            'role' => 'staff',
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $response->assertOk()->assertJsonStructure(['token', 'user' => ['id', 'role']]);
    }

    public function test_forgot_password_is_idempotent(): void
    {
        User::factory()->create(['email' => 'resetme@example.com']);

        $this->postJson('/api/auth/forgot-password', [
            'email' => 'resetme@example.com',
        ])->assertOk();

        $this->postJson('/api/auth/forgot-password', [
            'email' => 'nobody@example.com',
        ])->assertOk();
    }

    public function test_reset_password_with_valid_token(): void
    {
        $user = User::factory()->create([
            'email' => 'resetok@example.com',
            'password' => 'old-password',
        ]);

        $token = Password::broker()->createToken($user);

        $this->postJson('/api/auth/reset-password', [
            'email' => $user->email,
            'token' => $token,
            'password' => 'new-password1',
            'password_confirmation' => 'new-password1',
        ])->assertOk();

        $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'new-password1',
        ])->assertOk()->assertJsonStructure(['token']);
    }
}
