// js/onboarding.js

// --- IMPORTS ---
import { log } from './logger.js';
import { getUrlParams, setCurrentUser, getCurrentUserId, clearCurrentUser, generateReferralCode } from './app.js';
import { addUser, getUserById } from './db.js';
import { loginWithPhone } from './auth.js';

document.addEventListener('DOMContentLoaded', async () => {
  log('INFO', 'onboarding.js', 'PAGE_LOAD');

  const params = getUrlParams();
  const currentUserId = getCurrentUserId();
  const referrerCode = params.get('ref');
  const seedKey = params.get('seed');

  log('INFO', 'onboarding.js', 'URL_PARAMS_PARSED', { seedKey, referrerCode, currentUserId });

  // --- Edge Case: Logged-in user clicks a referral link ---
  if (currentUserId && referrerCode) {
    log('INFO', 'onboarding.js', 'LOGGED_IN_USER_CLICKS_REFERRAL', { currentUserId, referrerCode });
    try {
      const currentUser = await getUserById(currentUserId);
      if (currentUser) {
        log('INFO', 'onboarding.js', 'SHOWING_LOGGED_IN_PROMPT');
        showLoggedInPrompt(currentUser, referrerCode);
        return; // Stop further execution
      }
    } catch (error) {
      log('ERROR', 'onboarding.js', 'ERROR_FETCHING_CURRENT_USER_FOR_PROMPT', { error: error.message });
    }
  }
  
  log('INFO', 'onboarding.js', 'PROCEEDING_TO_NORMAL_FLOW');
  
  // --- Normal Flow: New user or direct access ---
  if (seedKey === 'MASTER_KEY_2024') {
    log('INFO', 'onboarding.js', 'SHOWING_SIGNUP_FORM_SEED');
    showSignupForm('seed');
  } else if (referrerCode) {
    log('INFO', 'onboarding.js', 'SHOWING_SIGNUP_FORM_REFERRAL');
    showSignupForm('referral', referrerCode);
  } else {
    log('INFO', 'onboarding.js', 'SHOWING_LOGIN_FORM');
    showLoginForm();
  }
});

function showLoggedInPrompt(currentUser, referrerCode) {
  document.getElementById('signup-form').style.display = 'none';
  const promptDiv = document.getElementById('logged-in-prompt');
  promptDiv.style.display = 'block';
  promptDiv.querySelector('p').innerHTML = `You are currently logged in as <strong>${currentUser.name}</strong>. Would you like to sign up as a new user under referral code <strong>${referrerCode}</strong>?`;
  
  document.getElementById('btn-signup-new').onclick = () => {
    log('INFO', 'onboarding.js', 'USER_CHOOSES_TO_SIGNUP_NEW');
    clearCurrentUser();
    promptDiv.style.display = 'none';
    showSignupForm('referral', referrerCode);
  };

  document.getElementById('btn-go-to-dashboard').onclick = () => {
    log('INFO', 'onboarding.js', 'USER_CHOOSES_GO_TO_DASHBOARD');
    window.location.href = 'index.html';
  };
}

function showLoginForm() {
  document.getElementById('signup-form').style.display = 'none';
  document.getElementById('login-form').style.display = 'block';
  document.getElementById('login-form').addEventListener('submit', handleLogin);
}

async function handleLogin(event) {
  event.preventDefault();
  const phone = event.target.phone.value;
  const submitBtn = event.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Logging in...';

  const user = await loginWithPhone(phone);
  if (user) {
    window.location.href = 'index.html';
  } else {
    alert('Phone number not found. Please check the number or sign up.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Login';
  }
}

function showSignupForm(type, data = null) {
  document.getElementById('login-form').style.display = 'none';
  const signupForm = document.getElementById('signup-form');
  signupForm.style.display = 'block';
  
  if (type === 'referral') {
    document.getElementById('referrer-info').style.display = 'block';
    document.getElementById('referrer-code-display').textContent = data;
  } else {
    document.getElementById('referrer-info').style.display = 'none';
  }
  
  signupForm.addEventListener('submit', (event) => {
  log('INFO', 'onboarding.js', 'FORM_SUBMIT_EVENT_FIRED', { type, data });
  handleSignup(event, type, data);
});
}

async function handleSignup(event, type, data) {
  event.preventDefault();
  const form = event.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating Account...';

  const name = form.name.value;
  const phone = form.phone.value;
  const email = form.email.value || null;
  const referralCode = generateReferralCode();

  let upline = [null, null, null, null];
  if (type === 'referral') {
    const chain = data.split(':');
    const newUpline = [referralCode, ...chain];
    upline = newUpline.slice(0, 4);
    while (upline.length < 4) {
      upline.push(null);
    }
  }

  const newUser = { name, phone, email, referralCode, upline };

  try {
    const userId = await addUser(newUser);
    setCurrentUser(userId);
    log('INFO', 'onboarding.js', 'SIGNUP_SUCCESS', { userId, name, phone, referralCode });
    window.location.href = 'index.html';
  } catch (error) {
    if (error.name === 'ConstraintError') {
      alert('This phone number is already registered. Please try logging in.');
    } else {
      alert('An error occurred during sign up. Please try again.');
    }
    log('ERROR', 'onboarding.js', 'SIGNUP_FAILED', { error: error.message, user: newUser });
    submitBtn.disabled = false;
    submitBtn.textContent = 'Continue';
  }
}