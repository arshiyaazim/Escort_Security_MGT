/**
 * Al-Aqsa HRM Backend - User Management Handler
 * Operations for user administration (Admin only)
 */

/**
 * Get all users
 */
function handleGetUsers(payload, sessionUser) {
  // Permission check - Only Admin can view users
  if (!sessionUser || !checkPermission(sessionUser.role, 'UserManagement', 'canView')) {
    return unauthorizedResponse('getUsers');
  }
  
  try {
    const users = getSheetData(SHEETS.USERS);
    
    // Return users without passwords
    const safeUsers = users.map(u => {
      const { passwordHash, ...safe } = u;
      return safe;
    });
    
    return {
      success: true,
      action: 'getUsers',
      data: safeUsers,
      message: 'Users retrieved'
    };
  } catch (error) {
    return sanitizedError('getUsers', error);
  }
}

/**
 * Add new user
 */
function handleAddUser(payload, sessionUser) {
  // Permission check
  if (!sessionUser || !checkPermission(sessionUser.role, 'UserManagement', 'canAdd')) {
    return unauthorizedResponse('addUser');
  }
  
  try {
    // Validate required fields
    const requiredFields = ['id', 'username', 'password', 'role'];
    const validationError = validateRequired(payload, requiredFields);
    if (validationError) {
      return {
        success: false,
        action: 'addUser',
        data: null,
        message: validationError
      };
    }
    
    // Check username uniqueness (indexed lookup)
    const indexedUsers = getIndexedSheet(SHEETS.USERS, 'username');
    const existingUser = getFromIndex(indexedUsers, payload.username);
    
    if (existingUser) {
      return {
        success: false,
        action: 'addUser',
        data: null,
        message: 'Username already exists'
      };
    }
    
    // Validate role
    const validRoles = ['Admin', 'Operations', 'Finance', 'Auditor', 'Viewer'];
    if (!validRoles.includes(payload.role)) {
      return {
        success: false,
        action: 'addUser',
        data: null,
        message: 'Invalid role. Must be Admin, Operations, Finance, Auditor, or Viewer'
      };
    }
    
    // Create new user
    const newUser = {
      id: payload.id,
      username: payload.username,
      passwordHash: hashPassword(payload.password, generateSalt()),
      role: payload.role,
      status: 'Active',
      createdAt: payload.createdAt || getTodayISO()
    };
    
    addRecord(SHEETS.USERS, newUser);
    
    // Return user without password
    const { passwordHash, ...safeNewUser } = newUser;
    
    return {
      success: true,
      action: 'addUser',
      data: safeNewUser,
      message: 'User created successfully'
    };
  } catch (error) {
    return sanitizedError('addUser', error);
  }
}

/**
 * Update user
 */
function handleUpdateUser(payload, sessionUser) {
  // Permission check
  if (!sessionUser || !checkPermission(sessionUser.role, 'UserManagement', 'canEdit')) {
    return unauthorizedResponse('updateUser');
  }
  
  try {
    // Use indexed lookup for user
    const indexedUsers = getIndexedSheet(SHEETS.USERS, 'id');
    const foundUser = getFromIndex(indexedUsers, payload.id);
    
    if (!foundUser) {
      return {
        success: false,
        action: 'updateUser',
        data: null,
        message: 'User not found'
      };
    }
    
    // Create copy to avoid mutating indexed data
    const user = { ...foundUser };
    
    // Update allowed fields
    var oldRole = user.role;
    if (payload.role !== undefined) {
      const validRoles = ['Admin', 'Operations', 'Finance', 'Auditor', 'Viewer'];
      if (!validRoles.includes(payload.role)) {
        return {
          success: false,
          action: 'updateUser',
          data: null,
          message: 'Invalid role. Must be Admin, Operations, Finance, Auditor, or Viewer'
        };
      }
      user.role = payload.role;
    }
    
    if (payload.status !== undefined) {
      const validStatuses = ['Active', 'Inactive'];
      if (!validStatuses.includes(payload.status)) {
        return {
          success: false,
          action: 'updateUser',
          data: null,
          message: 'Invalid status. Must be Active or Inactive'
        };
      }
      user.status = payload.status;
    }
    
    updateRecord(SHEETS.USERS, payload.id, user);

    // Audit trail for user changes
    var changes = [];
    if (payload.role !== undefined && payload.role !== oldRole) changes.push('role ' + oldRole + ' → ' + payload.role);
    if (payload.status !== undefined) changes.push('status → ' + payload.status);
    logActivity({ sessionUser: sessionUser, action: 'updateUser', module: 'UserManagement', recordId: payload.id, summary: 'Updated user ' + user.username + (changes.length ? ': ' + changes.join(', ') : ''), success: true });
    
    // Return user without password
    const { passwordHash, ...safeUpdatedUser } = user;
    
    return {
      success: true,
      action: 'updateUser',
      data: safeUpdatedUser,
      message: 'User updated successfully'
    };
  } catch (error) {
    return sanitizedError('updateUser', error);
  }
}

/**
 * Reset user password
 */
function handleResetPassword(payload, sessionUser) {
  // Permission check
  if (!sessionUser || !checkPermission(sessionUser.role, 'UserManagement', 'canEdit')) {
    return unauthorizedResponse('resetPassword');
  }
  
  try {
    // Use indexed lookup for user
    const indexedUsers = getIndexedSheet(SHEETS.USERS, 'id');
    const foundUser = getFromIndex(indexedUsers, payload.id);
    
    if (!foundUser) {
      return {
        success: false,
        action: 'resetPassword',
        data: null,
        message: 'User not found'
      };
    }
    
    // Create copy to avoid mutating indexed data
    const user = { ...foundUser };
    
    // Update password (hashed)
    user.passwordHash = hashPassword(payload.newPassword, generateSalt());
    updateRecord(SHEETS.USERS, payload.id, user);
    
    return {
      success: true,
      action: 'resetPassword',
      data: null,
      message: 'Password reset successfully'
    };
  } catch (error) {
    return sanitizedError('resetPassword', error);
  }
}

/**
 * Delete user
 */
function handleDeleteUser(payload, sessionUser) {
  // Permission check
  if (!sessionUser || !checkPermission(sessionUser.role, 'UserManagement', 'canDelete')) {
    return unauthorizedResponse('deleteUser');
  }
  
  try {
    // Use indexed lookup for user
    const indexedUsers = getIndexedSheet(SHEETS.USERS, 'id');
    const user = getFromIndex(indexedUsers, payload.id);
    
    if (!user) {
      return {
        success: false,
        action: 'deleteUser',
        data: null,
        message: 'User not found'
      };
    }
    
    // Prevent deleting self
    if (sessionUser.id === payload.id) {
      return {
        success: false,
        action: 'deleteUser',
        data: null,
        message: 'Cannot delete your own account'
      };
    }
    
    deleteRecord(SHEETS.USERS, payload.id);
    
    return {
      success: true,
      action: 'deleteUser',
      data: null,
      message: 'User deleted'
    };
  } catch (error) {
    return sanitizedError('deleteUser', error);
  }
}
