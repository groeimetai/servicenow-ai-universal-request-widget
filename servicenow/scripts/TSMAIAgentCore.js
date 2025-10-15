/**
 * TSMAIAgentCore - AI Intelligence Module
 *
 * PURPOSE: Core AI logic for intelligent responses and suggestions
 * INPUT: User requests, knowledge base results, language, LLM settings
 * PROCESS: AI agents with strategic search, answer generation, suggestions
 * OUTPUT: AI-generated answers, suggestions, and agent-driven workflows
 *
 * DEPENDENCIES: TSMAIRequestHelpers, TSMAISearchEngine
 *
 * FUNCTIONS (5 + 3 nested):
 * - createAIAgent: Intelligent agent with search strategy
 *   - determineSearchStrategy: Plan search approach
 *   - needsAdditionalResources: Check if more search needed
 *   - generateProgressUpdate: Status messages
 * - generateDirectAnswerWithKnowledge: Answer with KB context
 * - generateSuggestionsWithKnowledge: Suggestions with KB context
 * - generateDirectAnswer: Simple answers (wrapper)
 * - generateSuggestions: Simple suggestions (wrapper)
 */

var TSMAIAgentCore = function() {};

TSMAIAgentCore.prototype = {

  createAIAgent: function(request, language, llmEnabled) {
    var self = this;
    return {
      // Determine what to search and in what order
      determineSearchStrategy: function(classification, userRequest, lang) {
        var strategy = {
          searchOrder: [],
          reasoning: ''
        };

        // AI reasoning about what to search
        if (classification.type === 'request' || classification.isServiceRequest) {
          // For service requests, prioritize catalog but also check knowledge
          strategy.searchOrder = ['catalog', 'knowledge'];
          strategy.reasoning = lang === 'Dutch'
            ? 'Service aanvraag gedetecteerd - zoek eerst in catalogus, daarna in kennisbank voor aanvullende informatie'
            : 'Service request detected - searching catalog first, then knowledge base for additional information';
        } else if (classification.type === 'question') {
          // For questions, prioritize knowledge but also check if there are related services
          strategy.searchOrder = ['knowledge', 'catalog'];
          strategy.reasoning = lang === 'Dutch'
            ? 'Informatieve vraag gedetecteerd - zoek eerst in kennisbank, controleer daarna of er gerelateerde services zijn'
            : 'Informational question detected - searching knowledge base first, then checking for related services';
        } else {
          // For complex issues, search both comprehensively
          strategy.searchOrder = ['knowledge', 'catalog'];
          strategy.reasoning = lang === 'Dutch'
            ? 'Complex probleem gedetecteerd - doorzoek alle beschikbare bronnen voor complete oplossing'
            : 'Complex issue detected - searching all available resources for comprehensive solution';
        }

        return strategy;
      },

      // Decide if we need to search more resources
      needsAdditionalResources: function(currentResults, resourceType) {
        // If we found good catalog items, still check knowledge for documentation
        if (resourceType === 'catalog' && currentResults && currentResults.results && currentResults.results.length > 0) {
          // We found catalog items, but should still search knowledge for how-to guides
          return true;
        }

        // If we found knowledge articles, check if there might be related services
        if (resourceType === 'knowledge' && currentResults && currentResults.isRelevant) {
          // We found relevant knowledge, but might still want to offer services
          return true;
        }

        // If nothing found, definitely search more
        if (!currentResults || (currentResults.results && currentResults.results.length === 0)) {
          return true;
        }

        return false;
      },

      // Generate progress updates for the user
      generateProgressUpdate: function(step, lang) {
        var updates = {
          'classifying': lang === 'Dutch'
            ? 'AI analyseert uw aanvraag...'
            : 'AI is analyzing your request...',
          'searching_catalog': lang === 'Dutch'
            ? 'Zoeken naar relevante services in de catalogus...'
            : 'Searching for relevant services in the catalog...',
          'searching_knowledge': lang === 'Dutch'
            ? 'Zoeken naar relevante informatie in de kennisbank...'
            : 'Searching for relevant information in the knowledge base...',
          'evaluating': lang === 'Dutch'
            ? 'Evalueren van gevonden resultaten...'
            : 'Evaluating found results...',
          'generating_response': lang === 'Dutch'
            ? 'AI genereert het beste antwoord voor u...'
            : 'AI is generating the best response for you...'
        };
        return updates[step] || '';
      }
    };
  },

  /**
   * Detect if request is about a service request or catalog item
   *
   * INPUT: request (string), language (string), llmEnabled (boolean), relevantKnowledge (object)
   * PROCESS: Checks for service-related keywords in the request
   * OUTPUT: Boolean indicating if this is likely a service request
   */
  generateDirectAnswerWithKnowledge: function(request, language, llmEnabled, relevantKnowledge) {
    try {
      var helpers = new TSMAIRequestHelpers();
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
          var displayNumber = article.number.indexOf('KB') === 0 ? article.number : 'KB' + article.number;
          knowledgeContext += 'Article Number: ' + displayNumber + '\n';
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
          prompt += '\nSITUATIE: De knowledge base search heeft geen specifieke artikelen gevonden.\n';
          prompt += 'INSTRUCTIE: Geef ALTIJD een nuttig antwoord, ook zonder kennisartikelen.\n\n';
          prompt += 'Begin je antwoord NOOIT met "Ik kan deze vraag niet beantwoorden" of "Laten we een ticket maken".\n';
          prompt += 'Begin met een POSITIEF en BEHULPZAAM antwoord gebaseerd op algemene IT kennis.\n\n';
          prompt += 'Bijvoorbeeld:\n';
          prompt += '- "Het intranet is meestal toegankelijk via..."\n';
          prompt += '- "Om dit te vinden kun je..."\n';
          prompt += '- "Hier zijn de stappen..."\n\n';
          prompt += 'Gebruik GEEN markdown formatting zoals ** of ##, gebruik gewone tekst.\n';
          prompt += 'BELANGRIJK: Wees direct behulpzaam, geen excuses of uitstel naar tickets.\n';
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
          prompt += '\nSITUATION: The knowledge base search did not find specific articles.\n';
          prompt += 'INSTRUCTION: ALWAYS provide a useful answer, even without knowledge articles.\n\n';
          prompt += 'NEVER start your answer with "I cannot answer this question" or "Let\'s create a ticket".\n';
          prompt += 'Start with a POSITIVE and HELPFUL answer based on general IT knowledge.\n\n';
          prompt += 'Examples:\n';
          prompt += '- "The intranet is typically accessible via..."\n';
          prompt += '- "To find this you can..."\n';
          prompt += '- "Here are the steps..."\n\n';
          prompt += 'Do NOT use markdown formatting like ** or ##, use plain text.\n';
          prompt += 'IMPORTANT: Be directly helpful, no apologies or ticket escalation.\n';
        }
        prompt += 'Provide a clear, practical answer in maximum 300 words.';
      }

      var response = helpers.callOpenAI(prompt, llmEnabled, null, 400);
      if (response.success) {
        var formattedAnswer = helpers.convertMarkdownToHTML(response.content);
        // Add knowledge sources at the bottom if available
        if (hasKnowledgeSources) {
          formattedAnswer += helpers.formatKnowledgeSourcesHTML(sourceReferences, language);
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
        answer: helpers.convertMarkdownToHTML(fallbackMsg),
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
  },

  /**
   * Generate suggestions with knowledge base enhancement
   *
   * INPUT: request (string), language (string), llmEnabled (boolean), relevantKnowledge (object)
   * PROCESS: Creates troubleshooting suggestions using KB context and AI
   * OUTPUT: Object with suggestions array, confidence, sources, and sources HTML
   */
  generateSuggestionsWithKnowledge: function(request, language, llmEnabled, relevantKnowledge) {
    try {
      var helpers = new TSMAIRequestHelpers();
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
          var displayNumber = article.number.indexOf('KB') === 0 ? article.number : 'KB' + article.number;
          knowledgeContext += 'Article Number: ' + displayNumber + '\n';
          sourceReferences.push(article);
        }
      }
      
      var prompt = '';
      if (language === 'Dutch') {
        prompt = 'Je bent een IT support assistent. Geef ALLEEN de meest BASALE, VEILIGE eerste hulp tips.\n\n';
        prompt += 'Probleem: "' + request + '"\n';
        if (hasKnowledgeSources) {
          prompt += knowledgeContext + '\n';
        }
        prompt += '\n🚨 BELANGRIJKE BEPERKINGEN - STRIKT NALEVEN:\n\n';
        prompt += '=== CONTEXT-BEWUSTE SUGGESTIES ===\n';
        prompt += 'EERST: Bepaal of dit een SOFTWARE of HARDWARE probleem is.\n\n';
        prompt += 'Voor SOFTWARE problemen (app werkt niet, login issues, browser problemen):\n';
        prompt += '✅ Applicatie/browser herstarten\n';
        prompt += '✅ Opnieuw inloggen\n';
        prompt += '✅ Andere browser proberen\n';
        prompt += '✅ Browser cache legen\n';
        prompt += '✅ Internetverbinding controleren\n\n';
        prompt += 'Voor HARDWARE problemen (apparaat start niet, scherm zwart, laptop kapot):\n';
        prompt += '✅ Houd aan/uit knop 10 seconden ingedrukt (harde reset)\n';
        prompt += '✅ Controleer of oplader goed aangesloten is\n';
        prompt += '✅ Controleer of lampjes branden\n';
        prompt += '✅ Wacht 2 minuten en probeer opnieuw op te starten\n';
        prompt += '⚠️ Als apparaat niet reageert na hard reset: Maak direct ticket aan\n\n';
        prompt += '=== ABSOLUUT VERBODEN (HARDWARE MODIFICATIES) ===\n';
        prompt += '❌ NOOIT batterij verwijderen of plaatsen\n';
        prompt += '❌ NOOIT apparaat openen\n';
        prompt += '❌ NOOIT interne componenten aanraken\n';
        prompt += '❌ NOOIT kabels permanent loskoppelen\n';
        prompt += '❌ NOOIT onderdelen vervangen\n\n';
        prompt += '=== GEAVANCEERDE ACTIES VERBODEN ===\n';
        prompt += '❌ System instellingen wijzigen\n';
        prompt += '❌ Software installeren/verwijderen\n';
        prompt += '❌ Netwerk configuraties aanpassen\n';
        prompt += '❌ Admin rechten gebruiken\n';
        prompt += '❌ Registry edits\n';
        prompt += '❌ Command prompt commando\'s\n\n';
        prompt += 'PRINCIPE: Drukknoppen = OK. Apparaat openen = VERBODEN!\n\n';
        prompt += 'Geef suggesties in JSON format (max 3 basis stappen, MATCH DE SUGGESTIES BIJ HET PROBLEEM TYPE):\n';
        prompt += '[\n';
        prompt += '  "Stap 1: [veilige basis actie passend bij probleem - software tips voor software problemen, safe hardware acties voor hardware problemen]",\n';
        prompt += '  "Stap 2: [nog een veilige basis actie]",\n';
        prompt += '  "Als dit niet helpt: Maak een ticket aan - dit vereist IT ondersteuning"\n';
        prompt += ']\n\n';
        prompt += '⚠️ BIJ TWIJFEL: Zeg meteen "Maak een ticket aan". Safety first!';
      } else {
        prompt = 'You are an IT support assistant. Provide ONLY the most BASIC, SAFE first aid tips.\n\n';
        prompt += 'Problem: "' + request + '"\n';
        if (hasKnowledgeSources) {
          prompt += knowledgeContext + '\n';
        }
        prompt += '\n🚨 IMPORTANT LIMITATIONS - STRICTLY ENFORCE:\n\n';
        prompt += '=== CONTEXT-AWARE SUGGESTIONS ===\n';
        prompt += 'FIRST: Determine if this is a SOFTWARE or HARDWARE problem.\n\n';
        prompt += 'For SOFTWARE problems (app not working, login issues, browser problems):\n';
        prompt += '✅ Restart application/browser\n';
        prompt += '✅ Log out and log back in\n';
        prompt += '✅ Try different browser\n';
        prompt += '✅ Clear browser cache\n';
        prompt += '✅ Check internet connection\n\n';
        prompt += 'For HARDWARE problems (device won\'t start, black screen, broken laptop):\n';
        prompt += '✅ Hold power button for 10 seconds (hard reset)\n';
        prompt += '✅ Check if charger is properly connected\n';
        prompt += '✅ Check if any lights are on\n';
        prompt += '✅ Wait 2 minutes and try to restart again\n';
        prompt += '⚠️ If device doesn\'t respond after hard reset: Create ticket immediately\n\n';
        prompt += '=== ABSOLUTELY FORBIDDEN (HARDWARE MODIFICATIONS) ===\n';
        prompt += '❌ NEVER remove or insert battery\n';
        prompt += '❌ NEVER open device\n';
        prompt += '❌ NEVER touch internal components\n';
        prompt += '❌ NEVER permanently disconnect cables\n';
        prompt += '❌ NEVER replace parts\n\n';
        prompt += '=== ADVANCED ACTIONS FORBIDDEN ===\n';
        prompt += '❌ Change system settings\n';
        prompt += '❌ Install/uninstall software\n';
        prompt += '❌ Modify network configurations\n';
        prompt += '❌ Use admin rights\n';
        prompt += '❌ Registry edits\n';
        prompt += '❌ Command prompt commands\n\n';
        prompt += 'PRINCIPLE: Pressing buttons = OK. Opening device = FORBIDDEN!\n\n';
        prompt += 'Provide suggestions in JSON format (max 3 basic steps, MATCH SUGGESTIONS TO PROBLEM TYPE):\n';
        prompt += '[\n';
        prompt += '  "Step 1: [safe basic action matching problem - software tips for software problems, safe hardware actions for hardware problems]",\n';
        prompt += '  "Step 2: [another safe basic action]",\n';
        prompt += '  "If this does not help: Create a ticket - this requires IT support"\n';
        prompt += ']\n\n';
        prompt += '⚠️ WHEN IN DOUBT: Say immediately "Create a ticket". Safety first!';
      }

      var response = helpers.callOpenAI(prompt, llmEnabled, null, 500);
      if (response.success) {
        var suggestions = helpers.parseJSONResponse(response.content);
        if (suggestions && suggestions.length > 0) {
          // Convert any markdown in suggestions to HTML
          var htmlSuggestions = [];
          for (var i = 0; i < suggestions.length; i++) {
            htmlSuggestions.push(helpers.convertMarkdownToHTML(suggestions[i]));
          }
          
          // Create formatted response with sources
          var formattedResponse = {
            suggestions: htmlSuggestions,
            confidence: hasKnowledgeSources ? 'high' : 'medium',
            sources: sourceReferences
          };
          
          // Add knowledge sources HTML if available
          if (hasKnowledgeSources) {
            formattedResponse.sourcesHTML = helpers.formatKnowledgeSourcesHTML(sourceReferences, language);
          }
          return formattedResponse;
        }
      }
      
      // Fallback safe suggestions - general troubleshooting that works for most problems
      var fallbackSuggestions = language === 'Dutch'
        ? ['Stap 1: Wacht even en probeer het opnieuw (2-3 minuten)', 'Stap 2: Controleer of alles goed aangesloten is (internet, oplader)', 'Stap 3: Probeer het apparaat opnieuw te starten', 'Als dit niet helpt: Maak een ticket aan - dit vereist IT ondersteuning']
        : ['Step 1: Wait a moment and try again (2-3 minutes)', 'Step 2: Check if everything is properly connected (internet, charger)', 'Step 3: Try restarting the device', 'If this does not help: Create a ticket - this requires IT support'];
      
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
  },

  /**
   * Create AI prompt for question generation (legacy compatibility)
   *
   * INPUT: request (string), language (string), llmEnabled (boolean), screenshots (array)
   * PROCESS: Creates structured prompt for AI to generate relevant questions with screenshot context
   * OUTPUT: String - Complete AI prompt for question generation
   */
  generateDirectAnswer: function(request, language, llmEnabled, screenshots) {
    try {
      var helpers = new TSMAIRequestHelpers();
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

      var response = helpers.callOpenAI(prompt, llmEnabled, null, 300, screenshots);
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
  },

  /**
   * Generate suggestions for troubleshooting (legacy compatibility)
   *
   * INPUT: request (string), language (string), llmEnabled (boolean), screenshots (array)
   * PROCESS: Creates troubleshooting suggestions without knowledge base integration, uses screenshots for visual context
   * OUTPUT: Object with suggestions array and confidence level
   */
  generateSuggestions: function(request, language, llmEnabled, screenshots) {
    try {
      var helpers = new TSMAIRequestHelpers();
      var prompt = '';
      if (language === 'Dutch') {
        prompt = 'Je bent een IT support assistent. Geef ALLEEN simpele, VEILIGE eerste hulp tips.\n\n';
        prompt += 'Probleem: "' + request + '"\n\n';
        prompt += '🚨 BELANGRIJK:\n';
        prompt += 'Bepaal eerst: is dit SOFTWARE (app/browser) of HARDWARE (apparaat) probleem?\n\n';
        prompt += 'Voor SOFTWARE: ✅ app herstarten, opnieuw inloggen, andere browser, cache legen\n';
        prompt += 'Voor HARDWARE: ✅ power knop 10 sec vasthouden, oplader controleren, lampjes checken\n\n';
        prompt += '❌ VERBODEN: batterij verwijderen, apparaat openen, instellingen wijzigen, software installeren\n\n';
        prompt += 'Geef basis stappen in JSON format (max 3, MATCH BIJ PROBLEEM TYPE):\n';
        prompt += '[\n';
        prompt += '  "Stap 1: [veilige basis actie passend bij probleem]",\n';
        prompt += '  "Stap 2: [nog een veilige basis actie]",\n';
        prompt += '  "Als dit niet helpt: Maak een ticket aan"\n';
        prompt += ']\n\n';
        prompt += 'Gebruik ALLEEN gewone tekst zonder **, ##, of andere opmaak.\n';
        prompt += 'Bij twijfel: direct naar ticket!';
      } else {
        prompt = 'You are an IT support assistant. Provide ONLY simple, SAFE first aid tips.\n\n';
        prompt += 'Problem: "' + request + '"\n\n';
        prompt += '🚨 IMPORTANT:\n';
        prompt += 'First determine: is this SOFTWARE (app/browser) or HARDWARE (device) problem?\n\n';
        prompt += 'For SOFTWARE: ✅ restart app, log in again, different browser, clear cache\n';
        prompt += 'For HARDWARE: ✅ hold power button 10 sec, check charger, check lights\n\n';
        prompt += '❌ FORBIDDEN: remove battery, open device, change settings, install software\n\n';
        prompt += 'Provide basic steps in JSON format (max 3, MATCH TO PROBLEM TYPE):\n';
        prompt += '[\n';
        prompt += '  "Step 1: [safe basic action matching problem]",\n';
        prompt += '  "Step 2: [another safe basic action]",\n';
        prompt += '  "If this does not help: Create a ticket"\n';
        prompt += ']\n\n';
        prompt += 'Use ONLY plain text without **, ##, or other formatting.\n';
        prompt += 'When in doubt: escalate to ticket immediately!';
      }

      var response = helpers.callOpenAI(prompt, llmEnabled, null, 400, screenshots);
      if (response.success) {
        var suggestions = helpers.parseJSONResponse(response.content);
        if (suggestions && suggestions.length > 0) {
          return {
            suggestions: suggestions,
            confidence: 'high'
          };
        }
      }

      // Fallback safe suggestions - general troubleshooting that works for most problems
      var fallbackSuggestions = language === 'Dutch'
        ? ['Stap 1: Wacht even en probeer het opnieuw (2-3 minuten)', 'Stap 2: Controleer of alles goed aangesloten is (internet, oplader)', 'Stap 3: Probeer het apparaat opnieuw te starten', 'Als dit niet helpt: Maak een ticket aan - dit vereist IT ondersteuning']
        : ['Step 1: Wait a moment and try again (2-3 minutes)', 'Step 2: Check if everything is properly connected (internet, charger)', 'Step 3: Try restarting the device', 'If this does not help: Create a ticket - this requires IT support'];

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
  },

  /**
   * Attach screenshots to a ServiceNow record
   *
   * INPUT: tableName (string), recordSysId (string), screenshots (array)
   * PROCESS: Creates attachments for each screenshot using GlideSysAttachment
   * OUTPUT: void (attachments created)
   */

  type: 'TSMAIAgentCore'
};
