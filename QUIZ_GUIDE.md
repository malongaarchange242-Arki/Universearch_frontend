# 🎓 Système Quiz d'Orientation - Guide d'utilisation

## 📋 Vue d'ensemble

Le système est composé de deux pages:
1. **`login-quiz.html`** - Page d'authentification
2. **`Quiz.html`** - Page du quiz d'orientation

## 🔐 Authentification

### Flux d'authentification:

```
1. Utilisateur ouvre login-quiz.html
   ↓
2. Saisit son ID utilisateur
   ↓
3. Système vérifie dans la table Supabase `users`
   ↓
4. Si utilisateur existe:
   - Stocke les données en sessionStorage
   - Redirige vers Quiz.html
   ↓
5. Si utilisateur inexistant:
   - Affiche une erreur
```

### Page de connexion (login-quiz.html)

- 📝 **Champ**: Identifiant utilisateur (UUID)
- 🔍 **Vérification**: Requête API REST Supabase
- 💾 **Stockage session**:
  - `userId` → UUID de l'utilisateur
  - `userName` → Nom affiché
  - `userRole` → Rôle (student/parent)

## 🎮 Page Quiz

### Flux du Quiz:

```
Quiz.html charge
   ↓
Récupère userId depuis sessionStorage
   ↓
Si userId existe:
  - Charge les questions depuis Supabase
  - Affiche le menu (Mode Bachelier/Parent)
   ↓
Si userId N'existe PAS:
  - Affiche message d'erreur
  - Redirige vers login-quiz.html
```

## 📊 Données Supabase

### Table `users`
```json
{
  "id": "uuid",
  "name": "string",
  "email": "string",
  "role": "string (student|parent)"
}
```

Exemple:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Jean Dupont",
  "email": "jean@example.com",
  "role": "student"
}
```

### Table `orientation_quiz_questions`
Contient toutes les questions organisées par quiz_id

## 🔗 Architecture

```
Frontend
├── login-quiz.html (Authentification)
│   ├── Fetch API REST Supabase
│   ├── Vérification utilisateur
│   └── SessionStorage
│
└── Quiz.html (Quiz)
    ├── Récupère userId de sessionStorage
    ├── Fetch questions depuis Supabase
    ├── Envoie réponses à PROA (localhost:8000)
    └── Récupère recommandations du PORA (localhost:8080)

Services
├── PROA (port 8000) - Orientation Service
└── PORA (port 8080) - Ranking Service
```

## 🚀 Déploiement

### 1. Structures Supabase requises:

**Table `users`:**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  name TEXT,
  email TEXT,
  role TEXT DEFAULT 'student',
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Table `orientation_quiz_questions`:**
```sql
CREATE TABLE orientation_quiz_questions (
  id UUID PRIMARY KEY,
  quiz_id UUID,
  question_code TEXT,
  question_text TEXT,
  question_type TEXT,
  order_index INTEGER,
  is_required BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 2. Politique RLS (Row Level Security):

Permettre les lectures publiques des tables:
```sql
CREATE POLICY "Enable read access for all users" 
ON users 
FOR SELECT 
USING (true);

CREATE POLICY "Enable read access for all users" 
ON orientation_quiz_questions 
FOR SELECT 
USING (true);
```

## 📱 Utilisation

### Pour démarrer:

1. **Démarrer PROA**:
   ```bash
   cd services/proa-service
   python -m uvicorn main:app --host 0.0.0.0 --port 8000
   ```

2. **Démarrer PORA**:
   ```bash
   cd services/pora-service
   go run main.go
   ```

3. **Ouvrir le Quiz**:
   - Accéder à `http://localhost:8000/Frontend/login-quiz.html`
   - Ou ouvrir directement `login-quiz.html` en local
   - Saisir un ID utilisateur valide
   - Cliquer "Accéder au Quiz"

## 🔑 Variables d'environnement

### Dans Quiz.html et login-quiz.html:

```javascript
const SUPABASE_URL = 'https://wsdkieldyvehoqtukyis.supabase.co';
const SUPABASE_ANON_KEY = '...'; // Clé anon de Supabase
const PROA_SERVICE_URL = 'http://localhost:8000';
const PORA_SERVICE_URL = 'http://localhost:8080';
```

## 🛠️ Dépannage

### Erreur 401 (Unauthorized):
- **Cause**: Clé API invalide ou insuffisante
- **Solution**: Utiliser la clé **anon** (et non service_role)

### Utilisateur non trouvé:
- **Cause**: L'ID saisi n'existe pas dans la table `users`
- **Solution**: Vérifier la table dans Supabase et ajouter l'utilisateur

### Questions ne chargent pas:
- **Cause**: Politique RLS empêche la lecture
- **Solution**: Vérifier les permissions de lecture sur `orientation_quiz_questions`

### PROA/PORA ne répondent pas:
- **Cause**: Services non lancés
- **Solution**: Démarrer les services avant d'accéder au quiz

## 📝 Logs console

Ouvrir DevTools (F12) pour voir:

```
✅ Utilisateur authentifié: Jean Dupont
📡 Chargement des questions depuis Supabase...
✅ Questions reçues: 30
✅ Données quiz chargées: {student: 10, parent: 5}
📝 Réponse enregistrée: Q1 = 4
📤 Payload envoyé à PROA: {...}
✅ PROA réponse: {...}
✅ Recommandations obtenues: {...}
```

## 🎯 Cas d'usage

### Étudiant (student):
1. Ouvre login-quiz.html
2. Saisit son ID
3. Accède au Quiz mode étudiant
4. Répond aux 10 questions
5. Reçoit son profil d'orientation
6. Voit les recommandations d'universités/centres

### Parent (parent):
1. Ouvre login-quiz.html
2. Saisit son ID (role: parent)
3. Accède au Quiz mode parent
4. Répond aux 5 questions stratégiques
5. Reçoit des conseils adaptés

