# TSMAI Module Dependency Diagram

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                    Service Portal Widget Server Script                  │
│                   (ai_universal_request_handler.server.js)              │
│                                                                         │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                │ Uses
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                      TSMAIRequestOrchestrator                           │
│                         (Main Entry Point)                              │
│                            563 lines                                    │
│                                                                         │
│  • generateIntelligentResponse()  • submitUniversalRequest()            │
│  • determineRequestType()         • buildFullDescription()             │
│  • Delegates to 5 specialized modules                                   │
│                                                                         │
└──┬────┬────┬────┬────┬────────────────────────────────────────────────┘
   │    │    │    │    │
   │    │    │    │    │
   │    │    │    │    └──────────────────────────────────┐
   │    │    │    │                                        │
   │    │    │    └──────────────────────────┐            │
   │    │    │                                │            │
   │    │    └──────────────┐                │            │
   │    │                   │                │            │
   │    └──────┐            │                │            │
   │           │            │                │            │
   ▼           ▼            ▼                ▼            ▼
┌─────┐   ┌─────────┐  ┌────────────┐  ┌─────────┐  ┌───────────┐
│     │   │         │  │            │  │         │  │           │
│  1  │   │    2    │  │     3      │  │    4    │  │     5     │
│     │   │         │  │            │  │         │  │           │
└─────┘   └─────────┘  └────────────┘  └─────────┘  └───────────┘
```

## Detailed Module Dependencies

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  1. TSMAIStatusTracker (91 lines)                                       │
│                                                                          │
│  ┌────────────────────────────────────────────────────────┐             │
│  │ PURPOSE: Real-time status tracking                     │             │
│  │ DEPENDENCIES: None (standalone)                        │             │
│  │                                                         │             │
│  │ FUNCTIONS:                                              │             │
│  │ • initStatusTracker(sessionId)                          │             │
│  │ • updateStatus(stepName, status, message)              │             │
│  │ • getStatus(sessionId)                                  │             │
│  └────────────────────────────────────────────────────────┘             │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  2. TSMAIClassifier (182 lines)                                         │
│                                                                          │
│  ┌────────────────────────────────────────────────────────┐             │
│  │ PURPOSE: Request classification (QUESTION/REQUEST/INC) │             │
│  │ DEPENDENCIES: TSMAIRequestHelpers ────────────────┐    │             │
│  │                                                    │    │             │
│  │ FUNCTIONS:                                         │    │             │
│  │ • detectServiceRequestIntent()                     │    │             │
│  │ • classifyRequest()                                │    │             │
│  │ • classifyByKeywords()                             │    │             │
│  └────────────────────────────────────────────────────┼────┘             │
│                                                       │                  │
│                                                       ▼                  │
│                                              ┌─────────────────┐         │
│                                              │ Helpers Module  │         │
│                                              │ (utilities)     │         │
│                                              └─────────────────┘         │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  3. TSMAISearchEngine (944 lines - LARGEST MODULE)                      │
│                                                                          │
│  ┌────────────────────────────────────────────────────────┐             │
│  │ PURPOSE: Unified KB & Catalog search                   │             │
│  │ DEPENDENCIES: TSMAIRequestHelpers ────────────────┐    │             │
│  │                                                    │    │             │
│  │ FUNCTIONS:                                         │    │             │
│  │ • searchUnified()          ◄─── MAIN ENTRY        │    │             │
│  │ • extractSearchKeywords()                          │    │             │
│  │ • searchServiceCatalog()                           │    │             │
│  │ • fallbackCatalogSearch()                          │    │             │
│  │ • evaluateCatalogRelevance()                       │    │             │
│  │ • searchKnowledgeBase()                            │    │             │
│  │ • fallbackKnowledgeSearch()                        │    │             │
│  │ • evaluateKnowledgeRelevance()                     │    │             │
│  │ • searchAgentKnowledge()                           │    │             │
│  │ • filterCatalogItemsByRelevance()                  │    │             │
│  └────────────────────────────────────────────────────┼────┘             │
│                                                       │                  │
│                                                       ▼                  │
│                                              ┌─────────────────┐         │
│                                              │ Helpers Module  │         │
│                                              │ (AI calls, etc) │         │
│                                              └─────────────────┘         │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  4. TSMAIQuestionGenerator (230 lines)                                  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────┐             │
│  │ PURPOSE: AI-powered question generation                │             │
│  │ DEPENDENCIES: TSMAIRequestHelpers ────────────────┐    │             │
│  │                                                    │    │             │
│  │ FUNCTIONS:                                         │    │             │
│  │ • generateQuestionsFromAI()    ◄─── MAIN ENTRY    │    │             │
│  │ • createQuestionGenerationPrompt()                 │    │             │
│  │ • parseAIQuestions()                               │    │             │
│  │ • getDefaultQuestions()                            │    │             │
│  └────────────────────────────────────────────────────┼────┘             │
│                                                       │                  │
│                                                       ▼                  │
│                                              ┌─────────────────┐         │
│                                              │ Helpers Module  │         │
│                                              │ (LLM prompts)   │         │
│                                              └─────────────────┘         │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  5. TSMAITicketFactory (468 lines)                                      │
│                                                                          │
│  ┌────────────────────────────────────────────────────────┐             │
│  │ PURPOSE: AI-enhanced ticket creation                   │             │
│  │ DEPENDENCIES:                                          │             │
│  │   TSMAISearchEngine ──────────────┐                    │             │
│  │        └─▶ TSMAIRequestHelpers    │                    │             │
│  │                                   │                    │             │
│  │ FUNCTIONS:                        │                    │             │
│  │ • generateAISummaryAndCategorization()                 │             │
│  │ • createIncidentWithAI()                               │             │
│  │ • createProblemWithAI()                                │             │
│  │ • createChangeWithAI()                                 │             │
│  │ • createServiceRequestWithAI()                         │             │
│  │ • createHRCaseWithAI()                                 │             │
│  │ • createQueryTicket()                                  │             │
│  │ • buildAIEnhancedDescription()                         │             │
│  │ • attachScreenshotsToRecord()                          │             │
│  └────────────────────────────────────┼────────────────────┘             │
│                                       │                                  │
│                                       ▼                                  │
│                              ┌─────────────────┐                         │
│                              │ SearchEngine    │                         │
│                              │ (for AI calls)  │                         │
│                              └────────┬────────┘                         │
│                                       │                                  │
│                                       ▼                                  │
│                              ┌─────────────────┐                         │
│                              │ Helpers Module  │                         │
│                              └─────────────────┘                         │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  6. TSMAIAgentCore (480 lines)                                          │
│                                                                          │
│  ┌────────────────────────────────────────────────────────┐             │
│  │ PURPOSE: Core AI intelligence & decision making        │             │
│  │ DEPENDENCIES:                                          │             │
│  │   TSMAIRequestHelpers ────────────────┐               │             │
│  │   TSMAISearchEngine ──────────────────┼───┐           │             │
│  │        └─▶ TSMAIRequestHelpers        │   │           │             │
│  │                                       │   │           │             │
│  │ FUNCTIONS:                            │   │           │             │
│  │ • createAIAgent()   ◄─── MAIN ENTRY   │   │           │             │
│  │   ├─ determineSearchStrategy()        │   │           │             │
│  │   ├─ needsAdditionalResources()       │   │           │             │
│  │   └─ generateProgressUpdate()         │   │           │             │
│  │ • generateDirectAnswerWithKnowledge() │   │           │             │
│  │ • generateSuggestionsWithKnowledge()  │   │           │             │
│  │ • generateDirectAnswer()              │   │           │             │
│  │ • generateSuggestions()               │   │           │             │
│  └───────────────────────────────────────┼───┼───────────┘             │
│                                          │   │                         │
│                                          ▼   ▼                         │
│                               ┌──────────────────────┐                  │
│                               │  SearchEngine        │                  │
│                               │  Helpers             │                  │
│                               └──────────────────────┘                  │
└──────────────────────────────────────────────────────────────────────────┘
```

## Complete Dependency Chain

```
┌────────────────────────────────────────────────────────────────────────┐
│                                                                        │
│                       TSMAIRequestHelpers                              │
│                      (Foundation Module)                               │
│                   • callOpenAI()                                       │
│                   • detectLanguage()                                   │
│                   • parseJSONResponse()                                │
│                   • truncateString()                                   │
│                   • ... (all utility functions)                        │
│                                                                        │
└──┬─────────────────────────────────────┬──────────────────────────────┘
   │                                     │
   │ Used by                             │ Used by
   │                                     │
   ▼                                     ▼
┌──────────────────────┐      ┌──────────────────────┐
│  TSMAIClassifier     │      │  TSMAISearchEngine   │
│                      │      │                      │
│  (Classification)    │      │  (Search Ops)        │
└──────────────────────┘      └─────────┬────────────┘
                                        │
                                        │ Used by
                                        │
                              ┌─────────┴──────────┐
                              │                    │
                              ▼                    ▼
                  ┌────────────────────┐  ┌────────────────────┐
                  │  TSMAITicketFactory│  │  TSMAIAgentCore    │
                  │                    │  │                    │
                  │  (Ticket Creation) │  │  (AI Intelligence) │
                  └────────────────────┘  └────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│                      TSMAIStatusTracker                                  │
│                      (Standalone - No Dependencies)                      │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

                         ALL MODULES COORDINATED BY
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│                     TSMAIRequestOrchestrator                             │
│                     (Uses All 6 Modules)                                 │
│                                                                          │
│  this.statusTracker = new TSMAIStatusTracker();                          │
│  this.classifier = new TSMAIClassifier();                                │
│  this.searchEngine = new TSMAISearchEngine();                            │
│  this.agentCore = new TSMAIAgentCore();                                  │
│  this.ticketFactory = new TSMAITicketFactory();                          │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Data Flow Example: Creating an Incident

```
User Request: "My laptop won't turn on"
        │
        ▼
┌────────────────────────────────────────────────────────────┐
│ 1. TSMAIRequestOrchestrator.generateIntelligentResponse()  │
└─────────────────────┬──────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
┌──────────────┐ ┌──────────┐ ┌─────────────┐
│ StatusTracker│ │Classifier│ │SearchEngine │
│ Initialize   │ │ Classify │ │ Search KB   │
│ Session      │ │ Request  │ │ & Catalog   │
└──────────────┘ └─────┬────┘ └──────┬──────┘
                       │             │
                       │  Result:    │  Result:
                       │  "incident" │  Articles
                       │             │  & Items
                       └──────┬──────┘
                              ▼
                  ┌─────────────────────┐
                  │ AgentCore           │
                  │ Generate            │
                  │ Suggestions         │
                  └──────────┬──────────┘
                             │
                             │  Result:
                             │  Suggestions
                             ▼
                  ┌─────────────────────┐
                  │ QuestionGenerator   │
                  │ Generate            │
                  │ Follow-up Questions │
                  └──────────┬──────────┘
                             │
                             │  Questions
                             ▼
                  ┌─────────────────────┐
                  │ Return to Widget    │
                  │ Display to User     │
                  └─────────────────────┘

User Answers Questions
        │
        ▼
┌────────────────────────────────────────────────────────────┐
│ 2. TSMAIRequestOrchestrator.submitUniversalRequest()       │
└─────────────────────┬──────────────────────────────────────┘
                      │
                      ▼
           ┌────────────────────┐
           │ TicketFactory      │
           │ Create Incident    │
           │ with AI Summary    │
           └─────────┬──────────┘
                     │
                     │  Ticket Created
                     ▼
           ┌────────────────────┐
           │ Return Ticket #    │
           │ to User            │
           └────────────────────┘
```

## Module Communication Patterns

### Pattern 1: Direct Delegation (Orchestrator → Module)
```
Orchestrator                Module
     │                         │
     │  Method Call            │
     ├────────────────────────▶│
     │                         │
     │                    Execute
     │                         │
     │  Return Result          │
     │◀────────────────────────┤
     │                         │
```

### Pattern 2: Module Collaboration (Module → Module)
```
AgentCore              SearchEngine           Helpers
    │                       │                    │
    │  Search Request       │                    │
    ├──────────────────────▶│                    │
    │                       │  LLM Call          │
    │                       ├───────────────────▶│
    │                       │                    │
    │                       │  Response          │
    │                       │◀───────────────────┤
    │  Search Results       │                    │
    │◀──────────────────────┤                    │
    │                       │                    │
```

### Pattern 3: Status Updates (Orchestrator → StatusTracker)
```
Orchestrator          StatusTracker
     │                     │
     │  updateStatus()     │
     ├────────────────────▶│  Store in session
     │                     │  (GlideSession)
     │  Acknowledged       │
     │◀────────────────────┤
     │                     │
     │  getStatus()        │
     ├────────────────────▶│  Retrieve from
     │                     │  session
     │  Status Object      │
     │◀────────────────────┤
     │                     │
```

## Import Order for ServiceNow

When deploying to ServiceNow, create Script Includes in this order:

1. **TSMAIRequestHelpers** (if not already created)
   - Base utilities
   - No dependencies

2. **TSMAIStatusTracker**
   - Standalone module
   - No dependencies

3. **TSMAIClassifier**
   - Depends on: TSMAIRequestHelpers

4. **TSMAISearchEngine**
   - Depends on: TSMAIRequestHelpers

5. **TSMAIQuestionGenerator**
   - Depends on: TSMAIRequestHelpers

6. **TSMAIAgentCore**
   - Depends on: TSMAIRequestHelpers, TSMAISearchEngine

7. **TSMAITicketFactory**
   - Depends on: TSMAISearchEngine (→ TSMAIRequestHelpers)

8. **TSMAIRequestOrchestrator**
   - Depends on: ALL modules above

9. Update widget server script to use TSMAIRequestOrchestrator

## Key Architectural Decisions

### 1. Orchestrator as Facade
- Single entry point for all operations
- Hides internal module complexity
- Provides stable API for widget

### 2. Modules are Self-Contained
- Each module can function independently
- Clear input/output contracts
- Minimal coupling between modules

### 3. Helper Module as Foundation
- Shared utilities prevent duplication
- Consistent AI calls across modules
- Centralized configuration

### 4. StatusTracker is Standalone
- No dependencies = no circular references
- Can be used by any module
- Simple session-based storage

### 5. SearchEngine as Hub
- Used by multiple modules
- Provides consistent search interface
- Encapsulates complex search logic

---

**Created:** January 2025
**Purpose:** Visual reference for TSMAI modular architecture
**Related:** See REFACTORING_GUIDE.md for detailed documentation
