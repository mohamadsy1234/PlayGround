/**
 * Storage Module using IndexedDB
 * Manages sessions, events, templates, and settings
 */

class Storage {
  constructor() {
    this.DB_NAME = 'DigitalTwinDB';
    this.DB_VERSION = 1;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Sessions store
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'phone_number' });
        }
        
        // Events store
        if (!db.objectStoreNames.contains('events')) {
          db.createObjectStore('events', { keyPath: 'id', autoIncrement: true });
        }
        
        // Templates store
        if (!db.objectStoreNames.contains('templates')) {
          db.createObjectStore('templates', { keyPath: 'id' });
        }
      };
    });
  }

  async getSession(phoneNumber) {
    const tx = this.db.transaction('sessions', 'readonly');
    const store = tx.objectStore('sessions');
    return new Promise((resolve, reject) => {
      const req = store.get(phoneNumber);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async saveSession(session) {
    const tx = this.db.transaction('sessions', 'readwrite');
    const store = tx.objectStore('sessions');
    return new Promise((resolve, reject) => {
      const req = store.put(session);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async allSessions() {
    const tx = this.db.transaction('sessions', 'readonly');
    const store = tx.objectStore('sessions');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteSession(phoneNumber) {
    const tx = this.db.transaction('sessions', 'readwrite');
    const store = tx.objectStore('sessions');
    return new Promise((resolve, reject) => {
      const req = store.delete(phoneNumber);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async logEvent(event) {
    // Normalize: always stamp time + unify phone field so range/phone
    // queries work no matter which caller shape is used.
    const normalized = {
      timestamp: Date.now(),
      ...event,
    };
    if (normalized.phone == null && normalized.phone_number != null) {
      normalized.phone = normalized.phone_number;
    }
    if (normalized.phone_number == null && normalized.phone != null) {
      normalized.phone_number = normalized.phone;
    }
    const tx = this.db.transaction('events', 'readwrite');
    const store = tx.objectStore('events');
    return new Promise((resolve, reject) => {
      const req = store.add(normalized);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getTemplate(id) {
    const tx = this.db.transaction('templates', 'readonly');
    const store = tx.objectStore('templates');
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async saveTemplate(template) {
    const tx = this.db.transaction('templates', 'readwrite');
    const store = tx.objectStore('templates');
    return new Promise((resolve, reject) => {
      const req = store.put(template);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async eventsByPhone(phoneNumber) {
    const tx = this.db.transaction('events', 'readonly');
    const store = tx.objectStore('events');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const filtered = req.result.filter(e =>
          e.phone_number === phoneNumber || e.phone === phoneNumber
        );
        resolve(filtered);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async eventsInRange(startTime, endTime) {
    const tx = this.db.transaction('events', 'readonly');
    const store = tx.objectStore('events');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const filtered = req.result.filter(e => 
          e.timestamp >= startTime && e.timestamp <= endTime
        );
        resolve(filtered);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getSetting(key, defaultValue = undefined) {
    const result = await chrome.storage.local.get(key);
    if (result[key] === undefined) return defaultValue;
    return result[key];
  }

  async setSetting(key, value) {
    return await chrome.storage.local.set({ [key]: value });
  }
}
