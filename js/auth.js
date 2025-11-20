// js/auth.js

// --- IMPORTS ---
import { log } from './logger.js';
import { findUserByPhone, getUserById } from './db.js';
import { setCurrentUser, getCurrentUserId, clearCurrentUser } from './app.js';

async function loginWithPhone(phone) {
  log('INFO', 'auth.js', 'LOGIN_ATTEMPT', { phone });
  try {
    const user = await findUserByPhone(phone);
    if (user) {
      setCurrentUser(user.id);
      log('INFO', 'auth.js', 'LOGIN_SUCCESS', { userId: user.id, name: user.name });
      return user;
    } else {
      log('WARN', 'auth.js', 'LOGIN_FAILED_USER_NOT_FOUND', { phone });
      return null;
    }
  } catch (error) {
    log('ERROR', 'auth.js', 'LOGIN_ERROR', { phone, error: error.message });
    return null;
  }
}

async function getCurrentUser() {
  const userId = getCurrentUserId();
  if (!userId) {
    log('INFO', 'auth.js', 'GET_CURRENT_USER_NO_SESSION');
    return null;
  }

  try {
    const user = await getUserById(userId);
    if (user) {
      log('INFO', 'auth.js', 'GET_CURRENT_USER_SUCCESS', { userId, name: user.name });
    } else {
      log('WARN', 'auth.js', 'GET_CURRENT_USER_USER_NOT_FOUND', { userId });
      clearCurrentUser();
    }
    return user;
  } catch (error) {
    log('ERROR', 'auth.js', 'GET_CURRENT_USER_ERROR', { userId, error: error.message });
    clearCurrentUser();
    return null;
  }
}

// --- EXPORTS ---
export { loginWithPhone, getCurrentUser };