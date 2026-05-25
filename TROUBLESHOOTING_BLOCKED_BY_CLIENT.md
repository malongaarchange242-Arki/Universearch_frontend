# 🔧 Dépannage: ERR_BLOCKED_BY_CLIENT

## 🚫 Problème

Votre navigateur bloque les appels vers `https://universearch-proa-service-weza.onrender.com/health` avec l'erreur:
```
net::ERR_BLOCKED_BY_CLIENT
```

## 🔍 Causes Possibles

### 1. **Bloqueur de Publicités** (Cause la plus fréquente)
- **uBlock Origin**, **AdBlock**, **AdBlock Plus**
- **Bloqueurs intégrés** (Brave, Opera GX)
- Ces extensions bloquent souvent `render.com` car considéré comme "hébergement gratuit"

### 2. **Extensions de Sécurité**
- **NoScript**, **ScriptSafe**, **uMatrix**
- **HTTPS Everywhere** (parfois trop strict)
- **Privacy Badger**

### 3. **Politique d'Entreprise**
- Firewall d'entreprise bloquant render.com
- Proxy filtrant les requêtes
- Réseau d'entreprise avec restrictions

### 4. **Cache/Corruption**
- Cache navigateur corrompu
- Cookies problématiques
- Service Workers conflictuels

## ✅ Solutions

### Solution 1: Désactiver Bloqueurs de Pubs (Recommandé)
1. **Chrome/Edge**: Clic droit sur l'icône extension → "Gérer les extensions"
2. **Firefox**: Menu → Add-ons → Extensions
3. **Désactivez temporairement** uBlock/AdBlock pour `render.com`
4. **Actualisez la page** (Ctrl+F5)

### Solution 2: Navigation Privée
1. **Ctrl+Shift+N** (Chrome/Firefox/Edge)
2. **Testez dans cette fenêtre** - les extensions sont désactivées
3. Si ça marche, le problème vient des extensions

### Solution 3: Vider Cache Navigateur
1. **Ctrl+Shift+Suppr** (Chrome/Firefox)
2. **Cochez**: Cache, Cookies, Données de sites
3. **Dernière heure** ou **24h**
4. **Actualisez** la page

### Solution 4: Extensions de Sécurité
1. **Désactivez temporairement** NoScript/HTTPS Everywhere
2. **Testez** l'accès
3. **Réactivez** après test

### Solution 5: Réseau d'Entreprise
- **Contactez votre administrateur IT**
- Demandez l'autorisation pour `render.com`
- Ou utilisez une connexion personnelle (4G/téléphone)

## 🧪 Test Rapide

Ouvrez la **Console développeur** (F12) et exécutez:
```javascript
fetch('https://universearch-proa-service-weza.onrender.com/health')
  .then(r => r.json())
  .then(d => console.log('✅ API accessible:', d))
  .catch(e => console.log('❌ Erreur:', e.message));
```

Si ça affiche `✅ API accessible: {status: "ok"}`, l'API fonctionne.

## 📱 Interface Utilisateur

Le frontend affiche maintenant:
- **Toast explicatif** avec instructions détaillées
- **Message système** avec boutons d'action
- **Bouton "Réessayer"** pour tester la connexion
- **Logs détaillés** dans la console (F12)

## 🔧 Code Technique

Le code gère maintenant:
```javascript
// Détection spécifique des blocages
if (error.message.includes('ERR_BLOCKED_BY_CLIENT')) {
    // Afficher instructions utilisateur
}

// Timeout de 10 secondes
const controller = new AbortController();
setTimeout(() => controller.abort(), 10000);

// Headers appropriés
headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
}
```

## 🚀 Statut des Services

**✅ CONFIRMÉ**: Tous les services fonctionnent correctement:
- `https://universearch-proa-service-weza.onrender.com/health` → `{"status":"ok"}`
- `https://universearch-pora-service.onrender.com` → OK
- `https://universearch-9qle.onrender.com` → OK

**Le problème est exclusivement côté client/navigateur.**

---

## 🎯 Prochaines Étapes

1. **Testez les solutions** ci-dessus
2. **Contactez-moi** si le problème persiste
3. **Fournissez les logs** de la console (F12 → Console)

Le système est **opérationnel** - il s'agit juste d'un problème de configuration navigateur ! 🚀</content>
<parameter name="filePath">d:\UNIVERSEARCH BACKEND\Frontend\TROUBLESHOOTING_BLOCKED_BY_CLIENT.md