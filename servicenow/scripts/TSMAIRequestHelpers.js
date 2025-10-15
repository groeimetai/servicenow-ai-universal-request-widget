/**
 * TSM AI Request Helpers - Generic OpenAI Integration
 *
 * This Script Include provides generic OpenAI API integration for TSM AI modules.
 * No longer dependent on MID server or company-specific infrastructure.
 *
 * Configuration required:
 * - System Property: openai.api.key (your OpenAI API key)
 * - System Property: openai.api.model (default: gpt-5-nano-2025-08-07)
 *
 * DEPENDENCIES: None (pure ServiceNow + OpenAI REST API)
 *
 * @version 2.0.0 - Generic OpenAI implementation
 */
var TSMAIRequestHelpers = Class.create();
TSMAIRequestHelpers.prototype = {
  initialize: function() {
    // No initialization needed
  },

  /**
   * Call OpenAI API with the given prompt
   *
   * @param {string} prompt - The prompt to send to OpenAI
   * @param {boolean} llmEnabled - Flag to enable/disable LLM (ignored if API key not set)
   * @param {string} modelOverride - Optional model override (uses system property if not provided)
   * @param {number} maxTokens - Maximum tokens for completion
   * @returns {object} Response object with success flag and content
   */
  callOpenAI: function(prompt, llmEnabled, modelOverride, maxTokens) {
    try {
      // Get API key from system properties
      var apiKey = gs.getProperty('openai.api.key');

      // If no API key configured, return error
      if (!apiKey) {
        gs.warn('[TSMAIRequestHelpers] OpenAI API key not configured. Set system property: openai.api.key');
        return {
          success: false,
          error: 'OpenAI API key not configured'
        };
      }

      // If LLM explicitly disabled, return error
      if (llmEnabled === false) {
        return {
          success: false,
          error: 'LLM disabled'
        };
      }

      // Get model from system properties or use override
      var model = modelOverride || gs.getProperty('openai.api.model', 'gpt-5-nano-2025-08-07');

      // Create REST request
      var request = new sn_ws.RESTMessageV2();
      request.setEndpoint('https://api.openai.com/v1/chat/completions');
      request.setHttpMethod('POST');
      request.setRequestHeader('Authorization', 'Bearer ' + apiKey);
      request.setRequestHeader('Content-Type', 'application/json');

      // Build request body
      var requestBody = {
        model: model,
        messages: [{
          role: 'user',
          content: prompt
        }]
      };

      // Set temperature based on model
      if (model && model.indexOf('gpt-5') >= 0) {
        requestBody.temperature = 1; // gpt-5 models only support temperature 1
      } else {
        requestBody.temperature = 0.3; // other models can use lower temperature
      }

      // Set max tokens parameter based on model
      if (model && (model.indexOf('gpt-4o') >= 0 || model.indexOf('gpt-5') >= 0)) {
        requestBody.max_completion_tokens = maxTokens || 200;
      } else {
        requestBody.max_tokens = maxTokens || 200;
      }

      request.setRequestBody(JSON.stringify(requestBody));

      // Execute request
      var response = request.execute();
      var httpStatus = response.getStatusCode();
      var responseBody = response.getBody();

      // Log for debugging
      gs.debug('[TSMAIRequestHelpers] OpenAI API call - Status: ' + httpStatus);

      // Handle successful response
      if (httpStatus == 200) {
        var aiResponse = JSON.parse(responseBody);

        // Validate response structure
        if (aiResponse && aiResponse.choices && aiResponse.choices.length > 0) {
          var content = aiResponse.choices[0].message ? aiResponse.choices[0].message.content : '';

          return {
            success: true,
            content: content || ''
          };
        } else {
          gs.warn('[TSMAIRequestHelpers] Invalid API response structure');
          return {
            success: false,
            error: 'Invalid API response structure'
          };
        }
      }

      // Handle error responses
      gs.warn('[TSMAIRequestHelpers] OpenAI API error - Status: ' + httpStatus);
      if (responseBody) {
        try {
          var errorObj = JSON.parse(responseBody);
          if (errorObj.error && errorObj.error.message) {
            gs.error('[TSMAIRequestHelpers] OpenAI API Error: ' + errorObj.error.message);
            return { success: false, error: errorObj.error.message };
          }
        } catch (e) {
          gs.error('[TSMAIRequestHelpers] Could not parse error response: ' + e.message);
        }
      }

      return {
        success: false,
        error: 'HTTP ' + httpStatus + ' - Response: ' + (responseBody || 'No response body')
      };

    } catch (error) {
      gs.error('[TSMAIRequestHelpers] Exception calling OpenAI: ' + error.toString());
      return {
        success: false,
        error: error.toString()
      };
    }
  },

  /**
   * Parse JSON response from AI
   * Extracts JSON array from AI response text
   *
   * @param {string} content - AI response content
   * @returns {array|null} Parsed JSON array or null
   */
  parseJSONResponse: function(content) {
    try {
      // Try to extract JSON array from response
      var jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Try to extract JSON object from response
      var objMatch = content.match(/\{[\s\S]*\}/);
      if (objMatch) {
        return JSON.parse(objMatch[0]);
      }

      return null;
    } catch (error) {
      gs.warn('[TSMAIRequestHelpers] Failed to parse JSON from AI response: ' + error.message);
      return null;
    }
  },

  /**
   * Detect language from text
   * Simple language detection based on common words
   *
   * @param {string} text - Text to analyze
   * @returns {string} 'Dutch' or 'English'
   */
  detectLanguage: function(text) {
    var dutchWords = ['de', 'het', 'een', 'is', 'van', 'en', 'met', 'voor', 'niet', 'mijn', 'zijn', 'hebben', 'worden', 'kunnen', 'deze', 'maar', 'wat', 'hoe', 'waar', 'wanneer', 'waarom', 'ik', 'je', 'hij', 'zij', 'wij', 'jullie', 'u'];
    var englishWords = ['the', 'is', 'are', 'and', 'or', 'but', 'with', 'for', 'not', 'my', 'have', 'will', 'can', 'this', 'what', 'how', 'where', 'when', 'why', 'i', 'you', 'he', 'she', 'we', 'they'];

    var lowerText = text.toLowerCase();
    var dutchCount = 0;
    var englishCount = 0;

    // Count Dutch words
    for (var i = 0; i < dutchWords.length; i++) {
      if (lowerText.indexOf(' ' + dutchWords[i] + ' ') >= 0 ||
          lowerText.indexOf(dutchWords[i] + ' ') === 0 ||
          lowerText.indexOf(' ' + dutchWords[i]) === lowerText.length - dutchWords[i].length - 1) {
        dutchCount++;
      }
    }

    // Count English words
    for (var j = 0; j < englishWords.length; j++) {
      if (lowerText.indexOf(' ' + englishWords[j] + ' ') >= 0 ||
          lowerText.indexOf(englishWords[j] + ' ') === 0 ||
          lowerText.indexOf(' ' + englishWords[j]) === lowerText.length - englishWords[j].length - 1) {
        englishCount++;
      }
    }

    return dutchCount > englishCount ? 'Dutch' : 'English';
  },

  type: 'TSMAIRequestHelpers'
};
