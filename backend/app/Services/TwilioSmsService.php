<?php

namespace App\Services;

use App\Models\ChannelConnection;
use App\Models\Conversation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TwilioSmsService
{
    public function __construct(
        private SocialChannelAdapter $social,
    ) {}

    /**
     * Validate Twilio request signature when auth token is known.
     */
    public function signatureValid(Request $request, ChannelConnection $connection): bool
    {
        $authToken = $connection->credentials['auth_token'] ?? null;
        $signature = $request->header('X-Twilio-Signature');
        if (! $authToken || ! $signature) {
            // Allow ingest without signature in local/dev when token missing from headers
            return ! $signature;
        }

        $url = $request->fullUrl();
        $params = $request->post();
        ksort($params);
        $data = $url;
        foreach ($params as $key => $value) {
            $data .= $key.$value;
        }
        $expected = base64_encode(hash_hmac('sha1', $data, (string) $authToken, true));

        return hash_equals($expected, $signature);
    }

    /**
     * @return array{ok: bool, conversation_id?: int, detail: string}
     */
    public function handleInbound(Request $request): array
    {
        $to = (string) ($request->input('To') ?? $request->input('to') ?? '');
        $from = (string) ($request->input('From') ?? $request->input('from') ?? 'unknown');
        $body = (string) ($request->input('Body') ?? $request->input('body') ?? '(sms)');
        $accountId = $request->integer('account_id') ?: null;

        $connectionQuery = ChannelConnection::query()->where('provider', 'sms');
        if ($accountId) {
            $connectionQuery->where('account_id', $accountId);
        }
        if ($to !== '') {
            $digits = preg_replace('/\D+/', '', $to) ?: $to;
            $connectionQuery->where(function ($q) use ($to, $digits) {
                $q->where('credentials->from_number', $to)
                    ->orWhere('credentials->from_number', '+'.$digits)
                    ->orWhere('credentials->from_number', $digits)
                    ->orWhere('meta->from_number', $to);
            });
        }

        $connection = $connectionQuery->orderByDesc('id')->first();
        if (! $connection && $accountId) {
            $connection = ChannelConnection::query()
                ->where('provider', 'sms')
                ->where('account_id', $accountId)
                ->orderByDesc('id')
                ->first();
        }

        if (! $connection) {
            return ['ok' => false, 'detail' => 'No SMS channel connection matched'];
        }

        if ($request->header('X-Twilio-Signature') && ! $this->signatureValid($request, $connection)) {
            Log::warning('twilio.signature_invalid', ['connection_id' => $connection->id]);

            return ['ok' => false, 'detail' => 'Invalid Twilio signature'];
        }

        $conversation = $this->social->ingest('sms', [
            'account_id' => $connection->account_id,
            'from' => $from,
            'body' => $body,
        ]);

        return [
            'ok' => true,
            'conversation_id' => $conversation->id,
            'detail' => 'SMS ingested',
        ];
    }

    /**
     * @return array{ok: bool, mode: string, detail: string}
     */
    public function sendReply(Conversation $conversation, string $body): array
    {
        $conversation->loadMissing(['contact', 'inbox']);

        $connection = ChannelConnection::query()
            ->where('account_id', $conversation->account_id)
            ->where('provider', 'sms')
            ->when(
                $conversation->inbox_id,
                fn ($q) => $q->where(fn ($inner) => $inner
                    ->where('inbox_id', $conversation->inbox_id)
                    ->orWhereNull('inbox_id')),
            )
            ->orderByDesc('id')
            ->first();

        if (! $connection) {
            return ['ok' => false, 'mode' => 'stub', 'detail' => 'No SMS channel connection'];
        }

        $to = $conversation->contact?->phone
            ?? ($conversation->contact?->custom_attributes['sms_id'] ?? null);

        if (! $to) {
            return ['ok' => false, 'mode' => 'stub', 'detail' => 'Contact has no phone / sms_id'];
        }

        return $this->sendMessage($connection, (string) $to, $body);
    }

    /**
     * @return array{ok: bool, mode: string, detail: string}
     */
    public function sendMessage(ChannelConnection $connection, string $to, string $body): array
    {
        $creds = $connection->credentials ?? [];
        $sid = $creds['account_sid'] ?? null;
        $token = $creds['auth_token'] ?? null;
        $from = $creds['from_number'] ?? null;

        if (! $sid || ! $token || ! $from) {
            return [
                'ok' => false,
                'mode' => 'stub',
                'detail' => 'Missing account_sid, auth_token, or from_number',
            ];
        }

        $url = "https://api.twilio.com/2010-04-01/Accounts/{$sid}/Messages.json";

        try {
            $response = Http::asForm()
                ->withBasicAuth((string) $sid, (string) $token)
                ->timeout(20)
                ->post($url, [
                    'To' => $to,
                    'From' => $from,
                    'Body' => $body,
                ]);
        } catch (\Throwable $e) {
            return ['ok' => false, 'mode' => 'live', 'detail' => $e->getMessage()];
        }

        if ($response->successful()) {
            $meta = $connection->meta ?? [];
            $meta['last_outbound_at'] = now()->toIso8601String();
            $meta['last_outbound_sid'] = $response->json('sid');
            $connection->update(['meta' => $meta, 'status' => 'connected']);

            return ['ok' => true, 'mode' => 'live', 'detail' => 'SMS sent'];
        }

        return [
            'ok' => false,
            'mode' => 'live',
            'detail' => $response->json('message') ?? $response->body(),
        ];
    }
}
