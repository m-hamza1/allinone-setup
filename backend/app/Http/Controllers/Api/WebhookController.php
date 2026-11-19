<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChannelConnection;
use App\Services\MetaMessengerService;
use App\Services\SocialChannelAdapter;
use App\Services\TwilioSmsService;
use App\Services\WhatsAppCloudService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WebhookController extends Controller
{
    public function whatsApp(
        Request $request,
        int $accountId,
        WhatsAppCloudService $whatsApp,
    ): JsonResponse|\Illuminate\Http\Response {
        if ($request->isMethod('GET')) {
            return $whatsApp->verifyWebhook($request, $accountId);
        }

        $result = $whatsApp->handleInbound($accountId, $request->all());

        return response()->json(['data' => $result]);
    }

    public function meta(
        Request $request,
        int $accountId,
        MetaMessengerService $meta,
    ): JsonResponse|\Illuminate\Http\Response {
        $provider = (string) $request->query('provider', 'facebook');
        if (! in_array($provider, ['facebook', 'instagram'], true)) {
            $provider = 'facebook';
        }

        if ($request->isMethod('GET')) {
            return $meta->verifyWebhook($request, $accountId, $provider);
        }

        $result = $meta->handleInbound($accountId, $request->all(), $provider);

        return response()->json(['data' => $result], $result['ingested'] > 0 ? 201 : 200);
    }

    public function twilioSms(Request $request, TwilioSmsService $sms): JsonResponse
    {
        $result = $sms->handleInbound($request);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['error' => $result['detail'] ?? 'ingest_failed'], 422);
        }

        return response()->json(['data' => $result], 201);
    }

    public function telegram(Request $request, int $accountId, SocialChannelAdapter $social): JsonResponse
    {
        $message = $request->input('message') ?? $request->input('edited_message');
        if (! is_array($message)) {
            return response()->json(['ok' => true, 'detail' => 'ignored']);
        }

        $from = (string) ($message['from']['id'] ?? $message['chat']['id'] ?? 'unknown');
        $name = trim(($message['from']['first_name'] ?? '').' '.($message['from']['last_name'] ?? ''));
        $body = (string) ($message['text'] ?? $message['caption'] ?? '(telegram)');

        $conversation = $social->ingest('telegram', [
            'account_id' => $accountId,
            'from' => $from,
            'from_name' => $name !== '' ? $name : $from,
            'body' => $body,
        ]);

        return response()->json(['data' => ['conversation_id' => $conversation->id]], 201);
    }

    public function twitter(Request $request, int $accountId, SocialChannelAdapter $social): JsonResponse
    {
        $from = (string) ($request->input('from')
            ?? $request->input('direct_message_events.0.message_create.sender_id')
            ?? 'unknown');
        $body = (string) ($request->input('body')
            ?? $request->input('direct_message_events.0.message_create.message_data.text')
            ?? '(tweet/dm)');

        $conversation = $social->ingest('twitter', [
            'account_id' => $accountId,
            'from' => $from,
            'body' => $body,
        ]);

        return response()->json(['data' => ['conversation_id' => $conversation->id]], 201);
    }

    public function line(Request $request, int $accountId, SocialChannelAdapter $social): JsonResponse
    {
        $events = $request->input('events', []);
        $ingested = 0;
        $lastId = null;
        foreach ($events as $event) {
            if (($event['type'] ?? '') !== 'message') {
                continue;
            }
            $from = (string) ($event['source']['userId'] ?? 'unknown');
            $body = (string) ($event['message']['text'] ?? '(line)');
            $conversation = $social->ingest('line', [
                'account_id' => $accountId,
                'from' => $from,
                'body' => $body,
            ]);
            $lastId = $conversation->id;
            $ingested++;
        }

        if ($ingested === 0 && $request->filled('body')) {
            $conversation = $social->ingest('line', [
                'account_id' => $accountId,
                'from' => (string) $request->input('from', 'unknown'),
                'body' => (string) $request->input('body'),
            ]);
            $lastId = $conversation->id;
            $ingested = 1;
        }

        return response()->json(['data' => ['ingested' => $ingested, 'conversation_id' => $lastId]], $ingested ? 201 : 200);
    }

    public function apiChannel(Request $request, int $accountId, SocialChannelAdapter $social): JsonResponse
    {
        $data = $request->validate([
            'from' => ['required', 'string', 'max:190'],
            'from_name' => ['nullable', 'string', 'max:120'],
            'body' => ['required', 'string'],
            'token' => ['nullable', 'string'],
        ]);

        $connection = ChannelConnection::query()
            ->where('account_id', $accountId)
            ->where('provider', 'api')
            ->orderByDesc('id')
            ->first();

        if ($connection) {
            $expected = $connection->credentials['webhook_token'] ?? null;
            if ($expected && ! hash_equals((string) $expected, (string) ($data['token'] ?? ''))) {
                return response()->json(['error' => 'invalid_token'], 403);
            }
        }

        $conversation = $social->ingest('api', [
            'account_id' => $accountId,
            'from' => $data['from'],
            'from_name' => $data['from_name'] ?? $data['from'],
            'body' => $data['body'],
        ]);

        return response()->json(['data' => ['conversation_id' => $conversation->id]], 201);
    }
}
