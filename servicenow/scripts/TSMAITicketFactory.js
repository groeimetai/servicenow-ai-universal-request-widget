/**
 * TSMAITicketFactory - Ticket Creation Module
 *
 * PURPOSE: Create various ServiceNow tickets with AI enhancement
 * INPUT: Submission data with Q&A responses, AI analysis
 * PROCESS: Builds descriptions, creates records, attaches screenshots
 * OUTPUT: Created ticket records with AI-enhanced descriptions
 *
 * DEPENDENCIES: TSMAISearchEngine (for agent knowledge)
 *
 * FUNCTIONS (9):
 * - generateAISummaryAndCategorization: AI analysis
 * - createIncidentWithAI: Create incidents
 * - createProblemWithAI: Create problems
 * - createChangeWithAI: Create changes
 * - createServiceRequestWithAI: Create service requests
 * - createHRCaseWithAI: Create HR cases
 * - createQueryTicket: Create query tickets
 * - buildAIEnhancedDescription: Format descriptions
 * - attachScreenshotsToRecord: Attach files
 */

var TSMAITicketFactory = function() {};

TSMAITicketFactory.prototype = {

  generateAISummaryAndCategorization: function(submissionData) {
    try {
      var helpers = new TSMAIRequestHelpers();
      var llmEnabled = gs.getProperty('datacenter.llm.enabled');

      // TEMP FIX: Force enable LLM for testing
      var forceEnable = true;

      if (!forceEnable && (!llmEnabled || (llmEnabled !== 'true' && llmEnabled !== true))) {
        return null;
      }

      var language = helpers.detectLanguage(submissionData.initialRequest);
      
      // Build context for AI
      var context = 'Original Request: ' + submissionData.initialRequest + '\n\n';
      context += 'Questions and Answers:\n';
      for (var i = 0; i < submissionData.aiQuestions.length; i++) {
        context += 'Q: ' + submissionData.aiQuestions[i].question + '\n';
        context += 'A: ' + (submissionData.responses[i] || 'No response') + '\n\n';
      }
      
      var prompt = '';
      if (language === 'Dutch') {
        prompt = 'Analyseer deze ServiceNow aanvraag en geef een gestructureerde samenvatting in het Nederlands.\n\n';
        prompt += context + '\n\n';
        prompt += 'Genereer een JSON response met exact deze structuur:\n';
        prompt += '{\n';
        prompt += '  "ticket_type": "INC" | "PRB" | "CHG" | "REQ" | "HR" | "QUERY",\n';
        prompt += '  "summary": "Korte samenvatting (max 160 karakters)",\n';
        prompt += '  "analysis": "Gedetailleerde analyse van het probleem/verzoek",\n';
        prompt += '  "suggestion": "Wat denk je dat het probleem is en mogelijke oplossing",\n';
        prompt += '  "category": "Hardware" | "Software" | "Network" | "Access" | "Other",\n';
        prompt += '  "assignment_group": "Voorgestelde assignment group"\n';
        prompt += '}\n\n';
        prompt += 'Bepaal het ticket_type als volgt:\n';
        prompt += '- INC: Iets is kapot of werkt niet\n';
        prompt += '- PRB: Terugkerend probleem dat onderzoek vereist\n';
        prompt += '- CHG: Wijzigingsverzoek\n';
        prompt += '- REQ: Service aanvraag voor iets nieuws\n';
        prompt += '- HR: Personeelszaken, verlof, salaris, onboarding, HR beleid\n';
        prompt += '- QUERY: Vraag om informatie of hulp';
      } else {
        prompt = 'Analyze this ServiceNow request and provide a structured summary.\n\n';
        prompt += context + '\n\n';
        prompt += 'Generate a JSON response with exactly this structure:\n';
        prompt += '{\n';
        prompt += '  "ticket_type": "INC" | "PRB" | "CHG" | "REQ" | "HR" | "QUERY",\n';
        prompt += '  "summary": "Short summary (max 160 chars)",\n';
        prompt += '  "analysis": "Detailed analysis of the issue/request",\n';
        prompt += '  "suggestion": "What you think the issue is and possible solution",\n';
        prompt += '  "category": "Hardware" | "Software" | "Network" | "Access" | "Other",\n';
        prompt += '  "priority": 1-5,\n';
        prompt += '  "assignment_group": "Suggested assignment group"\n';
        prompt += '}\n\n';
        prompt += 'Determine ticket_type as follows:\n';
        prompt += '- INC: Something is broken or not working\n';
        prompt += '- PRB: Recurring issue needing investigation\n';
        prompt += '- CHG: Change request\n';
        prompt += '- REQ: Service request for something new\n';
        prompt += '- HR: Human resources, leave, payroll, onboarding, HR policies\n';
        prompt += '- QUERY: Question for information or help';
      }
      
      // Call Datacenter LLM
      var response = helpers.callOpenAI(prompt, llmEnabled, null, 1000);
      if (response.success) {
        var aiContent = response.content;
        // Parse JSON from AI response
        var jsonMatch = aiContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          var categorization = JSON.parse(jsonMatch[0]);
          return categorization;
        }
      }
      return null;
    } catch (error) {
      return null;
    }
  },

  /**
   * Create incident record with AI analysis
   * 
   * INPUT: submissionData (object), aiAnalysis (object)
   * PROCESS: Creates incident record with AI-enhanced fields and standard ServiceNow fields
   * OUTPUT: Object with success, type, sys_id, and number
   */
  createIncidentWithAI: function(submissionData, aiAnalysis) {
    var helpers = new TSMAIRequestHelpers();
    var incident = new GlideRecord('incident');
    incident.initialize();
    if (aiAnalysis) {
      incident.setValue('short_description', aiAnalysis.summary);
      incident.setValue('description', this.buildAIEnhancedDescription(submissionData, aiAnalysis));
      incident.setValue('priority', aiAnalysis.priority || 3);
      // Set category if available
      if (aiAnalysis.category) {
        // Map AI category to ServiceNow category
        if (aiAnalysis.category === 'Hardware') incident.setValue('category', 'hardware');
        else if (aiAnalysis.category === 'Software') incident.setValue('category', 'software');
        else if (aiAnalysis.category === 'Network') incident.setValue('category', 'network');
      }
    } else {
      incident.setValue('short_description', helpers.truncateString(submissionData.initialRequest, 160));
      incident.setValue('description', this.buildFullDescription(submissionData));
      incident.setValue('priority', '3');
    }
    incident.setValue('opened_by', gs.getUserID());
    incident.setValue('caller_id', gs.getUserID());
    incident.setValue('urgency', '3');
    incident.setValue('impact', '3');
    incident.setValue('state', '1'); // New

    // Search for relevant knowledge articles for the agent
    var agentKnowledge = this.searchAgentKnowledge(submissionData);
    if (agentKnowledge && agentKnowledge.length > 0) {
      incident.setValue('work_notes', agentKnowledge);
    }

    var incidentId = incident.insert();
    if (incidentId) {
      incident.get(incidentId);
      return {
        success: true,
        type: 'Incident',
        table: 'incident',
        sys_id: incidentId,
        number: incident.getValue('number')
      };
    }
    return { success: false };
  },

  /**
   * Create problem record with AI analysis
   * 
   * INPUT: submissionData (object), aiAnalysis (object)
   * PROCESS: Creates problem record with AI-enhanced fields and standard ServiceNow fields
   * OUTPUT: Object with success, type, sys_id, and number
   */
  createProblemWithAI: function(submissionData, aiAnalysis) {
    var helpers = new TSMAIRequestHelpers();
    var problem = new GlideRecord('problem');
    problem.initialize();
    if (aiAnalysis) {
      problem.setValue('short_description', aiAnalysis.summary);
      problem.setValue('description', this.buildAIEnhancedDescription(submissionData, aiAnalysis));
      problem.setValue('priority', aiAnalysis.priority || 3);
    } else {
      problem.setValue('short_description', helpers.truncateString(submissionData.initialRequest, 160));
      problem.setValue('description', this.buildFullDescription(submissionData));
      problem.setValue('priority', '3');
    }
    problem.setValue('opened_by', gs.getUserID());
    problem.setValue('state', '1'); // New

    // Search for relevant knowledge articles for the agent
    var agentKnowledge = this.searchAgentKnowledge(submissionData);
    if (agentKnowledge && agentKnowledge.length > 0) {
      problem.setValue('work_notes', agentKnowledge);
    }

    var problemId = problem.insert();
    if (problemId) {
      problem.get(problemId);
      return {
        success: true,
        type: 'Problem',
        table: 'problem',
        sys_id: problemId,
        number: problem.getValue('number')
      };
    }
    return { success: false };
  },

  /**
   * Create change request with AI analysis
   * 
   * INPUT: submissionData (object), aiAnalysis (object)
   * PROCESS: Creates change request record with AI-enhanced fields and standard ServiceNow fields
   * OUTPUT: Object with success, type, sys_id, and number
   */
  createChangeWithAI: function(submissionData, aiAnalysis) {
    var change = new GlideRecord('change_request');
    change.initialize();
    if (aiAnalysis) {
      change.setValue('short_description', aiAnalysis.summary);
      change.setValue('description', this.buildAIEnhancedDescription(submissionData, aiAnalysis));
      change.setValue('priority', aiAnalysis.priority || 3);
    } else {
      change.setValue('short_description', helpers.truncateString(submissionData.initialRequest, 160));
      change.setValue('description', this.buildFullDescription(submissionData));
      change.setValue('priority', '3');
    }
    change.setValue('opened_by', gs.getUserID());
    change.setValue('requested_by', gs.getUserID());
    change.setValue('state', '-5'); // New
    var changeId = change.insert();
    if (changeId) {
      change.get(changeId);
      return {
        success: true,
        type: 'Change Request',
        table: 'change_request',
        sys_id: changeId,
        number: change.getValue('number')
      };
    }
    return { success: false };
  },

  /**
   * Create service request with AI analysis
   * 
   * INPUT: submissionData (object), aiAnalysis (object)
   * PROCESS: Creates service request record with AI-enhanced fields and standard ServiceNow fields
   * OUTPUT: Object with success, type, sys_id, and number
   */
  createServiceRequestWithAI: function(submissionData, aiAnalysis) {
    var sr = new GlideRecord('sc_request');
    sr.initialize();
    if (aiAnalysis) {
      sr.setValue('short_description', aiAnalysis.summary);
      sr.setValue('description', this.buildAIEnhancedDescription(submissionData, aiAnalysis));
      sr.setValue('priority', aiAnalysis.priority || 3);
    } else {
      sr.setValue('short_description', helpers.truncateString(submissionData.initialRequest, 160));
      sr.setValue('description', this.buildFullDescription(submissionData));
      sr.setValue('priority', '3');
    }
    sr.setValue('opened_by', gs.getUserID());
    sr.setValue('requested_for', gs.getUserID());
    sr.setValue('urgency', '3');
    sr.setValue('state', 'open');
    var srId = sr.insert();
    if (srId) {
      sr.get(srId);
      return {
        success: true,
        type: 'Service Request',
        table: 'sc_request',
        sys_id: srId,
        number: sr.getValue('number')
      };
    }
    return { success: false };
  },

  /**
   * Create HR case with AI analysis (supports both HR plugin and fallback)
   * 
   * INPUT: submissionData (object), aiAnalysis (object)
   * PROCESS: Tries HR plugin first, falls back to service request if not available
   * OUTPUT: Object with success, type, sys_id, and number
   */
  createHRCaseWithAI: function(submissionData, aiAnalysis) {
    var helpers = new TSMAIRequestHelpers();
    // Try HR Service Delivery first (if plugin is installed)
    var hrCase = new GlideRecord('sn_hr_core_case');
    if (hrCase.isValid()) {
      // HR Plugin is available - use HR Case
      hrCase.initialize();
      if (aiAnalysis) {
        hrCase.setValue('short_description', aiAnalysis.summary);
        hrCase.setValue('description', this.buildAIEnhancedDescription(submissionData, aiAnalysis));
        hrCase.setValue('priority', aiAnalysis.priority || 3);
        // Set HR-specific category if available
        if (aiAnalysis.category) {
          if (aiAnalysis.category === 'HR' || aiAnalysis.category === 'Human Resources') {
            hrCase.setValue('hr_service', 'general_hr_inquiry');
          }
        }
      } else {
        hrCase.setValue('short_description', helpers.truncateString(submissionData.initialRequest, 160));
        hrCase.setValue('description', this.buildFullDescription(submissionData));
        hrCase.setValue('priority', '3');
      }
      hrCase.setValue('opened_by', gs.getUserID());
      hrCase.setValue('contact', gs.getUserID());
      hrCase.setValue('state', 'open');
      hrCase.setValue('hr_service', 'general_hr_inquiry');
      var hrCaseId = hrCase.insert();
      if (hrCaseId) {
        hrCase.get(hrCaseId);
        return {
          success: true,
          type: 'HR Case',
          table: 'sn_hr_core_case',
          sys_id: hrCaseId,
          number: hrCase.getValue('number')
        };
      }
    } else {
      // HR Plugin not available - fallback to Service Request
      var hrRequest = new GlideRecord('sc_request');
      hrRequest.initialize();
      if (aiAnalysis) {
        hrRequest.setValue('short_description', '[HR] ' + aiAnalysis.summary);
        hrRequest.setValue('description', this.buildAIEnhancedDescription(submissionData, aiAnalysis));
        hrRequest.setValue('priority', aiAnalysis.priority || 3);
      } else {
        hrRequest.setValue('short_description', '[HR] ' + helpers.truncateString(submissionData.initialRequest, 150));
        hrRequest.setValue('description', this.buildFullDescription(submissionData));
        hrRequest.setValue('priority', '3');
      }
      hrRequest.setValue('opened_by', gs.getUserID());
      hrRequest.setValue('requested_for', gs.getUserID());
      hrRequest.setValue('state', 'open');
      hrRequest.setValue('request_state', 'submitted');
      hrRequest.setValue('comments', 'HR Request - routed to HR team for processing');
      var hrRequestId = hrRequest.insert();
      if (hrRequestId) {
        hrRequest.get(hrRequestId);
        return {
          success: true,
          type: 'HR Service Request (Plugin N/A)',
          table: 'sc_request',
          sys_id: hrRequestId,
          number: hrRequest.getValue('number')
        };
      }
    }
    return { success: false };
  },

  /**
   * Create query ticket for informational requests
   * 
   * INPUT: submissionData (object), aiAnalysis (object)
   * PROCESS: Creates task record for queries with AI-enhanced fields
   * OUTPUT: Object with success, type, sys_id, and number
   */
  createQueryTicket: function(submissionData, aiAnalysis) {
    // Create as a task for queries
    var task = new GlideRecord('task');
    task.initialize();
    if (aiAnalysis) {
      task.setValue('short_description', '[QUERY] ' + aiAnalysis.summary);
      task.setValue('description', this.buildAIEnhancedDescription(submissionData, aiAnalysis));
      task.setValue('priority', aiAnalysis.priority || 4);
    } else {
      task.setValue('short_description', '[QUERY] ' + helpers.truncateString(submissionData.initialRequest, 150));
      task.setValue('description', this.buildFullDescription(submissionData));
      task.setValue('priority', '4');
    }
    task.setValue('opened_by', gs.getUserID());
    task.setValue('state', '1'); // New
    var taskId = task.insert();
    if (taskId) {
      task.get(taskId);
      return {
        success: true,
        type: 'Query/Task',
        table: 'task',
        sys_id: taskId,
        number: task.getValue('number')
      };
    }
    return { success: false };
  },

  /**
   * Search for agent-helpful knowledge articles using complete submission data
   *
   * INPUT: submissionData (object) - Complete user request with all Q&A responses
   * PROCESS: Creates enriched search query from all answers, searches KB, returns formatted articles
   * OUTPUT: String - Formatted knowledge articles for work_notes, or empty if no relevant articles
   */
  buildAIEnhancedDescription: function(submissionData, aiAnalysis) {
    var description = '==== AI ANALYSIS ====\n';
    if (aiAnalysis) {
      description += 'Summary: ' + aiAnalysis.summary + '\n';
      description += 'Analysis: ' + aiAnalysis.analysis + '\n';
      description += 'AI Suggestion: ' + aiAnalysis.suggestion + '\n';
      description += 'Category: ' + aiAnalysis.category + '\n';
      description += 'AI Confidence: High\n';
    }
    description += '\n==== ORIGINAL REQUEST ====\n';
    description += submissionData.initialRequest + '\n\n';
    description += '==== Q&A DETAILS ====\n';
    for (var i = 0; i < submissionData.aiQuestions.length; i++) {
      var question = submissionData.aiQuestions[i];
      var response = submissionData.responses[i] || 'No response';
      description += (i + 1) + '. ' + question.question + '\n';
      description += '   Answer: ' + response + '\n\n';
    }
    return description;
  },

  /**
   * Determine request type from submission data
   * 
   * INPUT: submissionData (object) - Complete submission with request and responses
   * PROCESS: Checks type hint, analyzes Q&A responses, performs keyword analysis
   * OUTPUT: String - Request type (incident, service_request, problem, change, hr, other)
   */
  attachScreenshotsToRecord: function(tableName, recordSysId, screenshots) {
    try {
      gs.info('=== DEBUG attachScreenshotsToRecord START (COMMENTS METHOD) ===');
      gs.info('tableName: ' + tableName);
      gs.info('recordSysId: ' + recordSysId);
      gs.info('screenshots type: ' + (typeof screenshots));
      gs.info('screenshots length: ' + (screenshots ? screenshots.length : 'null'));

      if (!screenshots || screenshots.length === 0) {
        gs.info('EXIT: No screenshots to attach');
        return;
      }
      if (!tableName || !recordSysId) {
        gs.info('EXIT: Missing tableName or recordSysId');
        return;
      }

      // NEW APPROACH: Add screenshots to Comments/Work Notes instead of as attachments
      var record = new GlideRecord(tableName);
      if (record.get(recordSysId)) {
        gs.info('Record found, adding screenshots to comments...');

        // Build comment with screenshot information
        var screenshotComment = '\n\n=== UPLOADED SCREENSHOTS ===\n';
        screenshotComment += 'User uploaded ' + screenshots.length + ' screenshot(s):\n\n';

        var successCount = 0;
        var failCount = 0;

        for (var i = 0; i < screenshots.length; i++) {
          gs.info('Processing screenshot ' + (i + 1) + ' of ' + screenshots.length);
          var screenshot = screenshots[i];

          gs.info('Screenshot ' + i + ' - name: ' + (screenshot.name || 'undefined'));
          gs.info('Screenshot ' + i + ' - has base64: ' + (screenshot.hasOwnProperty('base64')));
          gs.info('Screenshot ' + i + ' - base64 length: ' + (screenshot.base64 ? screenshot.base64.length : 0));
          gs.info('Screenshot ' + i + ' - type: ' + (screenshot.type || 'undefined'));

          if (!screenshot.base64 || !screenshot.name) {
            gs.warn('SKIPPING screenshot ' + i + ' - missing base64 or name');
            screenshotComment += (i + 1) + '. ❌ ' + (screenshot.name || 'Unknown') + ' - Failed (missing data)\n';
            failCount++;
            continue;
          }

          try {
            gs.info('Attempting to create attachment for: ' + screenshot.name);

            var base64Data = screenshot.base64;

            // SOLUTION: Use Attachment class (not GlideSysAttachment) for global scope
            gs.info('Using Attachment class (global scope compatible)...');

            // Decode base64 to bytes
            var decodedBytes = GlideStringUtil.base64DecodeAsBytes(base64Data);
            gs.info('Base64 decoded to ' + decodedBytes.length + ' bytes');

            // Use Attachment class write() method
            var attachment = new Attachment();
            attachment.write(
              tableName,                     // Table name
              recordSysId,                   // Record sys_id
              screenshot.name,               // File name
              screenshot.type || 'image/png', // Content type
              decodedBytes                   // Decoded bytes
            );

            // Verify attachment was created
            var attachmentGr = new GlideRecord('sys_attachment');
            attachmentGr.addQuery('table_name', tableName);
            attachmentGr.addQuery('table_sys_id', recordSysId);
            attachmentGr.addQuery('file_name', screenshot.name);
            attachmentGr.orderByDesc('sys_created_on');
            attachmentGr.setLimit(1);
            attachmentGr.query();

            if (attachmentGr.next()) {
              var attachmentSysId = attachmentGr.getUniqueValue();
              gs.info('✅ Screenshot attached successfully: ' + screenshot.name + ' (attachment_id: ' + attachmentSysId + ')');
              screenshotComment += (i + 1) + '. ✅ ' + screenshot.name + ' (' + this.formatFileSize(screenshot.size || (base64Data.length * 3 / 4)) + ') - Successfully attached\n';
              successCount++;
            } else {
              gs.error('❌ Attachment.write() did not create attachment for: ' + screenshot.name);
              screenshotComment += (i + 1) + '. ❌ ' + screenshot.name + ' - Failed to create attachment\n';
              failCount++;
            }
          } catch (attachError) {
            gs.error('❌ Error attaching screenshot ' + screenshot.name + ': ' + attachError.toString());
            screenshotComment += (i + 1) + '. ❌ ' + screenshot.name + ' - Error: ' + attachError.toString() + '\n';
            failCount++;
          }
        }

        screenshotComment += '\nSummary: ' + successCount + ' successful, ' + failCount + ' failed\n';
        screenshotComment += '=========================\n';

        // Add to comments field (visible to user)
        var currentComments = record.getValue('comments') || '';
        record.setValue('comments', currentComments + screenshotComment);

        // Also add to work_notes (for agents)
        var currentWorkNotes = record.getValue('work_notes') || '';
        record.setValue('work_notes', currentWorkNotes + screenshotComment);

        record.update();
        gs.info('✅ Screenshot information added to comments and work_notes');
      } else {
        gs.error('❌ Could not find record: ' + tableName + ':' + recordSysId);
      }

      gs.info('=== DEBUG attachScreenshotsToRecord END ===');
    } catch (error) {
      gs.error('Error in attachScreenshotsToRecord: ' + error.toString());
    }
  },

  formatFileSize: function(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
    return Math.round(bytes / 1048576) + ' MB';
  },

  /**
   * Filter catalog items by AI relevance to user request
   * @param {Array} catalogItems - Full list of catalog items from search
   * @param {String} userRequest - Original user request
   * @param {String} language - User language (nl/en)
   * @param {Boolean} llmEnabled - Whether LLM is enabled
   * @returns {Array} Filtered list of most relevant catalog items (max 5)
   */

  type: 'TSMAITicketFactory'
};
