var gr;
// Detect user's system language from ServiceNow preferences
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
// Set user's system language for client
data.userSystemLanguage = getUserSystemLanguage();
data.isDutch = data.userSystemLanguage === 'Dutch';
// Handle different actions
  if (input && input.action) {
    switch (input.action) {
      case 'generateResponse':
        data.result = generateIntelligentResponse(input.initialRequest, input.requestTypeHint);
        break;
      case 'generateQuestions':
        data.result = generateQuestionsFromAI(input.initialRequest, input.requestTypeHint);
        break;
      case 'submitRequest':
        data.result = submitUniversalRequest(JSON.parse(input.submissionData));
        break;
      case 'searchKnowledge':
        data.result = searchKnowledgeBase(input.searchTerm);
        break;
      default:
        data.result = { success: false, error: 'Unknown action' };
    }
  }
  function detectLanguage(text) {
    // Simple language detection based on common words
    var dutchWords = ['de', 'het', 'een', 'is', 'van', 'en', 'met', 'voor', 'niet', 'mijn', 'zijn', 'hebben', 'worden', 'kunnen', 'deze', 'maar', 'wat', 'hoe', 'waar', 'wanneer', 'waarom', 'ik', 'je', 'hij', 'zij', 'wij', 'jullie', 'zij', 'u'];
    var englishWords = ['the', 'is', 'are', 'and', 'or', 'but', 'with', 'for', 'not', 'my', 'have', 'will', 'can', 'this', 'what', 'how', 'where', 'when', 'why', 'i', 'you', 'he', 'she', 'we', 'they'];
    var lowerText = text.toLowerCase();
    var dutchCount = 0;
    var englishCount = 0;
    for (var i = 0; i < dutchWords.length; i++) {
      if (lowerText.indexOf(' ' + dutchWords[i] + ' ') >= 0 || 
          lowerText.indexOf(dutchWords[i] + ' ') === 0 || 
          lowerText.indexOf(' ' + dutchWords[i]) === lowerText.length - dutchWords[i].length - 1) {
        dutchCount++;
      }
    }
    for (var j = 0; j < englishWords.length; j++) {
      if (lowerText.indexOf(' ' + englishWords[j] + ' ') >= 0 || 
          lowerText.indexOf(englishWords[j] + ' ') === 0 || 
          lowerText.indexOf(' ' + englishWords[j]) === lowerText.length - englishWords[j].length - 1) {
        englishCount++;
      }
    }
    return dutchCount > englishCount ? 'Dutch' : 'English';
  }
  function generateIntelligentResponse(initialRequest, requestTypeHint) {
    try {
      // Detect language
      var detectedLanguage = detectLanguage(initialRequest);
      // Get OpenAI API configuration
      var apiKey = gs.getProperty('openai.api.key');
      if (!apiKey) {
        return {
          success: true,
          classification: 'complex_issue',
          message: detectedLanguage === 'Dutch' ? 'AI service niet beschikbaar, ga door naar vragen' : 'AI service not available, proceeding to questions',
          proceedToQuestions: true
        };
      }
      // Step 1: ALWAYS search knowledge base FIRST
      var knowledgeSources = searchKnowledgeBase(initialRequest);
      // Step 2: Evaluate knowledge relevance BEFORE using it
      var relevantKnowledge = null;
      if (knowledgeSources.success && knowledgeSources.results && knowledgeSources.results.length > 0) {
        relevantKnowledge = evaluateKnowledgeRelevance(initialRequest, knowledgeSources, detectedLanguage, apiKey);
      }
      // Step 3: Classify the request as simple question or complex issue
      var classification = classifyRequest(initialRequest, detectedLanguage, apiKey);
      // Step 4: Generate response with relevant knowledge only
      if (classification.type === 'simple_question') {
        // For simple questions, ALWAYS use found knowledge articles if available
        // Skip relevance evaluation for simple questions to ensure knowledge base is always searched
        if (knowledgeSources.success && knowledgeSources.results && knowledgeSources.results.length > 0) {
          relevantKnowledge = {
            isRelevant: true,
            articles: knowledgeSources.results,
            reason: 'Simple questions always use knowledge base articles when found',
            evaluation: 'FORCED_FOR_SIMPLE_QUESTIONS'
          };
        } else {
          // If no articles found, force empty but valid relevantKnowledge object
          relevantKnowledge = {
            isRelevant: false,
            articles: [],
            reason: 'Simple question but no knowledge articles found',
            evaluation: 'NO_ARTICLES_FOUND'
          };
        }
        // Generate direct answer for simple questions with knowledge enhancement
        var directAnswer = generateDirectAnswerWithKnowledge(initialRequest, detectedLanguage, apiKey, relevantKnowledge);
        return {
          success: true,
          classification: 'simple_question',
          directAnswer: directAnswer.answer,
          confidence: directAnswer.confidence,
          language: detectedLanguage,
          showTicketOption: false,
          knowledgeSources: relevantKnowledge && relevantKnowledge.isRelevant ? relevantKnowledge.articles : [],
          hasKnowledgeSources: relevantKnowledge && relevantKnowledge.isRelevant,
        };
      } else {
        // Generate suggestions for complex issues with knowledge enhancement
        var suggestions = generateSuggestionsWithKnowledge(initialRequest, detectedLanguage, apiKey, relevantKnowledge);
        return {
          success: true,
          classification: 'complex_issue', 
          suggestions: suggestions.suggestions,
          confidence: suggestions.confidence,
          language: detectedLanguage,
          showTicketOption: true,
          proceedToQuestions: false,
          knowledgeSources: relevantKnowledge && relevantKnowledge.isRelevant ? relevantKnowledge.articles : [],
          hasKnowledgeSources: relevantKnowledge && relevantKnowledge.isRelevant,
        };
      }
    } catch (error) {
      return {
        success: true,
        classification: 'complex_issue',
        error: error.message,
        message: 'Technical issue occurred, proceeding to questions',
        proceedToQuestions: true
      };
    }
  }
  function evaluateKnowledgeRelevance(userQuestion, knowledgeResults, language, apiKey) {
    try {
      if (!knowledgeResults.success || !knowledgeResults.results || knowledgeResults.results.length === 0) {
        return { isRelevant: false, articles: [], reason: 'No articles found' };
      }
      // Create summary of found articles for AI evaluation
      var articlesSummary = '';
      var articlesToEvaluate = Math.min(5, knowledgeResults.results.length); // Evaluate max 5 articles
      for (var i = 0; i < articlesToEvaluate; i++) {
        var article = knowledgeResults.results[i];
        articlesSummary += 'Article ' + (i + 1) + ': ' + article.title;
        if (article.content_preview) {
          articlesSummary += ' - ' + article.content_preview.substring(0, 200);
        }
        articlesSummary += '\n';
      }
      // Ask AI to evaluate relevance
      var prompt = '';
      if (language === 'Dutch') {
        prompt = 'Evalueer of deze Knowledge Base artikelen nuttig kunnen zijn voor deze gebruikersvraag.\n\n';
        prompt += 'Gebruikersvraag: "' + userQuestion + '"\n\n';
        prompt += 'Gevonden artikelen:\n' + articlesSummary + '\n';
        prompt += 'Zouden deze artikelen IETS van waarde kunnen toevoegen aan het antwoord?\n';
        prompt += 'Wees POSITIEF - als er ook maar enige relevantie is, antwoord dan "JA".\n';
        prompt += 'Antwoord alleen "NEE" als de artikelen HELEMAAL niets te maken hebben met de vraag.\n';
        prompt += 'Antwoord ALLEEN met: JA of NEE';
      } else {
        prompt = 'Evaluate if these Knowledge Base articles could be useful for this user question.\n\n';
        prompt += 'User question: "' + userQuestion + '"\n\n';
        prompt += 'Found articles:\n' + articlesSummary + '\n';
        prompt += 'Could these articles add ANY value to the answer?\n';
        prompt += 'Be POSITIVE - if there is any relevance at all, answer "YES".\n';
        prompt += 'Only answer "NO" if the articles are COMPLETELY unrelated to the question.\n';
        prompt += 'Answer ONLY with: YES or NO';
      }
      var response = callOpenAI(prompt, apiKey, 'gpt-4o-mini', 50);
      if (response.success) {
        var evaluation = response.content.trim().toUpperCase();
        var isRelevant = (evaluation.indexOf('YES') >= 0 || evaluation.indexOf('JA') >= 0);
        if (isRelevant) {
          return {
            isRelevant: true,
            articles: knowledgeResults.results,
            reason: 'AI determined articles are relevant',
            evaluation: evaluation
          };
        } else {
          return {
            isRelevant: false,
            articles: [],
            reason: 'AI determined articles are not relevant to the question',
            evaluation: evaluation
          };
        }
      }
      // Fallback: if AI evaluation fails, use simple keyword matching
      var questionWords = userQuestion.toLowerCase().split(' ');
      var relevantArticles = [];
      for (var j = 0; j < knowledgeResults.results.length; j++) {
        var article = knowledgeResults.results[j];
        var articleText = (article.title + ' ' + (article.content_preview || '')).toLowerCase();
        var matchCount = 0;
        var matchedWords = [];
        for (var k = 0; k < questionWords.length; k++) {
          var word = questionWords[k];
          if (word.length > 2 && articleText.indexOf(word) >= 0) {
            matchCount++;
            matchedWords.push(word);
          }
        }
        // If at least 1 meaningful word matches, consider relevant (lowered threshold)
        if (matchCount >= 1) {
          relevantArticles.push(article);
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
      // Default to not relevant on error to be conservative
      return {
        isRelevant: false,
        articles: [],
        reason: 'Error during relevance evaluation: ' + error.message
      };
    }
  }
  function searchKnowledgeBase(searchTerm) {
    try {
      if (!searchTerm || searchTerm.trim().length === 0) {
        return { success: false, results: [] };
      }
      // Parse de natuurlijke query naar search parameters
      var searchParams = parseNaturalQuery(searchTerm);
      // Voer de verbeterde search uit
      var results = performEnhancedKnowledgeSearch(searchParams);
      return {
        success: true,
        results: results
      };
    } catch (error) {
      return {
        success: false,
        error: error.toString(),
        results: []
      };
    }
  }
  // New helper functions for improved knowledge search
  function parseNaturalQuery(query) {
    var params = {
      keywords: [],
      wildcardTerms: [],
      exactPhrases: [],
      excludeTerms: [],
      categories: [],
      searchStrategy: 'smart', // smart, exact, broad
      originalQuery: query
    };
    // Verwijder vraagwoorden en stop words, behoud belangrijke termen
    var cleanQuery = removeQuestionWords(query);
    // Extract exact phrases tussen quotes
    var exactMatches = cleanQuery.match(/"([^"]+)"/g) || [];
    for (var i = 0; i < exactMatches.length; i++) {
      var phrase = exactMatches[i].replace(/"/g, '');
      params.exactPhrases.push(phrase);
      cleanQuery = cleanQuery.replace(exactMatches[i], '');
    }
    // Extract exclusions (woorden met - of NOT)
    var excludeMatches = cleanQuery.match(/(-\w+|NOT\s+\w+)/gi) || [];
    for (var j = 0; j < excludeMatches.length; j++) {
      var excludeTerm = excludeMatches[j].replace(/^(-|NOT\s+)/i, '');
      params.excludeTerms.push(excludeTerm);
      cleanQuery = cleanQuery.replace(excludeMatches[j], '');
    }
    // Extract category hints
    params.categories = extractCategoryHints(query);
    // Process remaining keywords
    var words = cleanQuery.toLowerCase().split(/\s+/);
    for (var k = 0; k < words.length; k++) {
      var word = words[k].trim();
      if (!word || word.length < 2) continue;
      // Check voor wildcards
      if (word.indexOf('*') >= 0 || word.indexOf('%') >= 0) {
        params.wildcardTerms.push(word.replace(/\*/g, '%'));
      } else {
        // Belangrijke keywords
        if (isSignificantKeyword(word)) {
          params.keywords.push(word);
          // Voeg ook variaties toe voor betere matching
          params.wildcardTerms.push(word + '*'); // Woorden die beginnen met...
        }
      }
    }
    // Bepaal search strategy
    if (params.exactPhrases.length > 0) {
      params.searchStrategy = 'exact';
    } else if (params.keywords.length > 3) {
      params.searchStrategy = 'smart'; // Gebruik OR voor betere resultaten
    } else if (params.keywords.length === 1) {
      params.searchStrategy = 'broad'; // Zoek breder bij single keyword
    }
    return params;
  }
  function removeQuestionWords(query) {
    // Nederlandse en Engelse vraagwoorden en hulpwoorden
    var questionPatterns = [
      /^(hoe|wat|waarom|wanneer|waar|wie|welke|welk)\s+/gi,
      /^(how|what|why|when|where|who|which)\s+/gi,
      /(kan ik|kun je|kunt u|moet ik|mag ik|wil ik)/gi,
      /(can i|could i|should i|would i|may i|will i)/gi,
      /(ik wil|ik moet|ik kan|ik heb)/gi,
      /(i want|i need|i have|i must)/gi
    ];
    var cleaned = query;
    for (var i = 0; i < questionPatterns.length; i++) {
      cleaned = cleaned.replace(questionPatterns[i], ' ');
    }
    return cleaned.trim();
  }
  function extractCategoryHints(query) {
    var categories = [];
    var categoryKeywords = {
      'password': ['password', 'wachtwoord', 'reset', 'forgot', 'vergeten'],
      'email': ['email', 'mail', 'outlook', 'inbox'],
      'vpn': ['vpn', 'remote', 'connection', 'verbinding'],
      'printer': ['printer', 'print', 'printing', 'printen'],
      'software': ['software', 'install', 'application', 'app'],
      'hardware': ['hardware', 'computer', 'laptop', 'screen', 'monitor'],
      'account': ['account', 'user', 'login', 'gebruiker', 'inloggen'],
      'network': ['network', 'internet', 'wifi', 'netwerk']
    };
    var queryLower = query.toLowerCase();
    for (var category in categoryKeywords) {
      var keywords = categoryKeywords[category];
      for (var i = 0; i < keywords.length; i++) {
        if (queryLower.indexOf(keywords[i]) >= 0) {
          categories.push(category);
          break;
        }
      }
    }
    return categories;
  }
  function isSignificantKeyword(word) {
    // Stop words om te negeren
    var stopWords = [
      'de', 'het', 'een', 'is', 'zijn', 'van', 'voor', 'met', 'op', 'in',
      'the', 'a', 'an', 'is', 'are', 'of', 'for', 'with', 'on', 'in',
      'and', 'or', 'but', 'en', 'of', 'maar'
    ];
    return word.length > 2 && stopWords.indexOf(word) === -1;
  }
  function performEnhancedKnowledgeSearch(searchParams) {
    var results = [];
    var processedIds = {}; // Track om duplicaten te voorkomen
    // STRATEGIE 1: Exact phrase search (hoogste prioriteit)
    if (searchParams.exactPhrases.length > 0) {
      var exactResults = searchExactPhrases(searchParams.exactPhrases, searchParams.excludeTerms);
      addUniqueResults(results, exactResults, processedIds, 10); // Hoge relevantie score
    }
    // STRATEGIE 2: Title search met keywords (OR logic voor betere resultaten)
    if (searchParams.keywords.length > 0) {
      var titleResults = searchInTitles(searchParams.keywords, searchParams.excludeTerms, searchParams.searchStrategy);
      addUniqueResults(results, titleResults, processedIds, 8);
    }
    // STRATEGIE 3: Wildcard searches
    if (searchParams.wildcardTerms.length > 0) {
      var wildcardResults = searchWithWildcards(searchParams.wildcardTerms, searchParams.excludeTerms);
      addUniqueResults(results, wildcardResults, processedIds, 6);
    }
    // STRATEGIE 4: Content search (als we nog niet genoeg resultaten hebben)
    if (results.length < 5 && searchParams.keywords.length > 0) {
      var contentResults = searchInContent(searchParams.keywords, searchParams.excludeTerms, searchParams.searchStrategy);
      addUniqueResults(results, contentResults, processedIds, 4);
    }
    // STRATEGIE 5: Category-based fallback
    if (results.length < 3 && searchParams.categories.length > 0) {
      var categoryResults = searchByCategory(searchParams.categories, searchParams.excludeTerms);
      addUniqueResults(results, categoryResults, processedIds, 2);
    }
    // Sorteer op relevantie score
    results.sort(function(a, b) {
      return (b.relevance_score || 0) - (a.relevance_score || 0);
    });
    // Return top 10 resultaten
    return results.slice(0, 10);
  }
  function searchExactPhrases(phrases, excludeTerms) {
    var results = [];
    var kb = new GlideRecord('kb_knowledge');
    kb.addQuery('workflow_state', 'published');
    kb.addQuery('kb_knowledge_base.active', true);
    // OR query voor alle exact phrases
    var orCondition = kb.addQuery('short_description', 'CONTAINS', phrases[0]);
    orCondition.addOrCondition('text', 'CONTAINS', phrases[0]);
    for (var i = 1; i < phrases.length; i++) {
      orCondition.addOrCondition('short_description', 'CONTAINS', phrases[i]);
      orCondition.addOrCondition('text', 'CONTAINS', phrases[i]);
    }
    // Exclude terms
    for (var j = 0; j < excludeTerms.length; j++) {
      kb.addQuery('short_description', 'DOES NOT CONTAIN', excludeTerms[j]);
      kb.addQuery('text', 'DOES NOT CONTAIN', excludeTerms[j]);
    }
    kb.orderByDesc('sys_view_count'); // Populairste eerst
    kb.setLimit(10);
    kb.query();
    while (kb.next()) {
      results.push(createKnowledgeResult(kb, 'exact_phrase'));
    }
    return results;
  }
  function searchInTitles(keywords, excludeTerms, strategy) {
    var results = [];
    var kb = new GlideRecord('kb_knowledge');
    kb.addQuery('workflow_state', 'published');
    kb.addQuery('kb_knowledge_base.active', true);
    if (strategy === 'smart' || strategy === 'broad') {
      // OR query voor alle keywords (betere recall)
      if (keywords.length > 0) {
        var orCondition = kb.addQuery('short_description', 'CONTAINS', keywords[0]);
        for (var i = 1; i < keywords.length; i++) {
          orCondition.addOrCondition('short_description', 'CONTAINS', keywords[i]);
        }
      }
    } else {
      // AND query voor exacte matching
      for (var j = 0; j < keywords.length; j++) {
        kb.addQuery('short_description', 'CONTAINS', keywords[j]);
      }
    }
    // Exclude terms
    for (var k = 0; k < excludeTerms.length; k++) {
      kb.addQuery('short_description', 'DOES NOT CONTAIN', excludeTerms[k]);
    }
    kb.orderByDesc('sys_view_count');
    kb.setLimit(15);
    kb.query();
    while (kb.next()) {
      var result = createKnowledgeResult(kb, 'title_match');
      // Bereken hoeveel keywords matchen voor scoring
      var matchCount = countKeywordMatches(kb.getValue('short_description'), keywords);
      result.keyword_match_count = matchCount;
      result.relevance_score = result.relevance_score + matchCount;
      results.push(result);
    }
    return results;
  }
  function searchWithWildcards(wildcardTerms, excludeTerms) {
    var results = [];
    var kb = new GlideRecord('kb_knowledge');
    kb.addQuery('workflow_state', 'published');
    kb.addQuery('kb_knowledge_base.active', true);
    // OR query voor wildcard terms
    if (wildcardTerms.length > 0) {
      var orCondition = null;
      for (var i = 0; i < wildcardTerms.length; i++) {
        var term = wildcardTerms[i];
        // Bepaal operator op basis van wildcard positie
        var operator = 'LIKE';
        if (term.indexOf('%') === -1) {
          if (term.indexOf('*') === term.length - 1) {
            operator = 'STARTSWITH';
            term = term.substring(0, term.length - 1);
          } else if (term.indexOf('*') === 0) {
            operator = 'ENDSWITH';
            term = term.substring(1);
          }
        }
        if (!orCondition) {
          orCondition = kb.addQuery('short_description', operator, term);
          orCondition.addOrCondition('text', operator, term);
        } else {
          orCondition.addOrCondition('short_description', operator, term);
          orCondition.addOrCondition('text', operator, term);
        }
      }
    }
    kb.orderByDesc('sys_updated_on');
    kb.setLimit(10);
    kb.query();
    while (kb.next()) {
      results.push(createKnowledgeResult(kb, 'wildcard_match'));
    }
    return results;
  }
  function searchInContent(keywords, excludeTerms, strategy) {
    var results = [];
    var kb = new GlideRecord('kb_knowledge');
    kb.addQuery('workflow_state', 'published');
    kb.addQuery('kb_knowledge_base.active', true);
    if (strategy === 'smart' || strategy === 'broad') {
      // OR query voor content
      if (keywords.length > 0) {
        var orCondition = kb.addQuery('text', 'CONTAINS', keywords[0]);
        for (var i = 1; i < keywords.length; i++) {
          orCondition.addOrCondition('text', 'CONTAINS', keywords[i]);
        }
      }
    } else {
      // AND query
      for (var j = 0; j < keywords.length; j++) {
        kb.addQuery('text', 'CONTAINS', keywords[j]);
      }
    }
    kb.orderByDesc('sys_view_count');
    kb.setLimit(10);
    kb.query();
    while (kb.next()) {
      results.push(createKnowledgeResult(kb, 'content_match'));
    }
    return results;
  }
  function searchByCategory(categories, excludeTerms) {
    var results = [];
    var kb = new GlideRecord('kb_knowledge');
    kb.addQuery('workflow_state', 'published');
    kb.addQuery('kb_knowledge_base.active', true);
    // Zoek in kb_category of topic velden
    var categoryQuery = kb.addQuery('kb_category', 'CONTAINS', categories[0]);
    for (var i = 1; i < categories.length; i++) {
      categoryQuery.addOrCondition('kb_category', 'CONTAINS', categories[i]);
    }
    // Ook zoeken in topic field als die bestaat
    categoryQuery.addOrCondition('topic', 'CONTAINS', categories[0]);
    kb.orderByDesc('sys_view_count');
    kb.setLimit(5);
    kb.query();
    while (kb.next()) {
      results.push(createKnowledgeResult(kb, 'category_match'));
    }
    return results;
  }
  function createKnowledgeResult(kb, matchType) {
    return {
      sys_id: kb.getUniqueValue(),
      number: kb.getValue('number'),
      title: kb.getValue('short_description'),
      url: '/kb_view.do?sysparm_article=' + kb.getValue('number'),
      snippet: extractSnippet(kb.getValue('text')),
      category: kb.getDisplayValue('kb_category'),
      published: kb.getValue('published'),
      view_count: parseInt(kb.getValue('sys_view_count') || '0'),
      rating: parseFloat(kb.getValue('rating') || '0'),
      match_type: matchType,
      relevance_score: 5 // Base score, wordt aangepast door calling function
    };
  }
  function extractSnippet(text) {
    if (!text) return '';
    // Strip HTML tags
    var plainText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    // Return eerste 200 karakters
    return plainText.substring(0, 200) + (plainText.length > 200 ? '...' : '');
  }
  function countKeywordMatches(text, keywords) {
    if (!text) return 0;
    var textLower = text.toLowerCase();
    var matchCount = 0;
    for (var i = 0; i < keywords.length; i++) {
      if (textLower.indexOf(keywords[i].toLowerCase()) >= 0) {
        matchCount++;
      }
    }
    return matchCount;
  }
  function addUniqueResults(targetArray, newResults, processedIds, baseScore) {
    for (var i = 0; i < newResults.length; i++) {
      var result = newResults[i];
      if (!processedIds[result.sys_id]) {
        result.relevance_score = baseScore + (result.relevance_score || 0);
        targetArray.push(result);
        processedIds[result.sys_id] = true;
      }
    }
  }
  // Helper function to convert Markdown to HTML for ServiceNow
  function convertMarkdownToHTML(text) {
    if (!text) return '';
    // Convert headers
    text = text.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
    text = text.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
    text = text.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
    // Convert bold text
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    // Convert italic text
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    text = text.replace(/_([^_]+)_/g, '<em>$1</em>');
    // Convert bullet lists
    text = text.replace(/^\* (.+)$/gm, '<li>$1</li>');
    text = text.replace(/(<li>.*<\/li>)/s, function(match) {
      return '<ul>' + match + '</ul>';
    });
    // Convert numbered lists
    text = text.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
    // Convert line breaks
    text = text.replace(/\n\n/g, '</p><p>');
    text = '<p>' + text + '</p>';
    // Clean up empty paragraphs
    text = text.replace(/<p><\/p>/g, '');
    text = text.replace(/<p>\s*<ul>/g, '<ul>');
    text = text.replace(/<\/ul>\s*<\/p>/g, '</ul>');
    // Convert inline code
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    return text;
  }
  // Helper function to format knowledge sources as HTML
  function formatKnowledgeSourcesHTML(articles, language) {
    if (!articles || articles.length === 0) return '';
    var html = '<div class="knowledge-sources" style="margin-top: 20px; padding: 15px; background-color: #f5f5f5; border-left: 3px solid #0078d4;">';
    html += '<h4 style="margin-top: 0; color: #0078d4;">';
    html += language === 'Dutch' ? 'Bronnen:' : 'Sources:';
    html += '</h4>';
    html += '<ul style="list-style-type: none; padding-left: 0;">';
    for (var i = 0; i < Math.min(3, articles.length); i++) {
      var article = articles[i];
      html += '<li style="margin-bottom: 10px;">';
      html += '<strong>' + article.title + '</strong>';
      if (article.number) {
        html += ' <span style="color: #666; font-size: 0.9em;">[KB' + article.number + ']</span>';
      }
      html += '<br>';
      html += '<a href="' + article.url + '" target="_blank" style="color: #0078d4; text-decoration: none;">Volledig artikel bekijken →</a>';
      html += '</li>';
    }
    html += '</ul>';
    html += '</div>';
    return html;
  }
  function generateDirectAnswerWithKnowledge(request, language, apiKey, relevantKnowledge) {
    try {
      var hasKnowledgeSources = relevantKnowledge && relevantKnowledge.isRelevant && relevantKnowledge.articles && relevantKnowledge.articles.length > 0;
      var knowledgeContext = '';
      var sourceReferences = [];
      if (hasKnowledgeSources) {
        knowledgeContext = '\n\nRelevant Knowledge Base Articles (use these as your primary source):\n';
        for (var i = 0; i < Math.min(3, relevantKnowledge.articles.length); i++) {
          var article = relevantKnowledge.articles[i];
          var refNum = i + 1;
          knowledgeContext += '\n[' + refNum + '] Title: ' + article.title + '\n';
          knowledgeContext += 'Content: ' + article.snippet + '\n';
          knowledgeContext += 'Article Number: KB' + article.number + '\n';
          sourceReferences.push(article);
        }
      }
      var prompt = '';
      if (language === 'Dutch') {
        prompt = 'Je bent een behulpzame ServiceNow assistant. Beantwoord deze vraag direct en volledig in het Nederlands.\n\n';
        prompt += 'Vraag: "' + request + '"\n';
        if (hasKnowledgeSources) {
          prompt += knowledgeContext + '\n';
          prompt += 'INSTRUCTIES:\n';
          prompt += '1. Gebruik PRIMAIR de informatie uit de bovenstaande Knowledge Base artikelen\n';
          prompt += '2. Citeer relevante bronnen met [1], [2], etc. waar van toepassing\n';
          prompt += '3. Geef een praktisch en actionable antwoord\n';
          prompt += '4. Als de KB artikelen niet alle details bevatten, vul aan met algemene best practices\n';
          prompt += '5. Gebruik GEEN markdown formatting zoals ** of ##, gebruik gewone tekst\n\n';
        } else {
          prompt += '\nGeen relevante Knowledge Base artikelen gevonden voor deze specifieke vraag. ';
          prompt += 'Geef een algemeen nuttig antwoord gebaseerd op je kennis van ServiceNow.\n';
          prompt += 'Gebruik GEEN markdown formatting zoals ** of ##, gebruik gewone tekst.\n';
        }
        prompt += 'Geef een duidelijk, praktisch antwoord in maximaal 300 woorden.';
      } else {
        prompt = 'You are a helpful ServiceNow assistant. Answer this question directly and completely.\n\n';
        prompt += 'Question: "' + request + '"\n';
        if (hasKnowledgeSources) {
          prompt += knowledgeContext + '\n';
          prompt += 'INSTRUCTIONS:\n';
          prompt += '1. Use PRIMARILY the information from the above Knowledge Base articles\n';
          prompt += '2. Cite relevant sources with [1], [2], etc. where applicable\n';
          prompt += '3. Provide a practical and actionable answer\n';
          prompt += '4. If KB articles don\'t contain all details, supplement with general best practices\n';
          prompt += '5. Do NOT use markdown formatting like ** or ##, use plain text\n\n';
        } else {
          prompt += '\nNo relevant Knowledge Base articles found for this specific question. ';
          prompt += 'Provide a generally helpful answer based on your knowledge of ServiceNow.\n';
          prompt += 'Do NOT use markdown formatting like ** or ##, use plain text.\n';
        }
        prompt += 'Provide a clear, practical answer in maximum 300 words.';
      }
      var response = callOpenAI(prompt, apiKey, 'gpt-4o-mini', 400);
      if (response.success) {
        var formattedAnswer = convertMarkdownToHTML(response.content);
        // Add knowledge sources at the bottom if available
        if (hasKnowledgeSources) {
          formattedAnswer += formatKnowledgeSourcesHTML(sourceReferences, language);
        }
        return {
          answer: formattedAnswer,
          confidence: hasKnowledgeSources ? 'high' : 'medium',
          sources: sourceReferences
        };
      }
      // Fallback answer
      var fallbackMsg = language === 'Dutch'
        ? 'Ik kan deze vraag momenteel niet direct beantwoorden. Laten we een ticket aanmaken zodat een specialist u kan helpen.'
        : 'I cannot directly answer this question at the moment. Let\'s create a ticket so a specialist can help you.';
      return {
        answer: convertMarkdownToHTML(fallbackMsg),
        confidence: 'low',
        sources: []
      };
    } catch (error) {
      return {
        answer: language === 'Dutch' ? 'Fout bij het genereren van antwoord.' : 'Error generating answer.',
        confidence: 'low',
        sources: []
      };
    }
  }
  function generateSuggestionsWithKnowledge(request, language, apiKey, relevantKnowledge) {
    try {
      var hasKnowledgeSources = relevantKnowledge && relevantKnowledge.isRelevant && relevantKnowledge.articles && relevantKnowledge.articles.length > 0;
      var knowledgeContext = '';
      var sourceReferences = [];
      if (hasKnowledgeSources) {
        knowledgeContext = '\n\nRelevant Knowledge Base Articles (use these for creating suggestions):\n';
        for (var i = 0; i < Math.min(3, relevantKnowledge.articles.length); i++) {
          var article = relevantKnowledge.articles[i];
          var refNum = i + 1;
          knowledgeContext += '\n[' + refNum + '] Title: ' + article.title + '\n';
          knowledgeContext += 'Content: ' + article.snippet + '\n';
          knowledgeContext += 'Article Number: KB' + article.number + '\n';
          sourceReferences.push(article);
        }
      }
      var prompt = '';
      if (language === 'Dutch') {
        prompt = 'Je bent een ServiceNow expert. Analyseer dit probleem en geef 2-4 praktische suggesties die de gebruiker eerst kan proberen.\n\n';
        prompt += 'Probleem: "' + request + '"\n';
        if (hasKnowledgeSources) {
          prompt += knowledgeContext + '\n';
          prompt += 'INSTRUCTIES:\n';
          prompt += '1. Baseer je suggesties PRIMAIR op de Knowledge Base artikelen\n';
          prompt += '2. Vermeld bij elke suggestie de bron met [1], [2], etc. als het uit een KB artikel komt\n';
          prompt += '3. Geef concrete, uitvoerbare stappen\n';
          prompt += '4. Gebruik GEEN markdown formatting\n\n';
        } else {
          prompt += '\nGeen relevante Knowledge Base artikelen gevonden voor dit specifieke probleem. ';
          prompt += 'Geef algemene praktische suggesties gebaseerd op je ServiceNow expertise.\n';
          prompt += 'Gebruik GEEN markdown formatting.\n';
        }
        prompt += 'Geef suggesties in deze JSON format:\n';
        prompt += '[\n';
        prompt += '  "Stap 1: Korte, praktische actie (met [bron] indien van toepassing)",\n';
        prompt += '  "Stap 2: Andere mogelijke oplossing (met [bron] indien van toepassing)",\n';
        prompt += '  "Stap 3: Als dat niet werkt, probeer dit"\n';
        prompt += ']\n\n';
        prompt += 'Focus op eenvoudige stappen die de gebruiker zelf kan uitvoeren.';
      } else {
        prompt = 'You are a ServiceNow expert. Analyze this issue and provide 2-4 practical suggestions the user can try first.\n\n';
        prompt += 'Issue: "' + request + '"\n';
        if (hasKnowledgeSources) {
          prompt += knowledgeContext + '\n';
          prompt += 'INSTRUCTIONS:\n';
          prompt += '1. Base your suggestions PRIMARILY on the Knowledge Base articles\n';
          prompt += '2. Reference sources with [1], [2], etc. when suggestion comes from a KB article\n';
          prompt += '3. Provide concrete, actionable steps\n';
          prompt += '4. Do NOT use markdown formatting\n\n';
        } else {
          prompt += '\nNo relevant Knowledge Base articles found for this specific issue. ';
          prompt += 'Provide general practical suggestions based on your ServiceNow expertise.\n';
          prompt += 'Do NOT use markdown formatting.\n';
        }
        prompt += 'Provide suggestions in this JSON format:\n';
        prompt += '[\n';
        prompt += '  "Step 1: Short, practical action (with [source] if applicable)",\n';
        prompt += '  "Step 2: Another possible solution (with [source] if applicable)",\n';
        prompt += '  "Step 3: If that doesn\'t work, try this"\n';
        prompt += ']\n\n';
        prompt += 'Focus on simple steps the user can perform themselves.';
      }
      var response = callOpenAI(prompt, apiKey, 'gpt-4o-mini', 500);
      if (response.success) {
        var suggestions = parseJSONResponse(response.content);
        if (suggestions && suggestions.length > 0) {
          // Convert any markdown in suggestions to HTML
          var htmlSuggestions = [];
          for (var i = 0; i < suggestions.length; i++) {
            htmlSuggestions.push(convertMarkdownToHTML(suggestions[i]));
          }
          // Create formatted response with sources
          var formattedResponse = {
            suggestions: htmlSuggestions,
            confidence: hasKnowledgeSources ? 'high' : 'medium',
            sources: sourceReferences
          };
          // Add knowledge sources HTML if available
          if (hasKnowledgeSources) {
            formattedResponse.sourcesHTML = formatKnowledgeSourcesHTML(sourceReferences, language);
          }
          return formattedResponse;
        }
      }
      // Fallback suggestions
      var fallbackSuggestions = language === 'Dutch'
        ? ['Probeer de pagina te vernieuwen', 'Log uit en weer in', 'Probeer een andere browser', 'Controleer uw internetverbinding']
        : ['Try refreshing the page', 'Log out and back in', 'Try a different browser', 'Check your internet connection'];
      return {
        suggestions: fallbackSuggestions,
        confidence: 'low',
        sources: []
      };
    } catch (error) {
      return {
        suggestions: [],
        confidence: 'low',
        sources: []
      };
    }
  }
  function classifyRequest(request, language, apiKey) {
    try {
      var prompt = '';
      if (language === 'Dutch') {
        prompt = 'Analyseer deze gebruikersaanvraag en classificeer deze als SIMPLE_QUESTION of COMPLEX_ISSUE.\n\n';
        prompt += 'SIMPLE_QUESTION: Directe vragen die beantwoord kunnen worden zonder een ticket aan te maken:\n';
        prompt += '- Hoe vragen (Hoe log ik in?)\n';
        prompt += '- Wat vragen (Wat is mijn wachtwoord?)\n';
        prompt += '- Waar vragen (Waar vind ik...?)\n';
        prompt += '- Algemene informatie vragen\n';
        prompt += '- Procedure uitleg\n\n';
        prompt += 'COMPLEX_ISSUE: Problemen die een ticket vereisen:\n';
        prompt += '- Iets is kapot of werkt niet\n';
        prompt += '- Foutmeldingen\n';
        prompt += '- Toegangsproblemen\n';
        prompt += '- Service aanvragen\n';
        prompt += '- Wijzigingsverzoeken\n\n';
        prompt += 'Gebruikersaanvraag: "' + request + '"\n\n';
        prompt += 'Antwoord alleen met: SIMPLE_QUESTION of COMPLEX_ISSUE';
      } else {
        prompt = 'Analyze this user request and classify it as SIMPLE_QUESTION or COMPLEX_ISSUE.\n\n';
        prompt += 'SIMPLE_QUESTION: Direct questions that can be answered without creating a ticket:\n';
        prompt += '- How-to questions (How do I log in?)\n';
        prompt += '- What questions (What is my password?)\n';
        prompt += '- Where questions (Where can I find...?)\n';
        prompt += '- General information requests\n';
        prompt += '- Procedure explanations\n\n';
        prompt += 'COMPLEX_ISSUE: Problems that require a ticket:\n';
        prompt += '- Something is broken or not working\n';
        prompt += '- Error messages\n';
        prompt += '- Access problems\n';
        prompt += '- Service requests\n';
        prompt += '- Change requests\n\n';
        prompt += 'User Request: "' + request + '"\n\n';
        prompt += 'Respond only with: SIMPLE_QUESTION or COMPLEX_ISSUE';
      }
      var response = callOpenAI(prompt, apiKey, 'gpt-4o-mini', 50);
      if (response.success) {
        var classification = response.content.trim().toUpperCase();
        if (classification.indexOf('SIMPLE_QUESTION') >= 0) {
          return { type: 'simple_question', confidence: 'high' };
        } else {
          return { type: 'complex_issue', confidence: 'high' };
        }
      }
      // Fallback classification based on keywords
      return classifyByKeywords(request, language);
    } catch (error) {
      return { type: 'complex_issue', confidence: 'low' };
    }
  }
  function classifyByKeywords(request, language) {
    var lowerRequest = request.toLowerCase();
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
    if (hasQuestionWord && !hasProblemWord) {
      return { type: 'simple_question', confidence: 'medium' };
    } else {
      return { type: 'complex_issue', confidence: 'medium' };
    }
  }
  function generateDirectAnswer(request, language, apiKey) {
    try {
      var prompt = '';
      if (language === 'Dutch') {
        prompt = 'Je bent een behulpzame ServiceNow assistant. Beantwoord deze vraag direct en volledig in het Nederlands.\n\n';
        prompt += 'Vraag: "' + request + '"\n\n';
        prompt += 'Geef een duidelijke, praktische antwoord. Als je de exacte informatie niet hebt, geef dan algemene richtlijnen.\n';
        prompt += 'Houd het antwoord beknopt maar informatief (max 200 woorden).';
      } else {
        prompt = 'You are a helpful ServiceNow assistant. Answer this question directly and completely.\n\n';
        prompt += 'Question: "' + request + '"\n\n';
        prompt += 'Provide a clear, practical answer. If you don\'t have exact information, provide general guidelines.\n';
        prompt += 'Keep the answer concise but informative (max 200 words).';
      }
      var response = callOpenAI(prompt, apiKey, 'gpt-4o-mini', 300);
      if (response.success) {
        return {
          answer: response.content,
          confidence: 'high'
        };
      }
      // Fallback answer
      var fallbackMsg = language === 'Dutch' 
        ? 'Ik kan deze vraag momenteel niet direct beantwoorden. Laten we een ticket aanmaken zodat een specialist u kan helpen.'
        : 'I cannot directly answer this question at the moment. Let\'s create a ticket so a specialist can help you.';
      return {
        answer: fallbackMsg,
        confidence: 'low'
      };
    } catch (error) {
      return {
        answer: language === 'Dutch' ? 'Fout bij het genereren van antwoord.' : 'Error generating answer.',
        confidence: 'low'
      };
    }
  }
  function generateSuggestions(request, language, apiKey) {
    try {
      var prompt = '';
      if (language === 'Dutch') {
        prompt = 'Je bent een ServiceNow expert. Analyseer dit probleem en geef 2-4 praktische suggesties die de gebruiker eerst kan proberen.\n\n';
        prompt += 'Probleem: "' + request + '"\n\n';
        prompt += 'Geef suggesties in deze JSON format:\n';
        prompt += '[\n';
        prompt += '  "Suggestie 1: Korte, praktische actie",\n';
        prompt += '  "Suggestie 2: Andere mogelijke oplossing",\n';
        prompt += '  "Suggestie 3: Als dat niet werkt, probeer dit"\n';
        prompt += ']\n\n';
        prompt += 'Focus op eenvoudige stappen die de gebruiker zelf kan uitvoeren.';
      } else {
        prompt = 'You are a ServiceNow expert. Analyze this issue and provide 2-4 practical suggestions the user can try first.\n\n';
        prompt += 'Issue: "' + request + '"\n\n';
        prompt += 'Provide suggestions in this JSON format:\n';
        prompt += '[\n';
        prompt += '  "Suggestion 1: Short, practical action",\n';
        prompt += '  "Suggestion 2: Another possible solution",\n';
        prompt += '  "Suggestion 3: If that doesn\'t work, try this"\n';
        prompt += ']\n\n';
        prompt += 'Focus on simple steps the user can perform themselves.';
      }
      var response = callOpenAI(prompt, apiKey, 'gpt-4o-mini', 400);
      if (response.success) {
        var suggestions = parseJSONResponse(response.content);
        if (suggestions && suggestions.length > 0) {
          return {
            suggestions: suggestions,
            confidence: 'high'
          };
        }
      }
      // Fallback suggestions
      var fallbackSuggestions = language === 'Dutch' 
        ? ['Probeer de pagina te vernieuwen', 'Log uit en weer in', 'Probeer een andere browser', 'Controleer uw internetverbinding']
        : ['Try refreshing the page', 'Log out and back in', 'Try a different browser', 'Check your internet connection'];
      return {
        suggestions: fallbackSuggestions,
        confidence: 'low'
      };
    } catch (error) {
      return {
        suggestions: [],
        confidence: 'low'
      };
    }
  }
  function callOpenAI(prompt, apiKey, model, maxTokens) {
    try {
      var request = new sn_ws.RESTMessageV2();
      request.setEndpoint('https://api.openai.com/v1/chat/completions');
      request.setHttpMethod('POST');
      request.setRequestHeader('Authorization', 'Bearer ' + apiKey);
      request.setRequestHeader('Content-Type', 'application/json');
      var requestBody = {
        model: model || 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: prompt
        }],
        temperature: 0.3
      };
      if (model && model.indexOf('gpt-4o') >= 0) {
        requestBody.max_completion_tokens = maxTokens || 200;
      } else {
        requestBody.max_tokens = maxTokens || 200;
      }
      request.setRequestBody(JSON.stringify(requestBody));
      var response = request.execute();
      var httpStatus = response.getStatusCode();
      if (httpStatus == 200) {
        var aiResponse = JSON.parse(response.getBody());
        return {
          success: true,
          content: aiResponse.choices[0].message.content
        };
      }
      return { success: false, error: 'HTTP ' + httpStatus };
    } catch (error) {
      return { success: false, error: error.toString() };
    }
  }
  function parseJSONResponse(content) {
    try {
      var jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return null;
    } catch (error) {
      return null;
    }
  }
  function generateQuestionsFromAI(initialRequest, requestTypeHint) {
    try {
      // Detect language
      var detectedLanguage = detectLanguage(initialRequest);
      // Get OpenAI API configuration from system properties
      var apiKey = gs.getProperty('openai.api.key');
      var apiUrl = 'https://api.openai.com/v1/chat/completions';
      if (!apiKey) {
        return {
          success: true,
          questions: getDefaultQuestions(detectedLanguage),
          usingFallback: true,
          message: detectedLanguage === 'Dutch' ? 'AI service niet beschikbaar, standaard vragen worden gebruikt' : 'AI service not available, using default questions'
        };
      }
      // Use reliable model
      var modelToUse = 'gpt-4o-mini';
      // Create AI prompt for question generation
      var prompt = createQuestionGenerationPrompt(initialRequest, requestTypeHint, detectedLanguage);
      // Call OpenAI API with chosen model
      var request = new sn_ws.RESTMessageV2();
      request.setEndpoint(apiUrl);
      request.setHttpMethod('POST');
      request.setRequestHeader('Authorization', 'Bearer ' + apiKey);
      request.setRequestHeader('Content-Type', 'application/json');
      var requestBody = {
        model: modelToUse,
        messages: [{
          role: 'user',
          content: prompt
        }],
        temperature: 0.7
      };
      // Use appropriate token parameter based on model
      if (modelToUse.indexOf('gpt-5') >= 0 || modelToUse.indexOf('gpt-4o') >= 0) {
        requestBody.max_completion_tokens = 2000;
      } else {
        requestBody.max_tokens = 2000;
      }
      request.setRequestBody(JSON.stringify(requestBody));
      var response = request.execute();
      var responseBody = response.getBody();
      var httpStatus = response.getStatusCode();
      if (httpStatus == 200) {
        var aiResponse = JSON.parse(responseBody);
        var aiContent = aiResponse.choices[0].message.content;
        // Parse AI response to extract questions
        var questions = parseAIQuestions(aiContent);
        return {
          success: true,
          questions: questions,
          language: detectedLanguage
        };
      } else {
        // Fallback to default questions on API failure
        return {
          success: true,
          questions: getDefaultQuestions(detectedLanguage),
          usingFallback: true,
          message: detectedLanguage === 'Dutch' ? 'AI service tijdelijk niet beschikbaar, standaard vragen worden gebruikt' : 'AI service temporarily unavailable, using default questions',
          language: detectedLanguage
        };
      }
    } catch (error) {
      // Always return fallback questions instead of failing
      return {
        success: true,
        questions: getDefaultQuestions('English'),
        usingFallback: true,
        error: error.message,
        message: 'Using default questions due to technical issue'
      };
    }
  }
  function createQuestionGenerationPrompt(initialRequest, requestTypeHint, language) {
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
      prompt += '- Als het een incident is: focus op impact en urgentie\n';
      prompt += '- Als het een service request is: focus op specifieke requirements\n';
      prompt += '- Als het een wijziging is: focus op risico en planning\n';
      prompt += '- Als het een HR vraag is: focus op personeelszaken, verlof, salaris, onboarding\n\n';
      prompt += 'Retourneer als JSON array. Voorbeeld:\n';
      prompt += '[\n';
      prompt += '  {\n';
      prompt += '    "question": "Wanneer moet dit opgelost zijn?",\n';
      prompt += '    "type": "text",\n';
      prompt += '    "required": true,\n';
      prompt += '    "category": "urgency"\n';
      prompt += '  }\n';
      prompt += ']\n\n';
      prompt += 'Vraag types: text, textarea, select (met options), date, priority, yesno';
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
      prompt += '- If it\'s an incident: focus on impact and urgency\n';
      prompt += '- If it\'s a service request: focus on specific requirements\n';
      prompt += '- If it\'s a change: focus on risk and planning\n';
      prompt += '- If it\'s an HR request: focus on human resources, leave, payroll, onboarding\n\n';
      prompt += 'Return as JSON array. Example:\n';
      prompt += '[\n';
      prompt += '  {\n';
      prompt += '    "question": "When do you need this resolved?",\n';
      prompt += '    "type": "text",\n';
      prompt += '    "required": true,\n';
      prompt += '    "category": "urgency"\n';
      prompt += '  }\n';
      prompt += ']\n\n';
      prompt += 'Question types: text, textarea, select (with options), date, priority, yesno';
    }
    return prompt;
  }
  function parseAIQuestions(aiContent) {
    try {
      // Try to extract JSON from AI response
      var jsonMatch = aiContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        var parsed = JSON.parse(jsonMatch[0]);
        return parsed;
      }
      // Fallback: create default questions
      return getDefaultQuestions('English');
    } catch (error) {
      return getDefaultQuestions('English');
    }
  }
  function getDefaultQuestions(language) {
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
          question: "Hoeveel gebruikers zijn hierdoor getroffen?",
          type: "select",
          required: true,
          options: ["Alleen ik", "Mijn team (2-10)", "Afdeling (10+)", "Hele organisatie"],
          category: "impact"
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
          question: "How many users are affected?",
          type: "select",
          required: true,
          options: ["Just me", "My team (2-10)", "Department (10+)", "Entire organization"],
          category: "impact"
        }
      ];
    }
  }
  function generateAISummaryAndCategorization(submissionData) {
    try {
      var apiKey = gs.getProperty('openai.api.key');
      if (!apiKey) {
        return null;
      }
      var language = detectLanguage(submissionData.initialRequest);
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
        prompt += '  "priority": 1-5,\n';
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
      // Call OpenAI API
      var request = new sn_ws.RESTMessageV2();
      request.setEndpoint('https://api.openai.com/v1/chat/completions');
      request.setHttpMethod('POST');
      request.setRequestHeader('Authorization', 'Bearer ' + apiKey);
      request.setRequestHeader('Content-Type', 'application/json');
      var modelToUse = 'gpt-4o-mini';
      var requestBody = {
        model: modelToUse,
        messages: [{
          role: 'user',
          content: prompt
        }],
        temperature: 0.3
      };
      if (modelToUse.indexOf('gpt-4o') >= 0) {
        requestBody.max_completion_tokens = 1000;
      } else {
        requestBody.max_tokens = 1000;
      }
      request.setRequestBody(JSON.stringify(requestBody));
      var response = request.execute();
      var httpStatus = response.getStatusCode();
      if (httpStatus == 200) {
        var aiResponse = JSON.parse(response.getBody());
        var aiContent = aiResponse.choices[0].message.content;
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
  }
  function submitUniversalRequest(submissionData) {
    try {
      // Generate AI summary and categorization
      var aiAnalysis = generateAISummaryAndCategorization(submissionData);
      var ticketType, summary, analysis, suggestion, category;
      if (aiAnalysis) {
        ticketType = aiAnalysis.ticket_type;
        summary = aiAnalysis.summary;
        analysis = aiAnalysis.analysis;
        suggestion = aiAnalysis.suggestion;
        category = aiAnalysis.category;
      } else {
        // Fallback to basic determination
        ticketType = determineRequestType(submissionData);
        summary = truncateString(submissionData.initialRequest, 160);
        analysis = '';
        suggestion = '';
        category = '';
      }
      // Create the appropriate record type based on AI analysis
      var createdRecord;
      switch (ticketType) {
        case 'INC':
          createdRecord = createIncidentWithAI(submissionData, aiAnalysis);
          break;
        case 'PRB':
          createdRecord = createProblemWithAI(submissionData, aiAnalysis);
          break;
        case 'CHG':
          createdRecord = createChangeWithAI(submissionData, aiAnalysis);
          break;
        case 'REQ':
          createdRecord = createServiceRequestWithAI(submissionData, aiAnalysis);
          break;
        case 'HR':
          createdRecord = createHRCaseWithAI(submissionData, aiAnalysis);
          break;
        case 'QUERY':
        default:
          createdRecord = createQueryTicket(submissionData, aiAnalysis);
          break;
      }
      if (createdRecord.success) {
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
  }
  function createIncidentWithAI(submissionData, aiAnalysis) {
    var incident = new GlideRecord('incident');
    incident.initialize();
    if (aiAnalysis) {
      incident.setValue('short_description', aiAnalysis.summary);
      incident.setValue('description', buildAIEnhancedDescription(submissionData, aiAnalysis));
      incident.setValue('priority', aiAnalysis.priority || 3);
      // Set category if available
      if (aiAnalysis.category) {
        // Map AI category to ServiceNow category
        if (aiAnalysis.category === 'Hardware') incident.setValue('category', 'hardware');
        else if (aiAnalysis.category === 'Software') incident.setValue('category', 'software');
        else if (aiAnalysis.category === 'Network') incident.setValue('category', 'network');
      }
    } else {
      incident.setValue('short_description', truncateString(submissionData.initialRequest, 160));
      incident.setValue('description', buildFullDescription(submissionData));
      incident.setValue('priority', '3');
    }
    incident.setValue('opened_by', gs.getUserID());
    incident.setValue('caller_id', gs.getUserID());
    incident.setValue('urgency', '3');
    incident.setValue('impact', '3');
    incident.setValue('state', '1'); // New
    var incidentId = incident.insert();
    if (incidentId) {
      incident.get(incidentId);
      return {
        success: true,
        type: 'Incident',
        sys_id: incidentId,
        number: incident.getValue('number')
      };
    }
    return { success: false };
  }
  function createProblemWithAI(submissionData, aiAnalysis) {
    var problem = new GlideRecord('problem');
    problem.initialize();
    if (aiAnalysis) {
      problem.setValue('short_description', aiAnalysis.summary);
      problem.setValue('description', buildAIEnhancedDescription(submissionData, aiAnalysis));
      problem.setValue('priority', aiAnalysis.priority || 3);
    } else {
      problem.setValue('short_description', truncateString(submissionData.initialRequest, 160));
      problem.setValue('description', buildFullDescription(submissionData));
      problem.setValue('priority', '3');
    }
    problem.setValue('opened_by', gs.getUserID());
    problem.setValue('state', '1'); // New
    var problemId = problem.insert();
    if (problemId) {
      problem.get(problemId);
      return {
        success: true,
        type: 'Problem',
        sys_id: problemId,
        number: problem.getValue('number')
      };
    }
    return { success: false };
  }
  function createChangeWithAI(submissionData, aiAnalysis) {
    var change = new GlideRecord('change_request');
    change.initialize();
    if (aiAnalysis) {
      change.setValue('short_description', aiAnalysis.summary);
      change.setValue('description', buildAIEnhancedDescription(submissionData, aiAnalysis));
      change.setValue('priority', aiAnalysis.priority || 3);
    } else {
      change.setValue('short_description', truncateString(submissionData.initialRequest, 160));
      change.setValue('description', buildFullDescription(submissionData));
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
        sys_id: changeId,
        number: change.getValue('number')
      };
    }
    return { success: false };
  }
  function createServiceRequestWithAI(submissionData, aiAnalysis) {
    var sr = new GlideRecord('sc_request');
    sr.initialize();
    if (aiAnalysis) {
      sr.setValue('short_description', aiAnalysis.summary);
      sr.setValue('description', buildAIEnhancedDescription(submissionData, aiAnalysis));
      sr.setValue('priority', aiAnalysis.priority || 3);
    } else {
      sr.setValue('short_description', truncateString(submissionData.initialRequest, 160));
      sr.setValue('description', buildFullDescription(submissionData));
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
        sys_id: srId,
        number: sr.getValue('number')
      };
    }
    return { success: false };
  }
  function createHRCaseWithAI(submissionData, aiAnalysis) {
    // Try HR Service Delivery first (if plugin is installed)
    var hrCase = new GlideRecord('sn_hr_core_case');
    if (hrCase.isValid()) {
      // HR Plugin is available - use HR Case
      hrCase.initialize();
      if (aiAnalysis) {
        hrCase.setValue('short_description', aiAnalysis.summary);
        hrCase.setValue('description', buildAIEnhancedDescription(submissionData, aiAnalysis));
        hrCase.setValue('priority', aiAnalysis.priority || 3);
        // Set HR-specific category if available
        if (aiAnalysis.category) {
          if (aiAnalysis.category === 'HR' || aiAnalysis.category === 'Human Resources') {
            hrCase.setValue('hr_service', 'general_hr_inquiry');
          }
        }
      } else {
        hrCase.setValue('short_description', truncateString(submissionData.initialRequest, 160));
        hrCase.setValue('description', buildFullDescription(submissionData));
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
        hrRequest.setValue('description', buildAIEnhancedDescription(submissionData, aiAnalysis));
        hrRequest.setValue('priority', aiAnalysis.priority || 3);
      } else {
        hrRequest.setValue('short_description', '[HR] ' + truncateString(submissionData.initialRequest, 150));
        hrRequest.setValue('description', buildFullDescription(submissionData));
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
          sys_id: hrRequestId,
          number: hrRequest.getValue('number')
        };
      }
    }
    return { success: false };
  }
  function createQueryTicket(submissionData, aiAnalysis) {
    // Create as a task for queries
    var task = new GlideRecord('task');
    task.initialize();
    if (aiAnalysis) {
      task.setValue('short_description', '[QUERY] ' + aiAnalysis.summary);
      task.setValue('description', buildAIEnhancedDescription(submissionData, aiAnalysis));
      task.setValue('priority', aiAnalysis.priority || 4);
    } else {
      task.setValue('short_description', '[QUERY] ' + truncateString(submissionData.initialRequest, 150));
      task.setValue('description', buildFullDescription(submissionData));
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
        sys_id: taskId,
        number: task.getValue('number')
      };
    }
    return { success: false };
  }
  function buildAIEnhancedDescription(submissionData, aiAnalysis) {
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
  }
  function determineRequestType(submissionData) {
    // Check if user provided hint
    if (submissionData.requestTypeHint) {
      return submissionData.requestTypeHint;
    }
    // Analyze responses to determine type - ES5 compatible version
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
          if (typeResponse.indexOf('Service Request') >= 0 || typeResponse.indexOf('Service Aanvraag') >= 0) return 'service_request';
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
      return 'service_request';
    }
    return 'other';
  }
  // Helper functions
  function truncateString(str, maxLength) {
    if (!str) return '';
    return str.length > maxLength ? str.substring(0, maxLength - 3) + '...' : str;
  }
  function buildFullDescription(submissionData) {
    var description = 'Original Request: ' + submissionData.initialRequest + '\n\n';
    description += 'AI-Powered Questions and Responses:\n';
    for (var i = 0; i < submissionData.aiQuestions.length; i++) {
      var question = submissionData.aiQuestions[i];
      var response = submissionData.responses[i] || 'No response';
      description += (i + 1) + '. ' + question.question + '\n';
      description += '   Answer: ' + response + '\n\n';
    }
    return description;
  }
  function mapPriority(priority) {
    if (priority === 'Kritiek' || priority === 'Critical') return '1';
    if (priority === 'Hoog' || priority === 'High') return '2';
    if (priority === 'Gemiddeld' || priority === 'Medium') return '3';
    if (priority === 'Laag' || priority === 'Low') return '4';
    return '3'; // Default to Medium
  }
  function mapUrgency(urgency) {
    if (urgency === 'Kritiek' || urgency === 'Critical') return '1';
    if (urgency === 'Hoog' || urgency === 'High') return '2';
    if (urgency === 'Gemiddeld' || urgency === 'Medium') return '3';
    if (urgency === 'Laag' || urgency === 'Low') return '4';
    return '3'; // Default to Medium
  }
  function mapImpact(impact) {
    if (typeof impact === 'string') {
      if (impact.indexOf('High') >= 0 || impact.indexOf('Hoog') >= 0) return '1';
      if (impact.indexOf('Medium') >= 0 || impact.indexOf('Gemiddeld') >= 0) return '2';
      if (impact.indexOf('Low') >= 0 || impact.indexOf('Laag') >= 0) return '3';
    }
    return '2'; // Default to Medium
  }