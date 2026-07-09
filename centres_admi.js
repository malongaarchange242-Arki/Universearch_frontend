/**
 * EDUSAAS - Logique de Gestion des Centres
 */

// Runtime registry populated from the PORA API. A small local fallback is used if the API is unavailable.
let centresRegistry = {};
let currentNotificationTarget = null;
const NOTIFICATION_SERVICE_URL = window.NOTIFICATION_SERVICE_URL || 'https://api.universearch.com';



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
            const href = link.getAttribute('href');
            if (link.hasAttribute('onclick') || href === '#') return;
            setActive(link);
            console.log(`Navigation vers : ${link.dataset.page || href || 'Home'}`);
        });
    });
}

    const PORA_API = window.PORA_API_BASE || 'https://api.universearch.com';

async function fetchCentres() {
    try {
        const res = await fetch(`${PORA_API}/centres`);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();

        // map to local registry shape
        centresRegistry = {};
        data.forEach(u => {
            const status = (u.Statut || u.statut || 'PENDING').toUpperCase();
            if (status === 'PENDING' || status === 'APPROVED') {
                centresRegistry[u.ID || u.id] = {
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
                    img: u.LogoURL || u.logo_url || 'https://api.dicebear.com/7.x/identicon/svg?seed=' + encodeURIComponent(u.Nom || u.nom || u.ID || u.id || 'c'),
                    status: status,
                    statusColor: status === 'APPROVED' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-600'
                };
            }
        });

        renderCentres();
    } catch (err) {
        console.warn('Failed to load centres from PORA API', err);
        showNotification('Erreur de chargement des centres depuis l\'API', 'error');
        centresRegistry = {};
        renderCentres();
    }
}

function renderCentres() {
    const tbody = document.getElementById('centre-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    Object.values(centresRegistry).forEach(data => {
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
    document.querySelectorAll('#centre-table-body button[data-univ-id]').forEach(btn => {
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

function buildInstitutionNotificationMessage(name) {
    const rawName = (name || '').toString().trim();
    const tokens = rawName.split(/\s+/).filter(Boolean);
    const displayName = (tokens[tokens.length - 1] || rawName || 'Cette institution').replace(/[^\w\s-]/g, '').trim();
    const safeName = displayName || 'Cette institution';

    return {
        title: `${safeName} a du nouveau pour vous !`,
        message: `${safeName} a du nouveau pour vous ! Allez découvrir les formations et opportunités que ${safeName} met à votre disposition sur UniverSearch.`
    };
}

async function triggerInstitutionNotification(event) {
    if (!currentNotificationTarget) {
        showNotification('Aucune institution n\'est actuellement sélectionnée.', 'error');
        return;
    }

    const button = event?.currentTarget;
    if (button) {
        button.disabled = true;
        button.classList.add('opacity-70', 'cursor-not-allowed');
    }

    const { title, message } = buildInstitutionNotificationMessage(currentNotificationTarget.name);

    try {
        const response = await fetch(`${NOTIFICATION_SERVICE_URL}/api/notifications/broadcast`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                notification: {
                    type: 'system',
                    title,
                    message,
                    priority: 'high',
                    campaign_type: 'system',
                    delivery_types: ['in_app', 'push'],
                    targeting: {},
                    data: {
                        source: 'admin_broadcast',
                        institution_id: currentNotificationTarget.id,
                        institution_name: currentNotificationTarget.name
                    }
                }
            })
        });

        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body.error || body.errors || `HTTP ${response.status}`);
        }

        showNotification(`Notification envoyée à tous les utilisateurs pour ${currentNotificationTarget.name}.`, 'success');
    } catch (error) {
        console.error('triggerInstitutionNotification error', error);
        showNotification(`Impossible d'envoyer la notification : ${error.message}`, 'error');
    } finally {
        if (button) {
            button.disabled = false;
            button.classList.remove('opacity-70', 'cursor-not-allowed');
        }
    }
}

/**
 * GESTION DE L'ACCÈS
 */
async function toggleAccess(univId, isEnabled) {
    const IDENTITY_API = window.IDENTITY_API_BASE || 'https://api.universearch.com';
    const token = localStorage.getItem('softura_token');

    // update UI optimistically
    if (!isEnabled) {
        showNotification(`L'accès pour ${univId} a été suspendu`, 'error');
    } else {
        showNotification(`Validation en cours pour ${univId}…`, 'info');
    }

    try {
        // find the checkbox element and disable while processing
        const checkbox = Array.from(document.querySelectorAll('#centre-table-body input[type=checkbox]'))
            .find(i => i.getAttribute('onchange') && i.getAttribute('onchange').includes(univId));
        if (checkbox) checkbox.disabled = true;

        if (isEnabled) {
            // approve the university via admin API
            const res = await fetch(`${IDENTITY_API}/admin/centres/${encodeURIComponent(univId)}/approve`, {
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
            if (centresRegistry[univId]) {
                centresRegistry[univId].status = 'APPROVED';
                centresRegistry[univId].statusColor = 'bg-indigo-100 text-indigo-600';
            }

            showNotification(`Centre ${univId} approuvé`, 'success');
        } else {
            // set status back to PENDING via status endpoint
            const res = await fetch(`${IDENTITY_API}/admin/centres/${encodeURIComponent(univId)}/status`, {
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

            if (centresRegistry[univId]) {
                centresRegistry[univId].status = 'PENDING';
                centresRegistry[univId].statusColor = 'bg-slate-200 text-slate-600';
            }

            showNotification(`Centre ${univId} repassé en attente`, 'info');
        }

        renderCentres();
    } catch (err) {
        console.error('toggleAccess error', err);
        showNotification(`Erreur: ${err.message}`, 'error');
        // revert checkbox UI if present
        const checkbox = Array.from(document.querySelectorAll('#centre-table-body input[type=checkbox]'))
            .find(i => i.getAttribute('onchange') && i.getAttribute('onchange').includes(univId));
        if (checkbox) checkbox.checked = !isEnabled;
    } finally {
        const checkbox = Array.from(document.querySelectorAll('#centre-table-body input[type=checkbox]'))
            .find(i => i.getAttribute('onchange') && i.getAttribute('onchange').includes(univId));
        if (checkbox) checkbox.disabled = false;
    }
}

/**
 * OUVERTURE DU MODAL
 */
function openSettings(univId) {
    const data = centresRegistry[univId];
    if (!data) return;

    // Remplissage des champs classiques
    const nameElem = document.getElementById('modal-name');
    if (nameElem) nameElem.innerText = data.name;
    const idElem = document.getElementById('modal-id');
    if (idElem) idElem.innerText = data.id;
    const descElem = document.getElementById('modal-description');
    if (descElem) descElem.innerText = data.description;
    const bdeElem = document.getElementById('modal-bde');
    if (bdeElem) bdeElem.innerText = data.presidentBDE;
    const subElem = document.getElementById('modal-subscribers');
    if (subElem) subElem.innerText = data.subscribers;
    
    // Mise à jour des dates
    const startElem = document.getElementById('modal-sub-start');
    const endElem = document.getElementById('modal-sub-end');
    if(startElem) startElem.innerText = data.subStart;
    if(endElem) {
        endElem.innerText = data.subEnd;
        endElem.className = "text-sm font-bold text-indigo-600";
    }

    // NOUVEAUX CHAMPS (Contact & Siège)
    const phoneElem = document.getElementById('modal-phone');
    if (phoneElem) phoneElem.innerText = data.phone;
    const emailElem = document.getElementById('modal-email');
    if (emailElem) emailElem.innerText = data.email;
    const siegeElem = document.getElementById('modal-siege');
    if (siegeElem) siegeElem.innerText = data.siege;

    // Image et Status
    const imgElem = document.getElementById('modal-img');
    if (imgElem) {
        imgElem.src = data.img;
    }
    const statusLabel = document.getElementById('modal-status');
    if (statusLabel) {
        statusLabel.innerText = data.status;
        statusLabel.className = `mb-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${data.statusColor}`;
    }

    currentNotificationTarget = { id: univId, name: data.name };

    // Affichage
    const modal = document.getElementById('centre-modal');
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // Empêche le scroll en arrière-plan
    }
}

/**
 * FERMETURE DU MODAL
 */
function closeModal() {
    const modal = document.getElementById('centre-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }
    currentNotificationTarget = null;
}

/**
 * RECHERCHE DYNAMIQUE DANS LE TABLEAU
 */
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('table-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('#centre-table-body tr');

            rows.forEach(row => {
                const text = row.innerText.toLowerCase();
                row.style.display = text.includes(term) ? '' : 'none';
            });
        });
    }
    // Charger les centres depuis l'API PORA au démarrage
    // initialiser la navigation (activer la mise en surbrillance du menu)
    if (typeof initNavigation === 'function') initNavigation();
    fetchCentres();
});