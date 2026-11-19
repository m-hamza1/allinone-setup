<?php

namespace Database\Seeders;

use App\Models\Account;
use App\Models\Campaign;
use App\Models\ChannelConnection;
use App\Models\CustomAttributeDefinition;
use App\Models\CustomView;
use App\Models\HelpCenterArticle;
use App\Models\HelpCenterCategory;
use App\Models\HelpCenterPortal;
use App\Models\Macro;
use App\Models\SlaPolicy;
use App\Models\Team;
use App\Models\User;
use Illuminate\Database\Seeder;

class ParitySeeder extends Seeder
{
    public function run(): void
    {
        $account = Account::query()->first();
        if (! $account) {
            return;
        }

        $account->update([
            'settings' => array_merge($account->settings ?? [], [
                'timezone' => 'Asia/Karachi',
                'brand_color' => '#0f6e56',
                'widget_title' => 'Chat with Allin',
                'widget_tagline' => 'We usually reply in a few minutes',
                'enable_csat' => true,
            ]),
        ]);

        $admin = User::query()->where('email', 'admin@allin.test')->first();
        $staff = User::query()->where('email', 'staff@allin.test')->first();

        if (Team::query()->where('account_id', $account->id)->count() === 0) {
            $team = Team::query()->create([
                'account_id' => $account->id,
                'name' => 'Support',
                'description' => 'Primary support group',
                'allow_auto_assign' => true,
            ]);
            $memberIds = collect([$admin?->id, $staff?->id])->filter()->all();
            $team->members()->sync($memberIds);
        }

        if (CustomAttributeDefinition::query()->where('account_id', $account->id)->count() === 0) {
            CustomAttributeDefinition::query()->create([
                'account_id' => $account->id,
                'key' => 'company',
                'label' => 'Company',
                'attribute_type' => 'text',
            ]);
            CustomAttributeDefinition::query()->create([
                'account_id' => $account->id,
                'key' => 'plan',
                'label' => 'Plan',
                'attribute_type' => 'list',
                'options' => ['Free', 'Pro', 'Enterprise'],
            ]);
        }

        if (CustomView::query()->where('account_id', $account->id)->count() === 0 && $staff) {
            CustomView::query()->create([
                'account_id' => $account->id,
                'user_id' => $staff->id,
                'name' => 'Mine open',
                'is_shared' => true,
                'filters' => ['status' => 'open', 'assignee' => 'me'],
            ]);
            CustomView::query()->create([
                'account_id' => $account->id,
                'user_id' => $staff->id,
                'name' => 'Unassigned',
                'is_shared' => true,
                'filters' => ['status' => 'open', 'assignee' => 'unassigned'],
            ]);
        }

        if (Macro::query()->where('account_id', $account->id)->count() === 0) {
            Macro::query()->create([
                'account_id' => $account->id,
                'name' => 'Resolve with thanks',
                'visibility' => 'account',
                'user_id' => $admin?->id,
                'actions' => [
                    ['type' => 'status', 'status' => 'resolved'],
                    ['type' => 'private_note', 'body' => 'Resolved via macro'],
                ],
            ]);
        }

        if (SlaPolicy::query()->where('account_id', $account->id)->count() === 0) {
            SlaPolicy::query()->create([
                'account_id' => $account->id,
                'name' => 'Standard SLA',
                'first_response_minutes' => 15,
                'resolution_minutes' => 1440,
            ]);
        }

        foreach (['email', 'whatsapp', 'instagram', 'facebook', 'sms'] as $provider) {
            ChannelConnection::query()->firstOrCreate(
                [
                    'account_id' => $account->id,
                    'provider' => $provider,
                ],
                [
                    'status' => $provider === 'email' ? 'disconnected' : 'disconnected',
                    'credentials' => [],
                    'meta' => ['setup' => 'Configure credentials in Settings → Channels'],
                ],
            );
        }

        if (HelpCenterPortal::query()->where('account_id', $account->id)->count() === 0) {
            $portal = HelpCenterPortal::query()->create([
                'account_id' => $account->id,
                'name' => 'Allin Help',
                'slug' => 'allin-help',
                'headline' => 'How can we help?',
                'is_published' => true,
            ]);
            $category = HelpCenterCategory::query()->create([
                'portal_id' => $portal->id,
                'name' => 'Getting started',
                'slug' => 'getting-started',
                'position' => 0,
            ]);
            HelpCenterArticle::query()->create([
                'portal_id' => $portal->id,
                'category_id' => $category->id,
                'title' => 'Welcome to Allin',
                'slug' => 'welcome',
                'body' => 'This is your Chatwoot-style help center starter article.',
                'status' => 'published',
            ]);
        }

        if (Campaign::query()->where('account_id', $account->id)->count() === 0) {
            Campaign::query()->create([
                'account_id' => $account->id,
                'title' => 'Welcome message',
                'message' => 'Thanks for chatting with us!',
                'campaign_type' => 'ongoing',
                'status' => 'draft',
                'audience' => ['all_contacts' => true],
            ]);
        }
    }
}
