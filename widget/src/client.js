api.controller = function($scope, $http, spUtil, $sce) {
  var c = this;
  // Initialize
  c.initialRequest = '';
  c.requestTypeHint = '';
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
  // Language detection from server (system language)
  c.isLanguageDutch = data.isDutch || false;
  // Trust HTML content for Angular binding
  c.trustAsHtml = function(html) {
    return $sce.trustAsHtml(html);
  };
  // New primary function - generates intelligent response first
  c.generateResponse = function() {
    if (!c.initialRequest.trim()) {
      var errorMsg = c.isLanguageDutch ? 'Beschrijf eerst uw aanvraag.' : 'Please describe your request first.';
      spUtil.addErrorMessage(errorMsg);
      return;
    }
    c.processing = true;
    c.processingMessage = c.isLanguageDutch ? 'AI analyseert uw aanvraag...' : 'AI is analyzing your request...';
    c.errorMessage = '';
    var requestData = {
      action: 'generateResponse',
      initialRequest: c.initialRequest,
      requestTypeHint: c.requestTypeHint
    };
    c.server.get(requestData).then(function(response) {
      c.processing = false;
      var serverData = response.data && response.data.result ? response.data.result : null;
      if (serverData && serverData.success) {
        // Language already set from system preferences
        c.responseType = serverData.classification;
        c.showResponse = true;
        // Handle enhanced knowledge sources with metadata
        c.knowledgeSources = serverData.knowledgeSources || [];
        c.hasKnowledgeSources = serverData.hasKnowledgeSources || false;
        c.showKnowledgeSources = c.hasKnowledgeSources;
        if (serverData.classification === 'simple_question') {
          // Simple question - show direct answer
          // Trust HTML content for proper rendering
          c.directAnswer = c.trustAsHtml(serverData.directAnswer);
          c.showTicketOption = false;
        } else if (serverData.classification === 'complex_issue') {
          // Complex issue - show suggestions
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
      requestTypeHint: c.requestTypeHint
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
      requestTypeHint: c.requestTypeHint,
      aiQuestions: c.aiQuestions,
      responses: c.responses,
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
    c.requestTypeHint = '';
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
    // Language detection from server (system language) - don't reset
    c.isLanguageDutch = data.isDutch || false;
  };
  c.clearError = function() {
    c.errorMessage = '';
  };
};