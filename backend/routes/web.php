<?php

use App\Models\Inbox;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'app' => 'allin-api',
        'docs' => '/api/health',
    ]);
});

Route::get('/widget.js', function () {
    $api = rtrim(config('app.url'), '/').'/api';
    $app = env('FRONTEND_URL', 'http://localhost:3000');
    $js = <<<JS
(function(){
  if (window.__ALLIN_WIDGET__) return;
  window.__ALLIN_WIDGET__ = true;
  var s = document.currentScript || {};
  var token = s.getAttribute('data-token') || '';
  var api = s.getAttribute('data-api') || '{$api}';
  var app = s.getAttribute('data-app') || '{$app}';
  var position = (s.getAttribute('data-position') || 'right').toLowerCase();
  var color = s.getAttribute('data-color') || '#0f6e56';
  var label = s.getAttribute('data-label') || 'Chat';
  if (!token) { console.warn('[Allin] missing data-token'); return; }

  var open = false;
  var side = position === 'left' ? 'left' : 'right';

  var bubble = document.createElement('button');
  bubble.type = 'button';
  bubble.setAttribute('aria-label', 'Open chat');
  bubble.textContent = label;
  bubble.style.cssText = 'position:fixed;'+side+':20px;bottom:20px;z-index:2147483001;border:0;border-radius:999px;padding:14px 18px;background:'+color+';color:#fff;font:600 14px/1 system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.2);cursor:pointer;';

  var panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;'+side+':20px;bottom:76px;width:min(380px,calc(100vw - 24px));height:min(560px,calc(100vh - 110px));z-index:2147483000;display:none;border-radius:12px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.22);background:#fff;';

  var frame = document.createElement('iframe');
  frame.title = 'Allin Chat';
  frame.src = app + '/user?embed=1&widget_token=' + encodeURIComponent(token);
  frame.style.cssText = 'width:100%;height:100%;border:0;background:#fff;';
  panel.appendChild(frame);

  bubble.addEventListener('click', function(){
    open = !open;
    panel.style.display = open ? 'block' : 'none';
    bubble.textContent = open ? 'Close' : label;
    bubble.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  // Optional bootstrap theme from API
  try {
    fetch(api + '/widget/bootstrap?widget_token=' + encodeURIComponent(token))
      .then(function(r){ return r.json(); })
      .then(function(json){
        var theme = (json && json.data && json.data.theme) || {};
        if (theme.primary) {
          bubble.style.background = theme.primary;
          color = theme.primary;
        }
        if (theme.bubble_position === 'left') {
          bubble.style.left = '20px'; bubble.style.right = 'auto';
          panel.style.left = '20px'; panel.style.right = 'auto';
        }
        if (json && json.data && json.data.widget_title) {
          bubble.dataset.title = json.data.widget_title;
        }
      }).catch(function(){});
  } catch (e) {}

  document.body.appendChild(panel);
  document.body.appendChild(bubble);
})();
JS;

    return response($js, 200, [
        'Content-Type' => 'application/javascript; charset=UTF-8',
        'Cache-Control' => 'public, max-age=60',
    ]);
});

Route::get('/widget/bootstrap-check/{token}', function (string $token) {
    $inbox = Inbox::query()->where('widget_token', $token)->firstOrFail();

    return response()->json([
        'ok' => true,
        'inbox' => $inbox->only(['id', 'name', 'channel']),
    ]);
});
