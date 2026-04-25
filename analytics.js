/* Lightweight client-side analytics for Universearh
   - Batches click events, visibility changes and page duration
   - Sends to POST /analytics using navigator.sendBeacon when possible
   - Falls back to fetch (keepalive) and localStorage queue
   Usage: window.UeAnalytics.track(name, data)
*/
(function(){
    const ANALYTICS_ENDPOINT = '/analytics';
    const BATCH_INTERVAL = 15000;
    let events = [];
    const startTs = Date.now();
    let lastVisibleTs = startTs;

    function push(ev){ events.push(Object.assign({ ts: Date.now() }, ev)); }

    // page visibility (used to compute active time)
    document.addEventListener('visibilitychange', () => {
        const now = Date.now();
        if (document.visibilityState === 'hidden') {
            push({ type: 'page_hidden', duration: now - lastVisibleTs });
        } else {
            lastVisibleTs = now;
            push({ type: 'page_visible' });
        }
    });

    // clicks (basic contextual info)
    document.addEventListener('click', (e) => {
        try {
            const t = e.target;
            push({ type: 'click', tag: t.tagName, id: t.id || null, classes: t.className || null, text: (t.innerText||'').slice(0,120) });
        } catch (e) { /* ignore */ }
    }, true);

    // expose a manual tracker for custom events
    window.UeAnalytics = {
        track: (name, data) => { push({ type: name, data: data || {} }); }
    };

    // send batch
    function sendBatch(){
        if (!events.length) return;
        const payload = { page: location.pathname, ts: Date.now(), events: events.slice() };
        events = [];
        try {
            if (navigator.sendBeacon) {
                const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
                navigator.sendBeacon(ANALYTICS_ENDPOINT, blob);
                return;
            }
        } catch (e) { /* fallback */ }

        // fallback to fetch
        fetch(ANALYTICS_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true })
            .catch(() => {
                // queue locally for later
                try {
                    const q = JSON.parse(localStorage.getItem('ue_analytics_queue') || '[]');
                    q.push(payload);
                    localStorage.setItem('ue_analytics_queue', JSON.stringify(q));
                } catch (e) { /* ignore */ }
            });
    }

    // send queued payloads on load
    window.addEventListener('load', () => {
        try {
            const q = JSON.parse(localStorage.getItem('ue_analytics_queue') || '[]');
            if (Array.isArray(q) && q.length) {
                q.forEach(p => fetch(ANALYTICS_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) }).catch(()=>{}));
                localStorage.removeItem('ue_analytics_queue');
            }
        } catch (e) { /* ignore */ }
    });

    // periodic flush
    setInterval(sendBatch, BATCH_INTERVAL);

    // final send on unload
    function sendFinal(){
        try {
            const totalDuration = Date.now() - startTs;
            const payload = { page: location.pathname, ts: Date.now(), events: events.slice(), totalDuration };
            if (navigator.sendBeacon) {
                const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
                navigator.sendBeacon(ANALYTICS_ENDPOINT, blob);
            } else {
                navigator.sendBeacon && navigator.sendBeacon(ANALYTICS_ENDPOINT, new Blob([JSON.stringify(payload)], {type:'application/json'}));
            }
        } catch (e) { /* ignore */ }
    }

    window.addEventListener('beforeunload', sendFinal);
    window.addEventListener('unload', sendFinal);

})();
