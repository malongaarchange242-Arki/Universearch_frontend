document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURATION ---
    const POSTS_KEY = 'universearh_posts';

    const getPostsKey = () => {
        try {
            const session = JSON.parse(localStorage.getItem('softura_session') || '{}');
            const id = session.userId || session.id || localStorage.getItem('userId') || 'anon';
            return `${POSTS_KEY}_${String(id)}`;
        } catch (e) {
            return `${POSTS_KEY}_anon`;
        }
    };

    const loadStoredPosts = () => {
        const key = getPostsKey();
        return JSON.parse(localStorage.getItem(key) || sessionStorage.getItem(key) || '[]') || [];
    };

    // Safe save helper: try localStorage, trim oldest posts on quota, fall back to sessionStorage
    const savePostsSafely = (posts) => {
        try {
            localStorage.setItem(getPostsKey(), JSON.stringify(posts));
            return true;
        } catch (err) {
            try {
                // If quota exceeded, keep only recent 50 posts
                const trimmed = posts.slice(-50);
                localStorage.setItem(getPostsKey(), JSON.stringify(trimmed));
                console.warn('Storage trimmed to last 50 posts due to quota');
                return true;
            } catch (err2) {
                try {
                    // Last resort: sessionStorage (smaller lifetime but avoids quota on local)
                    sessionStorage.setItem(getPostsKey(), JSON.stringify(posts.slice(-10)));
                    console.warn('Saved recent posts to sessionStorage as fallback');
                    return true;
                } catch (err3) {
                    console.warn('Failed to persist posts to storage', err3);
                    return false;
                }
            }
        }
    };

    // derive a per-user settings key so multiple accounts don't overwrite each other
    const getSettingsKey = () => {
        try {
            const session = JSON.parse(localStorage.getItem('softura_session') || '{}');
            const id = session.userId || session.email || 'anon';
            return `universearch_settings_${id}`;
        } catch (e) {
            return 'universearh_settings_anon';
        }
    };

    // Return API base depending on logged user's role
    const getJWTRole = () => {
        try {
            const token = localStorage.getItem('jwt_token') || localStorage.getItem('softura_token') || '';
            if (!token) return null;
            
            const parts = token.split('.');
            if (parts.length !== 3) return null;
            
            const payload = JSON.parse(atob(parts[1]));
            const role = payload.role || payload.userType || payload.institution_type || payload.user_type || null;
            
            if (role) {
                console.log('✅ Role from JWT:', role);
            }
            return role;
        } catch (error) {
            console.error('Error decoding JWT in univ.js:', error);
            return null;
        }
    };

    const getApiBase = () => {
        try {
            // Try JWT first
            const jwtRole = getJWTRole();
            if (jwtRole) {
                const role = String(jwtRole).toLowerCase();
                return (role === 'centre' || role === 'centre_formation') ? 'https://universearch-pwlf.onrender.com/centres' : 'https://universearch-9qle.onrender.com/universites';
            }
            
            // Fallback to session/localStorage
            const session = JSON.parse(localStorage.getItem('softura_session') || '{}');
            const roleFromSession = (session.role || session.userType || session.profileType || '').toString().toLowerCase();
            const roleFromLS = (localStorage.getItem('role') || '').toString().toLowerCase();
            const role = roleFromSession || roleFromLS;
            return (role === 'centre' || role === 'centre_formation') ? 'https://universearch-pwlf.onrender.com/centres' : 'https://universearch-9qle.onrender.com/universites';
        } catch (e) {
            return 'https://universearch-pwlf.onrender.com/universites';
        }
    };

    const getToken = () => {
        try {
            return localStorage.getItem('token') || localStorage.getItem('softura_token') || null;
        } catch (e) {
            return null;
        }
    };

    const getTokenPayload = () => {
        try {
            const token = getToken();
            if (!token) return null;
            const parts = token.split('.');
            if (parts.length !== 3) return null;
            const payloadStr = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
            return JSON.parse(decodeURIComponent(escape(payloadStr)));
        } catch (e) {
            console.warn('Failed to decode auth token payload', e);
            return null;
        }
    };

    // Base URL for the content service (posts/comments/etc)
    const CONTENT_API = 'https://universearch-content-service.onrender.com';

    // Common auth headers helper
    const getAuthHeaders = () => {
        const token = getToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    const normalizeOrgRole = (rawRole) => {
        const role = String(rawRole || '').trim().toLowerCase().replace(/-/g, '_');
        if (role === 'universite' || role === 'université') return 'universite';
        if (role === 'centre' || role === 'centre_formation' || role === 'centre de formation') return 'centre_formation';
        return '';
    };

    const inferRoleFromCurrentSpace = () => {
        try {
            const path = String(window.location.pathname || '').toLowerCase();
            const fileName = path.split('/').pop() || '';
            if (fileName === 'univ.html' || fileName === 'univ_admi.html') return 'universite';
        } catch (e) {
            /* ignore */
        }
        return '';
    };

    // Helper: get session info (used for filtering posts)
    const getSessionInfo = () => {
        try {
            const s = JSON.parse(localStorage.getItem('softura_session') || '{}') || {};
            const tokenPayload = getTokenPayload() || {};
            const fallbackId = s.userId || s.id || s.universiteId || localStorage.getItem('userId') || '';
            const id =
                tokenPayload.user_id ||
                tokenPayload.userId ||
                tokenPayload.id ||
                tokenPayload.sub ||
                tokenPayload.profile_id ||
                tokenPayload.profileId ||
                tokenPayload.universite_id ||
                tokenPayload.universiteId ||
                fallbackId;
            const role = normalizeOrgRole(
                tokenPayload.profile_type ||
                tokenPayload.profileType ||
                tokenPayload.role ||
                tokenPayload.userType ||
                s.role ||
                s.profile_type ||
                s.profileType ||
                s.userType ||
                localStorage.getItem('role') ||
                inferRoleFromCurrentSpace()
            );
            if (!s.role && role) {
                s.role = role;
                s.profile_type = s.profile_type || role;
                s.profileType = s.profileType || role;
                if (id && !s.userId) s.userId = id;
                localStorage.setItem('softura_session', JSON.stringify(s));
                localStorage.setItem('role', role);
                if (id) localStorage.setItem('userId', String(id));
            }
            return { id: String(id || ''), role };
        } catch (e) {
            return { id: '', role: inferRoleFromCurrentSpace() };
        }
    };

    const getOrganizationIdCandidates = () => {
        try {
            const session = JSON.parse(localStorage.getItem('softura_session') || '{}') || {};
            const tokenPayload = getTokenPayload() || {};
            const candidates = [
                tokenPayload.user_id,
                tokenPayload.userId,
                tokenPayload.id,
                tokenPayload.sub,
                tokenPayload.profile_id,
                tokenPayload.profileId,
                tokenPayload.universite_id,
                tokenPayload.universiteId,
                session.universiteId,
                session.universite_id,
                session.profile_id,
                session.organizationId,
                session.organization_id,
                session.userId,
                session.user_id,
                session.id,
                localStorage.getItem('userId'),
            ]
                .filter((value) => value !== null && value !== undefined && String(value).trim() !== '')
                .map((value) => String(value).trim());

            return [...new Set(candidates)];
        } catch (e) {
            const fallback = localStorage.getItem('userId');
            return fallback ? [String(fallback)] : [];
        }
    };

    // --- NOUVELLE FONCTION : DATES RELATIVES ---
    const formatRelativeDate = (timestamp) => {
        const diffInSeconds = Math.floor((Date.now() - timestamp) / 1000);
        if (diffInSeconds < 60) return "À l'instant";
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        if (diffInMinutes < 60) return `Il y a ${diffInMinutes} min`;
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `Il y a ${diffInHours} h`;
        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays < 7) return `Il y a ${diffInDays} j`;
        return new Date(timestamp).toLocaleDateString();
    };

    // Robust parse for various server date formats (accepts Date object, number, or string like "2026-02-21 10:14:35.966")
    const parseToMillis = (v) => {
        try {
            if (!v) return NaN;
            if (typeof v === 'number') return v;
            if (v instanceof Date) return v.getTime();
            if (typeof v === 'string') {
                // Normalize database format: replace space with 'T' for ISO compliance
                const normalized = v.replace(' ', 'T');
                // Check if timezone info exists at the END of the string (Z, +HH:MM, or -HH:MM)
                const hasTimezone = /Z$|[+-]\d{2}:\d{2}$/.test(normalized);
                // If no timezone, assume UTC (Z) since database typically stores UTC times
                const withTimezone = hasTimezone ? normalized : normalized + 'Z';
                const d = new Date(withTimezone);
                if (!isNaN(d.getTime())) return d.getTime();
                
                // Fallback: try direct parse
                const direct = new Date(v);
                if (!isNaN(direct.getTime())) return direct.getTime();
            }
        } catch (e) { /* ignore */ }
        return NaN;
    };

    // Return a localized date + time string (JJ/MM/AAAA HH:MM) for a timestamp-ish value
    const formatExactTime = (timestamp) => {
        try {
            const ms = parseToMillis(timestamp) || Date.now();
            const d = new Date(ms);
            const dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `${dateStr} ${timeStr}`;
        } catch (e) {
            return '';
        }
    };

    // Get the most reliable timestamp for a post object (checks nested server fields)
    const getPostTimestamp = (post) => {
        try {
            if (!post) return Date.now();
            if (post.__server) {
                const s = post.__server;
                const candidates = [s.date_creation, s.created_at, s.createdAt, s.dateCreated, s.date];
                for (const c of candidates) {
                    const n = parseToMillis(c);
                    if (!isNaN(n)) return n;
                }
            }
            // top-level candidates - prioritize date_creation from database
            const topCandidates = [post.date_creation, post.created_at, post.createdAt, post.dateCreated, post.date];
            for (const c of topCandidates) {
                const n = parseToMillis(c);
                if (!isNaN(n)) return n;
            }
            // if id encodes timestamp prefix like `${Date.now()}-xxxx`
            if (typeof post.id === 'string' && post.id.includes('-')) {
                const prefix = post.id.split('-')[0];
                const n = Number(prefix);
                if (!isNaN(n) && n > 0) return n;
            }
            const nId = Number(post.id);
            if (!isNaN(nId) && nId > 0) return nId;
        } catch (e) { /* ignore */ }
        return Date.now();
    };

    // Small toast helper: shows a message for `duration` ms then disappears
    const showToast = (message, duration = 3000) => {
        try {
            const existing = document.getElementById('app-toast');
            if (existing) existing.remove();
            const t = document.createElement('div');
            t.id = 'app-toast';
            t.innerText = message;
            t.style.position = 'fixed';
            t.style.right = '20px';
            t.style.bottom = '20px';
            t.style.background = 'rgba(0,0,0,0.85)';
            t.style.color = 'white';
            t.style.padding = '10px 14px';
            t.style.borderRadius = '8px';
            t.style.boxShadow = '0 6px 18px rgba(0,0,0,0.2)';
            t.style.zIndex = 99999;
            t.style.fontFamily = 'inherit';
            t.style.transition = 'opacity 200ms ease';
            t.style.opacity = '0';
            document.body.appendChild(t);
            // force reflow then fade in
            // eslint-disable-next-line no-unused-expressions
            t.offsetHeight;
            t.style.opacity = '1';
            setTimeout(() => {
                t.style.opacity = '0';
                setTimeout(() => { try { t.remove(); } catch (e) {} }, 250);
            }, duration);
        } catch (e) { console.warn('Toast error', e); }
    };

    // --- 1. SYNCHRONISATION (Paramètres, Logo, BDE) ---
    // applySettings accepts an optional source object (usually server data).
    // If no serverData is provided it will fall back to per-user localStorage cache.
    const applySettings = (serverData = null) => {
        const readCachedSettings = () => {
            try {
                const key = getSettingsKey();
                const saved = localStorage.getItem(key) || localStorage.getItem(key.replace('universearch', 'universearh'));
                return saved ? JSON.parse(saved) : null;
            } catch (e) {
                return null;
            }
        };

        const cached = readCachedSettings();
        const raw = serverData || cached;

        if (!raw) return; // nothing to apply

        // If server returned an array (some /me responses), prefer its first element as the data object
        const normalizeDataObject = (value) => Array.isArray(value) && value.length > 0 ? value[0] : value;
        const data = normalizeDataObject(raw);
        const serverObject = normalizeDataObject(serverData);
        const cachedObject = normalizeDataObject(cached);
        const firstNonEmpty = (...values) => {
            for (const value of values) {
                if (value === null || value === undefined) continue;
                if (typeof value === 'string') {
                    if (value.trim() !== '') return value;
                    continue;
                }
                return value;
            }
            return '';
        };

        // Normalize keys between univ-eco and dashboard saved shapes
        const name = firstNonEmpty(
            data.schoolName,
            data.nom,
            data.name,
            serverObject?.schoolName,
            serverObject?.nom,
            serverObject?.name,
            cachedObject?.schoolName,
            cachedObject?.nom,
            cachedObject?.name
        );
        const sigle = firstNonEmpty(
            data.schoolSigle,
            data.sigle,
            serverObject?.schoolSigle,
            serverObject?.sigle,
            cachedObject?.schoolSigle,
            cachedObject?.sigle,
            name ? String(name).split(' ').map(w => w[0]).join('').toUpperCase() : 'UN'
        );
        const logo = firstNonEmpty(
            data.schoolLogo,
            data.logo_url,
            data.logo,
            serverObject?.schoolLogo,
            serverObject?.logo_url,
            serverObject?.logo,
            cachedObject?.schoolLogo,
            cachedObject?.logo_url,
            cachedObject?.logo,
            null
        );
        const mission = firstNonEmpty(
            data.schoolMission,
            data.description,
            data.mission,
            serverObject?.schoolMission,
            serverObject?.description,
            serverObject?.mission,
            cachedObject?.schoolMission,
            cachedObject?.description,
            cachedObject?.mission,
            ''
        );

        // A. Logo Ecole: prefer an image URL/data URI, otherwise show sigle
        const schoolLogoContainer = document.querySelector('.school-logo');
        if (schoolLogoContainer) {
            if (logo && (typeof logo === 'string') && (logo.startsWith('data:') || logo.startsWith('http'))) {
                schoolLogoContainer.innerHTML = `<img src="${logo}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
                schoolLogoContainer.style.background = 'transparent';
                schoolLogoContainer.style.border = 'none';
            } else {
                schoolLogoContainer.innerHTML = `<span>${sigle || 'UN'}</span>`;
                schoolLogoContainer.style.background = '';
            }
        }

        // B. Textes Ecole
        const schoolTitle = document.getElementById('dash-school-name');
        // support both old id and new dashboard markup
        const schoolMission = document.getElementById('dash-school-mission') || document.getElementById('school-description');
        const toggleBtn = document.getElementById('toggle-description');
        if (schoolTitle) schoolTitle.textContent = name || 'NOM DE L\'ÉTABLISSEMENT';

        // Secure description rendering using textContent only and a 250-char toggle
        if (schoolMission) {
            schoolMission.style.whiteSpace = 'pre-line';
            const full = mission || '';
            const limit = 250;
            if (full.length <= limit) {
                schoolMission.textContent = full;
                if (toggleBtn) toggleBtn.style.display = 'none';
            } else {
                const shortText = full.substring(0, limit) + '...';
                schoolMission.textContent = shortText;
                if (toggleBtn) {
                    toggleBtn.style.display = 'inline';
                    toggleBtn.textContent = 'Voir plus';
                    toggleBtn.onclick = (e) => {
                        e.stopPropagation();
                        const isShort = schoolMission.textContent === shortText;
                        schoolMission.textContent = isShort ? full : shortText;
                        toggleBtn.textContent = isShort ? 'Voir moins' : 'Voir plus';
                    };
                }
            }
        }

        // C. BDE Dashboard
        // Intentionally handled by renderBdeMembers() only.
    };
    const normalizeLookupText = (value) => {
        try {
            return String(value || '')
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .trim();
        } catch (e) {
            return String(value || '').toLowerCase().trim();
        }
    };

    const formatBdeDisplayName = (data = {}) => {
        const firstName = String(data.pres_firstname || data.presFirstname || '').trim();
        let lastName = String(data.pres_lastname || data.presLastname || '').trim();
        const fullName = String(data.nom || data.name || '').trim();

        if (firstName && lastName) {
            const normalizedFirst = firstName.toLowerCase();
            const lastParts = lastName.split(/\s+/).filter(Boolean);
            if (lastParts.length > 1 && lastParts[lastParts.length - 1].toLowerCase() === normalizedFirst) {
                lastName = lastParts.slice(0, -1).join(' ');
            }
            return `${firstName} ${lastName}`.trim();
        }

        if (fullName) {
            const normalizedFullName = normalizeLookupText(fullName);
            const looksLikeUniversityName =
                normalizedFullName.startsWith('universite ') ||
                normalizedFullName === 'universite' ||
                normalizedFullName.startsWith('centre ') ||
                normalizedFullName === 'centre' ||
                normalizedFullName.startsWith('ecole ') ||
                normalizedFullName === 'ecole';
            if (!looksLikeUniversityName) {
                return fullName;
            }
        }

        return '';
    };

    const renderBdeMembers = (source = null) => {
        const resolveLocalBdeData = () => {
            try {
                const session = JSON.parse(localStorage.getItem('softura_session') || '{}');
                const preferredKeys = [
                    getSettingsKey(),
                    getSettingsKey().replace('universearch', 'universearh'),
                    session.email ? 'universearch_settings_' + session.email : null,
                    session.email ? 'universearh_settings_' + session.email : null,
                    session.userId ? 'universearch_settings_' + session.userId : null,
                    session.userId ? 'universearh_settings_' + session.userId : null,
                    session.id ? 'universearch_settings_' + session.id : null,
                    session.id ? 'universearh_settings_' + session.id : null,
                ].filter(Boolean);

                for (const key of preferredKeys) {
                    const saved = localStorage.getItem(key);
                    if (!saved) continue;
                    const parsed = JSON.parse(saved);
                    const data = Array.isArray(parsed) ? parsed[0] : parsed;
                    if (data) {
                        const hasPresident = data.pres_firstname || data.presFirstname || data.pres_lastname || data.presLastname;
                        if (hasPresident) return data;
                    }
                }
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (!key || (!key.startsWith('universearch_settings_') && !key.startsWith('universearh_settings_'))) {
                        continue;
                    }
                    const saved = localStorage.getItem(key);
                    if (!saved) continue;
                    const parsed = JSON.parse(saved);
                    const data = Array.isArray(parsed) ? parsed[0] : parsed;
                    const hasPresident = data && (data.pres_firstname || data.presFirstname || data.pres_lastname || data.presLastname);
                    if (hasPresident) return data;
                }
            } catch (e) {
                console.warn('Unable to resolve local BDE data', e);
            }
            return null;
        };

        const localData = resolveLocalBdeData();
        const raw = source || localData;
        const sourceData = Array.isArray(raw) ? raw[0] : raw;
        const fallbackData = Array.isArray(localData) ? localData[0] : localData;
        const data = sourceData || fallbackData
            ? { ...(fallbackData || {}), ...(sourceData || {}) }
            : null;

        if (!data) return;

        const presLast = data.pres_lastname || data.presLastname || '';
        const presFirst = data.pres_firstname || data.presFirstname || '';
        const presPhone = data.pres_phone || data.presPhone || '';
        const presEmail = data.pres_email || data.presEmail || '';
        const vpFirst = data.vpFirstname || data.vp_firstname || '';
        const vpLast = data.vpLastname || data.vp_lastname || '';
        const presidentFullName = formatBdeDisplayName(data);
        const vpFullName = `${vpFirst} ${vpLast}`.trim();

        const presName = document.getElementById('dash-pres-name');
        const vpName = document.getElementById('dash-vp-name');
        const modalPresName = document.getElementById('modal-pres-name');
        const modalPresClass = document.getElementById('modal-pres-class');
        const modalPresPhone = document.getElementById('modal-pres-phone');
        const modalVpName = document.getElementById('modal-vp-name');
        const modalBdeMissions = document.getElementById('modal-bde-missions');

        if (presName) presName.innerText = presidentFullName || 'NON DÉSIGNÉ(E)';
        if (vpName) vpName.innerText = (data.isVpAdded && vpFullName) ? vpFullName.toUpperCase() : 'NON DÉSIGNÉ(E)';
        if (modalPresName) modalPresName.innerText = presidentFullName || 'NON DÉSIGNÉ(E)';
        if (modalPresClass) modalPresClass.innerText = presEmail || 'Email non défini';
        if (modalPresPhone) modalPresPhone.innerText = presPhone || 'Contact non défini';
        if (modalVpName) modalVpName.innerText = vpFullName || 'NON DÉSIGNÉ(E)';
        if (modalBdeMissions) {
            modalBdeMissions.innerText = data.description || data.schoolMission || 'Aucune mission renseignée pour le moment.';
        }
    };

    const getInitials = (f, l) => (f?.charAt(0) || "") + (l?.charAt(0) || "") || "??";

    const handleResizableText = (element, limit) => {
        try {
            const fullText = element.innerText;
            if (fullText.length <= limit) return;
            const shortText = fullText.substring(0, limit) + "...";
            element.innerText = shortText;
            const btn = document.createElement('button');
            btn.innerText = "Voir plus";
            btn.style = "background:none; border:none; color:#2563eb; cursor:pointer; font-weight:bold; margin-top:5px; font-family:inherit;";
            btn.onclick = (e) => {
                e.stopPropagation();
                const isShort = element.innerText === shortText;
                element.innerText = isShort ? fullText : shortText;
                btn.innerText = isShort ? "Voir moins" : "Voir plus";
            };
            // ensure we append to a stable parent
            const parent = element.parentElement || element;
            parent.appendChild(btn);
        } catch (e) {
            console.warn('handleResizableText failed', e);
        }
    };

    // Initialize dashboard: try fetching profile from backend, otherwise use local cache
    const initProfile = async () => {
        const token = getToken();
        const base = getApiBase();

        if (!token) {
            applySettings(); // no token -> use cached settings if any
            renderBdeMembers();
            return;
        }

        try {
            const res = await fetch(`${base}/me`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (res.status === 401) {
                // token expired or invalid
                try { localStorage.removeItem('softura_token'); localStorage.removeItem('softura_session'); } catch (e) {}
                alert('Session expirée. Veuillez vous reconnecter.');
                window.location.href = 'index.html';
                return;
            }

            if (!res.ok) {
                // server returned error (404, 500, ...). fallback to cache
                console.warn('Failed to fetch profile:', res.status);
                applySettings();
                renderBdeMembers();
                return;
            }

            const json = await res.json().catch(() => null);
            if (!json) {
                applySettings();
                renderBdeMembers();
                return;
            }

            // prefer server values for display; also persist into cache for offline/fallback
            const profile = json.data ?? json;
            
            // ✅ UPDATE softura_session with userId from server profile
            try {
                const currentSession = JSON.parse(localStorage.getItem('softura_session') || '{}');
                const tokenPayload = getTokenPayload() || {};
                const resolvedUniversiteId =
                    tokenPayload.universite_id ||
                    tokenPayload.universiteId ||
                    profile.profile_id ||
                    profile.universite_id ||
                    profile.universiteId ||
                    tokenPayload.profile_id ||
                    tokenPayload.profileId ||
                    tokenPayload.id ||
                    tokenPayload.sub ||
                    currentSession.universiteId ||
                    profile.id;
                const resolvedUserId =
                    tokenPayload.user_id ||
                    tokenPayload.userId ||
                    tokenPayload.id ||
                    tokenPayload.sub ||
                    tokenPayload.profile_id ||
                    tokenPayload.profileId ||
                    profile.user_id ||
                    profile.userId ||
                    profile.profile_id ||
                    currentSession.userId ||
                    profile.id;

                currentSession.userId = resolvedUserId;
                currentSession.universiteId = resolvedUniversiteId;
                currentSession.profile_id = currentSession.profile_id || profile.profile_id || resolvedUserId;
                currentSession.userName = profile.nom;
                localStorage.setItem('softura_session', JSON.stringify(currentSession));
                if (resolvedUserId) localStorage.setItem('userId', String(resolvedUserId));
                console.log('📝 Updated softura_session with userId:', currentSession.userId);
            } catch (e) {
                console.warn('Failed to update session with userId', e);
            }
            
            const normalizeLookupText = (value) => String(value || '')
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/\s+/g, ' ')
                .trim();

            // Fetch BDE for the authenticated university using a stable backend route
            try {
                const response = await fetch(
                    'https://universearch-pwlf.onrender.com/universites/me/bde',
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    }
                );

                let bde = null;
                if (response.ok) {
                    const result = await response.json();
                    bde = Array.isArray(result?.data)
                        ? result.data[0]
                        : (Array.isArray(result) ? result[0] : result?.data || result);
                } else {
                    console.warn('BDE endpoint not found or not accessible (status:', response.status + ')');
                }

                if (!bde) {
                    try {
                        const universitiesRes = await fetch('https://universearch-pwlf.onrender.com/universites', {
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        });

                        if (universitiesRes.ok) {
                            const universitiesJson = await universitiesRes.json().catch(() => null);
                            const universities = Array.isArray(universitiesJson?.data)
                                ? universitiesJson.data
                                : (Array.isArray(universitiesJson) ? universitiesJson : []);

                            const currentSession = JSON.parse(localStorage.getItem('softura_session') || '{}');
                            const sessionEmail = normalizeLookupText(currentSession.email);
                            const profileEmail = normalizeLookupText(profile.email);
                            const profileName = normalizeLookupText(profile.nom || profile.name);

                            const matchedUniversity = universities.find((item) => {
                                const itemEmail = normalizeLookupText(item?.email);
                                const itemName = normalizeLookupText(item?.nom || item?.name);
                                return (
                                    (sessionEmail && itemEmail === sessionEmail) ||
                                    (profileEmail && itemEmail === profileEmail) ||
                                    (profileName && itemName === profileName)
                                );
                            });

                            if (matchedUniversity?.id) {
                                const fallbackRes = await fetch(
                                    `https://universearch-pwlf.onrender.com/universites/${matchedUniversity.id}/bde`
                                );
                                if (fallbackRes.ok) {
                                    const fallbackJson = await fallbackRes.json().catch(() => null);
                                    bde = Array.isArray(fallbackJson?.data)
                                        ? fallbackJson.data[0]
                                        : (Array.isArray(fallbackJson) ? fallbackJson[0] : fallbackJson?.data || fallbackJson);
                                }
                            }
                        }
                    } catch (fallbackError) {
                        console.warn('Fallback BDE lookup failed', fallbackError);
                    }
                }

                if (bde) {
                    profile.pres_firstname = profile.pres_firstname || bde.pres_firstname || bde.presFirstname || null;
                    profile.pres_lastname = profile.pres_lastname || bde.pres_lastname || bde.presLastname || null;
                    profile.pres_phone = profile.pres_phone || bde.pres_phone || bde.presPhone || null;
                    profile.pres_email = profile.pres_email || bde.pres_email || bde.presEmail || null;
                    profile.presFirstname = profile.presFirstname || profile.pres_firstname || bde.pres_firstname || bde.presFirstname;
                    profile.presLastname = profile.presLastname || profile.pres_lastname || bde.pres_lastname || bde.presLastname;
                    profile.presPhone = profile.presPhone || profile.pres_phone || bde.pres_phone || bde.presPhone;
                    profile.presEmail = profile.presEmail || profile.pres_email || bde.pres_email || bde.presEmail;
                }
            } catch (e) {
                console.warn('Error fetching BDE', e);
            }

            applySettings(profile);
            renderBdeMembers(profile);
            try {
                const settingsKey = getSettingsKey();
                const existingRaw =
                    localStorage.getItem(settingsKey) ||
                    localStorage.getItem(settingsKey.replace('universearch', 'universearh')) ||
                    '{}';
                const existingSettings = JSON.parse(existingRaw);
                const mergedSettings = {
                    ...existingSettings,
                    ...profile,
                    pres_firstname: profile.pres_firstname || profile.presFirstname || existingSettings.pres_firstname || existingSettings.presFirstname || null,
                    pres_lastname: profile.pres_lastname || profile.presLastname || existingSettings.pres_lastname || existingSettings.presLastname || null,
                    pres_phone: profile.pres_phone || profile.presPhone || existingSettings.pres_phone || existingSettings.presPhone || null,
                    pres_email: profile.pres_email || profile.presEmail || existingSettings.pres_email || existingSettings.presEmail || null,
                    presFirstname: profile.presFirstname || profile.pres_firstname || existingSettings.presFirstname || existingSettings.pres_firstname || null,
                    presLastname: profile.presLastname || profile.pres_lastname || existingSettings.presLastname || existingSettings.pres_lastname || null,
                    presPhone: profile.presPhone || profile.pres_phone || existingSettings.presPhone || existingSettings.pres_phone || null,
                    presEmail: profile.presEmail || profile.pres_email || existingSettings.presEmail || existingSettings.pres_email || null,
                };
                localStorage.setItem(settingsKey, JSON.stringify(mergedSettings));
            } catch (e) { /* ignore */ }
        } catch (err) {
            console.error('Profile fetch error', err);
            applySettings();
            renderBdeMembers();
        }
    };

    // --- 1.5 CHARGE FOLLOWER STATS ---
    const loadFollowerStats = async () => {
        const token = getToken();
        const base = getApiBase();

        if (!token) {
            console.warn('No token for follower stats');
            return;
        }

        try {
            // First, get the current user's ID (universite or centre)
            const meRes = await fetch(`${base}/me`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!meRes.ok) {
                console.warn('Failed to fetch user profile for follower stats:', meRes.status);
                return;
            }

            const meJson = await meRes.json().catch(() => null);
            if (!meJson) return;

            const profile = meJson.data ?? meJson;
            const userId = profile.id;

            if (!userId) {
                console.warn('Could not determine user ID');
                return;
            }

            // Call the public /followers/count endpoint (no auth required)
            const endpoint = `${base}/${userId}/followers/count`;
            console.log('Fetching followers count from:', endpoint);

            const followersRes = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!followersRes.ok) {
                console.warn('Failed to fetch followers count:', followersRes.status);
                return;
            }

            const followersJson = await followersRes.json().catch(() => null);
            if (!followersJson) return;

            // Extract count from response - structure is { universiteId, followerCount: X }
            let followerCount = 0;
            if (typeof followersJson.followerCount === 'number') {
                followerCount = followersJson.followerCount;
            } else if (typeof followersJson.count === 'number') {
                followerCount = followersJson.count;
            } else if (followersJson.data && typeof followersJson.data.count === 'number') {
                followerCount = followersJson.data.count;
            } else if (typeof followersJson === 'number') {
                followerCount = followersJson;
            }

            // Update the stat card
            const subscriberElement = document.getElementById('stat-subscribers');
            if (subscriberElement) {
                subscriberElement.textContent = followerCount || 0;
            }

            console.log('Follower stats loaded:', followerCount);
        } catch (err) {
            console.error('Follower stats fetch error', err);
        }
    };

    // --- 2. CHARGEMENT DES PUBLICATIONS (Optimisé + filtrage par organisation) ---
    const cardContainer = document.getElementById('cards-container');
    const inputFiles = document.getElementById('new-image-file');
    const previewBox = document.getElementById('preview-gallery');
    let selectedFiles = [];

    // POSTS CACHE used for filtering and re-rendering without refetch
    let postsCache = [];
    // Current media filter: 'all' | 'image' | 'video'
    let mediaFilter = 'all';
    const POSTS_FETCH_LIMIT = 1000;

    const getPostViewsCount = (post) => {
        const rawValue = post?.views_count ?? post?.views ?? post?.__server?.views_count ?? 0;
        const numericValue = Number(rawValue);
        return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
    };

    const postMatchesFilter = (post) => {
        if (!post) return false;
        if (mediaFilter === 'all') return true;
        const medias = Array.isArray(post.medias) ? post.medias : [];
        if (mediaFilter === 'image') return medias.some((m) => normalizeMediaType(m?.type) === 'image');
        if (mediaFilter === 'video') return medias.some((m) => normalizeMediaType(m?.type) === 'video');
        return true;
    };

    const renderPosts = (posts) => {
        if (!cardContainer) return;
        cardContainer.innerHTML = '';
        (posts || []).filter(postMatchesFilter).forEach((post) => renderCard(post));
    };

    const updateTotalViewsStat = (posts = postsCache) => {
        const viewsElement = document.getElementById('stat-total-views');
        if (!viewsElement) return;

        const totalViews = (Array.isArray(posts) ? posts : []).reduce((sum, post) => {
            return sum + getPostViewsCount(post);
        }, 0);

        viewsElement.textContent = totalViews.toLocaleString('fr-FR');
    };

    const loadTotalViewsStat = async () => {
        const token = getToken();
        const { role: sessionRole } = getSessionInfo();
        const orgType = normalizeOrgRole(sessionRole);
        const organizationId = getOrganizationIdCandidates()[0] || '';

        if (!token || !orgType || !organizationId) {
            return;
        }

        try {
            const endpoint = `${CONTENT_API}/stats/organization/views-total?organization_id=${encodeURIComponent(organizationId)}&organization_type=${encodeURIComponent(orgType)}`;
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                }
            });

            if (!response.ok) {
                debugWarn('Total views stats fetch failed', { status: response.status });
                return;
            }

            const json = await response.json().catch(() => null);
            const totalViews =
                Number(json?.data?.total_views ?? json?.total_views ?? NaN);

            if (!Number.isFinite(totalViews)) {
                return;
            }

            const viewsElement = document.getElementById('stat-total-views');
            if (viewsElement) {
                viewsElement.textContent = totalViews.toLocaleString('fr-FR');
            }
        } catch (error) {
            // CORS errors are a backend configuration issue, not a client error
            if (String(error).includes('Failed to fetch')) {
                console.warn('⚠️ Content Service Unavailable: Backend CORS error - needs configuration. Falling back to cached data.');
            } else {
                debugWarn('Total views stats fetch error', error);
            }
        }
    };

    const applyPostsCache = (posts) => {
        postsCache = Array.isArray(posts) ? posts : [];
        updateTotalViewsStat(postsCache);
        createMediaFilterBar();
        renderPosts(postsCache);
        // Load comments for posts that don't have them
        postsCache.forEach(post => {
            if (!post.comments || post.comments.length === 0) {
                loadCommentsForPost(post).then(() => {
                    const commentCounter = document.querySelector(`.project-card[data-id="${post.id}"] .comment-counter-card`);
                    if (commentCounter) commentCounter.innerText = countCommentsRecursive(post.comments);
                });
            }
        });
    };

    // Create media filter UI (Tous/Photos/Vidéos) above card container
    const createMediaFilterBar = () => {
        try {
            if (!cardContainer) return;
            // avoid creating twice
            if (document.getElementById('media-filter-bar')) return;
            const bar = document.createElement('div');
            bar.id = 'media-filter-bar';
            bar.className = 'media-filter-bar';
            bar.style.display = 'flex';
            bar.style.gap = '8px';
            bar.style.margin = '12px auto 14px';
            bar.style.alignItems = 'center';
            bar.style.width = '100%';
            bar.style.maxWidth = '680px';

            const btnStyle = (active) => `padding:6px 12px; border-radius:18px; border: none; cursor:pointer; font-family:inherit; font-weight:600; ${active ? 'background:#1877f2; color:white;' : 'background:transparent; color:#050505; box-shadow:inset 0 0 0 1px rgba(0,0,0,0.08);'}`;

            const allBtn = document.createElement('button');
            allBtn.id = 'filter-all-btn';
            allBtn.innerText = 'Tous';
            allBtn.style.cssText = btnStyle(true);

            const photosBtn = document.createElement('button');
            photosBtn.id = 'filter-photos-btn';
            photosBtn.innerText = 'Photos';
            photosBtn.style.cssText = btnStyle(false);

            const videosBtn = document.createElement('button');
            videosBtn.id = 'filter-videos-btn';
            videosBtn.innerText = 'Vidéos';
            videosBtn.style.cssText = btnStyle(false);

            const setActive = (which) => {
                mediaFilter = which;
                allBtn.style.cssText = btnStyle(which === 'all');
                photosBtn.style.cssText = btnStyle(which === 'image');
                videosBtn.style.cssText = btnStyle(which === 'video');
                renderPosts(postsCache);
            };

            allBtn.onclick = () => setActive('all');
            photosBtn.onclick = () => setActive('image');
            videosBtn.onclick = () => setActive('video');

            bar.appendChild(allBtn);
            bar.appendChild(photosBtn);
            bar.appendChild(videosBtn);

            // insert filter bar before card container
            cardContainer.parentNode && cardContainer.parentNode.insertBefore(bar, cardContainer);
        } catch (e) { console.warn('Failed to create media filter bar', e); }
    };

    // Helper: validate URL-ish strings
    const isValidUrl = (u) => typeof u === 'string' && (u.startsWith('http') || u.startsWith('data:') || u.startsWith('blob:'));

    const DEBUG_MODE = Boolean(window.UNIVERSEARCH_DEBUG || localStorage.getItem('universearch_debug') === '1');
    const debugLog = (...args) => { if (DEBUG_MODE) console.log('[univ]', ...args); };
    const debugWarn = (...args) => { if (DEBUG_MODE) console.warn('[univ]', ...args); };

    const escapeHTML = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const safeText = (value, fallback = '') => {
        if (value === null || value === undefined) return fallback;
        if (typeof value === 'string') return value;
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        return fallback;
    };

    const normalizeMediaType = (type) => {
        const normalized = safeText(type).toLowerCase();
        return normalized === 'video' ? 'video' : 'image';
    };

    const countCommentsRecursive = (comments) => {
        if (!Array.isArray(comments)) return 0;
        return comments.reduce((total, comment) => total + 1 + countCommentsRecursive(comment.replies), 0);
    };

    const findCommentRecursive = (comments, commentId) => {
        if (!Array.isArray(comments) || !commentId) return null;
        for (const comment of comments) {
            if (String(comment.id) === String(commentId)) return comment;
            const nested = findCommentRecursive(comment.replies, commentId);
            if (nested) return nested;
        }
        return null;
    };

    const buildCommentTree = (rawComments) => {
        if (!Array.isArray(rawComments)) return [];
        const commentMap = new Map();
        const roots = [];

        rawComments.forEach((comment) => {
            const normalized = {
                id: safeText(comment.id, `${Date.now()}-${Math.random()}`),
                text: safeText(comment.contenu || comment.text),
                likes: Number(comment.likes || 0),
                isLiked: Boolean(comment.isLiked),
                parent_comment_id: comment.parent_comment_id ? String(comment.parent_comment_id) : null,
                user: comment.user || null,
                author: safeText(comment.author || comment.user?.name || comment.user?.sigle, ''),
                replies: [],
            };
            commentMap.set(String(normalized.id), normalized);
        });

        commentMap.forEach((comment) => {
            if (comment.parent_comment_id) {
                const parent = commentMap.get(String(comment.parent_comment_id));
                if (parent) {
                    parent.replies.push(comment);
                    return;
                }
            }
            roots.push(comment);
        });

        return roots;
    };

    const normalizePost = (post) => {
        if (!post || typeof post !== 'object') return null;
        const normalizedComments = Array.isArray(post.comments) ? post.comments : [];
        const medias = Array.isArray(post.medias)
            ? post.medias.filter(Boolean).map((media) => ({
                url: safeText(media?.url),
                type: normalizeMediaType(media?.type),
                previewUrl: media?.previewUrl || null,
                storagePath: media?.storagePath || null,
            })).filter((media) => Boolean(media.url))
            : [];

        return {
            ...post,
            id: safeText(post.id, `${Date.now()}-${Math.random()}`),
            title: safeText(post.title),
            desc: safeText(post.desc),
            medias,
            comments: normalizedComments,
            likes: Number(post.likes_count ?? post.likes ?? 0),
            likes_count: Number(post.likes_count ?? post.likes ?? 0),
            views: getPostViewsCount(post),
            views_count: getPostViewsCount(post),
            isLiked: Boolean(post.isLiked),
        };
    };

    const persistPostsCache = () => {
        try {
            savePostsSafely(postsCache);
        } catch (e) {
            debugWarn('persistPostsCache failed', e);
        }
    };

    const upsertPostInCache = (post) => {
        const normalized = normalizePost(post);
        if (!normalized) return null;
        const index = postsCache.findIndex((item) => String(item.id) === String(normalized.id));
        if (index >= 0) {
            postsCache[index] = { ...postsCache[index], ...normalized };
        } else {
            postsCache.unshift(normalized);
        }
        persistPostsCache();
        updateTotalViewsStat(postsCache);
        return postsCache.find((item) => String(item.id) === String(normalized.id)) || normalized;
    };

    const removePostFromCache = (postId) => {
        postsCache = postsCache.filter((item) => String(item.id) !== String(postId));
        persistPostsCache();
        updateTotalViewsStat(postsCache);
    };

    const apiRequest = async (path, options = {}) => {
        const token = getToken();
        const headers = {
            ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.headers || {}),
        };

        const response = await fetch(`${CONTENT_API}${path}`, {
            ...options,
            headers,
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok) {
            const error = new Error(payload?.error || payload?.message || `API ${response.status}`);
            error.status = response.status;
            error.payload = payload;
            throw error;
        }
        return payload;
    };

    const loadCommentsForPost = async (post) => {
        try {
            const json = await apiRequest(`/posts/${post.id}/comments`, { method: 'GET' });
            const raw = (json && (json.data || json)) || [];
            post.comments = buildCommentTree(raw);
            savePostUpdate(post);
        } catch (e) {
            console.warn('Error loading comments for post', post.id, e);
        }
    };

    const renderUploadPreview = (files) => {
        if (!previewBox) return;
        previewBox.innerHTML = '';
        files.forEach((file) => {
            const objectUrl = URL.createObjectURL(file);
            const isVideo = Boolean(file.type && file.type.startsWith('video/'));
            const element = document.createElement(isVideo ? 'video' : 'img');
            element.src = objectUrl;
            element.style.width = '50px';
            element.style.height = '50px';
            element.style.objectFit = 'cover';
            element.style.borderRadius = '5px';
            element.style.border = '1px solid #ddd';
            if (isVideo) {
                element.muted = true;
                element.playsInline = true;
            }
            element.addEventListener('load', () => URL.revokeObjectURL(objectUrl), { once: true });
            element.addEventListener('error', () => URL.revokeObjectURL(objectUrl), { once: true });
            previewBox.appendChild(element);
        });
    };

    const syncPostLike = async (post, shouldLike) => {
        try {
            await apiRequest(`/posts/${post.id}/likes`, {
                method: shouldLike ? 'POST' : 'DELETE',
            });
            return true;
        } catch (error) {
            debugWarn('Like sync failed, keeping local fallback', error);
            return false;
        }
    };

    // --- 2.1. LOAD POSTS WITH ORG FILTERING (MODIFIED) ---
    const legacyLoadPosts = async () => {
        const token = getToken();
        let postsList = [];
        const { id: sessionUserId, role: sessionRole } = getSessionInfo();

        console.log('=== loadPosts DEBUG ===');
        console.log('Session Info:', { sessionUserId, sessionRole });

        if (token) {
            try {
                // Normalize role
                const normalizedRole = (sessionRole || '').toLowerCase().replace('-', '_');
                const orgType = 
                    normalizedRole === 'universite' || normalizedRole === 'université' ? 'universite' :
                    normalizedRole === 'centre_formation' || normalizedRole === 'centre' ? 'centre_formation' :
                    null;

                // Use new /feed/organization endpoint with organization_id and organization_type
                let url = `${CONTENT_API}/posts`;
                
                if (orgType && sessionUserId) {
                    // NEW: Use /feed/organization endpoint for isolation
                    url = `${CONTENT_API}/feed/organization?organization_id=${encodeURIComponent(sessionUserId)}&organization_type=${encodeURIComponent(orgType)}&limit=${POSTS_FETCH_LIMIT}`;
                    console.log('🔍 Using /feed/organization endpoint:', url);
                } else {
                    console.log('⚠️ Fallback to /posts (orgType or sessionUserId missing):', { orgType, sessionUserId });
                }

                const res = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                });

                console.log('📡 Response status:', res.status);

                if (res.ok) {
                    const json = await res.json().catch((err) => {
                        console.error('❌ JSON parse error:', err);
                        return null;
                    });

                    console.log('📦 Raw response:', json);

                    // Handle both structures: { data: [...], pagination: ... } and [...]
                    let serverData = null;
                    
                    if (json && json.data) {
                        serverData = json.data;
                        console.log('✅ Using json.data structure');
                    } else if (Array.isArray(json)) {
                        serverData = json;
                        console.log('✅ Using array structure');
                    } else if (json && json.success === false) {
                        console.error('❌ API error:', json.error);
                        serverData = [];
                    } else {
                        console.warn('⚠️ Unexpected response structure');
                        serverData = [];
                    }

                    console.log(`📊 Found ${serverData.length} posts`);

                    if (Array.isArray(serverData) && serverData.length > 0) {

                        // No need for client-side filtering if using /feed/organization
                        // (it's already filtered server-side)
                        // But keep this for backward compatibility with /posts endpoint
                        try {
                            if (url.includes('/posts') && !url.includes('/feed')) {
                                // OLD endpoint: apply client-side filter
                                console.log('Applying client-side filter for /posts endpoint');
                                if (sessionRole === 'universite' || sessionRole === 'université') {
                                    serverData = serverData.filter(p => (String(p.author_type).toLowerCase() === 'universite' || String(p.author_type).toLowerCase() === 'université') && String(p.author_id) === String(sessionUserId));
                                } else if (sessionRole === 'centre' || sessionRole === 'centre_formation' || sessionRole === 'centre-formation') {
                                    serverData = serverData.filter(p => String(p.author_type).toLowerCase() === 'centre_formation' && String(p.author_id) === String(sessionUserId));
                                }
                            }
                        } catch (filterErr) {
                            console.warn('Post filtering error', filterErr);
                        }

                        // Map server posts to client shape
                        postsList = serverData.map(p => {
                            console.log('Mapping post:', { id: p.id, titre: p.titre, author_id: p.author_id });
                            const createdAt = p.date_creation || p.created_at || p.createdAt || null;
                            const timestamp = createdAt ? Date.parse(createdAt) : Date.now();
                            const medias = (p.media_url && isValidUrl(p.media_url)) ? [{ url: p.media_url, type: p.media_type || 'image' }] : [];
                            // Ensure id uniqueness/consistency: use server id if present, else timestamp
                            const clientId = p.id ? String(p.id) : String(timestamp);
                            return {
                                id: clientId,
                                title: p.titre || p.title || '',
                                desc: p.description || p.desc || '',
                                medias,
                                comments: p.comments || [],
                                likes: p.likes_count || p.likes || 0,
                                views: p.views_count || p.views || 0,
                                views_count: p.views_count || p.views || 0,
                                isLiked: false,
                                // keep raw server post if needed later
                                __server: p
                            };
                        }).map(normalizePost).filter(Boolean);

                        console.log(`✅ Loaded ${postsList.length} posts successfully`);

                        // persist for offline
                        try { savePostsSafely(postsList); } catch (e) { console.warn('Storage error:', e); }
                    } else {
                        console.warn('⚠️ serverData is empty or not array');
                    }
                } else {
                    console.error('Failed to fetch posts, status', res.status, await res.text());
                }
            } catch (err) {
                console.error('❌ Posts fetch error:', err);
            }
        } else {
            console.warn('⚠️ No token found');
        }

        // If no posts from server, fallback to local cache
        if (!postsList || postsList.length === 0) {
            try {
                postsList = loadStoredPosts();
                console.log('📦 Using cached posts:', postsList.length);
            } catch (e) {
                console.warn('Cache error:', e);
                postsList = [];
            }
        }

        // Render using postsCache and filter UI
        applyPostsCache(postsList || []);
        console.log('🎨 Rendering', postsCache.length, 'posts');
        createMediaFilterBar();
        renderPosts(postsCache);
    };

    const loadPosts = async () => {
        const token = getToken();
        let postsList = [];
        const { id: sessionUserId, role: sessionRole } = getSessionInfo();
        const orgType = normalizeOrgRole(sessionRole);
        const organizationIdCandidates = getOrganizationIdCandidates();

        debugLog('loadPosts.session', { sessionUserId, sessionRole, orgType, organizationIdCandidates });

        const mapServerPostToClient = (p) => {
            const createdAt = p?.date_creation || p?.created_at || p?.createdAt || null;
            const timestamp = createdAt ? Date.parse(createdAt) : Date.now();
            const medias = (p?.media_url && isValidUrl(p.media_url))
                ? [{ url: p.media_url, type: p.media_type || 'image' }]
                : [];

            return normalizePost({
                id: p?.id ? String(p.id) : String(timestamp),
                title: p?.titre || p?.title || '',
                desc: p?.description || p?.desc || '',
                medias,
                comments: p?.comments || [],
                likes: p?.likes_count || p?.likes || 0,
                views: p?.views_count || p?.views || 0,
                views_count: p?.views_count || p?.views || 0,
                isLiked: false,
                __server: p || null
            });
        };

        const extractResponseData = (json) => {
            if (Array.isArray(json)) return json;
            if (json && Array.isArray(json.data)) return json.data;
            if (json && json.success === false) {
                debugWarn('Posts API returned error payload', json.error || json);
                return [];
            }
            return [];
        };

        const organizationCacheMatches = (post) => {
            if (!orgType || organizationIdCandidates.length === 0) return true;
            const ownerId = String(post?.__server?.author_id || post?.author_id || '').trim();
            if (!ownerId) return true;
            return organizationIdCandidates.includes(ownerId);
        };

        const organizationServerMatches = (post) => {
            if (!post || typeof post !== 'object') return false;

            const authorId = String(post.author_id || '').trim();
            const authorType = normalizeOrgRole(post.author_type || post.org_type || '');

            if (orgType && authorType && authorType !== orgType) {
                return false;
            }

            if (organizationIdCandidates.length === 0) {
                return true;
            }

            return organizationIdCandidates.includes(authorId);
        };

        if (token && orgType) {
            const endpointCandidates = [
                ...organizationIdCandidates.flatMap((organizationId) => ([
                    `${CONTENT_API}/feed/organization?organization_id=${encodeURIComponent(organizationId)}&organization_type=${encodeURIComponent(orgType)}&limit=${POSTS_FETCH_LIMIT}`,
                    `${CONTENT_API}/posts/entity?entity_id=${encodeURIComponent(organizationId)}&entity_type=${encodeURIComponent(orgType === 'centre_formation' ? 'centre' : orgType)}&limit=${POSTS_FETCH_LIMIT}`
                ])),
                `${CONTENT_API}/posts?limit=${POSTS_FETCH_LIMIT}`
            ];

            for (const url of endpointCandidates) {
                try {
                    debugLog('loadPosts.fetch', url);
                    const res = await fetch(url, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            ...getAuthHeaders()
                        }
                    });

                    if (!res.ok) {
                        debugWarn('Filtered posts fetch failed', { url, status: res.status });
                        continue;
                    }

                    const json = await res.json().catch(() => null);
                    let serverData = extractResponseData(json);

                    if (url.includes('/posts?')) {
                        serverData = serverData.filter((post) => organizationServerMatches(post));
                    }

                    postsList = serverData.map(mapServerPostToClient).filter(Boolean);
                    if (postsList.length > 0) {
                        savePostsSafely(postsList);
                        break;
                    }
                } catch (err) {
                    // CORS errors are a backend configuration issue - silently continue to fallback
                    if (!String(err).includes('Failed to fetch')) {
                        debugWarn('Filtered posts fetch error', { url, err });
                    }
                }
            }
            
            // If all endpoints failed, log a single helpful warning
            if (!postsList || postsList.length === 0) {
                const hadNetworkError = endpointCandidates.length > 0;
                if (hadNetworkError) {
                    console.warn('ℹ️ Content Service Unavailable (CORS/Network): Dashboard will use cached publications. Backend configuration needed.');
                }
            }
        } else if (token) {
            debugWarn('Skipping remote posts fetch because session identity is incomplete', {
                sessionUserId,
                sessionRole,
                orgType
            });
        }

        if (!postsList || postsList.length === 0) {
            try {
                postsList = loadStoredPosts().filter((post) => {
                    return organizationCacheMatches(post);
                });
                debugLog('loadPosts.cacheFallback', { count: postsList.length });
            } catch (e) {
                debugWarn('Cache error', e);
                postsList = [];
            }
        }

        applyPostsCache(postsList || []);
    };

    const bootstrapDashboard = async () => {
        try {
            await initProfile();
        } catch (e) {
            console.warn('initProfile bootstrap failed', e);
        }

        try {
            await loadFollowerStats();
        } catch (e) {
            console.warn('loadFollowerStats bootstrap failed', e);
        }

        try {
            await loadPosts();
        } catch (e) {
            console.warn('loadPosts bootstrap failed', e);
        }

        try {
            await loadTotalViewsStat();
        } catch (e) {
            console.warn('loadTotalViewsStat bootstrap failed', e);
        }
    };

    // load dashboard data only after profile/session has been refreshed
    bootstrapDashboard();

    // --- 3. SYSTEME DE PUBLICATIONS UI & HELPERS ---
    // GESTION DU CLIC SUR UNE CARTE (Délégation corrigée) - FIX: ensure cardContainer exists before attaching listener
    if (cardContainer) {
        cardContainer.addEventListener('click', (e) => {
            const card = e.target.closest('.project-card');
            const deleteBtn = e.target.closest('.delete-btn');

            // Si on clique sur la carte mais PAS sur le bouton supprimer
            if (card && !deleteBtn) {
                const postId = card.getAttribute('data-id');
                try {
                    const posts = loadStoredPosts();
                    const post = posts.find(p => String(p.id) === String(postId));
                    if (post) openPublicationModal(post);
                } catch (err) {
                    console.warn('Failed to open post modal', err);
                }
            }
        });
    }

    if (inputFiles) {
        inputFiles.addEventListener('change', (e) => {
            selectedFiles = Array.from(e.target.files || []);
            renderUploadPreview(selectedFiles);
            const dz = document.getElementById('dropzone-prompt');
            if (dz) dz.style.display = selectedFiles.length > 0 ? 'none' : 'block';
        });
    }

    function renderCard(rawPost) {
        const post = normalizePost(rawPost);
        if (!post || !cardContainer || !postMatchesFilter(post)) return null;
        const existingCard = cardContainer.querySelector(`.project-card[data-id="${post.id}"]`);
        if (existingCard) existingCard.remove();

        const card = document.createElement('div');
        card.className = "project-card";
        card.setAttribute('data-id', post.id);

        const mediasArr = Array.isArray(post.medias) ? post.medias : [];
        const firstMedia = mediasArr.length ? mediasArr[0] : null;
        const mediaCount = mediasArr.length;
        const totalComments = countCommentsRecursive(post.comments);
        const heartColor = post.isLiked ? 'red' : 'inherit';
        const postLikeCount = Number(post.likes_count ?? post.likes ?? 0);
        const postViewsCount = getPostViewsCount(post);

        card.innerHTML = `
            <div class="card-image-placeholder" style="position:relative; background:#000;">
                <button class="delete-btn" title="Supprimer"><i class="fa-solid fa-trash"></i></button>
                ${firstMedia ? (firstMedia.type === 'video' 
                    ? `<video src="${firstMedia.url}" style="width:100%; height:100%; object-fit:cover;"></video><i class="fa-solid fa-circle-play card-video-play"></i>` 
                    : `<img src="${firstMedia.url}" style="width:100%; height:100%; object-fit:cover;">`) 
                    : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#94a3b8; background:#f1f5f9;">Aucun média</div>`}
                ${mediaCount > 1 ? `<span class="card-media-count">+${mediaCount-1}</span>` : ''}
            </div>
            <div class="pc-content">
                <h5>${escapeHTML(safeText(post.title).toUpperCase())}</h5>
                <p class="pc-meta">${formatExactTime(getPostTimestamp(post))}</p>
                <p class="card-desc">${escapeHTML(safeText(post.desc).substring(0, 200))}</p>
            </div>
            <div class="pc-engagement">
                <span class="views-stat"><i class="fa-regular fa-eye"></i> <span class="view-counter-card">${postViewsCount}</span></span>
                <span><i class="fa-solid fa-heart" style="color:${heartColor}"></i> <span class="like-counter-card">${postLikeCount}</span></span>
                <span><i class="fa-solid fa-comment"></i> <span class="comment-counter-card">${totalComments}</span></span>
            </div>
        `;

        // ensure "Voir plus / Voir moins" on long descriptions (MODIFIED)
        try {
            const descEl = card.querySelector('.card-desc');
            if (descEl) handleResizableText(descEl, 100);
        } catch (e) {
            console.warn('Failed to attach resizable text', e);
        }

        const deleteBtn = card.querySelector('.delete-btn');
        if (deleteBtn) {
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                if (confirm("Supprimer cette publication ?")) {
                    try {
                        removePostFromCache(post.id);
                        card.remove();
                    } catch (err) {
                        console.warn('Failed to delete post', err);
                        try { card.remove(); } catch (e) {}
                    }
                }
            };
        }

        // prepend for newest first
        cardContainer && cardContainer.prepend(card);
        return card;
    }

    // --- 4. MODALE DE LECTURE & COMMENTAIRES ---
    const openPublicationModal = async (post) => {
        const pubModal = document.getElementById('publication-modal');
        const displayLeft = document.querySelector('.modal-left');
        let currentIdx = 0;
        let replyingToId = null;
        let currentMediaEl = null;

        // Fullscreen helper function
        const openFullscreen = (mediaEl) => {
            const overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.background = 'rgba(0,0,0,0.95)';
            overlay.style.zIndex = '10000';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.cursor = 'pointer';

            if (mediaEl.tagName === 'VIDEO') {
                const video = document.createElement('video');
                video.src = mediaEl.src;
                video.controls = true;
                video.autoplay = true;
                video.style.maxWidth = '100%';
                video.style.maxHeight = '100%';
                video.style.width = 'auto';
                video.style.height = 'auto';
                video.style.cursor = 'default';
                overlay.appendChild(video);
            } else {
                const img = document.createElement('img');
                img.src = mediaEl.src;
                img.style.maxWidth = '100%';
                img.style.maxHeight = '100%';
                img.style.width = 'auto';
                img.style.height = 'auto';
                img.style.cursor = 'default';
                overlay.appendChild(img);
            }

            // Close button
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '&times;';
            closeBtn.style.position = 'absolute';
            closeBtn.style.top = '20px';
            closeBtn.style.right = '30px';
            closeBtn.style.fontSize = '40px';
            closeBtn.style.color = 'white';
            closeBtn.style.background = 'transparent';
            closeBtn.style.border = 'none';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.zIndex = '10001';
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                overlay.remove();
            };
            overlay.appendChild(closeBtn);

            // Close on overlay click (but not on media click)
            overlay.onclick = (e) => {
                if (e.target === overlay) overlay.remove();
            };

            // Close on Escape key
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    overlay.remove();
                    document.removeEventListener('keydown', handleEscape);
                }
            };
            document.addEventListener('keydown', handleEscape);

            document.body.appendChild(overlay);
        };

        const showMedia = async (idx) => {
            // clear previous content and pause any playing video
            if (currentMediaEl && currentMediaEl.tagName === 'VIDEO') {
                try { currentMediaEl.pause(); } catch (e) { /* ignore */ }
            }
            if (displayLeft) displayLeft.innerHTML = "";
            const m = post.medias[idx];

            let el;
            console.debug('openPublicationModal.showMedia', idx, m);
            if (m && m.type === 'video') {
                // If the video URL is a Supabase public storage path that may require a signed URL,
                // request a temporary signed URL from the content-service before assigning src.
                let useUrl = m.url;
                try {
                    const token = getToken();
                    // Detect public storage path: /storage/v1/object/public/{bucket}/{path}
                    const maybe = (() => {
                        try { return new URL(m.url); } catch (e) { return null; }
                    })();
                    if (maybe && maybe.pathname && maybe.pathname.includes('/storage/v1/object/public/')) {
                        // extract bucket and path
                        const parts = maybe.pathname.split('/storage/v1/object/public/');
                        if (parts && parts[1]) {
                            const after = parts[1];
                            const idxSlash = after.indexOf('/');
                            const bucket = after.substring(0, idxSlash);
                            const path = after.substring(idxSlash + 1);
                            // Request signed URL from content-service
                            try {
                                const signedRes = await fetch(`${CONTENT_API}/signed-url`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': token ? `Bearer ${token}` : ''
                                    },
                                    body: JSON.stringify({ bucket, path, expires: 60 })
                                });
                                if (signedRes && signedRes.ok) {
                                    const sj = await signedRes.json().catch(() => null);
                                    if (sj && sj.success && sj.signedUrl) {
                                        useUrl = sj.signedUrl;
                                        console.debug('Using signed URL for video playback', useUrl);
                                    } else {
                                        console.warn('Signed URL request succeeded but no url returned', sj);
                                    }
                                } else {
                                    console.warn('Signed URL request failed', signedRes && signedRes.status);
                                }
                            } catch (e) {
                                console.warn('Signed URL fetch error', e);
                            }
                        }
                    }

                } catch (e) {
                    console.warn('Error while attempting to obtain signed URL', e);
                }

                el = document.createElement('video');
                el.src = useUrl;
                el.className = "modal-img";
                el.style.width = '100%';
                el.style.height = '100%';
                el.style.objectFit = 'cover';
                el.style.cursor = 'pointer';
                el.controls = true;
                el.playsInline = true;
                el.crossOrigin = 'anonymous';
                el.preload = 'metadata';
                // Try a muted autoplay to improve UX where allowed; keep controls so user can play/pause.
                el.muted = true;
                // Toggle play/pause on click for convenience
                el.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    if (el.paused) {
                        el.play().catch(() => {});
                    } else {
                        el.pause();
                    }
                });
                // Double-click to fullscreen
                el.addEventListener('dblclick', (ev) => {
                    ev.stopPropagation();
                    openFullscreen(el);
                });
                // Debug events
                el.addEventListener('error', async (ev) => {
                    console.error('Video element error', ev, 'currentSrc:', el.currentSrc);
                    // Attempt to fetch the resource as a blob and fall back to an object URL
                    try {
                        const fetchUrl = el.currentSrc || el.src || m.url;
                        const resp = await fetch(fetchUrl, {
                            method: 'GET',
                            headers: {
                                ...getAuthHeaders(),
                            }
                        });
                        if (resp && resp.ok) {
                            const blob = await resp.blob();
                            const blobUrl = URL.createObjectURL(blob);
                            console.debug('Fetched video as blob, switching src to blob URL', blobUrl);
                            try { el.src = blobUrl; el.load(); el.play().catch(() => {}); } catch (e) { console.warn('Failed to play after blob fallback', e); }
                            return;
                        } else {
                            console.warn('Blob fetch failed', resp && resp.status);
                        }
                    } catch (fetchErr) {
                        console.error('Fetch fallback failed for video', fetchErr);
                    }
                    // Final user-visible message for debugging
                    try { alert('Impossible de charger la vidéo. Vérifiez la disponibilité du fichier sur le storage.'); } catch (e) {}
                });
                el.addEventListener('playing', () => { console.debug('Video playing', el.currentSrc || el.src); });
                el.addEventListener('stalled', () => { console.warn('Video stalled', el.currentSrc || el.src); });
                // When the video starts playing, attempt to unmute after a short delay so audible playback occurs after user gesture
                el.addEventListener('play', function handleFirstPlay() {
                    setTimeout(() => { try { el.muted = false; } catch (e) {} }, 300);
                    el.removeEventListener('play', handleFirstPlay);
                });
                // attempt to play (may fail if browser blocks autoplay)
                setTimeout(() => { el.play().catch(() => {}); }, 50);
            } else {
                el = document.createElement('img');
                el.src = (m && m.url) || '';
                el.className = "modal-img";
                el.style.width = '100%';
                el.style.height = '100%';
                el.style.objectFit = 'cover';
                el.style.cursor = 'pointer';
                // Click to fullscreen for images
                el.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    openFullscreen(el);
                });
            }

            // Ensure container is positioned so overlay can be absolute
            try { displayLeft.style.position = displayLeft.style.position || 'relative'; } catch (e) {}

            // If this is a video, add a centered play overlay to ensure user can start playback
            let overlay = null;
            if (m && m.type === 'video') {
                overlay = document.createElement('div');
                overlay.className = 'video-play-overlay';
                overlay.style.position = 'absolute';
                overlay.style.top = '50%';
                overlay.style.left = '50%';
                overlay.style.transform = 'translate(-50%,-50%)';
                overlay.style.zIndex = '50';
                overlay.style.cursor = 'pointer';
                overlay.style.width = '64px';
                overlay.style.height = '64px';
                overlay.style.display = 'flex';
                overlay.style.alignItems = 'center';
                overlay.style.justifyContent = 'center';
                overlay.style.background = 'rgba(0,0,0,0.45)';
                overlay.style.borderRadius = '50%';
                overlay.style.color = 'white';
                overlay.style.fontSize = '24px';
                overlay.innerHTML = '<i class="fa-solid fa-circle-play"></i>';
                overlay.onclick = (ev) => { ev.stopPropagation(); el.play().catch(() => {}); };
            }

            displayLeft.appendChild(el);
            if (overlay) displayLeft.appendChild(overlay);
            currentMediaEl = el;

            if (overlay && el) {
                el.addEventListener('play', () => { try { overlay.remove(); } catch (e) {} });
                el.addEventListener('pause', () => { try { if (!document.body.contains(overlay)) displayLeft.appendChild(overlay); } catch (e) {} });
            }

            if (post.medias.length > 1) {
                const nav = document.createElement('div');
                nav.className = "slider-controls";
                nav.innerHTML = `<button class="slider-arrow left"><i class="fa-solid fa-chevron-left"></i></button>
                                 <button class="slider-arrow right"><i class="fa-solid fa-chevron-right"></i></button>
                                 <div class="image-badge">${idx + 1} / ${post.medias.length}</div>`;

                nav.querySelector('.left').onclick = (e) => { e.stopPropagation(); currentIdx = (currentIdx > 0) ? currentIdx - 1 : post.medias.length - 1; showMedia(currentIdx); };
                nav.querySelector('.right').onclick = (e) => { e.stopPropagation(); currentIdx = (currentIdx < post.medias.length - 1) ? currentIdx + 1 : 0; showMedia(currentIdx); };
                displayLeft.appendChild(nav);
            }
        };

        const loadComments = async () => {
            try {
                debugLog('Loading comments for post:', post.id);
                const json = await apiRequest(`/posts/${post.id}/comments`, { method: 'GET' });
                const raw = (json && (json.data || json)) || [];
                post.comments = buildCommentTree(raw);
                savePostUpdate(post);
                renderComments();
                // Update card comment counter after loading comments
                const commentCounter = document.querySelector(`.project-card[data-id="${post.id}"] .comment-counter-card`);
                if (commentCounter) commentCounter.innerText = countCommentsRecursive(post.comments);
            } catch (e) {
                console.warn('Error loading comments', e);
            }
        };

        document.getElementById('modal-display-title').innerText = post.title;
        document.getElementById('modal-display-details').innerText = post.desc;
        document.getElementById('pub-date').innerText = formatExactTime(getPostTimestamp(post));

        const likeCountElem = document.getElementById('modal-like-count');
        const likeBtn = document.getElementById('modal-like-action');

        const getPostLikeCount = () => (typeof post.likes_count === 'number' ? post.likes_count : (typeof post.likes === 'number' ? post.likes : 0));
        const setPostLikeCount = (val) => {
            post.likes_count = val;
            post.likes = val; // keep legacy field in sync for other code paths
        };

        const updateLikeUI = () => {
            if (likeCountElem) likeCountElem.innerText = getPostLikeCount();
            if (likeBtn) {
                likeBtn.style.color = post.isLiked ? "red" : "inherit";
                likeBtn.innerHTML = post.isLiked ? '<i class="fa-solid fa-heart"></i>' : '<i class="fa-regular fa-heart"></i>';
            }
        };
        updateLikeUI();

        if (likeBtn) {
            likeBtn.onclick = async () => {
                const currentLikes = getPostLikeCount();
                const nextLiked = !post.isLiked;
                setPostLikeCount(Math.max(0, currentLikes + (nextLiked ? 1 : -1)));
                post.isLiked = nextLiked;
                updateLikeUI();
                const card = document.querySelector(`.project-card[data-id="${post.id}"]`);
                if (card) {
                    const likeCounter = card.querySelector('.like-counter-card');
                    if (likeCounter) likeCounter.innerText = getPostLikeCount();
                }
                savePostUpdate(post);
                const synced = await syncPostLike(post, nextLiked);
                if (!synced) debugWarn('Like not persisted remotely for post', post.id);
            };
        }

        const commentsContainer = document.getElementById('comments-container');
        const commentInput = document.getElementById('input-comment');
        const sendCommentBtn = document.getElementById('send-comment');
        const commentCountText = document.getElementById('comment-count-text');

        const createCommentHTML = (c, isReply = false) => {
            const div = document.createElement('div');
            div.style = isReply 
                ? "background:white; padding:8px; border-left: 2px solid #ccc; margin-left:20px; margin-top:5px; border-radius:0 8px 8px 0;" 
                : "background:#f8fafc; padding:10px; border-radius:8px; margin-bottom:10px; border:1px solid #e2e8f0;";
            
            const heartIcon = c.isLiked ? "fa-solid fa-heart" : "fa-regular fa-heart";
            const heartColor = c.isLiked ? "red" : "#94a3b8";

            // Get user display name
            const getUserDisplayName = (comment) => {
                if (comment.user && comment.user.name) {
                    // Use full name or sigle if available
                    return comment.user.name || comment.user.sigle || 'Utilisateur';
                }
                // Fallback to author field if it exists (legacy support)
                if (comment.author) {
                    return comment.author;
                }
                return "Anonyme";
            };

            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <div style="font-size:11px; color:#64748b; font-weight:bold;">
                            ${isReply ? '<i class="fa-solid fa-reply" style="transform:rotate(180deg); margin-right:4px;"></i>' : ''} ${getUserDisplayName(c)}
                            <span style="font-weight:normal; margin-left:5px;">${formatRelativeDate(Number(String(c.id).split('-')[0]) || Date.now())}</span>
                        </div>
                        <div style="font-size:13px; color:#334155; margin-top:4px;">${escapeHTML(safeText(c.text))}</div>
                    </div>
                </div>
                <div style="display:flex; gap:15px; margin-top:8px; font-size:11px; align-items:center;">
                    <span class="action-btn like-comment-btn" style="cursor:pointer; color:${heartColor}; display:flex; align-items:center; gap:4px;">
                        <i class="${heartIcon}"></i> ${c.likes || 0}
                    </span>
                    ${!isReply ? `<span class="action-btn reply-comment-btn" style="cursor:pointer; color:#2563eb; font-weight:600;">Répondre</span>` : ''}
                </div>
            `;

            const likeBtnC = div.querySelector('.like-comment-btn');
            likeBtnC.onclick = () => {
                c.isLiked = !c.isLiked;
                c.likes = (c.likes || 0) + (c.isLiked ? 1 : -1);
                savePostUpdate(post);
                renderComments();
            };

            if(!isReply) {
                const replyBtn = div.querySelector('.reply-comment-btn');
                replyBtn.onclick = () => {
                    replyingToId = c.id;
                    commentInput.placeholder = "Répondre au commentaire...";
                    commentInput.focus();
                    console.log('Replying to comment:', c.id);
                    let cancelBtn = document.getElementById('cancel-reply-btn');
                    if(!cancelBtn) {
                        cancelBtn = document.createElement('button');
                        cancelBtn.id = 'cancel-reply-btn';
                        cancelBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
                        cancelBtn.style = "background:#fee2e2; color:red; border:none; width:30px; height:30px; border-radius:50%; margin-left:10px; cursor:pointer;";
                        cancelBtn.onclick = () => {
                            replyingToId = null;
                            commentInput.placeholder = "Écrivez un commentaire...";
                            cancelBtn.remove();
                        };
                        document.querySelector('.comment-input-area').appendChild(cancelBtn);
                    }
                };
            }
            return div;
        };

        const renderComments = () => {
            commentsContainer.innerHTML = "";
            const totalComs = countCommentsRecursive(post.comments);

            if (!post.comments || post.comments.length === 0) {
                commentsContainer.innerHTML = "<div style='text-align:center; color:#999; padding:20px;'>Soyez le premier à commenter !</div>";
            } else {
                const appendRepliesRecursively = (replies, container, depth = 1) => {
                    replies.forEach((reply) => {
                        container.appendChild(createCommentHTML(reply, depth > 0));
                        if (Array.isArray(reply.replies) && reply.replies.length > 0) {
                            appendRepliesRecursively(reply.replies, container, depth + 1);
                        }
                    });
                };

                post.comments.forEach(c => {
                    const commentWrapper = document.createElement('div');
                    commentWrapper.appendChild(createCommentHTML(c, false));

                    if (c.replies && c.replies.length > 0) {
                        const repliesContainer = document.createElement('div');
                        repliesContainer.style.display = "block";
                        appendRepliesRecursively(c.replies, repliesContainer, 1);

                        const toggleBtn = document.createElement('div');
                        toggleBtn.style = "margin-left:30px; font-size:11px; color:#2563eb; cursor:pointer; font-weight:bold; margin-top:-5px; margin-bottom:10px;";
                        toggleBtn.innerHTML = `<i class="fa-solid fa-chevron-up"></i> Masquer les réponses`;

                        toggleBtn.onclick = () => {
                            const isHidden = repliesContainer.style.display === "none";
                            repliesContainer.style.display = isHidden ? "block" : "none";
                            toggleBtn.innerHTML = isHidden
                                ? `<i class="fa-solid fa-chevron-up"></i> Masquer les réponses`
                                : `<i class="fa-solid fa-chevron-down"></i> Voir les ${countCommentsRecursive(c.replies)} réponses`;
                        };

                        commentWrapper.appendChild(toggleBtn);
                        commentWrapper.appendChild(repliesContainer);
                    }
                    commentsContainer.appendChild(commentWrapper);
                });
            }
            commentCountText.innerText = `${totalComs} commentaires`;
        };

        sendCommentBtn.onclick = async () => {
            const text = commentInput.value.trim();
            if (!text) return;

            console.log('Sending comment, replyingToId:', replyingToId);

            const token = getToken();
            if (token) {
                try {
                    const body = { contenu: text };
                    if (replyingToId) {
                        body.parent_comment_id = replyingToId;
                        console.log('Sending reply to:', replyingToId);
                    }
                    await apiRequest(`/posts/${post.id}/comments`, {
                        method: 'POST',
                        body: JSON.stringify(body),
                    });
                    await loadComments();
                    commentInput.value = "";
                    replyingToId = null;
                    commentInput.placeholder = "Écrivez un commentaire...";
                    const cancelBtn = document.getElementById('cancel-reply-btn');
                    if (cancelBtn) cancelBtn.remove();
                    // Update card comment counter
                    const commentCounter = document.querySelector(`.project-card[data-id="${post.id}"] .comment-counter-card`);
                    if (commentCounter) commentCounter.innerText = countCommentsRecursive(post.comments);
                    return;
                } catch (err) {
                    console.warn('Error posting comment', err);
                }
            }

            // Fallback: store comment locally if backend isn't available or user isn't authenticated
            const newComment = {
                id: `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                text: text,
                likes: 0,
                isLiked: false,
                replies: []
            };

            if (replyingToId) {
                const parentComment = findCommentRecursive(post.comments, replyingToId);
                if (parentComment) {
                    if (!parentComment.replies) parentComment.replies = [];
                    parentComment.replies.push(newComment);
                }
                replyingToId = null;
                commentInput.placeholder = "Écrivez un commentaire...";
                const cancelBtn = document.getElementById('cancel-reply-btn');
                if (cancelBtn) cancelBtn.remove();
            } else {
                if (!post.comments) post.comments = [];
                post.comments.push(newComment);
            }

            savePostUpdate(post);
            commentInput.value = "";
            renderComments();
            // Update card comment counter
            const commentCounter = document.querySelector(`.project-card[data-id="${post.id}"] .comment-counter-card`);
            if (commentCounter) commentCounter.innerText = countCommentsRecursive(post.comments);
        };

        await loadComments();
        showMedia(0);
        // renderComments called after loading comments
        pubModal.classList.add('active');
    };

    const savePostUpdate = (updatedPost) => {
        try {
            upsertPostInCache(updatedPost);
        } catch (e) {
            console.warn('Failed to save post update', e);
        }
    };

    // --- 5. SOUMISSION NOUVELLE PUBLICATION (MODIFIED: robust upload fallback + local metadata save) ---
    const submitBtn = document.getElementById('submit-new-content');
    if (submitBtn) {
        submitBtn.onclick = async () => {
            const title = document.getElementById('new-title').value;
            const desc = document.getElementById('new-details').value;

            if(!title.trim()) return alert("Titre requis !");

            // Disable button and show in-progress state
            const originalBtnText = submitBtn.textContent || submitBtn.innerText || 'Publier';
            submitBtn.disabled = true;
            submitBtn.textContent = 'PUBLICATION EN COURS...';
            submitBtn.style.opacity = '0.6';
            submitBtn.style.cursor = 'not-allowed';

            // On ne convertit plus les fichiers en base64 — on garde seulement les métadonnées
            const medias = selectedFiles.map(file => ({
                file: file,
                type: file.type && file.type.startsWith && file.type.startsWith('video/') ? 'video' : 'image',
                previewUrl: URL.createObjectURL(file)
            }));

            try {

            // Attempt to POST to content-service. Fallback to localStorage on failure or when no token.
            // The content-service listens on port 3002 in this workspace to avoid conflicts.
            const token = getToken();
            let clientPost = null;

            if (token) {
                try {
                    const authorId = localStorage.getItem('userId') || (() => {
                        try { const s = JSON.parse(localStorage.getItem('softura_session')||'{}'); return s.userId || s.id || ''; } catch(e){return ''}
                    })();
                    const authorType = (localStorage.getItem('role') || '').toString().toLowerCase();


                    // Robust client-side upload: upload all selected files server-side and collect URLs
                    let mediaUrl = null; // first URL sent to server as legacy single-media field
                    let mediaType = medias[0]?.type || null;
                    let mediaUrls = []; // all returned URLs for client preview
                    let uploadFailed = false;

                    if (selectedFiles && selectedFiles.length > 0) {
                        try {
                            for (let i = 0; i < selectedFiles.length; i++) {
                                const file = selectedFiles[i];
                                const form = new FormData();
                                form.append('file', file, file.name || `upload_${i}.bin`);

                                const uploadRes = await fetch(`${CONTENT_API}/uploads`, {
                                    method: 'POST',
                                    headers: {
                                        'Authorization': `Bearer ${token}`
                                    },
                                    body: form
                                });

                                if (!uploadRes.ok) {
                                    const errTxt = await uploadRes.text().catch(() => '');
                                    console.error('Upload failed response:', uploadRes.status, errTxt);
                                    throw new Error('Upload failed: ' + (errTxt || uploadRes.status));
                                }

                                const uploadJson = await uploadRes.json().catch(() => null);
                                if (!uploadJson || !uploadJson.success) {
                                    console.error('Upload backend error:', uploadJson);
                                    throw new Error((uploadJson && uploadJson.error) || 'Upload failed');
                                }

                                const url = uploadJson.url;
                                if (!url) throw new Error('Upload succeeded but no URL returned');
                                mediaUrls.push(url);
                                // set first URL as mediaUrl for server compatibility
                                if (!mediaUrl) mediaUrl = url;
                            }

                            console.log('Server-side upload success, urls:', mediaUrls);
                        } catch (uploadErr) {
                            console.error('Server-side upload failed:', uploadErr);
                            uploadFailed = true;
                            mediaUrl = null;
                            mediaUrls = [];
                        }
                    }

                    // If upload failed but files were provided, save metadata locally and inform user (MODIFIED)
                    if (selectedFiles && selectedFiles.length > 0 && uploadFailed) {
                        showToast('Échec de l’upload des fichiers — la publication est sauvegardée localement (métadonnées uniquement).', 4000);
                        const newPost = {
                            id: `${Date.now()}-${Math.floor(Math.random()*10000)}`, // unique local id
                            title: title.trim(),
                            desc: desc.trim(),
                            medias: medias.map((media) => ({ url: media.previewUrl, type: media.type, previewUrl: media.previewUrl })),
                            comments: [],
                            likes: 0,
                            isLiked: false,
                            _pendingUpload: true // flag to indicate pending upload
                        };
                        try {
                            const posts = loadStoredPosts();
                            posts.push(newPost);
                            savePostsSafely(posts);
                        } catch (e) { console.warn('Failed to cache local post after upload failure', e); }
                        clientPost = newPost;
                    } else {
                        // Proceed to create post on server (if no file selected or upload succeeded)
                        const payload = {
                            titre: title.trim(),
                            description: desc.trim(),
                            media_url: mediaUrl,
                            media_type: mediaType
                        };

                        // Safety: if a file was selected but no mediaUrl was produced AND upload didn't fail flag (shouldn't happen), bail with message
                        if (selectedFiles && selectedFiles.length > 0 && !mediaUrl && !uploadFailed) {
                            console.error('File was provided but no media_url was produced. Aborting post creation.', { selectedFiles });
                            showToast('Échec inattendu: aucun URL obtenu après upload. Publication annulée.', 4000);
                            throw new Error('UploadMissingMediaUrl');
                        }

                        console.log("MEDIA_URL BEFORE POST:", mediaUrl);
                        console.log('Posting payload to content-service', payload);

                        const res = await fetch(`${CONTENT_API}/posts`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify(payload)
                        });

                        if (!res.ok) throw new Error('API response ' + res.status);

                        const json = await res.json().catch(() => null);
                        const serverPost = json && (json.data || json);

                        // Map server post to client shape used by renderCard
                        // Build client-side preview using serverPost media_url if present, otherwise use mediaUrls collected during upload
                        const previewUrls = (mediaUrls && mediaUrls.length > 0) ? mediaUrls : (serverPost?.media_url ? [serverPost.media_url] : []);
                        const filteredPreview = previewUrls.filter(u => isValidUrl(u));
                        clientPost = {
                            id: serverPost?.created_at ? String(Date.parse(serverPost.created_at)) : (serverPost?.id ? String(serverPost.id) : `${Date.now()}-${Math.floor(Math.random()*10000)}`),
                            title,
                            desc,
                            medias: filteredPreview.map(u => ({ url: u, type: serverPost?.media_type || medias[0]?.type || 'image' })),
                            comments: serverPost?.comments || [],
                            likes: serverPost?.likes_count || serverPost?.likes || 0,
                            isLiked: false
                        };
                        // Show success toast for server-backed publications
                        if (serverPost) showToast('Publication disponible', 3000);
                    }

                } catch (err) {
                    console.warn('Failed to post to content-service, falling back to local cache', err);
                    // If anything failed and we didn't already create a local post, create a local-only metadata post
                    if (!clientPost) {
                        const newPost = {
                            id: `${Date.now()}-${Math.floor(Math.random()*10000)}`,
                            title,
                            desc,
                            medias: medias.map((media) => ({ url: media.previewUrl, type: media.type, previewUrl: media.previewUrl })),
                            comments: [],
                            likes: 0,
                            isLiked: false
                        };
                        try {
                            const posts = loadStoredPosts();
                            posts.push(newPost);
                            savePostsSafely(posts);
                        } catch (e) { console.warn('Failed to cache fallback post locally', e); }
                        clientPost = newPost;
                        showToast('Publication sauvegardée localement (serveur indisponible).', 3000);
                    }
                }
            }

            // If no token or server failed earlier we already created a local post (clientPost). Ensure it's present
            if (!clientPost) {
                const newPost = {
                    id: `${Date.now()}-${Math.floor(Math.random()*10000)}`,
                    title,
                    desc,
                    medias: medias.map((media) => ({ url: media.previewUrl, type: media.type, previewUrl: media.previewUrl })),
                    comments: [],
                    likes: 0,
                    isLiked: false
                };
                try {
                    const posts = loadStoredPosts();
                    posts.push(newPost);
                    savePostsSafely(posts);
                } catch (e) {
                    try { sessionStorage.setItem(getPostsKey(), JSON.stringify([newPost])); } catch (e2) { /* ignore */ }
                }
                clientPost = newPost;
            } else {
                // Cache server-backed or client-created post locally as well for UI and offline fallback
                try {
                    const posts = loadStoredPosts();
                    posts.push(clientPost);
                    savePostsSafely(posts);
                } catch (e) { console.warn('Could not cache server post locally (storage full)', e); }
            }

            const persistedPost = upsertPostInCache(clientPost) || clientPost;
            renderCard(persistedPost);
            if (!postMatchesFilter(persistedPost)) renderPosts(postsCache);
            const addModal = document.getElementById('add-content-modal');
            if (addModal) addModal.classList.remove('active');
            const nt = document.getElementById('new-title'); if (nt) nt.value = "";
            const nd = document.getElementById('new-details'); if (nd) nd.value = "";
            if (previewBox) previewBox.innerHTML = "";
            selectedFiles = [];
            const dz = document.getElementById('dropzone-prompt'); if (dz) dz.style.display = 'block';
            } finally {
                // restore button state
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
                submitBtn.style.opacity = '';
                submitBtn.style.cursor = '';
            }
        };
    }

    // --- 6. CHARGEMENT INITIAL & UTILITAIRES ---
    // Load saved posts from storage safely
    try {
        const savedPosts = loadStoredPosts();
        applyPostsCache(savedPosts);
    } catch (e) {
        console.warn('Failed to load saved posts', e);
    }

    // FERMETURE UNIVERSELLE DES MODALES
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay') || e.target.closest('.modal-close-x') || e.target.closest('.fb-close')) {
            document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
        }
    });

    const openAddBtn = document.getElementById('open-add-modal');
    if (openAddBtn) openAddBtn.onclick = () => {
        const addModal = document.getElementById('add-content-modal');
        if (addModal) addModal.classList.add('active');
    };

    let totalSeconds = 722411; 
    const cd = document.getElementById('countdown');
    if (cd) setInterval(() => {
        totalSeconds--;
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        cd.innerText = `${h} h : ${m} m : ${s} s`;
    }, 1000);

    // --- LOGOUT FUNCTIONALITY ---
    const logoutLink = document.querySelector('.logout-link');
    if (logoutLink) {
        logoutLink.addEventListener('click', async (e) => {
            e.preventDefault(); // Prevent immediate redirect

            try {
                const token = getToken();
                if (token) {
                    // Call logout endpoint
                    const response = await fetch('https://universearch-9qle.onrender.com/universites/auth/logout', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    // Even if it fails, proceed with local cleanup
                }
            } catch (error) {
                console.warn('Logout API call failed:', error);
            }

            // Clear local storage (keep profile prompt flag so modal shows only once ever)
            localStorage.removeItem('softura_token');
            localStorage.removeItem('softura_session');
            // note: do NOT remove softura_profile_prompt_shown here

            // Redirect to index
            window.location.href = 'index.html';
        });
    }
});
