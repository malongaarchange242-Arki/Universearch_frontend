# Test de la page d'orientation PROA & PORA

Ce fichier contient des instructions pour tester la page d'orientation nouvellement créée.

## Prérequis

1. **Services en cours d'exécution :**
   - PROA Service (port 8000)
   - PORA Service (port 8080)

2. **Navigateur web moderne** avec JavaScript activé

## Instructions de test

### 1. Ouvrir la page
- Ouvrez `orientation.html` dans votre navigateur
- Vérifiez que la page se charge correctement avec le design moderne

### 2. Test du quiz
- Cliquez sur "Commencer l'orientation"
- Répondez aux 12 questions du quiz
- Vérifiez que la barre de progression se met à jour
- Testez la validation (toutes les questions doivent être répondues)

### 3. Test de l'analyse PROA
- Après avoir terminé le quiz, cliquez sur "Analyser mon profil"
- Vérifiez que l'appel API vers PROA fonctionne (port 8000)
- Observez l'affichage du profil avec le graphique en barres

### 4. Test des recommandations PORA
- Après l'analyse, cliquez sur "Obtenir mes recommandations"
- Vérifiez que l'appel API vers PORA fonctionne (port 8080)
- Observez l'affichage des universités recommandées avec les scores

### 5. Test des fonctionnalités UI
- Testez la navigation entre les sections
- Vérifiez les animations et transitions
- Testez la responsivité sur différentes tailles d'écran
- Vérifiez les messages d'erreur en cas de problème API

## Données de test

### Profil PROA exemple :
```json
{
  "profile": {
    "logic": 8.5,
    "technical": 7.2,
    "creativity": 6.8,
    "social": 9.1
  },
  "strengths": ["Logique", "Social"],
  "recommendations": ["Informatique", "Commerce", "Communication"]
}
```

### Réponses PORA exemple :
```json
[
  {
    "university": "Université de Technologie",
    "score": 95,
    "reason": "Excellent match pour vos compétences techniques et logiques"
  },
  {
    "university": "Université des Sciences Humaines",
    "score": 88,
    "reason": "Bon alignement avec vos compétences sociales"
  }
]
```

## Dépannage

### Erreur de connexion API
- Vérifiez que les services PROA et PORA sont démarrés
- Vérifiez les ports (8000 pour PROA, 8080 pour PORA)
- Consultez les logs des services pour les erreurs

### Problèmes d'affichage
- Vérifiez que Tailwind CSS se charge correctement
- Vérifiez la console du navigateur pour les erreurs JavaScript
- Testez avec un navigateur différent

### Problèmes de responsivité
- Testez sur différentes tailles d'écran
- Vérifiez les media queries dans `orientation.css`

## Métriques de succès

- [ ] Page se charge sans erreur
- [ ] Quiz fonctionne avec validation
- [ ] Analyse PROA s'exécute et affiche le profil
- [ ] Recommandations PORA s'affichent correctement
- [ ] Interface est responsive
- [ ] Animations et transitions sont fluides
- [ ] Gestion d'erreur appropriée

## Scripts de test automatisés

Pour un test plus approfondi, vous pouvez utiliser les scripts suivants :

### Test avec cURL (PROA)
```bash
curl -X POST http://localhost:8000/orientation \
  -H "Content-Type: application/json" \
  -d '{"responses": [5,4,3,5,4,3,5,4,3,5,4,3]}'
```

### Test avec cURL (PORA)
```bash
curl "http://localhost:8080/ranking?logic=8.5&technical=7.2&creativity=6.8&social=9.1"
```

### Test JavaScript unitaire
```javascript
// Test de la fonction de calcul du profil
const responses = [5,4,3,5,4,3,5,4,3,5,4,3];
const profile = calculateProfile(responses);
console.assert(profile.logic > 0, "Profil logique calculé");
console.assert(profile.technical > 0, "Profil technique calculé");
console.assert(profile.creativity > 0, "Profil créativité calculé");
console.assert(profile.social > 0, "Profil social calculé");
```