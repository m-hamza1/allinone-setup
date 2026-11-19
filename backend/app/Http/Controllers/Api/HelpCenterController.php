<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\AuthorizesAccount;
use App\Http\Controllers\Controller;
use App\Models\HelpCenterArticle;
use App\Models\HelpCenterCategory;
use App\Models\HelpCenterPortal;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class HelpCenterController extends Controller
{
    use AuthorizesAccount;

    public function portals(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $this->requirePermission($user, 'knowledge_base_manage');

        $portals = HelpCenterPortal::query()
            ->withCount(['categories', 'articles'])
            ->with([
                'categories' => fn ($q) => $q->orderBy('position')->orderBy('name'),
                'articles' => fn ($q) => $q->orderByDesc('updated_at'),
            ])
            ->tap($this->accountScope($user))
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $portals]);
    }

    public function updatePortal(Request $request, HelpCenterPortal $helpCenterPortal): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin(), 403);
        $this->authorizeAccount($user, $helpCenterPortal);

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:120'],
            'headline' => ['nullable', 'string', 'max:255'],
            'default_locale' => ['nullable', 'string', 'max:12'],
            'locales' => ['nullable', 'array'],
            'locales.*' => ['string', 'max:12'],
            'is_published' => ['sometimes', 'boolean'],
            'slug' => ['sometimes', 'required', 'string', 'max:120'],
        ]);

        $helpCenterPortal->update($data);

        return response()->json(['data' => $helpCenterPortal->fresh()->loadCount(['categories', 'articles'])]);
    }

    public function updateArticle(Request $request, HelpCenterArticle $helpCenterArticle): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin(), 403);

        $portal = HelpCenterPortal::query()->findOrFail($helpCenterArticle->portal_id);
        $this->authorizeAccount($user, $portal);

        $data = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:190'],
            'body' => ['nullable', 'string'],
            'category_id' => ['nullable', 'integer', 'exists:help_center_categories,id'],
            'status' => ['sometimes', 'in:draft,published'],
            'locale' => ['nullable', 'string', 'max:12'],
            'slug' => ['sometimes', 'required', 'string', 'max:190'],
        ]);

        $helpCenterArticle->update($data);

        return response()->json(['data' => $helpCenterArticle->fresh()]);
    }

    public function destroyArticle(Request $request, HelpCenterArticle $helpCenterArticle): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin(), 403);
        $portal = HelpCenterPortal::query()->findOrFail($helpCenterArticle->portal_id);
        $this->authorizeAccount($user, $portal);
        $helpCenterArticle->delete();

        return response()->json(['ok' => true]);
    }

    public function storePortal(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin(), 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'slug' => ['nullable', 'string', 'max:120'],
            'headline' => ['nullable', 'string', 'max:255'],
            'default_locale' => ['nullable', 'string', 'max:12'],
            'locales' => ['nullable', 'array'],
            'locales.*' => ['string', 'max:12'],
            'is_published' => ['sometimes', 'boolean'],
            'account_id' => ['nullable', 'integer', 'exists:accounts,id'],
        ]);

        $accountId = $user->isSuperAdmin()
            ? ($data['account_id'] ?? $user->account_id)
            : $user->account_id;

        $portal = HelpCenterPortal::query()->create([
            'account_id' => $accountId,
            'name' => $data['name'],
            'slug' => $data['slug'] ?? Str::slug($data['name']),
            'headline' => $data['headline'] ?? null,
            'default_locale' => $data['default_locale'] ?? 'en',
            'locales' => $data['locales'] ?? ['en'],
            'is_published' => $data['is_published'] ?? false,
        ]);

        return response()->json(['data' => $portal], 201);
    }

    public function storeCategory(Request $request, HelpCenterPortal $helpCenterPortal): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin(), 403);
        $this->authorizeAccount($user, $helpCenterPortal);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'slug' => ['nullable', 'string', 'max:120'],
            'position' => ['sometimes', 'integer', 'min:0'],
        ]);

        $category = HelpCenterCategory::query()->create([
            'portal_id' => $helpCenterPortal->id,
            'name' => $data['name'],
            'slug' => $data['slug'] ?? Str::slug($data['name']),
            'position' => $data['position'] ?? 0,
        ]);

        return response()->json(['data' => $category], 201);
    }

    public function storeArticle(Request $request, HelpCenterPortal $helpCenterPortal): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin(), 403);
        $this->authorizeAccount($user, $helpCenterPortal);

        $data = $request->validate([
            'title' => ['required', 'string', 'max:190'],
            'slug' => ['nullable', 'string', 'max:190'],
            'body' => ['nullable', 'string'],
            'category_id' => ['nullable', 'integer', 'exists:help_center_categories,id'],
            'status' => ['sometimes', 'in:draft,published'],
            'locale' => ['nullable', 'string', 'max:12'],
        ]);

        $article = HelpCenterArticle::query()->create([
            'portal_id' => $helpCenterPortal->id,
            'category_id' => $data['category_id'] ?? null,
            'title' => $data['title'],
            'slug' => $data['slug'] ?? Str::slug($data['title']),
            'body' => $data['body'] ?? null,
            'status' => $data['status'] ?? 'draft',
            'locale' => $data['locale'] ?? ($helpCenterPortal->default_locale ?? 'en'),
        ]);

        return response()->json(['data' => $article], 201);
    }

    public function showPublic(Request $request, string $slug): JsonResponse
    {
        $locale = (string) $request->query('locale', '');
        $search = trim((string) $request->query('q', ''));

        $portal = HelpCenterPortal::query()
            ->where('slug', $slug)
            ->where('is_published', true)
            ->with([
                'categories' => fn ($q) => $q->orderBy('position'),
                'articles' => function ($q) use ($locale, $search) {
                    $q->where('status', 'published');
                    if ($locale !== '') {
                        $q->where('locale', $locale);
                    }
                    if ($search !== '') {
                        $term = '%'.$search.'%';
                        $q->where(function ($inner) use ($term) {
                            $inner->where('title', 'ilike', $term)
                                ->orWhere('body', 'ilike', $term);
                        });
                    }
                    $q->orderBy('title');
                },
            ])
            ->firstOrFail();

        return response()->json(['data' => $portal]);
    }
}
