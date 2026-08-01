/**
 * UNIVERSEARCH - Logique Ads Manager
 */

// API Base URL
const apiBase = (() => {
    // Prefer an explicit override when available (set in pages as `window.API_BASE`).
    // Default to the public API host in production and to localhost for local dev.
    const remoteBase = window.API_BASE || 'https://universearch.com';

    if (window.location.protocol === 'file:') {
        return remoteBase;
    }

    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'https://universearch.com';
    }

    return remoteBase;
})();

// Variable to store selected gender
let selectedGender = 'all'; // default to 'all'

// Variable to store selected user type
let selectedUserType = 'all'; // default to 'all'
let selectedFile = null;
let selectedAgeMode = 'none';
let currentCampaignId = null;
let currentMediaUrl = null;
let currentMediaType = null;
let campaignBeingEdited = null;

const ageTargetingDefaults = {
    minAge: 24,
    rangeMinAge: 23,
    rangeMaxAge: 29,
    targetAge: 26,
    ageTolerance: 3
};

function getAgeInputValue(id, fallback) {
    const input = document.getElementById(id);
    if (!input) return fallback;

    const parsed = parseInt(input.value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function syncAgeRangeInputs(changedField = 'min') {
    const minInput = document.getElementById('ad-range-min-age');
    const maxInput = document.getElementById('ad-range-max-age');
    if (!minInput || !maxInput) return;

    const minBoundary = parseInt(minInput.min || '18', 10);
    const maxBoundary = parseInt(maxInput.max || '60', 10);
    let minValue = getAgeInputValue('ad-range-min-age', ageTargetingDefaults.rangeMinAge);
    let maxValue = getAgeInputValue('ad-range-max-age', ageTargetingDefaults.rangeMaxAge);

    minValue = Math.min(Math.max(minValue, minBoundary), maxBoundary);
    maxValue = Math.min(Math.max(maxValue, minBoundary), maxBoundary);

    if (minValue > maxValue) {
        if (changedField === 'max') {
            minValue = maxValue;
        } else {
            maxValue = minValue;
        }
    }

    minInput.value = String(minValue);
    maxInput.value = String(maxValue);
}

function updateAgeTargetingUI() {
    const modeButtons = {
        none: document.getElementById('age-mode-none'),
        min: document.getElementById('age-mode-min'),
        range: document.getElementById('age-mode-range'),
        target: document.getElementById('age-mode-target')
    };

    const panels = {
        none: document.getElementById('age-panel-none'),
        min: document.getElementById('age-panel-min'),
        range: document.getElementById('age-panel-range'),
        target: document.getElementById('age-panel-target')
    };

    Object.entries(modeButtons).forEach(([mode, button]) => {
        if (!button) return;

        button.classList.remove('bg-white', 'shadow-sm', 'text-indigo-600');
        button.classList.add('text-slate-500');

        if (mode === selectedAgeMode) {
            button.classList.remove('text-slate-500');
            button.classList.add('bg-white', 'shadow-sm', 'text-indigo-600');
        }
    });

    Object.entries(panels).forEach(([mode, panel]) => {
        if (!panel) return;
        panel.classList.toggle('hidden', mode !== selectedAgeMode);
    });
}

function updateAgeTargetingSummary() {
    syncAgeRangeInputs();

    const minAge = getAgeInputValue('ad-min-age', ageTargetingDefaults.minAge);
    const rangeMinAge = getAgeInputValue('ad-range-min-age', ageTargetingDefaults.rangeMinAge);
    const rangeMaxAge = getAgeInputValue('ad-range-max-age', ageTargetingDefaults.rangeMaxAge);
    const targetAge = getAgeInputValue('ad-target-age', ageTargetingDefaults.targetAge);
    const ageTolerance = getAgeInputValue('ad-age-tolerance', ageTargetingDefaults.ageTolerance);

    const minAgeDisplay = document.getElementById('ad-min-age-display');
    const rangeDisplay = document.getElementById('ad-range-display');
    const targetAgeDisplay = document.getElementById('ad-target-age-display');
    const toleranceDisplay = document.getElementById('ad-age-tolerance-display');
    const summary = document.getElementById('age-targeting-summary');

    if (minAgeDisplay) minAgeDisplay.innerText = `${minAge}+`;
    if (rangeDisplay) rangeDisplay.innerText = `${rangeMinAge} - ${rangeMaxAge} ans`;
    if (targetAgeDisplay) targetAgeDisplay.innerText = `${targetAge} ans`;
    if (toleranceDisplay) toleranceDisplay.innerText = `+/-${ageTolerance} ans`;

    if (!summary) return;

    if (selectedAgeMode === 'min') {
        summary.innerText = `A partir de ${minAge} ans`;
        return;
    }

    if (selectedAgeMode === 'range') {
        summary.innerText = `${rangeMinAge} à ${rangeMaxAge} ans`;
        return;
    }

    if (selectedAgeMode === 'target') {
        summary.innerText = `${Math.max(targetAge - ageTolerance, 0)} à ${targetAge + ageTolerance} ans`;
        return;
    }

    summary.innerText = `Aucun filtre d'age`;
}

function selectAgeTargetingMode(mode) {
    selectedAgeMode = mode;
    updateAgeTargetingUI();
    updateAgeTargetingSummary();
}

function getAgeTargetingPayload() {
    syncAgeRangeInputs();

    if (selectedAgeMode === 'min') {
        return {
            min_age: getAgeInputValue('ad-min-age', ageTargetingDefaults.minAge)
        };
    }

    if (selectedAgeMode === 'range') {
        return {
            min_age: getAgeInputValue('ad-range-min-age', ageTargetingDefaults.rangeMinAge),
            max_age: getAgeInputValue('ad-range-max-age', ageTargetingDefaults.rangeMaxAge)
        };
    }

    if (selectedAgeMode === 'target') {
        return {
            target_age: getAgeInputValue('ad-target-age', ageTargetingDefaults.targetAge),
            age_tolerance: getAgeInputValue('ad-age-tolerance', ageTargetingDefaults.ageTolerance)
        };
    }

    return {};
}

function resetAgeTargeting() {
    const minAgeInput = document.getElementById('ad-min-age');
    const rangeMinInput = document.getElementById('ad-range-min-age');
    const rangeMaxInput = document.getElementById('ad-range-max-age');
    const targetAgeInput = document.getElementById('ad-target-age');
    const ageToleranceInput = document.getElementById('ad-age-tolerance');

    if (minAgeInput) minAgeInput.value = String(ageTargetingDefaults.minAge);
    if (rangeMinInput) rangeMinInput.value = String(ageTargetingDefaults.rangeMinAge);
    if (rangeMaxInput) rangeMaxInput.value = String(ageTargetingDefaults.rangeMaxAge);
    if (targetAgeInput) targetAgeInput.value = String(ageTargetingDefaults.targetAge);
    if (ageToleranceInput) ageToleranceInput.value = String(ageTargetingDefaults.ageTolerance);

    selectAgeTargetingMode('none');
}

async function loadAvailableQuartiers() {
    const quartierSelect = document.getElementById('ad-quartier');
    if (!quartierSelect) return;

    try {
        const response = await fetch(`${apiBase}/ads/quartiers`);
        const json = await response.json();

        if (!response.ok) {
            throw new Error(json?.error || 'Impossible de charger les quartiers');
        }

        const quartiers = Array.isArray(json?.data) ? json.data : [];
        const currentValue = quartierSelect.value;

        quartierSelect.innerHTML = '<option value="">Sélectionner un quartier</option>';
        quartiers.forEach((quartier) => {
            const option = document.createElement('option');
            option.value = quartier;
            option.textContent = quartier;
            quartierSelect.appendChild(option);
        });

        if (currentValue) {
            quartierSelect.value = currentValue;
        }
    } catch (err) {
        console.warn('Unable to load quartiers:', err);
    }
}

// 1. SYSTÈME DE NOTIFICATION (Réutilisé pour l'autonomie du fichier)
function showNotification(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const bgClass = type === 'error' ? 'bg-red-600' : (type === 'success' ? 'bg-emerald-600' : 'bg-slate-900/95');
    
    toast.className = `${bgClass} backdrop-blur-md text-white px-6 py-3.5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] flex items-center gap-3 transition-all duration-500 translate-y-10 opacity-0 pointer-events-auto border border-white/10`;
    
    toast.innerHTML = `
        <div class="w-6 h-6 flex items-center justify-center bg-white/20 rounded-full">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
            </svg>
        </div>
        <span class="text-sm font-bold tracking-tight">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.transform = "translateY(0)";
        toast.style.opacity = "1";
    }, 100);

    setTimeout(() => {
        toast.style.transform = "translateY(-20px)";
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 500);
    }, 3500);
}

// 2. GESTION DU CIBLAGE (Genre & Âge)
function selectGender(gender) {
    selectedGender = gender; // Store the selected gender

    const buttons = {
        all: document.getElementById('gen-all'),
        men: document.getElementById('gen-men'),
        women: document.getElementById('gen-women')
    };

    // Réinitialisation des styles
    Object.values(buttons).forEach(btn => {
        btn.classList.remove('bg-white', 'shadow-sm', 'text-indigo-600');
        btn.classList.add('text-slate-500');
    });

    // Application du style actif
    buttons[gender].classList.remove('text-slate-500');
    buttons[gender].classList.add('bg-white', 'shadow-sm', 'text-indigo-600');
}

// Mise à jour de l'affichage de l'âge
document.addEventListener('DOMContentLoaded', () => {
    const ageSlider = document.querySelector('input[type="range"]');
    if (ageSlider) {
        const ageDisplay = ageSlider.nextElementSibling;
        ageSlider.addEventListener('input', (e) => {
            ageDisplay.innerText = `${e.target.value}+`;
        });
    }
});

// GESTION DU CIBLAGE (Type d'utilisateur)
function selectUserType(userType) {
    selectedUserType = userType; // Store the selected user type

    const buttons = {
        all: document.getElementById('type-all'),
        bachelier: document.getElementById('type-bachelier'),
        etudiant: document.getElementById('type-etudiant'),
        parent: document.getElementById('type-parent')
    };

    // Réinitialisation des styles
    Object.values(buttons).forEach(btn => {
        btn.classList.remove('bg-white', 'shadow-sm', 'text-indigo-600');
        btn.classList.add('text-slate-500');
    });

    // Application du style actif
    buttons[userType].classList.remove('text-slate-500');
    buttons[userType].classList.add('bg-white', 'shadow-sm', 'text-indigo-600');
}

// Variable to store selected users for targeting
let selectedUsers = []; // array of user IDs

// OUVRIR LE SELECTEUR D'UTILISATEURS
function openUserSelector() {
    // Ouvrir users_admin.html dans une nouvelle fenêtre/onglet avec un paramètre pour indiquer le mode sélection
    const userSelectorWindow = window.open('users_admin.html?mode=selector', '_blank', 'width=1200,height=800');
    
    // Écouter les messages de la fenêtre enfant
    window.addEventListener('message', function(event) {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'usersSelected') {
            selectedUsers = event.data.users;
            updateSelectedUsersDisplay();
            showNotification(`${selectedUsers.length} utilisateur(s) sélectionné(s)`, "success");
        }
    });
}

// METTRE À JOUR L'AFFICHAGE DES UTILISATEURS SÉLECTIONNÉS
function updateSelectedUsersDisplay() {
    const existingDisplayElement = document.getElementById('selected-users-display');
    if (existingDisplayElement) {
        if (selectedUsers.length > 0) {
            existingDisplayElement.textContent = `${selectedUsers.length} utilisateur(s) sÃ©lectionnÃ©(s) pour le ciblage`;
            existingDisplayElement.style.display = 'block';
            existingDisplayElement.textContent = `${selectedUsers.length} utilisateur(s) selectionne(s) pour le ciblage`;
        } else {
            existingDisplayElement.style.display = 'none';
        }
        return;
    }

    const ageSection = document.querySelector('label[for="ad-location"]').closest('.space-y-3').previousElementSibling;
    let displayElement = document.getElementById('selected-users-display');
    
    if (!displayElement) {
        displayElement = document.createElement('div');
        displayElement.id = 'selected-users-display';
        displayElement.className = 'text-xs text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg mt-2';
        ageSection.appendChild(displayElement);
    }
    
    if (selectedUsers.length > 0) {
        displayElement.textContent = `${selectedUsers.length} utilisateur(s) sélectionné(s) pour le ciblage`;
        displayElement.style.display = 'block';
        displayElement.textContent = `${selectedUsers.length} utilisateur(s) selectionne(s) pour le ciblage`;
    } else {
        displayElement.style.display = 'none';
    }
}

// 3. SYNCHRONISATION DU TEXTE D'APERÇU
document.addEventListener('DOMContentLoaded', () => {
    const titleInput = document.getElementById('ad-title');
    const descInput = document.getElementById('ad-desc');
    const previewTitle = document.getElementById('preview-title');
    const previewDesc = document.getElementById('preview-desc');

    if (titleInput && previewTitle) {
        titleInput.addEventListener('input', (e) => {
            previewTitle.innerText = e.target.value || "Titre de l'annonce";
        });
    }

    if (descInput && previewDesc) {
        descInput.addEventListener('input', (e) => {
            previewDesc.innerText = e.target.value || "Description de l'annonce apparaîtra ici...";
        });
    }
});

// 4. GESTION DE L'UPLOAD MÉDIA (Drag & Drop + Click)
const dropZone = document.getElementById('drop-zone');
const mediaInput = document.getElementById('media-input');
const previewContainer = document.getElementById('preview-container');
const previewPlaceholder = document.getElementById('preview-placeholder');
const mediaContent = document.getElementById('media-content');

if (dropZone && mediaInput) {
    // Clic pour ouvrir le selecteur de fichier
    dropZone.addEventListener('click', (e) => {
        // Empêche le déclenchement si on clique sur le bouton de fermeture
        if (e.target.tagName !== 'BUTTON' && !e.target.closest('button')) {
            mediaInput.click();
        }
    });

    // Changement via l'explorateur
    mediaInput.addEventListener('change', function() {
        handleFiles(this.files);
    });

    // Événements Drag & Drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-indigo-500', 'bg-indigo-50');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('border-indigo-500', 'bg-indigo-50');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-indigo-500', 'bg-indigo-50');
        handleFiles(e.dataTransfer.files);
    });
}

// Traitement du fichier
function handleFiles(files) {
    const file = files[0];
    if (!file) return;

    selectedFile = file; // Store the file

    const reader = new FileReader();
    const isVideo = file.type.startsWith('video/');

    reader.onload = function(e) {
        mediaContent.innerHTML = ''; // Nettoyage
        
        // Bouton de suppression dynamique
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
        closeBtn.className = "absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-md transition-all";
        closeBtn.onclick = removeMedia;
        
        let mediaElement;
        if (isVideo) {
            mediaElement = document.createElement('video');
            mediaElement.src = e.target.result;
            mediaElement.autoplay = true;
            mediaElement.loop = true;
            mediaElement.muted = true;
            mediaElement.playsInline = true;
            // object-contain permet de ne jamais rogner la vidéo
            mediaElement.className = "w-full h-full object-contain"; 
        } else {
            mediaElement = document.createElement('img');
            mediaElement.src = e.target.result;
            // object-contain permet de ne jamais rogner l'image
            mediaElement.className = "w-full h-full object-contain"; 
        }

        mediaContent.appendChild(closeBtn);
        mediaContent.appendChild(mediaElement);
        
        // Basculer l'affichage
        previewPlaceholder.classList.add('hidden');
        previewContainer.classList.remove('hidden');
    }
    reader.readAsDataURL(file);
}

// Suppression du média
function removeMedia(event) {
    if(event) event.stopPropagation();
    previewContainer.classList.add('hidden');
    previewPlaceholder.classList.remove('hidden');
    mediaContent.innerHTML = '';
    mediaInput.value = ''; // Reset de l'input
    selectedFile = null; // Clear the selected file
}

function escapeHTML(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function isVideoCampaign(campaign) {
    const mediaType = String(campaign?.media_type || campaign?.mediaType || '').toLowerCase();
    const mediaUrl = String(campaign?.media_url || campaign?.mediaUrl || campaign?.video_url || campaign?.videoUrl || '');
    return mediaType === 'video' || mediaUrl.toLowerCase().endsWith('.mp4');
}

function getCampaignMetric(campaign, keys) {
    for (const key of keys) {
        const topLevelValue = campaign?.[key];
        if (topLevelValue !== undefined && topLevelValue !== null && topLevelValue !== '') {
            return Number(topLevelValue) || 0;
        }

        const statsValue = campaign?.stats?.[key];
        if (statsValue !== undefined && statsValue !== null && statsValue !== '') {
            return Number(statsValue) || 0;
        }
    }

    return 0;
}

function formatCampaignDate(value) {
    if (!value) return 'Date inconnue';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Date inconnue';
    return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function formatCount(value) {
    return new Intl.NumberFormat('fr-FR').format(Number(value) || 0);
}

async function requestElementFullscreen(element) {
    if (!element) return;

    try {
        if (document.fullscreenElement) {
            await document.exitFullscreen();
            return;
        }

        if (element.requestFullscreen) {
            await element.requestFullscreen();
        }
    } catch (error) {
        console.warn('Unable to toggle fullscreen for media', error);
    }
}

function setupCampaignDescriptionToggle() {
    const descElem = document.getElementById('campaign-modal-description');
    const toggleBtn = document.getElementById('campaign-modal-description-toggle');
    if (!descElem || !toggleBtn) return;

    const collapsedClass = 'max-h-[168px]';
    const expandedClass = 'max-h-[420px]';

    const applyState = (expanded) => {
        descElem.dataset.expanded = expanded ? 'true' : 'false';
        descElem.classList.remove(collapsedClass, expandedClass);
        descElem.classList.add(expanded ? expandedClass : collapsedClass, 'overflow-y-auto');
        toggleBtn.innerText = expanded ? 'Réduire' : 'Voir';
    };

    const updateVisibility = () => {
        requestAnimationFrame(() => {
            const shouldShow = descElem.scrollHeight > 180;
            toggleBtn.classList.toggle('hidden', !shouldShow);
            applyState(false);
        });
    };

    if (!toggleBtn.dataset.bound) {
        toggleBtn.addEventListener('click', () => {
            const expanded = descElem.dataset.expanded === 'true';
            applyState(!expanded);
        });
        toggleBtn.dataset.bound = 'true';
    }

    toggleBtn.dataset.updateVisibility = 'true';
    toggleBtn._updateCampaignDescriptionVisibility = updateVisibility;
}

function ensureCampaignModalLayout() {
    const modal = document.getElementById('campaign-modal'); 
    const card = modal?.querySelector(':scope > div.relative');
    const grid = card?.querySelector(':scope > div.grid');
    const mediaPanel = grid?.children?.[0];
    const detailsPanel = grid?.children?.[1];
    const mediaContainer = document.getElementById('campaign-modal-media');
    const titleElem = document.getElementById('campaign-modal-title');
    const descElem = document.getElementById('campaign-modal-description');
    const dateElem = document.getElementById('campaign-modal-date');
    const statusElem = document.getElementById('campaign-modal-status');

    if (!modal || !card || !grid || !mediaPanel || !detailsPanel || !mediaContainer || !titleElem || !descElem || !dateElem || !statusElem) {
        return;
    }

    modal.className = 'fixed inset-0 z-50 hidden items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4';
    card.className = 'relative w-full max-w-6xl max-h-[92vh] bg-white rounded-[32px] shadow-2xl overflow-hidden';
    grid.className = 'grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_420px] min-h-[540px] max-h-[92vh]';
    mediaPanel.className = 'bg-slate-950 p-4 sm:p-6 lg:p-8';
    detailsPanel.className = 'p-6 sm:p-8 lg:p-10 flex flex-col overflow-y-auto';
    mediaContainer.className = 'w-full h-full min-h-[280px] lg:min-h-[560px] rounded-[22px] overflow-hidden bg-slate-900 flex items-center justify-center text-slate-400 cursor-zoom-in';

    if (mediaContainer.parentElement && mediaContainer.parentElement !== mediaPanel) {
        mediaContainer.parentElement.className = 'h-full rounded-[28px] bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.16),_transparent_45%),linear-gradient(180deg,_#0f172a,_#020617)] p-3 sm:p-4';
    }

    const headerBlock = titleElem.parentElement;
    if (headerBlock) {
        headerBlock.className = 'mb-6 border-b border-slate-100 pb-6';
    }

    let badgeRow = statusElem.parentElement;
    if (badgeRow === headerBlock) {
        badgeRow = document.createElement('div');
        badgeRow.className = 'flex flex-wrap items-center gap-3 pr-14';
        headerBlock.insertBefore(badgeRow, dateElem);
        badgeRow.appendChild(statusElem);
    } else if (badgeRow) {
        badgeRow.className = 'flex flex-wrap items-center gap-3 pr-14';
    }

    let formatBadge = document.getElementById('campaign-modal-format-badge');
    if (!formatBadge && badgeRow) {
        formatBadge = document.createElement('span');
        formatBadge.id = 'campaign-modal-format-badge';
        formatBadge.className = 'inline-flex px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-widest bg-slate-100 text-slate-700';
        badgeRow.appendChild(formatBadge);
    }

    titleElem.className = 'text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2 leading-tight break-words';
    dateElem.className = 'text-xs text-slate-400 mt-4 font-semibold uppercase tracking-wider';

    let descCard = descElem.parentElement;
    if (descCard === headerBlock) {
        descCard = document.createElement('div');
        detailsPanel.insertBefore(descCard, headerBlock.nextSibling);
        descCard.appendChild(descElem);
    }
    if (descCard) {
        descCard.className = 'rounded-[24px] border border-slate-100 bg-slate-50 p-5';
        const label = descCard.querySelector('.campaign-desc-label');
        if (label) label.remove();
    }
    descElem.className = 'text-sm text-slate-600 leading-7 whitespace-pre-wrap break-words max-h-[320px] overflow-y-auto pr-1';

    const metricsGrid = document.getElementById('campaign-modal-likes')?.parentElement?.parentElement;
    if (metricsGrid) {
        metricsGrid.className = 'grid grid-cols-3 gap-3 mt-6';
        Array.from(metricsGrid.children).forEach((item) => {
            item.className = 'rounded-2xl border border-slate-100 bg-white p-4';
        });
    }

    const performanceCard = document.getElementById('campaign-modal-ctr')?.closest('div.mt-6');
    if (performanceCard) {
        performanceCard.className = 'mt-6 rounded-[24px] border border-slate-100 p-5 bg-white shadow-sm';
    }

    let summaryCard = document.getElementById('campaign-modal-summary-card');
    if (!summaryCard) {
        summaryCard = document.createElement('div');
        summaryCard.id = 'campaign-modal-summary-card';
        summaryCard.className = 'mt-6 rounded-[24px] border border-slate-100 bg-slate-50 p-5';
        summaryCard.innerHTML = `
            <p class="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-4">Résumé</p>
            <div class="space-y-3 text-sm">
                <div class="flex items-center justify-between gap-4">
                    <span class="text-slate-500 font-medium">Titre</span>
                    <span id="campaign-modal-summary-title" class="font-bold text-slate-900 text-right line-clamp-1"></span>
                </div>
                <div class="flex items-center justify-between gap-4">
                    <span class="text-slate-500 font-medium">Date</span>
                    <span id="campaign-modal-summary-date" class="font-bold text-slate-900 text-right"></span>
                </div>
            </div>
        `;
        const closeWrap = document.getElementById('campaign-modal-close-footer')?.parentElement;
        if (closeWrap) {
            detailsPanel.insertBefore(summaryCard, closeWrap);
        } else {
            detailsPanel.appendChild(summaryCard);
        }
    }

}

function openCampaignModal(campaign) {
    ensureCampaignModalLayout();
    const modal = document.getElementById('campaign-modal');
    const mediaContainer = document.getElementById('campaign-modal-media');
    const titleElem = document.getElementById('campaign-modal-title');
    const descElem = document.getElementById('campaign-modal-description');
    const dateElem = document.getElementById('campaign-modal-date');
    const likesElem = document.getElementById('campaign-modal-likes');
    const commentsElem = document.getElementById('campaign-modal-comments');
    const viewsElem = document.getElementById('campaign-modal-views');
    const ctrElem = document.getElementById('campaign-modal-ctr');
    const clicksElem = document.getElementById('campaign-modal-clicks');
    const formatElem = document.getElementById('campaign-modal-format');
    const formatBadge = document.getElementById('campaign-modal-format-badge');
    const summaryTitle = document.getElementById('campaign-modal-summary-title');
    const summaryDate = document.getElementById('campaign-modal-summary-date');

    if (!modal || !mediaContainer) return;

    const impressions = getCampaignMetric(campaign, ['impressions', 'views', 'view_count', 'reach']);
    const clicks = getCampaignMetric(campaign, ['clicks', 'click_count']);
    const likes = getCampaignMetric(campaign, ['likes', 'likes_count', 'like_count']);
    const comments = getCampaignMetric(campaign, ['comments', 'comments_count', 'comment_count']);
    const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(1) : '0.0';

    titleElem.innerText = campaign?.title || 'Annonce sans titre';
    descElem.innerText = campaign?.description || 'Aucune description disponible pour cette annonce.';
    dateElem.innerText = formatCampaignDate(campaign?.created_at);
    likesElem.innerText = formatCount(likes);
    commentsElem.innerText = formatCount(comments);
    viewsElem.innerText = formatCount(impressions);
    ctrElem.innerText = `${ctr}%`;
    clicksElem.innerText = formatCount(clicks);
    if (formatBadge) formatBadge.innerText = isVideoCampaign(campaign) ? 'Video' : 'Image';
    if (summaryTitle) summaryTitle.innerText = campaign?.title || 'Annonce sans titre';
    if (summaryDate) summaryDate.innerText = formatCampaignDate(campaign?.created_at);
    formatElem.innerText = isVideoCampaign(campaign) ? 'Video' : 'Image';

    const deleteVideoHeaderBtn = document.getElementById('campaign-modal-delete-video-header');
    if (deleteVideoHeaderBtn) {
        deleteVideoHeaderBtn.classList.toggle('hidden', !isVideoCampaign(campaign));
    }

    const mediaUrl = campaign?.media_url || campaign?.mediaUrl || campaign?.image_url || campaign?.video_url || '';
    if (mediaUrl) {
        if (isVideoCampaign(campaign)) {
            mediaContainer.innerHTML = `
                <video src="${escapeHTML(mediaUrl)}" class="w-full h-full object-cover bg-black cursor-zoom-in" controls autoplay muted playsinline></video>
            `;
        } else {
            mediaContainer.innerHTML = `
                <img src="${escapeHTML(mediaUrl)}" alt="${escapeHTML(campaign?.title || 'Annonce')}" class="w-full h-full object-cover bg-black cursor-zoom-in">
            `;
        }
    } else {
        mediaContainer.innerHTML = '<div class="w-full h-full flex items-center justify-center text-slate-400 text-sm font-medium">Aucun média disponible</div>';
    }

    const mediaElement = mediaContainer.querySelector('img, video');
    if (mediaElement) {
        mediaElement.addEventListener('click', () => requestElementFullscreen(mediaElement));
    }

    campaignBeingEdited = campaign;
    currentCampaignId = campaign?.id || campaign?.campaign_id || campaign?._id || null;
    currentMediaUrl = campaign?.media_url || campaign?.mediaUrl || campaign?.image_url || campaign?.video_url || null;
    currentMediaType = campaign?.media_type || (currentMediaUrl?.includes('.mp4') ? 'video' : 'image');

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.classList.add('overflow-hidden');
}

async function deleteCampaign(campaignId = currentCampaignId) {
    if (!campaignId) {
        showNotification('Impossible de supprimer : identifiant de campagne manquant.', 'error');
        return;
    }

    const confirmation = confirm('Voulez-vous vraiment supprimer cette campagne ?');
    if (!confirmation) return;

    try {
        const resp = await fetch(`${apiBase}/ads/campaign/${encodeURIComponent(campaignId)}`, {
            method: 'DELETE'
        });

        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            const errorMsg = json?.error || json?.message || `Échec de la suppression (HTTP ${resp.status})`;
            throw new Error(errorMsg);
        }

        showNotification('Campagne supprimée avec succès.', 'success');
        closeCampaignModal();
        resetEditMode();
        loadCampaigns();
    } catch (err) {
        console.error('Erreur suppression campagne :', err);
        showNotification(err.message || 'Erreur lors de la suppression de la campagne.', 'error');
    }
}

async function deleteCampaignVideo(campaign) {
    const campaignId = campaign?.id || campaign?.campaign_id || campaign?._id || currentCampaignId;
    if (!campaignId) {
        showNotification('Impossible de supprimer la vidéo : identifiant de campagne manquant.', 'error');
        return;
    }

    if (!isVideoCampaign(campaign) && currentMediaType !== 'video') {
        showNotification('Cette campagne ne contient pas de vidéo.', 'error');
        return;
    }

    const confirmation = confirm('Voulez-vous vraiment supprimer la vidéo de cette campagne ?');
    if (!confirmation) return;

    const payload = {
        title: campaign?.title || campaign?.name || 'Annonce sans titre',
        description: campaign?.description || undefined,
        destination: campaign?.destination || undefined,
        lien: campaign?.lien || campaign?.click_url || undefined,
        contacts: campaign?.contacts || undefined,
        location: campaign?.location || undefined,
        quartier: campaign?.quartier || undefined,
        target_gender: campaign?.target_gender || campaign?.targetGender || undefined,
        target_user_type: campaign?.target_user_type || campaign?.targetUserType || undefined,
        target_users: campaign?.target_users || campaign?.targetUsers || undefined,
        send_notifications: campaign?.send_notifications ?? campaign?.sendNotifications ?? false,
        status: campaign?.status || 'active',
        media_url: '',
        media_type: '',
        ...(campaign?.destination === 'carousel' && campaign?.carousel_slot !== undefined ? { carousel_slot: campaign.carousel_slot } : {})
    };

    try {
        const resp = await fetch(`${apiBase}/ads/campaign/${encodeURIComponent(campaignId)}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            const errorMsg = json?.error || json?.message || `Échec de la suppression de la vidéo (HTTP ${resp.status})`;
            throw new Error(errorMsg);
        }

        showNotification('Vidéo supprimée de la campagne.', 'success');
        if (campaignId === currentCampaignId) {
            currentMediaUrl = null;
            currentMediaType = null;
        }
        closeCampaignModal();
        resetEditMode();
        loadCampaigns();
    } catch (err) {
        console.error('Erreur suppression vidéo de campagne :', err);
        showNotification(err.message || 'Erreur lors de la suppression de la vidéo de la campagne.', 'error');
    }
}

function enterEditMode(campaign) {
    if (!campaign) {
        showNotification('Campagne introuvable pour modification.', 'error');
        return;
    }

    campaignBeingEdited = campaign;
    currentCampaignId = campaign?.id || campaign?.campaign_id || campaign?._id || null;
    currentMediaUrl = campaign?.media_url || campaign?.mediaUrl || campaign?.image_url || campaign?.video_url || null;
    currentMediaType = campaign?.media_type || (currentMediaUrl?.includes('.mp4') ? 'video' : 'image');
    selectedFile = null;
    if (mediaInput) {
        mediaInput.value = '';
    }

    document.getElementById('ad-title').value = campaign?.title || '';
    document.getElementById('ad-desc').value = campaign?.description || '';
    document.getElementById('ad-location').value = campaign?.location || '';
    document.getElementById('ad-quartier').value = campaign?.quartier || campaign?.location || '';
    document.getElementById('ad-lien').value = campaign?.lien || campaign?.lien_site || '';
    document.getElementById('ad-contacts').value = campaign?.contacts || '';

    selectedGender = campaign?.target_gender || 'all';
    selectGender(selectedGender);

    selectedUserType = campaign?.target_user_type || 'all';
    selectUserType(selectedUserType);

    selectedUsers = Array.isArray(campaign?.target_users) ? campaign.target_users : (Array.isArray(campaign?.targetUsers) ? campaign.targetUsers : []);
    updateSelectedUsersDisplay();

    if (campaign?.target_age !== undefined || campaign?.age_tolerance !== undefined) {
        if (campaign?.target_age !== undefined) {
            selectAgeTargetingMode('target');
            document.getElementById('ad-target-age').value = String(campaign.target_age || ageTargetingDefaults.targetAge);
            document.getElementById('ad-age-tolerance').value = String(campaign.age_tolerance ?? ageTargetingDefaults.ageTolerance);
        }
    } else if (campaign?.min_age !== undefined || campaign?.max_age !== undefined) {
        if (campaign?.min_age !== undefined && campaign?.max_age !== undefined) {
            selectAgeTargetingMode('range');
            document.getElementById('ad-range-min-age').value = String(campaign.min_age || ageTargetingDefaults.rangeMinAge);
            document.getElementById('ad-range-max-age').value = String(campaign.max_age || ageTargetingDefaults.rangeMaxAge);
        } else if (campaign?.min_age !== undefined) {
            selectAgeTargetingMode('min');
            document.getElementById('ad-min-age').value = String(campaign.min_age || ageTargetingDefaults.minAge);
        }
    }
    updateAgeTargetingSummary();

    if (mediaContent && currentMediaUrl) {
        previewPlaceholder.classList.add('hidden');
        previewContainer.classList.remove('hidden');
        mediaContent.innerHTML = '';
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
        closeBtn.className = "absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-md transition-all";
        closeBtn.onclick = removeMedia;

        const mediaElement = document.createElement(currentMediaType === 'video' ? 'video' : 'img');
        if (currentMediaType === 'video') {
            mediaElement.src = currentMediaUrl;
            mediaElement.autoplay = true;
            mediaElement.loop = true;
            mediaElement.muted = true;
            mediaElement.playsInline = true;
            mediaElement.className = "w-full h-full object-contain";
        } else {
            mediaElement.src = currentMediaUrl;
            mediaElement.className = "w-full h-full object-contain";
        }

        mediaContent.appendChild(closeBtn);
        mediaContent.appendChild(mediaElement);
    }

    const previewTitle = document.getElementById('preview-title');
    const previewDesc = document.getElementById('preview-desc');
    if (previewTitle) previewTitle.innerText = campaign?.title || "Titre de l'annonce";
    if (previewDesc) previewDesc.innerText = campaign?.description || "Description de l'annonce apparaîtra ici...";

    const launchBtn = document.getElementById('launch-campaign-button');
    if (launchBtn) {
        launchBtn.innerText = 'Sauvegarder les modifications';
    }

    closeCampaignModal();
    document.getElementById('ad-title')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function resetEditMode() {
    campaignBeingEdited = null;
    currentCampaignId = null;
    currentMediaUrl = null;
    currentMediaType = null;
    const launchBtn = document.getElementById('launch-campaign-button');
    if (launchBtn) {
        launchBtn.innerText = 'Lancer la Campagne';
    }
}

function closeCampaignModal() {
    const modal = document.getElementById('campaign-modal');
    const mediaContainer = document.getElementById('campaign-modal-media');
    if (!modal) return;

    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.classList.remove('overflow-hidden');

    if (mediaContainer) {
        mediaContainer.innerHTML = '<div class="w-full h-full flex items-center justify-center text-slate-400 text-sm font-medium">Aucun média disponible</div>';
    }
}

// 5. LANCEMENT CAMPAGNE AVEC API
async function launchCampaign() {
    const title = document.getElementById('ad-title').value.trim();
    const description = document.getElementById('ad-desc').value.trim() || undefined;
    const hasMedia = !previewContainer.classList.contains('hidden');
    const mediaType = selectedFile ? (selectedFile.type.startsWith('video/') ? 'video' : 'image') : currentMediaType;
    const editMode = Boolean(currentCampaignId);
    const existingMediaUrl = currentMediaUrl;

    // Collect targeting data
    const ageTargeting = getAgeTargetingPayload();
    const location = document.getElementById('ad-location').value.trim() || undefined;
    const quartier = document.getElementById('ad-quartier').value.trim() || undefined;
    const targetGender = selectedGender === 'all' ? undefined : selectedGender; // undefined for 'all', or 'men'/'women'
    const targetUserType = selectedUserType === 'all' ? undefined : selectedUserType;

    console.log('Starting campaign launch...');
    console.log('Title:', title);
    console.log('Description:', description);
    console.log('Has media:', hasMedia);
    console.log('Media type:', mediaType);
    console.log('Targeting - Gender:', targetGender, 'UserType:', targetUserType, 'Users:', selectedUsers, 'Age:', ageTargeting, 'Location:', location, 'Quartier:', quartier);

    if (!title) {
        console.log('Error: No title');
        showNotification("Veuillez ajouter un titre", "error");
        return;
    }

    const mediaAvailable = selectedFile || existingMediaUrl;
    if (!mediaAvailable) {
        console.log('Error: No media or no file');
        showNotification("Veuillez ajouter un média", "error");
        return;
    }

    try {
        let mediaUrl = existingMediaUrl;
        if (selectedFile || (mediaInput && mediaInput.files && mediaInput.files[0])) {
            const fileToUpload = selectedFile || mediaInput.files[0];
            console.log('Uploading media...');
            console.log('File to upload:', fileToUpload);
            showNotification("Upload du média en cours...", "info");

            try {
                // 1) Upload du média
                const uploadForm = new FormData();
                // Include filename explicitly to ensure server receives it
                if (fileToUpload && fileToUpload.name) {
                    uploadForm.append('file', fileToUpload, fileToUpload.name);
                } else if (fileToUpload) {
                    uploadForm.append('file', fileToUpload);
                }

                if (!uploadForm.get('file')) {
                    console.error('FormData missing file entry before upload');
                    throw new Error('Aucun fichier à uploader');
                }

                if (currentCampaignId) {
                    uploadForm.append('campaignId', currentCampaignId);
                }

                // Debug: confirm FormData contains the file entry
                try {
                    const formFile = uploadForm.get('file');
                    console.log('FormData file entry:', formFile);
                    if (formFile instanceof File) {
                        console.log('FormData file name:', formFile.name, 'type:', formFile.type, 'size:', formFile.size);
                    }
                } catch (err) {
                    console.warn('Unable to inspect FormData contents', err);
                }

                console.log('Sending upload request to:', `${apiBase}/ads/media/upload`);
                const uploadResp = await fetch(`${apiBase}/ads/media/upload`, {
                    method: 'POST',
                    body: uploadForm,
                });

                console.log('Upload response status:', uploadResp.status);
                const uploadData = await uploadResp.json();
                console.log('Upload response data:', uploadData);

                if (!uploadResp.ok) {
                    throw new Error(uploadData.error || 'Erreur lors de l\'upload');
                }

                mediaUrl = uploadData.data.mediaUrl;
            } catch (err) {
                console.error('Media upload failed:', err);
                showNotification(err.message || 'Erreur lors de l\'upload du média', 'error');
                return;
            }
        }

        console.log('Media URL:', mediaUrl);

        // 2) Création ou mise à jour de la campagne
        const contacts = document.getElementById('ad-contacts').value.trim() || undefined;
        const lien = document.getElementById('ad-lien').value.trim() || undefined;
        const sendNotifications = document.getElementById('send-notifications-toggle').checked;
        const destination = mediaType === 'image' ? 'carousel' : 'shorts';
        const payload = {
            title,
            description,
            media_url: mediaUrl,
            media_type: mediaType,
            destination,
            target_gender: targetGender,
            target_user_type: targetUserType,
            target_users: selectedUsers.length > 0 ? selectedUsers : undefined,
            ...ageTargeting,
            location: quartier || location,
            quartier: quartier,
            contacts,
            lien,
            send_notifications: sendNotifications,
            ...(destination === 'carousel' && campaignBeingEdited?.carousel_slot !== undefined ? { carousel_slot: campaignBeingEdited.carousel_slot } : {})
        };

        console.log('Campaign payload:', payload);
        const campaignResp = await fetch(`${apiBase}/ads/campaign${editMode && currentCampaignId ? '/' + encodeURIComponent(currentCampaignId) : ''}`, {
            method: editMode && currentCampaignId ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        console.log('Campaign response status:', campaignResp.status);
        const campaignData = await campaignResp.json();
        console.log('Campaign response data:', campaignData);

        if (!campaignResp.ok) {
            console.error('Campaign creation failed:', campaignData);
            if (campaignData.details) {
                console.error('Validation details:', campaignData.details);
            }
            throw new Error(campaignData.error || 'Erreur lors de la création de la campagne');
        }

        console.log(editMode ? 'Campaign updated successfully' : 'Campaign created successfully');
        showNotification(editMode ? "Campagne mise à jour avec succès !" : "Campagne lancée avec succès !", "success");
        // Réinitialiser le formulaire
        document.getElementById('ad-title').value = '';
        document.getElementById('ad-desc').value = '';
        document.getElementById('ad-lien').value = '';
        document.getElementById('ad-contacts').value = '';
        // Reset targeting
        selectedGender = 'all';
        selectGender('all'); // Reset visual selection
        selectedUserType = 'all';
        selectUserType('all'); // Reset visual selection
        selectedUsers = []; // Reset selected users
        updateSelectedUsersDisplay(); // Update display
        resetAgeTargeting();
        document.getElementById('ad-location').value = '';
        document.getElementById('ad-quartier').value = '';
        document.getElementById('send-notifications-toggle').checked = true;
        removeMedia();
        resetEditMode();
        // Recharger les campagnes
        loadCampaigns();
    } catch (err) {
        console.error('Error during campaign launch:', err);
        showNotification(err.message || 'Une erreur est survenue.', "error");
    }
}

// 6. CHARGER LES CAMPAGNES RÉCENTES
const CAMPAIGNS_PAGE_SIZE = 5;
let allCampaigns = [];
let campaignMediaFilter = 'all';
let campaignCurrentPage = 1;

async function loadCampaigns() {
    console.log('Loading campaigns...');
    try {
        const resp = await fetch(`${apiBase}/ads/campaigns?limit=25`);
        console.log('Campaigns response status:', resp.status);
        const rawText = await resp.text();
        let data = null;
        try {
            data = rawText ? JSON.parse(rawText) : null;
        } catch (parseError) {
            console.warn('Unable to parse campaigns response as JSON:', parseError);
        }

        if (!resp.ok) {
            const backendMessage =
                data?.error ||
                data?.message ||
                rawText ||
                `HTTP ${resp.status}`;
            throw new Error(backendMessage);
        }

        console.log('Campaigns data:', data);
        const campaigns = Array.isArray(data?.data)
            ? data.data
            : (Array.isArray(data) ? data : []);

        allCampaigns = campaigns
            .slice()
            .sort((a, b) => {
                const dateA = new Date(a.created_at || a.createdAt || 0).getTime();
                const dateB = new Date(b.created_at || b.createdAt || 0).getTime();
                return dateB - dateA;
            });

        campaignCurrentPage = 1;
        renderCampaignsTable();
        console.log('Recent campaigns loaded successfully, count:', allCampaigns.length);
    } catch (err) {
        console.error('Error loading campaigns:', err);
        showNotification(err.message || 'Erreur lors du chargement des campagnes', 'error');
    }
}

function renderCampaignsTable() {
    const tbody = document.getElementById('campaigns-table-body') || document.querySelector('tbody');
    if (!tbody) {
        throw new Error('Table des campagnes introuvable');
    }
    tbody.innerHTML = ''; // Clear existing rows

    const filteredCampaigns = allCampaigns.filter(campaign => {
        if (campaignMediaFilter === 'image') return !isVideoCampaign(campaign);
        if (campaignMediaFilter === 'video') return isVideoCampaign(campaign);
        return true;
    });

    const totalPages = Math.max(1, Math.ceil(filteredCampaigns.length / CAMPAIGNS_PAGE_SIZE));
    if (campaignCurrentPage > totalPages) campaignCurrentPage = totalPages;
    if (campaignCurrentPage < 1) campaignCurrentPage = 1;

    const pageStart = (campaignCurrentPage - 1) * CAMPAIGNS_PAGE_SIZE;
    const pageCampaigns = filteredCampaigns.slice(pageStart, pageStart + CAMPAIGNS_PAGE_SIZE);

    const paginationInfo = document.getElementById('campaigns-pagination-info');
    const pageIndicator = document.getElementById('campaigns-page-indicator');
    const prevBtn = document.getElementById('campaigns-prev-page');
    const nextBtn = document.getElementById('campaigns-next-page');

    if (paginationInfo) {
        paginationInfo.textContent = `${filteredCampaigns.length} campagne${filteredCampaigns.length > 1 ? 's' : ''}`;
    }
    if (pageIndicator) {
        pageIndicator.textContent = `Page ${campaignCurrentPage} / ${totalPages}`;
    }
    if (prevBtn) prevBtn.disabled = campaignCurrentPage <= 1;
    if (nextBtn) nextBtn.disabled = campaignCurrentPage >= totalPages;

    if (filteredCampaigns.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-8 py-8 text-center text-slate-500">
                    Aucune campagne disponible pour le moment.
                </td>
            </tr>
        `;
        console.log('No campaigns to display for current filter');
        return;
    }

        pageCampaigns.forEach(campaign => {
            const impressions = getCampaignMetric(campaign, ['impressions', 'views', 'view_count', 'reach']);
            const clicks = getCampaignMetric(campaign, ['clicks', 'click_count']);
            const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(1) : '0.0';
            const row = document.createElement('tr');
            row.className = 'border-b border-slate-50 hover:bg-slate-50/50 transition-all cursor-pointer';
            row.setAttribute('role', 'button');
            row.setAttribute('tabindex', '0');

            row.innerHTML = `
                <td class="px-6 py-4 text-sm font-bold text-slate-900">Slot ${campaign.carousel_slot ?? '-'}</td>
                <td class="px-8 py-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                            ${isVideoCampaign(campaign) ? '<svg class="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>' : '<svg class="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>'}
                        </div>
                        <div>
                            <p class="font-bold text-slate-900 text-sm">${campaign.title}</p>
                            <p class="text-xs text-slate-500">${formatCampaignDate(campaign.created_at)}</p>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <span class="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold">Active</span>
                </td>
                <td class="px-6 py-4 text-center">
                    <span class="font-bold text-slate-900">${formatCount(impressions)}</span>
                </td>
                <td class="px-6 py-4 text-center">
                    <span class="font-bold text-slate-900">${ctr}%</span>
                </td>
                <td class="px-8 py-4 text-right space-x-2">
                    <button class="campaign-edit-btn inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 transition-colors" type="button" aria-label="Modifier la campagne">
                        Modifier
                    </button>
                    <button class="campaign-remove-video-btn inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-50 transition-colors" type="button" ${campaign.media_type === 'video' ? '' : 'hidden'} aria-label="Supprimer la vidéo">
                        Supprimer vidéo
                    </button>
                    <button class="campaign-delete-btn inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 transition-colors" type="button" ${isVideoCampaign(campaign) ? 'hidden' : ''} aria-label="Supprimer la campagne">
                        Supprimer
                    </button>
                </td>
            `;

            row.addEventListener('click', () => openCampaignModal(campaign));
            row.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openCampaignModal(campaign);
                }
            });

            const editBtn = row.querySelector('.campaign-edit-btn');
            if (editBtn) {
                editBtn.addEventListener('click', (event) => {
                    event.stopPropagation();
                    enterEditMode(campaign);
                });
            }

            const removeVideoBtn = row.querySelector('.campaign-remove-video-btn');
            if (removeVideoBtn) {
                if (!isVideoCampaign(campaign)) {
                    removeVideoBtn.classList.add('hidden');
                }
                removeVideoBtn.addEventListener('click', async (event) => {
                    event.stopPropagation();
                    await deleteCampaignVideo(campaign);
                });
            }

            const deleteBtn = row.querySelector('.campaign-delete-btn');
            if (deleteBtn) {
                if (isVideoCampaign(campaign)) {
                    deleteBtn.classList.add('hidden');
                }
                deleteBtn.addEventListener('click', async (event) => {
                    event.stopPropagation();
                    const campaignId = campaign?.id || campaign?.campaign_id || campaign?._id;
                    await deleteCampaign(campaignId);
                });
            }

            tbody.appendChild(row);
        });
}

// Charger les campagnes au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('#campaigns-media-filter .campaign-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            campaignMediaFilter = btn.dataset.filter;
            campaignCurrentPage = 1;
            document.querySelectorAll('#campaigns-media-filter .campaign-filter-btn').forEach(b => {
                b.classList.remove('bg-white', 'shadow-sm', 'text-indigo-600');
                b.classList.add('text-slate-500');
            });
            btn.classList.add('bg-white', 'shadow-sm', 'text-indigo-600');
            btn.classList.remove('text-slate-500');
            renderCampaignsTable();
        });
    });

    document.getElementById('campaigns-prev-page')?.addEventListener('click', () => {
        campaignCurrentPage -= 1;
        renderCampaignsTable();
    });
    document.getElementById('campaigns-next-page')?.addEventListener('click', () => {
        campaignCurrentPage += 1;
        renderCampaignsTable();
    });

    const minAgeInput = document.getElementById('ad-min-age');
    const rangeMinInput = document.getElementById('ad-range-min-age');
    const rangeMaxInput = document.getElementById('ad-range-max-age');
    const targetAgeInput = document.getElementById('ad-target-age');
    const ageToleranceInput = document.getElementById('ad-age-tolerance');

    // Initialize gender selection
    selectGender('all');
    // Initialize user type selection
    selectUserType('all');
    minAgeInput?.addEventListener('input', updateAgeTargetingSummary);
    rangeMinInput?.addEventListener('input', () => {
        syncAgeRangeInputs('min');
        updateAgeTargetingSummary();
    });
    rangeMaxInput?.addEventListener('input', () => {
        syncAgeRangeInputs('max');
        updateAgeTargetingSummary();
    });
    targetAgeInput?.addEventListener('input', updateAgeTargetingSummary);
    ageToleranceInput?.addEventListener('input', updateAgeTargetingSummary);
    selectAgeTargetingMode('none');
    void loadAvailableQuartiers();
    updateSelectedUsersDisplay();
    document.querySelector('input[type="range"]:not([id])')?.closest('.space-y-3')?.classList.add('hidden');
    ensureCampaignModalLayout();
    document.getElementById('campaign-modal-close')?.addEventListener('click', closeCampaignModal);
    document.getElementById('campaign-modal-close-footer')?.addEventListener('click', closeCampaignModal);
    document.getElementById('campaign-modal-delete')?.addEventListener('click', deleteCampaign);
    document.getElementById('campaign-modal-delete-header')?.addEventListener('click', deleteCampaign);
    document.getElementById('campaign-modal-delete-video-header')?.addEventListener('click', () => deleteCampaignVideo(campaignBeingEdited));
    document.getElementById('campaign-modal-edit-header')?.addEventListener('click', () => enterEditMode(campaignBeingEdited));
    document.querySelector('[data-close-campaign-modal="true"]')?.addEventListener('click', closeCampaignModal);
    document.getElementById('campaign-modal')?.addEventListener('click', (event) => {
        if (event.target?.id === 'campaign-modal') {
            closeCampaignModal();
        }
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeCampaignModal();
        }
    });
    loadCampaigns();
});

