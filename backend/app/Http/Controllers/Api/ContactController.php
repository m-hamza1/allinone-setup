<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\AuthorizesAccount;
use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ContactController extends Controller
{
    use AuthorizesAccount;

    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $this->requirePermission($user, 'contact_manage');

        $contacts = Contact::query()
            ->withCount('conversations')
            ->tap($this->accountScope($user))
            ->when($request->query('search'), function ($q) use ($request) {
                $term = '%'.$request->query('search').'%';
                $q->where(function ($inner) use ($term) {
                    $inner->where('name', 'ilike', $term)
                        ->orWhere('email', 'ilike', $term)
                        ->orWhere('phone', 'ilike', $term);
                });
            })
            ->orderByDesc('updated_at')
            ->paginate(30);

        return response()->json($contacts);
    }

    public function show(Request $request, Contact $contact): JsonResponse
    {
        $this->authorizeAccount($request->user(), $contact);

        $contact->load([
            'notes' => fn ($q) => $q->with('user:id,name')->orderByDesc('id'),
            'conversations' => fn ($q) => $q
                ->with(['inbox:id,name', 'assignee:id,name'])
                ->orderByDesc('last_activity_at'),
        ]);

        return response()->json(['data' => $contact]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->account_id || $user->isSuperAdmin(), 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['nullable', 'email', 'max:190'],
            'phone' => ['nullable', 'string', 'max:40'],
            'account_id' => ['nullable', 'exists:accounts,id'],
        ]);

        $accountId = $user->isSuperAdmin()
            ? ($data['account_id'] ?? $user->account_id)
            : $user->account_id;

        abort_unless($accountId, 422, 'account_id is required');

        $contact = Contact::query()->create([
            'account_id' => $accountId,
            'name' => $data['name'],
            'email' => $data['email'] ?? null,
            'phone' => $data['phone'] ?? null,
        ]);

        return response()->json(['data' => $contact], 201);
    }

    public function update(Request $request, Contact $contact): JsonResponse
    {
        $this->authorizeAccount($request->user(), $contact);

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:120'],
            'email' => ['nullable', 'email', 'max:190'],
            'phone' => ['nullable', 'string', 'max:40'],
            'custom_attributes' => ['sometimes', 'array'],
        ]);

        $contact->update($data);

        return response()->json(['data' => $contact->fresh()]);
    }
}
