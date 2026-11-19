<?php

namespace Database\Seeders;

use App\Models\Account;
use App\Models\CannedResponse;
use App\Models\Inbox;
use App\Models\Label;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $account = Account::query()->create([
            'name' => 'Allin Demo',
            'slug' => 'allin-demo',
        ]);

        User::query()->create([
            'account_id' => null,
            'name' => 'Super Admin',
            'email' => 'super@allin.test',
            'password' => Hash::make('password'),
            'role' => 'super_admin',
        ]);

        User::query()->create([
            'account_id' => $account->id,
            'name' => 'Demo Admin',
            'email' => 'admin@allin.test',
            'password' => Hash::make('password'),
            'role' => 'admin',
        ]);

        User::query()->create([
            'account_id' => $account->id,
            'name' => 'Demo Staff',
            'email' => 'staff@allin.test',
            'password' => Hash::make('password'),
            'role' => 'staff',
        ]);

        Inbox::query()->create([
            'account_id' => $account->id,
            'name' => 'Website',
            'channel' => 'website',
            'widget_token' => 'demo-widget-token-change-me',
        ]);

        foreach ([
            ['title' => 'Priority', 'color' => '#b45309', 'description' => 'Needs fast follow-up'],
            ['title' => 'Billing', 'color' => '#1d4ed8', 'description' => 'Payment or invoice questions'],
            ['title' => 'Bug', 'color' => '#b91c1c', 'description' => 'Product issue reports'],
        ] as $label) {
            Label::query()->create([
                'account_id' => $account->id,
                ...$label,
            ]);
        }

        foreach ([
            ['short_code' => 'hello', 'content' => 'Hi! Thanks for reaching out. How can I help today?'],
            ['short_code' => 'wait', 'content' => 'Thanks for your patience — I’m checking this and will update you shortly.'],
            ['short_code' => 'resolved', 'content' => 'Glad that helped! I’m marking this conversation as resolved. Reply anytime if you need more help.'],
        ] as $canned) {
            CannedResponse::query()->create([
                'account_id' => $account->id,
                ...$canned,
            ]);
        }

        $this->call(ParitySeeder::class);
    }
}
