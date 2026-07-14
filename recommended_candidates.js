/**
 * UNIVERSEARCH - Gestion des Candidats Recommandés
 * Logique Frontend pour le Tableau de Bord des Candidats
 */

// ============================================================================
// FONCTIONS UTILITAIRES D'AFFICHAGE
// ============================================================================

function afficherToast(message, type = 'info', duration = 5000) {
    // Créer un toast simple si aucune fonction externe n'est disponible
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#dc3545' : type === 'warning' ? '#ffc107' : '#007bff'};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        max-width: 400px;
        font-family: Arial, sans-serif;
        font-size: 14px;
    `;
    toast.innerHTML = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => document.body.removeChild(toast), 300);
    }, duration);
}

function afficherMessageSysteme(html) {
    // Créer un message système dans le conteneur principal
    const container = document.querySelector('.container') || document.body;
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
        margin: 20px 0;
        padding: 20px;
        border: 2px solid #007bff;
        border-radius: 8px;
        background: #f8f9fa;
        font-family: Arial, sans-serif;
    `;
    messageDiv.innerHTML = html;
    container.insertBefore(messageDiv, container.firstChild);
}

// ============================================================================
// CONFIGURATION ET CONFIGURATION DE L'API
// ============================================================================

const API_CONFIG = {
    PROA_API: 'https://universearch.com/proa/', // Local development
    PORA_API: 'https://universearch.com/pora/',
    IDENTITY_API: 'https://api.universearch.com',
    MAIL_API: 'https://api.universearch.com',
};

// ============================================================================
// GESTION DE L'ÉTAT
// ============================================================================

let candidats = [];
let candidatsFiltrés = [];
let candidatsSelectionnés = new Set();
let pageActuelle = 1;
let articlesParPage = 25;
let totalCandidats = 0;
let statistiquesCourantes = {
    avg_score: 0,
    top_10_count: 0
};
let proaApiBlocked = false;

let filtres = {
    etablissement: '',
    scoreMin: 0,
    classement: '',
    typeUtilisateur: '',
    recherche: ''
};

let envoiMessageContext = {
    candidatId: null,
    candidatsEnAttente: [],
    indexActuel: 0
};

let tousEtablissements = {
    universites: [],
    centres: [],
    map: new Map()  // Pour recherche rapide par ID
};

// ============================================================================
// INITIALISATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    initPage();
    setupEventListeners();
    checkAPIStatus();
});

function initPage() {
    setTimeout(() => {
        const loader = document.getElementById('page-loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.style.display = 'none', 300);
        }
    }, 500);
    
    // Charger tous les établissements
    chargerEtablissements();
}

async function chargerEtablissements() {
    try {
        // Charger depuis le mail-service qui a accès à Supabase
        const response = await fetch(`${API_CONFIG.MAIL_API}/api/etablissements`);
        
        if (response.ok) {
            const data = await response.json();
            tousEtablissements.universites = data.universites || [];
            tousEtablissements.centres = data.centres || [];
            
            // Construire la map pour recherche rapide
            tousEtablissements.universites.forEach(u => {
                tousEtablissements.map.set(u.id, {
                    ...u,
                    target_type: 'universite',
                    score: 0,
                    rank: 0,
                    confidence: 0
                });
            });
            tousEtablissements.centres.forEach(c => {
                tousEtablissements.map.set(c.id, {
                    ...c,
                    target_type: 'centre',
                    score: 0,
                    rank: 0,
                    confidence: 0
                });
            });
            
            console.log(`✅ ${tousEtablissements.universites.length} universités + ${tousEtablissements.centres.length} centres chargés`);
        } else {
            console.warn('⚠️ API établissements indisponible, utilisation des données de recommandation');
        }
    } catch (error) {
        console.warn('⚠️ Impossible de charger les établissements:', error.message);
    }
}

async function checkAPIStatus() {
    try {
        console.log('🔍 Vérification du statut de l\'API PROA...');
        console.log('🌐 URL appelée:', `${API_CONFIG.PROA_API}/health`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 secondes timeout

        const response = await fetch(`${API_CONFIG.PROA_API}/health`, {
            method: 'GET',
            signal: controller.signal,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            console.log('✅ L\'API PROA est accessible');
            chargerCandidats();
        } else {
            throw new Error(`L'API a retourné ${response.status}: ${response.statusText}`);
        }
    } catch (error) {
        console.error('❌ Erreur d\'accès à l\'API PROA:', error.message);

        // Gestion spécifique des erreurs de blocage client
        if (error.message.includes('ERR_BLOCKED_BY_CLIENT') ||
            error.message.includes('blocked') ||
            error.message.includes('CORS')) {

            afficherToast(`
                🚫 <strong>Connexion bloquée par le navigateur</strong><br>
                <small>Causes possibles :</small><br>
                • Bloqueur de publicités (uBlock, AdBlock, etc.)<br>
                • Extension de sécurité<br>
                • Politique réseau d'entreprise<br><br>
                <strong>Solutions :</strong><br>
                1. Désactivez temporairement votre bloqueur de pubs<br>
                2. Essayez en navigation privée (Ctrl+Shift+N)<br>
                3. Videz le cache du navigateur<br>
                4. Contactez votre administrateur réseau
            `, 'error', 15000); // Toast plus long pour les instructions

            console.warn('💡 Conseils pour débloquer:');
            console.warn('   1. Désactiver uBlock/AdBlock pour render.com');
            console.warn('   2. Mode navigation privée');
            console.warn('   3. Vider cache: Ctrl+Shift+R');
            console.warn('   4. Extensions: vérifier NoScript/HTTPS Everywhere');

        } else if (error.name === 'AbortError') {
            afficherToast('⏱️ Timeout: L\'API PROA ne répond pas (délai dépassé)', 'warning');
        } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            afficherToast('🌐 Erreur réseau: Vérifiez votre connexion internet', 'error');
        } else {
            afficherToast(`❌ Erreur API: ${error.message}`, 'error');
        }

        // Afficher un message dans l'interface pour guider l'utilisateur
        afficherMessageSysteme(`
            <div style="text-align: center; padding: 20px;">
                <h3>🔧 Problème de connexion détecté</h3>
                <p>Le service de recommandations PROA n'est pas accessible depuis votre navigateur.</p>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; text-align: left;">
                    <strong>Actions recommandées :</strong>
                    <ol style="margin: 10px 0;">
                        <li>Désactivez votre bloqueur de publicités pour <code>render.com</code></li>
                        <li>Essayez en navigation privée</li>
                        <li>Videz le cache (Ctrl+F5)</li>
                        <li>Vérifiez vos extensions de sécurité</li>
                    </ol>
                </div>
                <button onclick="checkAPIStatus()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    🔄 Réessayer la connexion
                </button>
            </div>
        `);

        // Afficher l'interface de secours
        setTimeout(() => {
            console.log('Chargement des données simulées...');
            candidats = genererCandidatsSimulés(10);
            totalCandidats = candidats.length;
            statistiquesCourantes = calculerStatistiques(candidats);
            mettreAJourStatistiques();
            afficherCandidats();
        }, 1000);
    }
}

function setupEventListeners() {
    document.getElementById('filter-score').addEventListener('input', (e) => {
        document.getElementById('score-value').textContent = parseFloat(e.target.value).toFixed(1);
        appliquerFiltres();
    });

    document.getElementById('filter-establishment').addEventListener('change', appliquerFiltres);
    document.getElementById('filter-rank').addEventListener('change', appliquerFiltres);
    document.getElementById('filter-usertype').addEventListener('change', appliquerFiltres);
    document.getElementById('filter-search').addEventListener('input', appliquerFiltres);
}

function resolveCurrentUserId() {
    const candidates = [];

    try {
        const sessionRaw = localStorage.getItem('softura_session') || localStorage.getItem('session') || '{}';
        const session = JSON.parse(sessionRaw);
        candidates.push(session.user_id, session.id, session.userId, session.profile_id, session.profileId, session.user?.id, session.user?.user_id);
    } catch {
        // Ignore malformed session storage
    }

    const token = localStorage.getItem('softura_token') || localStorage.getItem('token') || '';
    if (token) {
        const parts = token.split('.');
        if (parts.length >= 2) {
            try {
                const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
                candidates.push(payload.user_id, payload.id, payload.sub, payload.userId, payload.profile_id, payload.profileId);
            } catch {
                // Ignore malformed JWT payload
            }
        }
    }

    candidates.push(sessionStorage.getItem('user-id'), localStorage.getItem('user-id'), localStorage.getItem('softura_user_id'));

    const resolved = candidates.find(value => value && String(value).trim());
    return resolved ? String(resolved) : 'anonymous';
}

function afficherCandidatsSimules(message = 'Utilisation des donnees simulees (API indisponible)') {
    console.log('Chargement des donnees simulees...');
    candidats = genererCandidatsSimulés(10);
    totalCandidats = candidats.length;
    statistiquesCourantes = calculerStatistiques(candidats);
    mettreAJourStatistiques();
    afficherCandidats();
    afficherToast(message, 'info');
}

// ============================================================================
// CHARGEMENT DES DONNÉES
// ============================================================================

async function chargerCandidats() {
    try {
        afficherToast('📥 Chargement des candidats recommandés...', 'info');
        
        const normalizedBase = (API_CONFIG.PROA_API || '').replace(/\/+$/, '');
        const payload = {
            user_id: resolveCurrentUserId(),
            target_id: filtres.etablissement || '',
            score_min: filtres.scoreMin || 0,
            rank: filtres.classement || '',
            user_type: filtres.typeUtilisateur || '',
            search: filtres.recherche || '',
            limit: articlesParPage,
            offset: (pageActuelle - 1) * articlesParPage
        };

        const url = `${normalizedBase}/recommendations/universites`;
        console.log(`📡 Récupération: ${url}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // Délai d'expiration de 30s (augmenté pour les jointures)

        const token = localStorage.getItem('softura_token') || localStorage.getItem('token') || '';
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        // If server rejects POST with 405, attempt a GET fallback (some deployments expose GET-only)
        if (!response.ok) {
            if (response.status === 405) {
                console.warn('POST rejected with 405, attempting GET fallback for recommendations');
                // Build query string from payload
                const params = new URLSearchParams();
                Object.keys(payload).forEach(k => {
                    const v = payload[k];
                    if (v === undefined || v === null) return;
                    if (Array.isArray(v)) {
                        v.forEach(item => params.append(k, String(item)));
                    } else {
                        params.set(k, String(v));
                    }
                });
                const getUrl = `${url}?${params.toString()}`;
                const getController = new AbortController();
                const getTimeout = setTimeout(() => getController.abort(), 30000);
                const getResp = await fetch(getUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    signal: getController.signal
                });
                clearTimeout(getTimeout);
                if (!getResp.ok) {
                    const errBody = await getResp.text();
                    console.error(`GET fallback failed: ${getResp.status}`, errBody);
                    throw new Error(`Erreur API (GET fallback): ${getResp.status} ${getResp.statusText}`);
                }
                const data = await getResp.json();
                console.log('✅ Candidats chargés (GET fallback):', data);
                const candidatsNormalises = normaliserCandidats(data.candidates || []);
                candidats = candidatsNormalises;
                totalCandidats = candidatsNormalises.length === (data.candidates || []).length
                    ? (data.total || candidatsNormalises.length)
                    : candidatsNormalises.length;
                statistiquesCourantes = candidatsNormalises.length === (data.candidates || []).length
                    ? (data.stats || calculerStatistiques(candidatsNormalises))
                    : calculerStatistiques(candidatsNormalises);
                mettreAJourStatistiques();
                afficherCandidats();
                afficherToast(`✅ ${candidats.length} candidat(s) chargé(s) (GET fallback)`, 'success');
                return;
            }
            const errorBody = await response.text();
            console.error(`Erreur API: ${response.status}`, errorBody);
            throw new Error(`Erreur API: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('✅ Candidats chargés:', data);

        const candidatsNormalises = normaliserCandidats(data.candidates || []);
        candidats = candidatsNormalises;
        totalCandidats = candidatsNormalises.length === (data.candidates || []).length
            ? (data.total || candidatsNormalises.length)
            : candidatsNormalises.length;
        statistiquesCourantes = candidatsNormalises.length === (data.candidates || []).length
            ? (data.stats || calculerStatistiques(candidatsNormalises))
            : calculerStatistiques(candidatsNormalises);
        
        mettreAJourStatistiques();
        afficherCandidats();
        
        afficherToast(`✅ ${candidats.length} candidat(s) chargé(s)`, 'success');
        
    } catch (error) {
        console.error('❌ Erreur lors du chargement des candidats:', error);
        
        let errorMsg = 'Erreur lors du chargement des candidats';
        if (error.name === 'AbortError') {
            errorMsg = '⏱️ Délai d\'attente dépassé (>30s): Le serveur n\'a pas répondu assez rapidement. Vérifiez votre connexion ou réessayez.';
        } else if (error.message.includes('Failed to fetch')) {
            errorMsg = `❌ Impossible de se connecter à ${API_CONFIG.PROA_API}. Le serveur PROA est-il en cours d'exécution?`;
        }
        
        afficherToast(errorMsg, 'error');
        
        // Utiliser les données simulées comme secours pour les tests
        console.log('📋 Chargement des données simulées...');
        candidats = genererCandidatsSimulés(10);
        totalCandidats = candidats.length;
        statistiquesCourantes = calculerStatistiques(candidats);
        mettreAJourStatistiques();
        afficherCandidats();
        afficherToast('📋 Utilisation des données simulées (API indisponible)', 'info');
    }
}

// ============================================================================
// FILTRAGE ET RECHERCHE
// ============================================================================

function appliquerFiltres() {
    // Mettre à jour les valeurs des filtres à partir de l'interface utilisateur
    filtres.etablissement = document.getElementById('filter-establishment').value;
    filtres.scoreMin = parseFloat(document.getElementById('filter-score').value);
    filtres.classement = document.getElementById('filter-rank').value;
    filtres.typeUtilisateur = document.getElementById('filter-usertype').value;
    filtres.recherche = document.getElementById('filter-search').value;

    // Réinitialiser à la page 1 et recharger avec les nouveaux filtres
    pageActuelle = 1;
    chargerCandidats();
}

function reinitialiserFiltres() {
    document.getElementById('filter-establishment').value = '';
    document.getElementById('filter-score').value = '0';
    document.getElementById('score-value').textContent = '0.0';
    document.getElementById('filter-rank').value = '';
    document.getElementById('filter-usertype').value = '';
    document.getElementById('filter-search').value = '';
    filtres = { etablissement: '', scoreMin: 0, classement: '', typeUtilisateur: '', recherche: '' };
    appliquerFiltres();
}

// ============================================================================
// AFFICHAGE DU TABLEAU ET PAGINATION
// ============================================================================

function extraireFilieres(reason) {
    /*
    Extraire les filières du champ reason.
    Format: "Matched fields: Filière 1, Filière 2, Filière 3"
    Retourne: "Filière 1, Filière 2, Filière 3"
    */
    if (!reason) return 'N/D';
    
    const prefix = 'Matched fields: ';
    if (!reason.startsWith(prefix)) return reason;
    
    return reason
        .replace(prefix, '')
        .split(',')
        .map(f => f.trim())
        .join(', ');
}

function calculerStatistiques(liste = []) {
    const candidatsList = Array.isArray(liste) ? liste : [];
    const avgScore = candidatsList.length > 0
        ? candidatsList.reduce((sum, candidat) => sum + (Number(candidat.score) || 0), 0) / candidatsList.length
        : 0;
    const top10Count = candidatsList.filter(candidat => {
        const rank = Number(candidat.rank) || 0;
        return rank > 0 && rank <= 10;
    }).length;

    return {
        avg_score: avgScore,
        top_10_count: top10Count
    };
}

function normaliserRecommandations(candidat = {}) {
    const recommandationsBrutes = Array.isArray(candidat.recommendations) && candidat.recommendations.length > 0
        ? candidat.recommendations
        : (candidat.target_name ? [{
            target_id: candidat.target_id || '',
            target_name: candidat.target_name,
            target_type: candidat.target_type || '',
            score: candidat.score,
            rank: candidat.rank,
            confidence: candidat.confidence
        }] : []);

    const uniques = new Map();

    recommandationsBrutes.forEach(item => {
        if (!item || !item.target_name) return;

        const recommandation = {
            target_id: item.target_id || '',
            target_name: item.target_name || 'N/D',
            target_type: item.target_type || '',
            score: Number(item.score ?? candidat.score ?? 0),
            rank: Number(item.rank ?? candidat.rank ?? 0),
            confidence: Number(item.confidence ?? candidat.confidence ?? 0)
        };

        const key = `${recommandation.target_type}::${recommandation.target_id || recommandation.target_name}`;
        const existing = uniques.get(key);

        if (!existing || recommandation.score > existing.score) {
            uniques.set(key, recommandation);
        }
    });

    return Array.from(uniques.values()).sort((a, b) =>
        (b.score - a.score) ||
        ((a.rank || Number.MAX_SAFE_INTEGER) - (b.rank || Number.MAX_SAFE_INTEGER)) ||
        a.target_name.localeCompare(b.target_name, 'fr')
    );
}

function normaliserCandidats(candidatsApi = []) {
    if (!Array.isArray(candidatsApi)) return [];

    const candidatsNormalises = candidatsApi.map(candidat => {
        const recommandations = normaliserRecommandations(candidat);
        const topRecommandation = recommandations[0] || {};

        return {
            ...candidat,
            id: candidat.id || `${candidat.user_id || 'candidat'}::${candidat.session_id || topRecommandation.target_id || topRecommandation.target_name || 'ligne'}`,
            score: Number(candidat.score || 0),
            rank: Number(candidat.rank || 0),
            confidence: Number(candidat.confidence || 0),
            recommendations: recommandations,
            recommendation_count: recommandations.length,
            target_id: candidat.target_id || topRecommandation.target_id || '',
            target_name: candidat.target_name || topRecommandation.target_name || '',
            target_type: candidat.target_type || topRecommandation.target_type || '',
            name: candidat.name || 'N/D',
            email: candidat.email || '',
            telephone: candidat.telephone || '',
            user_type: candidat.user_type || candidat.userType || 'N/D'
        };
    });

    return candidatsNormalises.sort((a, b) =>
        (b.score - a.score) ||
        (b.confidence - a.confidence) ||
        String(b.created_at || '').localeCompare(String(a.created_at || ''))
    );
}

function separerRecommandations(candidat = {}) {
    const recommendations = normaliserRecommandations(candidat);

    return {
        recommendations,
        universites: recommendations.filter(item => item.target_type === 'universite'),
        centres: recommendations.filter(item => item.target_type === 'centre')
    };
}

function construireCandidatPourModal(candidat = {}) {
    if (!candidat) return null;

    const candidatsAssocies = candidats.filter(item =>
        item &&
        item.user_id === candidat.user_id &&
        item.session_id &&
        candidat.session_id &&
        item.session_id === candidat.session_id
    );

    if (candidatsAssocies.length === 0) {
        return {
            ...candidat,
            recommendations: normaliserRecommandations(candidat)
        };
    }

    const candidatModal = {
        ...candidat,
        score: 0,
        rank: Number(candidat.rank) || 0,
        confidence: 0,
        recommendations: []
    };

    candidatsAssocies.forEach(item => {
        const score = Number(item.score || 0);
        const confidence = Number(item.confidence || 0);
        const rank = Number(item.rank || 0);

        if (score > candidatModal.score) {
            candidatModal.score = score;
            candidatModal.reason = item.reason || candidatModal.reason;
            candidatModal.filiere = item.filiere || candidatModal.filiere;
        }

        if (confidence > candidatModal.confidence) {
            candidatModal.confidence = confidence;
        }

        if (!candidatModal.rank || (rank > 0 && rank < candidatModal.rank)) {
            candidatModal.rank = rank;
        }

        if (String(item.created_at || '') > String(candidatModal.created_at || '')) {
            candidatModal.created_at = item.created_at || candidatModal.created_at;
        }

        candidatModal.recommendations.push(...normaliserRecommandations(item));
    });

    candidatModal.recommendations = normaliserRecommandations(candidatModal);
    const topRecommandation = candidatModal.recommendations[0] || {};
    candidatModal.target_id = topRecommandation.target_id || candidat.target_id || '';
    candidatModal.target_name = topRecommandation.target_name || candidat.target_name || '';
    candidatModal.target_type = topRecommandation.target_type || candidat.target_type || '';

    return candidatModal;
}

function extraireNomPrenom(fullName = '') {
    const parts = String(fullName).trim().split(/\s+/).filter(Boolean);

    if (parts.length === 0) {
        return { first_name: '', last_name: '' };
    }

    if (parts.length === 1) {
        return { first_name: parts[0], last_name: '' };
    }

    return {
        first_name: parts[0],
        last_name: parts.slice(1).join(' ')
    };
}

function creerModalEnvoiMessageSiNecessaire() {
    if (document.getElementById('mail-selection-modal')) {
        return;
    }

    const wrapper = document.createElement('div');
    wrapper.id = 'mail-selection-modal';
    wrapper.className = 'modal';
    wrapper.innerHTML = `
        <div class="modal-content">
            <div class="flex items-center justify-between mb-6">
                <div>
                    <h2 class="text-2xl font-bold text-slate-900">Envoyer un message</h2>
                    <p class="text-sm text-slate-500 mt-1">Choisissez les universites et centres a notifier.</p>
                </div>
                <button onclick="fermerModalEnvoiMessage()" class="text-slate-500 hover:text-slate-700 text-xl">×</button>
            </div>

            <div class="space-y-5">
                <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div class="flex items-center justify-between gap-3">
                        <div>
                            <div class="font-semibold text-slate-900">Destinataires</div>
                            <div class="text-sm text-slate-500">Tout est preselectionne, vous pouvez decocher ce que vous ne voulez pas envoyer.</div>
                        </div>
                        <label class="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input type="checkbox" id="mail-select-all" class="w-4 h-4" checked onchange="basculerToutEtablissementMail(this.checked)">
                            Tout selectionner
                        </label>
                    </div>
                    <div id="mail-selection-list" class="mt-4 space-y-3 max-h-[320px] overflow-y-auto"></div>
                </div>

                <div>
                    <label for="mail-custom-message" class="block text-sm font-semibold text-slate-900 mb-2">Message complementaire</label>
                    <textarea id="mail-custom-message" rows="4" class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder="Ajoutez un message optionnel a joindre a l'email."></textarea>
                </div>

                <div class="flex gap-3 pt-2">
                    <button onclick="fermerModalEnvoiMessage()" class="flex-1 px-4 py-3 bg-slate-100 text-slate-900 rounded-lg font-medium hover:bg-slate-200">
                        Annuler
                    </button>
                    <button id="mail-send-confirm-btn" onclick="confirmerEnvoiMessage()" class="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">
                        Envoyer les emails
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(wrapper);
}

function construirePayloadMail(candidat) {
    const candidatModal = construireCandidatPourModal(candidat);
    const { first_name, last_name } = extraireNomPrenom(candidatModal.name || '');

    return {
        candidate: {
            user_id: candidatModal.user_id,
            profile_id: candidatModal.profile_id || null,
            session_id: candidatModal.session_id || null,
            first_name,
            last_name,
            full_name: candidatModal.name || '',
            email: candidatModal.email || null,
            telephone: candidatModal.telephone || null,
            user_type: candidatModal.user_type || null,
            reason: candidatModal.reason || null,
            quartier: candidatModal.quartier || null
        },
        institutions: normaliserRecommandations(candidatModal),
        custom_message: null
    };
}

function ouvrirModalEnvoiMessage(candidatId) {
    const candidat = candidats.find(item => item.id === candidatId);
    if (!candidat) {
        afficherToast('Candidat introuvable pour l envoi du message', 'error');
        return;
    }

    creerModalEnvoiMessageSiNecessaire();

    const payload = construirePayloadMail(candidat);
    envoiMessageContext.candidatId = candidatId;

    const list = document.getElementById('mail-selection-list');
    const selectAll = document.getElementById('mail-select-all');
    const textarea = document.getElementById('mail-custom-message');

    if (textarea) textarea.value = '';
    if (selectAll) selectAll.checked = true;

    list.innerHTML = payload.institutions.map((item, index) => `
        <label class="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-indigo-300">
            <input
                type="checkbox"
                class="mail-target-checkbox mt-1 w-4 h-4"
                data-index="${index}"
                checked
                onchange="synchroniserSelectionGlobaleMail()"
            >
            <div class="min-w-0">
                <div class="font-semibold text-slate-900">${item.target_name}</div>
                <div class="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span class="badge ${item.target_type === 'universite' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'}">${item.target_type}</span>
                    <span>Score ${(Number(item.score || 0) * 100).toFixed(0)}%</span>
                    <span>Rank #${item.rank || '-'}</span>
                    <span>Confiance ${(Number(item.confidence || 0) * 100).toFixed(0)}%</span>
                </div>
            </div>
        </label>
    `).join('');

    document.getElementById('mail-selection-modal').dataset.payload = JSON.stringify(payload);
    document.getElementById('mail-selection-modal').classList.add('active');
}

function fermerModalEnvoiMessage() {
    const modal = document.getElementById('mail-selection-modal');
    if (!modal) return;

    modal.classList.remove('active');
    delete modal.dataset.payload;
    envoiMessageContext.candidatId = null;
}

function basculerToutEtablissementMail(checked) {
    document.querySelectorAll('.mail-target-checkbox').forEach((checkbox) => {
        checkbox.checked = checked;
    });
}

function synchroniserSelectionGlobaleMail() {
    const checkboxes = Array.from(document.querySelectorAll('.mail-target-checkbox'));
    const selectAll = document.getElementById('mail-select-all');
    if (!selectAll || checkboxes.length === 0) return;

    selectAll.checked = checkboxes.every((checkbox) => checkbox.checked);
}

async function confirmerEnvoiMessage() {
    const modal = document.getElementById('mail-selection-modal');
    if (!modal?.dataset.payload) {
        afficherToast('Impossible de preparer l envoi des emails', 'error');
        return;
    }

    const payload = JSON.parse(modal.dataset.payload);
    const selectedIndexes = Array.from(document.querySelectorAll('.mail-target-checkbox'))
        .filter((checkbox) => checkbox.checked)
        .map((checkbox) => Number(checkbox.dataset.index));

    payload.institutions = payload.institutions.filter((_, index) => selectedIndexes.includes(index));
    payload.custom_message = document.getElementById('mail-custom-message')?.value?.trim() || null;

    if (payload.institutions.length === 0) {
        afficherToast('Selectionnez au moins une universite ou un centre', 'error');
        return;
    }

    const sendButton = document.getElementById('mail-send-confirm-btn');
    const originalLabel = sendButton.textContent;

    try {
        sendButton.disabled = true;
        sendButton.textContent = 'Envoi en cours...';

        console.log('📧 Envoi email pour candidat:', payload.candidate.full_name);
        console.log('🎯 Destinataires:', payload.institutions.length);

        const response = await fetch(`${API_CONFIG.MAIL_API}/api/mail/recommendations/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        console.log('Status:', response.status);
        console.log('Réponse backend:', result);
        console.log('Backend results:', result.results);
        console.log('Backend summary:', result.summary);

        if (!response.ok || (result.success === false && (result.summary?.sent || 0) === 0)) {
            throw new Error(result.error || result.message || 'Echec lors de l envoi des emails');
        }

        const sent = result.summary?.sent || 0;
        const skipped = result.summary?.skipped || 0;
        const failed = result.summary?.failed || 0;

        console.log(`✅ Emails envoyés: ${sent}, ignorés: ${skipped}, échecs: ${failed}`);

        fermerModalEnvoiMessage();

        // Afficher résumé
        const summaryMessages = [];
        if (sent > 0) summaryMessages.push(`${sent} envoyé(s)`);
        if (skipped > 0) summaryMessages.push(`${skipped} ignoré(s)`);
        if (failed > 0) summaryMessages.push(`${failed} échoué(s)`);
        
        afficherToast(`✅ ${payload.candidate.full_name}: ${summaryMessages.join(', ')}`, failed > 0 ? 'info' : 'success');

        // Continuer avec le prochain candidat si multi-envoi
        if (envoiMessageContext.candidatsEnAttente && envoiMessageContext.candidatsEnAttente.length > 0) {
            envoiMessageContext.indexActuel++;
            if (envoiMessageContext.indexActuel < envoiMessageContext.candidatsEnAttente.length) {
                setTimeout(() => {
                    const nextCandidat = envoiMessageContext.candidatsEnAttente[envoiMessageContext.indexActuel];
                    afficherToast(`📧 Passage au candidat suivant (${envoiMessageContext.indexActuel + 1}/${envoiMessageContext.candidatsEnAttente.length})`, 'info');
                    ouvrirModalEnvoiMessage(nextCandidat.id);
                }, 1500);
            } else {
                // Tous les candidats traités
                envoiMessageContext.candidatsEnAttente = [];
                envoiMessageContext.indexActuel = 0;
                afficherToast(`✅ Tous les candidats ont été traités!`, 'success');
            }
        }
    } catch (error) {
        console.error('❌ Erreur d envoi email:', error);
        afficherToast(error.message || 'Impossible d envoyer les emails', 'error');
    } finally {
        sendButton.disabled = false;
        sendButton.textContent = originalLabel;
    }
}

function renderRecommendationPreview(candidat) {
    const candidatModal = construireCandidatPourModal(candidat);
    const { recommendations, universites, centres } = separerRecommandations(candidatModal);

    if (recommendations.length === 0) {
        return `<span class="text-xs text-slate-400">Aucune</span>`;
    }

    return `
        <div class="flex flex-col items-center gap-2">
            <div class="text-xs font-medium text-slate-500">${recommendations.length} etablissement(s)</div>
            <div class="flex flex-wrap justify-center gap-1">
                ${universites.length > 0 ? `<span class="badge bg-indigo-50 text-indigo-700">${universites.length} universite(s)</span>` : ''}
                ${centres.length > 0 ? `<span class="badge bg-emerald-50 text-emerald-700">${centres.length} centre(s)</span>` : ''}
            </div>
            <button class="action-btn action-btn-secondary" onclick="afficherDetailCandidats('${candidat.id}')">
                <i class="fas fa-eye"></i>Voir etablissements
            </button>
        </div>
    `;
}

function renderRecommendationGroup(title, iconClass, items, emptyText) {
    const content = items.length > 0
        ? items.map(item => `
            <div class="rounded-lg border border-slate-200 bg-white px-3 py-3">
                <div class="font-semibold text-slate-900">${item.target_name}</div>
                <div class="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>Score ${Math.round((item.score || 0) * 100)}%</span>
                    <span>Rank #${item.rank || '-'}</span>
                    <span>Confiance ${Math.round((item.confidence || 0) * 100)}%</span>
                </div>
            </div>
        `).join('')
        : `<p class="text-sm text-slate-500">${emptyText}</p>`;

    return `
        <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div class="mb-3 flex items-center justify-between">
                <div class="flex items-center gap-2 text-slate-900">
                    <i class="fas ${iconClass} text-indigo-600"></i>
                    <span class="font-semibold">${title}</span>
                </div>
                <span class="badge bg-slate-200 text-slate-700">${items.length}</span>
            </div>
            <div class="space-y-3">
                ${content}
            </div>
        </div>
    `;
}

function formatRecommandationsPourExport(candidat) {
    const { universites, centres } = separerRecommandations(candidat);
    const parts = [];

    if (universites.length > 0) {
        parts.push(`Universites: ${universites.map(item => item.target_name).join(' | ')}`);
    }

    if (centres.length > 0) {
        parts.push(`Centres: ${centres.map(item => item.target_name).join(' | ')}`);
    }

    return parts.join(' || ') || 'N/D';
}

function afficherCandidats() {
    const tbody = document.getElementById('candidates-table-body');
    const emptyState = document.getElementById('empty-state');

    // Afficher/masquer l'état vide
    if (candidats.length === 0) {
        tbody.innerHTML = '';
        emptyState.classList.remove('hidden');
        mettreAJourBoutonsPagination();
        return;
    }

    emptyState.classList.add('hidden');
    tbody.innerHTML = '';

    // Afficher les candidats de la page actuelle (déjà paginés par l'API)
    candidats.forEach(candidat => {
        const row = creerLigneCandidats(candidat);
        tbody.appendChild(row);
    });

    mettreAJourBoutonsPagination();
}

function creerLigneCandidats(candidat) {
    const row = document.createElement('tr');
    const nomAffiche = candidat.name || 'N/D';
    const emailAffiche = candidat.email || 'N/D';
    const recommandationsHtml = renderRecommendationPreview(candidat);
    
    // Insigne de classement
    let badgeClassement = '';
    if (candidat.rank <= 10) {
        badgeClassement = `<span class="badge badge-rank-1">🥇 #${candidat.rank}</span>`;
    } else if (candidat.rank <= 50) {
        badgeClassement = `<span class="badge badge-rank-2">🥈 #${candidat.rank}</span>`;
    } else if (candidat.rank <= 100) {
        badgeClassement = `<span class="badge badge-rank-3">🥉 #${candidat.rank}</span>`;
    } else {
        badgeClassement = `<span class="badge badge-rank-2">#${candidat.rank}</span>`;
    }

    row.innerHTML = `
        <td>
            <input type="checkbox" class="candidate-checkbox w-4 h-4" value="${candidat.id}" 
                   onchange="basculerSelection('${candidat.id}')">
        </td>
        <td>
            <div class="font-medium text-slate-900 cursor-pointer hover:text-indigo-600" 
                 onclick="afficherDetailCandidats('${candidat.id}')">
                ${nomAffiche}
            </div>
            <div class="text-xs text-slate-500">${emailAffiche}</div>
        </td>
        <td>
            <span class="text-sm text-slate-700">${candidat.user_type || 'N/D'}</span>
        </td>
        <td>
            <span class="text-sm text-slate-700">${extraireFilieres(candidat.reason || candidat.filiere || 'N/D')}</span>
        </td>
        <td style="text-align: center;">
            <span class="badge badge-score">${(candidat.score * 100).toFixed(0)}%</span>
        </td>
        <td style="text-align: center;">
            ${badgeClassement}
        </td>
        <td style="text-align: center;">
            <div class="text-sm font-medium text-slate-900">${(candidat.confidence * 100).toFixed(0)}%</div>
        </td>
        <td style="text-align: center;">
            ${recommandationsHtml}
        </td>
        <td style="text-align: center;">
            <div class="text-xs text-slate-500">${formaterDate(candidat.created_at)}</div>
        </td>
    `;

    return row;
}

function mettreAJourBoutonsPagination() {
    const totalPages = Math.ceil(totalCandidats / articlesParPage);
    document.getElementById('btn-prev').disabled = pageActuelle === 1;
    document.getElementById('btn-next').disabled = pageActuelle >= totalPages;
    document.getElementById('page-info').textContent = `Page ${pageActuelle} sur ${totalPages || 1}`;
    
    const start = (pageActuelle - 1) * articlesParPage + 1;
    const end = Math.min(pageActuelle * articlesParPage, totalCandidats);
    document.getElementById('showing-count').textContent = totalCandidats > 0 ? start : 0;
    document.getElementById('total-count').textContent = totalCandidats;
}

function pagesuivante() {
    const totalPages = Math.ceil(totalCandidats / articlesParPage);
    if (pageActuelle < totalPages) {
        pageActuelle++;
        chargerCandidats();
        window.scrollTo(0, 0);
    }
}

function pagePrecedente() {
    if (pageActuelle > 1) {
        pageActuelle--;
        chargerCandidats();
        window.scrollTo(0, 0);
    }
}

// ============================================================================
// SÉLECTION ET ACTIONS
// ============================================================================

function basculerSelection(candidatId) {
    if (candidatsSelectionnés.has(candidatId)) {
        candidatsSelectionnés.delete(candidatId);
    } else {
        candidatsSelectionnés.add(candidatId);
    }
    mettreAJourInterfaceSelection();
}

function basculerSelectTout() {
    const checkbox = document.getElementById('select-all');
    const checkboxes = document.querySelectorAll('.candidate-checkbox');

    if (checkbox.checked) {
        checkboxes.forEach(cb => {
            candidatsSelectionnés.add(cb.value);
            cb.checked = true;
        });
    } else {
        checkboxes.forEach(cb => {
            candidatsSelectionnés.delete(cb.value);
            cb.checked = false;
        });
    }
    mettreAJourInterfaceSelection();
}

function mettreAJourInterfaceSelection() {
    document.getElementById('stat-selected').textContent = candidatsSelectionnés.size;
    
    // Mettre à jour l'état des boutons
    const exportBtn = document.getElementById('btn-export-csv');
    const emailBtn = document.getElementById('btn-send-email');
    
    if (candidatsSelectionnés.size > 0) {
        exportBtn.disabled = false;
        emailBtn.disabled = false;
    } else {
        exportBtn.disabled = true;
        emailBtn.disabled = true;
    }
}

// ============================================================================
// EXPORT ET ACTIONS
// ============================================================================

function exporterCSV() {
    if (candidatsSelectionnés.size === 0) {
        afficherToast('Veuillez sélectionner au moins un candidat', 'error');
        return;
    }

    const donneesSelectionnees = candidats.filter(c => candidatsSelectionnés.has(c.id));
    
    // En-têtes
    const entetes = ['ID', 'Nom', 'Email', 'Type', 'Téléphone', 'Filière', 'Score', 'Classement', 'Confiance', 'Recommandations', 'Date'];
    
    // Lignes
    const lignes = donneesSelectionnees.map(c => [
        c.id,
        c.name,
        c.email,
        c.user_type,
        c.telephone || 'N/D',
        extraireFilieres(c.reason || c.filiere || 'N/D'),
        (c.score * 100).toFixed(0) + '%',
        c.rank,
        (c.confidence * 100).toFixed(0) + '%',
        formatRecommandationsPourExport(c),
        formaterDate(c.created_at)
    ]);

    // Créer le CSV
    let csv = entetes.join(',') + '\n';
    lignes.forEach(ligne => {
        csv += ligne.map(cellule => `"${cellule}"`).join(',') + '\n';
    });

    // Télécharger
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `candidats_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    afficherToast(`✅ ${candidatsSelectionnés.size} candidat(s) exporté(s)`, 'success');
}

function envoyerEmail() {
    if (candidatsSelectionnés.size === 0) {
        afficherToast('Veuillez sélectionner au moins un candidat', 'error');
        return;
    }

    const candidatsAEnvoyer = candidats.filter(c => candidatsSelectionnés.has(c.id));
    afficherModalEnvoiGlobal(candidatsAEnvoyer);
}

/**
 * 🎯 NOUVELLE MODAL UNIFIÉE
 * Affiche les établissements recommandés pour les candidats sélectionnés
 * Avec filtrage et sélection
 */
function envoyerEmailPourCandidat(candidatId) {
    const candidat = candidats.find(c => c.id === candidatId);
    if (!candidat) {
        afficherToast('Candidat non trouvé', 'error');
        return;
    }
    afficherModalEnvoiGlobal([candidat]);
}
function afficherModalEnvoiGlobal(candidatsAEnvoyer) {
    // Créer la modal si elle n'existe pas
    if (!document.getElementById('global-send-modal')) {
        const wrapper = document.createElement('div');
        wrapper.id = 'global-send-modal';
        wrapper.className = 'modal';
        document.body.appendChild(wrapper);
    }

    const modal = document.getElementById('global-send-modal');

    // Collecter les établissements RECOMMANDÉS pour ces candidats (pour pré-cocher)
    const etablissementsRecommendesMap = new Map();
    
    candidatsAEnvoyer.forEach(candidat => {
        const candidatModal = construireCandidatPourModal(candidat);
        const recommendations = normaliserRecommandations(candidatModal);
        
        recommendations.forEach(inst => {
            const key = inst.target_id;
            if (!etablissementsRecommendesMap.has(key)) {
                etablissementsRecommendesMap.set(key, {
                    ...inst,
                    count_candidats: 0,
                    candidats_ids: []
                });
            }
            const existing = etablissementsRecommendesMap.get(key);
            existing.count_candidats += 1;
            if (!existing.candidats_ids.includes(candidat.id)) {
                existing.candidats_ids.push(candidat.id);
            }
        });
    });

    // UTILISER TOUS les établissements (pas seulement les recommandés)
    const universites = tousEtablissements.universites.map(u => {
        const recommande = etablissementsRecommendesMap.get(u.id);
        return {
            id: u.id,
            target_id: u.id,
            target_name: u.nom,
            target_type: 'universite',
            email: u.email,
            score: recommande ? recommande.score : 0,
            rank: recommande ? recommande.rank : 0,
            confidence: recommande ? recommande.confidence : 0,
            isRecommended: !!recommande,
            count_candidats: recommande ? recommande.count_candidats : 0
        };
    });

    const centres = tousEtablissements.centres.map(c => {
        const recommande = etablissementsRecommendesMap.get(c.id);
        return {
            id: c.id,
            target_id: c.id,
            target_name: c.nom,
            target_type: 'centre',
            email: c.email,
            score: recommande ? recommande.score : 0,
            rank: recommande ? recommande.rank : 0,
            confidence: recommande ? recommande.confidence : 0,
            isRecommended: !!recommande,
            count_candidats: recommande ? recommande.count_candidats : 0
        };
    });

    // Construire la modal
    modal.innerHTML = `
        <div class="modal-content">
            <div class="flex items-center justify-between mb-6">
                <div>
                    <h2 class="text-2xl font-bold text-slate-900">Envoyer des emails</h2>
                    <p class="text-sm text-slate-500 mt-1">Sélectionnez les établissements à notifier.</p>
                </div>
                <button onclick="fermerModalEnvoiGlobal()" class="text-slate-500 hover:text-slate-700 text-xl">×</button>
            </div>

            <div class="space-y-5">
                <!-- Résumé des candidats -->
                <div class="rounded-xl border border-blue-200 bg-blue-50 p-4">
                    <div class="text-sm font-semibold text-blue-900">
                        📋 ${candidatsAEnvoyer.length} candidat(s) sélectionné(s)
                    </div>
                    <div class="mt-2 flex flex-wrap gap-2">
                        ${candidatsAEnvoyer.map(c => `
                            <span class="badge bg-blue-100 text-blue-700">${c.name || 'N/D'}</span>
                        `).join('')}
                    </div>
                </div>

                <!-- Filtres -->
                <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div class="grid grid-cols-2 gap-3 mb-4">
                        <div>
                            <label class="block text-xs font-semibold text-slate-700 mb-2">Filtrer par type</label>
                            <select id="global-filter-type" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
                                <option value="">Tous les types</option>
                                <option value="universite">Universités</option>
                                <option value="centre">Centres de formation</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-slate-700 mb-2">Filtrer par recommandation</label>
                            <select id="global-filter-recommended" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
                                <option value="">Tous</option>
                                <option value="recommended">Recommandés seulement</option>
                                <option value="not-recommended">Non-recommandés</option>
                            </select>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <input type="checkbox" id="global-select-all" class="w-4 h-4" checked onchange="basculerToutEtablissementGlobal(this.checked)">
                        <label for="global-select-all" class="text-sm font-medium text-slate-700">Tout sélectionner</label>
                    </div>
                </div>

                <!-- Liste des établissements -->
                <div class="rounded-xl border border-slate-200 bg-white p-4 max-h-[400px] overflow-y-auto">
                    <div class="mb-3 flex items-center justify-between sticky top-0 bg-white">
                        <h3 class="font-semibold text-slate-900">Établissements disponibles</h3>
                        <span class="badge bg-slate-200 text-slate-700" id="etablissements-count">${universites.length + centres.length}</span>
                    </div>
                    
                    <!-- Universités -->
                    ${universites.length > 0 ? `
                        <div class="mb-4">
                            <h4 class="text-sm font-semibold text-indigo-900 mb-2 flex items-center gap-2">
                                <i class="fas fa-university text-indigo-600"></i>
                                Universités (${universites.length})
                            </h4>
                            <div class="space-y-2 pl-6">
                                ${universites.map((inst, idx) => `
                                    <label class="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 hover:border-indigo-300 hover:bg-indigo-50">
                                        <input
                                            type="checkbox"
                                            class="global-etablissement-checkbox mt-1 w-4 h-4"
                                            data-id="${inst.target_id}"
                                            data-type="universite"
                                            data-recommended="${inst.isRecommended}"
                                            ${inst.isRecommended ? 'checked' : ''}
                                            onchange="synchroniserSelectionGlobal()"
                                        >
                                        <div class="min-w-0 flex-1">
                                            <div class="font-medium text-slate-900 flex items-center gap-2">
                                                ${inst.target_name}
                                                ${inst.isRecommended ? '<span class="badge bg-indigo-100 text-indigo-700 text-xs">Recommandé</span>' : ''}
                                            </div>
                                            <div class="text-xs text-slate-500 mt-1">${inst.email}</div>
                                            ${inst.isRecommended ? `<div class="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                                                <span class="badge bg-indigo-100 text-indigo-700">Score ${(inst.score * 100).toFixed(0)}%</span>
                                                <span class="badge bg-gray-100 text-gray-700">Rank #${inst.rank || '-'}</span>
                                                <span class="badge bg-gray-100 text-gray-700">${inst.count_candidats} candidat(s)</span>
                                            </div>` : ''}
                                        </div>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    <!-- Centres de formation -->
                    ${centres.length > 0 ? `
                        <div>
                            <h4 class="text-sm font-semibold text-emerald-900 mb-2 flex items-center gap-2">
                                <i class="fas fa-building text-emerald-600"></i>
                                Centres de formation (${centres.length})
                            </h4>
                            <div class="space-y-2 pl-6">
                                ${centres.map((inst, idx) => `
                                    <label class="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 hover:border-emerald-300 hover:bg-emerald-50">
                                        <input
                                            type="checkbox"
                                            class="global-etablissement-checkbox mt-1 w-4 h-4"
                                            data-id="${inst.target_id}"
                                            data-type="centre"
                                            data-recommended="${inst.isRecommended}"
                                            ${inst.isRecommended ? 'checked' : ''}
                                            onchange="synchroniserSelectionGlobal()"
                                        >
                                        <div class="min-w-0 flex-1">
                                            <div class="font-medium text-slate-900 flex items-center gap-2">
                                                ${inst.target_name}
                                                ${inst.isRecommended ? '<span class="badge bg-emerald-100 text-emerald-700 text-xs">Recommandé</span>' : ''}
                                            </div>
                                            <div class="text-xs text-slate-500 mt-1">${inst.email}</div>
                                            ${inst.isRecommended ? `<div class="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                                                <span class="badge bg-emerald-100 text-emerald-700">Score ${(inst.score * 100).toFixed(0)}%</span>
                                                <span class="badge bg-gray-100 text-gray-700">Rank #${inst.rank || '-'}</span>
                                                <span class="badge bg-gray-100 text-gray-700">${inst.count_candidats} candidat(s)</span>
                                            </div>` : ''}
                                        </div>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>

                <!-- Message optionnel -->
                <div>
                    <label for="global-custom-message" class="block text-sm font-semibold text-slate-900 mb-2">Message complémentaire (optionnel)</label>
                    <textarea id="global-custom-message" rows="3" class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder="Ajoutez un message optionnel à joindre aux emails..."></textarea>
                </div>

                <!-- Actions -->
                <div class="flex gap-3 pt-2">
                    <button onclick="fermerModalEnvoiGlobal()" class="flex-1 px-4 py-3 bg-slate-100 text-slate-900 rounded-lg font-medium hover:bg-slate-200">
                        Annuler
                    </button>
                    <button id="global-send-confirm-btn" onclick="confirmerEnvoiEmailsGlobal()" class="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">
                        Envoyer les emails
                    </button>
                </div>
            </div>
        </div>
    `;

    // Sauvegarder les données dans la modal
    modal.dataset.candidats = JSON.stringify(candidatsAEnvoyer.map(c => ({
        id: c.id,
        name: c.name,
        email: c.email,
        user_type: c.user_type,
        telephone: c.telephone,
        reason: c.reason
    })));
    
    const tousLesEtablissementsData = [...universites, ...centres];
    modal.dataset.tousEtablissements = JSON.stringify(tousLesEtablissementsData);

    // Ajouter les event listeners
    document.getElementById('global-filter-type').addEventListener('change', () => appliquerFiltresGlobal());
    document.getElementById('global-filter-recommended').addEventListener('change', () => appliquerFiltresGlobal());

    modal.classList.add('active');
}

function appliquerFiltresGlobal() {
    const typeFilter = document.getElementById('global-filter-type').value;
    const recommendedFilter = document.getElementById('global-filter-recommended').value;

    const checkboxes = document.querySelectorAll('.global-etablissement-checkbox');
    let visibleCount = 0;

    checkboxes.forEach(checkbox => {
        const type = checkbox.dataset.type;
        const isRecommended = checkbox.dataset.recommended === 'true';
        
        let show = true;
        if (typeFilter && type !== typeFilter) show = false;
        if (recommendedFilter === 'recommended' && !isRecommended) show = false;
        if (recommendedFilter === 'not-recommended' && isRecommended) show = false;

        const label = checkbox.closest('label');
        label.style.display = show ? 'flex' : 'none';
        if (show) visibleCount++;
    });

    document.getElementById('etablissements-count').textContent = visibleCount;
}

function fermerModalEnvoiGlobal() {
    const modal = document.getElementById('global-send-modal');
    if (modal) {
        modal.classList.remove('active');
        delete modal.dataset.candidats;
        delete modal.dataset.tousEtablissements;
    }
}

function getVisibleGlobalEtablissementCheckboxes() {
    return Array.from(document.querySelectorAll('.global-etablissement-checkbox')).filter(checkbox => {
        const label = checkbox.closest('label');
        return !!label && label.offsetParent !== null && window.getComputedStyle(label).display !== 'none';
    });
}

function basculerToutEtablissementGlobal(checked) {
    getVisibleGlobalEtablissementCheckboxes().forEach(checkbox => {
        checkbox.checked = checked;
    });
}

function synchroniserSelectionGlobal() {
    const checkboxes = getVisibleGlobalEtablissementCheckboxes();
    const selectAll = document.getElementById('global-select-all');
    if (selectAll && checkboxes.length > 0) {
        selectAll.checked = checkboxes.every(cb => cb.checked);
    }
}

async function confirmerEnvoiEmailsGlobal() {
    const modal = document.getElementById('global-send-modal');
    if (!modal?.dataset.candidats) {
        afficherToast('Erreur: données manquantes', 'error');
        return;
    }

    const candidatsAEnvoyer = JSON.parse(modal.dataset.candidats);
    const tousEtablissements = JSON.parse(modal.dataset.tousEtablissements);
    
    // Récupérer les établissements sélectionnés
    const etablissementsSelectionnés = Array.from(document.querySelectorAll('.global-etablissement-checkbox:checked'))
        .map(checkbox => checkbox.dataset.id)
        .map(id => tousEtablissements.find(e => e.target_id === id))
        .filter(Boolean)
        .filter(e => e.target_id && e.target_name && ['universite', 'centre'].includes(e.target_type));

    if (etablissementsSelectionnés.length === 0) {
        afficherToast('Veuillez sélectionner au moins un établissement valide', 'error');
        return;
    }

    const messageOptional = document.getElementById('global-custom-message')?.value?.trim() || null;
    const sendButton = document.getElementById('global-send-confirm-btn');
    const originalLabel = sendButton.textContent;

    try {
        sendButton.disabled = true;
        sendButton.textContent = '⏳ Envoi en cours...';

        // Envoyer un email par candidat
        const results = [];
        for (const candidat of candidatsAEnvoyer) {
            const candidateName = (candidat.name || `Candidat ${candidat.id || candidat.user_id || 'inconnu'}`).trim();
            const emailValue = candidat.email && candidat.email.trim() !== '' ? candidat.email.trim() : null;
            const payload = {
                candidate: {
                    user_id: candidat.id || candidat.user_id || emailValue || candidateName,
                    profile_id: candidat.profile_id || null,
                    session_id: candidat.session_id || null,
                    first_name: candidateName.split(' ')[0] || null,
                    last_name: candidateName.split(' ').slice(1).join(' ') || null,
                    full_name: candidateName,
                    email: emailValue,
                    telephone: candidat.telephone?.trim() || null,
                    user_type: candidat.user_type || null,
                    reason: candidat.reason || null,
                    quartier: candidat.quartier?.trim() || null
                },
                institutions: etablissementsSelectionnés.map(e => {
                    const institution = {
                        target_id: String(e.target_id),
                        target_name: String(e.target_name),
                        target_type: String(e.target_type)
                    };
                    if (typeof e.score === 'number' && !Number.isNaN(e.score) && e.score >= 0 && e.score <= 1) {
                        institution.score = e.score;
                    }
                    if (typeof e.rank === 'number' && Number.isInteger(e.rank) && e.rank > 0) {
                        institution.rank = e.rank;
                    }
                    if (typeof e.confidence === 'number' && !Number.isNaN(e.confidence) && e.confidence >= 0 && e.confidence <= 1) {
                        institution.confidence = e.confidence;
                    }
                    return institution;
                }),
                custom_message: messageOptional,
                requested_by: {
                    admin_email: null,
                    admin_name: null
                }
            };

            console.log("Payload envoyé :", payload);

            const response = await fetch(`${API_CONFIG.MAIL_API}/api/mail/recommendations/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            console.log("Status:", response.status);
            console.log("Réponse backend:", data);
            console.log("Backend results:", data.results);
            console.log("Backend summary:", data.summary);
            if (Array.isArray(data.results) && data.results.length > 0) {
              console.log('Backend result[0] message:', data.results[0].message);
            }

            if (response.ok) {
                results.push({
                    candidat: candidat.name || candidateName,
                    success: true,
                    summary: data.summary
                });
            } else {
                const errorText = await response.text();
                let errorData = null;
                try {
                    errorData = JSON.parse(errorText);
                } catch (err) {
                    // ignore parse error
                }
                console.error('Mail API payload error:', payload, response.status, errorText);
                results.push({
                    candidat: candidat.name || candidateName,
                    success: false,
                    error: `HTTP ${response.status}${errorData?.error ? ` - ${errorData.error}` : ''}`,
                    details: errorData?.details || errorText
                });
            }
        }

        // Afficher les résultats
        const successCount = results.filter(r => r.success).length;
        const totalEmails = results.reduce((sum, r) => sum + (r.summary?.sent || 0), 0);

        afficherToast(
            `✅ ${successCount}/${candidatsAEnvoyer.length} candidat(s) traité(s) - ${totalEmails} email(s) envoyé(s)`,
            'success'
        );

        fermerModalEnvoiGlobal();
        candidatsSelectionnés.clear();
        mettreAJourInterfaceSelection();

    } catch (error) {
        console.error('Erreur lors de l\'envoi:', error);
        afficherToast(`❌ Erreur: ${error.message}`, 'error');
    } finally {
        sendButton.disabled = false;
        sendButton.textContent = originalLabel;
    }
}
function afficherModalEnvoiMultiple(candidatsSelectionnés) {
    // Créer la modal si elle n'existe pas
    if (!document.getElementById('multi-send-modal')) {
        const modal = document.createElement('div');
        modal.id = 'multi-send-modal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    const modal = document.getElementById('multi-send-modal');
    modal.innerHTML = `
        <div class="modal-content">
            <div class="flex items-center justify-between mb-6">
                <div>
                    <h2 class="text-2xl font-bold text-slate-900">Envoyer des messages</h2>
                    <p class="text-sm text-slate-500 mt-1">Sélectionnez les candidats à notifier.</p>
                </div>
                <button onclick="fermerModalEnvoiMultiple()" class="text-slate-500 hover:text-slate-700 text-xl">×</button>
            </div>

            <div class="space-y-4">
                <!-- Liste des candidats sélectionnés -->
                <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div class="mb-3 flex items-center justify-between">
                        <h3 class="font-semibold text-slate-900">Candidats (${candidatsSelectionnés.length})</h3>
                        <label class="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input type="checkbox" id="multi-select-all" class="w-4 h-4" checked 
                                   onchange="basculerSelectionMultiple(this.checked)">
                            Tous sélectionner
                        </label>
                    </div>
                    <div id="multi-candidates-list" class="space-y-2 max-h-[320px] overflow-y-auto"></div>
                </div>

                <!-- Actions -->
                <div class="flex gap-3 pt-2">
                    <button onclick="fermerModalEnvoiMultiple()" class="flex-1 px-4 py-3 bg-slate-100 text-slate-900 rounded-lg font-medium hover:bg-slate-200">
                        Annuler
                    </button>
                    <button id="multi-send-btn" onclick="envoyerEmailsMultiples()" class="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">
                        Continuer vers les destinataires
                    </button>
                </div>
            </div>
        </div>
    `;

    const list = document.getElementById('multi-candidates-list');
    list.innerHTML = candidatsSelectionnés.map((candidat, index) => `
        <label class="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 hover:border-indigo-300 hover:bg-indigo-50">
            <input type="checkbox" class="multi-candidate-checkbox w-4 h-4" 
                   data-index="${index}" data-id="${candidat.id}" checked
                   onchange="synchroniserSelectionMultiple()">
            <div class="min-w-0 flex-1">
                <div class="font-medium text-slate-900">${candidat.name || 'N/D'}</div>
                <div class="text-xs text-slate-500">${candidat.email || 'N/D'}</div>
            </div>
            <div class="text-xs font-semibold text-indigo-600 bg-indigo-100 px-2 py-1 rounded">
                ${candidat.recommendation_count || 0} établissements
            </div>
        </label>
    `).join('');

    modal.classList.add('active');
}

function fermerModalEnvoiMultiple() {
    const modal = document.getElementById('multi-send-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function basculerSelectionMultiple(checked) {
    document.querySelectorAll('.multi-candidate-checkbox').forEach(checkbox => {
        checkbox.checked = checked;
    });
    synchroniserSelectionMultiple();
}

function synchroniserSelectionMultiple() {
    const checkboxes = Array.from(document.querySelectorAll('.multi-candidate-checkbox'));
    const selectAll = document.getElementById('multi-select-all');
    if (selectAll && checkboxes.length > 0) {
        selectAll.checked = checkboxes.every(cb => cb.checked);
    }
}

async function envoyerEmailsMultiples() {
    const selectedIndexes = Array.from(document.querySelectorAll('.multi-candidate-checkbox'))
        .filter(cb => cb.checked)
        .map(cb => cb.dataset.id);

    if (selectedIndexes.length === 0) {
        afficherToast('Veuillez sélectionner au moins un candidat', 'error');
        return;
    }

    fermerModalEnvoiMultiple();

    // Envoyer un email pour chaque candidat sélectionné
    const candidatsFiltrés = candidats.filter(c => selectedIndexes.includes(c.id));
    
    if (candidatsFiltrés.length === 1) {
        ouvrirModalEnvoiMessage(candidatsFiltrés[0].id);
    } else {
        // Ouvrir la modal pour le premier candidat et afficher un compteur
        envoiMessageContext.candidatsEnAttente = candidatsFiltrés;
        envoiMessageContext.indexActuel = 0;
        ouvrirModalEnvoiMessage(candidatsFiltrés[0].id);
    }
}

// ============================================================================
// MODAL ET AFFICHAGE DES DÉTAILS
// ============================================================================

function afficherDetailCandidats(candidatId) {
    const candidat = candidats.find(c => c.id === candidatId);
    if (!candidat) return;

    const candidatModal = construireCandidatPourModal(candidat);
    const modalBody = document.getElementById('modal-body');
    const nomAffiche = candidatModal.name || 'N/D';
    const { recommendations, universites, centres } = separerRecommandations(candidatModal);
    const initiales = nomAffiche
        .split(' ')
        .filter(Boolean)
        .map(n => n.charAt(0))
        .join('')
        .substring(0, 2) || 'ND';
    
    modalBody.innerHTML = `
        <div class="space-y-6">
            <!-- Profil de Base -->
            <div class="flex items-center gap-4 pb-6 border-b border-slate-200">
                <div class="w-16 h-16 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xl font-bold">
                    ${initiales}
                </div>
                <div>
                    <h3 class="text-2xl font-bold text-slate-900">${nomAffiche}</h3>
                    <p class="text-slate-600">${candidatModal.user_type || 'N/D'}</p>
                </div>
            </div>

            <!-- Coordonnées -->
            <div>
                <h4 class="font-semibold text-slate-900 mb-3">Informations de Contact</h4>
                <div class="space-y-2 text-sm">
                    <p><strong>E-mail:</strong> <a href="mailto:${candidatModal.email || ''}" class="text-indigo-600">${candidatModal.email || 'N/D'}</a></p>
                    <p><strong>Téléphone:</strong> ${candidatModal.telephone || 'N/D'}</p>
                </div>
            </div>

            <!-- Établissement -->
            <div>
                <h4 class="font-semibold text-slate-900 mb-3">Institution Recommandée</h4>
                <div class="space-y-2 text-sm">
                    <p><strong>Nom:</strong> ${candidatModal.target_name}</p>
                    <p><strong>Type:</strong> ${candidatModal.target_type === 'universite' ? 'Universite' : 'Centre de formation'}</p>
                </div>
            </div>

            <!-- Recommandations détaillées -->
            <div>
                <div class="mb-3 flex items-center justify-between">
                    <h4 class="font-semibold text-slate-900">Voir etablissements</h4>
                    <span class="badge bg-slate-200 text-slate-700">${recommendations.length} etablissement(s)</span>
                </div>
                <div class="grid gap-4 md:grid-cols-2">
                    ${renderRecommendationGroup('Universites', 'fa-building-columns', universites, 'Aucune universite recommandee pour cette session.')}
                    ${renderRecommendationGroup('Centres', 'fa-school', centres, 'Aucun centre recommande pour cette session.')}
                </div>
            </div>

            <!-- Scores -->
            <div>
                <h4 class="font-semibold text-slate-900 mb-3">Évaluation</h4>
                <div class="space-y-2">
                    <div class="flex items-center justify-between">
                        <span class="text-sm text-slate-600">Score de Correspondance</span>
                        <span class="font-bold text-indigo-600">${(candidatModal.score * 100).toFixed(0)}%</span>
                    </div>
                    <div class="w-full bg-slate-200 rounded-full h-2">
                        <div class="bg-indigo-600 h-2 rounded-full" style="width: ${candidatModal.score * 100}%"></div>
                    </div>
                </div>
                <div class="flex items-center justify-between mt-4">
                    <span class="text-sm text-slate-600">Confiance</span>
                    <span class="font-bold text-purple-600">${(candidatModal.confidence * 100).toFixed(0)}%</span>
                </div>
                <div class="flex items-center justify-between mt-3">
                    <span class="text-sm text-slate-600">Classement</span>
                    <span class="font-bold text-slate-900">#${candidatModal.rank}</span>
                </div>
            </div>

            <!-- Filière & Domaines Correspondants -->
            <div>
                <h4 class="font-semibold text-slate-900 mb-3">🎯 Domaines Correspondants</h4>
                <div class="flex flex-wrap gap-2">
                    ${(() => {
                        const filieres = extraireFilieres(candidatModal.reason || candidatModal.filiere || 'N/D').split(',').map(f => f.trim());
                        if (filieres[0] === 'N/D') {
                            return '<span class="text-sm text-slate-500">Aucune filière spécifiée</span>';
                        }
                        return filieres.map(f => 
                            `<span class="inline-block bg-indigo-100 text-indigo-800 text-xs font-semibold px-3 py-1 rounded-full">
                                ${f}
                            </span>`
                        ).join('');
                    })()}
                </div>
            </div>

            <!-- Raison de la Recommandation -->
            <div>
                <h4 class="font-semibold text-slate-900 mb-3">Raison de la Recommandation</h4>
                <p class="text-sm text-slate-700">${candidatModal.reason || 'Sans détails'}</p>
            </div>

            <!-- Actions -->
            <div class="flex gap-3 pt-4 border-t border-slate-200">
                <button onclick="fermerModal()" class="flex-1 px-4 py-2 bg-slate-100 text-slate-900 rounded-lg font-medium hover:bg-slate-200">
                    Fermer
                </button>
                <button onclick="envoyerEmailPourCandidat('${candidat.id}')" class="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">
                    Envoyer un Message
                </button>
            </div>
        </div>
    `;

    document.getElementById('modal-detail').classList.add('active');
}

function fermerModal() {
    document.getElementById('modal-detail').classList.remove('active');
}

// ============================================================================
// STATISTIQUES
// ============================================================================

function mettreAJourStatistiques() {
    // Les statistiques proviennent de la réponse de l'API
    const total = totalCandidats || 0;
    const scorePages = Number(statistiquesCourantes.avg_score || 0).toFixed(2);
    const top10 = statistiquesCourantes.top_10_count || 0;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-avg-score').textContent = scorePages;
    document.getElementById('stat-top10').textContent = top10;
    document.getElementById('stat-selected').textContent = candidatsSelectionnés.size;
}

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

function formaterDate(dateString) {
    if (!dateString) return 'N/D';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR');
    } catch {
        return dateString;
    }
}

function afficherToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast bg-${type === 'success' ? 'green' : type === 'error' ? 'red' : 'blue'}-100 text-${type === 'success' ? 'green' : type === 'error' ? 'red' : 'blue'}-800 border border-${type === 'success' ? 'green' : type === 'error' ? 'red' : 'blue'}-300 rounded-lg p-4 flex items-center gap-3`;
    
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ============================================================================
// GÉNÉRATEUR DE DONNÉES SIMULÉES (sera supprimé quand l'API sera prête)
// ============================================================================

function genererCandidatsSimulés(count) {
    const noms = ['Jean', 'Marie', 'Pierre', 'Sophie', 'Marc', 'Isabelle', 'Luc', 'Nathalie', 'André', 'Claire'];
    const noms_famille = ['Dupont', 'Martin', 'Bernard', 'Dubois', 'Laurent', 'Simon', 'Michel', 'Lefebvre', 'Lefevre', 'Moreau'];
    const filieres = ['Informatique', 'Génie Civil', 'Biologie', 'Économie', 'Droit', 'Médecine', 'Chimie', 'Physique', 'Lettres', 'Philosophie'];
    const types = ['etudiant', 'bachelier', 'lyceen'];

    const candidatsList = [];
    for (let i = 0; i < count; i++) {
        candidatsList.push({
            id: `candidat_${i + 1}`,
            session_id: `session_${i + 1}`,
            user_id: `user_${i + 1}`,
            name: `${noms[Math.floor(Math.random() * noms.length)]} ${noms_famille[Math.floor(Math.random() * noms_famille.length)]}`,
            email: `utilisateur${i + 1}@example.com`,
            telephone: `+33${Math.floor(Math.random() * 900000000 + 100000000)}`,
            user_type: types[Math.floor(Math.random() * types.length)],
            filiere: filieres[Math.floor(Math.random() * filieres.length)],
            reason: `Matched fields: ${filieres[Math.floor(Math.random() * filieres.length)]}, ${filieres[Math.floor(Math.random() * filieres.length)]}, ${filieres[Math.floor(Math.random() * filieres.length)]}`,
            score: Math.random(),
            rank: Math.floor(Math.random() * 200 + 1),
            confidence: Math.random() * 0.5 + 0.5,
            created_at: new Date(2026, 2, Math.floor(Math.random() * 16 + 1)).toISOString(),
            recommendations: [
                {
                    target_id: `univ_${i + 1}`,
                    target_name: `Universite ${i + 1}`,
                    target_type: 'universite',
                    score: Math.random() * 0.3 + 0.7,
                    rank: Math.floor(Math.random() * 5 + 1),
                    confidence: Math.random() * 0.2 + 0.8
                },
                {
                    target_id: `centre_${i + 1}`,
                    target_name: `Centre ${i + 1}`,
                    target_type: 'centre',
                    score: Math.random() * 0.3 + 0.5,
                    rank: Math.floor(Math.random() * 10 + 1),
                    confidence: Math.random() * 0.2 + 0.7
                }
            ]
        });
    }

    return candidatsList.sort((a, b) => b.score - a.score);
}

// ============================================================================
// DÉBOGAGE ET DÉPANNAGE
// ============================================================================

async function debugAPI() {
    console.log('🔧 MODE DÉBOGAGE - Test de Connexion API');
    console.log('URL de Base de l\'API:', API_CONFIG.PROA_API);
    
    // Test 1: Vérification de la santé
    try {
        const healthResponse = await fetch(`${API_CONFIG.PROA_API}/health`);
        console.log('✅ Vérification de la santé:', healthResponse.status);
    } catch (e) {
        console.error('❌ Échec de vérification de la santé:', e.message);
    }
    
    // Test 2: Informations PROA
    try {
        const infoResponse = await fetch(`${API_CONFIG.PROA_API}/api/v1/proa/info`);
        console.log('✅ Informations PROA:', infoResponse.status);
    } catch (e) {
        console.error('❌ Échec des informations PROA:', e.message);
    }
    
    // Test 3: Liste des recommandations
    try {
        const token = localStorage.getItem('softura_token') || localStorage.getItem('token') || '';
        const recsResponse = await fetch(`${API_CONFIG.PROA_API.replace(/\/+$/, '')}/recommendations/universites`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ user_id: resolveCurrentUserId(), limit: 1 })
        });
        const recsData = await recsResponse.json();
        console.log('✅ Recommandations:', recsResponse.status);
        console.log('   Total disponible:', recsData.total || recsData.candidates?.length || 0);
    } catch (e) {
        console.error('❌ Échec des recommandations:', e.message);
    }
}

// Déclenchement manuel: window.debugAPI() dans la console du navigateur
window.debugAPI = debugAPI;

// ============================================================================
// NAVIGATION
// ============================================================================

function handleLogout() {
    if (confirm('Voulez-vous vous déconnecter?')) {
        localStorage.clear();
        window.location.href = 'login.html';
    }
}
