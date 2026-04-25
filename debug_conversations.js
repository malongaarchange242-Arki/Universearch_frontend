/**
 * Debug script to inspect conversation structure
 * Run this in browser console while on messagerie_admin.html
 */

async function debugConversations() {
    const MESSAGING_SERVICE_URL = localStorage.getItem('messaging_service_url') || 'https://universearch-messaging.onrender.com';
    const API_BASE = 'https://universearch-9qle.onrender.com';
    
    // Get JWT token
    const getToken = () => {
        try {
            const session = JSON.parse(localStorage.getItem('softura_session') || '{}');
            return session.jwt_token || localStorage.getItem('jwt_token') || localStorage.getItem('softura_token') || '';
        } catch (e) {
            return '';
        }
    };
    
    const token = getToken();
    if (!token) {
        console.error('❌ No JWT token found');
        return;
    }
    
    console.log('📋 Fetching conversations...');
    try {
        const response = await fetch(
            `${MESSAGING_SERVICE_URL}/conversations?limit=100&offset=0`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                }
            }
        );
        
        if (!response.ok) {
            console.error('❌ API Error:', response.status, response.statusText);
            return;
        }
        
        const result = await response.json();
        const conversations = result.data || [];
        
        console.log(`✅ Found ${conversations.length} conversations\n`);
        
        if (conversations.length === 0) {
            console.warn('⚠️ No conversations found');
            return;
        }
        
        // Show first conversation structure
        console.log('📦 First Conversation Structure:');
        console.table(conversations[0]);
        
        // Show all conversation keys
        console.log('\n🔑 Available Keys in Each Conversation:');
        console.log(Object.keys(conversations[0]));
        
        // Get all universities
        console.log('\n🏫 Fetching universities...');
        const univResponse = await fetch(`${API_BASE}/universites`);
        const universities = await univResponse.json();
        console.log(`Found ${universities.length} universities`);
        
        if (universities.length > 0) {
            console.log('First university:', universities[0]);
        }
        
        // Try to match conversations with institutions
        console.log('\n🔍 Analyzing conversation-institution relationship:');
        conversations.forEach((conv, idx) => {
            console.log(`\nConversation ${idx + 1}:`);
            console.log(`  - ID: ${conv.id}`);
            console.log(`  - Name: ${conv.name || 'N/A'}`);
            console.log(`  - Created by: ${conv.created_by || 'N/A'}`);
            console.log(`  - Related ID: ${conv.related_entity_id || 'N/A'}`);
            console.log(`  - University ID: ${conv.universite_id || 'N/A'}`);
            console.log(`  - Institution ID: ${conv.institution_id || 'N/A'}`);
            console.log(`  - User ID: ${conv.user_id || 'N/A'}`);
            console.log(`  - All keys:`, Object.keys(conv).join(', '));
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
    }
}

// Run the debug
debugConversations();
