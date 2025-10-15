/**
 * TSMAIQuestionGenerator - Dynamic Question Generation Module
 *
 * PURPOSE: Generate context-aware follow-up questions using AI
 * INPUT: Initial requests, request type hints, language
 * PROCESS: AI-driven question generation with fallback to defaults
 * OUTPUT: Structured question arrays with type, required, category
 *
 * DEPENDENCIES: TSMAIRequestHelpers (for AI calls and language detection)
 *
 * FUNCTIONS (4):
 * - generateQuestionsFromAI: Main AI question generation
 * - createQuestionGenerationPrompt: Build LLM prompts
 * - parseAIQuestions: Parse JSON responses
 * - getDefaultQuestions: Fallback questions
 */

var TSMAIQuestionGenerator = function() {};

TSMAIQuestionGenerator.prototype = {

  /**
   * Generate intelligent follow-up questions using AI
   *
   * INPUT: initialRequest (string), requestTypeHint (string)
   * PROCESS: Detects language, creates AI prompt, calls LLM, parses questions
   * OUTPUT: Object with success, questions array, language
   */
  generateQuestionsFromAI: function(initialRequest, requestTypeHint) {
    try {
      var helpers = new TSMAIRequestHelpers();
      // Detect language
      var detectedLanguage = helpers.detectLanguage(initialRequest);

      // Get Datacenter LLM configuration
      var llmEnabled = gs.getProperty('datacenter.llm.enabled');

      // TEMP FIX: Force enable LLM for testing
      var forceEnable = true;

      if (!forceEnable && (!llmEnabled || (llmEnabled !== 'true' && llmEnabled !== true))) {
        return {
          success: true,
          questions: this.getDefaultQuestions(detectedLanguage),
          usingFallback: true,
          message: detectedLanguage === 'Dutch' ? 'AI service niet beschikbaar, standaard vragen worden gebruikt' : 'AI service not available, using default questions'
        };
      }

      // Create AI prompt for question generation
      var prompt = this.createQuestionGenerationPrompt(initialRequest, requestTypeHint, detectedLanguage);

      // Call Datacenter LLM
      var response = helpers.callOpenAI(prompt, llmEnabled, null, 2000);
      if (response.success) {
        var aiContent = response.content;
        // Parse AI response to extract questions
        var questions = helpers.parseJSONResponse(aiContent);
        return {
          success: true,
          questions: questions || this.getDefaultQuestions(detectedLanguage),
          language: detectedLanguage
        };
      } else {
        // Fallback to default questions on API failure
        return {
          success: true,
          questions: this.getDefaultQuestions(detectedLanguage),
          usingFallback: true,
          message: detectedLanguage === 'Dutch' ? 'AI service tijdelijk niet beschikbaar, standaard vragen worden gebruikt' : 'AI service temporarily unavailable, using default questions',
          language: detectedLanguage
        };
      }
    } catch (error) {
      // Always return fallback questions instead of failing
      return {
        success: true,
        questions: this.getDefaultQuestions('English'),
        usingFallback: true,
        error: error.message,
        message: 'Using default questions due to technical issue'
      };
    }
  },

  /**
   * Create AI prompt for question generation
   *
   * INPUT: initialRequest (string), requestTypeHint (string), language (string)
   * PROCESS: Builds detailed prompt with context and examples
   * OUTPUT: String - Formatted AI prompt
   */
  createQuestionGenerationPrompt: function(initialRequest, requestTypeHint, language) {
    var prompt = '';
    if (language === 'Dutch') {
      prompt = 'Als ServiceNow AI assistent, analyseer deze aanvraag en genereer ALLEEN de essentiële vragen die nodig zijn om de aanvraag te kunnen afhandelen.\n\n';
      prompt += 'BELANGRIJK:\n';
      prompt += '- Genereer minimaal 1, maximaal 5 vragen\n';
      prompt += '- Alleen vragen die echt nodig zijn voor context\n';
      prompt += '- Pas vragen aan op basis van het type aanvraag\n';
      prompt += '- Voor simpele vragen: misschien maar 1-2 vragen\n';
      prompt += '- Voor complexe problemen: maximaal 5 vragen\n';
      prompt += '- Alle vragen in het Nederlands\n\n';
      prompt += 'Gebruikersaanvraag: "' + initialRequest + '"\n';
      if (requestTypeHint) {
        prompt += 'Type hint: ' + requestTypeHint + '\n';
      }
      prompt += '\nAnalyseer eerst wat voor type aanvraag dit is:\n';
      prompt += '- Als het een simpele vraag is: vraag alleen om verduidelijking indien nodig\n';
      prompt += '- Als het een incident is: focus op technische details en symptomen\n';
      prompt += '- Als het een service request is: focus op specifieke requirements\n';
      prompt += '- Als het een wijziging is: focus op risico en planning\n';
      prompt += '- Als het een HR vraag is: focus op personeelszaken, verlof, salaris, onboarding\n\n';
      prompt += 'Retourneer als JSON array. Voorbeeld:\n';
      prompt += '[\n';
      prompt += '  {\n';
      prompt += '    "question": "Wat gebeurt er precies wanneer u het probleem ondervindt?",\n';
      prompt += '    "type": "textarea",\n';
      prompt += '    "required": true,\n';
      prompt += '    "category": "details"\n';
      prompt += '  }\n';
      prompt += ']\n\n';
      prompt += 'Vraag types: text, textarea, select (met options), date, yesno';
    } else {
      // English prompt
      prompt = 'As a ServiceNow AI assistant, analyze this request and generate ONLY the essential questions needed to properly handle the request.\n\n';
      prompt += 'IMPORTANT:\n';
      prompt += '- Generate minimum 1, maximum 5 questions\n';
      prompt += '- Only questions truly needed for context\n';
      prompt += '- Adapt questions based on request type\n';
      prompt += '- For simple queries: maybe just 1-2 questions\n';
      prompt += '- For complex issues: maximum 5 questions\n\n';
      prompt += 'User Request: "' + initialRequest + '"\n';
      if (requestTypeHint) {
        prompt += 'Type hint: ' + requestTypeHint + '\n';
      }
      prompt += '\nFirst analyze what type of request this is:\n';
      prompt += '- If it\'s a simple question: only ask for clarification if needed\n';
      prompt += '- If it\'s an incident: focus on technical details and symptoms\n';
      prompt += '- If it\'s a service request: focus on specific requirements\n';
      prompt += '- If it\'s a change: focus on risk and planning\n';
      prompt += '- If it\'s an HR request: focus on human resources, leave, payroll, onboarding\n\n';
      prompt += 'Return as JSON array. Example:\n';
      prompt += '[\n';
      prompt += '  {\n';
      prompt += '    "question": "What exactly happens when you experience this problem?",\n';
      prompt += '    "type": "textarea",\n';
      prompt += '    "required": true,\n';
      prompt += '    "category": "details"\n';
      prompt += '  }\n';
      prompt += ']\n\n';
      prompt += 'Question types: text, textarea, select (with options), date, yesno';
    }
    return prompt;
  },

  /**
   * Parse AI-generated questions from JSON response
   *
   * INPUT: aiContent (string) - AI response containing JSON questions
   * PROCESS: Extracts JSON from response, parses to array, fallback to defaults
   * OUTPUT: Array - Parsed questions or default questions on failure
   */
  parseAIQuestions: function(aiContent) {
    try {
      // Try to extract JSON from AI response
      var jsonMatch = aiContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        var parsed = JSON.parse(jsonMatch[0]);
        return parsed;
      }
      // Fallback: create default questions
      return this.getDefaultQuestions('English');
    } catch (error) {
      return this.getDefaultQuestions('English');
    }
  },

  /**
   * Get default questions for fallback scenarios
   *
   * INPUT: language (string) - 'Dutch' or 'English'
   * PROCESS: Returns predefined question set based on language
   * OUTPUT: Array - Default question objects with type, required, placeholder, category
   */
  getDefaultQuestions: function(language) {
    if (language === 'Dutch') {
      return [
        {
          question: "Wanneer heeft u dit voor het eerst opgemerkt?",
          type: "text",
          required: true,
          placeholder: "bijv. Vanmorgen om 9 uur",
          category: "timeline"
        },
        {
          question: "Wat hebt u al geprobeerd om het op te lossen?",
          type: "textarea",
          required: false,
          placeholder: "bijv. Opnieuw opstarten, andere browser geprobeerd, etc.",
          category: "troubleshooting"
        }
      ];
    } else {
      return [
        {
          question: "When did you first notice this?",
          type: "text",
          required: true,
          placeholder: "e.g., This morning at 9 AM",
          category: "timeline"
        },
        {
          question: "What have you already tried to solve this?",
          type: "textarea",
          required: false,
          placeholder: "e.g., Restarted computer, tried different browser, etc.",
          category: "troubleshooting"
        }
      ];
    }
  },

  type: 'TSMAIQuestionGenerator'
};
