/**
 * Admin Messaging Service - Consolidated View
 * Shows all universities and training centres with their messages
 */

const MESSAGING_SERVICE_URL = localStorage.getItem('messaging_service_url') || 'https://universearch-messaging.onrender.com';
const SOCKET_URL = localStorage.getItem('socket_url') || 'https://universearch-messaging.onrender.com';
const API_BASE = 'https://universearch-9qle.onrender.com';

// State management
const adminState = {
    universities: [],
    centres: [],
    allInstitutions: [],
    filteredInstitutions: [],
    activeFilter: 'all',
    activeInstitutionId: null,
    activeConversationId: null,
    cachedMessages: {},
    socket: null,
    jwtToken: null,
};

const getJWTToken = () => {
    try {
        // Try softura_token first (direct JWT token string)
        const softurToken = localStorage.getItem('softura_token');
        if (softurToken && softurToken.startsWith('eyJ')) {
            return softurToken;
        }
        
        // Try softura_session (might be JSON object with jwt_token)
        const sessionStr = localStorage.getItem('softura_session');
        if (sessionStr) {
            try {
                const session = JSON.parse(sessionStr);
                if (session.jwt_token) return session.jwt_token;
            } catch (e) {
                // Not JSON, just string
                if (sessionStr.startsWith('eyJ')) return sessionStr;
            }
        }
        
        // Try jwt_token directly
        const jwtToken = localStorage.getItem('jwt_token');
        if (jwtToken && jwtToken.startsWith('eyJ')) {
            return jwtToken;
        }
        
        // Last resort - return softura_token if it exists (even if not JWT format)
        return softurToken || '';
    } catch (error) {
        console.error('Error retrieving JWT token:', error);
        return '';
    }
};

const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
};

const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

// API client
const adminAPI = {
    async getAllUniversities() {
        try {
            const response = await fetch(`${API_BASE}/universites`, {
                headers: { 'Content-Type': 'application/json' }
            });
            if (!response.ok) return [];
            const result = await response.json();
            return (Array.isArray(result) ? result : result.data || []).map(u => ({
                ...u,
                type: 'universite',
                displayName: u.nom || u.name || '?'
            }));
        } catch (error) {
            console.error('Error fetching universities:', error);
            return [];
        }
    },

    async getAllCentres() {
        try {
            const response = await fetch(`${API_BASE}/centres`, {
                headers: { 'Content-Type': 'application/json' }
            });
            if (!response.ok) return [];
            const result = await response.json();
            return (Array.isArray(result) ? result : result.data || []).map(c => ({
                ...c,
                type: 'centre',
                displayName: c.nom || c.name || '?'
            }));
        } catch (error) {
            console.error('Error fetching centres:', error);
            return [];
        }
    },

    async getConversationsByInstitution(institutionId, type) {
        try {
            const token = getJWTToken();
            if (!token) return [];
            
            console.log(`[Filter] Getting conversations for institution: ${institutionId}`);
            console.log(`[Filter] Token starts with:`, token.substring(0, 20) + '...');
            
            // Try to decode JWT to verify content
            try {
                const parts = token.split('.');
                if (parts.length === 3) {
                    const decoded = JSON.parse(atob(parts[1]));
                    console.log(`[Filter] JWT FULL decoded:`, JSON.stringify(decoded, null, 2));
                    console.log(`[Filter] JWT decoded - is_admin: ${decoded.is_admin}, user_id: ${decoded.user_id}`);
                }
            } catch (e) {
                console.warn('[Filter] Could not decode JWT', e.message);
            }
            
            // Fetch all conversations
            const response = await fetch(
                `${MESSAGING_SERVICE_URL}/conversations?limit=100&offset=0`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    }
                }
            );
            
            console.log(`[Filter] API response status: ${response.status}`);
            
            if (!response.ok) {
                console.error(`[Filter] API error: ${response.status}`);
                const errorText = await response.text();
                console.error(`[Filter] Error details:`, errorText);
                return [];
            }
            
            const result = await response.json();
            const allConversations = result.data || [];
            
            console.log(`[Filter] Total conversations from API: ${allConversations.length}`);
            if (allConversations.length > 0) {
                console.log(`[Filter] Sample conversation:`, allConversations[0]);
            }
            
            // IMPORTANT: Filter ONLY by institution_id field
            const filtered = allConversations.filter(conv => {
                const matches = conv.institution_id === institutionId;
                if (!matches && allConversations.length > 0 && allConversations.length < 10) {
                    console.log(`[Filter] Conversation ${conv.id} institution_id '${conv.institution_id}' !== '${institutionId}': NO MATCH`);
                }
                return matches;
            });
            
            console.log(`[Filter] ✅ FILTERED RESULT: ${filtered.length} conversations for institution ${institutionId}`);
            
            if (filtered.length === 0 && allConversations.length > 0) {
                console.warn(`[Filter] ⚠️ NO MATCHES! Sample institution_id from API: "${allConversations[0].institution_id}"`);
            }
            
            return filtered;
        } catch (error) {
            console.error('Error fetching conversations:', error);
            return [];
        }
    },

    async getConversationMessages(conversationId) {
        try {
            const token = getJWTToken();
            if (!token) return [];
            
            const response = await fetch(
                `${MESSAGING_SERVICE_URL}/conversations/${conversationId}/messages?limit=50&offset=0`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    }
                }
            );
            
            if (!response.ok) return [];
            const result = await response.json();
            return result.data || [];
        } catch (error) {
            console.error('Error fetching messages:', error);
            return [];
        }
    },

    async countMessagesByInstitution(institutionId, type) {
        try {
            const token = getJWTToken();
            if (!token) return 0;
            
            const conversations = await this.getConversationsByInstitution(institutionId, type);
            let totalMessages = 0;
            
            for (const conv of conversations) {
                const messages = await this.getConversationMessages(conv.id);
                totalMessages += messages.length;
            }
            
            return totalMessages;
        } catch (error) {
            console.error(`Error counting messages for institution ${institutionId}:`, error);
            return 0;
        }
    },
};

// Initialize Socket.io
const initializeSocket = () => {
    if (!window.io) return null;
    const token = getJWTToken();
    if (!token) return null;
    const socket = window.io(SOCKET_URL, {
        auth: { token: token },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
    });
    socket.on('connect', () => console.log('🔗 Admin connected via Socket.io'));
    socket.on('disconnect', () => console.log('❌ Socket.io disconnected'));
    socket.on('new_message', (message) => {
        console.log('[Socket.io] 📨 New message received:',  message);
        console.log('[Socket.io] Message sender_type:', message.sender_type);
        
        // Ensure message has sender_type, default to 'admin' if missing
        if (!message.sender_type) {
            message.sender_type = 'admin';
            console.log('⚠️ Fixed missing sender_type in Socket.io message, set to admin');
        }
        
        if (!adminState.cachedMessages[message.conversation_id]) {
            adminState.cachedMessages[message.conversation_id] = [];
        }
        adminState.cachedMessages[message.conversation_id].push(message);
        console.log(`[Socket.io] Message added to cache for conversation ${message.conversation_id}`);
        console.log(`[Socket.io] Active conversation: ${adminState.activeConversationId}`);
        if (message.conversation_id === adminState.activeConversationId) {
            console.log('[Socket.io] ✅ Rendering new message immediately!');
            renderMessages();
        }
    });
    socket.on('error', (error) => console.error('❌ Socket.io error:', error));
    socket.on('connect_error', (error) => console.error('❌ Socket.io connection error:', error));
    return socket;
};

async function renderInstitutions() {
    const list = document.getElementById('universities-list');
    const search = document.getElementById('universities-search')?.value?.toLowerCase() || '';
    if (!list) return;
    const filtered = adminState.filteredInstitutions.filter(inst => !search || inst.displayName.toLowerCase().includes(search));
    list.innerHTML = '';
    if (filtered.length === 0) {
        list.innerHTML = `<div class="no-institutions">Aucune institution</div>`;
        return;
    }
    
    // Render institutions IMMEDIATELY with placeholder counters
    filtered.forEach((inst, index) => {
        const button = document.createElement('button');
        button.className = `university-item ${inst.id === adminState.activeInstitutionId ? 'active' : ''}`;
        button.id = `inst-btn-${inst.id}`;
        const badge = inst.type === 'universite' ? 'Univ.' : 'Centre';
        const initials = inst.displayName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
        
        // Use logo_url, logo, or image - with initials fallback
        const logoUrl = inst.logo_url || inst.logo || inst.image || null;
        // Show "?" instead of actual count initially
        const avatarHtml = logoUrl 
            ? `<div class="university-avatar institution-logo-wrapper"><img src="${logoUrl}" alt="${escapeHtml(inst.displayName)}" class="institution-logo" onerror="this.style.display='none'; this.parentElement.insertAdjacentHTML('afterbegin', '<span class=\'initials\'>${initials}</span>')"><span class="message-counter" id="counter-${inst.id}">?</span></div>`
            : `<div class="university-avatar"><span class="initials">${initials}</span><span class="message-counter" id="counter-${inst.id}">?</span></div>`;
        
        button.innerHTML = `${avatarHtml}<div class="institution-info"><div class="institution-name">${escapeHtml(inst.displayName)}</div></div><span class="institution-badge ${inst.type}">${badge}</span>`;
        button.addEventListener('click', async () => {
            console.log(`[Admin] Clicking institution: ${inst.displayName} (${inst.id})`);
            adminState.activeInstitutionId = inst.id;
            adminState.activeConversationId = null;
            const conversations = await adminAPI.getConversationsByInstitution(inst.id, inst.type);
            console.log(`[Admin] Found ${conversations.length} conversations for ${inst.displayName}`);
            if (conversations.length > 0) {
                console.log('[Admin] Sample conversation:', conversations[0]);
                adminState.activeConversationId = conversations[0].id;
                await loadMessages();
            } else {
                console.warn(`[Admin] No conversations found for institution ${inst.displayName}`);
                document.getElementById('chat-thread').innerHTML = `<div id="chat-empty" class="empty-chat"><div><i class="fa-regular fa-comments" style="font-size: 28px; color: #cbd5e1;"></i><div class="empty-chat-text">Aucune conversation</div><div class="empty-chat-hint">Cette institution n'a pas encore de messages</div></div></div>`;
            }
            updateChatHeader(inst);
            
            // Update active state without reloading the whole list
            const activeButtons = list.querySelectorAll('.university-item');
            activeButtons.forEach(b => b.classList.remove('active'));
            button.classList.add('active');
        });
        list.appendChild(button);
    });
    
    // Load message counts in BACKGROUND without blocking UI
    console.log('[Render] Loading message counts in background...');
    filtered.forEach((inst) => {
        adminAPI.countMessagesByInstitution(inst.id, inst.type).then(count => {
            const counterElement = document.getElementById(`counter-${inst.id}`);
            if (counterElement) {
                console.log(`[Background] Updated counter for ${inst.displayName}: ${count}`);
                counterElement.textContent = count;
            }
        }).catch(err => console.error(`Error loading counter for ${inst.displayName}:`, err));
    });
}

async function loadMessages() {
    if (!adminState.activeConversationId) return;
    
    // Join the conversation room in Socket.io
    if (adminState.socket) {
        console.log(`[Socket.io] Joining conversation: ${adminState.activeConversationId}`);
        adminState.socket.emit('join_conversation', adminState.activeConversationId);
    }
    
    const messages = await adminAPI.getConversationMessages(adminState.activeConversationId);
    adminState.cachedMessages[adminState.activeConversationId] = messages;
    renderMessages();
}

function renderMessages() {
    const chatThread = document.getElementById('chat-thread');
    if (!adminState.activeConversationId || !chatThread) return;
    const messages = adminState.cachedMessages[adminState.activeConversationId] || [];
    if (messages.length === 0) {
        chatThread.innerHTML = `<div id="chat-empty" class="empty-chat"><div><i class="fa-regular fa-comments" style="font-size: 28px; color: #cbd5e1;"></i><div class="empty-chat-text">Aucun message</div><div class="empty-chat-hint">Aucune conversation</div></div></div>`;
        return;
    }
    const fragments = [];
    let currentDate = null;
    messages.forEach((msg) => {
        const msgDate = new Date(msg.created_at);
        const displayDate = msgDate.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long'});
        const msgDateOnly = new Date(msgDate.getFullYear(), msgDate.getMonth(), msgDate.getDate());
        if (!currentDate || msgDateOnly.getTime() !== currentDate.getTime()) {
            currentDate = msgDateOnly;
            fragments.push(`<div class="date-divider">${displayDate.charAt(0).toUpperCase() + displayDate.slice(1)}</div>`);
        }
        const isOutgoing = msg.sender_type === 'admin'; // Admin messages are outgoing (left, gray)
        console.log(`[Render] Message from ${msg.sender_type}: "${msg.text.substring(0, 30)}" - isOutgoing: ${isOutgoing}`);
        
        if (isOutgoing) {
            // Admin message (left, gray)
            fragments.push(`<div class="message-row outgoing"><div class="message-avatar" style="background: #f1f5f9; color: #0f172a; border: 1px solid #e2e8f0;">A</div><div class="message-bubble"><div class="message-text">${escapeHtml(msg.text)}</div>${msg.file_name ? `<div class="message-file">📎 ${escapeHtml(msg.file_name)}</div>` : ''}<div class="message-meta">${formatDateTime(msg.created_at)}</div></div></div>`);
        } else {
            // Institution message (right, blue)
            fragments.push(`<div class="message-row incoming"><div class="message-bubble"><div class="message-text">${escapeHtml(msg.text)}</div>${msg.file_name ? `<div class="message-file">📎 ${escapeHtml(msg.file_name)}</div>` : ''}<div class="message-meta">${formatDateTime(msg.created_at)}</div></div><div class="message-avatar" style="background: #7c3aed; color: white;">U</div></div>`);
        }
    });
    chatThread.innerHTML = fragments.join('');
    chatThread.scrollTop = chatThread.scrollHeight;
}

async function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const text = messageInput.value.trim();
    
    if (!text) {
        console.warn('Message vide');
        return;
    }
    
    if (!adminState.activeConversationId) {
        console.error('Aucune conversation sélectionnée');
        alert('Veuillez sélectionner une institution');
        return;
    }
    
    const sendBtn = document.getElementById('send-message');
    sendBtn.disabled = true;
    
    try {
        console.log(`[Send] Sending message to conversation ${adminState.activeConversationId}`);
        const token = getJWTToken();
        console.log(`[Send] JWT Token present:`, token ? '✅ Yes' : '❌ No');
        console.log(`[Send] Full JWT Token:`, token);
        console.log(`[Send] softura_session:`, localStorage.getItem('softura_session'));
        console.log(`[Send] jwt_token:`, localStorage.getItem('jwt_token'));
        console.log(`[Send] softura_token:`, localStorage.getItem('softura_token'));
        
        // Try to decode JWT to check is_admin
        if (token) {
            try {
                const parts = token.split('.');
                console.log(`[Send] JWT parts count:`, parts.length);
                if (parts.length === 3) {
                    const decoded = JSON.parse(atob(parts[1]));
                    console.log(`[Send] JWT decoded:`, decoded);
                    console.log(`[Send] is_admin:`, decoded.is_admin);
                    console.log(`[Send] user_id:`, decoded.user_id);
                }
            } catch (e) {
                console.warn('[Send] Could not decode JWT:', e.message);
            }
        }
        
        const messagePayload = {
            conversation_id: adminState.activeConversationId,
            text: text
        };
        
        console.log(`[Send] Payload:`, messagePayload);
        
        const response = await fetch(
            `${MESSAGING_SERVICE_URL}/messages`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(messagePayload)
            }
        );
        
        if (!response.ok) {
            const error = await response.text();
            console.error(`[Send] Error: ${response.status}`, error);
            alert('Erreur lors de l\'envoi du message: ' + response.status);
            return;
        }
        
        const result = await response.json();
        console.log(`[Send] Message sent:`, result);
        console.log(`[Send] sender_type in response:`, result.data?.sender_type);
        console.log(`[Send] Full message object:`, JSON.stringify(result.data, null, 2));
        
        // Ensure the message has sender_type = 'admin' before caching
        if (result.data && !result.data.sender_type) {
            result.data.sender_type = 'admin';
            console.log('⚠️ Fixed missing sender_type, set to admin');
        }
        
        // Cache the message immediately with correct sender_type
        if (!adminState.cachedMessages[adminState.activeConversationId]) {
            adminState.cachedMessages[adminState.activeConversationId] = [];
        }
        adminState.cachedMessages[adminState.activeConversationId].push(result.data);
        
        // Emit Socket.io event to notify other clients in real-time
        if (adminState.socket && result.data) {
            console.log('[Send] 📡 Emitting message_sent event via Socket.io');
            adminState.socket.emit('message_sent', {
                conversationId: adminState.activeConversationId,
                messageId: result.data.id,
                sender_id: result.data.sender_id,
                text: result.data.text,
                created_at: result.data.created_at,
            });
        }
        
        // Clear input
        messageInput.value = '';
        messageInput.style.height = 'auto';
        
        // Render immediately from cache to show message instantly with correct sender_type
        renderMessages();
        
        // Then reload messages from API in background to ensure consistency
        setTimeout(() => loadMessages(), 100);
        
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Erreur lors de l\'envoi du message: ' + error.message);
    } finally {
        sendBtn.disabled = false;
    }
}

function updateChatHeader(institution) {
    const chatName = document.getElementById('chat-name');
    const chatStatus = document.getElementById('chat-status');
    const chatAvatar = document.getElementById('chat-avatar');
    if (chatName) chatName.textContent = institution.displayName;
    if (chatStatus) chatStatus.textContent = `${institution.type === 'universite' ? '🏫' : '🎓'} ${institution.type === 'universite' ? 'Université' : 'Centre'}`;
    if (chatAvatar) chatAvatar.textContent = institution.displayName.charAt(0).toUpperCase();
}

function applyFilter(filterType) {
    adminState.activeFilter = filterType;
    if (filterType === 'all') {
        adminState.filteredInstitutions = [...adminState.allInstitutions];
    } else if (filterType === 'universite') {
        adminState.filteredInstitutions = adminState.allInstitutions.filter(i => i.type === 'universite');
    } else if (filterType === 'centre') {
        adminState.filteredInstitutions = adminState.allInstitutions.filter(i => i.type === 'centre');
    }
    renderInstitutions();
}

async function initializeAdminMessaging() {
    const token = getJWTToken();
    console.log('[Init] JWT Token:', token ? '✅ Present' : '❌ Missing');
    if (!token) {
        document.querySelector('.messaging-shell').innerHTML = `<div style="padding: 40px; text-align: center;"><h3>Connexion requise</h3><button onclick="window.location.href='./login.html'" style="background: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">Se connecter</button></div>`;
        return;
    }
    adminState.socket = initializeSocket();
    console.log('[Init] Messaging Service URL:', MESSAGING_SERVICE_URL);
    const [universities, centres] = await Promise.all([adminAPI.getAllUniversities(), adminAPI.getAllCentres()]);
    console.log('[Init] Loaded universities:', universities.length, 'centres:', centres.length);
    adminState.universities = universities;
    adminState.centres = centres;
    adminState.allInstitutions = [...universities, ...centres];
    applyFilter('all');
    document.getElementById('universities-search')?.addEventListener('input', renderInstitutions);
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            applyFilter(e.target.dataset.filter);
        });
    });
    
    // Message composer
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-message');
    
    if (messageInput && sendBtn) {
        // Send message on button click
        sendBtn.addEventListener('click', sendMessage);
        
        // Send message on Enter (Shift+Enter for new line)
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        // Auto-grow textarea
        messageInput.addEventListener('input', () => {
            messageInput.style.height = 'auto';
            messageInput.style.height = Math.min(messageInput.scrollHeight, 100) + 'px';
        });
    }
}

document.addEventListener('DOMContentLoaded', initializeAdminMessaging);

function handleLogout() {
    if (confirm('Êtes-vous sûr de vouloir vous déconnecter?')) {
        // Clear all local storage
        localStorage.clear();
        // Redirect to login
        window.location.href = './login.html';
    }
}
