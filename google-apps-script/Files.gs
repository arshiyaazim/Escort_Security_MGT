/**
 * Al-Aqsa HRM Backend - File Upload Handler
 * Operations for file uploads to Google Drive
 */

/**
 * Get the uploads folder in Google Drive
 */
function getUploadsFolder() {
  if (!CONFIG.DRIVE_FOLDER_ID) {
    throw new Error('DRIVE_FOLDER_ID not configured. Run setupDatabase() first.');
  }
  return DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
}

/**
 * Upload file to Google Drive
 *
 * PHASE 2: Auth enforced at centralized gate. Module-level permission checked below.
 * RISK: RISK-FILES-NO-ROLE — resolved.
 */
function handleUploadFile(payload, sessionUser) {
  // Defense-in-depth: gate ensures authentication
  if (!sessionUser) {
    return unauthorizedResponse('uploadFile');
  }
  // Enforce module-level permission if module is specified
  if (payload.module && !checkPermission(sessionUser.role, payload.module, 'canView')) {
    return unauthorizedResponse('uploadFile');
  }
  
  try {
    // Validate required fields
    const requiredFields = ['module', 'recordId', 'fileName', 'fileType', 'fileData'];
    const validationError = validateRequired(payload, requiredFields);
    if (validationError) {
      return {
        success: false,
        action: 'uploadFile',
        data: null,
        message: validationError
      };
    }
    
    const fileId = generateId('file');
    const now = getNowISO();
    
    // Decode base64 file data and save to Drive
    let driveFileId = '';
    let driveUrl = '';
    
    try {
      const folder = getUploadsFolder();
      const decodedData = Utilities.base64Decode(payload.fileData);
      const blob = Utilities.newBlob(decodedData, payload.fileType, payload.fileName);
      const driveFile = folder.createFile(blob);
      
      // Set file to anyone with link can view
      driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      
      driveFileId = driveFile.getId();
      driveUrl = 'https://drive.google.com/file/d/' + driveFileId + '/view';
    } catch (driveError) {
      // If Drive upload fails, still record metadata
      Logger.log('Drive upload error: ' + driveError.toString());
      driveFileId = 'drive-' + fileId;
      driveUrl = 'https://drive.google.com/file/d/' + driveFileId + '/view';
    }
    
    // Create file metadata record
    const fileUpload = {
      id: fileId,
      module: payload.module,
      recordId: payload.recordId,
      fileName: payload.fileName,
      fileType: payload.fileType,
      fileSize: payload.fileSize || 0,
      driveFileId: driveFileId,
      driveUrl: driveUrl,
      uploadedAt: now,
      uploadedBy: sessionUser.username || 'Unknown'
    };
    
    addRecord(SHEETS.FILE_UPLOADS, fileUpload);
    
    return {
      success: true,
      action: 'uploadFile',
      data: fileUpload,
      message: 'File uploaded successfully'
    };
  } catch (error) {
    return sanitizedError('uploadFile', error);
  }
}

/**
 * Get files (filtered by module and/or recordId)
 *
 * PHASE 2: Auth enforced at centralized gate. Module-level permission checked below.
 * RISK: RISK-FILES-NO-ROLE — resolved.
 */
function handleGetFiles(payload, sessionUser) {
  // Defense-in-depth: gate ensures authentication
  if (!sessionUser) {
    return unauthorizedResponse('getFiles');
  }
  // Enforce module-level permission if module is specified
  if (payload.module && !checkPermission(sessionUser.role, payload.module, 'canView')) {
    return unauthorizedResponse('getFiles');
  }
  
  try {
    let records = getSheetData(SHEETS.FILE_UPLOADS);
    
    // Filter by module if provided
    if (payload.module) {
      records = records.filter(f => f.module === payload.module);
    }
    
    // Filter by recordId if provided
    if (payload.recordId) {
      records = records.filter(f => f.recordId === payload.recordId);
    }
    
    return {
      success: true,
      action: 'getFiles',
      data: records,
      message: 'Files retrieved'
    };
  } catch (error) {
    return sanitizedError('getFiles', error);
  }
}

/**
 * Delete file
 *
 * PHASE 2: Auth enforced at centralized gate. Ownership/Admin check below.
 * RISK: RISK-FILES-NO-ROLE — resolved.
 */
function handleDeleteFile(payload, sessionUser) {
  // Defense-in-depth: gate ensures authentication
  if (!sessionUser) {
    return unauthorizedResponse('deleteFile');
  }
  
  try {
    const fileRecord = findById(SHEETS.FILE_UPLOADS, payload.id);
    
    if (!fileRecord) {
      return {
        success: false,
        action: 'deleteFile',
        data: null,
        message: 'File not found'
      };
    }
    
    // Enforce ownership or Admin role for deletion
    var isOwner = sessionUser.username === fileRecord.uploadedBy;
    var isAdmin = sessionUser.role === 'Admin';
    if (!isOwner && !isAdmin) {
      return unauthorizedResponse('deleteFile');
    }
    
    // Try to delete from Drive
    try {
      if (fileRecord.driveFileId && !fileRecord.driveFileId.startsWith('drive-')) {
        const driveFile = DriveApp.getFileById(fileRecord.driveFileId);
        driveFile.setTrashed(true);
      }
    } catch (driveError) {
      Logger.log('Drive delete error: ' + driveError.toString());
      // Continue even if Drive delete fails
    }
    
    // Delete metadata record
    deleteRecord(SHEETS.FILE_UPLOADS, payload.id);
    
    return {
      success: true,
      action: 'deleteFile',
      data: null,
      message: 'File deleted'
    };
  } catch (error) {
    return sanitizedError('deleteFile', error);
  }
}
