/* Tells the owner when the gift is opened: device, app, and whether it was played to the end. */
(() => {
  'use strict';
  const q = new URLSearchParams(location.search);
  if (!/github\.io$/.test(location.hostname) || q.has('at')) return;
  const EP = 'https://130-61-142-180.sslip.io/sovga/e';
  const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  const sid = rid();
  let did = '';
  try { did = localStorage.getItem('sovga_did') || ''; if (!did) { did = rid(); localStorage.setItem('sovga_did', did); } } catch (e) {}
  const send = (ev, extra) => {
    try { fetch(EP, { method: 'POST', body: JSON.stringify(Object.assign({ ev, sid }, extra)), keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {}); } catch (e) {}
  };

  // iPhones hide their model; the screen size narrows it down
  const IPHONE = { '375x667': 'SE / 6–8', '414x736': '6–8 Plus', '375x812': 'X / XS / 11 Pro / 12–13 mini', '414x896': 'XR / XS Max / 11 / 11 Pro Max',
    '390x844': '12 / 13 / 14', '428x926': '12–13 Pro Max / 14 Plus', '393x852': '14 Pro / 15 / 15 Pro / 16', '430x932': '14 Pro Max / 15 Plus / 15 Pro Max / 16 Plus',
    '402x874': '16 Pro', '440x956': '16 Pro Max' };

  async function device() {
    const ua = navigator.userAgent;
    let m;
    if ((m = ua.match(/iPhone OS (\d+)_(\d+)/))) {
      const s = Math.min(screen.width, screen.height) + 'x' + Math.max(screen.width, screen.height);
      return `iPhone ${IPHONE[s] ? '(taxminan ' + IPHONE[s] + ')' : ''} · iOS ${m[1]}.${m[2]}`.replace('  ', ' ');
    }
    if (/iPad|Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return 'iPad';
    let model = '', ver = '';
    try {
      if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
        const h = await navigator.userAgentData.getHighEntropyValues(['model', 'platformVersion']);
        model = h.model || ''; ver = h.platformVersion || '';
      }
    } catch (e) {}
    if ((m = ua.match(/Android ([\d.]+)(?:; ([^;)]+))?/))) {
      if (!model && m[2] && m[2] !== 'K' && !/wv|Build/.test(m[2])) model = m[2].trim();
      return `Android ${ver ? ver.split('.')[0] : m[1]}${model ? ' · ' + model : ''}`;
    }
    if (/Windows/.test(ua)) return 'Windows kompyuter';
    if (/Mac OS X/.test(ua)) return 'Mac kompyuter';
    if (/Linux/.test(ua)) return 'Linux';
    return ua.slice(0, 100);
  }

  function app() {
    const ua = navigator.userAgent;
    if (window.TelegramWebviewProxy || window.TelegramWebview || /Telegram/i.test(ua)) return 'Telegram ichida';
    if (/Instagram/.test(ua)) return 'Instagram ichida';
    if (/SamsungBrowser/.test(ua)) return 'Samsung brauzer';
    if (/YaBrowser/.test(ua)) return 'Yandex brauzer';
    if (/EdgA?\//.test(ua)) return 'Edge';
    if (/OPR\//.test(ua)) return 'Opera';
    if (/CriOS|Chrome\//.test(ua)) return /; wv\)/.test(ua) ? 'Ilova ichidagi brauzer (Android)' : 'Chrome';
    if (/FxiOS|Firefox\//.test(ua)) return 'Firefox';
    if (/Safari\//.test(ua)) return 'Safari';
    return 'Ilova ichidagi brauzer';
  }

  device().then(d => send('open', {
    k: q.get('k') || '', did, device: d, app: app(),
    screen: `${screen.width}x${screen.height} @${Math.round((devicePixelRatio || 1) * 100) / 100}x`,
    lang: navigator.language || '',
  }));
  let tapped = false, ended = false;
  document.getElementById('gate').addEventListener('click', () => { if (!tapped) { tapped = true; setTimeout(() => send('tap'), 400); } });
  new MutationObserver(() => { if (!ended && document.getElementById('sea').classList.contains('is-fin')) { ended = true; send('end'); } })
    .observe(document.getElementById('sea'), { attributes: true, attributeFilter: ['class'] });
})();
