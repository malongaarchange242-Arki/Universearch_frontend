/**
 * EDUSAAS - Main Dashboard Logic
 * 2026 Edition
 */

document.addEventListener('DOMContentLoaded', () => {
    initDate();
    initNavigation();
    initSearch();
    animateCards();
    fetchStats();
    fetchApprovedLists();
});

/**
 * Affiche la date du jour formatée
 */
function initDate() {
    const dateEl = document.getElementById('current-date');
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    dateEl.innerText = new Date().toLocaleDateString('fr-FR', options);
}

/**
 * Gère le switch visuel du menu latéral
 */
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            // Empêche le comportement par défaut si c'est un bouton "Action"
            if (link.hasAttribute('onclick')) return;

            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            console.log(`Navigation vers : ${link.dataset.page || 'Home'}`);
        });
    });
}

/**
 * Moteur de recherche simple (Filtre les cartes)
 */
function initSearch() {
    const searchInput = document.getElementById('main-search');
    const cards = document.querySelectorAll('.content-card');

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();

        cards.forEach(card => {
            const title = card.dataset.title.toLowerCase();
            if (title.includes(query)) {
                card.style.display = 'block';
                card.style.opacity = '1';
            } else {
                card.style.display = 'none';
                card.style.opacity = '0';
            }
        });
    });
}

/**
 * Déconnexion sécurisée
 */
function handleLogout() {
    // Design de confirmation plus "SaaS" (on utilise l'alert système pour l'exemple)
    const confirmed = confirm("Voulez-vous vraiment fermer votre session sécurisée ?");
    if (confirmed) {
        document.body.style.opacity = '0.5';
        document.body.style.pointerEvents = 'none';
        
        // Simuler un appel API de logout
        setTimeout(() => {
            window.location.reload(); 
        }, 800);
    }
}

/**
 * Animation séquentielle des cartes au chargement
 */
function animateCards() {
    const cards = document.querySelectorAll('.stat-card, .content-card');
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            card.style.transition = 'all 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 80);
    });
}

// --- Fetch and display stats from backend ---
const API_BASE = 'https://universearch-t126.onrender.com';

function safeCountFromResponse(json) {
    if (Array.isArray(json)) return json.length;
    if (json && typeof json === 'object') {
        if (typeof json.count === 'number') return json.count;
        if (Array.isArray(json.data)) return json.data.length;
    }
    return null;
}

function setTextById(id, txt) {
    try { const el = document.getElementById(id); if (el) el.innerText = txt; } catch(e){}
}

async function tryFetchCount(path) {
    try {
        const token = localStorage.getItem('softura_token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;
        const opts = headers ? { headers } : undefined;
        let res = await fetch(`${API_BASE}${path}`, opts);

        // If unauthorized when using token, retry without Authorization header (some endpoints are public)
        if (res.status === 401 && headers) {
            console.warn(`${path} returned 401 with token — retrying without Authorization header`);
            res = await fetch(`${API_BASE}${path}`);
        }

        // If 400 (Bad Request) or 404, skip to next option silently
        if (!res.ok) {
            if (res.status === 400 || res.status === 404) {
                console.debug(`Endpoint ${path} not available (${res.status})`);
            } else {
                console.warn(`${path} returned ${res.status}`);
            }
            return null;
        }

        // Prefer json(), but gracefully handle endpoints that return textified JSON
        let j = null;
        try {
            j = await res.json();
        } catch (e) {
            try {
                const txt = await res.text();
                j = JSON.parse(txt);
            } catch (e2) {
                try {
                    const txt2 = await res.text();
                    const arrMatch = txt2.trim().match(/^\[.*\]$/s);
                    if (arrMatch) j = JSON.parse(txt2);
                } catch (e3) { j = null; }
            }
        }
        return safeCountFromResponse(j);
    } catch (e) { 
        console.debug(`Error fetching ${path}:`, e.message);
        return null; 
    }
}

async function fetchStats() {
    // Universités
    const uCount = await tryFetchCount('/universites') ?? await tryFetchCount('/universites/list') ?? null;
    if (uCount !== null) setTextById('stat-universites', uCount.toLocaleString()); else setTextById('stat-universites', '—');

    // Centres
    const cCount = await tryFetchCount('/centres') ?? await tryFetchCount('/centres/list') ?? null;
    if (cCount !== null) setTextById('stat-centres', cCount.toLocaleString()); else setTextById('stat-centres', '—');

    // Utilisateurs - try less aggressive endpoints to avoid 400 errors
    // Note: /utilisateurs endpoint may not exist on this API structure
    const userCount = await tryFetchCount('/users/count') ?? await tryFetchCount('/users') ?? null;
    if (userCount !== null) setTextById('stat-utilisateurs', userCount.toLocaleString()); else setTextById('stat-utilisateurs', '—');

    // Active counts are handled by fetchApprovedLists() to avoid races
    // (we previously updated them here but that could overwrite approved-derived values)
}

// --- Fetch and render APPROVED universities and centres into the grid ---
async function fetchApprovedLists() {
    const grid = document.getElementById('grid-content');
    if (!grid) return;

    const token = localStorage.getItem('softura_token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;

    async function fetchList(path) {
        try {
            const res = await fetch(`${API_BASE}${path}`, headers ? { headers } : undefined);
            if (!res.ok) return null;
            const j = await res.json().catch(async () => {
                const t = await res.text(); return JSON.parse(t);
            });
            return Array.isArray(j) ? j : (Array.isArray(j.data) ? j.data : null);
        } catch (e) { return null; }
    }

    const [unis, centres] = await Promise.all([fetchList('/universites'), fetchList('/centres')]);

    const approvedUnis = Array.isArray(unis) ? unis.filter(u => (u.statut && u.statut === 'APPROVED') || (u.status && String(u.status).toUpperCase().includes('APPROVED'))) : [];
    const approvedCentres = Array.isArray(centres) ? centres.filter(c => (c.statut && c.statut === 'APPROVED') || (c.status && String(c.status).toUpperCase().includes('APPROVED'))) : [];

    // Update active counts
    setTextById('stat-univ-actifs', approvedUnis.length ? approvedUnis.length.toLocaleString() : '—');
    setTextById('stat-centres-actifs', approvedCentres.length ? approvedCentres.length.toLocaleString() : '—');

    // Build cards: clear grid and append approved items (unis then centres)
    grid.innerHTML = '';

    function makeCard(item, kind) {
        const article = document.createElement('article');
        article.className = 'content-card group';
        article.dataset.title = item.nom || item.name || item.sigle || '';

        const imgUrl = item.logo_url || item.logo || '';
        const badge = kind === 'univ' ? 'Université' : 'Centre';

        article.innerHTML = `
            <div class="card-image-wrapper">
                <img src="${imgUrl}" alt="${escapeHtml(item.nom || '')}">
                <div class="badge-overlay bg-indigo-600">${badge}</div>
            </div>
            <div class="p-7">
                <div class="flex justify-between items-center mb-3">
                    <span class="status-indicator active">En ligne</span>
                    <span class="text-slate-400 text-[10px] font-bold tracking-widest uppercase">ID: ${item.profile_id || item.id || ''}</span>
                </div>
                <h4 class="card-title">${escapeHtml(item.nom || item.name || '')}</h4>
                <div class="card-footer">
                    <div class="avatar-group">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent((item.nom||'U').slice(0,2))}&background=random" class="avatar-mini">
                    </div>
                    <button class="action-link">Gérer l'accès</button>
                </div>
            </div>`;
        return article;
    }

    function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

    // Append universities first
    approvedUnis.forEach(u => grid.appendChild(makeCard(u, 'univ')));
    approvedCentres.forEach(c => grid.appendChild(makeCard(c, 'centre')));

    // If none, show placeholder
    if (!approvedUnis.length && !approvedCentres.length) {
        const p = document.createElement('div');
        p.className = 'p-6 bg-white rounded-lg border border-dashed text-slate-500';
        p.innerText = 'Aucune université ou centre approuvé trouvé.';
        grid.appendChild(p);
    }
}