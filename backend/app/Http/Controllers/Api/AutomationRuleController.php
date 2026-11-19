<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\AuthorizesAccount;
use App\Http\Controllers\Controller;
use App\Models\AutomationRule;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\AutomationRunner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AutomationRuleController extends Controller
{
    use AuthorizesAccount;

    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $this->requirePermission($user, 'automation_manage');

        $items = AutomationRule::query()
            ->tap($this->accountScope($user))
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $items]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $this->requirePermission($user, 'automation_manage');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'event' => ['required', 'string', 'max:64', Rule::in(AutomationRunner::EVENTS)],
            'conditions' => ['nullable', 'array'],
            'actions' => ['nullable', 'array'],
            'active' => ['sometimes', 'boolean'],
            'account_id' => ['nullable', 'integer', 'exists:accounts,id'],
        ]);

        $accountId = $user->isSuperAdmin()
            ? ($data['account_id'] ?? $user->account_id)
            : $user->account_id;

        $rule = AutomationRule::query()->create([
            'account_id' => $accountId,
            'name' => $data['name'],
            'event' => $data['event'],
            'conditions' => $data['conditions'] ?? [],
            'actions' => $data['actions'] ?? [],
            'active' => $data['active'] ?? true,
        ]);

        try {
            AuditLogger::log($user, 'automation.created', $rule);
        } catch (\Throwable) {
            // best-effort audit
        }

        return response()->json(['data' => $rule], 201);
    }

    public function update(Request $request, AutomationRule $automationRule): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin(), 403);
        $this->authorizeAccount($user, $automationRule);

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:120'],
            'event' => ['sometimes', 'required', 'string', 'max:64', Rule::in(AutomationRunner::EVENTS)],
            'conditions' => ['nullable', 'array'],
            'actions' => ['nullable', 'array'],
            'active' => ['sometimes', 'boolean'],
        ]);

        $automationRule->update($data);

        return response()->json(['data' => $automationRule->fresh()]);
    }

    public function destroy(Request $request, AutomationRule $automationRule): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin(), 403);
        $this->authorizeAccount($user, $automationRule);
        $automationRule->delete();

        return response()->json(['ok' => true]);
    }
}
