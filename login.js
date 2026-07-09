(() => {
	const API_BASE = window.__API_BASE__ || 'http://51.79.73.96';

	const elEmail = document.getElementById('email');
	const emailError = document.getElementById('email-error');
	const elPassword = document.getElementById('password');
	const form = document.getElementById('auth-flow');
	const stepEmail = document.getElementById('step-email');
	const stepPassword = document.getElementById('step-password');
	const loader = document.getElementById('loader-line');
	const emailCheck = document.getElementById('email-check');

	function showStep(showEl, hideEl) {
		if (showEl) showEl.classList.remove('hidden-step'), showEl.classList.add('visible-step');
		if (hideEl) hideEl.classList.remove('visible-step'), hideEl.classList.add('hidden-step');
	}

	function setLoader(percent) {
		if (!loader) return;
		loader.style.width = `${percent}%`;
	}

	function extractToken(json) {
		return json?.token
			|| json?.data?.token
			|| json?.access_token
			|| json?.data?.access_token
			|| json?.data?.session?.access_token
			|| json?.session?.access_token
			|| json?.data?.access?.token
			|| json?.auth?.access_token
			|| null;
	}

	async function doLogin(email, password) {
		try {
			setLoader(60);
			const res = await fetch(`${API_BASE}/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password }),
			});

			const json = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(json?.error || json?.message || 'Authentification échouée');

			const token = extractToken(json);
			if (!token) throw new Error('Jeton manquant dans la réponse');

			// Sauvegarde du token et redirection
			localStorage.setItem('softura_token', token);
			setLoader(100);
			// Rediriger vers la page admin (nom du fichier tel que présent dans le repo)
			window.location.href = 'univ_admi.html';
		} catch (err) {
			setLoader(0);
			alert('Erreur de connexion: ' + (err.message || err));
			showStep(stepPassword, null);
		}
	}

	// Email -> show password on Enter

	async function handleEmailCheck(email) {
		console.debug && console.debug('CHECK EMAIL TRIGGERED', email);
		// If email is empty or clearly invalid, do nothing (no action)
		if (!email || !email.includes('@')) return;

		// UI: show loader, disable input
		if (emailCheck) emailCheck.classList.remove('hidden');
		setLoader(20);
		elEmail.disabled = true;
		emailError && (emailError.classList.add('hidden'));

		try {
			const res = await fetch(`${API_BASE}/auth/check-email`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email }),
			});

			setLoader(60);
			if (res.status === 429) {
				emailError && (emailError.textContent = 'Trop de requêtes, réessayez plus tard');
				emailError && emailError.classList.remove('hidden');
				return;
			}

			const json = await res.json().catch(() => ({}));
			if (!res.ok) {
				emailError && (emailError.textContent = 'Identifiants invalides');
				emailError && emailError.classList.remove('hidden');
				return;
			}

			if (json && json.exists) {
				// smooth transition
				if (emailCheck) emailCheck.classList.add('hidden');
				setLoader(80);
				setTimeout(() => {
					setLoader(50);
					showStep(stepPassword, stepEmail);
					elPassword && elPassword.focus();
				}, 300);
			} else {
				// Generic error message — do not reveal existence
				emailError && (emailError.textContent = 'Identifiants invalides');
				emailError && emailError.classList.remove('hidden');
			}
		} catch (err) {
			console.error('check-email error', err);
			emailError && (emailError.textContent = 'Erreur réseau');
			emailError && emailError.classList.remove('hidden');
		} finally {
			if (emailCheck) emailCheck.classList.add('hidden');
			setLoader(0);
			elEmail.disabled = false;
		}
	}

	if (elEmail) {
		elEmail.addEventListener('keydown', async (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				await handleEmailCheck(elEmail.value.trim());
			}
		});

		// When leaving the field, trigger a check if still on the email step
		elEmail.addEventListener('blur', async () => {
			if (stepEmail && stepEmail.classList.contains('visible-step')) {
				await handleEmailCheck(elEmail.value.trim());
			}
		});
	}

	// Ensure form submit triggers the same behaviour (e.g., mobile keyboards)
	if (form) {
		form.addEventListener('submit', async (e) => {
			e.preventDefault();
			// If password step visible, submit login instead
			if (stepPassword && stepPassword.classList.contains('visible-step')) {
				const email = elEmail.value.trim();
				const password = elPassword.value;
				if (!email || !password) return;
				doLogin(email, password);
				return;
			}
			await handleEmailCheck(elEmail.value.trim());
		});
	}

	// Password -> submit on Enter
	if (elPassword) {
		elPassword.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				const email = elEmail.value.trim();
				const password = elPassword.value;
				if (!email || !password) {
					alert('Veuillez renseigner l\'email et le mot de passe');
					return;
				}
				doLogin(email, password);
			}
		});
	}

	// Optional: focus email on load with small delay to avoid DOM/animation conflicts
	window.addEventListener('load', () => {
		setTimeout(() => {
			if (elEmail) elEmail.focus();
		}, 150);
	});
})();

