/**
 * TSMAIClassifier - Request Classification Module
 *
 * PURPOSE: Classifies user requests into QUESTION, REQUEST, or INCIDENT
 * INPUT: User requests, language, LLM settings, optional screenshots
 * PROCESS: AI-based classification with keyword fallback
 * OUTPUT: Classification objects with type, confidence, and service request flag
 *
 * DEPENDENCIES: TSMAIRequestHelpers (for AI calls and language detection)
 */

var TSMAIClassifier = function() {};

TSMAIClassifier.prototype = {

  /**
   * Detect if request is for service catalog items
   *
   * INPUT: request (string), language (string)
   * PROCESS: Checks for service/catalog keywords in Dutch or English
   * OUTPUT: Boolean indicating if this is a service request
   */
  detectServiceRequestIntent: function(request, language) {
    var requestLower = request.toLowerCase();

    // Dutch service keywords
    var dutchKeywords = [
      'aanvragen', 'bestellen', 'order', 'service', 'catalog', 'catalogus',
      'nieuw', 'apparatuur', 'software', 'hardware', 'telefoon', 'laptop',
      'computer', 'toestemming', 'toegang', 'account', 'licentie', 'aanvraag',
      'iphone', 'ipad', 'macbook', 'monitor', 'toetsenbord', 'muis', 'headset'
    ];

    // English service keywords
    var englishKeywords = [
      'request', 'order', 'purchase', 'service', 'catalog', 'catalogue',
      'new', 'equipment', 'software', 'hardware', 'phone', 'laptop',
      'computer', 'permission', 'access', 'account', 'license', 'application',
      'iphone', 'ipad', 'macbook', 'monitor', 'keyboard', 'mouse', 'headset'
    ];

    var keywords = language === 'Dutch' ? dutchKeywords : englishKeywords;

    // Check if request contains any service keywords
    for (var i = 0; i < keywords.length; i++) {
      if (requestLower.indexOf(keywords[i]) >= 0) {
        return true;
      }
    }

    return false;
  },

  /**
   * Classify request using AI with screenshot analysis
   *
   * INPUT: request (string), language (string), llmEnabled (boolean), screenshots (array)
   * PROCESS: Uses AI to classify as QUESTION/REQUEST/INCIDENT, falls back to keywords
   * OUTPUT: Object with type, confidence, and isServiceRequest flag
   */
  classifyRequest: function(request, language, llmEnabled, screenshots) {
    try {
      var helpers = new TSMAIRequestHelpers();
      var prompt = '';

      // Add screenshot context if provided
      var screenshotContext = '';
      if (screenshots && screenshots.length > 0) {
        screenshotContext = language === 'Dutch'
          ? '\n\n De gebruiker heeft ' + screenshots.length + ' screenshot(s) bijgevoegd. Analyseer deze om de context te begrijpen.\n\n'
          : '\n\n The user has attached ' + screenshots.length + ' screenshot(s). Analyze these to understand the context.\n\n';
      }

      if (language === 'Dutch') {
        prompt = 'Classificeer deze aanvraag als QUESTION, REQUEST of INCIDENT.\n\n';
        prompt += 'QUESTION: Vragen die direct beantwoord kunnen worden\n';
        prompt += 'REQUEST: Aanvragen voor nieuwe diensten of apparatuur\n';
        prompt += 'INCIDENT: Problemen, storingen of iets dat niet werkt\n\n';
        prompt += 'Aanvraag: "' + request + '"\n';
        prompt += screenshotContext;
        prompt += '\nAntwoord alleen: QUESTION, REQUEST of INCIDENT';
      } else {
        prompt = 'Classify this request as QUESTION, REQUEST or INCIDENT.\n\n';
        prompt += 'QUESTION: Questions that can be answered directly\n';
        prompt += 'REQUEST: Requests for new services or equipment\n';
        prompt += 'INCIDENT: Problems, failures or something not working\n\n';
        prompt += 'Request: "' + request + '"\n';
        prompt += screenshotContext;
        prompt += '\nRespond only: QUESTION, REQUEST or INCIDENT';
      }

      var response = helpers.callOpenAI(prompt, llmEnabled, null, 50, screenshots);
      if (response.success) {
        var classification = response.content.trim().toUpperCase();

        // Parse LLM classification
        if (classification.indexOf('QUESTION') >= 0) {
          return { type: 'question', confidence: 'high', isServiceRequest: false };
        } else if (classification.indexOf('REQUEST') >= 0) {
          return { type: 'request', confidence: 'high', isServiceRequest: true };
        } else if (classification.indexOf('INCIDENT') >= 0) {
          return { type: 'incident', confidence: 'high', isServiceRequest: false };
        }

        // Fallback if LLM returns unexpected format
        return { type: 'incident', confidence: 'low', isServiceRequest: false };
      }

      // Fallback classification based on keywords
      var keywordClassification = this.classifyByKeywords(request, language);
      keywordClassification.isServiceRequest = this.detectServiceRequestIntent(request, language);
      return keywordClassification;
    } catch (error) {
      return { type: 'incident', confidence: 'low' };
    }
  },

  /**
   * Fallback keyword-based classification
   *
   * INPUT: request (string), language (string)
   * PROCESS: Analyzes question words and problem indicators
   * OUTPUT: Object with type, confidence, and isServiceRequest flag
   */
  classifyByKeywords: function(request, language) {
    var lowerRequest = request.toLowerCase();

    // Request/order indicators
    var requestWords = language === 'Dutch'
      ? ['aanvragen', 'bestellen', 'wil', 'nodig', 'aanvraag', 'order']
      : ['request', 'order', 'need', 'want', 'purchase'];

    var hasRequestWord = false;
    for (var r = 0; r < requestWords.length; r++) {
      if (lowerRequest.indexOf(requestWords[r]) >= 0) {
        hasRequestWord = true;
        break;
      }
    }

    // Simple question indicators
    var questionWords = language === 'Dutch'
      ? ['hoe', 'wat', 'waar', 'wanneer', 'waarom', 'wie', 'welke']
      : ['how', 'what', 'where', 'when', 'why', 'who', 'which'];

    var hasQuestionWord = false;
    for (var i = 0; i < questionWords.length; i++) {
      if (lowerRequest.indexOf(questionWords[i]) === 0) {
        hasQuestionWord = true;
        break;
      }
    }

    // Problem indicators
    var problemWords = language === 'Dutch'
      ? ['werkt niet', 'kapot', 'fout', 'probleem', 'error', 'kan niet', 'lukt niet']
      : ['not working', 'broken', 'error', 'problem', 'cannot', 'can\'t', 'unable', 'failed'];

    var hasProblemWord = false;
    for (var j = 0; j < problemWords.length; j++) {
      if (lowerRequest.indexOf(problemWords[j]) >= 0) {
        hasProblemWord = true;
        break;
      }
    }

    // Classify based on keywords
    if (hasRequestWord) {
      return { type: 'request', confidence: 'medium', isServiceRequest: true };
    } else if (hasQuestionWord && !hasProblemWord) {
      return { type: 'question', confidence: 'medium', isServiceRequest: false };
    } else {
      return { type: 'incident', confidence: 'medium', isServiceRequest: false };
    }
  },

  type: 'TSMAIClassifier'
};
