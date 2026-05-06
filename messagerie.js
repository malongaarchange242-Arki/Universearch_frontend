/**
 * Messaging Service Integration with Socket.io
 * Handles real-time communication between institutions and admins
 * Connected to messaging-service API (universearch-messaging.onrender.com) with WebSocket support
 */

const MESSAGING_SERVICE_URL = localStorage.getItem('messaging_service_url') || 'https://universearch-messaging.onrender.com';
const SOCKET_URL = localStorage.getItem('socket_url') || 'https://universearch-messaging.onrender.com';

// State management
const messagingState = {
    conversations: [],
    activeConversationId: null,
    selectedFile: null,
    isLoading: false,
    jwtToken: null,
    emptyState: null,
    cachedMessages: {}, // Cache messages by conversation ID
    lastMessageHash: {}, // Track message hash to detect changes
    socket: null, // Socket.io connection
};

const DEFAULT_EMPTY_STATE = {
    title: 'Selectionnez une conversation',
    hint: 'Aucune conversation ouverte',
};

// Get JWT token from localStorage
const getJWTToken = () => {
    try {
        const session = JSON.parse(localStorage.getItem('softura_session') || '{}');
        const token = session.jwt_token || localStorage.getItem('jwt_token') || localStorage.getItem('softura_token') || '';
        
        if (token && !window._tokenDecoded) {
            // Decode JWT for debugging
            const parts = token.split('.');
            if (parts.length === 3) {
                try {
                    const payload = JSON.parse(atob(parts[1]));
                    console.log('🔑 JWT Payload decoded:', payload);
                    window._tokenDecoded = true;
                } catch (e) {
                    console.error('Failed to decode JWT:', e);
                }
            }
        }
        
        // Log for debugging - only log when a token IS found or on first check
        if (!token && !window._tokenWarningLogged) {
            console.warn('⚠️ No JWT token found. User must log in.');
            window._tokenWarningLogged = true; // Log only once to avoid spamming console
        }
        
        return token;
    } catch (error) {
        console.error('Error retrieving JWT token:', error);
        return '';
    }
};

const getMessagingUserContext = () => {
    const token = getJWTToken();

    if (!token) {
        return {
            user_id: null,
            is_admin: false,
            institution_id: null,
            institution_type: null,
            role: null,
        };
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
        return {
            user_id: null,
            is_admin: false,
            institution_id: null,
            institution_type: null,
            role: null,
        };
    }

    try {
        const payload = JSON.parse(atob(parts[1]));
        
        // Extract institution_id from JWT (may be missing - that's normal for some roles)
        const institutionId =
            typeof payload.institution_id === 'string' ? payload.institution_id.trim() : '';
        
        // Determine institution_type from role field in JWT
        let institutionType = null;
        if (payload.role === 'centre_formation') {
            institutionType = 'centre_formation';
        } else if (payload.role === 'universite') {
            institutionType = 'universite';
        } else if (payload.institution_type === 'centre_formation' || payload.institution_type === 'universite') {
            institutionType = payload.institution_type;
        }

        const context = {
            user_id: payload.user_id || payload.id || payload.sub || null,
            is_admin: payload.is_admin === true || payload.is_admin === 'true',
            institution_id: institutionId || null,
            institution_type: institutionType,
            role: payload.role || null,
        };

        console.log('👤 User context extracted from JWT:', context);
        return context;
    } catch (error) {
        console.error('Error decoding JWT payload for messaging:', error);
        return {
            user_id: null,
            is_admin: false,
            institution_id: null,
            institution_type: null,
            role: null,
        };
    }
};

/**
 * NOTE: institution_id is NOT available from API endpoints.
 * It MUST come from the JWT token payload (added by identity-service during login).
 * If missing from JWT, the user account doesn't have institution context.
 * 
 * For testing/demo purposes, fall back to demo-mode.
 */
const validateUserHasInstitutionContext = (userContext) => {
    if (userContext.institution_id && userContext.institution_id !== 'demo-mode') {
        console.log('✅ User has institution context:', {
            institution_id: userContext.institution_id,
            institution_type: userContext.institution_type,
            role: userContext.role,
        });
        return true;
    }
    
    console.warn('⚠️ User lacks institution context in JWT');
    console.log('ℹ️ Messaging will operate in demo mode - no institutional filtering');
    console.log('ℹ️ For full functionality, ensure user JWT includes institution_id');
    return false;
};

const isMessageFromCurrentUser = (msg) => {
    const userContext = getMessagingUserContext();
    const currentUserId = userContext.user_id || '';
    if (!currentUserId || !msg.sender_id) return false;
    return String(msg.sender_id) === String(currentUserId);
};

const setComposerEnabled = (enabled) => {
    const messageInput = document.getElementById('message-input');
    const sendMessageButton = document.getElementById('send-message');

    if (messageInput) {
        messageInput.disabled = !enabled;
    }

    if (sendMessageButton) {
        sendMessageButton.disabled = !enabled;
    }
};

const renderChatPlaceholder = (title, hint) => {
    const chatThread = document.getElementById('chat-thread');
    const chatAvatar = document.getElementById('chat-avatar');
    const chatName = document.getElementById('chat-name');
    const chatStatus = document.getElementById('chat-status');

    if (chatThread) {
        chatThread.innerHTML = `
            <div class="empty-chat" id="chat-empty">
                <div>
                    <i class="fa-regular fa-comments"></i>
                    <div class="empty-chat-text">${escapeHtml(title)}</div>
                    <div class="empty-chat-hint">${escapeHtml(hint)}</div>
                </div>
            </div>
        `;
    }

    if (chatAvatar) {
        chatAvatar.textContent = 'AD';
        chatAvatar.classList.remove('online');
    }

    if (chatName) {
        chatName.textContent = title;
    }

    if (chatStatus) {
        chatStatus.textContent = hint;
    }

    setComposerEnabled(false);
};

const setMessagingEmptyState = (title, hint) => {
    messagingState.emptyState = { title, hint };
    renderChatPlaceholder(title, hint);
};

const clearMessagingEmptyState = () => {
    messagingState.emptyState = null;
};

// API client
const messagingAPI = {
    async createConversation(name, description) {
        try {
            const token = getJWTToken();
            if (!token) {
                console.error('Cannot create conversation: No JWT token available');
                return null;
            }
            
            const payload = {
                name: name,
                description: description || null,
            };
            
            console.log('📨 Creating conversation:', payload);
            
            const response = await fetch(`${MESSAGING_SERVICE_URL}/conversations`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Failed to create conversation: ${response.status}`, errorText);
                throw new Error(`Failed to create conversation: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('✅ Conversation created:', result.data);
            return result.data;
        } catch (error) {
            console.error('Error creating conversation:', error);
            return null;
        }
    },

    async getConversations() {
        try {
            const token = getJWTToken();
            if (!token) {
                // Silent return - warning already logged in getJWTToken()
                return [];
            }
            
            const response = await fetch(`${MESSAGING_SERVICE_URL}/conversations?limit=50&offset=0`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                }
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Failed to fetch conversations: ${response.status} ${response.statusText}`, errorText);
                throw new Error(`Failed to fetch conversations: ${response.status}`);
            }
            
            const result = await response.json();
            return result.data || [];
        } catch (error) {
            console.error('Error fetching conversations:', error);
            return [];
        }
    },

    async getConversationMessages(conversationId, limit = 50, offset = 0) {
        try {
            const token = getJWTToken();
            if (!token) {
                console.error('Cannot fetch messages: No JWT token available');
                return [];
            }
            
            const response = await fetch(
                `${MESSAGING_SERVICE_URL}/conversations/${conversationId}/messages?limit=${limit}&offset=${offset}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    }
                }
            );
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Failed to fetch messages: ${response.status} ${response.statusText}`, errorText);
                throw new Error(`Failed to fetch messages: ${response.status}`);
            }
            
            const result = await response.json();
            return result.data || [];
        } catch (error) {
            console.error('Error fetching messages:', error);
            return [];
        }
    },

    async sendMessage(conversationId, text, fileName, fileUrl) {
        try {
            const token = getJWTToken();
            if (!token) {
                console.error('Cannot send message: No JWT token available');
                return null;
            }
            
            const payload = {
                conversation_id: conversationId,
                text: text,
                file_name: fileName || null,
                file_url: fileUrl || null,
            };
            
            console.log('📤 API Call - POST /messages:', payload);
            
            const response = await fetch(`${MESSAGING_SERVICE_URL}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });
            
            const responseText = await response.text();
            console.log(`📨 API Response (${response.status}):`, responseText);
            
            if (!response.ok) {
                console.error(`❌ Failed to send message: ${response.status} ${response.statusText}`);
                console.error('Response body:', responseText);
                throw new Error(`Failed to send message: ${response.status}`);
            }
            
            const result = JSON.parse(responseText);
            return result.data;
        } catch (error) {
            console.error('❌ Error sending message:', error);
            return null;
        }
    },

    async markAsRead(conversationId) {
        try {
            const token = getJWTToken();
            if (!token) {
                console.error('Cannot mark as read: No JWT token available');
                return;
            }
            
            await fetch(`${MESSAGING_SERVICE_URL}/conversations/${conversationId}/read`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                }
            });
        } catch (error) {
            console.error('Error marking conversation as read:', error);
        }
    }
};

// Utility functions
const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

// Initialize Socket.io connection
const initializeSocket = () => {
    if (!window.io) {
        console.error('Socket.io library not loaded!');
        return null;
    }

    const token = getJWTToken();
    if (!token) {
        console.warn('No JWT token for Socket.io connection');
        return null;
    }

    const socket = window.io(SOCKET_URL, {
        auth: {
            token: token
        },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
        console.log('🔗 Connected to Socket.io server');
    });

    socket.on('disconnect', () => {
        console.log('❌ Disconnected from Socket.io server');
    });

    socket.on('new_message', (message) => {
        console.log('📨 New message received via Socket.io:', message);
        console.log('📊 Socket.io message sender_type:', message.sender_type);
        
        // Ensure message has sender_type, default to 'admin' if missing
        if (!message.sender_type) {
            message.sender_type = 'admin';
            console.log('⚠️ Fixed missing sender_type in Socket.io message, set to admin');
        }
        
        // Update cache with new message
        if (!messagingState.cachedMessages[message.conversation_id]) {
            messagingState.cachedMessages[message.conversation_id] = [];
        }
        
        // Add message if not already present (avoid duplicates)
        const exists = messagingState.cachedMessages[message.conversation_id].find(m => m.id === message.id);
        if (!exists) {
            messagingState.cachedMessages[message.conversation_id].push(message);
            
            // Reset hash to trigger re-render
            messagingState.lastMessageHash[message.conversation_id] = null;
            
            // Re-render if this is the active conversation (using cache - no API call)
            if (message.conversation_id === messagingState.activeConversationId) {
                renderMessagesFromCache();
            }
        }
    });

    socket.on('user_typing', (data) => {
        console.log('User typing:', data);
        // Could implement typing indicators here
    });

    socket.on('error', (error) => {
        console.error('Socket.io error:', error);
    });

    return socket;
};

// Simple hash function for detecting message changes
const getMessagesHash = (messages) => {
    if (!messages || messages.length === 0) return '';
    const ids = messages.map(m => m.id).join(',');
    // Simple hash: just concatenate IDs
    return ids;
};

// Render messages from cache WITHOUT fetching from API (used after sending message)
const renderMessagesFromCache = () => {
    const chatThread = document.getElementById('chat-thread');
    const conversation = messagingState.conversations.find(c => c.id === messagingState.activeConversationId);
    
    if (!conversation || !chatThread) return;
    
    const cachedMessages = messagingState.cachedMessages[messagingState.activeConversationId] || [];
    
    const fragments = [];
    let currentDate = null;
    const userContext = getMessagingUserContext();
    const currentUserIsInstitution = userContext.is_admin || userContext.role === 'universite' || userContext.role === 'centre_formation';

    cachedMessages.forEach((msg) => {
        const msgDate = new Date(msg.created_at);
        const displayDate = msgDate.toLocaleDateString('fr-FR', { 
            weekday: 'long', 
            day: '2-digit', 
            month: 'long',
            year: 'numeric'
        });

        const msgDateOnly = new Date(msgDate.getFullYear(), msgDate.getMonth(), msgDate.getDate());

        if (!currentDate || msgDateOnly.getTime() !== currentDate.getTime()) {
            currentDate = msgDateOnly;
            fragments.push(`
                <div class="date-divider" data-date="${displayDate.charAt(0).toUpperCase() + displayDate.slice(1)}"></div>
            `);
        }

        // Determine message side by current user role and sender type.
        // For institution users, institution messages are their own and appear on RIGHT.
        // For students/users, non-institution messages are their own and appear on RIGHT.
        const currentUserMessage = isMessageFromCurrentUser(msg);
        const senderType = String(msg.sender_type || '').toLowerCase().trim();
        const messageIsInstitution = ['admin', 'universite', 'centre_formation'].includes(senderType);
        const shouldRenderRight = currentUserMessage ||
            (currentUserIsInstitution && messageIsInstitution) ||
            (!currentUserIsInstitution && !messageIsInstitution);
        console.log(`[renderMessagesFromCache] sender_type="${senderType}" sender_id="${msg.sender_id}" currentUserMessage=${currentUserMessage} currentUserIsInstitution=${currentUserIsInstitution} messageIsInstitution=${messageIsInstitution} → side="${shouldRenderRight ? 'right' : 'left'}"`);
        
        if (!shouldRenderRight) {
            // Institution message: LEFT side (gray)
            fragments.push(`
            <div class="message-row outgoing" style="display: flex; justify-content: flex-start;">
                <div class="message-avatar" style="background: #f1f5f9; color: #0f172a; border: 1px solid #e2e8f0;">🏛️</div>
                <div class="message-bubble">
                    <div class="message-text">${escapeHtml(msg.text)}</div>
                    ${msg.file_name ? `<div class="message-file">📎 ${escapeHtml(msg.file_name)}</div>` : ''}
                    <div class="message-meta">${formatDateTime(msg.created_at)}</div>
                </div>
            </div>
            `);
        } else {
            // User/student message: RIGHT side (blue)
            const initials = conversation.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
            fragments.push(`
            <div class="message-row incoming" style="display: flex; justify-content: flex-end;">
                <div class="message-bubble">
                    <div class="message-text">${escapeHtml(msg.text)}</div>
                    ${msg.file_name ? `<div class="message-file">📎 ${escapeHtml(msg.file_name)}</div>` : ''}
                    <div class="message-meta">${formatDateTime(msg.created_at)}</div>
                </div>
                <div class="message-avatar" style="background: #7c3aed; color: white;">${escapeHtml(initials)}</div>
            </div>
            `);
        }
    });

    chatThread.innerHTML = fragments.join('');
    chatThread.scrollTop = chatThread.scrollHeight;
};

const formatConversationTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'À l\'instant';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}j`;
    
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
};

const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
};

// UI Rendering functions
async function renderConversationList() {
    const conversationList = document.getElementById('conversation-list');
    const conversationSearch = document.getElementById('conversation-search');
    
    if (!conversationList) return;

    const search = conversationSearch?.value?.toLowerCase() || '';
    const filtered = messagingState.conversations.filter(conv => {
        if (!search) return true;
        return conv.name.toLowerCase().includes(search) || 
               (conv.description && conv.description.toLowerCase().includes(search));
    });

    conversationList.innerHTML = '';

    if (filtered.length === 0) {
        conversationList.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #94a3b8;">
                <i class="fa-regular fa-inbox" style="font-size: 28px; margin-bottom: 10px; display: block; color: #cbd5e1;"></i>
                <div style="font-size: 13px;">Aucune conversation trouvée</div>
            </div>
        `;
        return;
    }

    for (const conv of filtered) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = `conversation-item ${conv.id === messagingState.activeConversationId ? 'active' : ''}`;
        
        const previewText = conv.description || 'Aucun message';
        const avatarLetters = conv.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
        
        item.innerHTML = `
            <div class="conversation-avatar online">
                ${escapeHtml(avatarLetters)}
            </div>
            <div class="conversation-content">
                <div class="conversation-top">
                    <div class="conversation-name">${escapeHtml(conv.name)}</div>
                    <div class="conversation-time">${formatConversationTime(conv.updated_at)}</div>
                </div>
                <div class="conversation-preview">
                    ${escapeHtml(previewText)}
                </div>
            </div>
        `;

        item.addEventListener('click', async () => {
            clearMessagingEmptyState();
            messagingState.activeConversationId = conv.id;
            
            // Join conversation room via Socket.io
            if (messagingState.socket && messagingState.socket.connected) {
                messagingState.socket.emit('join_conversation', conv.id);
            }
            
            await renderActiveConversation();
            await messagingAPI.markAsRead(conv.id);
            await renderConversationList();
        });

        conversationList.appendChild(item);
    }
}

async function renderActiveConversation() {
    const chatThread = document.getElementById('chat-thread');
    const chatEmpty = document.getElementById('chat-empty');
    const chatAvatar = document.getElementById('chat-avatar');
    const chatName = document.getElementById('chat-name');
    const chatStatus = document.getElementById('chat-status');
    const messageInput = document.getElementById('message-input');
    const sendMessageButton = document.getElementById('send-message');

    if (!messagingState.activeConversationId) {
        if (chatEmpty) chatEmpty.style.display = 'flex';
        if (chatName) chatName.textContent = 'Sélectionnez une conversation';
        if (chatStatus) chatStatus.textContent = 'Aucune conversation ouverte';
        messageInput.disabled = true;
        sendMessageButton.disabled = true;
        return;
    }

    const conversation = messagingState.conversations.find(c => c.id === messagingState.activeConversationId);
    if (!conversation) return;

    if (chatEmpty) chatEmpty.style.display = 'none';
    if (chatName) chatName.textContent = conversation.name;
    if (chatStatus) chatStatus.textContent = '🟢 En ligne';
    if (chatAvatar) {
        const avatarLetters = conversation.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
        chatAvatar.textContent = avatarLetters;
        chatAvatar.classList.add('online');
    }
    messageInput.disabled = false;
    sendMessageButton.disabled = false;

    // Fetch messages for this conversation
    const messages = await messagingAPI.getConversationMessages(messagingState.activeConversationId);
    
    // Cache the messages
    messagingState.cachedMessages[messagingState.activeConversationId] = messages;
    
    // Check if messages have changed
    const currentHash = getMessagesHash(messages);
    const previousHash = messagingState.lastMessageHash[messagingState.activeConversationId] || '';
    
    // If hash hasn't changed, don't re-render to prevent flickering
    if (currentHash === previousHash && chatThread && chatThread.innerHTML) {
        return;
    }
    
    // Update hash
    messagingState.lastMessageHash[messagingState.activeConversationId] = currentHash;

    const fragments = [];
    let currentDate = null;
    const userContext = getMessagingUserContext();
    const currentUserIsInstitution = userContext.is_admin || userContext.role === 'universite' || userContext.role === 'centre_formation';

    messages.forEach((msg) => {
        const msgDate = new Date(msg.created_at);
        const displayDate = msgDate.toLocaleDateString('fr-FR', { 
            weekday: 'long', 
            day: '2-digit', 
            month: 'long',
            year: 'numeric'
        });

        const msgDateOnly = new Date(msgDate.getFullYear(), msgDate.getMonth(), msgDate.getDate());

        if (!currentDate || msgDateOnly.getTime() !== currentDate.getTime()) {
            currentDate = msgDateOnly;
            fragments.push(`
                <div class="date-divider" data-date="${displayDate.charAt(0).toUpperCase() + displayDate.slice(1)}"></div>
            `);
        }

        // Determine message side by current user role and sender type.
        // For institution users, institution messages are their own and appear on RIGHT.
        // For students/users, non-institution messages are their own and appear on RIGHT.
        const currentUserMessage = isMessageFromCurrentUser(msg);
        const senderType = String(msg.sender_type || '').toLowerCase().trim();
        const messageIsInstitution = ['admin', 'universite', 'centre_formation'].includes(senderType);
        const shouldRenderRight = currentUserMessage ||
            (currentUserIsInstitution && messageIsInstitution) ||
            (!currentUserIsInstitution && !messageIsInstitution);
        console.log(`[renderActiveConversation] sender_type="${senderType}" sender_id="${msg.sender_id}" currentUserMessage=${currentUserMessage} currentUserIsInstitution=${currentUserIsInstitution} messageIsInstitution=${messageIsInstitution} → side="${shouldRenderRight ? 'right' : 'left'}"`);
        
        if (!shouldRenderRight) {
            // Institution message: LEFT side (gray)
            fragments.push(`
            <div class="message-row outgoing" style="display: flex; justify-content: flex-start;">
                <div class="message-avatar" style="background: #f1f5f9; color: #0f172a; border: 1px solid #e2e8f0;">🏛️</div>
                <div class="message-bubble">
                    <div class="message-text">${escapeHtml(msg.text)}</div>
                    ${msg.file_name ? `<div class="message-file">📎 ${escapeHtml(msg.file_name)}</div>` : ''}
                    <div class="message-meta">${formatDateTime(msg.created_at)}</div>
                </div>
            </div>
            `);
        } else {
            // User/student message: RIGHT side (blue)
            const initials = conversation.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
            fragments.push(`
            <div class="message-row incoming" style="display: flex; justify-content: flex-end;">
                <div class="message-bubble">
                    <div class="message-text">${escapeHtml(msg.text)}</div>
                    ${msg.file_name ? `<div class="message-file">📎 ${escapeHtml(msg.file_name)}</div>` : ''}
                    <div class="message-meta">${formatDateTime(msg.created_at)}</div>
                </div>
                <div class="message-avatar" style="background: #7c3aed; color: white;">${escapeHtml(initials)}</div>
            </div>
            `);
        }
    });

    if (chatThread) {
        chatThread.innerHTML = fragments.join('');
        chatThread.scrollTop = chatThread.scrollHeight;
    }
}

async function sendMessage() {
    console.log('🔘 Send button clicked!');
    
    const messageInput = document.getElementById('message-input');
    const text = messageInput?.value?.trim();
    const activeConversation = messagingState.conversations.find(
        (conversation) => conversation.id === messagingState.activeConversationId
    );

    console.log('📝 Message input text:', text);
    console.log('💬 Active conversation ID:', messagingState.activeConversationId);
    console.log('📊 Messaging state:', messagingState);

    if (!messagingState.activeConversationId) {
        console.error('❌ No conversation selected!');
        alert('Veuillez sélectionner une conversation d\'abord');
        return;
    }
    
    if (!activeConversation) {
        console.error('Active conversation is no longer accessible');
        messagingState.activeConversationId = null;
        setMessagingEmptyState(
            'Conversation indisponible',
            'Cette conversation n\'est plus accessible. Rechargez la page puis reessayez.'
        );
        alert('Cette conversation n\'est plus disponible.');
        return;
    }

    if (!text) {
        console.warn('⚠️ Message text is empty');
        return;
    }

    console.log('✅ Conditions met, sending message...');
    
    messagingState.isLoading = true;
    
    console.log('📤 Sending message to conversation:', messagingState.activeConversationId);
    
    const message = await messagingAPI.sendMessage(
        messagingState.activeConversationId,
        text,
        messagingState.selectedFile?.name,
        null // File URL would be set after upload
    );

    if (message) {
        console.log('✅ Message sent successfully:', message);
        console.log('📊 Message sender_type:', message.sender_type);
        messageInput.value = '';
        messageInput.style.height = 'auto';
        messagingState.selectedFile = null;
        
        const attachmentPreview = document.getElementById('attachment-preview');
        if (attachmentPreview) attachmentPreview.classList.remove('show');
        
        // Determine sender_type from user context if not provided by backend
        if (!message.sender_type) {
            const userContext = getMessagingUserContext();
            // Institutions (admin, universite, centre_formation) send as 'admin' in UI
            // Regular users send as their role
            const senderType = (userContext.is_admin || userContext.role === 'universite' || userContext.role === 'centre_formation') 
                ? 'admin' 
                : userContext.role || 'user';
            message.sender_type = senderType;
            console.log('⚠️ Fixed missing sender_type based on user role:', senderType);
        }
        
        // Update cache with new message immediately to appear in UI without delay
        if (!messagingState.cachedMessages[messagingState.activeConversationId]) {
            messagingState.cachedMessages[messagingState.activeConversationId] = [];
        }
        messagingState.cachedMessages[messagingState.activeConversationId].push(message);
        
        // Reset hash to mark cache as changed
        messagingState.lastMessageHash[messagingState.activeConversationId] = null;
        
        // Render from cache IMMEDIATELY without fetching from API
        // This ensures the message appears instantly in the UI
        renderMessagesFromCache();
        
        // Emit message via Socket.io to notify other clients instantly
        if (messagingState.socket && messagingState.socket.connected) {
            console.log('📡 Emitting message_sent event via Socket.io');
            messagingState.socket.emit('message_sent', {
                conversationId: messagingState.activeConversationId,
                messageId: message.id,
                sender_id: message.sender_id,
                text: message.text,
                created_at: message.created_at,
            });
        }
        
        // Refresh conversation list state
        await renderConversationList();
    } else {
        console.error('❌ Failed to send message - check console for details');
        alert('Erreur: Impossible d\'envoyer le message. Vérifiez la console pour les détails.');
    }
    
    messagingState.isLoading = false;
}

// Initialize on load
async function initializeMessaging() {
    const conversationList = document.getElementById('conversation-list');

    // Check if JWT token is available
    const token = getJWTToken();
    if (!token) {
        console.warn('⚠️ JWT token not found. User must be logged in to use messaging.');
        
        // Show login prompt
        const chatEmpty = document.getElementById('chat-empty');
        
        if (chatEmpty) {
            chatEmpty.innerHTML = `
                <div class="login-prompt" style="text-align: center; padding: 40px 20px;">
                    <h3 style="color: #64748b; margin-bottom: 10px;">Connexion requise</h3>
                    <p style="color: #94a3b8; margin-bottom: 20px;">Vous devez être connecté pour accéder à la messagerie.</p>
                    <button onclick="window.location.href='./login.html'" 
                            style="background: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
                        Se connecter
                    </button>
                </div>
            `;
            chatEmpty.style.display = 'flex';
        }
        
        if (conversationList) {
            conversationList.innerHTML = '';
        }
        
        return; // Exit initialization if no token
    }

    // Initialize Socket.io connection
    messagingState.socket = initializeSocket();

    const conversationSearch = document.getElementById('conversation-search');
    const messageInput = document.getElementById('message-input');
    const sendMessageButton = document.getElementById('send-message');
    const attachFileBtn = document.getElementById('attach-file-btn');
    const fileInput = document.getElementById('file-input');
    const attachmentPreview = document.getElementById('attachment-preview');
    const attachmentName = document.getElementById('attachment-name');
    const removeAttachmentBtn = document.getElementById('remove-attachment');
    const emojiBtn = document.getElementById('emoji-btn');
    const emojiPicker = document.getElementById('emoji-picker');
    const emojiBtns = document.querySelectorAll('.emoji-btn');

    console.log('🔍 DOM Elements found:');
    console.log('  - messageInput:', messageInput?.tagName, messageInput?.id);
    console.log('  - sendMessageButton:', sendMessageButton?.tagName, sendMessageButton?.id);
    console.log('  - sendMessageButton exists:', !!sendMessageButton);

    const userContext = getMessagingUserContext();

    // Validate institution context in JWT
    if (!userContext.institution_id) {
        // User doesn't have institution context in JWT - use demo mode
        console.log('📋 Institution ID not in JWT - enabling demo mode for basic messaging');
        userContext.institution_id = 'demo-mode';
    }
    
    validateUserHasInstitutionContext(userContext);

    // Load conversations
    messagingState.conversations = await messagingAPI.getConversations();
    
    // If no conversations exist, create a default one (for testing)
    if (messagingState.conversations.length === 0) {
        if (!userContext.institution_id || userContext.institution_id === null) {
            console.warn('Messaging unavailable: no institution context available for this user');
            if (conversationList) {
                conversationList.innerHTML = `
                    <div style="padding: 20px; text-align: center; color: #94a3b8;">
                        <i class="fa-regular fa-inbox" style="font-size: 28px; margin-bottom: 10px; display: block; color: #cbd5e1;"></i>
                        <div style="font-size: 13px;">Aucune conversation disponible</div>
                    </div>
                `;
            }
            setMessagingEmptyState(
                'Aucune conversation disponible',
                userContext.is_admin
                    ? 'Creez ou attribuez une conversation depuis l espace admin.'
                    : 'Votre compte ne contient pas encore de contexte institutionnel pour la messagerie.'
            );
        } else {
        console.log('📝 No conversations found, creating default conversation...');
        const defaultConv = await messagingAPI.createConversation(
            'Support Universearch',
            'Conversation de support et d\'assistance'
        );
        
        if (defaultConv) {
            console.log('✅ Default conversation created');
            messagingState.conversations = [defaultConv];
        } else {
            console.error('❌ Failed to create default conversation');
        }
    }
    }
    
    if (messagingState.conversations.length === 0 && !messagingState.emptyState) {
        setMessagingEmptyState(
            'Aucune conversation disponible',
            'La messagerie n\'a pas encore de conversation active pour ce compte.'
        );
    }

    await renderConversationList();
    
    // Auto-select first conversation if available
    if (messagingState.conversations.length > 0 && !messagingState.activeConversationId) {
        clearMessagingEmptyState();
        messagingState.activeConversationId = messagingState.conversations[0].id;
        
        // Join conversation room via Socket.io
        if (messagingState.socket) {
            messagingState.socket.emit('join_conversation', messagingState.activeConversationId);
        }
        
        await renderActiveConversation();
    }

    // Event listeners
    conversationSearch?.addEventListener('input', renderConversationList);
    
    if (sendMessageButton) {
        console.log('✅ Attaching click listener to send button');
        sendMessageButton.addEventListener('click', () => {
            console.log('🔘 Send button click detected!');
            sendMessage();
        });
    } else {
        console.error('❌ Send message button not found! Make sure the button has id="send-message"');
    }
    messageInput?.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            sendMessage();
            e.preventDefault();
        }
    });

    // Auto-expand textarea
    messageInput?.addEventListener('input', (e) => {
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
    });

    // File attachment
    attachFileBtn?.addEventListener('click', () => {
        fileInput?.click();
    });

    fileInput?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) {
            messagingState.selectedFile = file;
            attachmentName.textContent = file.name;
            attachmentPreview.classList.add('show');
        }
    });

    removeAttachmentBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        messagingState.selectedFile = null;
        fileInput.value = '';
        attachmentPreview.classList.remove('show');
    });

    // Emoji picker
    emojiBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        emojiPicker?.classList.toggle('active');
    });

    emojiBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const emoji = btn.textContent;
            const cursorPos = messageInput.selectionStart;
            const textBefore = messageInput.value.substring(0, cursorPos);
            const textAfter = messageInput.value.substring(cursorPos);
            messageInput.value = textBefore + emoji + textAfter;
            messageInput.selectionStart = messageInput.selectionEnd = cursorPos + emoji.length;
            messageInput.focus();
            messageInput.dispatchEvent(new Event('input'));
            emojiPicker?.classList.remove('active');
        });
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#emoji-btn') && !e.target.closest('#emoji-picker')) {
            emojiPicker?.classList.remove('active');
        }
    });

    // Poll for conversation list updates (less frequently now that messages use Socket.io)
    setInterval(async () => {
        // Only poll if user is logged in (has JWT token)
        if (!getJWTToken()) {
            return;
        }
        
        const newConversations = await messagingAPI.getConversations();
        
        // Simple hash to detect changes: use conversation IDs
        const newHash = newConversations.map(c => c.id).join(',');
        const oldHash = messagingState.conversations.map(c => c.id).join(',');
        
        // Only update if conversations changed
        if (newHash !== oldHash) {
            messagingState.conversations = newConversations;
            
            if (
                messagingState.activeConversationId &&
                !messagingState.conversations.some((conversation) => conversation.id === messagingState.activeConversationId)
            ) {
                messagingState.activeConversationId = null;
                setMessagingEmptyState(
                    'Conversation indisponible',
                    'La conversation ouverte n\'est plus accessible avec votre compte.'
                );
            }

            await renderConversationList();
        }
    }, 10000); // Poll every 10 seconds (reduced from 5 since Socket.io handles most updates)
}

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', initializeMessaging);
