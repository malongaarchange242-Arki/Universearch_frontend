# Page d'Orientation PROA & PORA

Une interface moderne et professionnelle pour l'orientation étudiante utilisant les microservices PROA (Profile-Oriented Recommendation Algorithm) et PORA (Profile-Oriented Recommendation Aggregation).

## 🎯 Vue d'ensemble

Cette page combine deux puissants systèmes d'orientation :

- **PROA** : Analyse les préférences de l'utilisateur via un questionnaire de 12 questions
- **PORA** : Fournit un classement personnalisé des universités basé sur l'agrégation de signaux réels

## ✨ Fonctionnalités

### 📝 Questionnaire d'Orientation
- 12 questions équilibrées couvrant 4 catégories :
  - Logique (Résolution de problèmes, analyse)
  - Technique (Technologies, mécanique)
  - Créativité (Arts, innovation)
  - Social (Relations humaines, aide)
- Échelle de 1 à 5 pour chaque question
- Validation en temps réel

### 📊 Analyse de Profil
- Visualisation graphique des intérêts
- Identification des forces principales
- Calcul de la confiance du profil

### 🏆 Recommandations Personnalisées
- Classement des universités adapté au profil
- Combinaison des préférences utilisateur (40%) et données réelles (60%)
- Affichage des scores et métriques

## 🚀 Utilisation

### Prérequis
- Services PROA et PORA en cours d'exécution :
  - PROA : `http://localhost:8000`
  - PORA : `http://localhost:8080`

### Démarrage
1. Ouvrir `orientation.html` dans un navigateur
2. Saisir un identifiant utilisateur
3. Répondre aux 12 questions du questionnaire
4. Cliquer sur "Analyser mes résultats"
5. Consulter le profil généré
6. Obtenir les recommandations PORA

## 🎨 Design

### Interface Moderne
- Design responsive avec Tailwind CSS
- Animations fluides et transitions
- Indicateur de progression en 3 étapes
- Palette de couleurs professionnelle

### UX Optimisée
- Validation en temps réel des réponses
- Feedback visuel immédiat
- Messages d'erreur informatifs
- Navigation intuitive

## 🔧 Architecture Technique

### Flux Utilisateur
```
1. Quiz PROA → 2. Analyse Profil → 3. Ranking PORA
```

### APIs Utilisées
- `POST /orientation/compute` (PROA) : Calcul du profil
- `GET /ranking/universites?user_id=XXX` (PORA) : Recommandations

### Données
- **Input** : Réponses du questionnaire (1-5 par question)
- **Output PROA** : Vecteur de profil + confiance
- **Output PORA** : Liste classée d'universités avec scores

## 📱 Responsive Design

- **Desktop** : Interface complète avec graphiques détaillés
- **Mobile** : Adaptation optimisée pour petits écrans
- **Tablette** : Layout intermédiaire équilibré

## 🎭 Personnalisation

### Questions du Quiz
Modifiables dans `orientation.js` dans la variable `quizQuestions`.

### Thème Visuel
- Couleurs modifiables via Tailwind config
- Icônes FontAwesome interchangeables
- Animations CSS personnalisables

## 🔍 Debugging

### Console Logs
- Soumission du quiz
- Réponse PROA
- Recommandations PORA
- Erreurs API

### Validation
- Vérification des réponses complètes
- Validation des identifiants utilisateur
- Gestion des erreurs réseau

## 🌟 Points Forts

- **Intelligence** : Algorithmes avancés de recommandation
- **Performance** : Interface fluide et réactive
- **Accessibilité** : Design inclusif et intuitif
- **Évolutivité** : Architecture modulaire et maintenable

---

*Powered by PROA & PORA - Système d'orientation intelligent pour l'éducation supérieure*