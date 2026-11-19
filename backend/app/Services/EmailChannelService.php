<?php

namespace App\Services;

use App\Models\ChannelConnection;
use App\Models\Contact;
use App\Models\Conversation;
use App\Models\Inbox;
use App\Models\Message;
use Illuminate\Support\Facades\Mail;

class EmailChannelService
{
    /**
     * Ingest an inbound email into an existing email inbox conversation.
     */
    public function ingest(array $payload): Conversation
    {
        $connection = ChannelConnection::query()
            ->where('provider', 'email')
            ->when(! empty($payload['account_id']), fn ($q) => $q->where('account_id', $payload['account_id']))
            ->when(! empty($payload['connection_id']), fn ($q) => $q->where('id', $payload['connection_id']))
            ->firstOrFail();

        if ($connection->status !== 'connected') {
            $connection->update(['status' => 'connected']);
        }

        $messageId = isset($payload['message_id']) ? trim((string) $payload['message_id']) : null;
        if ($messageId && $this->alreadySeen($connection, $messageId)) {
            $existing = Conversation::query()
                ->where('account_id', $connection->account_id)
                ->when($connection->inbox_id, fn ($q) => $q->where('inbox_id', $connection->inbox_id))
                ->orderByDesc('id')
                ->first();

            if ($existing) {
                return $existing->load(['contact', 'inbox', 'messages']);
            }
        }

        $inbox = $connection->inbox_id
            ? Inbox::query()->findOrFail($connection->inbox_id)
            : Inbox::query()->firstOrCreate(
                [
                    'account_id' => $connection->account_id,
                    'channel' => 'email',
                ],
                [
                    'name' => 'Email',
                    'channel_config' => $connection->meta ?? [],
                ],
            );

        $contact = Contact::query()->firstOrCreate(
            [
                'account_id' => $connection->account_id,
                'email' => $payload['from_email'],
            ],
            [
                'name' => $payload['from_name'] ?? $payload['from_email'],
            ],
        );

        $conversation = Conversation::query()
            ->where('inbox_id', $inbox->id)
            ->where('contact_id', $contact->id)
            ->where('status', 'open')
            ->orderByDesc('id')
            ->first();

        $created = false;
        if (! $conversation) {
            $conversation = Conversation::query()->create([
                'account_id' => $connection->account_id,
                'inbox_id' => $inbox->id,
                'contact_id' => $contact->id,
                'status' => 'open',
                'last_activity_at' => now(),
            ]);
            $created = true;
            app(ConversationSlaService::class)->apply($conversation);
            try {
                app(AutomationRunner::class)->run('conversation_created', $conversation->fresh());
            } catch (\Throwable) {
                // best-effort automation
            }
        }

        $subject = trim((string) ($payload['subject'] ?? ''));
        $body = trim((string) ($payload['body'] ?? ''));
        if ($subject !== '' && ! str_starts_with($body, $subject) && $body !== '') {
            $body = "Subject: {$subject}\n\n{$body}";
        } elseif ($body === '') {
            $body = $subject !== '' ? $subject : '(empty email)';
        }

        Message::query()->create([
            'conversation_id' => $conversation->id,
            'user_id' => null,
            'sender_type' => 'customer',
            'private' => false,
            'body' => $body,
        ]);

        $conversation->update(['last_activity_at' => now(), 'status' => 'open']);

        if ($messageId) {
            $this->markSeen($connection, $messageId);
        }

        if (! $created) {
            try {
                app(AutomationRunner::class)->run('message_created', $conversation->fresh());
            } catch (\Throwable) {
                // best-effort automation
            }
        }

        return $conversation->fresh(['contact', 'inbox', 'messages']);
    }

    /**
     * Poll one IMAP connection and ingest UNSEEN mail.
     *
     * @return array{ok: bool, ingested: int, detail: string}
     */
    public function pollConnection(ChannelConnection $connection): array
    {
        if (! function_exists('imap_open')) {
            return [
                'ok' => false,
                'ingested' => 0,
                'detail' => 'PHP imap extension not loaded',
            ];
        }

        $creds = $connection->credentials ?? [];
        $host = $creds['imap_host'] ?? null;
        $username = $creds['imap_username'] ?? $creds['username'] ?? null;
        $password = $creds['imap_password'] ?? $creds['password'] ?? null;
        $port = (int) ($creds['imap_port'] ?? 993);
        $mailbox = $creds['imap_mailbox'] ?? 'INBOX';

        if (! $host || ! $username || ! $password) {
            return [
                'ok' => false,
                'ingested' => 0,
                'detail' => 'IMAP credentials incomplete',
            ];
        }

        $flags = $port === 143 ? '/imap/tls' : '/imap/ssl';
        if (! empty($creds['imap_novalidate_cert'])) {
            $flags .= '/novalidate-cert';
        }
        $mailboxString = "{{$host}:{$port}{$flags}}{$mailbox}";

        $inbox = @imap_open($mailboxString, $username, $password);
        if (! $inbox) {
            return [
                'ok' => false,
                'ingested' => 0,
                'detail' => 'imap_open failed: '.(imap_last_error() ?: 'unknown error'),
            ];
        }

        $emails = imap_search($inbox, 'UNSEEN') ?: [];
        $ingested = 0;

        foreach ($emails as $emailNumber) {
            $overview = imap_fetch_overview($inbox, (string) $emailNumber, 0);
            $header = $overview[0] ?? null;
            $rawHeader = imap_headerinfo($inbox, $emailNumber);
            $from = $rawHeader->from[0] ?? null;
            $fromEmail = $from ? ($from->mailbox.'@'.$from->host) : 'unknown@local';
            $fromName = isset($from->personal) ? $this->decodeMimeHeader((string) $from->personal) : $fromEmail;
            $subject = $this->decodeMimeHeader((string) ($header->subject ?? $rawHeader->subject ?? ''));
            $messageId = isset($header->message_id) ? trim((string) $header->message_id) : null;

            $structure = imap_fetchstructure($inbox, $emailNumber);
            $body = $this->extractBody($inbox, $emailNumber, $structure);

            $this->ingest([
                'account_id' => $connection->account_id,
                'connection_id' => $connection->id,
                'from_email' => $fromEmail,
                'from_name' => $fromName,
                'subject' => $subject,
                'body' => $body,
                'message_id' => $messageId,
            ]);

            imap_setflag_full($inbox, (string) $emailNumber, '\\Seen');
            $ingested++;
        }

        imap_close($inbox);

        $meta = $connection->meta ?? [];
        $meta['last_polled_at'] = now()->toIso8601String();
        $meta['last_poll_ingested'] = $ingested;
        $connection->update(['meta' => $meta]);

        return [
            'ok' => true,
            'ingested' => $ingested,
            'detail' => "Ingested {$ingested} message(s)",
        ];
    }

    /**
     * Outbound email reply for a conversation thread.
     *
     * @return array{ok: bool, mode: string, detail: string}
     */
    public function sendReply(Conversation $conversation, string $body): array
    {
        $conversation->loadMissing(['contact', 'inbox']);

        $connection = ChannelConnection::query()
            ->where('account_id', $conversation->account_id)
            ->where('provider', 'email')
            ->when(
                $conversation->inbox_id,
                fn ($q) => $q->where(fn ($inner) => $inner
                    ->where('inbox_id', $conversation->inbox_id)
                    ->orWhereNull('inbox_id')),
            )
            ->orderByDesc('id')
            ->first();

        if (! $connection) {
            return [
                'ok' => false,
                'mode' => 'stub',
                'detail' => 'No email channel connection for this account',
            ];
        }

        $creds = $connection->credentials ?? [];
        $host = $creds['smtp_host'] ?? $creds['host'] ?? null;
        if (! $host && ! empty($creds['imap_host'])) {
            // Common Gmail/Outlook pattern: imap.x → smtp.x
            $host = preg_replace('/^imap\./i', 'smtp.', (string) $creds['imap_host']) ?: null;
        }
        $port = (int) ($creds['smtp_port'] ?? $creds['port'] ?? 587);
        $username = $creds['smtp_username'] ?? $creds['username'] ?? null;
        $password = $creds['smtp_password'] ?? $creds['password'] ?? null;
        $fromAddress = $creds['from_email'] ?? $creds['from'] ?? $username;
        $fromName = $creds['from_name'] ?? $conversation->inbox?->name ?? 'Support';

        if (! $host || ! $username || ! $password || ! $fromAddress) {
            return [
                'ok' => false,
                'mode' => 'stub',
                'detail' => 'SMTP credentials incomplete — configure smtp_host, username, password, from_email',
            ];
        }

        $to = $conversation->contact?->email;
        if (! $to) {
            return [
                'ok' => false,
                'mode' => 'stub',
                'detail' => 'Contact has no email address',
            ];
        }

        $encryption = $creds['encryption'] ?? ($port === 465 ? 'ssl' : 'tls');

        config([
            'mail.default' => 'smtp',
            'mail.mailers.smtp.transport' => 'smtp',
            'mail.mailers.smtp.host' => $host,
            'mail.mailers.smtp.port' => $port,
            'mail.mailers.smtp.encryption' => $encryption,
            'mail.mailers.smtp.username' => $username,
            'mail.mailers.smtp.password' => $password,
        ]);

        $subject = 'Re: Conversation #'.$conversation->id;
        $lastCustomer = Message::query()
            ->where('conversation_id', $conversation->id)
            ->where('sender_type', 'customer')
            ->orderByDesc('id')
            ->value('body');
        if (is_string($lastCustomer) && preg_match('/^Subject:\s*(.+)$/m', $lastCustomer, $m)) {
            $subject = str_starts_with(trim($m[1]), 'Re:') ? trim($m[1]) : 'Re: '.trim($m[1]);
        }

        try {
            Mail::html(nl2br(e($body)), function ($message) use ($to, $fromAddress, $fromName, $subject) {
                $message->to($to)
                    ->from($fromAddress, $fromName)
                    ->subject($subject);
            });

            return [
                'ok' => true,
                'mode' => 'live',
                'detail' => "Sent to {$to}",
            ];
        } catch (\Throwable $e) {
            return [
                'ok' => false,
                'mode' => 'live',
                'detail' => $e->getMessage(),
            ];
        }
    }

    /**
     * Campaign / one-off outbound email (not tied to a conversation thread).
     *
     * @return array{ok: bool, mode: string, detail: string}
     */
    public function sendOutbound(
        int $accountId,
        string $to,
        string $subject,
        string $body,
        ?int $inboxId = null,
    ): array {
        $connection = ChannelConnection::query()
            ->where('account_id', $accountId)
            ->where('provider', 'email')
            ->when(
                $inboxId,
                fn ($q) => $q->where(fn ($inner) => $inner
                    ->where('inbox_id', $inboxId)
                    ->orWhereNull('inbox_id')),
            )
            ->orderByDesc('id')
            ->first();

        if (! $connection) {
            return ['ok' => false, 'mode' => 'stub', 'detail' => 'No email channel connection'];
        }

        $creds = $connection->credentials ?? [];
        $host = $creds['smtp_host'] ?? $creds['host'] ?? null;
        if (! $host && ! empty($creds['imap_host'])) {
            $host = preg_replace('/^imap\./i', 'smtp.', (string) $creds['imap_host']) ?: null;
        }
        $port = (int) ($creds['smtp_port'] ?? $creds['port'] ?? 587);
        $username = $creds['smtp_username'] ?? $creds['username'] ?? null;
        $password = $creds['smtp_password'] ?? $creds['password'] ?? null;
        $fromAddress = $creds['from_email'] ?? $creds['from'] ?? $username;
        $fromName = $creds['from_name'] ?? 'Support';

        if (! $host || ! $username || ! $password || ! $fromAddress) {
            return ['ok' => false, 'mode' => 'stub', 'detail' => 'SMTP credentials incomplete'];
        }

        $encryption = $creds['encryption'] ?? ($port === 465 ? 'ssl' : 'tls');
        config([
            'mail.default' => 'smtp',
            'mail.mailers.smtp.transport' => 'smtp',
            'mail.mailers.smtp.host' => $host,
            'mail.mailers.smtp.port' => $port,
            'mail.mailers.smtp.encryption' => $encryption,
            'mail.mailers.smtp.username' => $username,
            'mail.mailers.smtp.password' => $password,
        ]);

        try {
            Mail::html(nl2br(e($body)), function ($message) use ($to, $fromAddress, $fromName, $subject) {
                $message->to($to)
                    ->from($fromAddress, $fromName)
                    ->subject($subject);
            });

            return ['ok' => true, 'mode' => 'live', 'detail' => "Sent to {$to}"];
        } catch (\Throwable $e) {
            return ['ok' => false, 'mode' => 'live', 'detail' => $e->getMessage()];
        }
    }

    private function alreadySeen(ChannelConnection $connection, string $messageId): bool
    {
        $seen = $connection->meta['seen_message_ids'] ?? [];

        return in_array($messageId, $seen, true);
    }

    private function markSeen(ChannelConnection $connection, string $messageId): void
    {
        $meta = $connection->meta ?? [];
        $seen = $meta['seen_message_ids'] ?? [];
        $seen[] = $messageId;
        $meta['seen_message_ids'] = array_slice(array_values(array_unique($seen)), -500);
        $connection->update(['meta' => $meta]);
    }

    private function decodeMimeHeader(string $value): string
    {
        if ($value === '' || ! function_exists('imap_mime_header_decode')) {
            return $value;
        }

        $parts = imap_mime_header_decode($value);
        $out = '';
        foreach ($parts as $part) {
            $charset = strtoupper($part->charset ?? 'default');
            $text = $part->text ?? '';
            if ($charset !== 'DEFAULT' && $charset !== 'UTF-8' && function_exists('mb_convert_encoding')) {
                $text = @mb_convert_encoding($text, 'UTF-8', $charset) ?: $text;
            }
            $out .= $text;
        }

        return $out !== '' ? $out : $value;
    }

    private function extractBody($inbox, int $emailNumber, $structure): string
    {
        if (! $structure) {
            return $this->decodePart((string) (imap_body($inbox, $emailNumber) ?: ''), 0);
        }

        // Prefer text/plain, fall back to text/html stripped
        $plain = $this->findPart($inbox, $emailNumber, $structure, 'PLAIN');
        if ($plain !== null && trim($plain) !== '') {
            return trim($plain);
        }

        $html = $this->findPart($inbox, $emailNumber, $structure, 'HTML');
        if ($html !== null && trim($html) !== '') {
            return trim(html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        }

        $raw = imap_fetchbody($inbox, $emailNumber, '1');
        if ($raw === false || trim((string) $raw) === '') {
            $raw = imap_body($inbox, $emailNumber) ?: '';
        }

        return trim($this->decodePart((string) $raw, (int) ($structure->encoding ?? 0))) ?: '(empty email)';
    }

    private function findPart($inbox, int $emailNumber, $structure, string $subtype, string $prefix = ''): ?string
    {
        $subtype = strtoupper($subtype);

        if (isset($structure->parts) && is_array($structure->parts)) {
            foreach ($structure->parts as $index => $part) {
                $partNum = $prefix === '' ? (string) ($index + 1) : $prefix.'.'.($index + 1);
                $found = $this->findPart($inbox, $emailNumber, $part, $subtype, $partNum);
                if ($found !== null) {
                    return $found;
                }
            }

            return null;
        }

        $type = (int) ($structure->type ?? -1);
        $partSubtype = strtoupper((string) ($structure->subtype ?? ''));
        if ($type === 0 && $partSubtype === $subtype) {
            $section = $prefix === '' ? '1' : $prefix;
            $raw = imap_fetchbody($inbox, $emailNumber, $section);
            if ($raw === false) {
                return null;
            }

            return $this->decodePart((string) $raw, (int) ($structure->encoding ?? 0));
        }

        return null;
    }

    private function decodePart(string $body, int $encoding): string
    {
        $decoded = match ($encoding) {
            3 => base64_decode($body, true) ?: $body, // BASE64
            4 => quoted_printable_decode($body), // QUOTED-PRINTABLE
            default => $body,
        };

        if (! mb_check_encoding($decoded, 'UTF-8')) {
            $decoded = mb_convert_encoding($decoded, 'UTF-8', 'ISO-8859-1') ?: $decoded;
        }

        return $decoded;
    }
}
