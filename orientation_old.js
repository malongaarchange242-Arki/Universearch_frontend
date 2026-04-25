/**
 * Orientation PROA & PORA - Gamified Quiz Frontend Logic
 *
 * This script implements a gamified quiz experience with:
 * - One question at a time
 * - Multiple choice A, B, C, D options
 * - Auto-advance after selection
 * - Progress indicator
 * - Keyboard support
 * - Smooth transitions
 */

// Configuration
const DEFAULT_CONFIG = {
    PROA_SERVICE_URL: 'http://localhost:8000',
    PORA_SERVICE_URL: 'http://localhost:8080',
    API_TIMEOUT: 10000,
    ENABLE_ANIMATIONS: true,
    ENABLE_TOAST_NOTIFICATIONS: true,
    AUTO_ADVANCE_DELAY: 400 // ms
};

let config = { ...DEFAULT_CONFIG };
let PROA_API = config.PROA_SERVICE_URL;
let PORA_API = config.PORA_SERVICE_URL;

// Quiz Data
const QUIZ_QUESTIONS = [
    {
        id: 'q1',
        question: "J'aime résoudre des problèmes complexes et trouver des solutions créatives.",
        options: [
            { key: 'A', text: 'Pas du tout', value: 1 },
            { key: 'B', text: 'Un peu', value: 2 },
            { key: 'C', text: 'Beaucoup', value: 3 },
            { key: 'D', text: 'Totalement', value: 4 }
        ]
    },
    {
        id: 'q2',
        question: "Je suis fasciné par le fonctionnement des machines et des technologies.",
        options: [
            { key: 'A', text: 'Pas du tout', value: 1 },
            { key: 'B', text: 'Un peu', value: 2 },
            { key: 'C', text: 'Beaucoup', value: 3 },
            { key: 'D', text: 'Totalement', value: 4 }
        ]
    },
    {
        id: 'q3',
        question: "J'aime créer des choses nouvelles et exprimer mon imagination.",
        options: [
            { key: 'A', text: 'Pas du tout', value: 1 },
            { key: 'B', text: 'Un peu', value: 2 },
            { key: 'C', text: 'Beaucoup', value: 3 },
            { key: 'D', text: 'Totalement', value: 4 }
        ]
    },
    {
        id: 'q4',
        question: "Je préfère travailler en équipe et aider les autres.",
        options: [
            { key: 'A', text: 'Pas du tout', value: 1 },
            { key: 'B', text: 'Un peu', value: 2 },
            { key: 'C', text: 'Beaucoup', value: 3 },
            { key: 'D', text: 'Totalement', value: 4 }
        ]
    },
    {
        id: 'q5',
        question: "J'adore analyser des données et en tirer des conclusions.",
        options: [
            { key: 'A', text: 'Pas du tout', value: 1 },
            { key: 'B', text: 'Un peu', value: 2 },
            { key: 'C', text: 'Beaucoup', value: 3 },
            { key: 'D', text: 'Totalement', value: 4 }
        ]
    },
    {
        id: 'q6',
        question: "Je suis curieux de comprendre comment les choses fonctionnent techniquement.",
        options: [
            { key: 'A', text: 'Pas du tout', value: 1 },
            { key: 'B', text: 'Un peu', value: 2 },
            { key: 'C', text: 'Beaucoup', value: 3 },
            { key: 'D', text: 'Totalement', value: 4 }
        ]
    },
    {
        id: 'q7',
        question: "J'aime imaginer, dessiner ou écrire pour exprimer mes idées.",
        options: [
            { key: 'A', text: 'Pas du tout', value: 1 },
            { key: 'B', text: 'Un peu', value: 2 },
            { key: 'C', text: 'Beaucoup', value: 3 },
            { key: 'D', text: 'Totalement', value: 4 }
        ]
    },
    {
        id: 'q8',
        question: "Je suis à l'aise pour parler avec les autres et partager des idées.",
        options: [
            { key: 'A', text: 'Pas du tout', value: 1 },
            { key: 'B', text: 'Un peu', value: 2 },
            { key: 'C', text: 'Beaucoup', value: 3 },
            { key: 'D', text: 'Totalement', value: 4 }
        ]
    },
    {
        id: 'q9',
        question: "Je préfère les activités qui demandent de la réflexion et de la logique.",
        options: [
            { key: 'A', text: 'Pas du tout', value: 1 },
            { key: 'B', text: 'Un peu', value: 2 },
            { key: 'C', text: 'Beaucoup', value: 3 },
            { key: 'D', text: 'Totalement', value: 4 }
        ]
    },
    {
        id: 'q10',
        question: "Je rêve de construire des applications ou des systèmes innovants.",
        options: [
            { key: 'A', text: 'Pas du tout', value: 1 },
            { key: 'B', text: 'Un peu', value: 2 },
            { key: 'C', text: 'Beaucoup', value: 3 },
            { key: 'D', text: 'Totalement', value: 4 }
        ]
    },
    {
        id: 'q11',
        question: "J'aime proposer des solutions originales et sortir des sentiers battus.",
        options: [
            { key: 'A', text: 'Pas du tout', value: 1 },
            { key: 'B', text: 'Un peu', value: 2 },
            { key: 'C', text: 'Beaucoup', value: 3 },
            { key: 'D', text: 'Totalement', value: 4 }
        ]
    },
    {
        id: 'q12',
        question: "J'aime aider les autres à se sentir bien et épanouis.",
        options: [
            { key: 'A', text: 'Pas du tout', value: 1 },
            { key: 'B', text: 'Un peu', value: 2 },
            { key: 'C', text: 'Beaucoup', value: 3 },
            { key: 'D', text: 'Totalement', value: 4 }
        ]
    }
];

// Game State
let currentQuestionIndex = 0;
let selectedAnswers = {};
let userProfile = null;
let recommendations = [];
let isTransitioning = false;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initPage();
    loadConfig();
    initQuiz();
    setupEventListeners();
});

function loadConfig() {
    fetch('./orientation-config.json')
        .then(response => response.json())
        .then(data => {
            config = { ...DEFAULT_CONFIG, ...data };
            PROA_API = config.PROA_SERVICE_URL;
            PORA_API = config.PORA_SERVICE_URL;
        })
        .catch(() => {
            console.warn('Configuration non trouvée, utilisation des valeurs par défaut.');
            config = { ...DEFAULT_CONFIG };
            PROA_API = config.PROA_SERVICE_URL;
            PORA_API = config.PORA_SERVICE_URL;
        });
}

function initPage() {
    setTimeout(() => {
        const loader = document.getElementById('page-loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => (loader.style.display = 'none'), 300);
        }
    }, 800);
}

function setupEventListeners() {
    // Keyboard support
    document.addEventListener('keydown', handleKeyPress);

    // User ID validation
    document.getElementById('user-id').addEventListener('input', validateUserId);

    // Results section buttons
    document.getElementById('get-recommendations').addEventListener('click', showRecommendations);
    document.getElementById('retake-quiz').addEventListener('click', retakeQuiz);
}

function initQuiz() {
    renderQuestion();
    updateProgress();
}

function renderQuestion() {
    if (currentQuestionIndex >= QUIZ_QUESTIONS.length) {
        showResults();
        return;
    }

    const question = QUIZ_QUESTIONS[currentQuestionIndex];
    const questionText = document.getElementById('question-text');
    const optionsContainer = document.getElementById('options-container');

    // Add exit animation to current question
    if (questionText.textContent !== 'Chargement de la question...') {
        questionText.classList.add('question-exit');
        optionsContainer.classList.add('question-exit');

        setTimeout(() => {
            updateQuestionContent(question, questionText, optionsContainer);
        }, 150);
    } else {
        updateQuestionContent(question, questionText, optionsContainer);
    }
}

function updateQuestionContent(question, questionText, optionsContainer) {
    // Update question text
    questionText.textContent = question.question;
    questionText.classList.remove('question-exit');
    questionText.classList.add('question-enter');

    // Clear and update options
    optionsContainer.innerHTML = '';
    optionsContainer.classList.remove('question-exit');

    question.options.forEach((option, index) => {
        const optionElement = createOptionElement(option, index);
        optionsContainer.appendChild(optionElement);
    });

    // Add enter animation
    setTimeout(() => {
        optionsContainer.classList.add('question-enter');
    }, 50);
}

function createOptionElement(option, index) {
    const optionDiv = document.createElement('div');
    optionDiv.className = 'quiz-option';
    optionDiv.dataset.key = option.key;
    optionDiv.dataset.value = option.value;
    optionDiv.dataset.index = index;

    optionDiv.innerHTML = `
        <div class="option-letter">${option.key}</div>
        <div class="option-text">${option.text}</div>
    `;

    optionDiv.addEventListener('click', () => handleAnswer(option));
    return optionDiv;
}

function handleAnswer(option) {
    if (isTransitioning) return;

    const question = QUIZ_QUESTIONS[currentQuestionIndex];
    selectedAnswers[question.id] = option.value;

    // Visual feedback
    highlightSelectedOption(option.key);

    // Auto-advance after delay
    isTransitioning = true;
    setTimeout(() => {
        nextQuestion();
    }, config.AUTO_ADVANCE_DELAY);
}

function highlightSelectedOption(selectedKey) {
    const options = document.querySelectorAll('.quiz-option');
    options.forEach(option => {
        if (option.dataset.key === selectedKey) {
            option.classList.add('selected');
        } else {
            option.classList.remove('selected');
        }
    });
}

function nextQuestion() {
    currentQuestionIndex++;
    updateProgress();
    isTransitioning = false;
    renderQuestion();
}

function updateProgress() {
    const progress = ((currentQuestionIndex) / QUIZ_QUESTIONS.length) * 100;
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');

    progressBar.style.width = `${progress}%`;
    progressText.textContent = `Question ${Math.min(currentQuestionIndex + 1, QUIZ_QUESTIONS.length)}/${QUIZ_QUESTIONS.length}`;
}

function handleKeyPress(event) {
    if (isTransitioning) return;

    const key = event.key.toUpperCase();
    if (['A', 'B', 'C', 'D'].includes(key)) {
        const question = QUIZ_QUESTIONS[currentQuestionIndex];
        const option = question.options.find(opt => opt.key === key);
        if (option) {
            handleAnswer(option);
        }
    }
}

function validateUserId() {
    const userId = document.getElementById('user-id').value.trim();
    // Could add more validation here if needed
    return userId.length > 0;
}

function showResults() {
    // Hide quiz section
    document.getElementById('quiz-section').classList.add('hidden');

    // Show results section
    document.getElementById('results-section').classList.remove('hidden');

    // Submit quiz data
    submitQuiz();
}

function submitQuiz() {
    const userId = document.getElementById('user-id').value.trim();
    if (!userId) {
        showToast('Veuillez saisir votre identifiant utilisateur.', 'error');
        return;
    }

    const quizData = {
        user_id: userId,
        quiz_version: '1.0',
        responses: selectedAnswers
    };

    fetch(`${PROA_API}/orientation/compute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quizData)
    })
        .then(async response => {
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.detail || 'Erreur lors de l\'analyse');
            }
            return response.json();
        })
        .then(result => {
            userProfile = result;
            showToast('Analyse terminée !', 'success');
            renderProfileChart();
        })
        .catch(error => {
            showToast(error.message || 'Erreur lors de l\'analyse', 'error');
        });
}

function renderProfileChart() {
    const chartContainer = document.getElementById('profile-chart');

    if (!userProfile || !userProfile.scores) {
        chartContainer.innerHTML = '<div class="text-center text-slate-500">Analyse en cours...</div>';
        return;
    }

    // Simple bar chart representation
    const categories = Object.keys(userProfile.scores);
    const maxScore = Math.max(...Object.values(userProfile.scores));

    let html = '<div class="space-y-3">';
    categories.forEach(category => {
        const score = userProfile.scores[category];
        const percentage = (score / maxScore) * 100;

        html += `
            <div class="flex items-center space-x-3">
                <div class="w-20 text-sm font-medium text-slate-700 capitalize">${category}</div>
                <div class="flex-1 bg-slate-200 rounded-full h-3">
                    <div class="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-1000"
                         style="width: ${percentage}%"></div>
                </div>
                <div class="w-12 text-sm text-slate-600 text-right">${score.toFixed(1)}</div>
            </div>
        `;
    });
    html += '</div>';

    chartContainer.innerHTML = html;
}

function renderStrengths() {
    const strengthsContainer = document.getElementById('strengths-list');

    if (!userProfile || !userProfile.scores) {
        strengthsContainer.innerHTML = '<li class="text-slate-500">Analyse en cours...</li>';
        return;
    }

    const sortedCategories = Object.entries(userProfile.scores)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3);

    let html = '';
    sortedCategories.forEach(([category, score]) => {
        html += `
            <li class="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg">
                <i class="fas fa-star text-yellow-500"></i>
                <span class="font-medium text-slate-900 capitalize">${category}</span>
                <span class="text-sm text-slate-600">(${score.toFixed(1)})</span>
            </li>
        `;
    });

    strengthsContainer.innerHTML = html;
}

function showRecommendations() {
    document.getElementById('results-section').classList.add('hidden');
    document.getElementById('recommendations-section').classList.remove('hidden');
    getRecommendations();
}

function getRecommendations() {
    if (!userProfile || !userProfile.user_id) {
        showToast('Profil non disponible', 'error');
        return;
    }

    fetch(`${PORA_API}/ranking/universites?user_id=${userProfile.user_id}`)
        .then(async response => {
            if (!response.ok) {
                throw new Error('Erreur lors de la récupération des recommandations');
            }
            return response.json();
        })
        .then(data => {
            recommendations = data;
            displayRecommendations();
        })
        .catch(error => {
            showToast(error.message || 'Erreur lors des recommandations', 'error');
        });
}

function displayRecommendations() {
    const container = document.getElementById('recommendations-list');

    if (!recommendations || recommendations.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <i class="fas fa-search text-6xl text-slate-300 mb-4"></i>
                <h3 class="text-xl font-semibold text-slate-900 mb-2">Aucune recommandation trouvée</h3>
                <p class="text-slate-600">Nous n'avons pas pu trouver d'établissements correspondant à votre profil.</p>
            </div>
        `;
        return;
    }

    let html = '';
    recommendations.slice(0, 10).forEach((rec, index) => {
        const rank = index + 1;
        const medal = rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : '🏅';

        html += `
            <div class="recommendation-card bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg transition-all duration-200">
                <div class="flex items-start space-x-4">
                    <div class="flex-shrink-0 w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-xl">
                        ${medal}
                    </div>
                    <div class="flex-1">
                        <div class="flex items-center justify-between mb-2">
                            <h3 class="text-xl font-bold text-slate-900">${rec.nom || 'Établissement inconnu'}</h3>
                            <div class="flex items-center space-x-2">
                                <span class="text-sm font-medium text-slate-600">Score:</span>
                                <span class="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full text-sm font-semibold">
                                    ${(rec.score * 100).toFixed(1)}%
                                </span>
                            </div>
                        </div>
                        <div class="flex items-center space-x-4 text-sm text-slate-600 mb-3">
                            <span><i class="fas fa-map-marker-alt mr-1"></i>${rec.location || 'Localisation inconnue'}</span>
                            <span><i class="fas fa-graduation-cap mr-1"></i>${rec.type || 'Type inconnu'}</span>
                        </div>
                        <p class="text-slate-700 mb-4">${rec.description || 'Description non disponible.'}</p>
                        <div class="flex items-center justify-between">
                            <div class="flex items-center space-x-2">
                                <i class="fas fa-users text-indigo-600"></i>
                                <span class="text-sm text-slate-600">${rec.followers || 0} followers</span>
                            </div>
                            <button class="bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-600 transition-colors">
                                <i class="fas fa-eye mr-2"></i>Voir détails
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function retakeQuiz() {
    currentQuestionIndex = 0;
    selectedAnswers = {};
    userProfile = null;
    recommendations = [];
    isTransitioning = false;

    document.getElementById('recommendations-section').classList.add('hidden');
    document.getElementById('results-section').classList.add('hidden');
    document.getElementById('quiz-section').classList.remove('hidden');

    document.getElementById('user-id').value = '';
    updateProgress();
    renderQuestion();
}

function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');

    const toast = document.createElement('div');
    toast.className = `max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 transform transition-all duration-300 translate-x-full`;

    const colors = {
        success: 'text-green-600 bg-green-50 border-green-200',
        error: 'text-red-600 bg-red-50 border-red-200',
        warning: 'text-yellow-600 bg-yellow-50 border-yellow-200',
        info: 'text-blue-600 bg-blue-50 border-blue-200'
    };

    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };

    toast.innerHTML = `
        <div class="p-4">
            <div class="flex items-start">
                <div class="ml-3 w-0 flex-1 pt-0.5">
                    <p class="text-sm font-medium text-slate-900">${message}</p>
                </div>
                <div class="ml-4 flex-shrink-0 flex">
                    <button class="bg-white rounded-md inline-flex text-slate-400 hover:text-slate-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            onclick="this.parentElement.parentElement.parentElement.remove()">
                        <span class="sr-only">Fermer</span>
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        </div>
    `;

    toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.remove('translate-x-full'), 100);

    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('translate-x-full');
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}
}

function updateNextButtonState() {
    const userId = document.getElementById('user-id').value.trim();
    const question = QUIZ_QUESTIONS[currentQuestionIndex];
    const hasAnswer = selectedAnswers[question.id] !== undefined;

    const nextBtn = document.getElementById('next-question');
    nextBtn.disabled = !hasAnswer || userId.length === 0;
}

function onNextQuestion() {
    stopTimer();

    if (currentQuestionIndex < QUIZ_QUESTIONS.length - 1) {
        currentQuestionIndex += 1;
        renderQuestion();
    } else {
        showEndScreen();
    }
}

function showEndScreen() {
    stopTimer();
    document.getElementById('end-screen').classList.remove('hidden');
}

function hideEndScreen() {
    document.getElementById('end-screen').classList.add('hidden');
}

function resetTimer() {
    stopTimer();
    secondsRemaining = 30;
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        secondsRemaining -= 1;
        updateTimerDisplay();
        if (secondsRemaining <= 0) {
            clearInterval(timerInterval);
            showToast('Temps écoulé ! Passage à la question suivante.', 'warning');
            onNextQuestion();
        }
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function updateTimerDisplay() {
    const minutes = String(Math.floor(secondsRemaining / 60)).padStart(2, '0');
    const seconds = String(secondsRemaining % 60).padStart(2, '0');
    document.getElementById('timer').textContent = `${minutes}:${seconds}`;
}

function useFiftyFifty() {
    if (!lifelines.fifty) return;

    const buttons = Array.from(document.querySelectorAll('#option-buttons button'));
    const enabledButtons = buttons.filter(btn => !btn.disabled);

    while (enabledButtons.length > 2) {
        const indexToDisable = Math.floor(Math.random() * enabledButtons.length);
        const btn = enabledButtons.splice(indexToDisable, 1)[0];
        btn.disabled = true;
        btn.classList.add('opacity-40', 'cursor-not-allowed');
    }

    lifelines.fifty = false;
    updateLifelines();
    showToast('50:50 utilisé ! Deux réponses ont été supprimées.', 'info');
}

function useAudience() {
    if (!lifelines.audience) return;

    lifelines.audience = false;
    updateLifelines();

    const poll = ANSWER_OPTIONS.map(option => ({
        option: option.key,
        percent: Math.max(10, Math.floor(20 + Math.random() * 40))
    }));

    const best = poll.reduce((prev, curr) => (curr.percent > prev.percent ? curr : prev));
    showToast(`Le public pense que la réponse ${best.option} est la meilleure.`, 'info');
}

function usePhone() {
    if (!lifelines.phone) return;

    lifelines.phone = false;
    updateLifelines();

    const hint = ANSWER_OPTIONS[Math.floor(Math.random() * ANSWER_OPTIONS.length)].key;
    showToast(`Votre ami pense que la réponse ${hint} est correcte.`, 'info');
}

function updateLifelines() {
    document.getElementById('lifelines-remaining').textContent =
        (lifelines.fifty ? 1 : 0) + (lifelines.audience ? 1 : 0) + (lifelines.phone ? 1 : 0);

    document.getElementById('lifeline-5050').disabled = !lifelines.fifty;
    document.getElementById('lifeline-audience').disabled = !lifelines.audience;
    document.getElementById('lifeline-phone').disabled = !lifelines.phone;
}

function submitQuiz() {
    const userId = document.getElementById('user-id').value.trim();
    if (!userId) {
        showToast('Veuillez saisir votre identifiant utilisateur.', 'error');
        return;
    }

    const btn = document.getElementById('analyze-profile');
    btn.disabled = true;
    btn.textContent = 'Analyse en cours...';

    const quizData = {
        user_id: userId,
        quiz_version: '1.0',
        responses: selectedAnswers
    };

    fetch(`${PROA_API}/orientation/compute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quizData)
    })
        .then(async response => {
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.detail || 'Erreur lors de l\'analyse');
            }
            return response.json();
        })
        .then(result => {
            userProfile = result;
            showToast('Analyse terminée !', 'success');
            hideEndScreen();
            showRecommendations();
        })
        .catch(error => {
            showToast(error.message || 'Erreur lors de l\'analyse', 'error');
            btn.disabled = false;
            btn.textContent = 'Analyser mon profil';
        });
}

function showRecommendations() {
    document.getElementById('recommendations-section').classList.remove('hidden');
    getRecommendations();
}

function getRecommendations() {
    if (!userProfile || !userProfile.user_id) {
        showToast('Profil non disponible', 'error');
        return;
    }

    fetch(`${PORA_API}/ranking/universites?user_id=${userProfile.user_id}`)
        .then(async response => {
            if (!response.ok) {
                throw new Error('Erreur lors de la récupération des recommandations');
            }
            return response.json();
        })
        .then(data => {
            recommendations = data;
            displayRecommendations();
        })
        .catch(error => {
            showToast(error.message || 'Erreur lors des recommandations', 'error');
        });
}

function displayRecommendations() {
    const container = document.getElementById('recommendations-list');

    if (!recommendations || recommendations.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <i class="fas fa-search text-6xl text-slate-300 mb-4"></i>
                <h3 class="text-xl font-semibold text-slate-900 mb-2">Aucune recommandation trouvée</h3>
                <p class="text-slate-600">Nous n'avons pas pu trouver d'établissements correspondant à votre profil.</p>
            </div>
        `;
        return;
    }

    let html = '';
    recommendations.slice(0, 10).forEach((rec, index) => {
        const rank = index + 1;
        const medal = rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : '🏅';

        html += `
            <div class="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg transition-all duration-200">
                <div class="flex items-start space-x-4">
                    <div class="flex-shrink-0 w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-xl">
                        ${medal}
                    </div>
                    <div class="flex-1">
                        <div class="flex items-center justify-between mb-2">
                            <h3 class="text-xl font-bold text-slate-900">${rec.nom || 'Établissement inconnu'}</h3>
                            <div class="flex items-center space-x-2">
                                <span class="text-sm font-medium text-slate-600">Score:</span>
                                <span class="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full text-sm font-semibold">
                                    ${(rec.score * 100).toFixed(1)}%
                                </span>
                            </div>
                        </div>
                        <div class="flex items-center space-x-4 text-sm text-slate-600 mb-3">
                            <span><i class="fas fa-map-marker-alt mr-1"></i>${rec.location || 'Localisation inconnue'}</span>
                            <span><i class="fas fa-graduation-cap mr-1"></i>${rec.type || 'Type inconnu'}</span>
                        </div>
                        <p class="text-slate-700 mb-4">${rec.description || 'Description non disponible.'}</p>
                        <div class="flex items-center justify-between">
                            <div class="flex items-center space-x-2">
                                <i class="fas fa-users text-indigo-600"></i>
                                <span class="text-sm text-slate-600">${rec.followers || 0} followers</span>
                            </div>
                            <button class="bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-600 transition-colors">
                                <i class="fas fa-eye mr-2"></i>Voir détails
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function retakeQuiz() {
    currentQuestionIndex = 0;
    selectedAnswers = {};
    lifelines = { fifty: true, audience: true, phone: true };
    userProfile = null;
    recommendations = [];

    hideEndScreen();
    document.getElementById('recommendations-section').classList.add('hidden');

    renderQuestion();
    updateLifelines();
    highlightMoneyStep();
    document.getElementById('user-id').value = '';
    updateNextButtonState();
}

function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');

    const toast = document.createElement('div');
    toast.className = `max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 transform transition-all duration-300 translate-x-full`;

    const colors = {
        success: 'text-green-600 bg-green-50 border-green-200',
        error: 'text-red-600 bg-red-50 border-red-200',
        warning: 'text-yellow-600 bg-yellow-50 border-yellow-200',
        info: 'text-blue-600 bg-blue-50 border-blue-200'
    };

    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };

    toast.innerHTML = `
        <div class="p-4">
            <div class="flex items-start">
                <div class="flex-shrink-0">
                    <i class="${icons[type]} ${colors[type].split(' ')[0]}"></i>
                </div>
                <div class="ml-3 w-0 flex-1 pt-0.5">
                    <p class="text-sm font-medium text-slate-900">${message}</p>
                </div>
                <div class="ml-4 flex-shrink-0 flex">
                    <button class="bg-white rounded-md inline-flex text-slate-400 hover:text-slate-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            onclick="this.parentElement.parentElement.parentElement.remove()">
                        <span class="sr-only">Fermer</span>
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        </div>
    `;

    toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.remove('translate-x-full'), 100);

    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('translate-x-full');
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}
