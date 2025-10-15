/**
 * TSMAISearchEngine - Unified Search Module
 *
 * PURPOSE: Comprehensive search across Knowledge Base and Service Catalog  
 * INPUT: Search terms, language, user requests
 * PROCESS: Contextual Search API + AI-based relevance filtering
 * OUTPUT: Filtered, ranked results from KB and Catalog
 *
 * DEPENDENCIES: TSMAIRequestHelpers (for AI calls)
 *
 * FUNCTIONS (10):
 * - searchUnified: Combined KB + Catalog search
 * - extractSearchKeywords: AI keyword extraction  
 * - searchServiceCatalog: Catalog-specific search
 * - fallbackCatalogSearch: GlideRecord fallback
 * - evaluateCatalogRelevance: Legacy stub
 * - searchKnowledgeBase: KB-specific search
 * - fallbackKnowledgeSearch: GlideRecord fallback
 * - evaluateKnowledgeRelevance: AI relevance evaluation
 * - searchAgentKnowledge: Agent-focused KB search
 * - filterCatalogItemsByRelevance: AI filtering
 */

var TSMAISearchEngine = function() {};

TSMAISearchEngine.prototype = {

  searchUnified: function(searchTerm, language) {
    try {
      if (!searchTerm || searchTerm.trim().length === 0) {
        return {
          success: false,
          knowledgeArticles: [],
          catalogItems: []
        };
      }

      // Try Contextual Search with existing Search Context
      try {
        var contextualSearch = new global.VAGlobalContextualSearchUtil();
        var searchContextId = '42bcdd733bc952105ac8944a85e45a64';

        // Search knowledge base with Search Context
        // API signature: search(searchContextId, searchTerm, knowledgeBaseId)
        var kbResponse = contextualSearch.search(searchContextId, searchTerm, null);

        // Search catalog items with Search Context
        var catalogResponse = contextualSearch.search(searchContextId, searchTerm, null);

        // Process KB results with security check
        var knowledgeArticles = [];
        if (kbResponse && kbResponse.results) {
          var kbResults = kbResponse.results;
          for (var i = 0; i < kbResults.length; i++) {
            var result = kbResults[i];

            // Parse table name and sys_id from id field: "kb_knowledge:abc123 ➚" or "sc_cat_item:abc123 ➚"
            var sys_id = '';
            var tableName = 'kb_knowledge';
            if (result.id) {
              var idParts = result.id.split(':');
              if (idParts.length > 1) {
                tableName = idParts[0]; // Get the actual table name
                sys_id = idParts[1].split(' ')[0]; // Remove ➚ symbol
              }
            }

            // Security Check: Verify user has access to this KB article
            if (sys_id && tableName) {
              var kbCheck = new GlideRecord(tableName);
              if (kbCheck.get(sys_id)) {
                // canRead() checks ACLs - only include if user has access
                if (!kbCheck.canRead()) {
                  gs.info('Security Filter: Excluding KB article (no access): ' + result.title + ' [' + tableName + ':' + sys_id + ']');
                  continue; // Skip this article
                }
              } else {
                gs.warn('Security Filter: KB article not found in table ' + tableName + ': ' + sys_id);
                continue; // Skip if article doesn't exist
              }
            }

            knowledgeArticles.push({
              sys_id: sys_id,
              number: result.number || result.meta.number || '',
              title: result.title || result.short_description || '',
              snippet: result.snippet || result.text || '',
              content_preview: result.snippet || result.text || '',
              url: result.link || ('/kb_view.do?sys_kb_id=' + sys_id),
              relevance_score: result.meta ? result.meta.score : (result.score || 100),
              workflow_state: result.workflow_state || (result.meta ? result.meta.state : 'published'),
              kb_category: result.kb_category || (result.meta ? result.meta.category : ''),
              view_count: result.sys_view_count || (result.meta ? result.meta.viewCount : 0),
              helpful_count: result.useful_count || 0
            });
          }
        }

        // Process Catalog results
        var catalogItems = [];
        if (catalogResponse && catalogResponse.results) {
          var catResults = catalogResponse.results;
          for (var j = 0; j < catResults.length; j++) {
            var catResult = catResults[j];

            // Parse table name and sys_id from id field: "sc_cat_item:abc123 ➚"
            var cat_sys_id = '';
            var catTableName = 'sc_cat_item';
            if (catResult.id) {
              var catIdParts = catResult.id.split(':');
              if (catIdParts.length > 1) {
                catTableName = catIdParts[0]; // Get the actual table name
                cat_sys_id = catIdParts[1].split(' ')[0]; // Remove ➚ symbol
              }
            }

            // Security Check: Verify user has access to this catalog item
            if (cat_sys_id && catTableName) {
              var catCheck = new GlideRecord(catTableName);
              if (catCheck.get(cat_sys_id)) {
                // canRead() checks ACLs - only include if user has access
                if (!catCheck.canRead()) {
                  gs.info('Security Filter: Excluding catalog item (no access): ' + catResult.title + ' [' + catTableName + ':' + cat_sys_id + ']');
                  continue; // Skip this catalog item
                }
              } else {
                gs.warn('Security Filter: Catalog item not found in table ' + catTableName + ': ' + cat_sys_id);
                continue; // Skip if item doesn't exist
              }
            }

            var description = catResult.snippet || catResult.short_description || '';
            var truncatedDescription = description;
            if (description.length > 80) {
              truncatedDescription = description.substring(0, 77) + '...';
            }

            // Always use Service Portal URL format, not classic UI
            var portalUrl = '/esc?id=sc_cat_item&sys_id=' + cat_sys_id;

            catalogItems.push({
              sys_id: cat_sys_id,
              name: catResult.title || '',
              description: truncatedDescription,
              fullDescription: description,
              category: catResult.meta ? catResult.meta.category : '',
              price: catResult.meta ? catResult.meta.price : '',
              relevance_score: catResult.meta ? catResult.meta.score : 100,
              link: portalUrl,
              portal_url: portalUrl,
              order_url: portalUrl
            });
          }
        }

        // AI Filter: Let AI analyze and select only TRULY relevant catalog items
        var filteredCatalogItems = this.filterCatalogItemsByRelevance(
          catalogItems,
          searchTerm,
          language,
          true  // AI filtering always enabled
        );

        return {
          success: true,
          knowledgeArticles: knowledgeArticles,
          catalogItems: filteredCatalogItems,
          searchMethod: 'unified_contextual_search',
          totalKnowledge: knowledgeArticles.length,
          totalCatalog: filteredCatalogItems.length,
          originalCatalogCount: catalogItems.length,
          filteredCatalogCount: filteredCatalogItems.length
        };

      } catch (contextualError) {
        gs.warn('Unified Contextual Search failed: ' + contextualError.toString() + ', using separate fallback searches');
        // Fall through to fallback
      }

      // Fallback: Use separate searches
      var kbFallbackResults = this.searchKnowledgeBase(searchTerm);
      var catalogFallbackResults = this.searchServiceCatalog(searchTerm, language);

      // AI Filter fallback catalog items as well
      var fallbackCatalogItems = catalogFallbackResults.results || [];
      var filteredFallbackItems = this.filterCatalogItemsByRelevance(
        fallbackCatalogItems,
        searchTerm,
        language,
        true  // AI filtering always enabled
      );

      return {
        success: true,
        knowledgeArticles: kbFallbackResults.results || [],
        catalogItems: filteredFallbackItems,
        searchMethod: 'fallback_separate_searches',
        totalKnowledge: (kbFallbackResults.results || []).length,
        totalCatalog: filteredFallbackItems.length,
        originalCatalogCount: fallbackCatalogItems.length,
        filteredCatalogCount: filteredFallbackItems.length
      };

    } catch (error) {
      gs.error('Unified Search error: ' + error.toString());

      // Additional fallback in case of any errors
      return {
        success: false,
        knowledgeArticles: [],
        catalogItems: [],
        searchMethod: 'error_fallback'
      };
    }
  },

  /**
   * Extract search keywords from natural language request
   *
   * INPUT: request (string), language (string), llmEnabled (boolean)
   * PROCESS: Uses LLM to extract relevant product/service keywords for catalog search
   * OUTPUT: String - optimized search keywords
   */
  extractSearchKeywords: function(request, language, llmEnabled) {
    try {
      var helpers = new TSMAIRequestHelpers();

      // Build LLM prompt to extract keywords
      var prompt = '';
      if (language === 'Dutch') {
        prompt = 'Extraheer alleen de belangrijkste zoektermen uit deze aanvraag voor een service catalogus zoekopdracht.\n\n';
        prompt += 'Aanvraag: "' + request + '"\n\n';
        prompt += 'Geef ALLEEN de zoektermen terug, zonder uitleg. Bijvoorbeeld:\n';
        prompt += '- "Ik wil een laptop bestellen" → "laptop"\n';
        prompt += '- "Ik heb een nieuwe iPhone nodig" → "iPhone"\n';
        prompt += '- "Kan ik een monitor aanvragen voor thuiswerken" → "monitor thuiswerken"\n\n';
        prompt += 'Zoektermen:';
      } else {
        prompt = 'Extract only the key search terms from this request for a service catalog search.\n\n';
        prompt += 'Request: "' + request + '"\n\n';
        prompt += 'Return ONLY the search terms, without explanation. For example:\n';
        prompt += '- "I want to order a laptop" → "laptop"\n';
        prompt += '- "I need a new iPhone" → "iPhone"\n';
        prompt += '- "Can I request a monitor for working from home" → "monitor home office"\n\n';
        prompt += 'Search terms:';
      }

      var response = helpers.callOpenAI(prompt, llmEnabled, null, 50);
      if (response.success) {
        var keywords = response.content.trim();
        // Clean up any quotes or extra formatting
        keywords = keywords.replace(/['"]/g, '');
        return keywords || request; // Fallback to original request if empty
      }

      // Fallback: return original request
      return request;
    } catch (error) {
      // On error, return original request
      return request;
    }
  },

  /**
   * Search Service Catalog using ServiceNow Contextual Search API
   *
   * INPUT: searchTerm (string), language (string - optional)
   * PROCESS: Uses native ServiceNow Contextual Search with automatic user context
   * OUTPUT: Object with success, results array, searchMethod
   *
   * BENEFITS:
   * - Automatic user location/department/company filtering
   * - Respects catalog item availability and visibility
   * - ML-based relevancy ranking
   * - Single API call instead of multiple catalog queries
   * - User criteria and entitlement filtering
   */
  searchServiceCatalog: function(searchTerm, language) {
    try {
      if (!searchTerm || searchTerm.trim().length === 0) {
        return { success: false, results: [] };
      }

      // Try Contextual Search with existing Search Context
      try {
        gs.info('DEBUG: Starting Contextual Search for catalog with term: ' + searchTerm);

        var contextualSearch = new global.VAGlobalContextualSearchUtil();
        var searchContextId = '42bcdd733bc952105ac8944a85e45a64';

        // API signature: search(searchContextId, searchTerm, knowledgeBaseId)
        var response = contextualSearch.search(searchContextId, searchTerm, null);

        gs.info('DEBUG: VAGlobalContextualSearch completed, response: ' + JSON.stringify(response));

        if (response && response.results && response.results.length > 0) {
          // Process Contextual Search results
          var catalogItems = [];
          var results = response.results;

          for (var i = 0; i < results.length; i++) {
            var result = results[i];
            var description = result.short_description || result.description || '';
            var truncatedDescription = description;
            if (description.length > 80) {
              truncatedDescription = description.substring(0, 77) + '...';
            }

            catalogItems.push({
              sys_id: result.sys_id || '',
              name: result.name || result.title || '',
              description: truncatedDescription,
              fullDescription: description,
              category: result.category || '',
              price: result.price || '',
              relevance_score: result.score || 100,
              link: result.url || ('/esc?id=sc_cat_item&sys_id=' + result.sys_id),
              portal_url: result.url || ('/esc?id=sc_cat_item&sys_id=' + result.sys_id),
              order_url: result.url || ('/esc?id=sc_cat_item&sys_id=' + result.sys_id)
            });
          }

          return {
            success: true,
            results: catalogItems,
            searchMethod: 'contextual_search',
            totalResults: catalogItems.length
          };
        }

        // No results from Contextual Search - use fallback
        gs.info('Contextual Search returned no results, using fallback');
        return this.fallbackCatalogSearch(searchTerm);

      } catch (contextualError) {
        gs.warn('Contextual Search failed: ' + contextualError.toString() + ', using GlideRecord fallback');
        return this.fallbackCatalogSearch(searchTerm);
      }

    } catch (error) {
      gs.error('Catalog search error: ' + error.toString());
      return this.fallbackCatalogSearch(searchTerm);
    }
  },

  /**
   * Fallback catalog search using GlideRecord (if Contextual Search unavailable)
   */
  fallbackCatalogSearch: function(searchTerm) {
    try {
      var catalogItems = [];
      var catalogItem = new GlideRecord('sc_cat_item');
      catalogItem.addQuery('active', true);

      // Simple CONTAINS search on name and description
      var condition = catalogItem.addQuery('name', 'CONTAINS', searchTerm);
      condition.addOrCondition('short_description', 'CONTAINS', searchTerm);
      condition.addOrCondition('description', 'CONTAINS', searchTerm);

      catalogItem.orderByDesc('sys_view_count');
      catalogItem.setLimit(10);
      catalogItem.query();

      while (catalogItem.next()) {
        var description = catalogItem.getValue('short_description') || catalogItem.getValue('description') || '';
        var truncatedDescription = description;
        if (description.length > 80) {
          truncatedDescription = description.substring(0, 77) + '...';
        }

        catalogItems.push({
          sys_id: catalogItem.getValue('sys_id'),
          name: catalogItem.getValue('name'),
          description: truncatedDescription,
          fullDescription: description,
          category: catalogItem.getDisplayValue('category'),
          price: catalogItem.getValue('price'),
          relevance_score: 50,
          link: '/esc?id=sc_cat_item&sys_id=' + catalogItem.getValue('sys_id'),
          portal_url: '/esc?id=sc_cat_item&sys_id=' + catalogItem.getValue('sys_id'),
          order_url: '/esc?id=sc_cat_item&sys_id=' + catalogItem.getValue('sys_id')
        });
      }

      return {
        success: true,
        results: catalogItems,
        searchMethod: 'fallback_gliderecord'
      };
    } catch (error) {
      return {
        success: false,
        error: error.toString(),
        results: []
      };
    }
  },

  /**
   * [REMOVED - Now using Contextual Search API]
   * Old functions generateCatalogSearchQueries, performCatalogSearch,
   * and evaluateCatalogRelevance have been removed in favor of
   * searchServiceCatalog() with Contextual Search API
   */

  /**
   * [LEGACY COMPATIBILITY STUB]
   * Evaluate catalog item relevance - kept for backwards compatibility
   *
   * INPUT: catalogResults (array)
   * PROCESS: Simple passthrough - Contextual Search already provides relevancy
   * OUTPUT: Object with relevant items array
   */
  evaluateCatalogRelevance: function(catalogResults) {
    // Contextual Search already provides ML-based relevancy ranking
    // This function is kept only for backwards compatibility
    // Simply return all results as they're already sorted by relevance
    try {
      if (!catalogResults || catalogResults.length === 0) {
        return { isRelevant: false, items: [] };
      }

      // Contextual Search results are already sorted by relevance score
      // No need for additional AI evaluation
      return {
        isRelevant: true,
        items: catalogResults
      };

    } catch (error) {
      return {
        isRelevant: false,
        items: []
      };
    }
  },

  /**
   * Search knowledge base using intelligent LLM-driven queries
   *
   * INPUT: searchTerm (string)
   * PROCESS: Uses LLM to generate multiple search queries like a real user would
   * OUTPUT: Object with success boolean and results array of KB articles
   */
  /**
   * Search Knowledge Base using ServiceNow Contextual Search API
   *
   * INPUT: searchTerm (string) - User's search query
   * PROCESS: Uses native ServiceNow Contextual Search with automatic user context
   * OUTPUT: Object with success, results array, searchMethod
   *
   * BENEFITS:
   * - Automatic user permissions and visibility filtering
   * - Machine learning-based relevancy ranking
   * - Single API call instead of 30+ database queries
   * - Semantic matching and click-through optimization
   */
  searchKnowledgeBase: function(searchTerm) {
    try {
      if (!searchTerm || searchTerm.trim().length === 0) {
        return { success: false, results: [] };
      }

      // Use ServiceNow Contextual Search API
      // This automatically handles:
      // - User permissions (can_read_user_criteria)
      // - Knowledge base visibility
      // - User location/department/company filtering
      // - Published/approved article filtering
      // - ML-based relevancy ranking
      var searchAPI = new sn_cs.ContextualSearch();

      var searchConfig = {
        term: searchTerm,
        sources: 'kb_knowledge', // Only knowledge articles
        limit: 10,
        include_facets: false,
        include_more_like_this: false
      };

      var searchResults = searchAPI.search(searchConfig);

      // Parse Contextual Search results
      var articles = [];
      if (searchResults && searchResults.results) {
        var results = searchResults.results;

        for (var i = 0; i < results.length; i++) {
          var result = results[i];

          // Extract article data from Contextual Search result
          articles.push({
            sys_id: result.sys_id || '',
            number: result.number || '',
            title: result.title || result.short_description || '',
            snippet: result.snippet || result.text || '',
            content_preview: result.snippet || result.text || '',
            url: result.url || ('/kb_view.do?sys_kb_id=' + result.sys_id),
            relevance_score: result.score || 100, // Contextual Search provides ML-based score
            workflow_state: result.workflow_state || 'published',
            kb_category: result.kb_category || '',
            view_count: result.sys_view_count || 0,
            helpful_count: result.useful_count || 0
          });
        }
      }

      return {
        success: true,
        results: articles,
        searchMethod: 'contextual_search',
        totalResults: searchResults.total || articles.length
      };

    } catch (error) {
      gs.error('Contextual Search error: ' + error.toString());

      // Fallback to basic GlideRecord search if Contextual Search fails
      return this.fallbackKnowledgeSearch(searchTerm);
    }
  },

  /**
   * Fallback knowledge search using GlideRecord (if Contextual Search unavailable)
   */
  fallbackKnowledgeSearch: function(searchTerm) {
    try {
      var articles = [];
      var kb = new GlideRecord('kb_knowledge');
      kb.addActiveQuery();
      kb.addQuery('workflow_state', 'published');

      // Simple CONTAINS search on title and text
      var condition = kb.addQuery('short_description', 'CONTAINS', searchTerm);
      condition.addOrCondition('text', 'CONTAINS', searchTerm);

      kb.orderByDesc('sys_view_count');
      kb.setLimit(10);
      kb.query();

      while (kb.next()) {
        articles.push({
          sys_id: kb.getValue('sys_id'),
          number: kb.getValue('number'),
          title: kb.getValue('short_description'),
          snippet: kb.getValue('text').substring(0, 200) + '...',
          content_preview: kb.getValue('text').substring(0, 200) + '...',
          url: '/kb_view.do?sys_kb_id=' + kb.getValue('sys_id'),
          relevance_score: 50,
          workflow_state: kb.getValue('workflow_state')
        });
      }

      return {
        success: true,
        results: articles,
        searchMethod: 'fallback_gliderecord'
      };
    } catch (error) {
      return {
        success: false,
        error: error.toString(),
        results: []
      };
    }
  },

  /**
   * [REMOVED - Now using Contextual Search API]
   * generateIntelligentSearchQueries() has been removed in favor of
   * searchKnowledgeBase() with Contextual Search API which provides
   * superior ML-based semantic matching without needing multiple queries
   */

  /**
   * Generate AI questions based on initial request
   * 
   * INPUT: initialRequest (string), requestTypeHint (string)
   * PROCESS: Detects language, creates AI prompt, calls LLM, parses questions
   * OUTPUT: Object with success boolean, questions array, language
   */
  evaluateKnowledgeRelevance: function(userQuestion, knowledgeResults, language, llmEnabled) {
    try {
      if (!knowledgeResults.success || !knowledgeResults.results || knowledgeResults.results.length === 0) {
        return { isRelevant: false, articles: [], reason: 'No articles found' };
      }

      // Create helper instance
      var helpers = new TSMAIRequestHelpers();

      // SPECIAL CASE: Check if user is asking for a specific KB article by name/number
      var questionLower = userQuestion.toLowerCase();
      var isAskingForSpecificArticle =
        questionLower.indexOf('kb') >= 0 ||
        questionLower.indexOf('knowledge') >= 0 ||
        questionLower.indexOf('artikel') >= 0 ||
        questionLower.indexOf('article') >= 0;

      if (isAskingForSpecificArticle) {
        // Check if any article title closely matches the question
        for (var idx = 0; idx < knowledgeResults.results.length; idx++) {
          var article = knowledgeResults.results[idx];
          var titleLower = (article.title || '').toLowerCase();

          // Check if significant parts of the title appear in the question
          var titleWords = titleLower.split(' ').filter(function(w) { return w.length > 2; });
          var matchingWords = 0;
          for (var tw = 0; tw < titleWords.length; tw++) {
            if (questionLower.indexOf(titleWords[tw]) >= 0) {
              matchingWords++;
            }
          }

          // If 70% or more of title words are in the question, it's a match
          if (matchingWords >= Math.max(1, titleWords.length * 0.7)) {
            return {
              isRelevant: true,
              articles: knowledgeResults.results,
              reason: 'User asking for specific article by name',
              evaluation: 'TITLE_MATCH'
            };
          }
        }
      }
      
      // Create summary of found articles for AI evaluation
      var articlesSummary = '';
      var articlesToEvaluate = Math.min(5, knowledgeResults.results.length);
      for (var i = 0; i < articlesToEvaluate; i++) {
        var article = knowledgeResults.results[i];
        articlesSummary += 'Article ' + (i + 1) + ': ' + article.title;
        if (article.content_preview) {
          articlesSummary += ' - ' + article.content_preview.substring(0, 200);
        }
        articlesSummary += '\n';
      }
      
      // Ask AI to evaluate EACH article individually
      var prompt = '';
      if (language === 'Dutch') {
        prompt = 'Evalueer INDIVIDUEEL welke Knowledge Base artikelen relevant zijn voor de gebruikersvraag.\n\n';
        prompt += 'Gebruikersvraag: "' + userQuestion + '"\n\n';
        prompt += 'Gevonden artikelen:\n' + articlesSummary + '\n\n';
        prompt += 'INSTRUCTIES:\n';
        prompt += '- Evalueer ELK artikel afzonderlijk\n';
        prompt += '- Geef voor elk artikel nummer aan of het relevant is\n';
        prompt += '- Een artikel is relevant als:\n';
        prompt += '  * Het gaat over hetzelfde onderwerp of probleem\n';
        prompt += '  * Het bevat nuttige informatie voor de vraag\n';
        prompt += '  * Het beschrijft een gerelateerde procedure\n';
        prompt += '- Een artikel is NIET relevant als:\n';
        prompt += '  * Het gaat over iets totaal anders\n';
        prompt += '  * Er geen logische connectie is met de vraag\n\n';
        prompt += 'Retourneer een JSON array met alleen de nummers van RELEVANTE artikelen.\n';
        prompt += 'Bijvoorbeeld: [1, 3, 4] betekent artikel 1, 3 en 4 zijn relevant.\n';
        prompt += 'Als GEEN artikelen relevant zijn, retourneer: []';
      } else {
        prompt = 'Evaluate INDIVIDUALLY which Knowledge Base articles are relevant to the user question.\n\n';
        prompt += 'User question: "' + userQuestion + '"\n\n';
        prompt += 'Found articles:\n' + articlesSummary + '\n\n';
        prompt += 'INSTRUCTIONS:\n';
        prompt += '- Evaluate EACH article separately\n';
        prompt += '- Indicate for each article number if it is relevant\n';
        prompt += '- An article is relevant if:\n';
        prompt += '  * It is about the same topic or problem\n';
        prompt += '  * It contains useful information for the question\n';
        prompt += '  * It describes a related procedure\n';
        prompt += '- An article is NOT relevant if:\n';
        prompt += '  * It is about something completely different\n';
        prompt += '  * There is no logical connection to the question\n\n';
        prompt += 'Return a JSON array with only the numbers of RELEVANT articles.\n';
        prompt += 'For example: [1, 3, 4] means articles 1, 3, and 4 are relevant.\n';
        prompt += 'If NO articles are relevant, return: []';
      }

      var response = helpers.callOpenAI(prompt, llmEnabled, null, 100);
      if (response.success) {
        // Parse the response to get relevant article numbers
        var relevantNumbers = helpers.parseJSONResponse(response.content);

        if (relevantNumbers && Array.isArray(relevantNumbers) && relevantNumbers.length > 0) {
          // Filter to only include the relevant articles
          var relevantArticles = [];
          for (var n = 0; n < relevantNumbers.length; n++) {
            var articleNum = relevantNumbers[n];
            if (articleNum > 0 && articleNum <= articlesToEvaluate) {
              relevantArticles.push(knowledgeResults.results[articleNum - 1]);
            }
          }

          if (relevantArticles.length > 0) {
            return {
              isRelevant: true,
              articles: relevantArticles,
              reason: 'AI flagged ' + relevantArticles.length + ' articles as relevant',
              evaluation: 'SELECTIVE_MATCH'
            };
          }
        }

        // No relevant articles found
        return {
          isRelevant: false,
          articles: [],
          reason: 'AI determined none of the articles are relevant',
          evaluation: 'NO_MATCH'
        };
      }
      
      // Fallback: if AI evaluation fails, use SELECTIVE keyword matching
      var questionWords = userQuestion.toLowerCase().split(' ');
      // Filter out common stop words but keep important shorter words
      var meaningfulWords = [];
      var stopWords = ['the', 'de', 'het', 'een', 'a', 'an', 'is', 'are', 'van', 'voor', 'met', 'and', 'or', 'of'];

      for (var i = 0; i < questionWords.length; i++) {
        var word = questionWords[i];
        // Keep words that are 3+ chars OR not in stop words (allows important short words)
        if ((word.length >= 3 || stopWords.indexOf(word) === -1) && word.length > 1) {
          meaningfulWords.push(word);
        }
      }

      // Score each article and only keep the best matches
      var scoredArticles = [];
      for (var j = 0; j < knowledgeResults.results.length; j++) {
        var article = knowledgeResults.results[j];
        var articleTitle = (article.title || '').toLowerCase();
        var articleContent = (article.content_preview || '').toLowerCase();

        // Calculate relevance score
        var score = 0;

        // Title matches are worth more points
        for (var m = 0; m < meaningfulWords.length; m++) {
          if (articleTitle.indexOf(meaningfulWords[m]) >= 0) {
            score += 3; // Title match = 3 points
          }
          if (articleContent.indexOf(meaningfulWords[m]) >= 0) {
            score += 1; // Content match = 1 point
          }
        }

        // Only keep articles with meaningful scores
        // Require at least 2 title word matches OR 3+ total points
        var minTitleMatches = Math.max(2, Math.ceil(meaningfulWords.length * 0.5));
        var minTotalScore = Math.max(3, meaningfulWords.length);

        if (score >= minTotalScore) {
          article.relevance_score = score;
          scoredArticles.push(article);
        }
      }

      // Sort by score and take only the top relevant ones
      scoredArticles.sort(function(a, b) {
        return (b.relevance_score || 0) - (a.relevance_score || 0);
      });

      // Take only articles that score at least 50% of the top score
      var relevantArticles = [];
      if (scoredArticles.length > 0) {
        var topScore = scoredArticles[0].relevance_score;
        var minScore = topScore * 0.5;

        for (var sa = 0; sa < scoredArticles.length && sa < 5; sa++) {
          if (scoredArticles[sa].relevance_score >= minScore) {
            relevantArticles.push(scoredArticles[sa]);
          }
        }
      }
      
      if (relevantArticles.length > 0) {
        return {
          isRelevant: true,
          articles: relevantArticles,
          reason: 'Fallback keyword matching found relevant articles'
        };
      } else {
        return {
          isRelevant: false,
          articles: [],
          reason: 'No relevant articles found through keyword matching'
        };
      }
    } catch (error) {
      return {
        isRelevant: false,
        articles: [],
        reason: 'Error during relevance evaluation: ' + error.message
      };
    }
  },

  /**
   * Search service catalog items using intelligent LLM-driven queries
   *
   * INPUT: searchTerm (string), language (string)
   * PROCESS: Uses LLM to generate search queries and finds relevant catalog items
   * OUTPUT: Object with success boolean and results array of catalog items
   */
  /**
   * UNIFIED SEARCH - Search both Knowledge Base AND Service Catalog in ONE call
   *
   * INPUT: searchTerm (string), language (string - optional)
   * PROCESS: Uses Contextual Search to search both KB and Catalog simultaneously
   * OUTPUT: Object with knowledgeArticles and catalogItems arrays
   *
   * BENEFITS:
   * - Single API call for both resources (even faster!)
   * - Consistent user context across both searches
   * - Combined relevancy ranking
   * - Optimal for initial response generation
   */
  searchAgentKnowledge: function(submissionData) {
    try {
      // Build comprehensive search query from all available information
      var searchQuery = submissionData.initialRequest;

      // Add all user responses to enhance search specificity
      if (submissionData.responses && submissionData.responses.length > 0) {
        for (var i = 0; i < submissionData.responses.length; i++) {
          if (submissionData.responses[i] && submissionData.responses[i].trim().length > 0) {
            searchQuery += ' ' + submissionData.responses[i];
          }
        }
      }

      // Search knowledge base with enriched query
      var knowledgeResults = this.searchKnowledgeBase(searchQuery);

      if (!knowledgeResults.success || !knowledgeResults.results || knowledgeResults.results.length === 0) {
        return ''; // No articles found
      }

      // Format articles for work_notes
      var workNotes = '==== RELATED KNOWLEDGE ARTICLES FOR AGENT ====\n';
      workNotes += 'The following knowledge base articles may help resolve this issue:\n\n';

      // Include top 3 most relevant articles
      var maxArticles = Math.min(3, knowledgeResults.results.length);
      for (var j = 0; j < maxArticles; j++) {
        var article = knowledgeResults.results[j];
        workNotes += (j + 1) + '. ' + article.title + '\n';
        workNotes += '   Article: ' + article.number + '\n';
        workNotes += '   URL: ' + article.url + '\n';
        workNotes += '   Summary: ' + article.snippet + '\n\n';
      }

      workNotes += 'These articles were automatically found based on the user\'s detailed request.\n';

      return workNotes;
    } catch (error) {
      gs.error('Error searching agent knowledge: ' + error.toString());
      return ''; // Return empty string on error
    }
  },

  /**
   * Build AI-enhanced description for tickets
   *
   * INPUT: submissionData (object), aiAnalysis (object)
   * PROCESS: Formats structured description with AI analysis, original request, and Q&A
   * OUTPUT: String - Formatted description with AI analysis sections
   */
  filterCatalogItemsByRelevance: function(catalogItems, userRequest, language, llmEnabled) {
    try {
      // If no items, return empty
      if (!catalogItems || catalogItems.length === 0) {
        return catalogItems;
      }

      // If 3 or fewer items, no need to filter
      if (catalogItems.length <= 3) {
        return catalogItems;
      }

      gs.info('AI Filtering: Analyzing ' + catalogItems.length + ' catalog items for relevance');

      // Build prompt for LLM to analyze relevance
      var itemList = '';
      for (var i = 0; i < catalogItems.length; i++) {
        var item = catalogItems[i];
        itemList += (i + 1) + '. ' + item.name;
        if (item.description) {
          itemList += ' - ' + item.description;
        }
        itemList += '\n';
      }

      var prompt = language === 'nl'
        ? 'Gebruiker vraagt: "' + userRequest + '"\n\nWelke van deze Service Catalog items zijn ECHT relevant voor deze vraag? Geef alleen de nummers van de meest relevante items (max 5), gescheiden door komma\'s.\n\nBeschikbare items:\n' + itemList + '\n\nAntwoord met alleen nummers (bijv: 1,3,5):'
        : 'User asks: "' + userRequest + '"\n\nWhich of these Service Catalog items are REALLY relevant to this request? Give only the numbers of the most relevant items (max 5), separated by commas.\n\nAvailable items:\n' + itemList + '\n\nAnswer with only numbers (e.g: 1,3,5):';

      // Call LLM using the same helper function as classification
      var helpers = new TSMAIRequestHelpers();
      var llmResponse = helpers.callOpenAI(prompt, llmEnabled, null, 50);

      if (!llmResponse.success) {
        gs.warn('AI Filtering failed: ' + llmResponse.error + ', using top 5 items');
        return catalogItems.slice(0, 5);
      }

      var relevantNumbers = llmResponse.content.trim();

      // Parse numbers from response
      var selectedIndexes = [];
      var numberParts = relevantNumbers.split(',');
      for (var j = 0; j < numberParts.length; j++) {
        var num = parseInt(numberParts[j].trim(), 10);
        if (!isNaN(num) && num > 0 && num <= catalogItems.length) {
          selectedIndexes.push(num - 1); // Convert to 0-based index
        }
      }

      // Build filtered list
      var filteredItems = [];
      for (var k = 0; k < selectedIndexes.length; k++) {
        var index = selectedIndexes[k];
        if (catalogItems[index]) {
          filteredItems.push(catalogItems[index]);
        }
      }

      gs.info('AI Filtering: Selected ' + filteredItems.length + ' most relevant items from ' + catalogItems.length + ' total');

      // If AI didn't select anything, return top 5 from original list
      if (filteredItems.length === 0) {
        gs.warn('AI Filtering returned no items, using top 5 from original list');
        return catalogItems.slice(0, 5);
      }

      return filteredItems;

    } catch (error) {
      gs.error('Error in filterCatalogItemsByRelevance: ' + error.toString());
      // Fallback: return top 10 items from original list
      return catalogItems.slice(0, 10);
    }
  },


  type: 'TSMAISearchEngine'
};
