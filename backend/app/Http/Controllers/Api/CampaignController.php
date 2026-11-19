<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\AuthorizesAccount;
use App\Http\Controllers\Controller;
use App\Models\Campaign;
use App\Models\User;
use App\Services\CampaignLauncher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CampaignController extends Controller
{
    use AuthorizesAccount;

    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $this->requirePermission($user, 'campaign_manage');

        $items = Campaign::query()
            ->with('inbox:id,name,channel')
            ->tap($this->accountScope($user))
            ->orderByDesc('id')
            ->get();

        return response()->json(['data' => $items]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $this->requirePermission($user, 'campaign_manage');

        $data = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'message' => ['required', 'string', 'max:5000'],
            'campaign_type' => ['sometimes', 'in:ongoing,one_off,live_chat,sms,whatsapp,email'],
            'status' => ['sometimes', 'in:draft,active,completed,disabled'],
            'inbox_id' => ['nullable', 'integer', 'exists:inboxes,id'],
            'audience' => ['nullable', 'array'],
            'audience.channel' => ['nullable', 'in:live_chat,sms,whatsapp,email,website'],
            'audience.label_ids' => ['nullable', 'array'],
            'audience.label_ids.*' => ['integer'],
            'audience.contact_status' => ['nullable', 'string', 'max:32'],
            'scheduled_at' => ['nullable', 'date'],
            'account_id' => ['nullable', 'integer', 'exists:accounts,id'],
        ]);

        $accountId = $user->isSuperAdmin()
            ? ($data['account_id'] ?? $user->account_id)
            : $user->account_id;

        $campaign = Campaign::query()->create([
            'account_id' => $accountId,
            'inbox_id' => $data['inbox_id'] ?? null,
            'title' => $data['title'],
            'message' => $data['message'],
            'campaign_type' => $data['campaign_type'] ?? 'ongoing',
            'status' => $data['status'] ?? 'draft',
            'audience' => $data['audience'] ?? [],
            'scheduled_at' => $data['scheduled_at'] ?? null,
        ]);

        return response()->json(['data' => $campaign->load('inbox:id,name,channel')], 201);
    }

    public function update(Request $request, Campaign $campaign): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin(), 403);
        $this->authorizeAccount($user, $campaign);

        $data = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:120'],
            'message' => ['sometimes', 'required', 'string', 'max:5000'],
            'campaign_type' => ['sometimes', 'in:ongoing,one_off,live_chat,sms,whatsapp,email'],
            'status' => ['sometimes', 'in:draft,active,completed,disabled'],
            'inbox_id' => ['nullable', 'integer', 'exists:inboxes,id'],
            'audience' => ['nullable', 'array'],
            'audience.channel' => ['nullable', 'in:live_chat,sms,whatsapp,email,website'],
            'audience.label_ids' => ['nullable', 'array'],
            'audience.label_ids.*' => ['integer'],
            'audience.contact_status' => ['nullable', 'string', 'max:32'],
            'scheduled_at' => ['nullable', 'date'],
        ]);

        $campaign->update($data);

        return response()->json(['data' => $campaign->fresh()->load('inbox:id,name,channel')]);
    }

    public function destroy(Request $request, Campaign $campaign): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin(), 403);
        $this->authorizeAccount($user, $campaign);
        $campaign->delete();

        return response()->json(['ok' => true]);
    }

    public function launch(Request $request, Campaign $campaign, CampaignLauncher $launcher): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $this->requirePermission($user, 'campaign_manage');
        $this->authorizeAccount($user, $campaign);

        $result = $launcher->launch($campaign);

        return response()->json([
            'data' => $campaign->fresh()->load('inbox:id,name,channel'),
            'delivery' => $result,
        ]);
    }
}
