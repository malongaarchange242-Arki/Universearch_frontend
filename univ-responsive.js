document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.getElementById('hamburgerBtn');
  const overlay = document.getElementById('mobile-drawer-overlay');
  const sidebar = document.querySelector('.sidebar');

  if (!hamburger || !overlay || !sidebar) return;

  const closeButton = document.querySelector('.sidebar-close-btn');

  const openDrawer = () => {
    document.body.classList.add('drawer-open');
    hamburger.setAttribute('aria-expanded', 'true');
    hamburger.setAttribute('aria-label', 'Fermer le menu');
    overlay.setAttribute('aria-hidden', 'false');
  };

  const closeDrawer = () => {
    document.body.classList.remove('drawer-open');
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.setAttribute('aria-label', 'Ouvrir le menu');
    overlay.setAttribute('aria-hidden', 'true');
  };

  hamburger.addEventListener('click', (e) => {
    const expanded = hamburger.getAttribute('aria-expanded') === 'true';
    if (expanded) closeDrawer(); else openDrawer();
  });

  overlay.addEventListener('click', () => closeDrawer());
  if (closeButton) {
    closeButton.addEventListener('click', () => closeDrawer());
  }

  // Close when pressing ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
  });

  // Close when clicking links in the drawer
  sidebar.querySelectorAll('a.nav-link, .submenu-item, .nav-link-content a, .nav-link-content').forEach(el => {
    el.addEventListener('click', () => {
      // small delay so click navigation still occurs
      setTimeout(closeDrawer, 120);
    });
  });

  // Keep layout consistent on resize
  window.addEventListener('resize', () => {
    if (window.innerWidth > 1024 && document.body.classList.contains('drawer-open')) {
      // ensure drawer closed on desktop
      closeDrawer();
    }
  });
});
