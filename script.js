// Data Storage
let appData = {
    university: {
        name: '',
        city: '',
        description: '',
        email: '',
        phone: '',
        website: '',
        logo: null,
        primaryColor: '#6366f1'
    },
    shorts: [],
    flyers: [],
    formations: [],
    events: [],
    testimonials: [],
    followers: [],
    analyticsHistory: [],
    chatMessages: 12
};
window.appData = appData;
let availableFilieres = [];
let availableProfessionalFormations = [];

// API Configuration
const CONTENT_API = window.CONTENT_API || 'https://universearch-content-service.onrender.com';
const MESSAGING_SERVICE_URL = window.MESSAGING_SERVICE_URL || 'https://universearch-messaging.onrender.com';
const DEFAULT_TIMEOUT = 10000; // 10 secondes

// ========== GESTION DES ERREURS API ==========
/**
 * Effectue une requête fetch avec gestion complète des erreurs
 * @param {string} url - URL de la requête
 * @param {object} options - Options fetch standard (method, headers, body, etc.)
 * @param {number} timeout - Timeout en ms (défaut: 10000)
 * @returns {Promise<{ok: boolean, data: any, error: string|null, status: number}>}
 */
async function safeFetch(url, options = {}, timeout = DEFAULT_TIMEOUT) {
    try {
        // Vérifier la connexion réseau
        if (!navigator.onLine) {
            return {
                ok: false,
                data: null,
                error: 'Pas de connexion Internet. Vérifiez votre connexion réseau.',
                status: 0,
                isNetworkError: true
            };
        }

        // Créer un contrôleur d'abort pour le timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // Essayer de parser la réponse
            let data = null;
            const contentType = response.headers.get('content-type');
            if (contentType?.includes('application/json')) {
                try {
                    data = await response.json();
                } catch (e) {
                    console.warn('Erreur lors du parsing JSON:', e);
                    data = null;
                }
            } else {
                try {
                    data = await response.text();
                } catch (e) {
                    console.warn('Erreur lors de la lecture du contenu:', e);
                    data = null;
                }
            }

            if (!response.ok) {
                const errorMessage = data?.message || data?.error || `Erreur serveur (${response.status})`;
                return {
                    ok: false,
                    data,
                    error: `${errorMessage}`,
                    status: response.status,
                    isServerError: true
                };
            }

            return {
                ok: true,
                data,
                error: null,
                status: response.status
            };

        } catch (err) {
            clearTimeout(timeoutId);

            if (err.name === 'AbortError') {
                return {
                    ok: false,
                    data: null,
                    error: `La requête a dépassé le délai d'attente (${timeout / 1000}s). Le serveur ne répond pas.`,
                    status: 0,
                    isTimeout: true
                };
            }

            throw err; // Relancer pour le catch extérieur
        }

    } catch (err) {
        console.error('Erreur lors de la requête:', err);

        // Distinguer les types d'erreurs réseau
        const isNetworkError = err.message?.includes('Failed to fetch') || 
                             err.message?.includes('NetworkError') ||
                             err.message?.includes('Network request failed') ||
                             err instanceof TypeError;

        return {
            ok: false,
            data: null,
            error: isNetworkError
                ? 'Pas de connexion Internet. Vérifiez votre connexion réseau.'
                : `Erreur: ${err.message || 'Une erreur inconnue s\'est produite'}`,
            status: 0,
            isNetworkError
        };
    }
}

/**
 * Affiche un message d'erreur à l'utilisateur avec actions proposées
 * @param {object} errorResult - Résultat de safeFetch avec erreur
 * @param {string} context - Contexte de l'erreur (pour les logs)
 * @param {boolean} showToast - Afficher un toast d'erreur
 */
function handleApiError(errorResult, context = '', showToast = true) {
    const { error, isNetworkError, isTimeout, status } = errorResult;

    console.error(`[${context}] Erreur API:`, error);

    if (showToast) {
        // Afficher le toast d'erreur
        if (typeof window.showToast === 'function') {
            window.showToast(error, 'error');
        }
    }

    // Logger pour le debugging
    if (isNetworkError) {
        console.warn('Erreur réseau détectée');
    } else if (isTimeout) {
        console.warn('Timeout: le serveur ne répond pas');
    } else if (status >= 500) {
        console.error('Erreur serveur 5xx:', status);
    } else if (status >= 400) {
        console.warn('Erreur client 4xx:', status);
    }

    return { error, isNetworkError, isTimeout, status };
}

// ========== FIN GESTION DES ERREURS ==========

// Helper to get JWT token from various storage locations
function getJWTToken() {
    const sessionStr = localStorage.getItem('softura_session') || localStorage.getItem('session') || '{}';
    let session = {};
    try { session = JSON.parse(sessionStr); } catch(e) { session = {}; }
    return session.jwt_token || localStorage.getItem('jwt_token') || localStorage.getItem('softura_token') || localStorage.getItem('token') || null;
}

async function createActivityRecord(title, description = null, status = 'active', isPublic = true) {
    const token = getJWTToken();
    if (!token) {
        console.warn('Enregistrement d\'activité non créé: pas de token');
        return null;
    }

    const activityContext = await resolveActivityOrganizationContext();
    const payload = {
        title,
        description,
        status,
        is_public: isPublic
    };

    if (activityContext.organizationId) {
        payload.organization_id = activityContext.organizationId;
        payload.organization_type = activityContext.organizationType;
    }

    const result = await safeFetch(`${CONTENT_API}/activities`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });

    if (!result.ok) {
        console.warn('Impossible de créer l\'enregistrement d\'activité:', result.error);
        return null;
    }

    return result.data || null;
}

function getUserRole() {
    const token = getJWTToken();
    if (token) {
        try {
            const parts = token.split('.');
            if (parts.length === 3) {
                const payloadPart = parts[1].replace(/-/g, '+').replace(/_/g, '/');
                const paddedPayload = payloadPart.padEnd(payloadPart.length + (4 - (payloadPart.length % 4)) % 4, '=');
                const payload = JSON.parse(atob(paddedPayload));
                const role =
                    payload.user_metadata?.role ||
                    payload.role ||
                    payload.user_role ||
                    payload.userType ||
                    payload.institution_type ||
                    payload.user_type ||
                    '';
                return String(role).toLowerCase();
            }
        } catch (e) {
            console.warn('Unable to parse JWT role:', e);
        }
    }

    const sessionStr = localStorage.getItem('softura_session') || localStorage.getItem('session') || '{}';
    let session = {};
    try { session = JSON.parse(sessionStr); } catch(e) { session = {}; }
    const role = session.role || session.userType || session.institution_type || session.user_type || '';
    return String(role).toLowerCase();
}

function getIdentityApiBase() {
    return window.API_BASE || 'https://universearch-pwlf.onrender.com';
}

function getInstitutionKind() {
    const role = getUserRole();
    const profile = window.currentProfile || appData.university?.raw || {};
    const raw = [
        role,
        profile.role,
        profile.profile_type,
        profile.profileType,
        profile.type,
        profile.__institution_kind,
        profile.institution_type
    ].filter(Boolean).join(' ').toLowerCase();

    if (raw.includes('centre')) return 'centre';
    return 'universite';
}

function getCurrentOrganizationContext() {
    const sessionStr = localStorage.getItem('softura_session') || localStorage.getItem('session') || '{}';
    let session = {};
    try { session = JSON.parse(sessionStr); } catch(e) { session = {}; }

    const profile = window.currentProfile || appData.university?.raw || {};
    const kind = getInstitutionKind();
    const id = profile.id || profile.centre_id || profile.universite_id || session.organization_id || session.entity_id || session.id || session.profile_id || null;
    const profileId = profile.profile_id || session.profile_id || session.userId || session.id || null;
    const contentAuthorId = profileId || profile.user_id || session.user_id || id;

    return {
        kind,
        id,
        profileId,
        organizationId: id,
        contentAuthorId,
        meEndpoint: kind === 'centre' ? '/centres/me' : '/universites/me',
        logoEndpoint: kind === 'centre' ? '/centres/me/logo' : '/universites/me/logo',
        filieresEndpoint: kind === 'centre' ? '/centres/me/filieres' : '/universites/me/filieres',
        entityType: kind === 'centre' ? 'centre' : 'universite',
        followersType: kind === 'centre' ? 'centres' : 'universites'
    };
}

async function resolveActivityOrganizationContext() {
    let context = typeof getCurrentOrganizationContext === 'function' ? getCurrentOrganizationContext() : null;

    if (!context?.organizationId && typeof loadUniversityProfileFromApi === 'function') {
        await loadUniversityProfileFromApi();
        context = getCurrentOrganizationContext();
    }

    const organizationType = context?.kind === 'centre' ? 'centre_formation' : 'universite';

    return {
        organizationId: context?.organizationId || null,
        organizationType
    };
}

function normalizeUniversityProfile(profile = {}) {
    return {
        id: profile.id || profile.centre_id || profile.universite_id || null,
        profileId: profile.profile_id || profile.profileId || null,
        name: profile.nom || profile.name || profile.universiteName || appData.university.name || '',
        city: profile.ville || profile.city || profile.cityName || profile.location || appData.university.city || '',
        description: profile.description ?? profile.bio ?? profile.about ?? appData.university.description ?? '',
        email: profile.email ?? profile.contact_email ?? appData.university.email ?? '',
        phone: profile.contacts ?? profile.phone ?? profile.telephone ?? profile.telephone_contact ?? appData.university.phone ?? '',
        website: profile.lien_site ?? profile.website ?? profile.site ?? profile.site_web ?? profile.website_url ?? appData.university.website ?? '',
        logo: profile.logo_url ?? profile.logo ?? profile.logoUrl ?? profile.image ?? profile.avatar ?? appData.university.logo ?? null,
        coverLogo: profile.couverture_logo_url ?? appData.university.coverLogo ?? null,
        primaryColor: profile.primary_color ?? profile.primaryColor ?? profile.color ?? appData.university.primaryColor ?? '#6366f1',
        sigle: profile.sigle ?? appData.university.sigle ?? '',
        anneeFondation: profile.annee_fondation ?? appData.university.anneeFondation ?? null,
        raw: profile
    };
}

function applyUniversityProfile(profile) {
    if (!profile) return;
    appData.university = {
        ...appData.university,
        ...normalizeUniversityProfile(profile)
    };
    window.currentProfile = profile;
    window.appData = appData;
    updateUniversityInfo();
}

async function loadUniversityProfileFromApi() {
    const token = getJWTToken();
    if (!token) {
        console.warn('Pas de token: impossible de charger le profil');
        return false;
    }

    const role = getUserRole();
    const endpoints = role.includes('centre') ? ['/centres/me'] : ['/universites/me', '/centres/me'];
    let lastError = null;

    for (const endpoint of endpoints) {
        const result = await safeFetch(`${getIdentityApiBase()}${endpoint}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!result.ok) {
            lastError = result;
            console.warn(`Impossible de charger ${endpoint}: ${result.error}`);
            continue;
        }

        const json = result.data;
        const profile = Array.isArray(json) ? json[0] : (json?.data || json || {});
        if (!profile || typeof profile !== 'object') continue;

        profile.__institution_kind = endpoint.includes('/centres') ? 'centre' : 'universite';
        applyUniversityProfile(profile);
        console.log(`Profil chargé depuis ${endpoint}:`, profile.nom || profile.name || profile.id);
        return true;
    }

    console.warn('Impossible de charger le profil: tous les endpoints ont échoué');
    // Afficher le message d'erreur du dernier appel échoué
    if (lastError && typeof window.showToast === 'function') {
        window.showToast(lastError.error || 'Impossible de charger le profil', 'error');
    }
    return false;
}

async function uploadUniversityLogoIfNeeded() {
    const token = getJWTToken();
    const logo = appData.university.logo;
    if (!token || typeof logo !== 'string' || !logo.startsWith('data:')) {
        return logo || null;
    }

    const match = logo.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;

    const contentType = match[1] || 'image/png';
    const extension = contentType.split('/')[1] || 'png';
    const { logoEndpoint } = getCurrentOrganizationContext();

    const result = await safeFetch(`${getIdentityApiBase()}${logoEndpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
            file: match[2],
            filename: `logo.${extension}`,
            contentType
        })
    });

    if (!result.ok) {
        console.warn('Impossible de charger le logo:', result.error);
        return null;
    }

    const json = result.data;
    return json?.url || json?.logo_url || json?.data?.url || null;
}

async function saveUniversityProfileToApi() {
    const token = getJWTToken();
    if (!token) {
        if (typeof window.showToast === 'function') {
            window.showToast('Session expirée : reconnectez-vous', 'error');
        }
        return null;
    }

    const { meEndpoint } = getCurrentOrganizationContext();

    // Upload logo if needed
    const uploadedLogoUrl = await uploadUniversityLogoIfNeeded();
    if (uploadedLogoUrl) {
        appData.university.logo = uploadedLogoUrl;
    }

    const payload = {
        nom: appData.university.name || null,
        description: appData.university.description || null,
        contacts: appData.university.phone || null,
        email: appData.university.email || null,
        ville: appData.university.city || null,
        lien_site: appData.university.website || null,
        logo_url: appData.university.logo || null,
        primary_color: appData.university.primaryColor || null
    };

    const result = await safeFetch(`${getIdentityApiBase()}${meEndpoint}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });

    if (!result.ok) {
        handleApiError(result, 'saveUniversityProfileToApi', true);
        return null;
    }

    const profile = result.data?.data || result.data;
    if (profile && typeof profile === 'object') {
        applyUniversityProfile(profile);
        if (typeof window.showToast === 'function') {
            window.showToast('Profil mise à jour avec succès', 'success');
        }
    }
    return profile;
}

function normalizeRemoteFormation(filiere, domaine = {}, index = 0) {
    // Support both university filieres and professional formations
    const name = filiere?.nom_affiche || filiere?.nom_formation || filiere?.name || filiere?.nom || filiere?.title || filiere?.label || `Formation ${index + 1}`;
    const alternance = filiere?.alternance === true || String(filiere?.alternance || '').toLowerCase() === 'oui' ? 'Oui' : 'Non';
    
    return {
        id: filiere?.id || String(name).toLowerCase().replace(/\s+/g, '-'),
        name,
        level: filiere?.niveau_detail || filiere?.niveau || filiere?.level || filiere?.type_certification || domaine?.nom || 'Formation',
        duration: filiere?.duree || filiere?.duration || '',
        location: filiere?.lieu || filiere?.location || '',
        language: filiere?.langue || filiere?.language || 'Francais',
        description: filiere?.description || domaine?.description || '',
        prerequisites: filiere?.prerequis || filiere?.prerequisites || '',
        fees: filiere?.frais_inscription || filiere?.cout_formation || filiere?.fees || '',
        feesL1: filiere?.frais_l1 || filiere?.feesL1 || '',
        feesL2: filiere?.frais_l2 || filiere?.feesL2 || '',
        feesL3: filiere?.frais_l3 || filiere?.feesL3 || '',
        feesM1: filiere?.frais_m1 || filiere?.feesM1 || '',
        feesM2: filiere?.frais_m2 || filiere?.feesM2 || '',
        feesM3: filiere?.frais_m3 || filiere?.feesM3 || '',
        alternance,
        // Professional formation specific fields
        category: filiere?.categorie_domaine || '',
        certification: filiere?.type_certification || '',
        mode: filiere?.mode_formation || '',
        createdAt: filiere?.created_at || filiere?.date_creation || new Date().toISOString()
    };
}

function extractFormationsFromProfile(profile) {
    const formations = [];

    // Case 1: Universités - formations viennent de domaines
    const domaines = Array.isArray(profile?.domaines) ? profile.domaines : [];
    domaines.forEach((domaine) => {
        const filieres = Array.isArray(domaine?.filieres) ? domaine.filieres : [];
        filieres.forEach((filiere) => {
            formations.push(normalizeRemoteFormation(filiere, domaine, formations.length));
        });
    });

    // Case 2: Centres - formations professionnelles dans filieres avec filiere_id = null
    const directFilieres = Array.isArray(profile?.filieres) ? profile.filieres : [];
    directFilieres.forEach((filiere) => {
        // Skip if it's a normal filiere (with filiere_id linked to a generic filiere)
        // Include it if it's a professional formation (filiere_id = null)
        if (filiere?.filiere_id === null || filiere?.filiere_id === undefined) {
            formations.push(normalizeRemoteFormation(filiere, {}, formations.length));
        }
    });

    return formations;
}

async function loadFormationsFromApi() {
    const token = getJWTToken();
    if (!token) {
        console.warn('Pas de token: impossible de charger les formations');
        return false;
    }

    const { meEndpoint: endpoint } = getCurrentOrganizationContext();

    const result = await safeFetch(`${getIdentityApiBase()}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
    });

    if (!result.ok) {
        const errorMsg = result.error || 'Impossible de charger les formations';
        console.warn(`Impossible de charger les formations: ${errorMsg}`);
        if (typeof window.showToast === 'function' && result.isNetworkError) {
            window.showToast(errorMsg, 'error');
        }
        return false;
    }

    const json = result.data;
    const profile = Array.isArray(json) ? json[0] : (json?.data || json || {});
    const formations = extractFormationsFromProfile(profile);

    appData.formations = formations;
    window.appData = appData;
    updateAllDisplays();
    populateFormationDropdown();
    console.log(`Formations chargées depuis ${endpoint}: ${formations.length}`);
    return true;
}

async function loadAvailableFilieresFromApi() {
    const { kind } = getCurrentOrganizationContext();
    const endpoint = kind === 'centre' ? '/centres/filieres' : '/filieres';

    const result = await safeFetch(`${getIdentityApiBase()}${endpoint}`);

    if (!result.ok) {
        const errorMsg = result.error || 'Impossible de charger les filières';
        console.warn(`Impossible de charger les filieres: ${errorMsg}`);
        if (typeof window.showToast === 'function' && result.isNetworkError) {
            window.showToast(errorMsg, 'error');
        }
        return false;
    }

    const json = result.data;
    const data = Array.isArray(json) ? json : (json?.data || json?.filieres || []);
    availableFilieres = data
        .map((item, index) => ({
            id: item.id || item.filiere_id || '',
            name: item.nom || item.name || item.title || `Filiere ${index + 1}`,
            domaine_id: item.domaine_id || item.domaineId || null
        }))
        .filter((item) => item.id && item.name);
    window.availableFilieres = availableFilieres;
    populateFormationDropdown();
    console.log(`Filieres disponibles chargées: ${availableFilieres.length}`);
    return availableFilieres.length > 0;
}

function findAvailableFiliereByName(name) {
    const normalized = String(name || '').trim().toLowerCase();
    if (!normalized) return null;

    const sources = [
        ...(Array.isArray(availableFilieres) ? availableFilieres : []),
        ...(Array.isArray(appData.formations) ? appData.formations : [])
    ];

    return sources.find((item) => {
        const itemName = String(item.name || item.nom || item.title || '').trim().toLowerCase();
        return itemName === normalized && item.id;
    }) || null;
}

async function attachFiliereToCurrentOrganization(filiereId, formationDetails = null) {
    const token = getJWTToken();
    if (!token) {
        const errorMsg = 'Session expirée: reconnectez-vous';
        if (typeof window.showToast === 'function') {
            window.showToast(errorMsg, 'error');
        }
        return null;
    }

    const { kind, filieresEndpoint: endpoint } = getCurrentOrganizationContext();
    const payload = { filiereIds: [filiereId] };
    if (kind !== 'centre' && formationDetails) {
        payload.formationDetails = [{ filiere_id: filiereId, ...formationDetails }];
    }

    const result = await safeFetch(`${getIdentityApiBase()}${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });

    if (!result.ok) {
        console.warn('Impossible d\'attacher la filière:', result.error);
        if (typeof window.showToast === 'function') {
            window.showToast('Impossible d\'attacher la filière', 'error');
        }
        return null;
    }

    if (typeof window.showToast === 'function') {
        window.showToast('Filière attachée avec succès', 'success');
    }
    return result.data || null;
}

async function attachProfessionalFormationToMyCentre(formations) {
    const token = getJWTToken();
    if (!token) {
        throw new Error('Session expiree: reconnectez-vous');
    }

    const endpoint = '/centres/me/filieres';
    
    const payload = {
        formationDetails: Array.isArray(formations) ? formations : [formations]
    };

    const res = await fetch(`${getIdentityApiBase()}${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const message = await res.text().catch(() => '');
        throw new Error(message || `Impossible d'ajouter la formation professionnelle (${res.status})`);
    }

    return res.json().catch(() => null);
}

async function loadFormationsFromJson() {
    const role = getUserRole();
    const isCentre = role.includes('centre');
    const primaryPath = isCentre ? '../Frontend/mes-formations.json' : '../Frontend/mes-filieres.json.bak';
    const fallbackPath = isCentre ? null : '../Frontend/mes-filieres.json';
    const paths = [primaryPath];
    if (fallbackPath) paths.push(fallbackPath);

    for (const path of paths) {
        try {
            const res = await fetch(path);
            if (!res.ok) {
                console.warn(`Unable to fetch ${path}: ${res.status}`);
                continue;
            }
            const data = await res.json();
            if (!Array.isArray(data) || data.length === 0) {
                continue;
            }

            appData.formations = data.map((item, index) => ({
                id: item.id || String(item.name || item.nom || `formation_${Date.now()}_${index}`)
                    .toLowerCase()
                    .replace(/\s+/g, '-'),
                name: item.name || item.nom || `Formation ${index + 1}`,
                level: 'Licence',
                duration: item.duration || '',
                location: item.location || '',
                language: item.language || 'Français',
                description: item.description || '',
                prerequisites: item.prerequisites || '',
                fees: item.fees || '',
                alternance: item.alternance || 'Non',
                createdAt: new Date().toISOString()
            }));

            console.log(`✅ Formations chargées depuis ${path}`);
            saveData();
            return true;
        } catch (error) {
            console.warn(`Error loading formations from ${path}:`, error);
        }
    }
    return false;
}

function populateFormationDropdown() {
    const input = document.getElementById('formationName');
    const datalist = document.getElementById('formationOptions');
    if (!input || !datalist) return;

    const formations = [
        ...(Array.isArray(appData.formations) ? appData.formations : []),
        ...(Array.isArray(availableFilieres) ? availableFilieres : [])
    ];
    if (formations.length === 0) {
        datalist.innerHTML = '<option value="Chargement des filières..."></option>';
        return;
    }

    const seenOptions = new Set();
    const options = formations
        .map((item) => ({
            value: item.name || item.nom || item.title || item.label || '',
            id: item.id || String(item.name || item.nom || item.title || item.label || '').toLowerCase().replace(/\s+/g, '-'),
            original: item
        }))
        .filter((item) => item.value)
        .filter((item) => {
            const key = `${item.id || ''}:${item.value.toLowerCase()}`;
            if (seenOptions.has(key)) return false;
            seenOptions.add(key);
            return true;
        })
        .sort((a, b) => a.value.localeCompare(b.value, 'fr', { sensitivity: 'base' }));

    datalist.innerHTML = options
        .map((item) => `\n                <option value="${item.value}" data-id="${item.id}"></option>`)
        .join('');
}

function populateProfessionalFormationDropdown() {
    const datalist = document.getElementById('proFormationOptions');
    if (!datalist) return;

    fetch('../Frontend/mes-formations.json')
        .then(res => res.json())
        .then(formations => {
            if (!Array.isArray(formations)) return;

            availableProfessionalFormations = formations.map(item => ({
                id: item.id,
                name: item.name
            }));

            datalist.innerHTML = formations
                .map(item => `<option value="${escapeHtml(item.name)}"></option>`)
                .join('');
        })
        .catch(error => {
            console.error('Error loading professional formations dropdown:', error);
            availableProfessionalFormations = [];
            datalist.innerHTML = '';
        });
}

// Variables globales pour les graphiques
let followersChart = null;
let dashboardPerformanceChart = null;
let engagementChart = null;
let performanceChart = null;
let analyticsFollowersChart = null;

function getLastTwelveMonthLabels(referenceDate = new Date()) {
    const formatter = new Intl.DateTimeFormat('fr-FR', { month: 'short' });

    return Array.from({ length: 12 }, (_, index) => {
        const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 11 + index, 1);
        const month = formatter.format(date).replace('.', '');
        const label = month.charAt(0).toUpperCase() + month.slice(1);

        return date.getMonth() === 0 ? `${label} ${date.getFullYear()}` : label;
    });
}

// ❌ SUPPRIMÉ: Fonction initSampleData() - Plus de données d'exemple
// L'application démarre désormais avec des données vides

// Load data without using localStorage persistence
async function loadData() {
    localStorage.removeItem('uniflow_data');

    await loadUniversityProfileFromApi();
    await loadAvailableFilieresFromApi();
    const loadedFromApi = await loadFormationsFromApi();
    const loadedTopFollowers = await loadTopFollowers();
    if (!loadedTopFollowers && appData.followers.length === 0) {
        appData.followers = [];
    }
    const formationsEmpty = !Array.isArray(appData.formations) || appData.formations.length === 0;
    if (!loadedFromApi && formationsEmpty) {
        const loadedFromJson = await loadFormationsFromJson();
        // ❌ SUPPRIMÉ: if (!loadedFromJson) { initSampleData(); }
        // Plus aucune donnée d'exemple générée
    }
    // ❌ SUPPRIMÉ: else { initSampleData(); }

    window.appData = appData;
    updateAllDisplays();
    populateFormationDropdown();
    if (typeof fetchAndDisplayShorts === 'function') {
        setTimeout(fetchAndDisplayShorts, 50);
    }
    if (typeof fetchAndDisplayFlyers === 'function') {
        setTimeout(fetchAndDisplayFlyers, 100);
    }
}

// Save data in memory only; do not persist appData to localStorage
function saveData() {
    window.appData = appData;
    updateAllDisplays();
}

async function loadTopFollowers() {
    console.log('[TopFollowers] loadTopFollowers called');
    const token = getJWTToken();
    const { organizationId, kind } = getCurrentOrganizationContext();
    console.log('[TopFollowers] organizationId:', organizationId, 'organizationType raw:', kind);
    const searchParams = new URLSearchParams();

    if (organizationId) {
        searchParams.set('organization_id', organizationId);
    }

    if (kind) {
        searchParams.set('organization_type', kind === 'centre' ? 'centre_formation' : 'universite');
    }

    const endpoint = `${CONTENT_API}/stats/organization/top-followers${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    console.log('[TopFollowers] endpoint:', endpoint);

    const headers = {
        'Content-Type': 'application/json',
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const result = await safeFetch(endpoint, { headers });

    if (!result.ok) {
        console.warn('Impossible de charger les top followers:', result.error);
        return false;
    }

    const json = result.data;
    console.log('[TopFollowers] fetch response payload:', json);

    if (!json || !json.success || !Array.isArray(json.data)) {
        console.warn('Payload inattendu pour top followers:', json);
        return false;
    }

    if (json.data.length > 0) {
        appData.followers = json.data.map((item) => ({
            id: item.user_id,
            display_name: item.display_name,
            likes: item.likes,
            comments: item.comments,
            views: item.views,
            score: item.score,
            last_interaction_at: item.last_interaction_at,
            platform: item.display_name,
            handle: item.user_id,
        }));
        return true;
    }

    return false;
}

// Update all UI components
function updateAllDisplays() {
    updateUniversityInfo();
    updateCounters();
    updateDashboardStats();
    updateFollowersSection();
    displayShorts();
    displayFlyers();
    displayFormations();
    updateAnalytics();
    updateActivityFeed();
    updateChatUI();
    displayTemplates('all');
    initAllCharts();
}

function updateUniversityInfo() {
    const sidebarName = document.getElementById('sidebarUniName');
    if (sidebarName) sidebarName.textContent = appData.university.name;
    
    const uniName = document.getElementById('uniName');
    if (uniName) uniName.value = appData.university.name;
    
    const uniSigle = document.getElementById('uniSigle');
    if (uniSigle) uniSigle.value = appData.university.sigle || '';
    
    const uniCity = document.getElementById('uniCity');
    if (uniCity) uniCity.value = appData.university.city;
    
    const uniDescription = document.getElementById('uniDescription');
    if (uniDescription) uniDescription.value = appData.university.description;
    
    const descCount = document.getElementById('descCount');
    if (descCount) descCount.textContent = `${appData.university.description.length}/2000`;
    const uniPhone = document.getElementById('uniPhone');
    if (uniPhone) uniPhone.value = appData.university.phone;
    
    const uniWebsite = document.getElementById('uniWebsite');
    if (uniWebsite) uniWebsite.value = appData.university.website;
    
    const primaryColor = document.getElementById('primaryColor');
    if (primaryColor) primaryColor.value = appData.university.primaryColor;
    
    const uniAvatarPreview = document.getElementById('uniAvatarPreview');
    if (appData.university.logo && uniAvatarPreview) {
        uniAvatarPreview.innerHTML = `<img src="${appData.university.logo}" style="width:100%;height:100%;object-fit:cover;border-radius:12px">`;
    }

    const logoPreview = document.getElementById('logoPreview');
    const logoFilename = document.getElementById('logoFilename');
    if (appData.university.logo && logoPreview) {
        logoPreview.innerHTML = `<img src="${appData.university.logo}" alt="Logo" style="width:100%;height:100%;object-fit:cover;border-radius:12px">`;
        if (logoFilename) logoFilename.textContent = appData.university.logo.startsWith('data:')
            ? 'Logo selectionne'
            : 'Logo charge depuis le serveur';
    }

    // Mettre à jour le logo dans le header
    const headerLogo = document.getElementById('headerUniversityLogo');
    if (headerLogo && appData.university.logo) {
        headerLogo.src = appData.university.logo;
        headerLogo.onerror = () => {
            headerLogo.src = `https://ui-avatars.com/api/?background=6366f1&color=fff&rounded=true&bold=true&name=${encodeURIComponent(appData.university.name.substring(0, 1))}`;
        };
    } else if (headerLogo) {
        headerLogo.src = `https://ui-avatars.com/api/?background=6366f1&color=fff&rounded=true&bold=true&name=${encodeURIComponent(appData.university.name.substring(0, 1))}`;
    }
    
    document.documentElement.style.setProperty('--primary', appData.university.primaryColor);
    document.documentElement.style.setProperty('--primary-dark', appData.university.primaryColor);
}

function updateCounters() {
    const shortsCount = document.getElementById('shortsCount');
    if (shortsCount) shortsCount.textContent = appData.shorts.length;
    
    const flyersCount = document.getElementById('flyersCount');
    if (flyersCount) flyersCount.textContent = appData.flyers.length;
}

function updateDashboardStats() {
    const statShorts = document.getElementById('statShorts');
    if (statShorts) statShorts.textContent = appData.shorts.length;
    const statTrendShorts = document.getElementById('statTrendShorts');
    setTrendText(statTrendShorts, computeRecentItemGrowth(appData.shorts));
    
    const statFlyers = document.getElementById('statFlyers');
    if (statFlyers) statFlyers.textContent = appData.flyers.length;
    const statTrendFlyers = document.getElementById('statTrendFlyers');
    setTrendText(statTrendFlyers, computeRecentItemGrowth(appData.flyers));
    
    const totalViews = appData.shorts.reduce((s, c) => s + getContentViews(c), 0) + 
                       appData.flyers.reduce((s, c) => s + getContentViews(c), 0);
    const statViews = document.getElementById('statViews');
    if (statViews) statViews.textContent = formatNumber(totalViews);
    const statTrendViews = document.getElementById('statTrendViews');
    setTrendText(statTrendViews, computeHistoryGrowth('views'));
    
    const totalFollowers = (typeof appData.server_followers_count === 'number')
        ? appData.server_followers_count
        : 0;
    const statFollowers = document.getElementById('statFollowers');
    if (statFollowers) statFollowers.textContent = formatNumber(totalFollowers);
    const statTrendFollowers = document.getElementById('statTrendFollowers');
    setTrendText(statTrendFollowers, computeHistoryGrowth('followers'));
    
    const totalMessages = getTotalContentComments();
    const statMessages = document.getElementById('statMessages');
    if (statMessages) statMessages.textContent = formatNumber(totalMessages);
    const statTrendMessages = document.getElementById('statTrendMessages');
    setTrendText(statTrendMessages, computeHistoryGrowth('messages'));
}

// NOUVELLE FONCTION : Formatage des nombres
function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
}

function formatPercentage(value) {
    if (value === null || Number.isNaN(value)) return 'N/A';
    const rounded = Math.round(value);
    const sign = rounded > 0 ? '+' : rounded < 0 ? '' : '';
    return `${sign}${rounded}%`;
}

function setTrendText(element, growthValue) {
    if (!element) return;
    element.classList.remove('up', 'down');
    if (growthValue === null || Number.isNaN(growthValue)) {
        element.innerHTML = `<i class="fas fa-minus"></i> N/A`;
        return;
    }
    const direction = growthValue > 0 ? 'up' : growthValue < 0 ? 'down' : '';
    if (direction) element.classList.add(direction);
    const icon = growthValue > 0 ? 'fa-arrow-up' : growthValue < 0 ? 'fa-arrow-down' : 'fa-minus';
    element.innerHTML = `<i class="fas ${icon}"></i> ${formatPercentage(growthValue)}`;
}

function computeHistoryGrowth(metricKey) {
    if (!Array.isArray(appData.analyticsHistory) || appData.analyticsHistory.length < 14) {
        return null;
    }
    const history = appData.analyticsHistory.slice(-14);
    const previousPeriod = history.slice(0, 7);
    const recentPeriod = history.slice(7, 14);
    const previousSum = previousPeriod.reduce((sum, item) => sum + Number(item[metricKey] || 0), 0);
    const recentSum = recentPeriod.reduce((sum, item) => sum + Number(item[metricKey] || 0), 0);
    if (previousSum === 0) {
        return recentSum === 0 ? 0 : null;
    }
    return ((recentSum - previousSum) / previousSum) * 100;
}

function computeRecentItemGrowth(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return null;
    }
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    let recentCount = 0;
    let previousCount = 0;

    items.forEach(item => {
        const createdAt = getContentCreatedAt(item);
        const date = new Date(createdAt);
        if (isNaN(date.getTime())) return;
        if (date >= sevenDaysAgo) {
            recentCount += 1;
        } else if (date >= fourteenDaysAgo) {
            previousCount += 1;
        }
    });

    if (previousCount === 0) {
        return recentCount === 0 ? 0 : null;
    }
    return ((recentCount - previousCount) / previousCount) * 100;
}

function getDashboardStatValue(id, fallback = 0) {
    const element = document.getElementById(id);
    if (!element) return fallback;
    const value = parseInt(element.textContent?.replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(value) ? value : fallback;
}

function buildSyntheticHistory(days, values = {}) {
    const now = new Date();
    const totalViews = values.views || 0;
    const totalLikes = values.likes ?? Math.round(totalViews * 0.15);
    const totalShares = values.shares ?? Math.round(totalViews * 0.08);
    const totalMessages = values.messages ?? values.messages_count ?? 0;
    const totalFollowers = values.followers ?? values.followers_count ?? 0;
    const stepViews = days > 0 ? Math.max(1, Math.round(totalViews / days)) : 0;
    const stepLikes = days > 0 ? Math.max(0, Math.round(totalLikes / days)) : 0;
    const stepShares = days > 0 ? Math.max(0, Math.round(totalShares / days)) : 0;
    const stepMessages = days > 0 ? Math.max(0, Math.round(totalMessages / days)) : 0;
    const stepFollowers = days > 0 ? Math.max(0, Math.round(totalFollowers / days)) : 0;
    const history = [];

    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        history.push({
            date: date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
            views: Math.min(totalViews, stepViews * (days - i)),
            likes: Math.min(totalLikes, stepLikes * (days - i)),
            shares: Math.min(totalShares, stepShares * (days - i)),
            messages: Math.min(totalMessages, stepMessages * (days - i)),
            followers: Math.min(totalFollowers, stepFollowers * (days - i))
        });
    }

    return history;
}

function getContentViews(item) {
    return Number(item.views_count ?? item.views ?? item.view_count ?? 0);
}

function getContentLikes(item) {
    return Number(item.likes_count ?? item.likes ?? 0);
}

function getContentShares(item) {
    return Number(item.shares_count ?? item.shares ?? 0);
}

function getContentComments(item) {
    return Number(item.comments_count ?? item.comments ?? item.comment_count ?? 0);
}

function getTotalContentComments() {
    return appData.shorts.reduce((sum, item) => sum + getContentComments(item), 0) +
        appData.flyers.reduce((sum, item) => sum + getContentComments(item), 0);
}

function getContentCreatedAt(item) {
    return new Date(item.createdAt || item.date_creation || item.date_publication || item.created_at || Date.now()).toISOString();
}

function initSampleFollowersData() {
    appData.followers = [];
}

// NOUVELLE FONCTION : Mise à jour section followers
function updateFollowersSection() {
    const followersList = document.getElementById('followersList');
    console.log('[TopFollowers] updateFollowersSection called', {
        followersLength: appData.followers.length,
        followersListExists: !!followersList,
    });
    if (followersList) {
        followersList.innerHTML = appData.followers.map(follower => {
            const name = follower.display_name || follower.platform || follower.handle || follower.name || follower.id || 'Follower';
            const interactionCount = follower.score != null
                ? `${formatNumber(follower.score)} interactions`
                : typeof follower.followers === 'number'
                    ? `${formatNumber(follower.followers)} followers`
                    : '';
            const likes = Number(follower.likes || follower.followers || 0);
            const comments = Number(follower.comments || 0);
            const views = Number(follower.views || 0);

            return `
            <div class="follower-item">
                <div class="follower-avatar ${follower.color || 'platform-1'}">
                    <i class="fab ${follower.icon || 'fa-user'}"></i>
                </div>
                <div class="follower-info">
                    <div class="follower-name">${escapeHtml(name)}</div>
                    <div class="follower-meta">${escapeHtml(interactionCount)}</div>
                    <div class="follower-details">
                        <span>${formatNumber(likes)} likes</span>
                        <span>${formatNumber(comments)} commentaires</span>
                        <span>${formatNumber(views)} vues</span>
                    </div>
                </div>
            </div>
        `;
        }).join('');
    }
}

// NOUVELLE FONCTION : Initialisation de tous les graphiques
function initAllCharts() {
    initFollowersChart();
    initDashboardPerformanceChart();
    initEngagementChart();
    initPerformanceChart();
    initAnalyticsFollowersChart();
}

function initFollowersChart() {
    const ctx = document.getElementById('followersChart');
    if (!ctx) return;
    
    if (followersChart) followersChart.destroy();
    
    // Utiliser les vrais followers de l'API
    const followers = Array.isArray(appData.followers) ? appData.followers : [];
    const colors = [
        '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', 
        '#8b5cf6', '#f97316', '#14b8a6', '#d946ef', '#6ee7b7'
    ];
    
    // Si pas de followers, afficher un graphe vide
    if (followers.length === 0) {
        followersChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Aucune donnée'],
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: { enabled: true }
                }
            }
        });
        return;
    }
    
    // Créer un dataset pour chaque top follower avec ses interactions
    const datasets = followers.slice(0, 5).map((follower, index) => {
        const color = colors[index % colors.length];
        const displayName = follower.display_name || `Follower ${index + 1}`;
        
        // Simuler une progression d'interactions sur 12 mois pour ce follower
        const baseInteractions = follower.score || 100;
        const monthlyData = Array.from({ length: 12 }, (_, month) => {
            // Croissance progressive avec variation
            const growth = Math.floor((baseInteractions / 12) * (month + 1));
            const variance = Math.floor(Math.random() * (baseInteractions * 0.1));
            return Math.max(0, growth + variance);
        });
        
        return {
            label: displayName,
            data: monthlyData,
            borderColor: color,
            backgroundColor: color.replace(')', ', 0.08)').replace('rgb(', 'rgba('),
            borderWidth: 2.5,
            tension: 0.4,
            fill: true,
            pointBackgroundColor: color,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 6
        };
    });
    
    const labels = getLastTwelveMonthLabels();
    
    followersChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: { size: 11, family: "'Inter', sans-serif" },
                        boxWidth: 8,
                        boxHeight: 8
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.85)',
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatNumber(context.parsed.y) + ' interactions';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.04)' },
                    ticks: {
                        callback: function(value) { return formatNumber(value); },
                        font: { size: 11 }
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 11 } }
                }
            }
        }
    });
}

function initDashboardPerformanceChart() {
    const ctx = document.getElementById('dashboardPerformanceChart');
    if (!ctx) return;
    
    if (dashboardPerformanceChart) dashboardPerformanceChart.destroy();
    
    let history = Array.isArray(appData.analyticsHistory) ? appData.analyticsHistory.slice(-14) : [];
    if (history.length === 0) {
        const totalViews = appData.shorts.reduce((sum, item) => sum + getContentViews(item), 0) + appData.flyers.reduce((sum, item) => sum + getContentViews(item), 0);
        const totalMessages = getDashboardStatValue('statMessages', getTotalContentComments());
        const totalFollowers = getDashboardStatValue('statFollowers', (typeof appData.server_followers_count === 'number') ? appData.server_followers_count : 0);
        history = buildSyntheticHistory(14, { views: totalViews, messages: totalMessages, followers: totalFollowers });
    }
    
    dashboardPerformanceChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: history.map(h => h.date),
            datasets: [
                {
                    label: 'Vues',
                    data: history.map(h => h.views),
                    backgroundColor: 'rgba(99, 102, 241, 0.7)',
                    borderColor: '#6366f1',
                    borderWidth: 1,
                    borderRadius: 6,
                    borderSkipped: false
                },
                {
                    label: 'Commentaires',
                    data: history.map(h => h.messages ?? 0),
                    backgroundColor: 'rgba(16, 185, 129, 0.7)',
                    borderColor: '#10b981',
                    borderWidth: 1,
                    borderRadius: 6,
                    borderSkipped: false
                },
                {
                    label: 'Followers',
                    data: history.map(h => h.followers ?? 0),
                    backgroundColor: 'rgba(245, 158, 11, 0.7)',
                    borderColor: '#f59e0b',
                    borderWidth: 1,
                    borderRadius: 6,
                    borderSkipped: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: { size: 11, family: "'Inter', sans-serif" },
                        boxWidth: 8,
                        boxHeight: 8
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.85)',
                    padding: 12,
                    cornerRadius: 8
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.04)' },
                    ticks: { font: { size: 11 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 11 } }
                }
            }
        }
    });
}

function initEngagementChart() {
    const ctx = document.getElementById('engagementChart');
    if (!ctx) return;
    
    if (engagementChart) engagementChart.destroy();
    
    engagementChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Shorts publiés', 'Flyers actifs', 'Vues totales', 'Followers totaux', 'Commentaires'],
            datasets: [{
                data: [
                    getDashboardStatValue('statShorts', appData.shorts.length),
                    getDashboardStatValue('statFlyers', appData.flyers.length),
                    getDashboardStatValue('statViews', appData.shorts.reduce((s, c) => s + getContentViews(c), 0) + appData.flyers.reduce((s, c) => s + getContentViews(c), 0)),
                    getDashboardStatValue('statFollowers', (typeof appData.server_followers_count === 'number') ? appData.server_followers_count : 0),
                    getDashboardStatValue('statMessages', getTotalContentComments())
                ],
                backgroundColor: [
                    'rgba(99, 102, 241, 0.8)',
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(139, 92, 246, 0.8)'
                ],
                borderColor: '#fff',
                borderWidth: 3,
                hoverBorderWidth: 4,
                hoverBorderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        font: { size: 11, family: "'Inter', sans-serif" },
                        boxWidth: 8,
                        boxHeight: 8
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.85)',
                    padding: 12,
                    cornerRadius: 8
                }
            },
            cutout: '60%'
        }
    });
}

function initPerformanceChart() {
    const ctx = document.getElementById('performanceChart');
    if (!ctx) return;
    
    if (performanceChart) performanceChart.destroy();
    
    const period = parseInt(document.getElementById('analyticsPeriod')?.value || 30);
    let history = Array.isArray(appData.analyticsHistory) ? appData.analyticsHistory.slice(-period) : [];
    if (history.length === 0) {
        const totalViews = appData.shorts.reduce((sum, item) => sum + getContentViews(item), 0) + appData.flyers.reduce((sum, item) => sum + getContentViews(item), 0);
        const totalLikes = appData.shorts.reduce((sum, item) => sum + getContentLikes(item), 0) + appData.flyers.reduce((sum, item) => sum + getContentLikes(item), 0);
        const totalShares = appData.shorts.reduce((sum, item) => sum + getContentShares(item), 0) + appData.flyers.reduce((sum, item) => sum + getContentShares(item), 0);
        history = buildSyntheticHistory(period, { views: totalViews, likes: totalLikes, shares: totalShares });
    }
    
    performanceChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: history.map(h => h.date),
            datasets: [
                {
                    label: 'Vues',
                    data: history.map(h => h.views),
                    backgroundColor: 'rgba(99, 102, 241, 0.7)',
                    borderColor: '#6366f1',
                    borderWidth: 1,
                    borderRadius: 6,
                    borderSkipped: false
                },
                {
                    label: 'Likes',
                    data: history.map(h => h.likes),
                    backgroundColor: 'rgba(16, 185, 129, 0.7)',
                    borderColor: '#10b981',
                    borderWidth: 1,
                    borderRadius: 6,
                    borderSkipped: false
                },
                {
                    label: 'Partages',
                    data: history.map(h => h.shares),
                    backgroundColor: 'rgba(245, 158, 11, 0.7)',
                    borderColor: '#f59e0b',
                    borderWidth: 1,
                    borderRadius: 6,
                    borderSkipped: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: { size: 11, family: "'Inter', sans-serif" },
                        boxWidth: 8,
                        boxHeight: 8
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.85)',
                    padding: 12,
                    cornerRadius: 8
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.04)' },
                    ticks: { font: { size: 11 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 10 }, maxRotation: 45 }
                }
            }
        }
    });
}

function initAnalyticsFollowersChart() {
    const ctx = document.getElementById('analyticsFollowersChart');
    if (!ctx) return;
    
    if (analyticsFollowersChart) analyticsFollowersChart.destroy();
    
    const labels = getLastTwelveMonthLabels();
    
    analyticsFollowersChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Total Followers',
                    data: [65000, 66200, 67800, 69000, 70800, 72500, 74200, 76200, 78500, 81000, 83500, 85500],
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#6366f1',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 7
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: { size: 11, family: "'Inter', sans-serif" },
                        boxWidth: 8,
                        boxHeight: 8
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.85)',
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            return 'Followers: ' + formatNumber(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: { color: 'rgba(0,0,0,0.04)' },
                    ticks: {
                        callback: function(value) { return formatNumber(value); },
                        font: { size: 11 }
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 11 } }
                }
            }
        }
    });
}

function displayShorts() {
    const container = document.getElementById('shortsList');
    if (!container) return;
    
    if (appData.shorts.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-video"></i><p>Aucun short vidéo pour le moment</p><button class="btn-primary" onclick="window.openShortModal()">Créer mon premier short</button></div>';
        return;
    }
    
    container.innerHTML = appData.shorts.map(short => `
        <div class="media-card" onclick="openPreview('short','${short.id}')">
            <div class="media-preview">
                <video src="${short.videoUrl}" preload="metadata" onclick="event.stopPropagation()"></video>
                <div class="media-overlay">
                    <button onclick="event.stopPropagation(); window.playVideo(this)"><i class="fas fa-play"></i> Lire</button>
                    <button onclick="event.stopPropagation(); window.shareContent('short', '${short.id}')"><i class="fas fa-share"></i></button>
                </div>
            </div>
            <div class="media-info">
                <div class="media-title">${escapeHtml(short.title)}</div>
                <div class="media-meta">
                    <span><i class="fas fa-eye"></i> ${formatNumber(short.views || 0)} vues</span>
                    <div class="media-stats">
                        <button onclick="event.stopPropagation(); window.likeContent('short', '${short.id}')">
                            <i class="fas fa-heart"></i> ${short.likes || 0}
                        </button>
                        <button onclick="event.stopPropagation(); window.shareContent('short', '${short.id}')">
                            <i class="fas fa-share"></i> ${short.shares || 0}
                        </button>
                        <button class="delete-btn" onclick="event.stopPropagation(); window.deleteContent('short', '${short.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                ${short.hashtags ? `<div style="margin-top: 8px; font-size: 12px; color: var(--primary);">${escapeHtml(Array.isArray(short.hashtags) ? short.hashtags.join(' ') : short.hashtags)}</div>` : ''}
                <div style="margin-top: 8px; font-size: 11px; color: var(--text-muted);">
                    <i class="fas fa-tag"></i> ${short.category}
                </div>
            </div>
        </div>
    `).join('');
}

function displayFlyers() {
    const container = document.getElementById('flyersList');
    if (!container) return;
    
    if (appData.flyers.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-images"></i><p>Aucun flyer disponible</p><button class="btn-primary" onclick="window.openFlyerModal()">Ajouter un flyer</button></div>';
        return;
    }
    
    container.innerHTML = appData.flyers.map(flyer => `
        <div class="media-card" onclick="openPreview('flyer','${flyer.id}')">
            <div class="media-preview">
                <img src="${flyer.imageUrl}" alt="${escapeHtml(flyer.title)}">
                <div class="media-overlay">
                    <button onclick="event.stopPropagation(); window.downloadFlyer('${flyer.id}')"><i class="fas fa-download"></i> Télécharger</button>
                </div>
            </div>
            <div class="media-info">
                <div class="media-title">${escapeHtml(flyer.title)}</div>
                <div class="media-meta">
                    <span><i class="fas fa-eye"></i> ${formatNumber(flyer.views || 0)} vues</span>
                    <div class="media-stats">
                        <button onclick="event.stopPropagation(); window.likeContent('flyer', '${flyer.id}')">
                            <i class="fas fa-heart"></i> ${flyer.likes || 0}
                        </button>
                        <button onclick="event.stopPropagation(); window.downloadFlyer('${flyer.id}')">
                            <i class="fas fa-download"></i> ${flyer.downloads || 0}
                        </button>
                        <button class="delete-btn" onclick="event.stopPropagation(); window.deleteContent('flyer', '${flyer.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                ${flyer.description ? `<div class="media-description">${escapeHtml(flyer.description)}</div>` : ''}
                <div style="margin-top: 8px; font-size: 11px; color: var(--text-muted);">
                    <i class="fas fa-tag"></i> ${flyer.category}
                </div>
            </div>
        </div>
    `).join('');
}

function displayFormations() {
    const container = document.getElementById('formationsList');
    if (!container) return;
    
    if (appData.formations.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-book-open"></i><p>Aucune formation ajoutée</p><button class="btn-primary" onclick="window.openFormationModal()">Ajouter une formation</button></div>';
        return;
    }
    
    container.innerHTML = appData.formations.map(formation => `
        <div class="formation-card">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                <h4 class="formation-title" style="margin:0;">${escapeHtml(formation.name)}</h4>
                <span style="background: var(--primary-gradient); color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">${formation.level || 'Licence'}</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px;">
                <p style="margin:0; font-size:13px;"><i class="fas fa-clock" style="color:var(--primary);width:20px;"></i> ${formation.duration || '3 ans'}</p>
                <p style="margin:0; font-size:13px;"><i class="fas fa-map-marker-alt" style="color:var(--primary);width:20px;"></i> ${escapeHtml(formation.location || 'Campus principal')}</p>
                <p style="margin:0; font-size:13px;"><i class="fas fa-language" style="color:var(--primary);width:20px;"></i> ${formation.language || 'Français'}</p>
                ${formation.fees ? `<p style="margin:0; font-size:13px;"><i class="fas fa-euro-sign" style="color:var(--primary);width:20px;"></i> ${formation.fees}</p>` : ''}
            </div>
            ${formation.mode ? `<p style="margin:0 0 12px 0; font-size:13px;"><i class="fas fa-video" style="color:var(--primary);width:20px;"></i> Mode: ${escapeHtml(formation.mode)}</p>` : ''}
            ${formation.category ? `<p style="margin:0 0 12px 0; font-size:13px;"><i class="fas fa-tag" style="color:var(--primary);width:20px;"></i> Domaine: ${escapeHtml(formation.category)}</p>` : ''}
            ${formation.certification ? `<p style="margin:0 0 12px 0; font-size:13px;"><i class="fas fa-certificate" style="color:var(--primary);width:20px;"></i> Certification: ${escapeHtml(formation.certification)}</p>` : ''}
            ${formation.alternance === 'Oui' ? '<span style="display:inline-block;background:rgba(16,185,129,0.1);color:var(--success);padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;margin-bottom:12px;"><i class="fas fa-briefcase"></i> Alternance possible</span>' : ''}
            <p style="font-size:14px;margin-bottom:12px;">${escapeHtml(formation.description)}</p>
            ${formation.prerequisites ? `<div class="prerequisites"><strong>Prérequis :</strong> ${escapeHtml(formation.prerequisites)}</div>` : ''}
            <div style="margin-top: 16px;">
                <button class="btn-secondary" onclick="window.deleteFormation('${formation.id}')" style="color:var(--danger);">
                    <i class="fas fa-trash"></i> Supprimer
                </button>
            </div>
        </div>
    `).join('');
}

function updateAnalytics() {
    // Check if this is recruitment analytics (has recruitment KPI elements)
    const recruitmentKpi = document.getElementById('candidatesTotalKpi');
    if (recruitmentKpi) {
        // This is a recruitment analytics dashboard
        updateRecruitmentAnalytics();
        return;
    }

    // Original social media analytics
    const periodSelect = document.getElementById('analyticsPeriod');
    const period = periodSelect ? parseInt(periodSelect.value) : 30;
    const now = Date.now();
    const periodMs = period * 24 * 60 * 60 * 1000;
    
    const getTimestamp = (item) => new Date(item.createdAt || item.date_creation || item.date_publication || item.created_at || now).getTime();
    const recentShorts = appData.shorts.filter(s => (now - getTimestamp(s)) < periodMs);
    const recentFlyers = appData.flyers.filter(f => (now - getTimestamp(f)) < periodMs);
    
    const shortsViews = recentShorts.reduce((s, c) => s + getContentViews(c), 0);
    const shortsLikes = recentShorts.reduce((s, c) => s + getContentLikes(c), 0);
    const shortsShares = recentShorts.reduce((s, c) => s + getContentShares(c), 0);
    const flyerViews = recentFlyers.reduce((s, c) => s + getContentViews(c), 0);
    
    const totalViews = shortsViews + flyerViews;
    const totalLikes = shortsLikes;
    const totalShares = shortsShares;
    
    const totalViewsKpi = document.getElementById('totalViewsKpi');
    if (totalViewsKpi) totalViewsKpi.textContent = formatNumber(totalViews);
    
    const totalLikesKpi = document.getElementById('totalLikesKpi');
    if (totalLikesKpi) totalLikesKpi.textContent = formatNumber(totalLikes);
    
    const totalSharesKpi = document.getElementById('totalSharesKpi');
    if (totalSharesKpi) totalSharesKpi.textContent = formatNumber(totalShares);
    
    const engagementRateKpi = document.getElementById('engagementRateKpi');
    if (engagementRateKpi) engagementRateKpi.textContent = totalViews > 0 ? Math.round((totalLikes / totalViews) * 100) + '%' : '0%';
    
    // Recharger les graphiques
    initPerformanceChart();
    initAnalyticsFollowersChart();
}

async function loadStoredActivities() {
    const token = getJWTToken();
    if (!token) return null;

    try {
        const activityContext = await resolveActivityOrganizationContext();
        const searchParams = new URLSearchParams();
        if (activityContext.organizationId) {
            searchParams.set('organization_id', activityContext.organizationId);
            searchParams.set('organization_type', activityContext.organizationType);
        }

        const endpoint = `${CONTENT_API}/activities${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
        const res = await fetch(endpoint, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (!res.ok) {
            console.warn('Unable to fetch stored activities:', res.status);
            return null;
        }

        const json = await res.json().catch(() => null);
        return Array.isArray(json?.data) ? json.data : json?.data || null;
    } catch (err) {
        console.warn('Error fetching stored activities:', err);
        return null;
    }
}

async function updateActivityFeed() {
    const container = document.getElementById('recentActivity');
    if (!container) return;

    const storedActivities = await loadStoredActivities();
    // Only render activities stored in backend. Do not fall back to local demo data.
    if (!Array.isArray(storedActivities) || storedActivities.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-clock"></i><p>Aucune activité récente</p></div>';
        return;
    }

    const activities = storedActivities
        .map((item) => ({
            icon: item.icon || 'fa-history',
            color: item.color || 'var(--primary)',
            title: item.title || item.description || 'Activité enregistrée',
            time: item.created_at ? new Date(item.created_at) : new Date(item.updated_at || Date.now())
        }))
        .sort((a, b) => b.time - a.time)
        .slice(0, 10);

    container.innerHTML = activities.map(act => `
        <div class="activity-item">
            <div class="activity-icon" style="background:${act.color}20; color:${act.color};">
                <i class="fas ${act.icon}"></i>
            </div>
            <div class="activity-content">
                <div class="activity-title">${escapeHtml(act.title)}</div>
                <div class="activity-time">${formatRelativeTime(act.time)}</div>
            </div>
        </div>
    `).join('');
}

// Helper Functions
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function formatRelativeTime(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'à l\'instant';
    if (minutes < 60) return `il y a ${minutes} minute${minutes > 1 ? 's' : ''}`;
    if (hours < 24) return `il y a ${hours} heure${hours > 1 ? 's' : ''}`;
    if (days < 7) return `il y a ${days} jour${days > 1 ? 's' : ''}`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function validatePhoneNumber(phone) {
    return /^[0-9+()\s-]+$/.test(phone);
}

function showToast(message, typeOrDuration = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    // Compatibility: if second arg is a number, treat it as duration
    let duration = 3000;
    let type = 'success';
    if (typeof typeOrDuration === 'number') {
        duration = typeOrDuration;
        type = 'info';
    } else {
        type = typeOrDuration || 'success';
    }

    const iconMap = {
        like: 'fa-heart',
        logo: 'fa-palette',
        short: 'fa-video',
        flyer: 'fa-image',
        formation: 'fa-graduation-cap',
        event: 'fa-calendar-check',
        testimonial: 'fa-star',
        comment: 'fa-comment',
        link: 'fa-link',
        light: 'fa-sun',
        dark: 'fa-moon',
        logout: 'fa-sign-out-alt',
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };

    // Déterminer l'icône selon le message ou le type
    let icon = iconMap[type] || 'fa-info-circle';
    const lower = (message || '').toLowerCase();
    if (lower.includes('like')) icon = iconMap.like;
    else if (lower.includes('logo')) icon = iconMap.logo;
    else if (lower.includes('short')) icon = iconMap.short;
    else if (lower.includes('flyer')) icon = iconMap.flyer;
    else if (lower.includes('formation')) icon = iconMap.formation;
    else if (lower.includes('événement') || lower.includes('evenement') || lower.includes('événement')) icon = iconMap.event;
    else if (lower.includes('témoign') || lower.includes('temoign')) icon = iconMap.testimonial;
    else if (lower.includes('comment')) icon = iconMap.comment;
    else if (lower.includes('lien') || lower.includes('copi')) icon = iconMap.link;
    else if (lower.includes('clair')) icon = iconMap.light;
    else if (lower.includes('sombre')) icon = iconMap.dark;
    else if (lower.includes('déconnexion') || lower.includes('deconnexion')) icon = iconMap.logout;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas ${icon}" style="margin-right: 12px;"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Content Actions
function likeContent(type, id) {
    let item;
    if (type === 'short') {
        item = appData.shorts.find(s => s.id === id);
    } else {
        item = appData.flyers.find(f => f.id === id);
    }
    if (item) {
        item.likes = (item.likes || 0) + 1;
        saveData();
        showToast('Merci pour votre like !', 'like');
    }
}

function shareContent(type, id) {
    const short = appData.shorts.find(s => s.id === id);
    if (short) {
        short.shares = (short.shares || 0) + 1;
        saveData();
        if (navigator.clipboard) {
            navigator.clipboard.writeText(window.location.href + '?share=' + id);
            showToast('Lien copié dans le presse-papier !');
        }
    }
}

function downloadFlyer(id) {
    const flyer = appData.flyers.find(f => f.id === id);
    if (flyer) {
        flyer.downloads = (flyer.downloads || 0) + 1;
        saveData();
        window.open(flyer.imageUrl, '_blank');
        showToast('Téléchargement démarré');
    }
}

function deleteContent(type, id) {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce contenu ?')) {
        if (type === 'short') {
            appData.shorts = appData.shorts.filter(s => s.id !== id);
        } else {
            appData.flyers = appData.flyers.filter(f => f.id !== id);
        }
        saveData();
        showToast('Contenu supprimé avec succès', 'error');
    }
}

async function deletePostFromApi(id) {
    const token = getJWTToken();
    if (!token) {
        throw new Error('Session expiree: reconnectez-vous pour supprimer ce contenu.');
    }

    const res = await fetch(`${CONTENT_API}/posts/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const text = payload ? '' : await res.text().catch(() => '');
        const apiMessage = payload?.error || payload?.message || text;

        if (res.status === 401) {
            throw new Error('Session expiree: reconnectez-vous pour supprimer ce contenu.');
        }
        if (res.status === 403) {
            throw new Error("Suppression refusee: vous ne pouvez supprimer que vos propres contenus.");
        }
        if (res.status === 404 || String(apiMessage || '').toLowerCase().includes('post not found')) {
            return { success: true, alreadyDeleted: true };
        }

        throw new Error(apiMessage || `Impossible de supprimer le contenu (${res.status}).`);
    }

    return res.json().catch(() => null);
}

async function refreshContentAfterDelete(type) {
    if (type === 'short' && typeof fetchAndDisplayShorts === 'function') {
        await fetchAndDisplayShorts();
    } else if (type === 'flyer' && typeof fetchAndDisplayFlyers === 'function') {
        await fetchAndDisplayFlyers();
    } else {
        updateAllDisplays();
    }
}

async function deleteContent(type, id) {
    if (!id) return;
    if (!confirm('Etes-vous sur de vouloir supprimer ce contenu ?')) return;

    try {
        await deletePostFromApi(id);

        if (type === 'short') {
            appData.shorts = appData.shorts.filter(s => String(s.id) !== String(id));
        } else {
            appData.flyers = appData.flyers.filter(f => String(f.id) !== String(id));
        }

        saveData();
        await refreshContentAfterDelete(type);
        showToast('Contenu supprime en base avec succes', 'error');
    } catch (error) {
        console.error('Erreur suppression contenu:', error);
        showToast(error.message || 'Impossible de supprimer ce contenu', 'error');
    }
}

function deleteFormation(id) {
    if (confirm('Supprimer cette formation ?')) {
        appData.formations = appData.formations.filter(f => f.id !== id);
        saveData();
        showToast('Formation supprimée', 'error');
    }
}

function deleteEvent(id) {
    if (confirm('Supprimer cet événement ?')) {
        appData.events = appData.events.filter(e => e.id !== id);
        saveData();
        showToast('Événement supprimé', 'error');
    }
}

function deleteTestimonial(id) {
    if (confirm('Supprimer ce témoignage ?')) {
        appData.testimonials = appData.testimonials.filter(t => t.id !== id);
        saveData();
        showToast('Témoignage supprimé', 'error');
    }
}

function playVideo(element) {
    const video = element.closest('.media-preview').querySelector('video');
    if (video) {
        if (video.paused) {
            video.play();
            element.innerHTML = '<i class="fas fa-pause"></i> Pause';
        } else {
            video.pause();
            element.innerHTML = '<i class="fas fa-play"></i> Lire';
        }
    }
}

// Navigation
function navigateTo(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById(`${page}Page`);
    if (targetPage) targetPage.classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const targetNav = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (targetNav) targetNav.classList.add('active');
    
    const titles = {
        dashboard: 'Tableau de bord',
        shorts: 'Shorts Vidéos',
        flyers: 'Flyers & Images',
        formations: 'Formations',
        events: 'Événements',
        testimonials: 'Témoignages',
        analytics: 'Analytiques',
        settings: 'Paramètres',
        templates: 'Templates',
        chat: 'Chat Support'
    };
    
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) pageTitle.textContent = titles[page] || 'Dashboard';
    
    const pageSubtitle = document.getElementById('pageSubtitle');
    if (pageSubtitle) {
        pageSubtitle.textContent = page === 'dashboard'
            ? 'Bienvenue dans votre espace de gestion'
            : page === 'chat'
                ? 'Discutez avec l\'administration Universearch'
                : `Gérez vos ${titles[page]?.toLowerCase() || 'contenus'}`;
    }
    
    // Recharger les graphiques si on va sur dashboard ou analytics
    if (page === 'dashboard') {
        setTimeout(initAllCharts, 200);
    } else if (page === 'analytics') {
        setTimeout(() => {
            updateAnalytics();
        }, 200);
    } else if (page === 'chat') {
        setTimeout(() => loadSupportConversation(), 10);
    }
    
    // Fermer le sidebar mobile
    const sidebar = document.getElementById('sidebar');
    if (sidebar && window.innerWidth <= 768) {
        sidebar.classList.remove('mobile-open');
    }
}

// Modal Functions
function openShortModal() {
    const modal = document.getElementById('shortModal');
    if (modal) modal.classList.add('active');
}

function openFlyerModal() {
    const modal = document.getElementById('flyerModal');
    if (modal) modal.classList.add('active');
}

function openFormationModal() {
    const context = getCurrentOrganizationContext();
    
    if (context.kind === 'centre') {
        // Pour les centres de formation: ouvrir le modal de formation professionnelle
        populateProfessionalFormationDropdown();
        const modal = document.getElementById('professionalFormationModal');
        if (modal) modal.classList.add('active');
    } else {
        // Pour les universités: ouvrir le modal existant
        populateFormationDropdown();
        updateFormationLevelDetail();
        const modal = document.getElementById('formationModal');
        if (modal) modal.classList.add('active');
    }
}

function updateFormationLevelDetail() {
    const mainLevel = document.getElementById('formationLevel');
    const detailLevel = document.getElementById('formationLevelDetail');
    const feesByYear = document.getElementById('formationFeesByYear');
    const licenseFees = document.getElementById('licenseFees');
    const masterFees = document.getElementById('masterFees');
    
    if (!mainLevel || !detailLevel) return;

    const level = mainLevel.value;
    if (level === 'Licence') {
        detailLevel.value = 'Licence 1';
        if (feesByYear) feesByYear.style.display = 'block';
        if (licenseFees) licenseFees.style.display = 'flex';
        if (masterFees) masterFees.style.display = 'none';
    } else if (level === 'Master') {
        detailLevel.value = 'Master 1';
        if (feesByYear) feesByYear.style.display = 'block';
        if (licenseFees) licenseFees.style.display = 'none';
        if (masterFees) masterFees.style.display = 'flex';
    } else {
        detailLevel.value = '';
        if (feesByYear) feesByYear.style.display = 'none';
    }
}

function openEventModal() {
    const modal = document.getElementById('eventModal');
    if (modal) modal.classList.add('active');
}

function openTestimonialModal() {
    const modal = document.getElementById('testimonialModal');
    if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
}

const TEMPLATE_LIBRARY = [
    {
        id: 'short1',
        title: 'Decouverte Campus',
        icon: 'fa-building',
        type: 'short',
        category: 'campus',
        desc: 'Presentez votre campus',
        description: 'Une visite immersive de notre campus, de ses espaces de vie et de ses infrastructures.',
        hashtags: '#campus #universite #decouverte'
    },
    {
        id: 'short2',
        title: 'Temoignage Etudiant',
        icon: 'fa-user-graduate',
        type: 'short',
        category: 'temoignage',
        desc: 'Partagez une reussite',
        description: 'Le temoignage d un etudiant sur son parcours, son experience et ses projets.',
        hashtags: '#temoignage #reussite #alumni'
    },
    {
        id: 'short3',
        title: 'Journee Portes Ouvertes',
        icon: 'fa-calendar-alt',
        type: 'short',
        category: 'evenement',
        desc: 'Annoncez vos evenements',
        description: 'Annonce video pour inviter les futurs etudiants a decouvrir nos formations.',
        hashtags: '#portesouvertes #orientation #avenir'
    },
    {
        id: 'flyer1',
        title: 'Admission 2025 - Rejoignez-nous !',
        icon: 'fa-graduation-cap',
        type: 'flyer',
        category: 'admission',
        desc: 'Campagne d admission',
        description: 'Informations essentielles sur les admissions, les dates importantes et les modalites.'
    },
    {
        id: 'flyer2',
        title: 'Forum des Metiers - Rencontrez votre avenir',
        icon: 'fa-briefcase',
        type: 'flyer',
        category: 'evenement',
        desc: 'Evenement professionnel',
        description: 'Rencontres avec des professionnels, ateliers metiers et opportunites de networking.'
    }
];

// Template Functions
function openTemplateSelector(filterType = null) {
    const modal = document.getElementById('templateSelectorModal');
    if (!modal) return;
    
    const body = document.getElementById('templateSelectorBody');
    if (!body) return;
    
    const templates = [
        { id: 'short1', title: 'Découverte Campus', icon: 'fa-building', type: 'short', desc: 'Présentez votre campus' },
        { id: 'short2', title: 'Témoignage Étudiant', icon: 'fa-user-graduate', type: 'short', desc: 'Partagez une réussite' },
        { id: 'short3', title: 'Journée Portes Ouvertes', icon: 'fa-calendar-alt', type: 'short', desc: 'Annoncez vos événements' },
        { id: 'flyer1', title: 'Admission 2025', icon: 'fa-graduation-cap', type: 'flyer', desc: 'Campagne d\'admission' },
        { id: 'flyer2', title: 'Forum des Métiers', icon: 'fa-briefcase', type: 'flyer', desc: 'Événement professionnel' }
    ];
    
    const filtered = filterType ? TEMPLATE_LIBRARY.filter(t => t.type === filterType) : TEMPLATE_LIBRARY;
    
    body.innerHTML = filtered.map(t => `
        <div class="template-option" onclick="window.applyTemplate('${t.type}', '${t.id}')">
            <div class="template-option-preview">
                <i class="fas ${t.icon}"></i>
            </div>
            <div style="flex:1;">
                <h4 style="margin-bottom:4px;">${t.title}</h4>
                <p style="color: var(--text-muted); font-size: 13px; margin:0;">${t.desc}</p>
            </div>
            <i class="fas fa-chevron-right" style="color:var(--text-muted);"></i>
        </div>
    `).join('');
    
    modal.classList.add('active');
}

function applyTemplate(type, templateId) {
    const templates = {
        short1: { title: 'Découverte Campus', hashtags: '#campus #universite #decouverte' },
        short2: { title: 'Témoignage Étudiant', hashtags: '#temoignage #reussite #alumni' },
        short3: { title: 'Journée Portes Ouvertes', hashtags: '#portesouvertes #orientation #avenir' },
        flyer1: { title: 'Admission 2025 - Rejoignez-nous !' },
        flyer2: { title: 'Forum des Métiers - Rencontrez votre avenir' }
    };
    
    const template = TEMPLATE_LIBRARY.find((item) => item.id === templateId) || templates[templateId];
    if (template) {
        closeModal('templateSelectorModal');
        
        if (type === 'short') {
            openShortModal();
            setTimeout(() => {
                const titleInput = document.getElementById('shortTitle');
                const categoryInput = document.getElementById('shortCategory');
                const descriptionInput = document.getElementById('shortDescription');
                const hashtagsInput = document.getElementById('shortHashtags');
                if (titleInput) titleInput.value = template.title;
                if (categoryInput && template.category) categoryInput.value = template.category;
                if (descriptionInput && template.description) descriptionInput.value = template.description;
                if (hashtagsInput && template.hashtags) hashtagsInput.value = template.hashtags;
            }, 300);
        } else if (type === 'flyer') {
            openFlyerModal();
            setTimeout(() => {
                const titleInput = document.getElementById('flyerTitle');
                const categoryInput = document.getElementById('flyerCategory');
                const descriptionInput = document.getElementById('flyerDescription');
                if (titleInput) titleInput.value = template.title;
                if (categoryInput && template.category) categoryInput.value = template.category;
                if (descriptionInput && template.description) descriptionInput.value = template.description;
            }, 300);
        }
        showToast(`Template "${template.title}" chargé avec succès !`);
    }
}

function displayTemplates(type) {
    const container = document.getElementById('templatesGallery');
    if (!container) return;
    
    const shortTemplates = [
        { id: 'short1', title: 'Découverte Campus', icon: 'fa-building', type: 'short' },
        { id: 'short2', title: 'Témoignage Étudiant', icon: 'fa-user-graduate', type: 'short' },
        { id: 'short3', title: 'Journée Portes Ouvertes', icon: 'fa-calendar-alt', type: 'short' }
    ];
    
    const flyerTemplates = [
        { id: 'flyer1', title: 'Admission 2025', icon: 'fa-graduation-cap', type: 'flyer' },
        { id: 'flyer2', title: 'Forum des Métiers', icon: 'fa-briefcase', type: 'flyer' }
    ];
    
    let templates = TEMPLATE_LIBRARY.filter((template) => type === 'all' || template.type === type);
    
    container.innerHTML = templates.map(t => `
        <div class="template-card" onclick="window.applyTemplate('${t.type}', '${t.id}')">
            <div class="template-preview">
                <i class="fas ${t.icon}"></i>
            </div>
            <div class="template-info">
                <h4 class="template-title">${t.title}</h4>
                <span style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:12px;">Template ${t.type === 'short' ? 'Short' : 'Flyer'}</span>
                <button class="btn-primary" style="width:100%;justify-content:center;">Utiliser</button>
            </div>
        </div>
    `).join('');
}

// Chat Functions
const supportConversations = {
    admin: {
        name: 'Administration Universearch',
        subtitle: 'Support pour universités et centres',
        icon: 'fa-headset',
        unread: 0,
        time: 'Maintenant',
        messages: []
    }
};

let activeSupportConversationId = null;
let supportConversationId = null;
let supportConversationLoaded = false;

async function getOrCreateSupportConversation() {
    const token = getJWTToken();
    if (!token) {
        showToast('Vous devez être connecté pour utiliser le chat de support.', 'error');
        return null;
    }

    const result = await safeFetch(`${MESSAGING_SERVICE_URL}/conversations?limit=50&offset=0`, {
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    if (!result.ok) {
        console.error('Erreur getConversations:', result.error);
        return null;
    }

    const data = result.data;
    const conversations = Array.isArray(data?.data) ? data.data : [];
    const organization = getCurrentOrganizationContext();
    const institutionId = organization.organizationId;

    let conversation = conversations.find(conv => conv.institution_id === institutionId);
    if (!conversation) {
        const name = `Support Universearch - ${organization.kind === 'centre' ? 'Centre' : 'Université'}`;
        const description = 'Conversation de support entre l\'institution et l\'administration Universearch.';
        
        const createResult = await safeFetch(`${MESSAGING_SERVICE_URL}/conversations`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, description })
        });

        if (!createResult.ok) {
            console.error('Erreur createConversation:', createResult.error);
            showToast('Impossible de créer la conversation de support.', 'error');
            return null;
        }

        const created = createResult.data;
        conversation = created?.data || null;
    }

    return conversation;
}

async function loadSupportConversation() {
    if (supportConversationLoaded) return;

    const conversation = await getOrCreateSupportConversation();
    if (!conversation) {
        console.warn('Impossible de charger ou créer la conversation de support');
        return;
    }

    supportConversationId = conversation.id;
    supportConversations.admin.name = conversation.name || supportConversations.admin.name;
    supportConversations.admin.time = 'Maintenant';
    activeSupportConversationId = 'admin';

    const token = getJWTToken();
    const response = await safeFetch(`${MESSAGING_SERVICE_URL}/conversations/${supportConversationId}/messages?limit=100&offset=0`, {
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    if (response.ok) {
        const result = response.data;
        const messages = Array.isArray(result?.data) ? result.data : [];
        supportConversations.admin.messages = messages.map(msg => ({
            text: msg.text || '',
            sent: msg.sender_type !== 'admin',
            time: msg.created_at ? new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''
        }));
        supportConversationLoaded = true;
        updateChatUI();
        // Update counters after loading messages
        updateSupportMessageCounts();
        if (activeSupportConversationId) selectConversation(activeSupportConversationId);
    } else {
        console.error('Erreur loadSupportConversation messages:', response.error);
    }
}

async function sendSupportChatMessage(messageText) {
    if (!supportConversationId) {
        await loadSupportConversation();
        if (!supportConversationId) return;
    }

    const token = getJWTToken();
    if (!token) {
        showToast('Vous devez être connecté pour envoyer un message.', 'error');
        return;
    }

    const response = await safeFetch(`${MESSAGING_SERVICE_URL}/messages`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            conversation_id: supportConversationId,
            text: messageText
        })
    });

    if (!response.ok) {
        console.error('Erreur sendSupportChatMessage:', response.error);
        showToast('Impossible d\'envoyer le message.', 'error');
        return;
    }

    const result = response.data;
    const createdMessage = result?.data;
    if (createdMessage) {
        const time = createdMessage.created_at ? new Date(createdMessage.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
        supportConversations.admin.messages.push({ text: createdMessage.text || messageText, sent: true, time });
        // Update counters after sending
        updateSupportMessageCounts();
        if (activeSupportConversationId) selectConversation(activeSupportConversationId);
        updateChatUI();
        showToast('Message envoyé à l\'admin !');

        // Real-time notification is handled by the server-side emission; no client emit here to avoid duplicates.
    }
}

function updateChatUI() {
    const conversationsList = document.getElementById('conversationsList');
    if (!conversationsList) return;
    
    const conversations = Object.entries(supportConversations).map(([id, conv]) => {
        const lastMessage = conv.messages[conv.messages.length - 1]?.text || 'Aucun message pour le moment';
        return { id, ...conv, lastMessage };
    });
    
    conversationsList.innerHTML = conversations.map(conv => `
        <div class="conversation-item ${activeSupportConversationId === conv.id ? 'active' : ''}" onclick="window.selectConversation('${conv.id}')">
            <div class="conversation-avatar"><i class="fas ${conv.icon || 'fa-headset'}"></i></div>
            <div class="conversation-info">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div class="conversation-name">${conv.name}</div>
                    <div class="conversation-time">${conv.time}</div>
                </div>
                <div class="conversation-last-msg">${conv.lastMessage}</div>
            </div>
            ${conv.unread > 0 ? '<span class="conversation-unread">' + conv.unread + '</span>' : ''}
        </div>
    `).join('');
    
    document.getElementById('chatUnreadCount') && (document.getElementById('chatUnreadCount').textContent = conversations.reduce((s, c) => s + c.unread, 0));
    document.getElementById('headerChatBadge') && (document.getElementById('headerChatBadge').textContent = conversations.reduce((s, c) => s + c.unread, 0));

    if (!activeSupportConversationId && supportConversations.admin) {
        selectConversation('admin');
    }
}

function selectConversation(convId) {
    const conv = supportConversations[convId];
    if (!conv) return;
    activeSupportConversationId = convId;
    
    const chatActiveName = document.getElementById('chatActiveName');
    if (chatActiveName) chatActiveName.textContent = conv.name;
    
    const chatMessages = document.getElementById('chatMessages');
    const chatInputArea = document.getElementById('chatInputArea');
    
    if (chatMessages) {
        chatMessages.innerHTML = conv.messages.map(msg => `
            <div class="message ${msg.sent ? 'sent' : 'received'}">
                <div class="message-bubble">${escapeHtml(msg.text)}</div>
            </div>
            <div style="font-size:10px;color:var(--text-muted);text-align:${msg.sent ? 'right' : 'left'};margin-top:2px;">${msg.time}</div>
        `).join('');
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    if (chatInputArea) {
        chatInputArea.style.display = 'block';
    }
    
    // Mettre en évidence la conversation active
    document.querySelectorAll('.conversation-item').forEach(item => item.classList.remove('active'));
    const activeItem = document.querySelector(`.conversation-item[onclick*="${convId}"]`);
    if (activeItem) activeItem.classList.add('active');
    // Ensure counters reflect current messages
    try { updateSupportMessageCounts(); } catch (e) { /* ignore */ }
}

// Update message counters/badges for support chat
function updateSupportMessageCounts() {
    try {
        const conv = supportConversations.admin;
        if (!conv) return;
        const count = Array.isArray(conv.messages) ? conv.messages.length : 0;
        const counterEl = document.getElementById('chatUnreadCount');
        if (counterEl) counterEl.textContent = String(count);
        const headerBadge = document.getElementById('headerChatBadge');
        if (headerBadge) headerBadge.textContent = String(count);
        const statMessages = document.getElementById('statMessages');
        if (statMessages) statMessages.textContent = formatNumber(count);
    } catch (e) {
        console.warn('updateSupportMessageCounts failed', e);
    }
}

// Theme Toggle
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const themeToggle = document.getElementById('themeToggle');
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        if (themeToggle) themeToggle.innerHTML = '<i class="fas fa-sun"></i><span>Mode clair</span>';
    }
}

function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const themeToggle = document.getElementById('themeToggle');
    if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        if (themeToggle) themeToggle.innerHTML = '<i class="fas fa-moon"></i><span>Mode sombre</span>';
        showToast('Mode clair activé', 'light');
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        if (themeToggle) themeToggle.innerHTML = '<i class="fas fa-sun"></i><span>Mode clair</span>';
        showToast('Mode sombre activé', 'dark');
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initTheme();
    
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.getAttribute('data-page');
            if (page) navigateTo(page);
        });
    });
    
    // Navigation groups
    document.querySelectorAll('.nav-group-header').forEach(header => {
        header.addEventListener('click', () => {
            const group = header.parentElement;
            group.classList.toggle('collapsed');
        });
    });
    
    // Menu toggle for mobile
    const menuToggle = document.getElementById('menuToggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.toggle('mobile-open');
        });
    }
    
    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

    const formationLevel = document.getElementById('formationLevel');
    if (formationLevel) {
        formationLevel.addEventListener('change', updateFormationLevelDetail);
    }
    
    // Settings form
    const settingsForm = document.getElementById('settingsForm');
    if (settingsForm) {
        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const uniName = document.getElementById('uniName');
            const uniCity = document.getElementById('uniCity');
            const uniSigle = document.getElementById('uniSigle');
            const uniDescription = document.getElementById('uniDescription');
            const uniEmail = document.getElementById('uniEmail');
            const uniPhone = document.getElementById('uniPhone');
            const uniWebsite = document.getElementById('uniWebsite');
            const primaryColor = document.getElementById('primaryColor');
            const submitBtn = settingsForm.querySelector('button[type="submit"]');
            const phoneValue = uniPhone ? uniPhone.value.trim() : '';
            
            if (phoneValue && !validatePhoneNumber(phoneValue)) {
                showToast('Numéro de téléphone invalide. Utilisez uniquement chiffres, +, espaces, tirets et parenthèses.', 'error');
                return;
            }
            
            if (uniName) appData.university.name = uniName.value;
            if (uniSigle) appData.university.sigle = uniSigle.value;
            if (uniCity) appData.university.city = uniCity.value;
            if (uniDescription) appData.university.description = uniDescription.value;
            if (uniEmail) appData.university.email = uniEmail.value;
            if (uniPhone) appData.university.phone = uniPhone.value;
            if (uniWebsite) appData.university.website = uniWebsite.value;
            if (primaryColor) appData.university.primaryColor = primaryColor.value;
            
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sauvegarde...';
            }

            try {
                await saveUniversityProfileToApi();
                saveData();
                showToast('Informations de l universite mises a jour !');
            } catch (error) {
                console.error('Error saving university profile:', error);
                saveData();
                showToast('Sauvegarde locale uniquement: ' + (error.message || 'API indisponible'), 'error');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fas fa-save"></i> Sauvegarder les modifications';
                }
            }
        });
    }
    
    // Description character count
    const uniDescription = document.getElementById('uniDescription');
    if (uniDescription) {
        uniDescription.addEventListener('input', (e) => {
            const descCount = document.getElementById('descCount');
            if (descCount) descCount.textContent = `${e.target.value.length}/2000`;
        });
    }

    const uniPhoneInput = document.getElementById('uniPhone');
    if (uniPhoneInput) {
        uniPhoneInput.addEventListener('input', (e) => {
            const cleaned = e.target.value.replace(/[^0-9+()\s-]/g, '');
            if (cleaned !== e.target.value) {
                e.target.value = cleaned;
            }
        });
    }
    
    // Logo upload
    const logoInput = document.getElementById('logoInput');
    if (logoInput) {
        logoInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    appData.university.logo = event.target.result;
                    saveData();
                    showToast('Logo mis à jour !', 'logo');
                };
                reader.readAsDataURL(e.target.files[0]);
            }
        });
    }
    
    // Short form
    const shortForm = document.getElementById('shortForm');
    if (shortForm) {
        shortForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const shortTitle = document.getElementById('shortTitle');
            const shortCategory = document.getElementById('shortCategory');
            const shortDescription = document.getElementById('shortDescription');
            const shortHashtags = document.getElementById('shortHashtags');
            const shortVideo = document.getElementById('shortVideo');
            
            if (shortVideo && shortVideo.files && shortVideo.files[0]) {
                const file = shortVideo.files[0];
                const title = shortTitle ? shortTitle.value.trim() : '';
                const description = shortDescription ? shortDescription.value.trim() : '';
                const category = shortCategory ? shortCategory.value : 'campus';
                const hashtagsValue = shortHashtags ? shortHashtags.value.trim() : '';
                const hashtagsArray = hashtagsValue
                    ? hashtagsValue.split(/\s+/).filter(Boolean)
                    : null;
                const submitBtn = shortForm.querySelector('button[type="submit"]');

                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Publication en cours...';
                }

                try {
                    const token = getJWTToken();
                    if (!token) {
                        showToast('Session expiree: reconnectez-vous pour publier', 'error');
                        return;
                    }

                    const uploadBody = new FormData();
                    uploadBody.append('file', file);

                    const uploadRes = await fetch(`${CONTENT_API}/uploads`, {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${token}`
                        },
                        body: uploadBody
                    });

                    if (!uploadRes.ok) {
                        const errorText = await uploadRes.text().catch(() => '');
                        console.warn('Upload video error:', uploadRes.status, errorText);
                        showToast('Erreur upload video: ' + uploadRes.status, 'error');
                        return;
                    }

                    const uploadJson = await uploadRes.json().catch(() => null);
                    const mediaUrl =
                        uploadJson?.videoUrl ||
                        uploadJson?.url ||
                        uploadJson?.rawUrl ||
                        uploadJson?.data?.videoUrl ||
                        uploadJson?.data?.url ||
                        null;

                    if (!mediaUrl) {
                        throw new Error('URL video absente apres upload');
                    }

                    const context = getCurrentOrganizationContext();
                    const payload = {
                        titre: title,
                        description: description,
                        category: category,
                        hashtags: hashtagsArray,
                        media_url: mediaUrl,
                        thumbnail_url: uploadJson?.thumbnailUrl || uploadJson?.data?.thumbnailUrl || null,
                        media_type: 'video',
                        media_processing_status: uploadJson?.status === 'processing' ? 'processing' : 'completed',
                        entity_id: context.contentAuthorId,
                        entity_type: context.entityType,
                        organization_id: context.contentAuthorId,
                        organization_type: context.entityType
                    };

                    const res = await fetch(`${CONTENT_API}/posts`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`
                        },
                        body: JSON.stringify(payload)
                    });

                    if (!res.ok) {
                        const errorText = await res.text().catch(() => '');
                        console.warn('Create video post error:', res.status, errorText);
                        showToast('Erreur creation post video: ' + res.status, 'error');
                        return;
                    }

                    const json = await res.json().catch(() => null);
                    const postData = json?.data || json || {};
                    const short = {
                        ...postData,
                        id: postData.id || 's_' + Date.now(),
                        title: postData.titre || title,
                        titre: postData.titre || title,
                        description: postData.description || description,
                        category: postData.category || category,
                        videoUrl: postData.media_url || mediaUrl,
                        media_url: postData.media_url || mediaUrl,
                        thumbnail_url: postData.thumbnail_url || payload.thumbnail_url,
                        media_type: 'video',
                        hashtags: postData.hashtags || hashtagsArray,
                        views: postData.views_count ?? 0,
                        likes: postData.likes_count ?? 0,
                        shares: postData.shares_count ?? 0,
                        createdAt: postData.date_creation || new Date().toISOString()
                    };

                    appData.shorts.unshift(short);
                    saveData();
                    closeModal('shortModal');
                    if (shortForm) shortForm.reset();
                    showToast('Short publie avec succes !');
                    createActivityRecord(
                        `Short publié : ${title}`,
                        description || `Short publié dans le tableau de bord`,
                        'active',
                        true
                    );
                } catch (err) {
                    console.error('Error creating video post:', err);
                    showToast('Erreur: ' + (err.message || 'Impossible de publier le short'), 'error');
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Publier';
                    }
                }

                return;
                const objectUrl = URL.createObjectURL(file);
                const reader = new FileReader();

                reader.onload = async (ev) => {
                    try {
                        const mediaUrl = ev.target.result;
                        const token = getJWTToken();
                        const payload = {
                            titre: title,
                            description: description,
                            category: category,
                            media_url: mediaUrl,
                            media_type: 'video',
                            hashtags: hashtagsArray
                        };

                        const res = await fetch(`${CONTENT_API}/posts`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                ...(token ? { Authorization: `Bearer ${token}` } : {})
                            },
                            body: JSON.stringify(payload)
                        });

                        if (!res.ok) {
                            const errorText = await res.text();
                            console.warn('API Error:', res.status, errorText);
                            showToast('Erreur API: ' + res.status, 'error');
                            return;
                        }

                        const json = await res.json().catch(() => null);
                        const postData = json?.data || json;
                        const short = {
                            id: postData?.id || 's_' + Date.now(),
                            title: title,
                            description: description,
                            category: category,
                            videoUrl: objectUrl,
                            media_type: 'video',
                            hashtags: hashtagsArray,
                            views: 0,
                            likes: 0,
                            shares: 0,
                            createdAt: postData?.date_creation || new Date().toISOString()
                        };

                        appData.shorts.unshift(short);
                        saveData();
                        closeModal('shortModal');
                        if (shortForm) shortForm.reset();
                        showToast('Short publié avec succès !', 'short');
                    } catch (err) {
                        console.error('Error publishing short:', err);
                        showToast('Erreur: ' + (err.message || 'Impossible de publier le short'), 'error');
                    }
                };

                reader.onerror = () => {
                    showToast('Erreur de lecture de la vidéo', 'error');
                };

                reader.readAsDataURL(file);
            } else {
                showToast('Veuillez sélectionner une vidéo', 'error');
            }
        });
    }
    
    // Flyer form - avec intégration API
    const flyerForm = document.getElementById('flyerForm');
    if (flyerForm) {
        flyerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const flyerTitle = document.getElementById('flyerTitle');
            const flyerCategory = document.getElementById('flyerCategory');
            const flyerDescription = document.getElementById('flyerDescription');
            const flyerImage = document.getElementById('flyerImage');
            const submitBtn = flyerForm.querySelector('button[type="submit"]');
            
            if (!flyerImage || !flyerImage.files || !flyerImage.files[0]) {
                showToast('Veuillez sélectionner une image', 'error');
                return;
            }
            
            const title = flyerTitle ? flyerTitle.value.trim() : '';
            const desc = flyerDescription ? flyerDescription.value.trim() : '';
            if (!title) {
                showToast('Veuillez entrer un titre', 'error');
                return;
            }
            
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Publication en cours...';
            }

            try {
                const file = flyerImage.files[0];
                const token = getJWTToken();
                if (!token) {
                    showToast('Session expirÃ©e: reconnectez-vous pour publier', 'error');
                    return;
                }

                const uploadBody = new FormData();
                uploadBody.append('file', file);

                const uploadRes = await fetch(`${CONTENT_API}/uploads`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`
                    },
                    body: uploadBody
                });

                if (!uploadRes.ok) {
                    const errorText = await uploadRes.text().catch(() => '');
                    console.warn('Upload image error:', uploadRes.status, errorText);
                    showToast('Erreur upload image: ' + uploadRes.status, 'error');
                    return;
                }

                const uploadJson = await uploadRes.json().catch(() => null);
                const mediaUrl = uploadJson?.url || uploadJson?.data?.url || uploadJson?.publicUrl || null;
                if (!mediaUrl) {
                    throw new Error('URL image absente apres upload');
                }

                const context = getCurrentOrganizationContext();
                const payload = {
                    titre: title,
                    description: desc,
                    category: flyerCategory ? flyerCategory.value : 'all',
                    media_url: mediaUrl,
                    media_type: 'image',
                    entity_id: context.contentAuthorId,
                    entity_type: context.entityType,
                    organization_id: context.contentAuthorId,
                    organization_type: context.entityType
                };

                const res = await fetch(`${CONTENT_API}/posts`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) {
                    const errorText = await res.text().catch(() => '');
                    console.warn('Create image post error:', res.status, errorText);
                    showToast('Erreur creation post: ' + res.status, 'error');
                    return;
                }

                const json = await res.json().catch(() => null);
                const postData = json?.data || json || {};

                closeModal('flyerModal');
                if (flyerForm) flyerForm.reset();
                showToast('Flyer publié avec succès !', 'flyer');
                createActivityRecord(
                    `Flyer ajouté : ${title}`,
                    desc || `Flyer ajouté sur le tableau de bord`,
                    'active',
                    true
                );
                if (typeof fetchAndDisplayFlyers === 'function') {
                    await fetchAndDisplayFlyers();
                }
            } catch (err) {
                console.error('Error creating image post:', err);
                showToast('Erreur: ' + (err.message || 'Impossible de publier'), 'error');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Publier';
                }
            }
        });
    }
    
    // Formation form
    const formationForm = document.getElementById('formationForm');
    if (formationForm) {
        formationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const alternanceRadio = document.querySelector('input[name="formationAlternance"]:checked');
            const formationName = document.getElementById('formationName').value.trim();
            const selectedFiliere = findAvailableFiliereByName(formationName);
            const submitBtn = formationForm.querySelector('button[type="submit"]');
            if (!selectedFiliere) {
                showToast('Choisissez une filiere existante dans la liste avant de l ajouter', 'error');
                return;
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Ajout en cours...';
            }

            const levelValue = document.getElementById('formationLevel').value;
            const feesValue = document.getElementById('formationFees')?.value || '';
            const feesL1 = document.getElementById('formationFeesL1')?.value || '';
            const feesL2 = document.getElementById('formationFeesL2')?.value || '';
            const feesL3 = document.getElementById('formationFeesL3')?.value || '';
            const feesM1 = document.getElementById('formationFeesM1')?.value || '';
            const feesM2 = document.getElementById('formationFeesM2')?.value || '';
            const feesM3 = document.getElementById('formationFeesM3')?.value || '';

            const formation = {
                id: selectedFiliere.id,
                name: formationName,
                level: levelValue,
                duration: document.getElementById('formationDuration').value,
                location: document.getElementById('formationLocation').value,
                language: document.getElementById('formationLanguage').value,
                description: document.getElementById('formationDescription').value,
                prerequisites: document.getElementById('formationPrerequisites').value,
                fees: feesValue,
                feesL1,
                feesL2,
                feesL3,
                feesM1,
                feesM2,
                feesM3,
                alternance: alternanceRadio ? alternanceRadio.value : 'Non',
                createdAt: new Date().toISOString()
            };
            const formationDetails = {
                nom_affiche: formationName,
                niveau: levelValue,
                niveau_detail: document.getElementById('formationLevelDetail')?.value || null,
                duree: document.getElementById('formationDuration').value,
                lieu: document.getElementById('formationLocation').value,
                langue: document.getElementById('formationLanguage').value,
                frais_inscription: feesValue,
                frais_l1: feesL1,
                frais_l2: feesL2,
                frais_l3: feesL3,
                frais_m1: feesM1,
                frais_m2: feesM2,
                frais_m3: feesM3,
                description: document.getElementById('formationDescription').value,
                prerequis: document.getElementById('formationPrerequisites').value,
                alternance: alternanceRadio ? alternanceRadio.value === 'Oui' : false
            };

            try {
                await attachFiliereToCurrentOrganization(selectedFiliere.id, formationDetails);
                const alreadyExists = appData.formations.some((item) => String(item.id) === String(selectedFiliere.id));
                if (!alreadyExists) {
                    appData.formations.push(formation);
                }
                saveData();
                await loadFormationsFromApi();
                closeModal('formationModal');
                formationForm.reset();
                showToast(getCurrentOrganizationContext().kind === 'centre'
                    ? 'Formation ajoutee a votre centre !'
                    : 'Filiere ajoutee a votre universite !');
                createActivityRecord(
                    `Formation ajoutée : ${formationName}`,
                    `Nouvelle formation ajoutée : ${formationName}`
                );
            } catch (error) {
                console.error('Error attaching filiere:', error);
                showToast('Erreur: ' + (error.message || 'Impossible d ajouter la filiere'), 'error');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Ajouter';
                }
            }

            return;
            appData.formations.push(formation);
            saveData();
            closeModal('formationModal');
            formationForm.reset();
            showToast('Formation ajoutée avec succès !', 'formation');
        });
    }
    
    // Professional Formation form (for centres)
    const professionalFormationForm = document.getElementById('professionalFormationForm');
    if (professionalFormationForm) {
        professionalFormationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const alternanceRadio = document.querySelector('input[name="proFormationAlternance"]:checked');
            const formationName = document.getElementById('proFormationName')?.value.trim();
            
            if (!formationName) {
                showToast('Entrez un nom de formation', 'error');
                return;
            }

            const submitBtn = professionalFormationForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Ajout en cours...';
            }

            const selectedProfessionalFormation = availableProfessionalFormations.find((item) =>
                String(item.name || '').trim().toLowerCase() === formationName.toLowerCase()
            );

            const professionalFormation = {
                nom_formation: formationName,
                filiere_id: selectedProfessionalFormation ? selectedProfessionalFormation.id : undefined,
                categorie_domaine: document.getElementById('proFormationCategory')?.value || '',
                type_certification: document.getElementById('proFormationCertification')?.value || '',
                duree: document.getElementById('proFormationDuration')?.value || '',
                cout_formation: document.getElementById('proFormationCost')?.value || '',
                lieu: document.getElementById('proFormationLocation')?.value || '',
                mode_formation: document.getElementById('proFormationMode')?.value || '',
                langue: document.getElementById('proFormationLanguage')?.value || 'Français',
                description: document.getElementById('proFormationDescription')?.value || '',
                prerequis: document.getElementById('proFormationPrerequisites')?.value || '',
                stage_alternance: alternanceRadio ? alternanceRadio.value === 'Oui' : false,
                createdAt: new Date().toISOString()
            };

            try {
                // Send to API endpoint for centre professional formations
                await attachProfessionalFormationToMyCentre([professionalFormation]);
                
                closeModal('professionalFormationModal');
                professionalFormationForm.reset();
                showToast('Formation professionnelle ajoutée à votre centre !');
                
                // Reload formations from API
                await loadFormationsFromApi();
                
                createActivityRecord(
                    `Formation professionnelle ajoutée : ${formationName}`,
                    `Nouvelle formation professionnelle ajoutée : ${formationName}`
                );
            } catch (error) {
                console.error('Error adding professional formation:', error);
                showToast('Erreur: ' + (error.message || 'Impossible d ajouter la formation'), 'error');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Ajouter';
                }
            }
        });
    }
    
    // Event form
    const eventForm = document.getElementById('eventForm');
    if (eventForm) {
        eventForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const event = {
                id: 'e_' + Date.now(),
                title: document.getElementById('eventTitle').value,
                date: document.getElementById('eventDate').value,
                endDate: document.getElementById('eventEndDate').value,
                time: document.getElementById('eventTime').value,
                endTime: document.getElementById('eventEndTime').value,
                location: document.getElementById('eventLocation').value,
                type: document.getElementById('eventType').value,
                description: document.getElementById('eventDescription').value,
                link: document.getElementById('eventLink').value,
                capacity: document.getElementById('eventCapacity').value,
                createdAt: new Date().toISOString()
            };
            appData.events.push(event);
            saveData();
            closeModal('eventModal');
            eventForm.reset();
            showToast('Événement créé avec succès !', 'event');
            createActivityRecord(
                `Événement créé : ${event.title}`,
                `Nouvel événement planifié pour le ${event.date}`
            );
        });
    }
    
    // Testimonial form
    const testimonialForm = document.getElementById('testimonialForm');
    if (testimonialForm) {
        testimonialForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            let photoUrl = null;
            const photoInput = document.getElementById('testimonialPhoto');
            if (photoInput && photoInput.files && photoInput.files[0]) {
                photoUrl = URL.createObjectURL(photoInput.files[0]);
            }
            
            const ratingRadio = document.querySelector('input[name="testimonialRating"]:checked');
            
            const testimonial = {
                id: 't_' + Date.now(),
                studentName: document.getElementById('testimonialName').value,
                promotion: document.getElementById('testimonialPromotion').value,
                program: document.getElementById('testimonialProgram').value,
                rating: ratingRadio ? ratingRadio.value : '5',
                message: document.getElementById('testimonialMessage').value,
                currentJob: document.getElementById('testimonialCurrentJob').value,
                photo: photoUrl,
                createdAt: new Date().toISOString()
            };
            appData.testimonials.push(testimonial);
            saveData();
            closeModal('testimonialModal');
            testimonialForm.reset();
            showToast('Témoignage ajouté avec succès !', 'testimonial');
            createActivityRecord(
                `Témoignage ajouté : ${testimonial.studentName}`,
                `Un nouveau témoignage de ${testimonial.studentName} a été enregistré.`
            );
        });
    }
    
    // Template tabs
    document.querySelectorAll('.template-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.template-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const type = tab.getAttribute('data-type');
            displayTemplates(type);
        });
    });
    
    // Analytics period change
    const analyticsPeriod = document.getElementById('analyticsPeriod');
    if (analyticsPeriod) {
        analyticsPeriod.addEventListener('change', () => {
            updateAnalytics();
            initPerformanceChart();
            initAnalyticsFollowersChart();
        });
    }
    
    // Chat send button
    const sendChatBtn = document.getElementById('sendChatBtn');
    const chatInput = document.getElementById('chatInput');
    if (sendChatBtn && chatInput) {
        sendChatBtn.addEventListener('click', async () => {
            const messageText = chatInput.value.trim();
            if (!messageText) return;
            await sendSupportChatMessage(messageText);
            chatInput.value = '';
            chatInput.focus();
        });
        
        // Envoyer avec Entrée
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendChatBtn.click();
            }
        });
    }
    
    // Chat search
    const chatSearch = document.getElementById('chatSearch');
    if (chatSearch) {
        chatSearch.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            document.querySelectorAll('.conversation-item').forEach(item => {
                const name = item.querySelector('.conversation-name')?.textContent.toLowerCase() || '';
                const lastMsg = item.querySelector('.conversation-last-msg')?.textContent.toLowerCase() || '';
                if (name.includes(searchTerm) || lastMsg.includes(searchTerm)) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    }
    
    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (!confirm('Voulez-vous vraiment vous déconnecter ?')) {
                return;
            }

            showToast('Déconnexion en cours...', 'logout');
            const token = getJWTToken();
            const logoutUrl = `${getIdentityApiBase()}/logout`;

            try {
                const sessionStr = localStorage.getItem('softura_session') || localStorage.getItem('session') || '{}';
                let session = {};
                try { session = JSON.parse(sessionStr); } catch (e) { session = {}; }

                const refreshToken = session.refresh_token || session.refreshToken || localStorage.getItem('refresh_token') || localStorage.getItem('refreshToken') || null;
                const body = refreshToken ? { refresh_token: refreshToken } : {};

                await fetch(logoutUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: Object.keys(body).length ? JSON.stringify(body) : undefined,
                });
            } catch (error) {
                console.warn('Erreur lors de la déconnexion:', error);
            } finally {
                localStorage.removeItem('jwt_token');
                localStorage.removeItem('softura_token');
                localStorage.removeItem('token');
                localStorage.removeItem('refresh_token');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('softura_session');
                localStorage.removeItem('session');
                setTimeout(() => location.href = 'index.html', 800);
            }
        });
    }
    
    // Fermer les modals en cliquant à l'extérieur
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
    
// Ajouter dans script.js

// Variables pour le preview
let currentPreviewItem = null;
let currentPreviewType = null;
let previewReplyTarget = null;

function normalizeComments(comments) {
    if (Array.isArray(comments)) {
        return buildCommentTree(comments);
    }
    if (!comments) {
        return [];
    }
    if (typeof comments === 'string') {
        try {
            return normalizeComments(JSON.parse(comments));
        } catch (e) {
            return [];
        }
    }
    if (typeof comments === 'object') {
        return normalizeComments(Object.values(comments).filter((item) => item && typeof item === 'object'));
    }
    return [];
}

function getCommentAuthor(comment) {
    const user = comment?.user || {};
    return comment?.author || comment?.name || user.name || user.sigle || 'Anonyme';
}

function normalizeComment(comment) {
    const replies = Array.isArray(comment?.replies)
        ? comment.replies.map(normalizeComment)
        : [];

    return {
        ...comment,
        id: String(comment?.id || `local_${Date.now()}_${Math.random().toString(16).slice(2)}`),
        author: getCommentAuthor(comment),
        text: comment?.text || comment?.contenu || comment?.commentaire || comment?.body || '',
        createdAt: comment?.createdAt || comment?.created_at || comment?.date_comment || comment?.date || new Date().toISOString(),
        parent_comment_id: comment?.parent_comment_id || comment?.parentCommentId || null,
        likes: Number(comment?.likes || comment?.likes_count || 0),
        replies
    };
}

function buildCommentTree(comments) {
    const normalized = (comments || []).map(normalizeComment);
    const byId = new Map();
    const roots = [];

    normalized.forEach((comment) => {
        comment.replies = Array.isArray(comment.replies) ? comment.replies : [];
        byId.set(String(comment.id), comment);
    });

    normalized.forEach((comment) => {
        const parentId = comment.parent_comment_id ? String(comment.parent_comment_id) : null;
        const parent = parentId ? byId.get(parentId) : null;
        if (parent && parent.id !== comment.id) {
            parent.replies = parent.replies || [];
            parent.replies.push(comment);
        } else {
            roots.push(comment);
        }
    });

    return roots;
}

async function fetchPostComments(postId, options = {}) {
    if (!postId) return [];
    const query = new URLSearchParams({ limit: String(options.limit || 50) });
    if (options.scope) query.set('scope', options.scope);

    const token = getJWTToken();
    const res = await fetch(`${CONTENT_API}/posts/${encodeURIComponent(postId)}/comments?${query.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    });

    if (!res.ok) {
        throw new Error(`Impossible de charger les commentaires (${res.status})`);
    }

    const json = await res.json().catch(() => null);
    const data = Array.isArray(json) ? json : (json?.data || json?.comments || []);
    return normalizeComments(data);
}

async function createPostComment(postId, text, parentCommentId = null) {
    const token = getJWTToken();
    const res = await fetch(`${CONTENT_API}/posts/${encodeURIComponent(postId)}/comments`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
            contenu: text,
            ...(parentCommentId ? { parent_comment_id: parentCommentId } : {})
        })
    });

    if (!res.ok) {
        const message = await res.text().catch(() => '');
        throw new Error(message || `Impossible d'envoyer le commentaire (${res.status})`);
    }

    const json = await res.json().catch(() => null);
    return normalizeComment(json?.data || json);
}

// Ouvrir le preview d'un post
function openPostPreview(type, id) {
    let item;
    if (type === 'short') {
        item = appData.shorts.find(s => s.id === id);
    } else if (type === 'flyer') {
        item = appData.flyers.find(f => f.id === id);
    }
    
    if (!item) {
        showToast('Contenu introuvable', 'error');
        return;
    }

    currentPreviewItem = item;
    currentPreviewType = type;
    previewReplyTarget = null;

    const modal = document.getElementById('postPreviewModal');
    const mediaContainer = document.getElementById('postMediaContainer');
    const titleEl = document.getElementById('previewPostTitle');
    const dateEl = document.getElementById('previewPostDate');
    const descEl = document.getElementById('previewPostDescription');
    const likeCount = document.getElementById('previewLikeCount');
    const shareCount = document.getElementById('previewShareCount');
    const viewCount = document.getElementById('previewViewCount');
    const commentCount = document.getElementById('previewCommentCount');
    const commentsList = document.getElementById('previewCommentsList');
    const replyTo = document.getElementById('previewReplyTo');
    const replyToName = document.getElementById('previewReplyToName');

    // Remplir les infos
    titleEl.textContent = item.title || 'Sans titre';
    dateEl.textContent = item.createdAt ? new Date(item.createdAt).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }) : '';
    descEl.textContent = item.description || '';

    // Mettre à jour les compteurs
    likeCount.textContent = item.likes || 0;
    shareCount.textContent = item.shares || 0;
    viewCount.textContent = item.views || 0;

    // Afficher le média
    if (type === 'short' && item.videoUrl) {
        mediaContainer.innerHTML = `
            <video src="${item.videoUrl}" controls autoplay muted loop playsinline style="max-width:100%;max-height:100%;border-radius:var(--radius);"></video>
        `;
    } else if (type === 'flyer' && item.imageUrl) {
        mediaContainer.innerHTML = `
            <img src="${item.imageUrl}" alt="${item.title}" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:var(--radius);">
        `;
    } else {
        mediaContainer.innerHTML = `
            <div style="text-align:center;color:var(--text-muted);padding:40px;">
                <i class="fas fa-file" style="font-size:48px;opacity:0.3;"></i>
                <p>Aucun média disponible</p>
            </div>
        `;
    }

    // Initialiser les commentaires
    item.comments = normalizeComments(item.comments);
    renderComments(item.comments, commentsList, commentCount);
    if (id && commentsList) {
        fetchPostComments(id)
            .then((comments) => {
                if (currentPreviewItem !== item) return;
                item.comments = comments;
                renderComments(item.comments, commentsList, commentCount);
            })
            .catch((error) => {
                console.warn('Error loading comments:', error);
            });
    }
    
    // Cacher le champ de réponse
    replyTo.style.display = 'none';
    document.getElementById('previewCommentInput').value = '';
    document.getElementById('previewCommentInput').placeholder = 'Écrire un commentaire...';

    modal.classList.add('active');
}

// Rendre les commentaires
function renderComments(comments, container, countEl) {
    if (!container) return;
    comments = normalizeComments(comments);
    
    if (comments.length === 0) {
        container.innerHTML = `
            <div class="no-comments">
                <i class="fas fa-comment"></i>
                <p>Aucun commentaire pour le moment</p>
                <p style="font-size:13px;">Soyez le premier à commenter !</p>
            </div>
        `;
        if (countEl) countEl.textContent = '0';
        return;
    }

    container.innerHTML = comments.map(comment => `
        <div class="post-comment-item">
            <div class="post-comment-avatar">
                <i class="fas fa-user"></i>
            </div>
            <div class="post-comment-body">
                <div class="post-comment-author">${escapeHtml(comment.author || 'Anonyme')}</div>
                <div class="post-comment-text">${escapeHtml(comment.text)}</div>
                <div class="post-comment-actions">
                    <button onclick="window.replyToComment('${comment.id}')">Répondre</button>
                    <button onclick="window.likeComment('${comment.id}')">
                        <i class="fas fa-heart"></i> ${comment.likes || 0}
                    </button>
                </div>
                ${comment.replies && comment.replies.length > 0 ? `
                    <div class="post-comment-replies">
                        ${comment.replies.map(reply => `
                            <div class="post-comment-item" style="background:transparent;padding:8px 0;">
                                <div class="post-comment-avatar" style="width:28px;height:28px;font-size:12px;">
                                    <i class="fas fa-user"></i>
                                </div>
                                <div class="post-comment-body">
                                    <div class="post-comment-author">${escapeHtml(reply.author || 'Anonyme')}</div>
                                    <div class="post-comment-text">${escapeHtml(reply.text)}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        </div>
    `).join('');

    if (countEl) countEl.textContent = comments.length;
}

// Répondre à un commentaire
function replyToComment(commentId) {
    const item = currentPreviewItem;
    if (!item) return;

    item.comments = normalizeComments(item.comments);
    const comment = item.comments.find(c => c.id === commentId);
    if (!comment) return;

    previewReplyTarget = commentId;
    const replyTo = document.getElementById('previewReplyTo');
    const replyToName = document.getElementById('previewReplyToName');
    const input = document.getElementById('previewCommentInput');

    replyTo.style.display = 'flex';
    replyToName.textContent = comment.author || 'Anonyme';
    input.placeholder = `Répondre à ${comment.author || 'Anonyme'}...`;
    input.focus();
}

// Annuler la réponse
function cancelReply() {
    previewReplyTarget = null;
    document.getElementById('previewReplyTo').style.display = 'none';
    document.getElementById('previewCommentInput').placeholder = 'Écrire un commentaire...';
    document.getElementById('previewCommentInput').value = '';
}

// Envoyer un commentaire
async function sendPreviewComment() {
    const input = document.getElementById('previewCommentInput');
    const text = input.value.trim();
    if (!text || !currentPreviewItem) return;

    const item = currentPreviewItem;
    item.comments = normalizeComments(item.comments);
    if (!item.comments) item.comments = [];

    input.disabled = true;

    let newComment;
    try {
        newComment = await createPostComment(item.id, text, previewReplyTarget);
        newComment.author = newComment.author || 'Vous';
    } catch (error) {
        console.warn('Comment API failed, keeping comment locally:', error);
        newComment = {
            id: 'c_' + Date.now(),
            author: 'Vous',
            text: text,
            likes: 0,
            replies: [],
            createdAt: new Date().toISOString(),
            parent_comment_id: previewReplyTarget || null
        };
        showToast('Commentaire gardé localement (API indisponible)', 'error');
    } finally {
        input.disabled = false;
    }

    if (previewReplyTarget) {
        // Répondre à un commentaire existant
        const parent = item.comments.find(c => c.id === previewReplyTarget);
        if (parent) {
            if (!parent.replies) parent.replies = [];
            parent.replies.push(newComment);
        }
        previewReplyTarget = null;
        document.getElementById('previewReplyTo').style.display = 'none';
    } else {
        // Nouveau commentaire
        item.comments.unshift(newComment);
    }

    // Mettre à jour l'affichage
    const commentsList = document.getElementById('previewCommentsList');
    const commentCount = document.getElementById('previewCommentCount');
    renderComments(item.comments, commentsList, commentCount);

    // Réinitialiser l'input
    input.value = '';
    input.placeholder = 'Écrire un commentaire...';
    
    // Sauvegarder les données
    saveData();
    showToast('Commentaire ajouté !', 'comment');
}

// Liker un commentaire
function likeComment(commentId) {
    const item = currentPreviewItem;
    if (!item) return;

    item.comments = normalizeComments(item.comments);
    const comment = item.comments.find(c => c.id === commentId);
    if (comment) {
        comment.likes = (comment.likes || 0) + 1;
        saveData();
        
        // Rafraîchir l'affichage des commentaires
        const commentsList = document.getElementById('previewCommentsList');
        const commentCount = document.getElementById('previewCommentCount');
        renderComments(item.comments, commentsList, commentCount);
    }
}

// Liker le post
function previewLike() {
    if (!currentPreviewItem) return;
    
    const item = currentPreviewItem;
    item.likes = (item.likes || 0) + 1;
    saveData();
    
    const likeCount = document.getElementById('previewLikeCount');
    if (likeCount) likeCount.textContent = item.likes;
    
    showToast('Merci pour votre like !', 'like');
}

// Partager le post
function previewShare() {
    if (!currentPreviewItem) return;
    
    const item = currentPreviewItem;
    item.shares = (item.shares || 0) + 1;
    saveData();
    
    const shareCount = document.getElementById('previewShareCount');
    if (shareCount) shareCount.textContent = item.shares;
    
    if (navigator.clipboard) {
        navigator.clipboard.writeText(window.location.href + '?post=' + item.id);
        showToast('Lien copié !', 'link');
    }
}

// Modifier la fonction openPreview existante
function openPreview(type, id) {
    openPostPreview(type, id);
}

// Exposer les nouvelles fonctions
window.openPostPreview = openPostPreview;
window.replyToComment = replyToComment;
window.cancelReply = cancelReply;
window.sendPreviewComment = sendPreviewComment;
window.previewLike = previewLike;
window.previewShare = previewShare;
window.likeComment = likeComment;
window.openPreview = openPreview;
window.fetchPostComments = fetchPostComments;
window.createPostComment = createPostComment;
window.normalizeComments = normalizeComments;

// Initialiser les écouteurs pour le modal de preview
document.addEventListener('DOMContentLoaded', () => {
    // Envoyer avec Entrée
    const commentInput = document.getElementById('previewCommentInput');
    if (commentInput) {
        commentInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendPreviewComment();
            }
        });
    }
});

    // Initialiser les graphiques au chargement
    setTimeout(initAllCharts, 300);
});

// Expose functions to window
// ==================== RECRUITMENT ANALYTICS ====================

// Mock data for recruitment recommendations (replace with API call)
let recruitmentData = {
    recommendations: [
        { id: 1, last_name: 'Dupont', first_name: 'Jean', telephone: '+33 6 12 34 56 78', user_type: 'Étudiant', email: 'jean.dupont@email.com', reason: 'Excellente performance académique', date: '2026-06-17', contacted: true, interviewed: false, accepted: false, message: 'Très bon profil en informatique' },
        { id: 2, last_name: 'Martin', first_name: 'Sophie', telephone: '+33 6 23 45 67 89', user_type: 'Professionnel', email: 'sophie.martin@email.com', reason: 'Leadership', date: '2026-06-16', contacted: true, interviewed: true, accepted: false, message: 'Excellentes compétences en management' },
        { id: 3, last_name: 'Bernard', first_name: 'Pierre', telephone: '+33 6 34 56 78 90', user_type: 'Chercheur', email: 'pierre.bernard@email.com', reason: 'Expérience technique', date: '2026-06-15', contacted: false, interviewed: false, accepted: false, message: null },
        { id: 4, last_name: 'Thomas', first_name: 'Marie', telephone: '+33 6 45 67 89 01', user_type: 'Étudiant', email: 'marie.thomas@email.com', reason: 'Bon matching formation', date: '2026-06-14', contacted: true, interviewed: true, accepted: true, message: 'Profil idéal pour notre programme' },
        { id: 5, last_name: 'Robert', first_name: 'Luc', telephone: '+33 6 56 78 90 12', user_type: 'Professionnel', email: 'luc.robert@email.com', reason: 'Leadership', date: '2026-06-13', contacted: false, interviewed: false, accepted: false, message: null },
        { id: 6, last_name: 'Delgado', first_name: 'Anna', telephone: '+33 6 67 89 01 23', user_type: 'Étudiant', email: 'anna.delgado@email.com', reason: 'Développement logiciel', date: '2026-06-12', contacted: true, interviewed: false, accepted: false, message: 'Excellente en développement full-stack' },
        { id: 7, last_name: 'Leclerc', first_name: 'François', telephone: '+33 6 78 90 12 34', user_type: 'Entrepreneurs', email: 'francois.leclerc@email.com', reason: 'Esprit d\'entrepreneur', date: '2026-06-11', contacted: false, interviewed: false, accepted: false, message: null },
        { id: 8, last_name: 'Garcia', first_name: 'Luis', telephone: '+33 6 89 01 23 45', user_type: 'Professionnel', email: 'luis.garcia@email.com', reason: 'Expérience technique', date: '2026-06-10', contacted: true, interviewed: true, accepted: false, message: 'Excellent en architecture cloud' },
        { id: 9, last_name: 'Müller', first_name: 'Heidi', telephone: '+33 6 90 12 34 56', user_type: 'Chercheur', email: 'heidi.muller@email.com', reason: 'Recherche en IA', date: '2026-06-09', contacted: false, interviewed: false, accepted: false, message: null },
        { id: 10, last_name: 'Rossi', first_name: 'Marco', telephone: '+33 6 01 23 45 67', user_type: 'Étudiant', email: 'marco.rossi@email.com', reason: 'Excellence académique', date: '2026-06-08', contacted: true, interviewed: true, accepted: true, message: 'Excellent candidat pour master recherche' },
    ]
};

function updateRecruitmentAnalytics() {
    const periodSelect = document.getElementById('analyticsPeriod');
    const period = parseInt(periodSelect?.value || '30');
    const now = new Date();
    
    // Filter recommendations by period
    const periodMs = period * 24 * 60 * 60 * 1000;
    const recentRecs = recruitmentData.recommendations.filter(r => {
        const recDate = new Date(r.date);
        return (now - recDate) < periodMs;
    });

    // Calculate today's date
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayRecs = recruitmentData.recommendations.filter(r => {
        const recDate = new Date(r.date);
        return recDate >= todayStart && recDate <= now;
    });

    // Calculate this month's recommendations
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthRecs = recruitmentData.recommendations.filter(r => {
        const recDate = new Date(r.date);
        return recDate >= monthStart && recDate <= now;
    });

    // Update KPI cards
    document.getElementById('candidatesTotalKpi').textContent = recruitmentData.recommendations.length;
    document.getElementById('candidatesMonthKpi').textContent = monthRecs.length;
    document.getElementById('candidatesTodayKpi').textContent = todayRecs.length;
    
    const contacted = recruitmentData.recommendations.filter(r => r.contacted).length;
    document.getElementById('candidatesContactedKpi').textContent = contacted;

    // Update conversion funnel
    const interviewed = recruitmentData.recommendations.filter(r => r.interviewed).length;
    const accepted = recruitmentData.recommendations.filter(r => r.accepted).length;
    
    document.getElementById('funnelRecommended').textContent = recruitmentData.recommendations.length;
    document.getElementById('funnelContacted').textContent = contacted;
    document.getElementById('funnelInterview').textContent = interviewed;
    document.getElementById('funnelAccepted').textContent = accepted;

    // Update profile performance (dummy data)
    document.getElementById('profileViews').textContent = formatNumber(Math.floor(Math.random() * 5000) + 1000);
    document.getElementById('profileClicks').textContent = formatNumber(Math.floor(Math.random() * 800) + 200);
    document.getElementById('profileFollowers').textContent = formatNumber(Math.floor(Math.random() * 3000) + 500);
    document.getElementById('profileApplications').textContent = formatNumber(Math.floor(Math.random() * 200) + 50);

    // Fill recommendations table
    fillRecommendationsTable(recruitmentData.recommendations);

    // Fill custom messages list
    fillCustomMessagesList(recruitmentData.recommendations);

    // Fill top reasons table
    fillTopReasonsTable(recruitmentData.recommendations);

    // Initialize charts
    initRecommendationsGrowthChart(period);
    initTypeDistributionChart();
}

function fillRecommendationsTable(recommendations) {
    const tbody = document.getElementById('recommendationsTableBody');
    if (!tbody) return;

    if (recommendations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="padding:20px; text-align:center; color:var(--text-muted);">Aucune recommandation reçue</td></tr>';
        return;
    }

    tbody.innerHTML = recommendations.map(rec => `
        <tr style="border-bottom:1px solid var(--border); hover: background:var(--bg-secondary);">
            <td style="padding:10px; text-align:left;">${rec.last_name || '-'}</td>
            <td style="padding:10px; text-align:left;">${rec.first_name || '-'}</td>
            <td style="padding:10px; text-align:left;">${rec.telephone || '-'}</td>
            <td style="padding:10px; text-align:left;"><span style="background:var(--bg-secondary); padding:2px 6px; border-radius:4px; font-size:12px;">${rec.user_type || '-'}</span></td>
            <td style="padding:10px; text-align:left;"><a href="mailto:${rec.email}" style="color:var(--primary); text-decoration:none;">${rec.email || '-'}</a></td>
            <td style="padding:10px; text-align:left; max-width:200px;">${rec.reason || '-'}</td>
            <td style="padding:10px; text-align:left;">${new Date(rec.date).toLocaleDateString('fr-FR')}</td>
            <td style="padding:10px; text-align:center;">
                <button onclick="viewCandidateProfile('${rec.id}')" style="background:none; border:none; color:var(--primary); cursor:pointer; font-size:12px; padding:4px 6px;" title="Voir profil">
                    <i class="fas fa-eye"></i>
                </button>
                <button onclick="contactCandidate('${rec.id}')" style="background:none; border:none; color:var(--primary); cursor:pointer; font-size:12px; padding:4px 6px;" title="Contacter">
                    <i class="fas fa-envelope"></i>
                </button>
                <button onclick="toggleMarked('${rec.id}')" style="background:none; border:none; color:${rec.contacted ? 'var(--success)' : 'var(--text-muted)'}; cursor:pointer; font-size:12px; padding:4px 6px;" title="Marquer traité">
                    <i class="fas fa-check"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function fillCustomMessagesList(recommendations) {
    const container = document.getElementById('customMessagesList');
    if (!container) return;

    const withMessages = recommendations.filter(r => r.message);

    if (withMessages.length === 0) {
        container.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:20px;"><i class="fas fa-envelope-open"></i><p>Aucun message personnalisé pour le moment</p></div>';
        return;
    }

    container.innerHTML = withMessages.map(rec => `
        <div style="background:var(--bg-secondary); padding:12px; border-radius:8px; border-left:3px solid var(--primary);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
                <div>
                    <strong style="display:block; margin-bottom:4px;">${rec.first_name} ${rec.last_name}</strong>
                    <p style="margin:0; font-size:13px; color:var(--text-secondary);">"${rec.message}"</p>
                </div>
                <small style="color:var(--text-muted); white-space:nowrap;">${new Date(rec.date).toLocaleDateString('fr-FR')}</small>
            </div>
        </div>
    `).join('');
}

function fillTopReasonsTable(recommendations) {
    const tbody = document.getElementById('topReasonsTableBody');
    if (!tbody) return;

    // Count reasons
    const reasonCounts = {};
    recommendations.forEach(rec => {
        const reason = rec.reason || 'Non spécifiée';
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    });

    // Sort by count
    const sorted = Object.entries(reasonCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    const total = recommendations.length;

    tbody.innerHTML = sorted.map(([reason, count]) => {
        const percentage = ((count / total) * 100).toFixed(1);
        return `
            <tr style="border-bottom:1px solid var(--border);">
                <td style="padding:10px; text-align:left;">${reason}</td>
                <td style="padding:10px; text-align:right;"><strong>${count}</strong></td>
                <td style="padding:10px; text-align:right;">
                    <div style="background:var(--primary); color:white; padding:2px 6px; border-radius:4px; display:inline-block; font-size:12px; font-weight:600;">${percentage}%</div>
                </td>
            </tr>
        `;
    }).join('');
}

function initRecommendationsGrowthChart(period) {
    const canvas = document.getElementById('recommendationsGrowthChart');
    if (!canvas) return;

    let labels = [];
    let data = [];
    let variation = '+24%';

    // Data based on selected period
    if (period === 7) {
        // Weekly data for 7 days
        labels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
        data = [8, 10, 9, 14, 11, 16, 18];
        variation = '+12%';
    } else if (period === 30) {
        // Weekly data for 30 days (4 weeks)
        labels = ['Semaine 1', 'Semaine 2', 'Semaine 3', 'Semaine 4'];
        data = [12, 18, 27, 34];
        variation = '+24%';
    } else if (period === 90) {
        // Monthly data for 90 days (3 months)
        labels = ['Mois 1', 'Mois 2', 'Mois 3'];
        data = [85, 120, 145];
        variation = '+71%';
    }

    // Destroy existing chart if it exists
    if (window.recommendationsGrowthChart && typeof window.recommendationsGrowthChart.destroy === 'function') {
        window.recommendationsGrowthChart.destroy();
    }

    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
    const ctx = canvas.getContext('2d');
    window.recommendationsGrowthChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Recommandations reçues',
                data: data,
                borderColor: primaryColor,
                backgroundColor: primaryColor + '20',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                pointHoverRadius: 7,
                pointBackgroundColor: primaryColor,
                pointBorderColor: '#fff',
                pointBorderWidth: 2,

            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { 
                    display: false
                },
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            return `${context.raw} candidat${context.raw > 1 ? 's' : ''}`;
                        }
                    }
                }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    max: Math.max(...data) * 1.2,
                    ticks: { 
                        stepSize: Math.ceil(Math.max(...data) / 5)
                    },
                    grid: {
                        color: 'rgba(0,0,0,0.05)'
                    }
                },
                x: { 
                    grid: { 
                        display: false
                    }
                }
            }
        }
    });

    // Add variation badge
    const cardHeader = canvas.closest('.chart-card')?.querySelector('.card-header');
    if (cardHeader && !cardHeader.querySelector('.variation-badge')) {
        const badge = document.createElement('span');
        badge.className = 'variation-badge';
        badge.style.cssText = 'display:inline-block; background:#10b981; color:white; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:600; margin-left:10px;';
        badge.textContent = variation + ' vs période précédente';
        cardHeader.appendChild(badge);
    }
}

function initTypeDistributionChart() {
    const canvas = document.getElementById('typeDistributionChart');
    if (!canvas) return;

    const labels = ['Étudiants', 'Professionnels', 'Chercheurs', 'Entrepreneurs'];
    const data = [60, 25, 10, 5];
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#8b5cf6'];

    if (window.typeDistributionChart && typeof window.typeDistributionChart.destroy === 'function') {
        window.typeDistributionChart.destroy();
    }

    const cardBg = getComputedStyle(document.documentElement).getPropertyValue('--card-bg').trim() || '#ffffff';
    const ctx = canvas.getContext('2d');
    
    window.typeDistributionChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderColor: cardBg,
                borderWidth: 2,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 12,
                        font: { size: 12 },
                        generateLabels: function(chart) {
                            const data = chart.data;
                            return data.labels.map((label, i) => ({
                                text: `${label} (${data.datasets[0].data[i]}%)`,
                                fillStyle: data.datasets[0].backgroundColor[i],
                                hidden: false,
                                index: i
                            }));
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    padding: 10,
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.parsed}%`;
                        }
                    }
                }
            }
        }
    });
}

function viewCandidateProfile(recId) {
    alert(`Fonction à implémenter: voir le profil du candidat ${recId}`);
}

function contactCandidate(recId) {
    const rec = recruitmentData.recommendations.find(r => r.id == recId);
    if (rec) {
        window.location.href = `mailto:${rec.email}`;
    }
}

function toggleMarked(recId) {
    const rec = recruitmentData.recommendations.find(r => r.id == recId);
    if (rec) {
        rec.contacted = !rec.contacted;
        updateRecruitmentAnalytics();
    }
}

window.navigateTo = navigateTo;
window.openShortModal = openShortModal;
window.openFlyerModal = openFlyerModal;
window.openFormationModal = openFormationModal;
window.openEventModal = openEventModal;
window.openTestimonialModal = openTestimonialModal;
window.openTemplateSelector = openTemplateSelector;
window.closeModal = closeModal;
window.playVideo = playVideo;
window.likeContent = likeContent;
window.shareContent = shareContent;
window.downloadFlyer = downloadFlyer;
window.deleteContent = deleteContent;
window.deleteFormation = deleteFormation;
window.deleteEvent = deleteEvent;
window.deleteTestimonial = deleteTestimonial;
window.applyTemplate = applyTemplate;
window.displayTemplates = displayTemplates;
window.selectConversation = selectConversation;
window.formatNumber = formatNumber;
window.updateRecruitmentAnalytics = updateRecruitmentAnalytics;
window.fillRecommendationsTable = fillRecommendationsTable;
window.viewCandidateProfile = viewCandidateProfile;
window.contactCandidate = contactCandidate;
window.toggleMarked = toggleMarked;