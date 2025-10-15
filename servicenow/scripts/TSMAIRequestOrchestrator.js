/**
 * TSMAIRequestOrchestrator - Main Coordination Module
 *
 * PURPOSE: Entry point and orchestration of all AI request processing
 * INPUT: Initial requests, submission data, session IDs, screenshots
 * PROCESS: Coordinates all modules to handle complete request lifecycle
 * OUTPUT: Intelligent responses, created tickets, comprehensive results
 *
 * DEPENDENCIES: ALL other TSMAI modules
 * - TSMAIStatusTracker: Status tracking
 * - TSMAIClassifier: Request classification
 * - TSMAISearchEngine: KB and catalog search
 * - TSMAIAgentCore: AI intelligence
 * - TSMAITicketFactory: Ticket creation
 * - TSMAIRequestHelpers: Utilities
 *
 * FUNCTIONS (4):
 * - generateIntelligentResponse: Main orchestration entry point
 * - submitUniversalRequest: Submit and create tickets
 * - determineRequestType: Detect ticket type
 * - buildFullDescription: Format descriptions
 */

var TSMAIRequestOrchestrator = function() {
  // Initialize all dependent modules
  this.statusTracker = new TSMAIStatusTracker();
  this.classifier = new TSMAIClassifier();
  this.searchEngine = new TSMAISearchEngine();
  this.agentCore = new TSMAIAgentCore();
  this.ticketFactory = new TSMAITicketFactory();
};

TSMAIRequestOrchestrator.prototype = {

  generateIntelligentResponse: function(initialRequest, requestTypeHint, sessionId, screenshots) {
    gs.info('=== AI Request Flow START === Request: "' + initialRequest + '"');

    try {
      var helpers = new TSMAIRequestHelpers();
      // Detect language
      var detectedLanguage = helpers.detectLanguage(initialRequest);

      // Process screenshots if provided
      var hasScreenshots = screenshots && screenshots.length > 0;

      // Initialize status tracker for real-time updates
      if (!sessionId) {
        sessionId = this.initStatusTracker();
      } else {
        this.initStatusTracker(sessionId);
      }

      // Get Datacenter LLM configuration
      var llmEnabled = gs.getProperty('datacenter.llm.enabled');

      // TEMP FIX: Force enable LLM for testing (property doesn't exist in your environment)
      var forceEnable = true; // Set to false when datacenter.llm.enabled property exists

      if (!forceEnable && (!llmEnabled || (llmEnabled !== 'true' && llmEnabled !== true))) {
        return {
          success: true,
          classification: 'incident',
          message: detectedLanguage === 'Dutch' ? 'AI service niet beschikbaar, ga door naar vragen' : 'AI service not available, proceeding to questions',
          proceedToQuestions: true,
          sessionId: sessionId
        };
      }

      // Create AI agent for intelligent resource searching
      var aiAgent = this.agentCore.createAIAgent(initialRequest, detectedLanguage, llmEnabled);

      // Step 1: Update status - Classifying request
      this.updateStatus('classifying', 'active', aiAgent.generateProgressUpdate('classifying', detectedLanguage));

      // Step 1: Classify the request to understand user intent (with screenshots if provided)
      var classification = this.classifier.classifyRequest(initialRequest, detectedLanguage, llmEnabled, screenshots);
      gs.info('Classification: ' + classification.type + ' (confidence: ' + classification.confidence + ')');

      this.updateStatus('classifying', 'completed', aiAgent.generateProgressUpdate('classifying', detectedLanguage));

      // Step 2: AI agent determines search strategy based on classification
      var searchPlan = aiAgent.determineSearchStrategy(classification, initialRequest, detectedLanguage);

      // Initialize results
      var relevantKnowledge = null;
      var relevantCatalogItems = null;

      // Step 3: Execute searches - Use unified search if enabled for better performance
      var useUnifiedSearch = gs.getProperty('ai.search.unified.enabled', 'true');

      if (useUnifiedSearch === 'true' && searchPlan.searchOrder.length > 1) {
        // UNIFIED SEARCH - Both KB and Catalog in ONE API call (MUCH faster!)
        this.updateStatus('searching_resources', 'active', aiAgent.generateProgressUpdate('searching_resources', detectedLanguage));

        // Extract search keywords for better catalog results
        var searchKeywords = this.searchEngine.extractSearchKeywords(initialRequest, detectedLanguage, llmEnabled);

        var unifiedResults = this.searchUnified(searchKeywords, detectedLanguage);

        // Log search results with AI filtering info
        var catalogLog = unifiedResults.originalCatalogCount
          ? (unifiedResults.totalCatalog || 0) + ' catalog items (AI filtered from ' + unifiedResults.originalCatalogCount + ')'
          : (unifiedResults.totalCatalog || 0) + ' catalog items';
        gs.info('Unified Search: Found ' + (unifiedResults.totalKnowledge || 0) + ' KB + ' + catalogLog);

        if (unifiedResults.success) {
          // Process knowledge articles
          if (unifiedResults.knowledgeArticles && unifiedResults.knowledgeArticles.length > 0) {
            relevantKnowledge = this.searchEngine.evaluateKnowledgeRelevance(
              initialRequest,
              { success: true, results: unifiedResults.knowledgeArticles },
              detectedLanguage,
              llmEnabled
            );
          }

          // Process catalog items
          if (unifiedResults.catalogItems && unifiedResults.catalogItems.length > 0) {
            relevantCatalogItems = { success: true, results: unifiedResults.catalogItems };
          }
        }

        this.updateStatus('searching_resources', 'completed', aiAgent.generateProgressUpdate('searching_resources', detectedLanguage));

      } else {
        // SEQUENTIAL SEARCH - Original behavior (fallback or when unified is disabled)
        for (var i = 0; i < searchPlan.searchOrder.length; i++) {
          var searchType = searchPlan.searchOrder[i];

          if (searchType === 'catalog') {
            // Update status - Searching catalog
            this.updateStatus('searching_catalog', 'active', aiAgent.generateProgressUpdate('searching_catalog', detectedLanguage));

            // Extract search keywords from request using AI
            var searchKeywords = this.searchEngine.extractSearchKeywords(initialRequest, detectedLanguage, llmEnabled);

            // Search catalog items with extracted keywords
            var catalogItems = this.searchServiceCatalog(searchKeywords, detectedLanguage);
            if (catalogItems && catalogItems.success && catalogItems.results && catalogItems.results.length > 0) {
              relevantCatalogItems = catalogItems;
            }

            // Update status - Catalog search completed
            this.updateStatus('searching_catalog', 'completed', aiAgent.generateProgressUpdate('searching_catalog', detectedLanguage));

            // AI decides if we should continue searching
            if (relevantCatalogItems && !aiAgent.needsAdditionalResources(relevantCatalogItems, 'catalog')) {
              // We have enough catalog items, can skip other searches if not critical
              if (classification.type === 'request') {
                break;
              }
            }
          } else if (searchType === 'knowledge') {
            // Update status - Searching knowledge base
            this.updateStatus('searching_knowledge', 'active', aiAgent.generateProgressUpdate('searching_knowledge', detectedLanguage));

            // Search knowledge base
            var knowledgeSources = this.searchKnowledgeBase(initialRequest);
            if (knowledgeSources.success && knowledgeSources.results && knowledgeSources.results.length > 0) {
              relevantKnowledge = this.searchEngine.evaluateKnowledgeRelevance(initialRequest, knowledgeSources, detectedLanguage, llmEnabled);
            }

            // Update status - Knowledge search completed
            this.updateStatus('searching_knowledge', 'completed', aiAgent.generateProgressUpdate('searching_knowledge', detectedLanguage));

            // AI decides if we should continue searching
            if (relevantKnowledge && relevantKnowledge.isRelevant && !aiAgent.needsAdditionalResources(relevantKnowledge, 'knowledge')) {
              // We have enough knowledge, can skip other searches if not critical
              if (classification.type === 'question') {
                break;
              }
            }
          }
        }
      }

      // Step 4: Update status - Evaluating results
      this.updateStatus('evaluating', 'active', aiAgent.generateProgressUpdate('evaluating', detectedLanguage));

      // Step 5: Update status - Generating response
      this.updateStatus('generating_response', 'active', aiAgent.generateProgressUpdate('generating_response', detectedLanguage));

      // Step 5: Generate response with relevant knowledge and catalog items
      if (classification.type === 'question') {
        // For simple questions, only use knowledge articles if they're ACTUALLY relevant
        // No forced inclusion of articles

        // Generate direct answer for simple questions with knowledge enhancement
        var directAnswer = this.agentCore.generateDirectAnswerWithKnowledge(initialRequest, detectedLanguage, llmEnabled, relevantKnowledge);

        // Final status update
        this.updateStatus('generating_response', 'completed', aiAgent.generateProgressUpdate('generating_response', detectedLanguage));

        // For simple questions, only show knowledge if articles were actually used in the answer
        var showKnowledge = false;
        var knowledgeToShow = [];
        if (relevantKnowledge && relevantKnowledge.isRelevant && relevantKnowledge.articles && relevantKnowledge.articles.length > 0) {
          // Check if the answer actually references the knowledge articles
          // If we have high-confidence relevant articles, include them
          if (relevantKnowledge.evaluation === 'SELECTIVE_MATCH' || relevantKnowledge.reason.indexOf('AI flagged') >= 0) {
            knowledgeToShow = relevantKnowledge.articles;
            showKnowledge = true;
            // Limit to max 3 articles for simple questions
            if (knowledgeToShow.length > 3) {
              knowledgeToShow = knowledgeToShow.slice(0, 3);
            }
          }
        }

        return {
          success: true,
          classification: 'question',
          directAnswer: directAnswer.answer,
          confidence: directAnswer.confidence,
          sessionId: sessionId,
          language: detectedLanguage,
          showTicketOption: false,
          knowledgeSources: showKnowledge ? knowledgeToShow : [],
          hasKnowledgeSources: showKnowledge,
          catalogItems: relevantCatalogItems ? relevantCatalogItems.results : [],
          hasCatalogItems: relevantCatalogItems && relevantCatalogItems.results && relevantCatalogItems.results.length > 0
        };
      } else if (classification.type === 'request') {
        // Final status update
        this.updateStatus('generating_response', 'completed', aiAgent.generateProgressUpdate('generating_response', detectedLanguage));

        // For service requests, show catalog items and a helpful message
        var serviceMessage = '';
        if (detectedLanguage === 'Dutch') {
          if (relevantCatalogItems && relevantCatalogItems.results && relevantCatalogItems.results.length > 0) {
            serviceMessage = '<p>Ik heb relevante service catalogus items gevonden die u direct kunt bestellen. Klik op de onderstaande items om ze te bestellen via de self-service portal.</p>';
          } else {
            serviceMessage = '<p>Voor uw aanvraag kunt u het beste een service request aanmaken. Vul de onderstaande vragen in zodat we uw aanvraag snel kunnen verwerken.</p>';
          }
        } else {
          if (relevantCatalogItems && relevantCatalogItems.results && relevantCatalogItems.results.length > 0) {
            serviceMessage = '<p>I found relevant service catalog items that you can order directly. Click on the items below to order them through the self-service portal.</p>';
          } else {
            serviceMessage = '<p>For your request, it\'s best to create a service request. Please answer the questions below so we can process your request quickly.</p>';
          }
        }

        // For service requests, NEVER show knowledge articles - only catalog items
        var showKnowledge = false;
        var knowledgeToShow = [];

        return {
          success: true,
          classification: 'request',
          directAnswer: serviceMessage,
          confidence: 'high',
          language: detectedLanguage,
          sessionId: sessionId,
          showTicketOption: !(relevantCatalogItems && relevantCatalogItems.results && relevantCatalogItems.results.length > 0),
          proceedToQuestions: !(relevantCatalogItems && relevantCatalogItems.results && relevantCatalogItems.results.length > 0),
          knowledgeSources: showKnowledge ? knowledgeToShow : [],
          hasKnowledgeSources: showKnowledge,
          catalogItems: relevantCatalogItems ? relevantCatalogItems.results : [],
          hasCatalogItems: relevantCatalogItems && relevantCatalogItems.results && relevantCatalogItems.results.length > 0
        };
      } else {
        // Final status update
        this.updateStatus('generating_response', 'completed', aiAgent.generateProgressUpdate('generating_response', detectedLanguage));

        // Generate suggestions for complex issues with knowledge enhancement
        var suggestions = this.agentCore.generateSuggestionsWithKnowledge(initialRequest, detectedLanguage, llmEnabled, relevantKnowledge);
        // For complex issues, ONLY show knowledge articles if they were actually used in suggestions
        // OR if they contain specific troubleshooting steps (not generic info)
        var showKnowledge = false;
        var knowledgeToShow = [];
        if (relevantKnowledge && relevantKnowledge.isRelevant && relevantKnowledge.articles && relevantKnowledge.articles.length > 0) {
          // Check if suggestions actually reference the knowledge articles
          var suggestionsText = (suggestions.suggestions || []).join(' ').toLowerCase();

          for (var k = 0; k < relevantKnowledge.articles.length; k++) {
            var article = relevantKnowledge.articles[k];
            var title = (article.title || '').toLowerCase();
            var snippet = (article.snippet || '').toLowerCase();

            // Check if article is a troubleshooting guide with actual steps
            var isTroubleshootingGuide =
              title.indexOf('troubleshoot') >= 0 ||
              title.indexOf('fix') >= 0 ||
              title.indexOf('solve') >= 0 ||
              title.indexOf('oplossen') >= 0 ||
              title.indexOf('fout') >= 0 ||
              title.indexOf('error') >= 0;

            // Check if article content appears in our suggestions (meaning it was used)
            var wasUsedInSuggestions = false;
            if (article.title) {
              // Check if article title or key concepts appear in suggestions
              var titleWords = article.title.split(' ');
              for (var w = 0; w < titleWords.length; w++) {
                if (titleWords[w].length > 4 && suggestionsText.indexOf(titleWords[w].toLowerCase()) >= 0) {
                  wasUsedInSuggestions = true;
                  break;
                }
              }
            }

            // Only include if it's a real troubleshooting guide OR was actually used in suggestions
            if (isTroubleshootingGuide || wasUsedInSuggestions) {
              knowledgeToShow.push(article);
              showKnowledge = true;
            }
          }

          // For complex issues, only show if we found actual troubleshooting articles
          // If no specific articles found, don't show the section at all
          if (knowledgeToShow.length === 0) {
            showKnowledge = false;
          } else if (knowledgeToShow.length > 3) {
            // Limit to max 3 most relevant articles for complex issues
            knowledgeToShow = knowledgeToShow.slice(0, 3);
          }
        }

        return {
          success: true,
          classification: 'incident',
          suggestions: suggestions.suggestions,
          confidence: suggestions.confidence,
          language: detectedLanguage,
          sessionId: sessionId,
          showTicketOption: true,
          proceedToQuestions: false,
          knowledgeSources: showKnowledge ? knowledgeToShow : [],
          hasKnowledgeSources: showKnowledge,
          catalogItems: relevantCatalogItems ? relevantCatalogItems.results : [],
          hasCatalogItems: relevantCatalogItems && relevantCatalogItems.results && relevantCatalogItems.results.length > 0
        };
      }
    } catch (error) {
      return {
        success: true,
        classification: 'incident',
        error: error.message,
        message: 'Technical issue occurred, proceeding to questions',
        proceedToQuestions: true
      };
    }
  },

  /**
   * Create an AI agent to make intelligent decisions about resource searching
   * Agentive approach: AI autonomously decides what to search and when
   */
  submitUniversalRequest: function(submissionData) {
    try {
      // DEBUG: Log screenshots in submissionData
      gs.info('=== DEBUG submitUniversalRequest ===');
      gs.info('submissionData has screenshots property: ' + (submissionData.hasOwnProperty('screenshots')));
      gs.info('submissionData.screenshots type: ' + (typeof submissionData.screenshots));
      gs.info('submissionData.screenshots is array: ' + (Array.isArray ? Array.isArray(submissionData.screenshots) : (submissionData.screenshots instanceof Array)));
      if (submissionData.screenshots) {
        gs.info('submissionData.screenshots.length: ' + submissionData.screenshots.length);
        if (submissionData.screenshots.length > 0) {
          gs.info('First screenshot has base64: ' + (submissionData.screenshots[0].hasOwnProperty('base64')));
          gs.info('First screenshot name: ' + (submissionData.screenshots[0].name || 'undefined'));
        }
      }

      var helpers = new TSMAIRequestHelpers();
      // Generate AI summary and categorization
      var aiAnalysis = this.ticketFactory.generateAISummaryAndCategorization(submissionData);
      var ticketType, summary, suggestion;

      if (aiAnalysis) {
        ticketType = aiAnalysis.ticket_type;
        summary = aiAnalysis.summary;
        suggestion = aiAnalysis.suggestion;
      } else {
        // Fallback to basic determination
        ticketType = this.determineRequestType(submissionData);
        summary = helpers.truncateString(submissionData.initialRequest, 160);
        suggestion = '';
      }
      
      // Create the appropriate record type based on AI analysis
      var createdRecord;
      switch (ticketType) {
        case 'INC':
          createdRecord = this.ticketFactory.createIncidentWithAI(submissionData, aiAnalysis);
          break;
        case 'PRB':
          createdRecord = this.ticketFactory.createProblemWithAI(submissionData, aiAnalysis);
          break;
        case 'CHG':
          createdRecord = this.ticketFactory.createChangeWithAI(submissionData, aiAnalysis);
          break;
        case 'REQ':
          createdRecord = this.ticketFactory.createServiceRequestWithAI(submissionData, aiAnalysis);
          break;
        case 'HR':
          createdRecord = this.ticketFactory.createHRCaseWithAI(submissionData, aiAnalysis);
          break;
        case 'QUERY':
        default:
          createdRecord = this.ticketFactory.createQueryTicket(submissionData, aiAnalysis);
          break;
      }
      
      if (createdRecord.success) {
        // DEBUG: Check all three conditions for screenshot attachment
        gs.info('=== DEBUG Attachment Condition Check ===');
        gs.info('createdRecord.success: ' + createdRecord.success);
        gs.info('submissionData.screenshots exists: ' + (submissionData.screenshots ? 'YES' : 'NO'));
        gs.info('submissionData.screenshots.length: ' + (submissionData.screenshots ? submissionData.screenshots.length : 'N/A'));
        gs.info('createdRecord.sys_id exists: ' + (createdRecord.sys_id ? 'YES' : 'NO'));
        gs.info('createdRecord.sys_id value: ' + (createdRecord.sys_id || 'NULL'));
        gs.info('createdRecord.table: ' + (createdRecord.table || 'NULL'));

        var condition1 = submissionData.screenshots;
        var condition2 = submissionData.screenshots && submissionData.screenshots.length > 0;
        var condition3 = createdRecord.sys_id;
        var allConditions = condition1 && condition2 && condition3;

        gs.info('Condition 1 (screenshots exists): ' + (condition1 ? 'TRUE' : 'FALSE'));
        gs.info('Condition 2 (screenshots.length > 0): ' + (condition2 ? 'TRUE' : 'FALSE'));
        gs.info('Condition 3 (sys_id exists): ' + (condition3 ? 'TRUE' : 'FALSE'));
        gs.info('ALL CONDITIONS MET: ' + (allConditions ? 'YES - WILL ATTACH' : 'NO - SKIPPING'));

        // Attach screenshots to the created record if provided
        if (submissionData.screenshots && submissionData.screenshots.length > 0 && createdRecord.sys_id) {
          gs.info('✅ CALLING attachScreenshotsToRecord with ' + submissionData.screenshots.length + ' screenshot(s) to ' + createdRecord.table + ':' + createdRecord.sys_id);
          this.ticketFactory.attachScreenshotsToRecord(createdRecord.table, createdRecord.sys_id, submissionData.screenshots);
          gs.info('✅ attachScreenshotsToRecord call completed');
        } else {
          gs.warn('❌ SKIPPING screenshot attachment - Condition failed!');
          gs.warn('   - Has screenshots: ' + (submissionData.screenshots ? 'YES' : 'NO'));
          gs.warn('   - Screenshots length: ' + (submissionData.screenshots ? submissionData.screenshots.length : 'N/A'));
          gs.warn('   - Has sys_id: ' + (createdRecord.sys_id ? 'YES (' + createdRecord.sys_id + ')' : 'NO'));
        }

        return {
          success: true,
          requestNumber: createdRecord.number,
          requestType: createdRecord.type,
          createdRecordNumber: createdRecord.number,
          createdRecordType: createdRecord.type,
          aiSummary: summary,
          aiSuggestion: suggestion
        };
      } else {
        return {
          success: false,
          error: 'Failed to create request record'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: 'Failed to submit request: ' + error.message
      };
    }
  },

  /**
   * Classify request as question, request, or incident
   *
   * INPUT: request (string), language (string), llmEnabled (boolean), screenshots (array)
   * PROCESS: Uses AI to classify request type, falls back to keyword analysis
   * OUTPUT: Object with type ('question', 'request', or 'incident') and confidence
   */
  determineRequestType: function(submissionData) {
    // Check if user provided hint
    if (submissionData.requestTypeHint) {
      return submissionData.requestTypeHint;
    }
    
    // Analyze responses to determine type
    var typeQuestion = null;
    for (var i = 0; i < submissionData.aiQuestions.length; i++) {
      if (submissionData.aiQuestions[i].category === 'type') {
        typeQuestion = submissionData.aiQuestions[i];
        break;
      }
    }
    
    if (typeQuestion) {
      var typeIndex = -1;
      for (var j = 0; j < submissionData.aiQuestions.length; j++) {
        if (submissionData.aiQuestions[j] === typeQuestion) {
          typeIndex = j;
          break;
        }
      }
      if (typeIndex >= 0) {
        var typeResponse = submissionData.responses[typeIndex];
        if (typeResponse) {
          if (typeResponse.indexOf('Incident') >= 0) return 'incident';
          if (typeResponse.indexOf('Service Request') >= 0 || typeResponse.indexOf('Service Aanvraag') >= 0) return 'request';
          if (typeResponse.indexOf('Problem') >= 0 || typeResponse.indexOf('Probleem') >= 0) return 'problem';
          if (typeResponse.indexOf('Change') >= 0 || typeResponse.indexOf('Wijziging') >= 0) return 'change';
          if (typeResponse.indexOf('HR') >= 0 || typeResponse.indexOf('Personeelszaken') >= 0 || typeResponse.indexOf('Human Resources') >= 0) return 'hr';
        }
      }
    }

    // Default analysis based on keywords
    var description = submissionData.initialRequest.toLowerCase();
    if (description.indexOf('broken') >= 0 || description.indexOf('error') >= 0 || description.indexOf('not working') >= 0 ||
        description.indexOf('kapot') >= 0 || description.indexOf('fout') >= 0 || description.indexOf('werkt niet') >= 0) {
      return 'incident';
    }
    if (description.indexOf('hr') >= 0 || description.indexOf('human resources') >= 0 || description.indexOf('personeelszaken') >= 0 ||
        description.indexOf('verlof') >= 0 || description.indexOf('leave') >= 0 || description.indexOf('payroll') >= 0 ||
        description.indexOf('salaris') >= 0 || description.indexOf('onboarding') >= 0 || description.indexOf('werknemer') >= 0 ||
        description.indexOf('employee') >= 0 || description.indexOf('vacation') >= 0 || description.indexOf('vakantie') >= 0) {
      return 'hr';
    }
    if (description.indexOf('need') >= 0 || description.indexOf('request') >= 0 || description.indexOf('access') >= 0 ||
        description.indexOf('nodig') >= 0 || description.indexOf('aanvraag') >= 0 || description.indexOf('toegang') >= 0) {
      return 'request';
    }
    return 'other';
  },

  /**
   * Build full description for tickets without AI analysis
   * 
   * INPUT: submissionData (object) - Complete submission with request and Q&A responses
   * PROCESS: Formats description with original request and Q&A responses
   * OUTPUT: String - Formatted description for ticket creation
   */
  buildFullDescription: function(submissionData) {
    var description = 'Original Request: ' + submissionData.initialRequest + '\n\n';
    description += 'AI-Powered Questions and Responses:\n';
    for (var i = 0; i < submissionData.aiQuestions.length; i++) {
      var question = submissionData.aiQuestions[i];
      var response = submissionData.responses[i] || 'No response';
      description += (i + 1) + '. ' + question.question + '\n';
      description += '   Answer: ' + response + '\n\n';
    }
    return description;
  },

  /**
   * Generate direct answer for simple questions (legacy compatibility)
   * 
   * INPUT: request (string), language (string), llmEnabled (boolean)
   * PROCESS: Creates basic AI prompt and generates direct answer without knowledge base
   * OUTPUT: Object with answer and confidence level
   */

  // ============================================
  // DELEGATE METHODS - Forward to appropriate modules
  // ============================================

  /**
   * Delegate to StatusTracker.getStatus
   */
  getStatus: function(sessionId) {
    return this.statusTracker.getStatus(sessionId);
  },

  /**
   * Delegate to StatusTracker.updateStatus
   */
  updateStatus: function(stepName, status, message) {
    return this.statusTracker.updateStatus(stepName, status, message);
  },

  /**
   * Delegate to StatusTracker.initStatusTracker
   */
  initStatusTracker: function(sessionId) {
    return this.statusTracker.initStatusTracker(sessionId);
  },

  /**
   * Delegate to QuestionGenerator.generateQuestionsFromAI
   */
  generateQuestionsFromAI: function(initialRequest, requestTypeHint) {
    return new TSMAIQuestionGenerator().generateQuestionsFromAI(initialRequest, requestTypeHint);
  },

  /**
   * Delegate to SearchEngine.searchKnowledgeBase
   */
  searchKnowledgeBase: function(searchTerm) {
    return this.searchEngine.searchKnowledgeBase(searchTerm);
  },

  /**
   * Delegate to SearchEngine.searchServiceCatalog
   */
  searchServiceCatalog: function(searchTerm, language) {
    return this.searchEngine.searchServiceCatalog(searchTerm, language);
  },

  /**
   * Delegate to SearchEngine.searchUnified
   */
  searchUnified: function(searchTerm, language) {
    return this.searchEngine.searchUnified(searchTerm, language);
  },

  type: 'TSMAIRequestOrchestrator'
};
