<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\AuthorizesAccount;
use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Models\ContactNote;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ContactNoteController extends Controller
{
    use AuthorizesAccount;

    public function index(Request $request, Contact $contact): JsonResponse
    {
        $this->authorizeAccount($request->user(), $contact);

        $notes = ContactNote::query()
            ->with('user:id,name')
            ->where('contact_id', $contact->id)
            ->orderByDesc('id')
            ->get();

        return response()->json(['data' => $notes]);
    }

    public function store(Request $request, Contact $contact): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $this->authorizeAccount($user, $contact);

        $data = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
        ]);

        $note = ContactNote::query()->create([
            'account_id' => $contact->account_id,
            'contact_id' => $contact->id,
            'user_id' => $user->id,
            'body' => $data['body'],
        ]);

        return response()->json(['data' => $note->load('user:id,name')], 201);
    }

    public function destroy(Request $request, ContactNote $contactNote): JsonResponse
    {
        $this->authorizeAccount($request->user(), $contactNote);
        $contactNote->delete();

        return response()->json(['ok' => true]);
    }
}
