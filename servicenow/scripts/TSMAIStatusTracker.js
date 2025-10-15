/**
 * TSMAIStatusTracker - Real-time Status Tracking Module
 *
 * PURPOSE: Manages real-time status updates for AI request processing
 * INPUT: Session IDs, step names, status updates
 * PROCESS: Stores and retrieves status information via ServiceNow session
 * OUTPUT: Status objects for real-time UI updates
 *
 * DEPENDENCIES: None - Pure status tracking
 */

var TSMAIStatusTracker = function() {
  this.statusTracker = null;
};

TSMAIStatusTracker.prototype = {

  /**
   * Initialize status tracker for real-time updates
   *
   * INPUT: sessionId (string) - unique session identifier
   * PROCESS: Creates or retrieves status tracker
   * OUTPUT: Status tracker object
   */
  initStatusTracker: function(sessionId) {
    // Use sys_user_session or custom table to store status
    // For now, use session storage pattern
    if (!sessionId) {
      sessionId = gs.generateGUID();
    }

    this.statusTracker = {
      sessionId: sessionId,
      steps: [],
      currentStep: null,
      startTime: new Date().getTime()
    };

    // Store in session for retrieval
    gs.getSession().putClientData('ai_status_' + sessionId, JSON.stringify(this.statusTracker));

    return sessionId;
  },

  /**
   * Update status for real-time tracking
   *
   * INPUT: stepName (string), status (string: active/completed/error), message (string)
   * PROCESS: Updates status tracker and stores in session
   * OUTPUT: Updated status object
   */
  updateStatus: function(stepName, status, message) {
    if (!this.statusTracker) {
      return null;
    }

    var step = {
      name: stepName,
      status: status,
      message: message,
      timestamp: new Date().getTime()
    };

    this.statusTracker.steps.push(step);
    this.statusTracker.currentStep = step;

    // Update session storage
    gs.getSession().putClientData('ai_status_' + this.statusTracker.sessionId, JSON.stringify(this.statusTracker));

    return step;
  },

  /**
   * Get current status for polling
   *
   * INPUT: sessionId (string)
   * PROCESS: Retrieves status from session
   * OUTPUT: Current status object
   */
  getStatus: function(sessionId) {
    var statusJson = gs.getSession().getClientData('ai_status_' + sessionId);
    if (statusJson) {
      return JSON.parse(statusJson);
    }
    return null;
  },

  type: 'TSMAIStatusTracker'
};
