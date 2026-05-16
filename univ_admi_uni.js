/**
 * EDUSAAS - Logique de Gestion des Universités
 */

// Runtime registry populated from the PORA API. A small local fallback is used if the API is unavailable.
let universityRegistry = {};


function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');

    function setActive(link) {
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
    }

    // Set active based on current path or data-page
    try {
        const current = window.location.pathname.split('/').pop() || '';
        let matched = false;
        navLinks.forEach(link => {
            const href = (link.getAttribute('href') || '').split('/').pop();
            const page = link.dataset.page || '';
            if (href && href === current) {
                setActive(link);
                matched = true;
            } else if (!matched && page && current && page === current.replace(/\.[a-z]+$/i, '')) {
                setActive(link);
                matched = true;
            }
        });
    } catch (e) {
        // ignore
    }

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            // don't toggle for action buttons (logout, etc.) or anchor to '#'
            const href = link.getAttribute('href');
            if (link.hasAttribute('onclick') || href === '#') return;

            // visually activate (will be re-evaluated on page load for real navigation)
            setActive(link);
            console.log(`Navigation vers : ${link.dataset.page || href || 'Home'}`);
        });
    });
}

const PORA_API = window.PORA_API_BASE || 'https://universearch-pwlf.onrender.com';

async function fetchUniversities() {
    try {
        const res = await fetch(`${PORA_API}/universites`);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();

        // map to local registry shape
        universityRegistry = {};
        data.forEach(u => {
            universityRegistry[u.ID || u.id] = {
                name: u.Nom || u.nom || '—',
                id: u.ID || u.id,
                description: u.Description || u.description || u.Nom || '',
                presidentBDE: u.BDEID || '',
                subscribers: (u.ScoreDetails && u.ScoreDetails.Followers) ? String(Math.round(u.ScoreDetails.Followers)) : '',
                subStart: '',
                subEnd: '',
                phone: u.Contacts || '',
                email: u.Email || u.email || '',
                siege: u.Contacts || '',
                img: u.LogoURL || u.logo_url || 'https://api.dicebear.com/7.x/identicon/svg?seed=' + encodeURIComponent(u.Nom || u.nom || u.ID || 'u'),
                status: (u.Statut || u.statut || 'PENDING').toUpperCase(),
                statusColor: ((u.Statut || u.statut) || '').toUpperCase() === 'APPROVED' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-600'
            };
        });

        // if no results, fallback
        if (Object.keys(universityRegistry).length === 0) throw new Error('empty');

        renderUniversities();
    } catch (err) {
        console.warn('Failed to load universites from PORA API, using fallback', err);
        universityRegistry = Object.assign({}, LOCAL_FALLBACK);
        renderUniversities();
    }
}

function renderUniversities() {
    const tbody = document.getElementById('univ-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    Object.values(universityRegistry).forEach(data => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50/50 transition-colors group border-b border-slate-50';

        const region = data.domaine || data.siege || '—';
        const subscribers = data.subscribers || '—';
        const checked = (data.status && data.status.toUpperCase() === 'APPROVED') ? 'checked' : '';

        tr.innerHTML = `
            <td class="px-8 py-6">
                <div class="flex items-center gap-4">
                    <div class="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                        ${(data.name || '').split(' ').map(s=>s[0]||'').slice(0,2).join('').toUpperCase()}
                    </div>
                    <div>
                        <p class="text-sm font-bold text-slate-900 leading-tight">${data.name}</p>
                        <p class="text-[11px] text-slate-400 font-medium mt-0.5">${data.id || ''}</p>
                    </div>
                </div>
            </td>
            <td class="px-6 py-6 text-xs font-semibold text-slate-600">${region}</td>
            <td class="px-6 py-6 text-center text-sm font-bold text-slate-700">${subscribers}</td>
            <td class="px-6 py-6 text-center">
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" onchange="toggleAccess('${data.id}', this.checked)" class="sr-only peer" ${checked}>
                    <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
            </td>
            <td class="px-8 py-6 text-right">
                <button class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" data-univ-id="${data.id}">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                </button>
            </td>
        `;

        tbody.appendChild(tr);
    });

    // attach click handlers for actions
    document.querySelectorAll('#univ-table-body button[data-univ-id]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = btn.getAttribute('data-univ-id');
            openSettings(id);
        });
    });
}

/**
 * SYSTÈME DE NOTIFICATION (TOAST)
 * Affiche un message pro et centré en haut de l'écran
 */
function showNotification(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    
    // Style selon le type (Erreur = Rouge, Info/Success = Noir/Indigo)
    const bgClass = type === 'error' ? 'bg-red-600' : 'bg-slate-900/95';
    
    toast.className = `${bgClass} backdrop-blur-md text-white px-6 py-3.5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] flex items-center gap-3 transition-all duration-500 translate-y-10 opacity-0 pointer-events-auto border border-white/10`;
    
    toast.innerHTML = `
        <div class="w-6 h-6 flex items-center justify-center bg-white/20 rounded-full">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
        </div>
        <span class="text-sm font-bold tracking-tight">${message}</span>
    `;

    container.appendChild(toast);

    // Animation d'entrée (Rebond léger)
    setTimeout(() => {
        toast.style.transform = "translateY(0)";
        toast.style.opacity = "1";
    }, 100);

    // Auto-destruction après 3.5 secondes
    setTimeout(() => {
        toast.style.transform = "translateY(-20px)";
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 500);
    }, 3500);
}

/**
 * GESTION DE L'ACCÈS
 */
async function toggleAccess(univId, isEnabled) {
    const IDENTITY_API = window.IDENTITY_API_BASE || 'https://universearch-pwlf.onrender.com';
    const token = localStorage.getItem('softura_token');

    // Debug: log current user info
    if (token) {
        try {
            const parts = token.split('.');
            if (parts.length === 3) {
                const payloadStr = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
                const payload = JSON.parse(decodeURIComponent(escape(payloadStr)));
                console.log('Current user from token:', {
                    id: payload.sub || payload.id,
                    email: payload.email,
                    role: payload.role || payload.profile_type || payload.profileType
                });
            }
        } catch (e) {
            console.warn('Failed to decode token for debugging', e);
        }
    }

    // update UI optimistically
    if (!isEnabled) {
        showNotification(`L'accès pour ${univId} a été suspendu`, 'error');
    } else {
        showNotification(`Validation en cours pour ${univId}…`, 'info');
    }

    try {
        // find the checkbox element and disable while processing
        const checkbox = Array.from(document.querySelectorAll('#univ-table-body input[type=checkbox]'))
            .find(i => i.getAttribute('onchange') && i.getAttribute('onchange').includes(univId));
        if (checkbox) checkbox.disabled = true;

        if (isEnabled) {
            // approve the university via admin API
            const res = await fetch(`${IDENTITY_API}/admin/universites/${encodeURIComponent(univId)}/approve`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({}),
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${res.status}`);
            }

            // update registry state
            if (universityRegistry[univId]) {
                universityRegistry[univId].status = 'APPROVED';
                universityRegistry[univId].statusColor = 'bg-emerald-100 text-emerald-600';
            }

            showNotification(`Université ${univId} approuvée`, 'success');
        } else {
            // set status back to PENDING via status endpoint
            const res = await fetch(`${IDENTITY_API}/admin/universites/${encodeURIComponent(univId)}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ statut: 'PENDING' }),
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${res.status}`);
            }

            if (universityRegistry[univId]) {
                universityRegistry[univId].status = 'PENDING';
                universityRegistry[univId].statusColor = 'bg-slate-200 text-slate-600';
            }

            showNotification(`Université ${univId} repassée en attente`, 'info');
        }

        renderUniversities();
    } catch (err) {
        console.error('toggleAccess error', err);
        showNotification(`Erreur: ${err.message}`, 'error');
        // revert checkbox UI if present
        const checkbox = Array.from(document.querySelectorAll('#univ-table-body input[type=checkbox]'))
            .find(i => i.getAttribute('onchange') && i.getAttribute('onchange').includes(univId));
        if (checkbox) checkbox.checked = !isEnabled;
    } finally {
        const checkbox = Array.from(document.querySelectorAll('#univ-table-body input[type=checkbox]'))
            .find(i => i.getAttribute('onchange') && i.getAttribute('onchange').includes(univId));
        if (checkbox) checkbox.disabled = false;
    }
}

/**
 * OUVERTURE DU MODAL
 */
function openSettings(univId) {
    const data = universityRegistry[univId];
    if (!data) return;

    // Remplissage des champs classiques
    document.getElementById('modal-name').innerText = data.name;
    document.getElementById('modal-id').innerText = data.id;
    document.getElementById('modal-description').innerText = data.description;
    document.getElementById('modal-bde').innerText = data.presidentBDE;
    document.getElementById('modal-subscribers').innerText = data.subscribers;
    
    // Mise à jour des dates
    const startElem = document.getElementById('modal-sub-start');
    const endElem = document.getElementById('modal-sub-end');
    if(startElem) startElem.innerText = data.subStart;
    if(endElem) {
        endElem.innerText = data.subEnd;
        endElem.className = "text-sm font-bold text-indigo-600";
    }

    // NOUVEAUX CHAMPS (Contact & Siège)
    document.getElementById('modal-phone').innerText = data.phone;
    document.getElementById('modal-email').innerText = data.email;
    document.getElementById('modal-siege').innerText = data.siege;

    // Image et Status
    document.getElementById('modal-img').src = data.img;
    const statusLabel = document.getElementById('modal-status');
    statusLabel.innerText = data.status;
    statusLabel.className = `mb-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${data.statusColor}`;

    // Affichage
    const modal = document.getElementById('univ-modal');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Empêche le scroll en arrière-plan
}

/**
 * FERMETURE DU MODAL
 */
function closeModal() {
    const modal = document.getElementById('univ-modal');
    modal.classList.add('hidden');
    document.body.style.overflow = 'auto';
}

/**
 * RECHERCHE DYNAMIQUE DANS LE TABLEAU
 */
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('table-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('#univ-table-body tr');

            rows.forEach(row => {
                const text = row.innerText.toLowerCase();
                row.style.display = text.includes(term) ? '' : 'none';
            });
        });
    }
    // Charger les universités depuis l'API PORA au démarrage
    // initialiser la navigation (activer la mise en surbrillance du menu)
    if (typeof initNavigation === 'function') initNavigation();
    fetchUniversities();
});