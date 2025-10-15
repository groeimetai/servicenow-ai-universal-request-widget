api.controller = function($scope, $http, spUtil, $sce, $timeout) {
  var c = this;
  // Initialize
  c.initialRequest = '';
  // Request category removed - AI determines automatically
  c.aiQuestions = [];
  c.responses = [];
  c.checkboxResponses = [];
  c.showQuestions = false;
  c.processing = false;
  c.submitted = false;
  c.processingMessage = '';
  c.processingSteps = []; // Array of processing steps for real-time updates
  c.errorMessage = '';
  c.requestNumber = '';
  c.finalRequestType = '';
  c.createdRecordNumber = '';
  c.createdRecordType = '';
  // New response flow variables
  c.showResponse = false;
  c.directAnswer = '';
  c.suggestions = [];
  c.responseType = '';
  c.showTicketOption = false;
  c.suggestionsTriedResponse = '';
  // Knowledge base sources
  c.knowledgeSources = [];
  c.hasKnowledgeSources = false;
  c.showKnowledgeSources = false;
  // Language detection from server (system language) - with safe fallback
  c.isLanguageDutch = (typeof data !== 'undefined' && data.isDutch) || false;
  // Trust HTML content for Angular binding
  c.trustAsHtml = function(html) {
    return $sce.trustAsHtml(html);
  };

  // Screenshot handling
  c.screenshots = [];
  var MAX_SCREENSHOTS = 5;
  var MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

  // Trigger file input click
  c.triggerScreenshotUpload = function() {
    var fileInput = document.getElementById('screenshot-upload-questions');
    if (fileInput) {
      fileInput.click();
    }
  };

  // Handle screenshot upload
  c.handleScreenshotUpload = function(files) {
    if (!files || files.length === 0) return;

    // Check total count
    if (c.screenshots.length + files.length > MAX_SCREENSHOTS) {
      var errorMsg = c.isLanguageDutch
        ? 'Maximum ' + MAX_SCREENSHOTS + ' screenshots toegestaan'
        : 'Maximum ' + MAX_SCREENSHOTS + ' screenshots allowed';
      c.errorMessage = errorMsg;
      $scope.$apply();
      return;
    }

    // Process each file
    for (var i = 0; i < files.length; i++) {
      var file = files[i];

      // Validate file type
      if (!file.type.match('image.*')) {
        var typeError = c.isLanguageDutch
          ? 'Alleen afbeeldingen zijn toegestaan: ' + file.name
          : 'Only images are allowed: ' + file.name;
        c.errorMessage = typeError;
        continue;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        var sizeError = c.isLanguageDutch
          ? 'Bestand te groot (max 10MB): ' + file.name
          : 'File too large (max 10MB): ' + file.name;
        c.errorMessage = sizeError;
        continue;
      }

      // Read file as Data URL for preview and storage
      (function(currentFile) {
        var reader = new FileReader();
        reader.onload = function(e) {
          $scope.$apply(function() {
            c.screenshots.push({
              name: currentFile.name,
              size: currentFile.size,
              type: currentFile.type,
              dataUrl: e.target.result, // Full data URL with base64
              base64: e.target.result.split(',')[1] // Just the base64 data
            });
          });
        };
        reader.readAsDataURL(currentFile);
      })(file);
    }

    // Clear the file input for re-selection
    var fileInput = document.getElementById('screenshot-upload-questions');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  // Remove screenshot
  c.removeScreenshot = function(index) {
    c.screenshots.splice(index, 1);
  };

  // Format file size for display
  c.formatFileSize = function(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Status polling for real-time updates
  c.statusPolling = null;
  c.sessionId = null;

  // Add processing step for real-time updates
  c.addProcessingStep = function(message, status) {
    // Update existing or add new step
    var existingStep = null;
    for (var i = 0; i < c.processingSteps.length; i++) {
      if (c.processingSteps[i].message === message) {
        existingStep = c.processingSteps[i];
        break;
      }
    }

    if (existingStep) {
      existingStep.status = status;
    } else {
      c.processingSteps.push({
        message: message,
        status: status // 'active', 'completed', 'error'
      });
    }

    // Update main processing message to latest active step
    for (var j = c.processingSteps.length - 1; j >= 0; j--) {
      if (c.processingSteps[j].status === 'active') {
        c.processingMessage = c.processingSteps[j].message;
        break;
      }
    }
  };

  // Poll server for real-time status updates
  c.pollStatus = function() {
    if (!c.sessionId || !c.processing) {
      return;
    }

    c.server.get({
      action: 'getStatus',
      sessionId: c.sessionId
    }).then(function(response) {
      if (response.data && response.data.result && response.data.result.steps) {
        var steps = response.data.result.steps;

        // Update UI with real server status
        for (var i = 0; i < steps.length; i++) {
          var step = steps[i];
          c.addProcessingStep(step.message, step.status);
        }

        // Continue polling if still processing
        if (c.processing) {
          c.statusPolling = $timeout(function() {
            c.pollStatus();
          }, 500); // Poll every 500ms
        }
      }
    });
  };

  // Start status polling
  c.startStatusPolling = function(sessionId) {
    c.sessionId = sessionId;
    c.statusPolling = $timeout(function() {
      c.pollStatus();
    }, 500);
  };

  // Stop status polling
  c.stopStatusPolling = function() {
    if (c.statusPolling) {
      $timeout.cancel(c.statusPolling);
      c.statusPolling = null;
    }
  };
  // New primary function - generates intelligent response first
  c.generateResponse = function() {
    if (!c.initialRequest.trim()) {
      var errorMsg = c.isLanguageDutch ? 'Beschrijf eerst uw aanvraag.' : 'Please describe your request first.';
      spUtil.addErrorMessage(errorMsg);
      return;
    }
    c.processing = true;
    c.processingSteps = [];
    c.addProcessingStep(c.isLanguageDutch ? 'Verbinding maken met AI...' : 'Connecting to AI...', 'active');
    c.errorMessage = '';

    // Generate a unique session ID for this request
    if (!c.sessionId) {
      c.sessionId = 'session_' + new Date().getTime() + '_' + Math.random().toString(36).substr(2, 9);
    }

    var requestData = {
      action: 'generateResponse',
      initialRequest: c.initialRequest,
      requestTypeHint: '', // Always let AI determine the category
      sessionId: c.sessionId
      // Screenshots removed - vision API doesn't work, screenshots only used for ticket attachment
    };

    // Simulate intelligent status updates based on what we're doing
    // These are timed realistically based on actual ServiceNow processing times
    var updateSteps = function(classification) {
      if (!c.processing) return;

      // Step 1: Classification complete
      $timeout(function() {
        if (!c.processing) return;
        c.addProcessingStep(c.isLanguageDutch ? 'Verbinding maken met AI...' : 'Connecting to AI...', 'completed');
        c.addProcessingStep(c.isLanguageDutch ? 'AI analyseert uw aanvraag...' : 'AI is analyzing your request...', 'active');
      }, 300);

      // Step 2: Based on classification, show appropriate search
      $timeout(function() {
        if (!c.processing) return;
        c.addProcessingStep(c.isLanguageDutch ? 'AI analyseert uw aanvraag...' : 'AI is analyzing your request...', 'completed');

        // Dynamic based on actual classification
        if (classification === 'request') {
          c.addProcessingStep(c.isLanguageDutch ? 'Zoeken naar relevante services in de catalogus...' : 'Searching for relevant services in catalog...', 'active');
        } else if (classification === 'question') {
          c.addProcessingStep(c.isLanguageDutch ? 'Zoeken in kennisbank...' : 'Searching knowledge base...', 'active');
        } else {
          c.addProcessingStep(c.isLanguageDutch ? 'Analyseren van het probleem...' : 'Analyzing the issue...', 'active');
        }
      }, 800);

      // Step 3: Secondary search (AI agent decides to search more)
      $timeout(function() {
        if (!c.processing) return;

        if (classification === 'request') {
          c.addProcessingStep(c.isLanguageDutch ? 'Zoeken naar relevante services in de catalogus...' : 'Searching for relevant services in catalog...', 'completed');
          c.addProcessingStep(c.isLanguageDutch ? 'Kennisbank doorzoeken voor aanvullende informatie...' : 'Searching knowledge base for additional info...', 'active');
        } else if (classification === 'question') {
          c.addProcessingStep(c.isLanguageDutch ? 'Zoeken in kennisbank...' : 'Searching knowledge base...', 'completed');
          c.addProcessingStep(c.isLanguageDutch ? 'Controleren op gerelateerde services...' : 'Checking for related services...', 'active');
        } else {
          c.addProcessingStep(c.isLanguageDutch ? 'Analyseren van het probleem...' : 'Analyzing the issue...', 'completed');
          c.addProcessingStep(c.isLanguageDutch ? 'Zoeken naar oplossingen...' : 'Searching for solutions...', 'active');
        }
      }, 1400);

      // Step 4: Evaluation
      $timeout(function() {
        if (!c.processing) return;

        if (classification === 'request') {
          c.addProcessingStep(c.isLanguageDutch ? 'Kennisbank doorzoeken voor aanvullende informatie...' : 'Searching knowledge base for additional info...', 'completed');
        } else if (classification === 'question') {
          c.addProcessingStep(c.isLanguageDutch ? 'Controleren op gerelateerde services...' : 'Checking for related services...', 'completed');
        } else {
          c.addProcessingStep(c.isLanguageDutch ? 'Zoeken naar oplossingen...' : 'Searching for solutions...', 'completed');
        }

        c.addProcessingStep(c.isLanguageDutch ? 'Evalueren van gevonden resultaten...' : 'Evaluating found results...', 'active');
      }, 2000);

      // Step 5: Generating response
      $timeout(function() {
        if (!c.processing) return;
        c.addProcessingStep(c.isLanguageDutch ? 'Evalueren van gevonden resultaten...' : 'Evaluating found results...', 'completed');
        c.addProcessingStep(c.isLanguageDutch ? 'Beste antwoord genereren...' : 'Generating best response...', 'active');
      }, 2400);

      // Step 6: Complete
      $timeout(function() {
        if (!c.processing) return;
        c.addProcessingStep(c.isLanguageDutch ? 'Beste antwoord genereren...' : 'Generating best response...', 'completed');
      }, 2800);
    };

    // Make the request
    c.server.get(requestData).then(function(response) {
      var serverData = response.data && response.data.result ? response.data.result : null;

      // Mark processing complete after a slight delay
      $timeout(function() {
        c.processing = false;
      }, 3000);

      if (serverData && serverData.success) {
        // Start intelligent status updates based on actual classification
        updateSteps(serverData.classification);

        // Language already set from system preferences
        // Map server classification to template-compatible responseType
        if (serverData.classification === 'request') {
          c.responseType = 'service_request';
        } else if (serverData.classification === 'question') {
          c.responseType = 'simple_question';
        } else if (serverData.classification === 'incident') {
          c.responseType = 'incident';
        } else {
          c.responseType = serverData.classification;
        }
        c.showResponse = true;
        // Handle enhanced knowledge sources with metadata
        c.knowledgeSources = serverData.knowledgeSources || [];
        c.hasKnowledgeSources = serverData.hasKnowledgeSources || false;
        c.showKnowledgeSources = c.hasKnowledgeSources;

        // Handle catalog items similar to knowledge sources
        c.catalogItems = serverData.catalogItems || [];
        c.hasCatalogItems = serverData.hasCatalogItems || false;
        c.showCatalogItems = c.hasCatalogItems;
        if (serverData.classification === 'question') {
          // Question - show direct answer
          // Trust HTML content for proper rendering
          c.directAnswer = c.trustAsHtml(serverData.directAnswer);
          c.showTicketOption = false;
        } else if (serverData.classification === 'request') {
          // Request - show catalog items or proceed to questions
          c.directAnswer = c.trustAsHtml(serverData.directAnswer);
          c.showTicketOption = serverData.showTicketOption;
          if (serverData.proceedToQuestions && !c.hasCatalogItems) {
            c.proceedToQuestions();
            return;
          }
        } else if (serverData.classification === 'incident') {
          // Incident - show suggestions
          // Trust HTML content for each suggestion
          var rawSuggestions = serverData.suggestions || [];
          c.suggestions = [];
          for (var idx = 0; idx < rawSuggestions.length; idx++) {
            c.suggestions.push(c.trustAsHtml(rawSuggestions[idx]));
          }
          c.showTicketOption = serverData.showTicketOption;
          if (serverData.proceedToQuestions) {
            // Skip response phase, go directly to questions
            c.proceedToQuestions();
            return;
          }
        }
        c.errorMessage = '';

        // Use $timeout to ensure UI updates happen after digest cycle
        $timeout(function() {
          // Explicitly trigger digest if needed
          if ($scope.$root && !$scope.$root.$$phase) {
            $scope.$digest();
          }
        }, 0);
      } else {
        var errorMsg = c.isLanguageDutch ? 'Kon aanvraag niet analyseren. Probeer opnieuw.' : 'Failed to analyze request. Please try again.';
        if (serverData && serverData.error) {
          errorMsg = serverData.error;
        }
        c.errorMessage = errorMsg;
      }
    }).catch(function(error) {
      c.processing = false;
      c.errorMessage = c.isLanguageDutch ? 'Fout bij analyseren aanvraag. Probeer later opnieuw.' : 'Error analyzing request. Please try again later.';
    });
  };
  // Handle suggestions flow
  c.proceedToQuestions = function() {
    c.showResponse = false;
    c.generateQuestions();
  };
  c.handleSuggestionResponse = function(action) {
    c.suggestionsTriedResponse = action;
    if (action === 'resolved') {
      // User tried suggestions and no longer needs a ticket - close interaction
      c.handleResolvedIssue();
    } else if (action === 'proceed') {
      // User wants to proceed to create ticket - continue with question flow
      c.proceedToQuestions();
    } else {
      // Fallback for any other actions - proceed to questions
      c.proceedToQuestions();
    }
  };
  c.handleResolvedIssue = function() {
    // Hide suggestions and show success message
    c.showResponse = false;
    c.showQuestions = false;
    c.submitted = true;
    // Set success message details - use system language
    if (c.isLanguageDutch) {
      c.finalRequestType = 'Opgelost zonder ticket';
      c.createdRecordNumber = '';
      c.createdRecordType = 'Issue opgelost';
    } else {
      c.finalRequestType = 'Resolved without ticket';
      c.createdRecordNumber = '';
      c.createdRecordType = 'Issue resolved';
    }
    // Show success message
    var successMessage = c.isLanguageDutch ? 
      'Geweldig! Uw probleem is opgelost met behulp van de AI-suggesties.' : 
      'Great! Your issue has been resolved using the AI suggestions.';
    spUtil.addInfoMessage(successMessage);
    // Scroll to success message
    setTimeout(function() {
      var successElement = document.querySelector('.alert-success');
      if (successElement) {
        successElement.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };
  // Function to open knowledge base article with security validation
  c.openKnowledgeArticle = function(article) {
    if (article && article.url) {
      // Security Enhancement: Validate URL before opening
      if (c.isValidKnowledgeURL(article.url)) {
        window.open(article.url, '_blank', 'noopener,noreferrer');
      } else {
        // Optionally show user-friendly error message
        if (typeof spModal !== 'undefined') {
          var securityMsg = c.isLanguageDutch ? 
            'Beveiligingsmelding: Ongeldige artikel link gedetecteerd en geblokkeerd.' : 
            'Security Notice: Invalid article link detected and blocked.';
          spModal.alert(securityMsg);
        }
      }
    }
  };
  // Security Enhancement: Validate knowledge article URLs
  c.isValidKnowledgeURL = function(url) {
    if (!url || typeof url !== 'string') {
      return false;
    }
    // Must start with /kb_view.do
    if (url.indexOf('/kb_view.do?sysparm_article=') !== 0) {
      return false;
    }
    // Extract article parameter
    var articleParam = url.substring('/kb_view.do?sysparm_article='.length);
    // Article parameter should only contain safe characters
    if (!/^[A-Za-z0-9\-_]+$/.test(articleParam)) {
      return false;
    }
    // Additional length validation
    if (articleParam.length === 0 || articleParam.length > 50) {
      return false;
    }
    return true;
  };
  c.createTicketDirectly = function() {
    // For simple questions, user can still request a ticket
    c.showResponse = false;
    c.generateQuestions();
  };
  c.generateQuestions = function() {
    if (!c.initialRequest.trim()) {
      var errorMsg = c.isLanguageDutch ? 'Beschrijf eerst uw aanvraag.' : 'Please describe your request first.';
      spUtil.addErrorMessage(errorMsg);
      return;
    }
    c.processing = true;
    c.processingMessage = c.isLanguageDutch ? 'AI analyseert uw aanvraag en genereert relevante vragen...' : 'AI is analyzing your request and generating relevant questions...';
    c.errorMessage = '';
    // Call server-side function to generate questions
    var requestData = {
      action: 'generateQuestions',
      initialRequest: c.initialRequest,
      requestTypeHint: '' // Always let AI determine the category
    };
    c.server.get(requestData).then(function(response) {
      c.processing = false;
      // Check response structure
      if (!response) {
        c.errorMessage = 'No response from server';
        return;
      }
      // FIX: Server puts data in response.data.result, not response.data
      var serverData = response.data && response.data.result ? response.data.result : null;
      if (serverData && serverData.success) {
        var questions = serverData.questions;
        if (questions && questions.length > 0) {
          c.aiQuestions = questions;
          c.responses = [];
          c.checkboxResponses = [];
          // Initialize responses array
          for (var i = 0; i < c.aiQuestions.length; i++) {
            c.responses[i] = '';
            if (c.aiQuestions[i].type === 'checkbox') {
              c.checkboxResponses[i] = {};
            }
          }
          c.showQuestions = true;
          c.errorMessage = '';
          // Show message if using fallback questions
          if (serverData.usingFallback && serverData.message) {
            spUtil.addInfoMessage(serverData.message);
          }
          // Force digest cycle to update UI
          setTimeout(function() {
            $scope.$apply();
          }, 50);
        } else {
          c.errorMessage = c.isLanguageDutch ? 'Geen vragen ontvangen van server' : 'No questions received from server';
        }
      } else {
        var errorMsg = c.isLanguageDutch ? 'Kon geen vragen genereren. Probeer opnieuw.' : 'Failed to generate questions. Please try again.';
        if (serverData && serverData.error) {
          errorMsg = serverData.error;
        }
        c.errorMessage = errorMsg;
      }
    }).catch(function(error) {
      c.processing = false;
      c.errorMessage = c.isLanguageDutch ? 'Fout bij communiceren met server. Probeer later opnieuw.' : 'Error communicating with server. Please try again later.';
    });
  };
  c.updateCheckboxResponse = function(questionIndex) {
    var selectedOptions = [];
    var checkboxes = c.checkboxResponses[questionIndex];
    for (var option in checkboxes) {
      if (checkboxes[option]) {
        selectedOptions.push(option);
      }
    }
    c.responses[questionIndex] = selectedOptions.join(', ');
  };
  // Helper function to validate responses of different types
  function isValidResponse(response) {
    if (response === null || response === undefined) {
      return false;
    }
    if (typeof response === 'string') {
      return response.trim() !== '';
    }
    if (typeof response === 'number') {
      return true; // Numbers are always valid
    }
    if (typeof response === 'boolean') {
      return true; // Booleans are always valid
    }
    // For arrays (checkbox responses)
    if (Array.isArray && Array.isArray(response)) {
      return response.length > 0;
    }
    // Default: convert to string and check
    return String(response).trim() !== '';
  }
  c.submitRequest = function() {
    // Validate required fields
    var valid = true;
    for (var i = 0; i < c.aiQuestions.length; i++) {
      if (c.aiQuestions[i].required && !isValidResponse(c.responses[i])) {
        valid = false;
        break;
      }
    }
    if (!valid) {
      var errorMsg = c.isLanguageDutch ? 'Beantwoord alle verplichte vragen voordat u indient.' : 'Please answer all required questions before submitting.';
      spUtil.addErrorMessage(errorMsg);
      return;
    }
    c.processing = true;
    c.processingMessage = c.isLanguageDutch ? 'Uw aanvraag indienen en geschikte records aanmaken...' : 'Submitting your request and creating appropriate records...';
    // Prepare submission data
    var submissionData = {
      initialRequest: c.initialRequest,
      requestTypeHint: '', // Always let AI determine the category
      aiQuestions: c.aiQuestions,
      responses: c.responses,
      screenshots: c.screenshots, // Include screenshots for ticket attachment
      timestamp: new Date().toISOString()
    };
    c.server.get({
      action: 'submitRequest',
      submissionData: JSON.stringify(submissionData)
    }).then(function(response) {
      c.processing = false;
      // FIX: Same issue for submit - data is in response.data.result
      var serverData = response.data && response.data.result ? response.data.result : null;
      if (serverData && serverData.success) {
        c.submitted = true;
        c.requestNumber = serverData.requestNumber || '';
        c.finalRequestType = serverData.requestType || '';
        c.createdRecordNumber = serverData.createdRecordNumber || '';
        c.createdRecordType = serverData.createdRecordType || '';
        c.errorMessage = '';
        // Scroll to success message
        setTimeout(function() {
          var successElement = document.querySelector('.alert-success');
          if (successElement) {
            successElement.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
      } else {
        var errorMsg = c.isLanguageDutch ? 'Kon aanvraag niet indienen. Probeer opnieuw.' : 'Failed to submit request. Please try again.';
        if (serverData && serverData.error) {
          errorMsg = serverData.error;
        }
        c.errorMessage = errorMsg;
      }
    }).catch(function(error) {
      c.processing = false;
      c.errorMessage = c.isLanguageDutch ? 'Fout bij indienen aanvraag. Probeer later opnieuw.' : 'Error submitting request. Please try again later.';
    });
  };
  c.goBack = function() {
    c.showQuestions = false;
    c.responses = [];
    c.checkboxResponses = [];
    c.errorMessage = '';
  };
  c.resetForm = function() {
    c.initialRequest = '';
    // Request category removed - AI determines automatically
    c.aiQuestions = [];
    c.responses = [];
    c.checkboxResponses = [];
    c.showQuestions = false;
    c.processing = false;
    c.submitted = false;
    c.processingMessage = '';
    c.errorMessage = '';
    c.requestNumber = '';
    c.finalRequestType = '';
    c.createdRecordNumber = '';
    c.createdRecordType = '';
    // Reset new response flow variables
    c.showResponse = false;
    c.directAnswer = '';
    c.suggestions = [];
    c.responseType = '';
    c.showTicketOption = false;
    c.suggestionsTriedResponse = '';
    // Reset knowledge sources
    c.knowledgeSources = [];
    c.hasKnowledgeSources = false;
    c.showKnowledgeSources = false;
    // Language detection from server (system language) - don't reset, with safe fallback
    c.isLanguageDutch = (typeof data !== 'undefined' && data.isDutch) || false;
  };
  c.clearError = function() {
    c.errorMessage = '';
  };
};