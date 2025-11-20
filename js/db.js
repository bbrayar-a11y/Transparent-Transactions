// js/db.js

// --- IMPORTS ---
import { log } from './logger.js';

const DB_NAME = 'TTDatabase';
const DB_VERSION = 1;
const STORE_NAME = 'users';
let dbInstance = null;

async function openDB() {
  if (dbInstance) { return dbInstance; }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => { log('ERROR', 'db.js', 'DB_OPEN_FAILED', { error: request.error }); reject(request.error); };
    request.onsuccess = () => { dbInstance = request.result; log('INFO', 'db.js', 'DB_OPEN_SUCCESS'); resolve(dbInstance); };
    request.onupgradeneeded = (event) => {
      log('INFO', 'db.js', 'DB_UPGRADE_NEEDED', { oldVersion: event.oldVersion, newVersion: event.newVersion });
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('phone', 'phone', { unique: true });
        store.createIndex('referralCode', 'referralCode', { unique: true });
        log('INFO', 'db.js', 'DB_OBJECT_STORE_CREATED', { storeName: STORE_NAME });
      }
    };
  });
}

async function addUser(user) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(user);
    request.onsuccess = () => { log('INFO', 'db.js', 'USER_ADDED', { userId: request.result, referralCode: user.referralCode }); resolve(request.result); };
    request.onerror = () => { log('ERROR', 'db.js', 'USER_ADD_FAILED', { error: request.error, userPhone: user.phone }); reject(request.error); };
  });
}

async function findUserByPhone(phone) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('phone');
    const request = index.get(phone);
    request.onsuccess = () => { log('INFO', 'db.js', 'USER_SEARCH_BY_PHONE', { phone, found: !!request.result }); resolve(request.result || null); };
    request.onerror = () => { log('ERROR', 'db.js', 'USER_SEARCH_BY_PHONE_FAILED', { error: request.error, phone }); reject(request.error); };
  });
}

async function getUserById(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => { log('INFO', 'db.js', 'USER_RETRIEVED_BY_ID', { id, found: !!request.result }); resolve(request.result || null); };
    request.onerror = () => { log('ERROR', 'db.js', 'USER_RETRIEVE_BY_ID_FAILED', { error: request.error, id }); reject(request.error); };
  });
}

// --- EXPORTS ---
export { openDB, addUser, findUserByPhone, getUserById };