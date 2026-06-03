type ErrorPageOptions = {
  showDetails?: boolean;
};

export const getHTMLForErrorPage = (err: unknown, options: ErrorPageOptions = {}): string => {
  const showDetails = options.showDetails ?? process.env.NODE_ENV !== 'production';
  const message =
    showDetails && err instanceof Error
      ? err.message
      : 'An unexpected error occurred. Please try again.';
  const stack = showDetails ? (err instanceof Error ? err.stack : String(err)) : '';
  const detailsControl = showDetails
    ? `<button class="toggle-btn" onclick="document.getElementById('details').classList.toggle('open')">
      Show details
    </button>
    <div id="details" class="details">
      <pre>${escapeHtml(stack || '')}</pre>
    </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Error - MDX Billing</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
      background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
      color: white;
      padding: 24px;
      position: relative;
      overflow: hidden;
    }
    .glow1 {
      position: absolute; top: -100px; left: -100px;
      width: 400px; height: 400px; border-radius: 50%;
      background: rgba(239,68,68,0.15); filter: blur(100px);
      pointer-events: none;
    }
    .glow2 {
      position: absolute; bottom: -100px; right: -100px;
      width: 400px; height: 400px; border-radius: 50%;
      background: rgba(139,92,246,0.15); filter: blur(100px);
      pointer-events: none;
    }
    .card {
      position: relative; max-width: 520px; width: 100%; text-align: center;
    }
    .icon-wrap {
      width: 80px; height: 80px; border-radius: 24px;
      background: linear-gradient(135deg, #ef4444, #dc2626);
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 24px;
      box-shadow: 0 8px 32px rgba(239,68,68,0.3);
    }
    h1 {
      font-size: 28px; font-weight: 700; margin-bottom: 8px;
      background: linear-gradient(to right, #fff, #e2e8f0);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .msg { color: rgba(255,255,255,0.6); font-size: 15px; margin-bottom: 32px; line-height: 1.6; }
    .btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-bottom: 24px; }
    .btn-primary {
      background: linear-gradient(135deg, #8b5cf6, #a855f7);
      color: white; border: none; border-radius: 14px;
      padding: 12px 28px; font-size: 14px; font-weight: 600;
      cursor: pointer; box-shadow: 0 4px 16px rgba(139,92,246,0.3);
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(139,92,246,0.4); }
    .btn-secondary {
      background: rgba(255,255,255,0.1); color: white;
      border: 1px solid rgba(255,255,255,0.2); border-radius: 14px;
      padding: 12px 28px; font-size: 14px; font-weight: 600;
      cursor: pointer; backdrop-filter: blur(12px); transition: background 0.15s;
    }
    .btn-secondary:hover { background: rgba(255,255,255,0.18); }
    .toggle-btn {
      background: none; border: none; color: rgba(255,255,255,0.4);
      font-size: 12px; cursor: pointer; padding: 4px 8px;
    }
    .details {
      margin-top: 16px; background: rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.1); border-radius: 16px;
      padding: 16px; text-align: left; max-height: 240px; overflow-y: auto;
      display: none;
    }
    .details.open { display: block; }
    .details pre {
      color: rgba(255,255,255,0.55); font-size: 11px;
      white-space: pre-wrap; word-break: break-all; margin: 0;
      font-family: 'Fira Code', 'Cascadia Code', monospace;
    }
    .footer { color: rgba(255,255,255,0.25); font-size: 11px; margin-top: 32px; }
  </style>
</head>
<body>
  <div class="glow1"></div>
  <div class="glow2"></div>
  <div class="card">
    <div class="icon-wrap">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    </div>
    <h1>Something went wrong</h1>
    <p class="msg">${escapeHtml(message)}</p>
    <div class="btns">
      <button class="btn-primary" onclick="window.location.href='/'">Go Home</button>
      <button class="btn-secondary" onclick="window.location.reload()">Retry</button>
    </div>
    ${detailsControl}
    <p class="footer">MDX Billing - Error Page</p>
  </div>
</body>
</html>`;
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
