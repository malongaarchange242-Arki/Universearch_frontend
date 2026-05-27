document.addEventListener('DOMContentLoaded', () => {

    // 🔐 Decode JWT and extract role
    const getJWTRole = () => {
        try {
            const token = localStorage.getItem('jwt_token') || localStorage.getItem('softura_token') || '';
            if (!token) return null;
            
            const parts = token.split('.');
            if (parts.length !== 3) return null;
            
            const payload = JSON.parse(atob(parts[1]));
            console.log('🔑 JWT Payload:', payload);
            
            // Try multiple possible field names for role/institution_type
            const role = payload.role || 
                        payload.userType || 
                        payload.institution_type ||
                        payload.user_type ||
                        null;
            
            console.log('Role from JWT:', role);
            return role;
        } catch (error) {
            console.error('Error decoding JWT:', error);
            return null;
        }
    };

    // Determine API base depending on connected role (CENTRE vs UNIVERSITE)
    const getApiBase = () => {
        try {
            // Try JWT first to determine service type
            const jwtRole = getJWTRole();
            if (jwtRole) {
                const role = String(jwtRole).toLowerCase();
                return (role === 'centre' || role === 'centre_formation')
                    ? 'https://universearch-t126.onrender.com/centres'
                    : 'https://universearch-t126.onrender.com/universites';
            }
            
            // Fallback to session
            const session = JSON.parse(localStorage.getItem('softura_session') || '{}');
            const roleRaw = session.role || session.userType || '';
            const role = roleRaw.toLowerCase();
            return (role === 'centre' || role === 'centre_formation')
                ? 'https://universearch-t126.onrender.com/centres'
                : 'https://universearch-t126.onrender.com/universites';
        } catch (e) {
            return 'https://universearch-t126.onrender.com/universites';
        }
    };

    // Detect role to customize UI labels
    const getDetectedRole = () => {
        try {
            // Try JWT first
            const jwtRole = getJWTRole();
            if (jwtRole) {
                return String(jwtRole).toLowerCase();
            }
            
            // Fallback to session
            const session = JSON.parse(localStorage.getItem('softura_session') || '{}');
            const roleRaw = session.role || session.userType || '';
            return roleRaw.toLowerCase();
        } catch (e) {
            return 'universite';
        }
    };

    const BASE_URL = getApiBase();
    const detectedRole = getDetectedRole();
    
    // Customize UI labels based on role
    const isCentre = detectedRole === 'centre' || detectedRole === 'centre_formation';
    const bdeLabel = isCentre ? 'Création du Représentant' : 'Création du BDE';
    const presidentLabel = isCentre ? 'Informations du Représentant' : 'Informations du Président (BDE)';
    const fieldsLabel = isCentre ? 'Mes formations' : 'Mes filières';
    const fieldsType = isCentre ? 'formations' : 'filières';
    const jsonFile = isCentre ? 'mes-formations.json' : 'mes-filieres.json';
    const selectedKey = isCentre ? 'selectedFormations' : 'selectedFilieres';

    // --- 2. BDE FORM ELEMENTS (DECLARE EARLY) ---
    const btnShowBde = document.getElementById('btn-show-bde-form');
    const bdeForm = document.getElementById('bde-dynamic-form');
    const bdeInitBox = document.getElementById('bde-init-box');
    const btnAddVP = document.getElementById('btn-add-vp');
    const vpForm = document.getElementById('vp-form');
    
    // Update UI labels if elements exist
    if (btnShowBde) {
        btnShowBde.innerHTML = `<i class="fa-solid fa-plus-circle"></i> ${bdeLabel}`;
    }
    
    if (bdeInitBox) {
        const p = bdeInitBox.querySelector('p');
        if (p) {
            p.innerText = isCentre 
                ? 'Cliquez pour configurer le représentant et ses informations.'
                : 'Cliquez pour configurer le bureau des étudiants et ses membres.';
        }
    }

    // Update button text based on role
    const btnCreateBde = document.getElementById('btn-create-bde');
    if (btnCreateBde) {
        btnCreateBde.textContent = isCentre ? 'Créer le compte representant' : 'Créer le compte BDE';
    }

    // Update fields button text
    const btnMyFields = document.getElementById('btn-my-fields');
    if (btnMyFields) {
        btnMyFields.innerText = fieldsLabel;
    }

    try {
        const _sess = JSON.parse(localStorage.getItem('softura_session') || '{}');
        const jwtRole = getJWTRole();
        const detectedRoleLabel = String(jwtRole || _sess.role || _sess.userType || 'UNIVERSITY').toUpperCase();
        console.log('✅ Role détecté:', detectedRoleLabel, '| From JWT:', !!jwtRole);
    } catch (_) {}
    console.log('Endpoint utilisé:', BASE_URL);

    // --- 1. NAVIGATION DES ONGLETS (TABS) ---
    const submenuItems = document.querySelectorAll('.submenu-item');
    const panes = document.querySelectorAll('.settings-pane');

    submenuItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetId = item.getAttribute('data-target');
            
            submenuItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            panes.forEach(pane => {
                pane.classList.remove('active');
                if (pane.id === targetId) pane.classList.add('active');
            });
        });
    });

    // --- 2. LOGIQUE DYNAMIQUE DU BDE EVENT LISTENERS ---
    if (btnShowBde) {
        btnShowBde.addEventListener('click', () => {
            bdeForm.style.display = 'block';
            bdeInitBox.style.display = 'none';
            // Update president label when form is shown
            const presHeader = bdeForm.querySelector('.sub-divider');
            if (presHeader) {
                presHeader.innerText = presidentLabel;
            }
        });
    }

    if (btnAddVP) {
        btnAddVP.addEventListener('click', () => {
            vpForm.style.display = 'block';
            btnAddVP.style.display = 'none';
        });
    }

    // Settings storage key per-user to avoid cross-account collisions
    const getSettingsKey = () => {
        try {
            const session = JSON.parse(localStorage.getItem('softura_session') || '{}');
            const id = session.userId || session.userId || session.email || 'anon';
            // corrected spelling of "universearch" to avoid two different keys
            return `universearch_settings_${id}`;
        } catch (e) {
            return 'universearch_settings_anon';
        }
    };

    // --- 3. SAUVEGARDE DANS LE LOCALSTORAGE ---
    const saveAllData = () => {
        const settings = {
            nom: document.getElementById('school-name').value,
            sigle: document.getElementById('school-sigle').value,
            annee_fondation: document.getElementById('school-date').value,
            description: document.getElementById('school-mission').value,
            logo_url: document.getElementById('school-logo-preview').src,
            lien_site: (document.getElementById('school-lien') && document.getElementById('school-lien').value) || null,
            contacts: (document.getElementById('school-contacts') && document.getElementById('school-contacts').value) || null,
            // BDE fields
            isBdeCreated: (bdeForm && bdeForm.style.display === 'block'),
            isVpAdded: (vpForm && vpForm.style.display === 'block'),
            presLastname: (document.getElementById('pres-lastname') && document.getElementById('pres-lastname').value) || null,
            presFirstname: (document.getElementById('pres-firstname') && document.getElementById('pres-firstname').value) || null,
            presPhone: (document.getElementById('pres-phone') && document.getElementById('pres-phone').value) || null,
            presEmail: (document.getElementById('pres-email') && document.getElementById('pres-email').value) || null
        };

        // persist per-user settings
        localStorage.setItem(getSettingsKey(), JSON.stringify(settings));
    };

    // --- 4. CHARGEMENT DES DONNÉES AU DÉMARRAGE ---
    const loadAllData = () => {
        // Only run settings load on pages that contain the profile form
        const nameEl = document.getElementById('school-name');
        if (!nameEl) return; // not the settings page

        // try the canonical key first; fallback to the old misspelled key if nothing found
        const key = getSettingsKey();
        let saved = localStorage.getItem(key);
        if (!saved) {
            // previous versions used wrong spelling
            const alt = key.replace('universearch', 'universearh');
            saved = localStorage.getItem(alt);
        }
        if (saved) {
            const d = JSON.parse(saved);
            
            if (d.nom) nameEl.value = d.nom;
            const sigleEl = document.getElementById('school-sigle');
            if (d.sigle && sigleEl) sigleEl.value = d.sigle;
            const dateEl = document.getElementById('school-date');
            if (d.annee_fondation && dateEl) dateEl.value = d.annee_fondation;
            const missionEl = document.getElementById('school-mission');
            if (d.description && missionEl) missionEl.value = d.description;
            const logoEl = document.getElementById('school-logo-preview');
            if (d.logo_url && logoEl) logoEl.src = d.logo_url;

            const lienEl = document.getElementById('school-lien');
            if (d.lien_site && lienEl) lienEl.value = d.lien_site;
            const contactsEl = document.getElementById('school-contacts');
            if (d.contacts && contactsEl) contactsEl.value = d.contacts;

            if (d.isBdeCreated && bdeForm && bdeInitBox) {
                bdeForm.style.display = 'block';
                bdeInitBox.style.display = 'none';
            }

            // populate BDE president fields if present
            try {
                const presLast = document.getElementById('pres-lastname');
                const presFirst = document.getElementById('pres-firstname');
                const presPhone = document.getElementById('pres-phone');
                const presEmail = document.getElementById('pres-email');
                if (d.presLastname && presLast) presLast.value = d.presLastname;
                if (d.presFirstname && presFirst) presFirst.value = d.presFirstname;
                if (d.presPhone && presPhone) presPhone.value = d.presPhone;
                if (d.presEmail && presEmail) presEmail.value = d.presEmail;
            } catch (e) { /* ignore */ }

            if (d.isVpAdded && vpForm && btnAddVP) {
                vpForm.style.display = 'block';
                btnAddVP.style.display = 'none';
            }
        }
    };

    loadAllData();

    // --- Helper: small toast for feedback ---
    const showToast = (msg, duration = 3000) => {
        try {
            let t = document.getElementById('ue-toast');
            if (t) t.remove();
            t = document.createElement('div');
            t.id = 'ue-toast';
            t.innerText = msg;
            t.style = 'position:fixed; right:20px; bottom:20px; background:rgba(0,0,0,0.8); color:white; padding:10px 14px; border-radius:8px; z-index:99999; font-family:inherit;';
            document.body.appendChild(t);
            setTimeout(() => { try { t.remove(); } catch (e) {} }, duration);
        } catch (e) { /* ignore */ }
    };

    // --- BDE create button handler on settings page ---
    const btnCreate = document.getElementById('btn-create-bde');
    const btnCancelBde = document.getElementById('btn-cancel-bde');
    if (btnCancelBde) btnCancelBde.addEventListener('click', () => {
        const bdeForm = document.getElementById('bde-dynamic-form');
        const bdeInitBox = document.getElementById('bde-init-box');
        if (bdeForm) bdeForm.style.display = 'none';
        if (bdeInitBox) bdeInitBox.style.display = 'block';
    });

    if (btnCreate) {
        btnCreate.addEventListener('click', async (ev) => {
            ev.preventDefault();
            const presLastEl = document.getElementById('pres-lastname');
            const presFirstEl = document.getElementById('pres-firstname');
            const presPhoneEl = document.getElementById('pres-phone');
            const presEmailEl = document.getElementById('pres-email');

            const lastname = (presLastEl && presLastEl.value || '').trim();
            const firstname = (presFirstEl && presFirstEl.value || '').trim();
            const phone = (presPhoneEl && presPhoneEl.value || '').trim();
            const email = (presEmailEl && presEmailEl.value || '').trim();
            
            if (!lastname || !firstname) return alert('Nom et prénom requis');
            
            // Générer automatiquement le nom (BDE ou Représentant)
            const nomData = `${firstname} ${lastname}`;
            // Use HTML5 email validation when available for better coverage
            if (email && presEmailEl && typeof presEmailEl.checkValidity === 'function' && !presEmailEl.checkValidity()) {
                return alert('Email invalide');
            }

            // Get session info and token
            let session = {};
            try {
                session = JSON.parse(localStorage.getItem('softura_session') || '{}');
            } catch (e) { /* ignore */ }

            const token = localStorage.getItem('softura_token');

            // Try to resolve id/profile_type from token payload first (if present)
            let universiteId = session.universite_id || session.universiteId || session.organisation_id || session.organizationId || session.orgId || session.org_id || session.profile_id || session.profileId || session.userId || session.id || null;
            let profileTypeRaw = session.profile_type || session.profileType || session.role || session.userType || null;
            let profileType = profileTypeRaw ? profileTypeRaw.toLowerCase() : null;

            if (token) {
                try {
                    const parts = token.split('.');
                    if (parts.length === 3) {
                        const payloadStr = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
                        const payload = JSON.parse(decodeURIComponent(escape(payloadStr)));
                        universiteId = universiteId || payload.universite_id || payload.profile_id || payload.profileId || payload.userId || payload.sub || payload.id || universiteId;
                        const payloadProfileTypeRaw = payload.profile_type || payload.profileType || payload.role || payload.userType || null;
                        profileType = profileType || (payloadProfileTypeRaw ? payloadProfileTypeRaw.toLowerCase() : null);
                    }
                } catch (e) {
                    console.warn('Failed to decode token payload', e);
                }
            }

            // If still no id or profileType, call /me to fetch authoritative profile
            if ((!universiteId || !profileType) && token) {
                try {
                    const meRes = await fetch(`${BASE_URL}/me`, { headers: { Authorization: `Bearer ${token}` } });
                    if (meRes.ok) {
                        const meJson = await meRes.json().catch(() => null) || {};
                        // normalize common shapes
                        const profile = meJson.data || meJson || {};
                        universiteId = universiteId || profile.universite_id || profile.profile_id || profile.id || profile.userId || universiteId;
                        const meProfileTypeRaw = profile.profile_type || profile.profileType || profile.role || profile.userType || null;
                        profileType = profileType || (meProfileTypeRaw ? meProfileTypeRaw.toLowerCase() : null);
                        console.log('Resolved profile from /me:', { universiteId, profileType });
                    } else {
                        console.warn('/me returned', meRes.status);
                    }
                } catch (e) {
                    console.warn('Error fetching /me', e);
                }
            }

            // Permission checks are handled by the backend; frontend should not block on role.

            if (!universiteId) {
                alert('Impossible de déterminer l\'identifiant de l\'université (universite_id). Veuillez vous reconnecter.');
                return;
            }

            // Normalize and validate universiteId: must be a UUID string with no surrounding spaces
            try {
                universiteId = String(universiteId).trim();
            } catch (e) {
                alert('Identifiant université invalide. Veuillez vous reconnecter.');
                return;
            }

            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(universiteId)) {
                alert('L\'identifiant de l\'université fourni n\'est pas un UUID valide. Veuillez vous reconnecter avec un compte université.');
                return;
            }

            const payload = {
                nom: nomData,
                description: document.getElementById('school-mission').value || null,
                pres_lastname: lastname,
                pres_firstname: firstname,
                pres_phone: phone || null,
                pres_email: email || null,
            };

            // Déterminer l'endpoint selon le rôle
            const endpoint = isCentre ? '/representants' : '/bde';
            const typeLabel = isCentre ? 'Représentant' : 'BDE';

            let saved = null;
            if (token) {
                try {
                    const res = await fetch(`${BASE_URL}${endpoint}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify(payload)
                    });
                    if (res.ok) {
                        const j = await res.json().catch(() => null);
                        saved = j && (j.data || j) || payload;
                        console.log(`${typeLabel} created successfully:`, saved);
                    } else {
                        const errText = await res.text().catch(() => '');
                        console.warn(`${typeLabel} create API failed`, res.status, errText);
                        alert(`Erreur: ${res.status} - ${errText.substring(0, 100)}`);
                    }
                } catch (e) { 
                    console.warn(`${typeLabel} create error`, e);
                    alert(`Erreur de connexion: ${e.message}`);
                }
            } else {
                alert(`Vous devez être connecté pour créer un ${typeLabel}`);
                return;
            }

            // persist locally regardless
            try {
                const key = getSettingsKey();
                const existing = JSON.parse(localStorage.getItem(key) || '{}') || {};
                const merged = Object.assign({}, existing, {
                    presLastname: saved?.pres_lastname || payload.pres_lastname,
                    presFirstname: saved?.pres_firstname || payload.pres_firstname,
                    presPhone: saved?.pres_phone || payload.pres_phone,
                    presEmail: saved?.pres_email || payload.pres_email,
                    isBdeCreated: true
                });
                localStorage.setItem(key, JSON.stringify(merged));
                // reflect UI
                const bdeForm = document.getElementById('bde-dynamic-form');
                const bdeInitBox = document.getElementById('bde-init-box');
                if (bdeForm) bdeForm.style.display = 'block';
                if (bdeInitBox) bdeInitBox.style.display = 'none';
                showToast(`Compte ${typeLabel} créé avec succès`, 3000);
            } catch (e) {
                console.warn(`Failed to persist ${typeLabel} locally`, e);
                alert(`${typeLabel} créé mais erreur de sauvegarde locale`);
            }
        });
    }

    // --- 7. MES FILIÈRES (bouton) ---
    if (btnMyFields) {
        btnMyFields.addEventListener('click', () => {
            try {
                let modal = document.getElementById('mes-filieres-modal');
                if (!modal) {
                    modal = document.createElement('div');
                    modal.id = 'mes-filieres-modal';
                    modal.style = 'position:fixed;left:0;top:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:99999;';
                    modal.innerHTML = `
                        <div style="background:white;padding:24px;border-radius:12px;max-width:720px;width:90%;box-shadow:0 20px 40px rgba(0,0,0,0.2);">
                            <h3 style="margin-top:0;margin-bottom:10px;">${fieldsLabel}</h3>
                            <p style="color:#475569;">Sélectionnez les ${fieldsType} associées à votre établissement.</p>
                            <input type="text" id="mes-filieres-search" placeholder="Rechercher des ${fieldsType}..." style="width:100%; padding:8px; border:1px solid #eef2f6; border-radius:8px; margin-bottom:8px;">
                            <div id="mes-filieres-list" style="max-height:320px;overflow:auto;border:1px solid #eef2f6;padding:12px;border-radius:8px;margin-top:8px;">
                                <em style="color:#94a3b8;">Chargement...</em>
                            </div>
                            <div style="display:flex;justify-content:flex-end;margin-top:14px;gap:8px;">
                                <button id="mes-filieres-save" class="btn-save-pro" style="background:#10b981;">Enregistrer</button>
                                <button id="mes-filieres-close" class="btn-save-pro" style="background:#64748b;">Fermer</button>
                            </div>
                        </div>`;
                    document.body.appendChild(modal);

                    // Populate the list from JSON and wire up buttons
                    const listEl = modal.querySelector('#mes-filieres-list');
                    const saveBtn = modal.querySelector('#mes-filieres-save');
                    const closeBtn = modal.querySelector('#mes-filieres-close');

                    // Filters UI
                    const filtersWrap = document.createElement('div');
                    filtersWrap.className = 'mf-filters';
                    const filterDefs = [
                        { id: 'polytechnique', label: 'Polytechnique' },
                        { id: 'administration', label: 'Administration' },
                        { id: 'commerciale', label: 'Commerciale' }
                    ];
                    filterDefs.forEach(f => {
                        const b = document.createElement('button');
                        b.type = 'button';
                        b.className = 'mf-filter-btn';
                        b.dataset.filter = f.id;
                        b.innerText = f.label;
                        filtersWrap.appendChild(b);
                    });
                    // Insert filters before the list element (safe even if structure changes)
                    if (listEl && listEl.parentNode) {
                        listEl.parentNode.insertBefore(filtersWrap, listEl);
                    } else {
                        modal.insertBefore(filtersWrap, modal.firstChild);
                    }

                    const searchInput = modal.querySelector('#mes-filieres-search');
                    let searchTerm = '';
                    searchInput.addEventListener('input', (e) => {
                        searchTerm = e.target.value.toLowerCase();
                        renderList(allData);
                    });

                    const settingsKey = getSettingsKey();
                    const existingSettings = JSON.parse(localStorage.getItem(settingsKey) || '{}') || {};
                    const savedSelected = Array.isArray(existingSettings[selectedKey]) ? existingSettings[selectedKey] : [];

                    // simple keyword-based mappings for filters
                    const filterKeywords = {
                        polytechnique: ['génie', 'mécanique', 'élect', 'mécatron', 'procéd', 'automat', 'mécanique', 'informatique', 'telecom', 'cyber', 'data', 'big data', 'machine learning', 'robot'],
                        administration: ['management', 'ressources humaines', 'comptabilité', 'finance', 'gestion', 'entrepreneuriat', 'administration', 'public'],
                        commerciale: ['marketing', 'commerce', 'business', 'logistique', 'transport', 'commerciale', 'e-marketing']
                    };

                    let allData = [];
                    let activeFilters = new Set();
                    // 🔧 Track les sélections actuelles de l'utilisateur (persiste pendant le modal)
                    let currentSelected = new Set(savedSelected);

                    function matchesFilters(item) {
                        if (activeFilters.size === 0) return true;
                        const name = (item.name || '').toLowerCase();
                        for (const f of activeFilters) {
                            const keys = filterKeywords[f] || [];
                            for (const k of keys) {
                                if (name.includes(k)) return true;
                            }
                        }
                        return false;
                    }

                    function renderList(data) {
                        listEl.innerHTML = '';
                        
                        // 🔧 IMPORTANT: Nettoyer currentSelected pour ne garder que les UUIDs valides
                        // Cela élimine les anciens slugs du localStorage (chinois, espagnol, etc.)
                        const validIds = new Set(data.map(item => item.id));
                        const cleanedSelected = new Set();
                        for (const id of currentSelected) {
                            if (validIds.has(id)) {
                                cleanedSelected.add(id);
                            }
                        }
                        currentSelected = cleanedSelected;
                        
                        console.log(`🧹 [DEBUG] Nettoyage: ${savedSelected.length} ancien(s) → ${currentSelected.size} valide(s)`);
                        if (savedSelected.length > currentSelected.size) {
                            console.warn(`⚠️ [DEBUG] ${savedSelected.length - currentSelected.size} slug(s) ancien(s) supprimé(s)`);
                        }
                        
                        const filtered = data.filter(item => matchesFilters(item) && item.name.toLowerCase().includes(searchTerm));
                        if (!filtered.length) {
                            listEl.innerHTML = '<em style="color:#94a3b8;">Aucune filière correspondant aux filtres et à la recherche.</em>';
                            return;
                        }
                        filtered.forEach(item => {
                            const id = item.id || item.name.replace(/\s+/g, '-').toLowerCase();
                            const row = document.createElement('div');
                            row.className = 'mf-row';

                            const cb = document.createElement('input');
                            cb.type = 'checkbox';
                            cb.value = id;
                            cb.id = 'mf_' + id;
                            // 🔧 Utiliser currentSelected (nettoyé) au lieu de savedSelected
                            if (currentSelected.has(id)) cb.checked = true;

                            // 🔧 Mettre à jour currentSelected quand on coche/décoche
                            cb.addEventListener('change', (e) => {
                                if (e.target.checked) {
                                    currentSelected.add(id);
                                } else {
                                    currentSelected.delete(id);
                                }
                            });

                            const lbl = document.createElement('label');
                            lbl.htmlFor = cb.id;
                            lbl.innerText = item.name;

                            row.appendChild(cb);
                            row.appendChild(lbl);
                            listEl.appendChild(row);
                        });
                    }

                    // Load filières from backend API (always prefer real UUIDs)
                    // This ensures we send the correct UUIDs to the POST endpoint, not slugs
                    (async () => {
                        try {
                            // Determine the correct endpoint based on role
                            const baseUrl = new URL(BASE_URL).origin;
                            let filieresEndpoint;
                            
                            if (isCentre) {
                                // Pour les centres de formation
                                filieresEndpoint = `${baseUrl}/centres/filieres`;
                            } else {
                                // Pour les universités
                                filieresEndpoint = `${baseUrl}/filieres`;
                            }
                            
                            console.log(`🔄 [DEBUG] Chargement des ${fieldsType} depuis API: ${filieresEndpoint}`);
                            
                            const remote = await fetch(filieresEndpoint);
                            if (remote.ok) {
                                const rd = await remote.json();
                                // Map the response to {id, name} format (backend uses 'id' and 'nom')
                                allData = (rd || []).map(r => ({ 
                                    id: r.id,  // UUID from database
                                    name: r.nom || r.name 
                                }));
                                console.log(`✅ [DEBUG] ${allData.length} ${fieldsType} chargées depuis l'API`);
                                renderList(allData);
                                return;
                            }
                            console.warn(`⚠️ [DEBUG] API returned ${remote.status}, falling back to local JSON`);
                        } catch (err) {
                            console.warn('⚠️ [DEBUG] Failed to load from API, trying local JSON:', err);
                        }

                        // Fallback: Try local JSON file (for offline/development)
                        try {
                            const resLocal = await fetch(jsonFile);
                            if (resLocal.ok) {
                                const data = await resLocal.json();
                                // ⚠️ WARNING: Local JSON has slugs, not UUIDs!
                                // This is only for display purposes when API is unavailable
                                allData = (data || []).map(d => ({ id: d.id, name: d.name }));
                                console.warn('⚠️ [DEBUG] Using local JSON with slugs (API unavailable)');
                                renderList(allData);
                                return;
                            }
                        } catch (e) {
                            console.warn('⚠️ [DEBUG] Local JSON also failed');
                        }

                        listEl.innerHTML = `<em style="color:#94a3b8;">Impossible de charger la liste des ${fieldsType}.</em>`;
                    })();

                    // filter button behavior
                    filtersWrap.querySelectorAll('.mf-filter-btn').forEach(btn => {
                        btn.addEventListener('click', () => {
                            const key = btn.dataset.filter;
                            if (btn.classList.contains('active')) {
                                btn.classList.remove('active');
                                activeFilters.delete(key);
                            } else {
                                btn.classList.add('active');
                                activeFilters.add(key);
                            }
                            renderList(allData);
                        });
                    });

                    closeBtn.addEventListener('click', () => { modal.remove(); });

                    saveBtn.addEventListener('click', async () => {
                        try {
                            // 🔧 Griser le bouton et afficher "Enregistrement en cours..."
                            const originalText = saveBtn.innerText;
                            const originalBg = saveBtn.style.background;
                            saveBtn.disabled = true;
                            saveBtn.innerText = '⏳ Enregistrement en cours...';
                            saveBtn.style.opacity = '0.6';
                            saveBtn.style.cursor = 'not-allowed';

                            // 🔧 LOG 1: Vérifier l'ID de l'université depuis JWT
                            const token = localStorage.getItem('softura_token');
                            let institutionId = null;
                            if (token) {
                                try {
                                    const parts = token.split('.');
                                    if (parts.length === 3) {
                                        const payload = JSON.parse(atob(parts[1]));
                                        institutionId = payload.id;
                                        console.log('🔐 [DEBUG] JWT Institution ID:', institutionId);
                                        console.log('🔐 [DEBUG] JWT full payload:', payload);
                                    }
                                } catch (e) {
                                    console.warn('❌ Failed to extract ID from JWT', e);
                                }
                            }

                            // 🔧 LOG 2: Filières sélectionnées
                            const checked = Array.from(currentSelected);
                            console.log('📋 [DEBUG] Filières sélectionnées (slugs/IDs):', checked);
                            console.log('📊 [DEBUG] Nombre de filières:', checked.length);
                            console.log('📝 [DEBUG] Type de selectedKey:', selectedKey);
                            console.log('🏢 [DEBUG] BASE_URL:', BASE_URL);

                            const base = JSON.parse(localStorage.getItem(settingsKey) || '{}') || {};
                            base[selectedKey] = checked;
                            localStorage.setItem(settingsKey, JSON.stringify(base));
                            console.log('💾 [DEBUG] Sauvegardé dans localStorage:', { [selectedKey]: checked });

                            // Also attempt to persist to backend if token is present
                            if (token) {
                                const IDENTITY_API = window.IDENTITY_API_BASE || 'https://universearch-t126.onrender.com/universites';

                                // � USE PROPER ENDPOINT: POST /universites/me/filieres
                                // This is the dedicated endpoint for attaching filières to a university
                                const payloadToSend = { filiereIds: checked };
                                
                                console.log('🚀 [DEBUG] Payload à envoyer:', JSON.stringify(payloadToSend, null, 2));
                                console.log('🚀 [DEBUG] Endpoint: POST', `${BASE_URL}/me/filieres`);
                                console.log('🚀 [DEBUG] Headers:', {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token.substring(0, 20)}...` // masquer le token
                                });

                                // Use the dedicated filieres endpoint
                                try {
                                    console.log('📡 [DEBUG] Envoi de la requête...');
                                    const upd = await fetch(`${BASE_URL}/me/filieres`, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${token}`
                                        },
                                        body: JSON.stringify(payloadToSend)
                                    });

                                    // 🔧 LOG 4: Réponse du serveur
                                    console.log('✅ [DEBUG] Réponse HTTP statut:', upd.status, upd.statusText);
                                    
                                    if (!upd.ok) {
                                        const errTxt = await upd.text().catch(() => '');
                                        console.warn('❌ [DEBUG] Failed to attach filieres on server', upd.status, errTxt);
                                        console.warn('❌ [DEBUG] Response body:', errTxt);
                                        showToast('Filières enregistrées localement (erreur serveur)', 3000);
                                    } else {
                                        const respBody = await upd.json().catch(() => ({}));
                                        console.log('📦 [DEBUG] Réponse complète du serveur:', respBody);
                                        console.log('✅ [DEBUG] Success! Filières sauvegardées sur serveur');
                                        showToast('✅ Filières enregistrées avec succès!', 2000);
                                    }
                                } catch (e) {
                                    console.error('❌ [DEBUG] Erreur lors de la requête fetch:', e.message);
                                    console.error('❌ [DEBUG] Stack trace:', e.stack);
                                    showToast('Filières enregistrées localement (erreur réseau)', 3000);
                                }
                            } else {
                                console.warn('⚠️ [DEBUG] Pas de token disponible');
                                showToast('Filières enregistrées localement (connectez-vous pour synchroniser)', 3000);
                            }

                            modal.remove();
                        } catch (e) {
                            console.error('❌ [DEBUG] Erreur générale dans saveBtn.addEventListener:', e.message);
                            console.error('❌ [DEBUG] Stack trace:', e.stack);
                            console.warn('Erreur sauvegarde filieres', e);
                            alert('Erreur lors de la sauvegarde des filières');
                            // 🔧 Restaurer le bouton en cas d'erreur
                            saveBtn.disabled = false;
                            saveBtn.innerText = originalText;
                            saveBtn.style.opacity = '1';
                            saveBtn.style.cursor = 'pointer';
                        }
                    });
                }
            } catch (e) {
                console.warn('Erreur affichage mes filières', e);
                alert('Impossible d\'ouvrir la fenêtre Mes filières');
            }
        });
    }

    // --- 5. ANIMATION ET ACTION DU BOUTON ENREGISTRER ---
    const saveBtn = document.getElementById('global-save');
    if (saveBtn) {
        saveBtn.addEventListener('click', function() {
            saveAllData();
            
            const originalText = this.innerHTML;
            this.disabled = true;
            this.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Synchronisation...';
            
            (async () => {
                try {
                    // attempt to persist to backend if token is available
                    const token = localStorage.getItem('softura_token');
                    const payload = {
                        nom: document.getElementById('school-name').value,
                        sigle: document.getElementById('school-sigle').value,
                        annee_fondation: parseInt(document.getElementById('school-date').value, 10) || null,
                        description: document.getElementById('school-mission').value,
                        lien_site: (document.getElementById('school-lien') && document.getElementById('school-lien').value) || null,
                        contacts: (document.getElementById('school-contacts')?.value || '').trim() || null
                    };

                    let logoUrl = null;

                    // require auth token to persist to backend
                    if (!token) {
                        alert('Vous devez être connecté(e) pour enregistrer ces modifications sur le serveur.');
                    }

                    // if logo preview is a data URL, upload it first to /universites/me/logo
                    const img = document.getElementById('school-logo-preview');
                    if (img && img.src && img.src.startsWith('data:') && token) {
                        // extract base64
                        const dataUrl = img.src;
                        const base64 = dataUrl.split(',')[1];
                        const inputFile = document.getElementById('input-school-logo');
                        const filename = (inputFile && inputFile.files && inputFile.files[0] && inputFile.files[0].name) || `logo_${Date.now()}.png`;
                        const contentType = dataUrl.substring(dataUrl.indexOf(':') + 1, dataUrl.indexOf(';')) || 'image/png';

                        // First attempt: upload to BASE_URL (/centres or /universites)
                        let res = await fetch(`${BASE_URL}/me/logo`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ file: base64, filename, contentType })
                        });

                        let text = await res.text();
                        let j = null;
                        try { j = JSON.parse(text); } catch (_) { /* ignore */ }

                        // If endpoint not found, try the alternative base (/universites <-> /centres)
                        if (res.status === 404) {
                            const altBase = BASE_URL.includes('/centres') ? 'https://universearch-t126.onrender.com/universites' : 'https://universearch-t126.onrender.com/centres';
                            console.warn('Primary upload endpoint returned 404, retrying on', altBase);
                            const altRes = await fetch(`${altBase}/me/logo`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify({ file: base64, filename, contentType })
                            });

                            const altText = await altRes.text();
                            let altJ = null;
                            try { altJ = JSON.parse(altText); } catch (_) { /* ignore */ }

                            if (altRes.ok) {
                                logoUrl = altJ?.url || null;
                                console.log('Logo upload success response (alt):', altJ, 'resolved logoUrl=', logoUrl);
                            } else {
                                if (altRes.status === 401) {
                                    localStorage.removeItem('softura_token');
                                    alert('Votre session a expiré. Veuillez vous reconnecter.');
                                    window.location.href = 'index.html';
                                    return;
                                }
                                console.warn('Logo upload failed on alt endpoint', altRes.status, altText, altJ);
                                alert('Échec upload logo : ' + (altJ?.error || altText || altRes.status));
                            }
                        } else if (res.ok) {
                            logoUrl = j?.url || null;
                            console.log('Logo upload success response:', j, 'resolved logoUrl=', logoUrl);
                        } else {
                            if (res.status === 401) {
                                localStorage.removeItem('softura_token');
                                alert('Votre session a expiré. Veuillez vous reconnecter.');
                                window.location.href = 'index.html';
                                return;
                            }
                            console.warn('Logo upload failed', res.status, text, j);
                            alert('Échec upload logo : ' + (j?.error || text || res.status));
                        }
                    }

                    if (token) {
                        if (logoUrl) payload.logo_url = logoUrl;

                        console.log('Persisting settings payload:', payload);

                        const resp = await fetch(`${BASE_URL}/me`, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify(payload)
                        });

                        const respText = await resp.text();
                        let respJson = null;
                        try { respJson = JSON.parse(respText); } catch (_) {}

                        if (!resp.ok) {
                            // Handle expired or invalid token
                            if (resp.status === 401) {
                                localStorage.removeItem('softura_token');
                                alert('Session expirée ou invalide. Vous allez être redirigé vers la connexion.');
                                window.location.href = 'index.html';
                                return;
                            }

                            console.warn('Failed to persist settings', resp.status, respText, respJson);
                            alert('Échec enregistrement : ' + (respJson?.error || respText || resp.status));
                        } else {
                            console.log('Saved settings response:', resp.status, respJson ?? respText);
                        }
                    } else {
                        console.log('No auth token, saved only to localStorage.');
                    }

                    // UI success feedback
                    this.style.background = "#10b981";
                    this.innerHTML = '<i class="fa-solid fa-check"></i> Modifications enregistrées';
                    
                    setTimeout(() => {
                        this.style.background = "";
                        this.innerHTML = originalText;
                        this.disabled = false;
                    }, 2000);
                } catch (err) {
                    console.error(err);
                    this.innerHTML = originalText;
                    this.disabled = false;
                    alert('Erreur lors de la sauvegarde: ' + (err.message || err));
                }
            })();
        });
    }

    // --- 6. PREVIEW IMAGE ---
    const setupImagePreview = (inputId, imgId) => {
        const input = document.getElementById(inputId);
        const img = document.getElementById(imgId);
        if (input && img) {
            input.addEventListener('change', function() {
                const reader = new FileReader();
                reader.onload = (e) => { img.src = e.target.result; };
                if(this.files[0]) reader.readAsDataURL(this.files[0]);
            });
        }
    };

    setupImagePreview('input-school-logo', 'school-logo-preview');

    // Toggle Dropdown Sidebar
    const dropBtn = document.querySelector('.dropdown-toggle');
    if(dropBtn) {
        dropBtn.addEventListener('click', () => {
            const dropdown = document.querySelector('.nav-item-dropdown');
            if(dropdown) dropdown.classList.toggle('open');
        });
    }

    // --- LOGOUT FUNCTIONALITY ---
    const logoutLink = document.querySelector('.logout-link');
    if (logoutLink) {
        logoutLink.addEventListener('click', async (e) => {
            e.preventDefault(); // Prevent immediate redirect

            try {
                const token = localStorage.getItem('softura_token');
                if (token) {
                    // Call logout endpoint
                    const response = await fetch('https://universearch-t126.onrender.com/universites/auth/logout', {
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
            // do not clear softura_profile_prompt_shown

            // Redirect to login
            window.location.href = 'index.html';
        });
    }

    // --- 7. GESTION DE LA SECTION SÉCURITÉ & ACCÈS ---
    const initSecuritySection = () => {
        const updateBtn = document.getElementById('security-update-btn') || document.querySelector('#section-compte .save-trigger');
        const emailInput = document.getElementById('security-email');
        const currentPasswordInput = document.getElementById('security-current-password');
        const newPasswordInput = document.getElementById('security-new-password');
        const confirmPasswordInput = document.getElementById('security-confirm-password');
        const emailLabel = document.getElementById('security-email-label');
        const subtitle = document.getElementById('security-subtitle');
        if (!updateBtn || !emailInput || !currentPasswordInput || !newPasswordInput || !confirmPasswordInput) return;

        try {
            const session = JSON.parse(localStorage.getItem('softura_session') || '{}');
            if (session.email) emailInput.value = session.email;
        } catch (e) {
            console.warn('Impossible de preremplir l email de securite', e);
        }

        if (emailLabel) {
            emailLabel.innerText = isCentre ? 'Email du centre' : 'Email de l universite';
        }

        if (subtitle) {
            subtitle.innerText = isCentre
                ? 'Protegez vos acces et gerez les identifiants de votre centre de formation.'
                : 'Protegez vos acces et gerez les identifiants de votre universite.';
        }

        updateBtn.addEventListener('click', async function() {
            const currentPassword = currentPasswordInput.value.trim();
            const newPassword = newPasswordInput.value;
            const confirmPassword = confirmPasswordInput.value;
            const newEmail = emailInput.value.trim();

            // Validation
            if (!currentPassword) {
                alert('Veuillez saisir votre mot de passe actuel.');
                return;
            }

            if (newPassword && newPassword.length < 8) {
                alert('Le nouveau mot de passe doit contenir au moins 8 caractères.');
                return;
            }

            if (newPassword && newPassword !== confirmPassword) {
                alert('La confirmation du mot de passe ne correspond pas.');
                return;
            }

            if (!newPassword && !newEmail) {
                alert('Veuillez saisir au moins un nouveau mot de passe ou une nouvelle adresse email.');
                return;
            }

            // Désactiver le bouton pendant le traitement
            const originalText = this.innerHTML;
            this.disabled = true;
            this.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mise à jour...';

            try {
                const token = localStorage.getItem('softura_token');
                if (!token) {
                    alert('Vous devez être connecté pour effectuer cette action.');
                    return;
                }

                // Préparer le payload
                const payload = {
                    current_password: currentPassword
                };

                if (newPassword) payload.new_password = newPassword;
                if (newEmail) payload.new_email = newEmail;

                // Appel API pour mettre à jour les informations de sécurité
                const response = await fetch(`${BASE_URL}/auth/update-security`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();

                if (response.ok) {
                    alert('Informations de sécurité mises à jour avec succès !');
                    
                    // Vider les champs
                    currentPasswordInput.value = '';
                    newPasswordInput.value = '';
                    confirmPasswordInput.value = '';
                    
                    // Si l'email a été changé, mettre à jour l'affichage
                    if (newEmail) {
                        emailInput.value = newEmail;
                        try {
                            const session = JSON.parse(localStorage.getItem('softura_session') || '{}');
                            session.email = newEmail;
                            localStorage.setItem('softura_session', JSON.stringify(session));
                        } catch (e) {
                            console.warn('Impossible de mettre a jour la session locale', e);
                        }
                    }

                    // Si le mot de passe a été changé, déconnecter l'utilisateur
                    if (newPassword) {
                        alert('Votre mot de passe a été changé. Vous allez être déconnecté pour des raisons de sécurité.');
                        setTimeout(() => {
                            localStorage.removeItem('softura_token');
                            localStorage.removeItem('softura_session');
                            window.location.href = 'index.html';
                        }, 2000);
                        return;
                    }

                } else {
                    if (response.status === 401) {
                        alert('Mot de passe actuel incorrect ou session expirée.');
                    } else {
                        alert(result.error || 'Erreur lors de la mise à jour des informations de sécurité.');
                    }
                }

            } catch (error) {
                console.error('Erreur lors de la mise à jour:', error);
                alert('Erreur de connexion. Veuillez réessayer.');
            } finally {
                // Réactiver le bouton
                this.disabled = false;
                this.innerHTML = originalText;
            }
        });
    };

    // Initialiser la section sécurité
    initSecuritySection();

    // =========================================
    // 8. BUDGET & FRAIS DE SCOLARITÉ
    // =========================================
    
    const LEVELS = ['L1', 'L2', 'L3', 'Master'];
    const POLES = ['Commercial', 'Polytechnique', 'Droit'];
    
    // Get institution ID from JWT or session
    const getInstitutionId = () => {
        try {
            const token = localStorage.getItem('jwt_token') || localStorage.getItem('softura_token') || '';
            if (token) {
                const parts = token.split('.');
                if (parts.length === 3) {
                    const payload = JSON.parse(atob(parts[1]));
                    if (payload.institution_id) return payload.institution_id;
                }
            }
            const session = JSON.parse(localStorage.getItem('softura_session') || '{}');
            return session.universite_id || session.institution_id || session.userId || null;
        } catch (e) {
            return null;
        }
    };

    // Budget data storage key
    const getBudgetStorageKey = () => {
        const institutionId = getInstitutionId();
        return `universearch_budget_${institutionId}`;
    };

    // Load budget data from localStorage (local persistence)
    const loadBudgetData = () => {
        try {
            const key = getBudgetStorageKey();
            const saved = localStorage.getItem(key);
            if (saved) return JSON.parse(saved);
        } catch (e) {
            console.warn('Error loading budget data', e);
        }
        
        // Initialize empty budget structure
        const budget = {};
        LEVELS.forEach(level => {
            budget[level] = {};
            POLES.forEach(pole => {
                budget[level][pole] = { monthly: 0, yearly: 0 };
            });
        });
        return budget;
    };

    // Save budget data to localStorage (local persistence)
    const saveBudgetDataLocally = (budget) => {
        try {
            const key = getBudgetStorageKey();
            localStorage.setItem(key, JSON.stringify(budget));
            console.log('✅ Budget data saved locally');
        } catch (e) {
            console.error('Error saving budget data', e);
        }
    };

    // Save budget data to backend API
    const saveBudgetDataToBackend = async (budget) => {
        try {
            const token = localStorage.getItem('softura_token') || localStorage.getItem('jwt_token');
            const institutionId = getInstitutionId();

            if (!token || !institutionId) {
                console.warn('No token or institution ID for backend save');
                return false;
            }

            // Convert budget structure to API format
            const records = [];
            LEVELS.forEach(level => {
                POLES.forEach(pole => {
                    const data = budget[level][pole];
                    records.push({
                        institution_id: institutionId,
                        level: level,
                        pole: pole,
                        monthly_price: parseFloat(data.monthly) || 0,
                        yearly_price: parseFloat(data.yearly) || 0
                    });
                });
            });

            // Try to save to backend
            const response = await fetch(`${BASE_URL}/me/frais-scolarite`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ records })
            });

            if (response.ok) {
                console.log('✅ Budget data saved to backend');
                return true;
            } else {
                console.warn('Backend save failed:', response.status);
                return false;
            }
        } catch (error) {
            console.warn('Error saving to backend:', error);
            return false;
        }
    };

    // Render the budget table
    const renderBudgetTable = (containerId, budget) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        let html = `
            <div class="budget-table-wrapper">
                <table class="budget-table">
                    <thead>
                        <tr>
                            <th style="text-align: left; width: 120px;">Niveau</th>
        `;
        
        // Header row with poles
        POLES.forEach(pole => {
            html += `<th colspan="2" style="text-align: center; padding: 8px;">${pole}</th>`;
        });
        
        html += `</tr><tr><th></th>`;
        
        // Sub-header row with Monthly/Yearly
        POLES.forEach(() => {
            html += `<th style="width: 110px; font-size: 12px; font-weight: 500;">Mensuel</th>
                     <th style="width: 110px; font-size: 12px; font-weight: 500;">Annuel</th>`;
        });
        
        html += `</tr></thead><tbody>`;

        // Data rows
        LEVELS.forEach(level => {
            html += `<tr><td class="level-cell"><strong>${level}</strong></td>`;
            
            POLES.forEach(pole => {
                const data = budget[level][pole];
                const monthlyId = `budget-${level}-${pole}-monthly`;
                const yearlyId = `budget-${level}-${pole}-yearly`;
                
                html += `
                    <td class="price-cell">
                        <input type="number" id="${monthlyId}" class="price-input monthly" 
                               placeholder="0" value="${data.monthly || ''}" 
                               data-level="${level}" data-pole="${pole}" min="0" step="100">
                        <span class="currency">XAF</span>
                    </td>
                    <td class="price-cell">
                        <input type="number" id="${yearlyId}" class="price-input yearly" 
                               placeholder="0" value="${data.yearly || ''}" 
                               data-level="${level}" data-pole="${pole}" min="0" step="1000">
                        <span class="currency">XAF</span>
                    </td>
                `;
            });
            
            html += `</tr>`;
        });

        html += `</tbody></table></div>`;
        
        container.innerHTML = html;

        // Wire up input listeners for live updates
        const inputs = container.querySelectorAll('.price-input');
        inputs.forEach(input => {
            input.addEventListener('change', () => {
                updateBudgetFromTable(budget, containerId);
            });
            input.addEventListener('blur', () => {
                updateBudgetFromTable(budget, containerId);
            });
        });
    };

    // Update budget object from table inputs
    const updateBudgetFromTable = (budget, containerId) => {
        const container = document.getElementById(containerId);
        const inputs = container.querySelectorAll('.price-input');
        
        inputs.forEach(input => {
            const level = input.getAttribute('data-level');
            const pole = input.getAttribute('data-pole');
            const isMonthly = input.classList.contains('monthly');
            const value = parseFloat(input.value) || 0;
            
            if (!budget[level]) budget[level] = {};
            if (!budget[level][pole]) budget[level][pole] = { monthly: 0, yearly: 0 };
            
            if (isMonthly) {
                budget[level][pole].monthly = value;
            } else {
                budget[level][pole].yearly = value;
            }
        });
    };

    // Handle Budget button click
    const btnBudget = document.getElementById('btn-budget');
    if (btnBudget) {
        btnBudget.addEventListener('click', () => {
            const institutionId = getInstitutionId();
            if (!institutionId) {
                alert('Impossible de déterminer votre institution. Veuillez vous reconnecter.');
                return;
            }

            // Load existing budget data
            const budget = loadBudgetData();

            // Create modal
            let modal = document.getElementById('budget-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'budget-modal';
                modal.className = 'budget-modal-overlay';
                modal.innerHTML = `
                    <div class="budget-modal-content">
                        <div class="budget-modal-header">
                            <div>
                                <h2> Gestion des Frais de Scolarité</h2>
                                <p>Définissez vos frais mensuel et annuel par niveau et par pôle (en XAF)</p>
                            </div>
                            <button class="btn-close-modal" aria-label="Fermer">×</button>
                        </div>

                        <div id="budget-table-container"></div>

                        <div class="budget-modal-footer">
                            <button id="budget-save-btn" class="btn-save-pro" style="background:#10b981;">
                                <i class="fa-solid fa-floppy-disk"></i> Enregistrer
                            </button>
                            <button id="budget-close-btn" class="btn-save-pro" style="background:#64748b;">
                                Fermer
                            </button>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);

                // Event listeners
                modal.querySelector('.btn-close-modal').addEventListener('click', () => {
                    modal.style.display = 'none';
                });

                modal.querySelector('#budget-close-btn').addEventListener('click', () => {
                    modal.style.display = 'none';
                });

                modal.addEventListener('click', (e) => {
                    if (e.target === modal) modal.style.display = 'none';
                });

                // Save button
                modal.querySelector('#budget-save-btn').addEventListener('click', async function() {
                    const newBudget = loadBudgetData();
                    updateBudgetFromTable(newBudget, 'budget-table-container');
                    
                    // Save locally first (always works)
                    saveBudgetDataLocally(newBudget);

                    // Try to save to backend
                    const btn = this;
                    const originalText = btn.innerHTML;
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enregistrement...';

                    const success = await saveBudgetDataToBackend(newBudget);

                    btn.disabled = false;
                    btn.innerHTML = originalText;

                    if (success) {
                        showToast('✅ Frais de scolarité enregistrés avec succès!', 3000);
                    } else {
                        showToast('✅ Données sauvegardées localement (backend non disponible)', 3000);
                    }

                    // Close modal after a short delay
                    setTimeout(() => {
                        modal.style.display = 'none';
                    }, 1500);
                });
            }

            // Render the table
            renderBudgetTable('budget-table-container', budget);

            // Show modal
            modal.style.display = 'flex';
        });
    }

});
