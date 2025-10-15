/**
 * AI Universal Request Handler - Main Widget Server Script
 *
 * REFACTORED: Now uses modular TSMAI architecture
 * - TSMAIRequestOrchestrator: Main coordinator
 * - Delegates to: StatusTracker, Classifier, SearchEngine, QuestionGenerator, TicketFactory, AgentCore
 *
 * INPUT: Widget initialization and user actions via input object
 * PROCESS: Routes actions to appropriate core functions via Script Includes
 * OUTPUT: Sets data object with results for client consumption
 */

var gr;

/**
 * Get user's system language from ServiceNow preferences
 * 
 * INPUT: None (uses current user session/preferences)
 * PROCESS: Checks session language first, then user preferences, defaults to English
 * OUTPUT: String - 'Dutch' or 'English'
 */
function getUserSystemLanguage() {
  try {
    // Try to get language from user session
    var sessionLang = gs.getSession().getLanguage();
    if (sessionLang) {
      return sessionLang.toLowerCase().indexOf('nl') >= 0 || sessionLang.toLowerCase().indexOf('dutch') >= 0 ? 'Dutch' : 'English';
    }
    // Fallback: get from user preferences
    var userLang = gs.getUser().getPreference('user.language');
    if (userLang) {
      return userLang.toLowerCase().indexOf('nl') >= 0 || userLang.toLowerCase().indexOf('dutch') >= 0 ? 'Dutch' : 'English';
    }
    // Default to English
    return 'English';
  } catch (error) {
    return 'English';
  }
}

// INITIALIZATION CODE WITH ERROR HANDLING
try {
  // Set user's system language for client
  data.userSystemLanguage = getUserSystemLanguage();
  data.isDutch = data.userSystemLanguage === 'Dutch';
  
  // Handle different actions
  if (input && input.action) {
    switch (input.action) {
      case 'generateResponse':
        /**
         * INPUT: input.initialRequest (string), input.requestTypeHint (string), input.sessionId (string), input.screenshots (array)
         * PROCESS: Calls AIRequestCore.generateIntelligentResponse() with sessionId for real-time status
         * OUTPUT: data.result with AI response and suggestions
         */
        data.result = new TSMAIRequestOrchestrator().generateIntelligentResponse(input.initialRequest, input.requestTypeHint, input.sessionId, input.screenshots);
        break;

      case 'getStatus':
        /**
         * INPUT: input.sessionId (string)
         * PROCESS: Retrieves real-time processing status from session storage
         * OUTPUT: data.result with current processing steps and status
         */
        var orchestrator = new TSMAIRequestOrchestrator();
        data.result = orchestrator.getStatus(input.sessionId);
        break;
        
      case 'generateQuestions':
        /**
         * INPUT: input.initialRequest (string), input.requestTypeHint (string) 
         * PROCESS: Calls AIRequestCore.generateQuestionsFromAI()
         * OUTPUT: data.result with dynamic questions array
         */
        data.result = new TSMAIRequestOrchestrator().generateQuestionsFromAI(input.initialRequest, input.requestTypeHint);
        break;
        
      case 'submitRequest':
        /**
         * INPUT: input.submissionData (JSON string with request details)
         * PROCESS: Parses JSON and calls AIRequestCore.submitUniversalRequest()
         * OUTPUT: data.result with created ticket information
         */
        data.result = new TSMAIRequestOrchestrator().submitUniversalRequest(JSON.parse(input.submissionData));
        break;
        
      case 'searchKnowledge':
        /**
         * INPUT: input.searchTerm (string)
         * PROCESS: Calls AIRequestCore.searchKnowledgeBase()
         * OUTPUT: data.result with knowledge base articles
         */
        data.result = new TSMAIRequestOrchestrator().searchKnowledgeBase(input.searchTerm);
        break;
        
      default:
        data.result = { success: false, error: 'Unknown action' };
    }
  }

} catch (error) {
  // Fallback data setup to prevent total failure
  data.userSystemLanguage = 'English';
  data.isDutch = false;
  data.error = error.toString();
  
  // Set error result for any actions
  if (input && input.action) {
    data.result = { 
      success: false, 
      error: 'Server script error: ' + error.toString(),
      classification: 'complex_issue',
      proceedToQuestions: true
    };
  }
}