/**
 * Al-Aqsa HRM Backend - Authentication & Session Management
 * PHASE 2: Server-side sessions in Sheets + SHA-256 password hashing
 *
 * Changes from Phase 1:
 *   - Sessions stored in 'sessions' sheet (not PropertiesService)
 *   - Passwords hashed with SHA-256 + per-user salt
 *   - Hash-on-first-login migration for existing plaintext passwords
 *   - RISK-PLAINTEXT-PWD: RESOLVED
 */

// ============================================
// CONFIGURATION
// ============================================
const SESSION_EXPIRY_HOURS = 24;
const MAX_SESSIONS = 200; // Safety cap to prevent session accumulation

// ============================================
// PASSWORD HASHING (SHA-256 + salt)
// ============================================

/**
 * Generate a random 16-character salt
 */
function generateSalt() {
  return Utilities.getUuid().replace(/-/g, '').substring(0, 16);
}

/**
 * Hash a password with SHA-256 + salt
 * Storage format: "salt:hexdigest"
 * @param {string} password - plaintext password
 * @param {string} salt - 16-char random salt
 * @returns {string} "salt:sha256hex"
 */
function hashPassword(password, salt) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + password);
  var hex = raw.map(function(b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
  return salt + ':' + hex;
}

/**
 * Verify a password against a stored hash.
 * Supports transitional plaintext comparison for hash-on-first-login migration.
 *
 * @param {string} password - plaintext password from login form
 * @param {string} storedHash - value from passwordHash column
 * @returns {{ match: boolean, needsRehash: boolean }}
 */
function verifyPassword(password, storedHash) {
  if (!storedHash || !password) {
    return { match: false, needsRehash: false };
  }

  // Hashed format contains a colon separator: "salt:hexdigest"
  if (storedHash.indexOf(':') !== -1) {
    var salt = storedHash.split(':')[0];
    var computed = hashPassword(password, salt);
    return { match: computed === storedHash, needsRehash: false };
  }

  // Legacy plaintext comparison (transitional)
  if (storedHash === password) {
    return { match: true, needsRehash: true };
  }

  return { match: false, needsRehash: false };
}

// ============================================
// SESSION MANAGEMENT (Server-side, Sessions sheet)
// ============================================

/**
 * Ensure the sessions sheet exists (auto-create if missing)
 */
function ensureSessionsSheet() {
  try {
    getSheet(SHEETS.SESSIONS);
  } catch (e) {
    var ss = getSpreadsheet();
    createSheet(ss, SHEETS.SESSIONS, ['sessionId', 'userId', 'role', 'expiresAt', 'createdAt']);
    Logger.log('Created sessions sheet on demand');
  }
}

/**
 * Create a new server-side session.
 * Writes a row to the Sessions sheet and returns the sessionId (UUID).
 *
 * @param {string} userId
 * @param {string} role
 * @returns {string} sessionId (UUID)
 */
function createSession(userId, role) {
  ensureSessionsSheet();

  var sessionId = Utilities.getUuid();
  var now = Date.now();
  var expiresAt = now + (SESSION_EXPIRY_HOURS * 60 * 60 * 1000);

  // Safety cap: prune oldest sessions if at limit
  var sessions = getSheetData(SHEETS.SESSIONS);
  if (sessions.length >= MAX_SESSIONS) {
    pruneOldestSessions(20);
  }

  addRecord(SHEETS.SESSIONS, {
    sessionId: sessionId,
    userId: String(userId),
    role: role,
    expiresAt: expiresAt,
    createdAt: now
  });

  return sessionId;
}

/**
 * Validate a session and return user info.
 *
 * @param {string} sessionId
 * @returns {{ user: object|null, error: string|null }}
 *   error is one of: null, 'UNAUTHORIZED', 'SESSION_EXPIRED'
 */
function validateSession(sessionId) {
  if (!sessionId) {
    return { user: null, error: 'UNAUTHORIZED' };
  }

  try {
    ensureSessionsSheet();
    var indexedSessions = getIndexedSheet(SHEETS.SESSIONS, 'sessionId');
    var session = getFromIndex(indexedSessions, sessionId);

    if (!session) {
      return { user: null, error: 'UNAUTHORIZED' };
    }

    // Check expiry
    var expiresAt = typeof session.expiresAt === 'number'
      ? session.expiresAt
      : Number(session.expiresAt);
    if (Date.now() > expiresAt) {
      expireSession(sessionId);
      return { user: null, error: 'SESSION_EXPIRED' };
    }

    // Fetch user from database
    var indexedUsers = getIndexedSheet(SHEETS.USERS, 'id');
    var user = getFromIndex(indexedUsers, String(session.userId));
    if (!user || user.status !== 'Active') {
      return { user: null, error: 'UNAUTHORIZED' };
    }

    // Return user without password
    var passwordHash = user.passwordHash;
    var safeUser = {};
    Object.keys(user).forEach(function(k) {
      if (k !== 'passwordHash') safeUser[k] = user[k];
    });
    return { user: safeUser, error: null };

  } catch (error) {
    Logger.log('Session validation error: ' + error.toString());
    return { user: null, error: 'UNAUTHORIZED' };
  }
}

/**
 * Expire (delete) a session from the Sessions sheet.
 *
 * @param {string} sessionId
 * @returns {boolean}
 */
function expireSession(sessionId) {
  if (!sessionId) return false;
  try {
    ensureSessionsSheet();
    return deleteRecord(SHEETS.SESSIONS, sessionId, 'sessionId');
  } catch (error) {
    Logger.log('Session expiry error: ' + error.toString());
    return false;
  }
}

/**
 * Prune oldest sessions when the safety cap is reached.
 */
function pruneOldestSessions(count) {
  try {
    var sessions = getSheetData(SHEETS.SESSIONS);
    sessions.sort(function(a, b) { return Number(a.createdAt) - Number(b.createdAt); });
    var toRemove = sessions.slice(0, count);
    toRemove.forEach(function(s) {
      deleteRecord(SHEETS.SESSIONS, s.sessionId, 'sessionId');
    });
    Logger.log('Pruned ' + toRemove.length + ' oldest sessions');
    return toRemove.length;
  } catch (e) {
    Logger.log('Session prune error: ' + e.toString());
    return 0;
  }
}

// ============================================
// BACKWARD-COMPATIBLE WRAPPERS
// handleRequest / handleLogout still call these names.
// They now delegate to the server-side session functions.
// ============================================

/** @deprecated Use createSession() directly */
function generateToken(userId) {
  var indexedUsers = getIndexedSheet(SHEETS.USERS, 'id');
  var user = getFromIndex(indexedUsers, String(userId));
  var role = user ? user.role : 'Viewer';
  return createSession(userId, role);
}

/** @deprecated handleRequest now uses validateSession() directly */
function validateToken(token) {
  var result = validateSession(token);
  return result.user;
}

/** @deprecated Use expireSession() directly */
function invalidateToken(token) {
  return expireSession(token);
}

// ============================================
// AUTH HANDLERS
// ============================================

/**
 * Handle login
 *
 * PHASE 2: SHA-256 password hashing with hash-on-first-login migration.
 * On first successful login with a plaintext password, the password is
 * automatically hashed and the user record is updated in-place.
 *
 * RISK-PLAINTEXT-PWD: RESOLVED by this implementation.
 */
function handleLogin(payload) {
  var username = payload.username;
  var password = payload.password;

  if (!username || !password) {
    return {
      success: false,
      action: 'login',
      data: null,
      error: 'UNAUTHORIZED',
      message: 'Username and password required'
    };
  }

  // Use indexed lookup by username
  var indexedUsers = getIndexedSheet(SHEETS.USERS, 'username');
  var user = getFromIndex(indexedUsers, username);

  if (!user) {
    return {
      success: false,
      action: 'login',
      data: null,
      error: 'UNAUTHORIZED',
      message: 'Invalid username or password'
    };
  }

  // Verify password (supports transitional plaintext→hash migration)
  var verification = verifyPassword(password, user.passwordHash);

  if (!verification.match) {
    return {
      success: false,
      action: 'login',
      data: null,
      error: 'UNAUTHORIZED',
      message: 'Invalid username or password'
    };
  }

  // Check if account is active (before migration, to avoid hashing for disabled accounts)
  if (user.status !== 'Active') {
    return {
      success: false,
      action: 'login',
      data: null,
      error: 'UNAUTHORIZED',
      message: 'Account is disabled'
    };
  }

  // Hash-on-first-login migration
  if (verification.needsRehash) {
    var salt = generateSalt();
    var hashed = hashPassword(password, salt);
    var updatedUser = {};
    Object.keys(user).forEach(function(k) { updatedUser[k] = user[k]; });
    updatedUser.passwordHash = hashed;
    updateRecord(SHEETS.USERS, user.id, updatedUser);
    Logger.log('Migrated plaintext password to SHA-256 hash for user: ' + username);
  }

  // Create server-side session
  var sessionId = createSession(user.id, user.role);

  // Return user info without password (same response shape as before)
  var safeUser = {};
  Object.keys(user).forEach(function(k) {
    if (k !== 'passwordHash') safeUser[k] = user[k];
  });

  return {
    success: true,
    action: 'login',
    data: {
      id: safeUser.id,
      username: safeUser.username,
      role: safeUser.role,
      status: safeUser.status,
      createdAt: safeUser.createdAt,
      token: sessionId   // Frontend stores this as session.token
    },
    message: 'Login successful'
  };
}

/**
 * Handle logout
 */
function handleLogout(payload) {
  var token = payload.token || '';
  expireSession(token);

  return {
    success: true,
    action: 'logout',
    data: null,
    message: 'Logged out successfully'
  };
}

// ============================================
// MAINTENANCE
// ============================================

/**
 * Clean up expired sessions (run periodically via trigger)
 */
function cleanupExpiredSessions() {
  try {
    ensureSessionsSheet();
    var sessions = getSheetData(SHEETS.SESSIONS);
    var now = Date.now();
    var cleanedCount = 0;

    sessions.forEach(function(session) {
      var expiresAt = Number(session.expiresAt);
      if (now > expiresAt) {
        deleteRecord(SHEETS.SESSIONS, session.sessionId, 'sessionId');
        cleanedCount++;
      }
    });

    // One-time migration: clean up legacy tokens from PropertiesService
    cleanupLegacyTokens();

    Logger.log('Cleaned up ' + cleanedCount + ' expired sessions');
    return cleanedCount;

  } catch (error) {
    Logger.log('Session cleanup error: ' + error.toString());
    return 0;
  }
}

/**
 * Remove legacy token_* keys from PropertiesService (migration helper).
 * Safe to call repeatedly — no-ops once all legacy tokens are gone.
 */
function cleanupLegacyTokens() {
  try {
    var tokenStore = PropertiesService.getScriptProperties();
    var allProperties = tokenStore.getProperties();
    var count = 0;

    Object.keys(allProperties).forEach(function(key) {
      if (key.startsWith('token_')) {
        tokenStore.deleteProperty(key);
        count++;
      }
    });

    if (count > 0) {
      Logger.log('Cleaned up ' + count + ' legacy tokens from PropertiesService');
    }
  } catch (e) {
    Logger.log('Legacy token cleanup error: ' + e.toString());
  }
}

/** @deprecated Use cleanupExpiredSessions() — kept for existing triggers */
function cleanupExpiredTokens() {
  return cleanupExpiredSessions();
}

/**
 * Install session cleanup trigger (run once to set up)
 */
function installSessionCleanupTrigger() {
  // Delete any existing triggers
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    var fn = trigger.getHandlerFunction();
    if (fn === 'cleanupExpiredSessions' || fn === 'cleanupExpiredTokens') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('cleanupExpiredSessions')
    .timeBased()
    .everyDays(1)
    .create();

  Logger.log('Session cleanup trigger installed - will run daily');
  return 'Session cleanup trigger installed';
}
