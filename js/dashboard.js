// js/dashboard.js

// --- IMPORTS ---
import { log } from './logger.js';
import { downloadDebugLog } from './logger.js'; // Also need to import this
import { getCurrentUser } from './auth.js';

document.addEventListener('DOMContentLoaded', async () => {
  log('INFO', 'dashboard.js', 'PAGE_LOAD');
  
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    log('WARN', 'dashboard.js', 'NO_USER_SESSION_REDIRECT');
    window.location.href = 'onboarding.html';
    return;
  }

  populateDashboard(currentUser);
  attachEventListeners();
});

function populateDashboard(user) {
  document.getElementById('user-name').textContent = user.name;
  document.getElementById('referral-code').textContent = user.referralCode;
  
  const referralUrl = `${window.location.origin}/onboarding.html?ref=${user.referralCode}`;
  document.getElementById('referral-link-href').href = referralUrl;
  
  log('INFO', 'dashboard.js', 'DASHBOARD_POPULATED', { name: user.name, referralCode: user.referralCode });
}

function attachEventListeners() {
  document.getElementById('share-button').addEventListener('click', () => {
    const referralCode = document.getElementById('referral-code').textContent;
    const referralUrl = `${window.location.origin}/onboarding.html?ref=${referralCode}`;
    const message = `Join me on this awesome app! Use my link: ${referralUrl}`;

    if (navigator.share) {
      navigator.share({ title: 'Join Transparent Transactions', text: message, url: referralUrl })
        .catch(err => log('WARN', 'dashboard.js', 'WEB_SHARE_API_FAILED', { error: err.message }));
    } else {
      navigator.clipboard.writeText(message).then(() => {
        alert('Referral link copied to clipboard!');
      }).catch(err => log('ERROR', 'dashboard.js', 'CLIPBOARD_COPY_FAILED', { error: err.message }));
    }
  });

  document.getElementById('reports-btn').addEventListener('click', () => {
    document.getElementById('reports-modal').style.display = 'block';
  });

  document.querySelector('.close-button').addEventListener('click', () => {
    document.getElementById('reports-modal').style.display = 'none';
  });

  window.addEventListener('click', (event) => {
    const modal = document.getElementById('reports-modal');
    if (event.target === modal) {
      modal.style.display = 'none';
    }
  });

  document.getElementById('download-log-btn').addEventListener('click', downloadDebugLog);
}