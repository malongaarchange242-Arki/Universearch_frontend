// Frontend helper for creating an admin user
(function () {
  const API_BASE = window.__API_BASE__ || 'https://universearch-9qle.onrender.com/universites';

  function serializeForm(form) {
    const data = {};
    new FormData(form).forEach((v, k) => (data[k] = v));
    return data;
  }

  async function createAdmin(payload) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || json?.message || 'Registration failed');
    return json;
  }

  // Attach to window for easy access from dev console or pages
  window.createAdmin = createAdmin;

  // If a form with id "create-admin-form" exists, wire it up
  window.addEventListener('load', () => {
    const form = document.getElementById('create-admin-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn ? submitBtn.innerText : null;
      if (submitBtn) submitBtn.disabled = true, submitBtn.innerText = 'Création...';

      try {
        const data = serializeForm(form);

        // Ensure required fields for admin
        data.profileType = 'admin';
        if (!data.email || !data.password || !data.nom || !data.telephone) {
          throw new Error('Veuillez renseigner email, mot de passe, nom et téléphone');
        }

        const resp = await createAdmin(data);
        alert('Admin créé avec succès');
        // Optionnel: rediriger vers la page de connexion
        window.location.href = 'login.html';
      } catch (err) {
        alert('Erreur création admin: ' + (err.message || err));
      } finally {
        if (submitBtn) submitBtn.disabled = false, submitBtn.innerText = originalText;
      }
    });
  });
})();
