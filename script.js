// Main JavaScript file for your PWA - Simple Calculator App
document.addEventListener('DOMContentLoaded', function() {
    console.log('Calculator app loaded successfully!');
    
    // Initialize the app
    initApp();
});

let deferredInstallPrompt = null; // for beforeinstallprompt event
let currentExpression = '';
const HISTORY_KEY = 'calculator_history_v1';

function initApp() {
    // Ensure there's an #app container
    let app = document.getElementById('app');
    if (!app) {
        app = document.createElement('div');
        app.id = 'app';
        document.body.appendChild(app);
    }

    // Add fade-in animation to main content
    app.classList.add('fade-in');

    // Inject calculator UI and styles
    buildCalculatorUI();

    // Hook up online/offline indicator
    updateOnlineStatus();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Register service worker for PWA functionality
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
            .then(registration => {
                console.log('Service Worker registered successfully:', registration);
            })
            .catch(error => {
                console.log('Service Worker registration failed:', error);
            });
    }

    // beforeinstallprompt - save event to show custom install UI
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstallPrompt = e;
        const installBtn = document.getElementById('install-btn');
        if (installBtn) installBtn.style.display = 'inline-block';
    });

    // Request notification permission in background if supported
    if ('Notification' in window && Notification.permission === 'default') {
        try {
            Notification.requestPermission().then(permission => {
                console.log('Notification permission:', permission);
            });
        } catch (e) {
            console.warn('Notification permission request failed', e);
        }
    }

    // Keyboard support
    window.addEventListener('keydown', handleKeyDown);
}

// Add your custom app functionality here
function updateAppContent(content) {
    const app = document.getElementById('app');
    if (app) {
        app.innerHTML = content;
    }
}

// Example function to show a notification
function showNotification(message) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Calculator', { body: message });
    }
}

/* ---------- Calculator UI & Logic ---------- */

function buildCalculatorUI() {
    const app = document.getElementById('app');
    if (!app) return;

    // Inject styles
    injectStyles();

    // Build HTML
    app.innerHTML = `
        <div class="calc-shell" role="application" aria-label="Simple Calculator">
            <header class="calc-header">
                <div>
                    <h1>Simple Calculator</h1>
                    <p class="subtitle">Fast, offline-ready, and installable</p>
                </div>
                <div class="header-actions">
                    <button id="install-btn" class="btn small" title="Install app" style="display:none">Install</button>
                    <button id="toggle-history-btn" class="btn small" title="Toggle history">History</button>
                    <button id="clear-history-btn" class="btn small" title="Clear history">Clear History</button>
                    <span id="network-indicator" class="network offline" aria-hidden="true">Offline</span>
                </div>
            </header>

            <main class="calc-main">
                <div class="display" id="display" aria-live="polite" aria-atomic="true">0</div>
                <div class="keypad">
                    <button class="key func" data-action="clear">C</button>
                    <button class="key func" data-action="back">⌫</button>
                    <button class="key func" data-action="percent">%</button>
                    <button class="key op" data-value="÷">÷</button>

                    <button class="key" data-value="7">7</button>
                    <button class="key" data-value="8">8</button>
                    <button class="key" data-value="9">9</button>
                    <button class="key op" data-value="×">×</button>

                    <button class="key" data-value="4">4</button>
                    <button class="key" data-value="5">5</button>
                    <button class="key" data-value="6">6</button>
                    <button class="key op" data-value="-">−</button>

                    <button class="key" data-value="1">1</button>
                    <button class="key" data-value="2">2</button>
                    <button class="key" data-value="3">3</button>
                    <button class="key op" data-value="+">+</button>

                    <button class="key" data-action="negate">±</button>
                    <button class="key" data-value="0">0</button>
                    <button class="key" data-value=".">.</button>
                    <button class="key equals" data-action="equals">=</button>
                </div>
            </main>

            <aside class="history-panel" id="history-panel" aria-hidden="true">
                <h2>History</h2>
                <ul id="history-list"></ul>
            </aside>

            <footer class="calc-footer">
                <small>Made as a Progressive Web App. Works offline.</small>
            </footer>
        </div>
    `;

    // Wire events for keys
    document.querySelectorAll('.key').forEach(btn => {
        btn.addEventListener('click', onKeyClick);
    });

    const installBtn = document.getElementById('install-btn');
    if (installBtn) {
        installBtn.addEventListener('click', onInstallClick);
    }

    const toggleHistoryBtn = document.getElementById('toggle-history-btn');
    if (toggleHistoryBtn) toggleHistoryBtn.addEventListener('click', toggleHistoryPanel);

    const clearHistoryBtn = document.getElementById('clear-history-btn');
    if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', clearHistory);

    // Load and render history
    renderHistory();
}

function injectStyles() {
    if (document.getElementById('calc-styles')) return; // already injected
    const style = document.createElement('style');
    style.id = 'calc-styles';
    style.textContent = `
        :root {
            --bg: #0f1724;
            --panel: #0b1220;
            --accent: #00c3a3;
            --muted: #94a3b8;
            --key-bg: #111827;
            --key-func: #374151;
            --white: #e6eef6;
        }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; background: linear-gradient(180deg,#071028 0%, #0b1630 100%); color: var(--white); min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px; }
        .fade-in { animation: fadeIn 360ms ease both; }
        @keyframes fadeIn { from { opacity:0; transform: translateY(6px); } to { opacity:1; transform:none; } }

        .calc-shell { width: 360px; max-width: 100%; background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01)); border-radius:12px; padding:14px; box-shadow: 0 8px 30px rgba(2,6,23,0.7); }
        .calc-header { display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:8px; }
        .calc-header h1 { margin:0; font-size:18px; }
        .subtitle { margin:0; color:var(--muted); font-size:12px; }
        .header-actions { display:flex; gap:8px; align-items:center; }
        .btn { background:transparent; border:1px solid rgba(255,255,255,0.06); color:var(--white); padding:6px 8px; border-radius:6px; cursor:pointer; font-size:12px; }
        .btn.small { padding:4px 6px; font-size:11px; }
        .network { font-size:11px; padding:6px 8px; border-radius:6px; }
        .network.offline { background: #3b2130; color:#ffb3b3; }
        .network.online { background: #08331d; color:#baffd6; }

        .calc-main { display:flex; flex-direction:column; gap:12px; padding:8px 0; }
        .display { background: rgba(0,0,0,0.25); padding:14px; border-radius:10px; text-align:right; font-size:28px; min-height:56px; display:flex; align-items:center; justify-content:flex-end; font-variant-numeric: tabular-nums; word-break:break-all; }
        .keypad { display:grid; grid-template-columns: repeat(4, 1fr); gap:8px; }
        .key { padding:16px; border-radius:10px; border:none; background:var(--key-bg); color:var(--white); font-size:18px; cursor:pointer; box-shadow: inset 0 -2px 0 rgba(0,0,0,0.3); transition: transform 120ms ease, box-shadow 120ms ease; }
        .key.op { background: linear-gradient(180deg,#063145,#04424a); color:#e6fff8; }
        .key.func { background: linear-gradient(180deg,#1f2937,#111827); color:var(--muted); }
        .key.equals { grid-column: 4 / 5; background: linear-gradient(180deg,var(--accent), #00a885); color: #012117; font-weight:600; }
        .key:active { transform: translateY(2px); box-shadow:none; }
        .history-panel { margin-top:12px; max-height:160px; overflow:auto; background: rgba(255,255,255,0.02); padding:10px; border-radius:8px; display:none; }
        .history-panel[aria-hidden="false"] { display:block; }
        .history-panel h2 { margin:0 0 6px 0; font-size:14px; }
        #history-list { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:6px; }
        #history-list li { display:flex; justify-content:space-between; gap:10px; font-size:13px; color:var(--muted); padding:6px; border-radius:6px; background: rgba(0,0,0,0.15); }
        .calc-footer { margin-top:8px; color:var(--muted); text-align:center; font-size:12px; }
        @media (max-width:380px) { .display { font-size:22px; } .key { padding:12px; } }
    `;
    document.head.appendChild(style);
}

function onKeyClick(e) {
    const btn = e.currentTarget;
    const val = btn.getAttribute('data-value');
    const action = btn.getAttribute('data-action');

    if (val) {
        appendToExpression(val);
    } else if (action) {
        handleAction(action);
    }
}

function handleAction(action) {
    switch (action) {
        case 'clear':
            clearAll();
            break;
        case 'back':
            backspace();
            break;
        case 'percent':
            appendToExpression('%');
            break;
        case 'equals':
            evaluateExpression();
            break;
        case 'negate':
            toggleNegate();
            break;
        default:
            break;
    }
    updateDisplay();
}

function appendToExpression(ch) {
    // Prevent multiple leading zeros in a fresh number, allow chaining operators
    if (currentExpression === '0' && ch === '0') return;
    // If last char and new char is decimal, ensure we don't have 2 decimals in same number
    if (ch === '.') {
        const parts = currentExpression.split(/[\+\-×÷\*\/]/);
        const last = parts[parts.length - 1] || '';
        if (last.includes('.')) return;
        if (last === '') ch = '0.'; // beginning decimal
    }
    currentExpression += ch;
    updateDisplay();
}

function clearAll() {
    currentExpression = '';
    updateDisplay();
}

function backspace() {
    if (currentExpression.length > 0) {
        currentExpression = currentExpression.slice(0, -1);
    }
    updateDisplay();
}

function toggleNegate() {
    // Try to toggle sign of the last number
    // Find last number using regex
    const match = currentExpression.match(/([+\-×÷*/])?([0-9.]+)%?$/);
    if (match) {
        const operator = match[1] || '';
        const num = match[2];
        const startIndex = currentExpression.lastIndexOf(num);
        if (num) {
            // If number already has a leading -, remove it; else insert minus after operator or at start
            if (startIndex > 0 && currentExpression[startIndex - 1] === '-') {
                // remove negative sign
                currentExpression = currentExpression.slice(0, startIndex - 1) + currentExpression.slice(startIndex);
            } else {
                currentExpression = currentExpression.slice(0, startIndex) + '(-' + num + ')' + currentExpression.slice(startIndex + num.length);
            }
        }
    } else {
        // If nothing, start with negative sign
        currentExpression = '-' + currentExpression;
    }
    updateDisplay();
}

function updateDisplay() {
    const disp = document.getElementById('display');
    if (!disp) return;
    disp.textContent = currentExpression === '' ? '0' : currentExpression;
}

function evaluateExpression() {
    if (!currentExpression) return;
    // Normalize expression: replace display operators with JS equivalents
    let expr = currentExpression.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');

    // Convert percentages like 50% or 12.5% to (50/100)
    expr = expr.replace(/([0-9]*\.?[0-9]+)%/g, '($1/100)');

    // Validate allowed characters to reduce injection risk
    if (!/^[0-9+\-*/().\s%]+$/.test(expr)) {
        displayError('Invalid input');
        return;
    }

    try {
        // Evaluate safely using Function
        const result = Function('"use strict"; return (' + expr + ')')();
        const formatted = formatResult(result);
        saveToHistory(currentExpression, formatted);
        currentExpression = String(formatted);
        updateDisplay();
        showNotification(`Result: ${formatted}`);
    } catch (err) {
        console.error('Evaluation error:', err);
        displayError('Error');
    }
}

function formatResult(v) {
    if (typeof v === 'number') {
        if (!isFinite(v)) return '∞';
        // Trim to a sensible number of decimals
        return Number.isInteger(v) ? v : parseFloat(v.toFixed(10)).toString();
    }
    return String(v);
}

function displayError(msg) {
    const disp = document.getElementById('display');
    if (disp) {
        disp.textContent = msg;
        setTimeout(() => updateDisplay(), 900);
    }
}

function handleKeyDown(e) {
    // Avoid typing when focusing inputs (none expected) but we'll allow
    const key = e.key;
    if ((key >= '0' && key <= '9') || key === '.') {
        appendToExpression(key);
    } else if (key === 'Enter' || key === '=') {
        e.preventDefault();
        evaluateExpression();
    } else if (key === 'Backspace') {
        backspace();
    } else if (key === 'Escape') {
        clearAll();
    } else if (key === '+' || key === '-' || key === '*' || key === '/') {
        // map * and / to symbols for visual consistency? keep as JS operator
        const mapped = key === '*' ? '×' : key === '/' ? '÷' : key;
        appendToExpression(mapped);
    } else if (key === '%') {
        appendToExpression('%');
    }
}

/* ---------- History (localStorage) ---------- */

function loadHistory() {
    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        if (!raw) return [];
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr;
        return [];
    } catch (e) {
        console.warn('Failed to load history', e);
        return [];
    }
}

function saveToHistory(expression, result) {
    try {
        const history = loadHistory();
        history.unshift({ expression, result, ts: Date.now() });
        // limit history to 30 entries
        const truncated = history.slice(0, 30);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(truncated));
        renderHistory();
    } catch (e) {
        console.warn('Failed to save history', e);
    }
}

function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
}

function renderHistory() {
    const panel = document.getElementById('history-panel');
    const list = document.getElementById('history-list');
    if (!list || !panel) return;
    const history = loadHistory();
    list.innerHTML = '';
    if (history.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'No history yet';
        li.style.color = 'var(--muted)';
        list.appendChild(li);
        return;
    }
    history.forEach(item => {
        const li = document.createElement('li');
        const left = document.createElement('div');
        left.textContent = item.expression;
        left.style.color = 'var(--white)';
        left.style.flex = '1';
        left.style.overflow = 'hidden';
        left.style.textOverflow = 'ellipsis';
        left.style.whiteSpace = 'nowrap';

        const right = document.createElement('div');
        right.textContent = item.result;
        right.style.color = 'var(--muted)';
        right.style.marginLeft = '12px';

        li.appendChild(left);
        li.appendChild(right);

        li.addEventListener('click', () => {
            // allow reuse of history item as current expression
            currentExpression = item.result;
            updateDisplay();
        });

        list.appendChild(li);
    });
}

function toggleHistoryPanel() {
    const panel = document.getElementById('history-panel');
    if (!panel) return;
    const isHidden = panel.getAttribute('aria-hidden') === 'true';
    panel.setAttribute('aria-hidden', String(!isHidden));
}

/* ---------- Install Prompt ---------- */

function onInstallClick() {
    const installBtn = document.getElementById('install-btn');
    if (!deferredInstallPrompt) {
        // fallback: trigger native if possible
        console.log('No install prompt available');
        return;
    }
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(choice => {
        if (choice.outcome === 'accepted') {
            console.log('User accepted install prompt');
            if (installBtn) installBtn.style.display = 'none';
        } else {
            console.log('User dismissed install prompt');
        }
        deferredInstallPrompt = null;
    });
}

/* ---------- Network status ---------- */

function updateOnlineStatus() {
    const indicator = document.getElementById('network-indicator');
    if (!indicator) return;
    if (navigator.onLine) {
        indicator.textContent = 'Online';
        indicator.classList.remove('offline');
        indicator.classList.add('online');
    } else {
        indicator.textContent = 'Offline';
        indicator.classList.remove('online');
        indicator.classList.add('offline');
    }
}