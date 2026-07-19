/**
 * Cloudflare Pages 中间件 - 远程熔断
 *
 * 每个请求都会先经过这里：
 *   - 从 Gist 拉取授权状态
 *   - enabled=false → 返回锁屏页面（用户看不到任何内容）
 *   - enabled=true  → 正常返回静态文件
 *
 * 你改 Gist 内容后，最长 60 秒生效。
 */

// Gist raw URL（从 Cloudflare Pages 环境变量读取，避免硬编码）
// 在 Cloudflare Dashboard → Pages → 你的项目 → Settings → Environment Variables
// 添加变量名: KILL_SWITCH_URL  值: https://gist.githubusercontent.com/.../raw/switch.json
// 默认关闭（防止忘了配置导致开门）
const DEFAULT_URL = '';

// 锁屏页面（简洁纯 HTML，不泄露任何原站内容）
const LOCKED_PAGE = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>系统维护中</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{
      background:#080c14;color:#e0e6f0;
      font-family:PingFang SC,Microsoft YaHei,sans-serif;
      height:100vh;display:flex;align-items:center;justify-content:center;
      text-align:center;
    }
    .box{max-width:480px;padding:40px}
    .icon{font-size:64px;margin-bottom:16px}
    h1{font-size:24px;margin-bottom:12px;letter-spacing:4px}
    p{font-size:14px;color:#8899b4;line-height:1.8}
    hr{border:none;border-top:1px solid rgba(255,255,255,0.06);margin:24px 0}
    .hint{font-size:11px;color:#556680}
  </style>
</head>
<body>
  <div class="box">
    <div class="icon">🔒</div>
    <h1>系统已暂停服务</h1>
    <p>当前服务已被管理员远程关闭<br>请联系管理员获取最新状态</p>
    <hr>
    <div class="hint">授权验证服务器正常运行</div>
  </div>
</body>
</html>`;

// 缓存：避免每次请求都去拉 Gist
// 键是当前 Gist 的 enabled 状态，60 秒过期
const CACHE_TTL = 60; // 秒
const cache = {};

async function checkKillSwitch(env) {
  const url = env?.KILL_SWITCH_URL || DEFAULT_URL;
  if (!url) {
    // 没配 URL → 默认放行（但记录警告）
    console.warn('[KillSwitch] KILL_SWITCH_URL 未配置，已放行');
    return true;
  }

  const now = Math.floor(Date.now() / 1000);

  // 检查缓存
  if (cache.url === url && cache.expire > now) {
    return cache.enabled;
  }

  try {
    const resp = await fetch(url, { cf: { cacheTtl: CACHE_TTL } });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    const enabled = data.enabled !== false;

    // 更新缓存
    cache.url = url;
    cache.expire = now + CACHE_TTL;
    cache.enabled = enabled;

    return enabled;
  } catch (err) {
    console.error('[KillSwitch] 检查失败:', err.message);
    // 网络不通时：锁定（fail closed，更安全）
    cache.url = url;
    cache.expire = now + 30; // 30 秒后重试
    cache.enabled = false;
    return false;
  }
}

/**
 * Cloudflare Pages Function 入口
 * 每次请求都会先经过这里
 */
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // NLEcloud 代理：/api/nle/* → http://api.nlecloud.com/*
  if (url.pathname.startsWith('/api/nle/')) {
    const targetPath = url.pathname.replace('/api/nle', '') + url.search;
    const targetUrl = 'http://api.nlecloud.com' + targetPath;
    const headers = new Headers(request.headers);
    headers.set('Host', 'api.nlecloud.com');

    const proxyResp = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.arrayBuffer() : undefined,
    });

    const corsHeaders = new Headers(proxyResp.headers);
    corsHeaders.set('Access-Control-Allow-Origin', '*');
    return new Response(proxyResp.body, {
      status: proxyResp.status,
      headers: corsHeaders,
    });
  }

  // 跳过健康检查
  if (url.pathname === '/health' || url.pathname === '/favicon.ico') {
    return context.next();
  }

  const enabled = await checkKillSwitch(env);

  if (!enabled) {
    return new Response(LOCKED_PAGE, {
      status: 503,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache',
      },
    });
  }

  // 授权通过，正常返回静态资源
  return context.next();
}
