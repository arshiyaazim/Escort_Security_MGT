/**
 * Al-Aqsa HRM Backend - Job Applications Handler
 * Operations for job application management
 * Note: addJobApplication and getJobApplication are PUBLIC
 */

/**
 * Get job applications (filtered by jobId and/or status)
 */
function handleGetJobApplications(payload, sessionUser) {
  // Permission check for listing applications
  if (!sessionUser || !checkPermission(sessionUser.role, 'JobApplications', 'canView')) {
    return unauthorizedResponse('getJobApplications');
  }
  
  try {
    let records = getSheetData(SHEETS.JOB_APPLICATIONS);
    
    // Filter by jobId if provided
    if (payload.jobId) {
      records = records.filter(a => a.jobId === payload.jobId);
    }
    
    // Filter by status if provided
    if (payload.status) {
      records = records.filter(a => a.status === payload.status);
    }
    
    return {
      success: true,
      action: 'getJobApplications',
      data: records,
      message: 'Job applications retrieved'
    };
  } catch (error) {
    return sanitizedError('getJobApplications', error);
  }
}

/**
 * Add job application (PUBLIC - no auth required)
 */
function handleAddJobApplication(payload, sessionUser) {
  try {
    // Validate required fields
    const requiredFields = ['id', 'jobId', 'applicantName', 'phone', 'email'];
    const validationError = validateRequired(payload, requiredFields);
    if (validationError) {
      return {
        success: false,
        action: 'addJobApplication',
        data: null,
        message: validationError
      };
    }
    
    // Use indexed lookup to verify job exists and is open
    const indexedJobPosts = getIndexedSheet(SHEETS.JOB_POSTS, 'id');
    const targetJob = getFromIndex(indexedJobPosts, payload.jobId);
    
    if (!targetJob) {
      return {
        success: false,
        action: 'addJobApplication',
        data: null,
        message: 'Job post not found'
      };
    }
    
    if (targetJob.status !== 'Open') {
      return {
        success: false,
        action: 'addJobApplication',
        data: null,
        message: 'This job is no longer accepting applications'
      };
    }
    
    // Prepare record data
    const recordData = {
      id: payload.id,
      jobId: payload.jobId,
      applicantName: payload.applicantName,
      phone: payload.phone,
      email: payload.email,
      experience: payload.experience || '',
      education: payload.education || '',
      skills: payload.skills || '',
      resumeUrl: payload.resumeUrl || '',
      status: 'New',
      appliedAt: getTodayISO(),
      notes: ''
    };
    
    // Add record
    addRecord(SHEETS.JOB_APPLICATIONS, recordData);
    
    return {
      success: true,
      action: 'addJobApplication',
      data: recordData,
      message: 'Application submitted successfully'
    };
  } catch (error) {
    return sanitizedError('addJobApplication', error);
  }
}

/**
 * Update application status
 */
function handleUpdateApplicationStatus(payload, sessionUser) {
  // Permission check
  if (!sessionUser || !checkPermission(sessionUser.role, 'JobApplications', 'canEdit')) {
    return unauthorizedResponse('updateApplicationStatus');
  }
  
  try {
    // Use indexed lookup for application
    const indexedApplications = getIndexedSheet(SHEETS.JOB_APPLICATIONS, 'id');
    const application = getFromIndex(indexedApplications, payload.id);
    
    if (!application) {
      return {
        success: false,
        action: 'updateApplicationStatus',
        data: null,
        message: 'Application not found'
      };
    }
    
    // Update status and notes (create copy to avoid mutating indexed data)
    const updatedApplication = { ...application };
    updatedApplication.status = payload.status || application.status;
    if (payload.notes !== undefined) {
      updatedApplication.notes = payload.notes;
    }
    
    updateRecord(SHEETS.JOB_APPLICATIONS, payload.id, updatedApplication);
    
    return {
      success: true,
      action: 'updateApplicationStatus',
      data: updatedApplication,
      message: 'Application status updated'
    };
  } catch (error) {
    return sanitizedError('updateApplicationStatus', error);
  }
}

/**
 * Get single job application (PUBLIC - for applicant tracking)
 */
function handleGetJobApplication(payload, sessionUser) {
  try {
    // Use indexed lookup for application
    const indexedApplications = getIndexedSheet(SHEETS.JOB_APPLICATIONS, 'id');
    const application = getFromIndex(indexedApplications, payload.id);
    
    if (!application) {
      return {
        success: false,
        action: 'getJobApplication',
        data: null,
        message: 'Application not found'
      };
    }
    
    return {
      success: true,
      action: 'getJobApplication',
      data: application,
      message: 'Application retrieved'
    };
  } catch (error) {
    return sanitizedError('getJobApplication', error);
  }
}
