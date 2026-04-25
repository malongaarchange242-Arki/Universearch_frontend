/**
 * EDUSAAS - Gestion des Utilisateurs
 */

// Configuration API
const IDENTITY_API = window.IDENTITY_API_BASE || 'https://universearch-9qle.onrender.com';

// Variables globales
let allUsers = [];
let filteredUsers = [];
let currentPage = 1;
let itemsPerPage = 25;
let currentFilter = 'all';

// Variables pour le mode sélecteur
let isSelectorMode = false;
let selectedUserIds = new Set();

/**
 * Initialisation de la page
 */
document.addEventListener('DOMContentLoaded', () => {
    // Vérifier si on est en mode sélecteur
    const urlParams = new URLSearchParams(window.location.search);
    isSelectorMode = urlParams.get('mode') === 'selector';
    
    initPage();
    loadUsers();
});

/**
 * Initialisation des éléments de la page
 */
function initPage() {
    // Masquer le loader après un court délai
    setTimeout(() => {
        const loader = document.getElementById('page-loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.style.display = 'none', 300);
        }
    }, 500);

    // Configurer l'interface selon le mode
    if (isSelectorMode) {
        setupSelectorMode();
    } else {
        // Initialiser la navigation pour le mode normal
        initNavigation();
    }

    // Initialiser les filtres
    initFilters();

    // Initialiser la recherche
    initSearch();

    // Initialiser la pagination
    initPagination();
}

/**
 * Configuration du mode sélecteur
 */
function setupSelectorMode() {
    // Changer le titre et le sous-titre
    document.getElementById('page-title').textContent = 'Sélection d\'utilisateurs pour le ciblage';
    document.getElementById('page-subtitle').textContent = 'Sélectionnez les utilisateurs que vous souhaitez cibler avec votre campagne publicitaire.';
    
    // Afficher les contrôles de sélection
    document.getElementById('selector-controls').classList.remove('hidden');
    
    // Afficher la colonne des checkboxes
    document.getElementById('checkbox-header').classList.remove('hidden');
    
    // Masquer la colonne Actions
    const actionHeaders = document.querySelectorAll('th:last-child');
    actionHeaders.forEach(header => {
        if (header.textContent.trim() === 'Actions') {
            header.style.display = 'none';
        }
    });
}
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            // Si c'est un lien externe ou avec onclick, laisser faire
            if (link.hasAttribute('onclick') || link.getAttribute('href')) return;

            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            console.log(`Navigation vers : ${link.dataset.page || 'Home'}`);
        });
    });
}

/**
 * Initialise les filtres par type de profil
 */
function initFilters() {
    const filterSelect = document.getElementById('user-filter');

    filterSelect.addEventListener('change', () => {
        currentFilter = filterSelect.value;
        applyFilters();
    });
}

/**
 * Initialise la recherche
 */
function initSearch() {
    const searchInput = document.getElementById('user-search');

    searchInput.addEventListener('input', (e) => {
        applyFilters();
    });
}

/**
 * Initialise la pagination
 */
function initPagination() {
    // Pas d'élément items-per-page dans le HTML actuel
    // Cette fonction peut être étendue plus tard si nécessaire
}

/**
 * Charge les utilisateurs depuis l'API
 */
async function loadUsers() {
    try {
        const token = localStorage.getItem('softura_token');
        if (!token) {
            showError('Token d\'authentification manquant. Veuillez vous reconnecter.');
            return;
        }

        const response = await fetch(`${IDENTITY_API}/users?limit=1000`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                showError('Session expirée. Veuillez vous reconnecter.');
                return;
            }
            if (response.status === 403) {
                showError('Accès refusé. Vous devez avoir les droits d\'administrateur pour voir la liste des utilisateurs. Affichage de données de démonstration.');
                // Afficher des données mockées pour le développement
                console.log('🔒 Accès refusé à l\'API des utilisateurs');
                console.log('💡 Solutions possibles :');
                console.log('   1. Créer un utilisateur admin via create-admin.js');
                console.log('   2. Modifier temporairement les permissions dans users.routes.ts');
                console.log('   3. Redémarrer le service identity-service');
                console.log('📊 Affichage de données de démonstration...');
                allUsers = generateMockUsers();
                filteredUsers = [...allUsers];
                displayUsers();
                updateStats();
                return;
            }
            throw new Error(`Erreur HTTP: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
            allUsers = data.data || [];
            filteredUsers = [...allUsers];
            displayUsers();
            updateStats();
        } else {
            showError(data.error || 'Erreur lors du chargement des utilisateurs');
        }

    } catch (error) {
        console.error('Erreur lors du chargement des utilisateurs:', error);
        showError('Erreur de connexion au serveur');
    }
}

/**
 * Bascule la sélection d'un utilisateur
 */
function toggleUserSelection(userId) {
    if (selectedUserIds.has(userId)) {
        selectedUserIds.delete(userId);
    } else {
        selectedUserIds.add(userId);
    }
    updateSelectedCount();
}

/**
 * Sélectionne/désélectionne tous les utilisateurs
 */
function toggleSelectAll() {
    const selectAllCheckbox = document.getElementById('select-all');
    const userCheckboxes = document.querySelectorAll('.user-checkbox');

    if (selectAllCheckbox.checked) {
        // Sélectionner tous
        userCheckboxes.forEach(checkbox => {
            selectedUserIds.add(checkbox.value);
            checkbox.checked = true;
        });
    } else {
        // Désélectionner tous
        userCheckboxes.forEach(checkbox => {
            selectedUserIds.delete(checkbox.value);
            checkbox.checked = false;
        });
    }
    updateSelectedCount();
}

/**
 * Met à jour le compteur de sélection
 */
function updateSelectedCount() {
    const countElement = document.getElementById('selected-count');
    if (countElement) {
        countElement.textContent = selectedUserIds.size;
    }
}

/**
 * Confirme la sélection et envoie les données au parent
 */
function confirmSelection() {
    if (selectedUserIds.size === 0) {
        showNotification('Veuillez sélectionner au moins un utilisateur', 'error');
        return;
    }

    // Envoyer les utilisateurs sélectionnés à la fenêtre parente
    if (window.opener) {
        window.opener.postMessage({
            type: 'usersSelected',
            users: Array.from(selectedUserIds)
        }, window.location.origin);
        window.close();
    } else {
        showNotification('Erreur: Impossible de communiquer avec la fenêtre parente', 'error');
    }
}

/**
 * Applique les filtres de recherche et de type
 */
function applyFilters() {
    const searchTerm = document.getElementById('user-search').value.toLowerCase().trim();

    filteredUsers = allUsers.filter(user => {
        // Filtre par type d'utilisateur (user_type)
        if (currentFilter !== 'all' && user.user_type !== currentFilter) {
            return false;
        }

        // Filtre par recherche
        if (searchTerm) {
            const id = (user.id || '').toLowerCase();
            const nom = (user.nom || '').toLowerCase();
            const prenom = (user.prenom || '').toLowerCase();
            const email = (user.email || '').toLowerCase();
            const telephone = (user.telephone || '').toLowerCase();
            const type = (user.user_type || '').toLowerCase();

            return id.includes(searchTerm) ||
                   nom.includes(searchTerm) ||
                   prenom.includes(searchTerm) ||
                   email.includes(searchTerm) ||
                   telephone.includes(searchTerm) ||
                   type.includes(searchTerm);
        }

        return true;
    });

    currentPage = 1;
    displayUsers();
    updateStats();
}

/**
 * Affiche les utilisateurs dans le tableau
 */
function displayUsers() {
    const tableBody = document.getElementById('users-table-body');
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const usersToShow = filteredUsers.slice(startIndex, endIndex);

    tableBody.innerHTML = '';

    if (usersToShow.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-8 text-center text-gray-500">
                    <div class="flex flex-col items-center">
                        <svg class="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-1a3 3 0 00-3-3h-2M9 20H4v-1a3 3 0 013-3h2m3-7a4 4 0 11-8 0 4 4 0 018 0z"></path>
                        </svg>
                        <p class="text-lg font-medium">Aucun utilisateur trouvé</p>
                        <p class="text-sm">Essayez de modifier vos critères de recherche</p>
                    </div>
                </td>
            </tr>
        `;
        updatePagination(0);
        return;
    }

    usersToShow.forEach(user => {
        const row = createUserRow(user);
        tableBody.appendChild(row);
    });

    updatePagination(filteredUsers.length);
}

/**
 * Crée une ligne de tableau pour un utilisateur
 */
function createUserRow(user) {
    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-50 transition-colors duration-150';

    const checkboxCell = isSelectorMode ? `
        <td class="px-6 py-4 whitespace-nowrap">
            <input type="checkbox" 
                   class="user-checkbox rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                   value="${user.id}" 
                   onchange="toggleUserSelection('${user.id}')"
                   ${selectedUserIds.has(user.id) ? 'checked' : ''}>
        </td>` : '';

    const actionsCell = isSelectorMode ? '' : `
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            <div class="flex justify-end space-x-2">
                <button onclick="viewUser('${user.id}')" class="text-blue-600 hover:text-blue-900 p-1 rounded-md hover:bg-blue-50 transition-colors">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                    </svg>
                </button>
                <button onclick="editUser('${user.id}')" class="text-yellow-600 hover:text-yellow-900 p-1 rounded-md hover:bg-yellow-50 transition-colors">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                    </svg>
                </button>
                <button onclick="deleteUser('${user.id}')" class="text-red-600 hover:text-red-900 p-1 rounded-md hover:bg-red-50 transition-colors">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </button>
            </div>
        </td>`;

    row.innerHTML = `
        ${checkboxCell}
        <td class="px-6 py-4 whitespace-nowrap">
            <div class="flex items-center">
                <div class="flex-shrink-0 h-10 w-10">
                    <div class="h-10 w-10 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center">
                        <span class="text-white font-medium text-sm">
                            ${(user.prenom || '').substring(0, 1).toUpperCase() || '??'}${(user.nom || '').substring(0, 1).toUpperCase() || ''}
                        </span>
                    </div>
                </div>
                <div class="ml-4">
                    <div class="text-sm font-medium text-gray-900">${user.prenom || 'N/A'} ${user.nom || 'N/A'}</div>
                    <div class="text-sm text-gray-500">ID: ${user.id || 'N/A'}</div>
                </div>
            </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
            ${user.date_naissance ? formatDate(user.date_naissance) : 'N/A'}
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
            <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getUserTypeBadgeClass(user.user_type || 'N/A')}">
                ${user.user_type || 'N/A'}
            </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
            ${user.email || 'N/A'}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
            ${user.telephone || 'N/A'}
        </td>
        ${actionsCell}
    `;

    return row;
}

/**
 * Met à jour la pagination
 */
function updatePagination(totalItems) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(currentPage * itemsPerPage, totalItems);
    const visibleCount = totalItems === 0 ? 0 : (endIndex - startIndex + 1);

    // Mettre à jour le numéro de page actuel
    document.getElementById('current-page').textContent = currentPage;

    // Mettre à jour les compteurs
    document.getElementById('users-showing').textContent = visibleCount;
    document.getElementById('users-total').textContent = allUsers.length;

    // Mettre à jour le compteur de sélection
    if (isSelectorMode) {
        document.getElementById('selected-count').textContent = selectedUserIds.size;
    }

    // Activer/désactiver les boutons de pagination
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');

    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = totalPages <= 1 || currentPage === totalPages;
}

/**
 * Change de page
 */
function changePage(page) {
    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        displayUsers();
    }
}

/**
 * Met à jour les statistiques
 */
function updateStats() {
    // Les statistiques sont déjà mises à jour dans updatePagination
    // Cette fonction peut être étendue pour d'autres statistiques si nécessaire
}

/**
 * Formate une date
 */
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        // Remove the timezone part if present
        const cleanDate = dateString.replace(/\+.*$/, '');
        const date = new Date(cleanDate);
        return date.toLocaleDateString('fr-FR') + ' ' + date.toLocaleTimeString('fr-FR');
    } catch {
        return dateString;
    }
}

/**
 * Retourne la classe CSS pour le badge du type d'utilisateur
 */
function getUserTypeBadgeClass(userType) {
    const classes = {
        'etudiant': 'bg-green-100 text-green-800',
        'bachelier': 'bg-blue-100 text-blue-800',
        'parent': 'bg-purple-100 text-purple-800',
        'enseignant': 'bg-yellow-100 text-yellow-800',
        'utilisateur': 'bg-indigo-100 text-indigo-800'
    };
    return classes[userType] || 'bg-gray-100 text-gray-800';
}

/**
 * Génère des données mockées pour le développement
 */
function generateMockUsers() {
    return [
        {"idx":0,"id":"191238ec-a284-42a7-8048-14b88f589e54","user_type":"utilisateur","email":"ffffdes@gmail.com","nom":"dOUMI","prenom":"nior","telephone":"+242067778844","date_naissance":"2015-05-15","created_at":"2026-03-13 17:46:11.240491+00","updated_at":"2026-03-13 17:46:11.240491+00"},
        {"idx":1,"id":"208d92b7-ff45-4e3a-9533-7b7788457ea0","user_type":"utilisateur","email":"jean10.dupont@example.com","nom":"Dupont","prenom":"Jean","telephone":"+2126123456710","date_naissance":"2006-05-15","created_at":"2026-03-12 00:26:11.214561+00","updated_at":"2026-03-12 00:26:11.214561+00"},
        {"idx":5,"id":"57504288-5d3b-4e08-b04e-21ccabfe36b1","user_type":"utilisateur","email":"jean.dupon@example.com","nom":"Dupont","prenom":"Jean","telephone":"+212612345670","date_naissance":"2006-05-15","created_at":"2026-03-10 11:31:46.310718+00","updated_at":"2026-03-10 11:31:46.310718+00"},
        {"idx":7,"id":"6d5d5f8f-4f69-41e6-9fc4-c049d389fb70","user_type":"utilisateur","email":"doumijr04@gmail.com","nom":"doumi","prenom":"Junior","telephone":"+242064296355","date_naissance":"2004-03-15","created_at":"2026-03-15 03:48:03.543031+00","updated_at":"2026-03-15 03:48:03.543031+00"},
        {"idx":9,"id":"85ce75b1-ccf4-4306-aba5-9b23a009285b","user_type":"utilisateur","email":"unior@gmail.com","nom":"unug","prenom":"ddd","telephone":"+242064290655","date_naissance":"2018-04-15","created_at":"2026-03-13 06:01:26.255675+00","updated_at":"2026-03-13 06:01:26.255675+00"},
        {"idx":10,"id":"88a27c77-964f-4501-8118-e7ff259d58e1","user_type":"utilisateur","email":"doumi@gmail.com","nom":"doumi","prenom":"junior","telephone":"+242055555545","date_naissance":"2015-04-15","created_at":"2026-03-13 06:16:48.337024+00","updated_at":"2026-03-13 06:16:48.337024+00"},
        {"idx":12,"id":"976569bb-e91d-4d1b-9888-3b3515425f64","user_type":"utilisateur","email":"jean100.dupont@example.com","nom":"Dupont","prenom":"Jean","telephone":"+2126123456720","date_naissance":"2006-05-15","created_at":"2026-03-12 00:28:00.078142+00","updated_at":"2026-03-12 00:28:00.078142+00"},
        {"idx":13,"id":"be7e9885-4f75-4af3-bb33-fae36c6b8fcd","user_type":"utilisateur","email":"jean1000.dupont@example.com","nom":"Dupont","prenom":"Jean","telephone":"+21261234567200","date_naissance":"2006-05-15","created_at":"2026-03-12 00:30:25.705519+00","updated_at":"2026-03-12 00:30:25.705519+00"},
        {"idx":14,"id":"d4d723ae-6ff9-4739-96b7-dd2cc1488735","user_type":"utilisateur","email":"jean.dupont@example.com","nom":"Dupont","prenom":"Jean","telephone":"+212612345678","date_naissance":"2006-05-15","created_at":"2026-03-10 06:42:58.836491+00","updated_at":"2026-03-10 06:42:58.836491+00"}
    ];
}

/**
 * Affiche une erreur
 */
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-50';
    errorDiv.innerHTML = `
        <div class="flex items-center">
            <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
            </svg>
            ${message}
            <button onclick="this.parentElement.remove()" class="ml-4 text-red-700 hover:text-red-900">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                </svg>
            </button>
        </div>
    `;
    document.body.appendChild(errorDiv);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (errorDiv.parentElement) {
            errorDiv.remove();
        }
    }, 5000);
}

/**
 * Affiche un message de succès
 */
function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded z-50';
    successDiv.innerHTML = `
        <div class="flex items-center">
            <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
            </svg>
            ${message}
            <button onclick="this.parentElement.remove()" class="ml-4 text-green-700 hover:text-green-900">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                </svg>
            </button>
        </div>
    `;
    document.body.appendChild(successDiv);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (successDiv.parentElement) {
            successDiv.remove();
        }
    }, 3000);
}

// Fonctions d'action sur les utilisateurs (à implémenter)
function viewUser(userId) {
    // TODO: Implémenter la vue détaillée
    showSuccess(`Vue détaillée pour l'utilisateur ${userId} (à implémenter)`);
}

function editUser(userId) {
    // TODO: Implémenter l'édition
    showSuccess(`Édition de l'utilisateur ${userId} (à implémenter)`);
}

async function deleteUser(userId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ? Cette action est irréversible.')) {
        return;
    }

    try {
        const token = localStorage.getItem('softura_token');
        const response = await fetch(`${IDENTITY_API}/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            showSuccess('Utilisateur supprimé avec succès');
            loadUsers(); // Recharger la liste
        } else {
            const error = await response.json();
            showError(error.error || 'Erreur lors de la suppression');
        }
    } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        showError('Erreur de connexion au serveur');
    }
}
