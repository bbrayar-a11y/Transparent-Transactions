// js/logger.js

const LOG_KEY = 'app_logs';
const MAX_LOG_SIZE = 1024 * 1024; // 1MB

function log(level, module, action, details = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    module,
    action,
    details: JSON.stringify(details)
  };

  const consoleMessage = `[${timestamp}] [${level}] [${module}] [${action}]`;
  switch (level) {
    case 'ERROR': console.error(consoleMessage, details); break;
    case 'WARN':  console.warn(consoleMessage, details); break;
    default:      console.log(consoleMessage, details);
  }

  try {
    let logs = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    logs.push(logEntry);
    while (JSON.stringify(logs).length > MAX_LOG_SIZE) { logs.shift(); }
    localStorage.setItem(LOG_KEY, JSON.stringify(logs));
  } catch (e) { console.error("Failed to write log to localStorage:", e); }
}

function downloadDebugLog() {
  try {
    const logs = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    if (logs.length === 0) { alert('No logs to download.'); return; }
    const logText = logs.map(log => `[${log.timestamp}] [${log.level}] [${log.module}] [${log.action}] ${log.details}`).join('\n');
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `TT-Log-${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    log('INFO', 'logger.js', 'DEBUG_LOG_DOWNLOADED', { logCount: logs.length });
  } catch (e) { log('ERROR', 'logger.js', 'DEBUG_LOG_DOWNLOAD_FAILED', { error: e.message }); alert('Failed to download log file.'); }
}

// --- EXPORTS ---
// This makes the functions available to other scripts that import them.
export { log, downloadDebugLog };