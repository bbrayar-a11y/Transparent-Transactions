// js/app.js

// --- IMPORTS ---
// We need the log function from our logger.
import { log } from './logger.js';

const CURRENT_USER_ID_KEY = 'currentUserId';

function generateReferralCode() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'TT';
  for (let i = 0; i < 6; i++) { result += characters.charAt(Math.floor(Math.random() * characters.length)); }
  return result;
}

function getUrlParams() { return new URLSearchParams(window.location.search); }

function setCurrentUser(userId) {
  localStorage.setItem(CURRENT_USER_ID_KEY, userId);
  log('INFO', 'app.js', 'SESSION_SET', { userId });
}

function getCurrentUserId() {
  const userId = localStorage.getItem(CURRENT_USER_ID_KEY);
  return userId ? parseInt(userId, 10) : null;
}

function clearCurrentUser() {
  localStorage.removeItem(CURRENT_USER_ID_KEY);
  log('INFO', 'app.js', 'SESSION_CLEARED');
}

// --- EXPORTS ---
export { generateReferralCode, getUrlParams, setCurrentUser, getCurrentUserId, clearCurrentUser };