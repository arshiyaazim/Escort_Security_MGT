/**
 * Al-Aqsa HRM Backend - Job Posts Handler
 * Operations for job circular management
 * Note: getJobPosts with status='Open' is PUBLIC (no auth required)
 */

/**
 * Get job posts (PUBLIC for Open status)
 */
function handleGetJobPosts(payload, sessionUser) {
  try {
    let records = getSheetData(SHEETS.JOB_POSTS);
    
    // Filter by status if provided
    if (payload.status) {
      records = records.filter(j => j.status === payload.status);
    }
    
    // If not authenticated and not filtering for Open, only return Open jobs
    if (!sessionUser) {
      records = records.filter(j => j.status === 'Open');
    } else if (!checkPermission(sessionUser.role, 'JobPosts', 'canView')) {
      // Even authenticated users need permission for non-Open jobs
      return unauthorizedResponse('getJobPosts');
    }
    
    return {
      success: true,
      action: 'getJobPosts',
      data: records,
      message: 'Job posts retrieved'
    };
  } catch (error) {
    return sanitizedError('getJobPosts', error);
  }
}

/**
 * Add job post
 */
function handleAddJobPost(payload, sessionUser) {
  // Permission check
  if (!checkPermission(sessionUser.role, 'JobPosts', 'canAdd')) {
    return unauthorizedResponse('addJobPost');
  }
  
  try {
    // Validate required fields
    const requiredFields = ['id', 'title'];
    const validationError = validateRequired(payload, requiredFields);
    if (validationError) {
      return {
        success: false,
        action: 'addJobPost',
        data: null,
        message: validationError
      };
    }
    
    // Prepare record data
    const recordData = {
      id: payload.id,
      title: payload.title,
      description: payload.description || '',
      requirements: payload.requirements || '',
      location: payload.location || '',
      salary: payload.salary || '',
      status: payload.status || 'Draft',
      openDate: payload.openDate || '',
      closeDate: payload.closeDate || '',
      createdAt: payload.createdAt || getTodayISO()
    };
    
    // Add record
    addRecord(SHEETS.JOB_POSTS, recordData);
    
    return {
      success: true,
      action: 'addJobPost',
      data: recordData,
      message: 'Job post created'
    };
  } catch (error) {
    return sanitizedError('addJobPost', error);
  }
}

/**
 * Update job post
 */
function handleUpdateJobPost(payload, sessionUser) {
  // Permission check
  if (!checkPermission(sessionUser.role, 'JobPosts', 'canEdit')) {
    return unauthorizedResponse('updateJobPost');
  }
  
  try {
    // Use indexed lookup for existence check
    const indexedJobPosts = getIndexedSheet(SHEETS.JOB_POSTS, 'id');
    const existing = getFromIndex(indexedJobPosts, payload.id);
    
    if (!existing) {
      return {
        success: false,
        action: 'updateJobPost',
        data: null,
        message: 'Job post not found'
      };
    }
    
    // Prepare updated data
    const recordData = {
      id: payload.id,
      title: payload.title !== undefined ? payload.title : existing.title,
      description: payload.description !== undefined ? payload.description : existing.description,
      requirements: payload.requirements !== undefined ? payload.requirements : existing.requirements,
      location: payload.location !== undefined ? payload.location : existing.location,
      salary: payload.salary !== undefined ? payload.salary : existing.salary,
      status: payload.status !== undefined ? payload.status : existing.status,
      openDate: payload.openDate !== undefined ? payload.openDate : existing.openDate,
      closeDate: payload.closeDate !== undefined ? payload.closeDate : existing.closeDate,
      createdAt: existing.createdAt
    };
    
    // Update record
    updateRecord(SHEETS.JOB_POSTS, payload.id, recordData);
    
    return {
      success: true,
      action: 'updateJobPost',
      data: recordData,
      message: 'Job post updated'
    };
  } catch (error) {
    return sanitizedError('updateJobPost', error);
  }
}

/**
 * Delete job post
 */
function handleDeleteJobPost(payload, sessionUser) {
  // Permission check
  if (!checkPermission(sessionUser.role, 'JobPosts', 'canDelete')) {
    return unauthorizedResponse('deleteJobPost');
  }
  
  try {
    // Use indexed lookup for existence check
    const indexedJobPosts = getIndexedSheet(SHEETS.JOB_POSTS, 'id');
    const existing = getFromIndex(indexedJobPosts, payload.id);
    
    if (!existing) {
      return {
        success: false,
        action: 'deleteJobPost',
        data: null,
        message: 'Job post not found'
      };
    }
    
    // Check if any applications exist for this job (use indexed lookup)
    const indexedApplications = getIndexedSheet(SHEETS.JOB_APPLICATIONS, 'jobId');
    const hasApplications = indexHasKey(indexedApplications, payload.id);
    
    if (hasApplications) {
      return {
        success: false,
        action: 'deleteJobPost',
        data: null,
        message: 'Cannot delete job post with existing applications'
      };
    }
    
    // Delete record
    deleteRecord(SHEETS.JOB_POSTS, payload.id);
    
    return {
      success: true,
      action: 'deleteJobPost',
      data: null,
      message: 'Job post deleted'
    };
  } catch (error) {
    return sanitizedError('deleteJobPost', error);
  }
}
