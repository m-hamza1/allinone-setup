<?php

namespace App\Console\Commands;

use App\Models\ChannelConnection;
use App\Services\EmailChannelService;
use Illuminate\Console\Command;

/**
 * IMAP poller — reads mailbox when PHP imap extension and credentials are available.
 * For local demos without IMAP, prefer POST /api/channels/email/ingest.
 */
class EmailChannelPollCommand extends Command
{
    protected $signature = 'channels:email-poll {--dry-run : List connected email channels without fetching}';

    protected $description = 'Poll connected email (IMAP) channel connections for new mail';

    public function handle(EmailChannelService $email): int
    {
        $connections = ChannelConnection::query()
            ->where('provider', 'email')
            ->where('status', 'connected')
            ->get();

        if ($connections->isEmpty()) {
            $this->warn('No connected email channels.');

            return self::SUCCESS;
        }

        if (! function_exists('imap_open')) {
            $this->warn('PHP imap extension not loaded — use POST /api/channels/email/ingest');
        }

        foreach ($connections as $connection) {
            $creds = $connection->credentials ?? [];
            $host = $creds['imap_host'] ?? null;

            $this->line("Account #{$connection->account_id} · connection #{$connection->id}");

            if ($this->option('dry-run')) {
                $this->info('  dry-run: would poll '.($host ?: '(no imap_host)'));

                continue;
            }

            $result = $email->pollConnection($connection);
            if ($result['ok']) {
                $this->info('  '.$result['detail']);
            } else {
                $this->warn('  '.$result['detail']);
            }
        }

        return self::SUCCESS;
    }
}
