<?php

use App\Http\Controllers\Api\AccountSettingsController;
use App\Http\Controllers\Api\AgentBotController;
use App\Http\Controllers\Api\AgentTeamController;
use App\Http\Controllers\Api\AssignmentPolicyController;
use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AutomationRuleController;
use App\Http\Controllers\Api\CampaignController;
use App\Http\Controllers\Api\CannedResponseController;
use App\Http\Controllers\Api\ChannelConnectionController;
use App\Http\Controllers\Api\ContactController;
use App\Http\Controllers\Api\ContactNoteController;
use App\Http\Controllers\Api\ConversationController;
use App\Http\Controllers\Api\CustomAttributeController;
use App\Http\Controllers\Api\CustomRoleController;
use App\Http\Controllers\Api\CustomViewController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\HelpCenterController;
use App\Http\Controllers\Api\InboxBootstrapController;
use App\Http\Controllers\Api\InboxController;
use App\Http\Controllers\Api\IntegrationController;
use App\Http\Controllers\Api\LabelController;
use App\Http\Controllers\Api\MacroController;
use App\Http\Controllers\Api\MessageTemplateController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SlaPolicyController;
use App\Http\Controllers\Api\TeamController;
use App\Http\Controllers\Api\WebhookController;
use App\Http\Controllers\Api\WidgetController;
use App\Http\Controllers\Api\TwoFactorController;
use App\Http\Controllers\Api\SsoController;
use App\Http\Controllers\Api\PlatformApiController;
use App\Http\Controllers\Api\CaptainController;
use App\Services\EmailChannelService;
use App\Services\SocialChannelAdapter;
use Illuminate\Support\Facades\Route;

Route::get('/health', fn () => response()->json([
    'app' => 'allin',
    'status' => 'ok',
]));

Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword']);
Route::post('/auth/reset-password', [AuthController::class, 'resetPassword']);
Route::post('/auth/2fa/verify', [AuthController::class, 'verifyTwoFactor']);
Route::get('/auth/sso/google/redirect', [SsoController::class, 'googleRedirect']);
Route::post('/auth/sso/google/callback', [SsoController::class, 'googleCallback']);
Route::get('/auth/sso/google/callback', [SsoController::class, 'googleCallback']);

Route::prefix('platform/v1')->middleware('platform.token')->group(function () {
    Route::get('/contacts', [PlatformApiController::class, 'contacts']);
    Route::post('/contacts', [PlatformApiController::class, 'createContact']);
    Route::get('/conversations', [PlatformApiController::class, 'conversations']);
    Route::post('/messages/ingest', [PlatformApiController::class, 'ingest']);
});

Route::prefix('widget')->group(function () {
    Route::get('/bootstrap', [WidgetController::class, 'bootstrap']);
    Route::post('/start', [WidgetController::class, 'start']);
    Route::post('/conversations/{conversation}/messages', [WidgetController::class, 'message']);
    Route::get('/conversations/{conversation}/messages', [WidgetController::class, 'poll']);
    Route::post('/conversations/{conversation}/csat', [ConversationController::class, 'submitCsat']);
});

Route::get('/help/{slug}', [HelpCenterController::class, 'showPublic']);

Route::match(['GET', 'POST'], '/webhooks/whatsapp/{accountId}', [WebhookController::class, 'whatsApp']);
Route::match(['GET', 'POST'], '/webhooks/meta/{accountId}', [WebhookController::class, 'meta']);
Route::post('/webhooks/twilio/sms', [WebhookController::class, 'twilioSms']);
Route::post('/webhooks/telegram/{accountId}', [WebhookController::class, 'telegram']);
Route::post('/webhooks/api-channel/{accountId}', [WebhookController::class, 'apiChannel']);
Route::post('/webhooks/twitter/{accountId}', [WebhookController::class, 'twitter']);
Route::post('/webhooks/line/{accountId}', [WebhookController::class, 'line']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    Route::get('/inbox/bootstrap', InboxBootstrapController::class);
    Route::get('/inbox/sync', [InboxBootstrapController::class, 'sync']);

    Route::get('/conversations', [ConversationController::class, 'index']);
    Route::get('/conversations/mentions', [ConversationController::class, 'mentions']);
    Route::put('/conversations/{conversation}/meta', [ConversationController::class, 'updateMeta']);
    Route::post('/conversations/{conversation}/meta', [ConversationController::class, 'updateMeta']);
    Route::get('/conversations/{conversation}', [ConversationController::class, 'show']);
    Route::get('/conversations/{conversation}/messages', [ConversationController::class, 'messages']);
    Route::post('/conversations/{conversation}/reply', [ConversationController::class, 'reply']);
    Route::post('/conversations/{conversation}/labels', [ConversationController::class, 'syncLabels']);
    Route::post('/conversations/{conversation}/assign', [ConversationController::class, 'assign']);
    Route::post('/conversations/{conversation}/team', [ConversationController::class, 'assignTeam']);
    Route::post('/conversations/{conversation}/presence', [ConversationController::class, 'presence']);
    Route::post('/conversations/{conversation}/resolve', [ConversationController::class, 'resolve']);
    Route::post('/conversations/{conversation}/reopen', [ConversationController::class, 'reopen']);

    Route::get('/contacts', [ContactController::class, 'index']);
    Route::post('/contacts', [ContactController::class, 'store']);
    Route::get('/contacts/{contact}', [ContactController::class, 'show']);
    Route::put('/contacts/{contact}', [ContactController::class, 'update']);
    Route::get('/contacts/{contact}/notes', [ContactNoteController::class, 'index']);
    Route::post('/contacts/{contact}/notes', [ContactNoteController::class, 'store']);
    Route::delete('/contact-notes/{contactNote}', [ContactNoteController::class, 'destroy']);

    Route::get('/inboxes', [InboxController::class, 'index']);
    Route::post('/inboxes', [InboxController::class, 'store']);
    Route::post('/inboxes/{inbox}/rotate-token', [InboxController::class, 'rotateToken']);

    Route::get('/labels', [LabelController::class, 'index']);
    Route::post('/labels', [LabelController::class, 'store']);
    Route::put('/labels/{label}', [LabelController::class, 'update']);
    Route::delete('/labels/{label}', [LabelController::class, 'destroy']);

    Route::get('/canned-responses', [CannedResponseController::class, 'index']);
    Route::post('/canned-responses', [CannedResponseController::class, 'store']);
    Route::put('/canned-responses/{cannedResponse}', [CannedResponseController::class, 'update']);
    Route::delete('/canned-responses/{cannedResponse}', [CannedResponseController::class, 'destroy']);

    Route::get('/agent-teams', [AgentTeamController::class, 'index']);
    Route::post('/agent-teams', [AgentTeamController::class, 'store']);
    Route::put('/agent-teams/{team}', [AgentTeamController::class, 'update']);
    Route::delete('/agent-teams/{team}', [AgentTeamController::class, 'destroy']);

    Route::get('/custom-views', [CustomViewController::class, 'index']);
    Route::post('/custom-views', [CustomViewController::class, 'store']);
    Route::put('/custom-views/{customView}', [CustomViewController::class, 'update']);
    Route::delete('/custom-views/{customView}', [CustomViewController::class, 'destroy']);

    Route::get('/automations', [AutomationRuleController::class, 'index']);
    Route::post('/automations', [AutomationRuleController::class, 'store']);
    Route::put('/automations/{automationRule}', [AutomationRuleController::class, 'update']);
    Route::delete('/automations/{automationRule}', [AutomationRuleController::class, 'destroy']);

    Route::get('/macros', [MacroController::class, 'index']);
    Route::post('/macros', [MacroController::class, 'store']);
    Route::put('/macros/{macro}', [MacroController::class, 'update']);
    Route::delete('/macros/{macro}', [MacroController::class, 'destroy']);
    Route::post('/macros/{macro}/apply/{conversation}', [MacroController::class, 'apply']);

    Route::get('/custom-attributes', [CustomAttributeController::class, 'index']);
    Route::post('/custom-attributes', [CustomAttributeController::class, 'store']);
    Route::delete('/custom-attributes/{customAttributeDefinition}', [CustomAttributeController::class, 'destroy']);

    Route::get('/account/settings', [AccountSettingsController::class, 'show']);
    Route::put('/account/settings', [AccountSettingsController::class, 'update']);

    Route::get('/reports/overview', [ReportController::class, 'overview']);

    Route::get('/agents', function (\Illuminate\Http\Request $request) {
        /** @var \App\Models\User $user */
        $user = $request->user();
        abort_unless($user->isAdmin() || $user->canPermission('team_manage'), 403);
        $agents = \App\Models\User::query()
            ->with('customRole:id,name')
            ->when(! $user->isSuperAdmin(), fn ($q) => $q->where('account_id', $user->account_id))
            ->whereIn('role', ['staff', 'admin'])
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'role', 'custom_role_id']);

        return response()->json(['data' => $agents]);
    });

    Route::get('/channels', [ChannelConnectionController::class, 'index']);
    Route::post('/channels', [ChannelConnectionController::class, 'store']);
    Route::put('/channels/{channelConnection}', [ChannelConnectionController::class, 'update']);
    Route::delete('/channels/{channelConnection}', [ChannelConnectionController::class, 'destroy']);
    Route::post('/channels/email/ingest', function (\Illuminate\Http\Request $request, EmailChannelService $email) {
        abort_unless($request->user()?->isAdmin(), 403);
        $data = $request->validate([
            'from_email' => ['required', 'email'],
            'from_name' => ['nullable', 'string', 'max:120'],
            'subject' => ['nullable', 'string', 'max:255'],
            'body' => ['required', 'string'],
            'account_id' => ['nullable', 'integer'],
        ]);

        return response()->json(['data' => $email->ingest($data)], 201);
    });
    Route::post('/channels/email/poll', function (\Illuminate\Http\Request $request, EmailChannelService $email) {
        abort_unless($request->user()?->isAdmin(), 403);
        /** @var \App\Models\User $user */
        $user = $request->user();
        $connections = \App\Models\ChannelConnection::query()
            ->where('provider', 'email')
            ->where('status', 'connected')
            ->when(! $user->isSuperAdmin(), fn ($q) => $q->where('account_id', $user->account_id))
            ->get();

        $results = [];
        foreach ($connections as $connection) {
            $results[] = [
                'connection_id' => $connection->id,
                ...$email->pollConnection($connection),
            ];
        }

        return response()->json(['data' => $results]);
    });

    Route::post('/channels/{provider}/ingest', function (
        string $provider,
        \Illuminate\Http\Request $request,
        SocialChannelAdapter $social,
    ) {
        abort_unless($request->user()?->isAdmin(), 403);
        abort_unless(in_array($provider, ['whatsapp', 'instagram', 'facebook', 'sms', 'telegram', 'api', 'twitter', 'line'], true), 404);
        $data = $request->validate([
            'from' => ['required', 'string', 'max:120'],
            'from_name' => ['nullable', 'string', 'max:120'],
            'body' => ['required', 'string'],
            'account_id' => ['nullable', 'integer'],
        ]);

        return response()->json(['data' => $social->ingest($provider, $data)], 201);
    });

    Route::post('/channels/{channelConnection}/send-test', function (
        \App\Models\ChannelConnection $channelConnection,
        \Illuminate\Http\Request $request,
        SocialChannelAdapter $social,
    ) {
        abort_unless($request->user()?->isAdmin(), 403);
        $data = $request->validate([
            'to' => ['required', 'string', 'max:120'],
            'body' => ['required', 'string'],
        ]);

        return response()->json(['data' => $social->send($channelConnection, $data['to'], $data['body'])]);
    });

    Route::get('/sla-policies', [SlaPolicyController::class, 'index']);
    Route::post('/sla-policies', [SlaPolicyController::class, 'store']);
    Route::delete('/sla-policies/{slaPolicy}', [SlaPolicyController::class, 'destroy']);

    Route::get('/help-center/portals', [HelpCenterController::class, 'portals']);
    Route::post('/help-center/portals', [HelpCenterController::class, 'storePortal']);
    Route::put('/help-center/portals/{helpCenterPortal}', [HelpCenterController::class, 'updatePortal']);
    Route::post('/help-center/portals/{helpCenterPortal}/categories', [HelpCenterController::class, 'storeCategory']);
    Route::post('/help-center/portals/{helpCenterPortal}/articles', [HelpCenterController::class, 'storeArticle']);
    Route::put('/help-center/articles/{helpCenterArticle}', [HelpCenterController::class, 'updateArticle']);
    Route::delete('/help-center/articles/{helpCenterArticle}', [HelpCenterController::class, 'destroyArticle']);

    Route::get('/campaigns', [CampaignController::class, 'index']);
    Route::post('/campaigns', [CampaignController::class, 'store']);
    Route::put('/campaigns/{campaign}', [CampaignController::class, 'update']);
    Route::post('/campaigns/{campaign}/launch', [CampaignController::class, 'launch']);
    Route::delete('/campaigns/{campaign}', [CampaignController::class, 'destroy']);

    Route::get('/team', [TeamController::class, 'index']);
    Route::post('/team', [TeamController::class, 'store']);
    Route::put('/team/{member}', [TeamController::class, 'update']);

    Route::get('/dashboard/stats', [DashboardController::class, 'stats']);

    Route::get('/assignment-policies', [AssignmentPolicyController::class, 'index']);
    Route::post('/assignment-policies', [AssignmentPolicyController::class, 'store']);
    Route::put('/assignment-policies/{assignmentPolicy}', [AssignmentPolicyController::class, 'update']);
    Route::delete('/assignment-policies/{assignmentPolicy}', [AssignmentPolicyController::class, 'destroy']);

    Route::get('/message-templates', [MessageTemplateController::class, 'index']);
    Route::post('/message-templates', [MessageTemplateController::class, 'store']);
    Route::put('/message-templates/{messageTemplate}', [MessageTemplateController::class, 'update']);
    Route::delete('/message-templates/{messageTemplate}', [MessageTemplateController::class, 'destroy']);

    Route::get('/agent-bots', [AgentBotController::class, 'index']);
    Route::post('/agent-bots', [AgentBotController::class, 'store']);
    Route::put('/agent-bots/{agentBot}', [AgentBotController::class, 'update']);
    Route::delete('/agent-bots/{agentBot}', [AgentBotController::class, 'destroy']);

    Route::get('/audit-logs', [AuditLogController::class, 'index']);

    Route::get('/custom-roles/catalog', [CustomRoleController::class, 'catalog']);
    Route::get('/custom-roles', [CustomRoleController::class, 'index']);
    Route::post('/custom-roles', [CustomRoleController::class, 'store']);
    Route::put('/custom-roles/{customRole}', [CustomRoleController::class, 'update']);
    Route::delete('/custom-roles/{customRole}', [CustomRoleController::class, 'destroy']);

    Route::get('/profile', [ProfileController::class, 'show']);
    Route::put('/profile', [ProfileController::class, 'update']);

    Route::get('/auth/2fa', [TwoFactorController::class, 'status']);
    Route::post('/auth/2fa/setup', [TwoFactorController::class, 'setup']);
    Route::post('/auth/2fa/confirm', [TwoFactorController::class, 'confirm']);
    Route::post('/auth/2fa/disable', [TwoFactorController::class, 'disable']);
    Route::get('/auth/sso/providers', [SsoController::class, 'providers']);

    Route::get('/integrations', [IntegrationController::class, 'index']);
    Route::match(['put', 'post'], '/integrations/{key}', [IntegrationController::class, 'update']);
    Route::post('/integrations/{key}/test', [IntegrationController::class, 'test']);

    Route::get('/platform/tokens', [PlatformApiController::class, 'indexTokens']);
    Route::post('/platform/tokens', [PlatformApiController::class, 'createToken']);
    Route::delete('/platform/tokens/{platformApiToken}', [PlatformApiController::class, 'destroyToken']);

    Route::get('/captain/settings', [CaptainController::class, 'settings']);
    Route::put('/captain/settings', [CaptainController::class, 'updateSettings']);
    Route::post('/conversations/{conversation}/captain-draft', [CaptainController::class, 'draft']);

    Route::post('/conversations/{conversation}/suggest-reply', function (
        \Illuminate\Http\Request $request,
        \App\Models\Conversation $conversation,
        \App\Services\CaptainAiService $captain,
    ) {
        /** @var \App\Models\User $user */
        $user = $request->user();
        abort_unless($user->canPermission('conversation_manage'), 403);
        if (! $user->isSuperAdmin()) {
            abort_unless($conversation->account_id === $user->account_id, 403);
        }
        $account = \App\Models\Account::query()->findOrFail($conversation->account_id);

        return response()->json(['data' => $captain->draft($account, $conversation)]);
    });
});
