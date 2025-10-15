# 🚀 ServiceNow AI Universal Request Widget - Quick Start

## 📁 What's Important?

### ✅ Script Includes (Use These)

**Core Helper (Required by all modules):**
- `scripts/TSMAIRequestHelpers.js` - **NEW v2.0.0** Generic OpenAI integration

**Main Entry Point:**
- `scripts/TSMAIRequestOrchestrator.js` - Main coordinator (use this in your code)

**Specialized Modules (Auto-loaded by Orchestrator):**
- `scripts/TSMAIAgentCore.js` - AI intelligence and responses
- `scripts/TSMAIClassifier.js` - Request classification
- `scripts/TSMAIQuestionGenerator.js` - Dynamic question generation
- `scripts/TSMAISearchEngine.js` - Knowledge Base + Catalog search
- `scripts/TSMAIStatusTracker.js` - Real-time status tracking
- `scripts/TSMAITicketFactory.js` - AI-enhanced ticket creation

### ✅ Widgets (Ready to Deploy)

**Main Widget:**
- `widgets/ai_universal_request_handler/` - Universal AI request form
  - Full conversational UI
  - **Real-time status polling** - See actual AI processing progress (v2.0.1)
  - Screenshot upload support
  - AI-powered question generation
  - Intelligent ticket creation

**Alternative Widget:**
- `widgets/snow-flow_ai_chatbot/` - Chatbot interface
  - Simple chat UI
  - Generic OpenAI implementation reference

### 📚 Documentation (Read These)

**Setup:**
- `/OPENAI_SETUP.md` - **START HERE** - Complete OpenAI configuration guide

**Architecture:**
- `scripts/REFACTORING_GUIDE.md` - Complete architecture overview
- `scripts/MODULE_DEPENDENCY_DIAGRAM.md` - Visual dependencies
- `widgets/ai_universal_request_handler/TECHNICAL_DOCUMENTATION.md` - Widget details

## 🎯 Which Files Do I Need?

### Minimum Setup (All modules required):
```
servicenow/scripts/
├── TSMAIRequestHelpers.js        ← Configure OpenAI (system properties)
├── TSMAIRequestOrchestrator.js   ← Main entry point
├── TSMAIAgentCore.js             ← AI responses
├── TSMAIClassifier.js            ← Classification
├── TSMAIQuestionGenerator.js     ← Questions
├── TSMAISearchEngine.js          ← Search
├── TSMAIStatusTracker.js         ← Status
└── TSMAITicketFactory.js         ← Ticket creation
```

### Plus one widget:
```
servicenow/widgets/
└── ai_universal_request_handler/  ← Main widget (recommended)
    ├── *.server.js                 ← Server script (uses Orchestrator)
    ├── *.client.js                 ← Client controller
    ├── *.template.html             ← HTML template
    ├── *.css                       ← Styles
    └── *.options.json              ← Configuration
```

## ⚙️ Configuration (v2.0.0 Generic Setup)

### Step 1: Create System Properties

In ServiceNow, navigate to **System Properties > System Properties** and create:

1. **`openai.api.key`**
   - Type: String (Password)
   - Value: Your OpenAI API key (get from https://platform.openai.com/api-keys)

2. **`openai.api.model`**
   - Type: String
   - Value: `gpt-5-nano-2025-08-07` (or your preferred model)

### Step 2: Import Scripts

Upload all 8 Script Includes to ServiceNow in this order:

1. TSMAIRequestHelpers (no dependencies)
2. TSMAIStatusTracker (no dependencies)
3. TSMAISearchEngine (uses Helpers)
4. TSMAIClassifier (uses Helpers)
5. TSMAIQuestionGenerator (uses Helpers)
6. TSMAIAgentCore (uses Helpers + SearchEngine)
7. TSMAITicketFactory (uses SearchEngine)
8. TSMAIRequestOrchestrator (uses all modules)

### Step 3: Import Widget

Upload the widget to Service Portal in ServiceNow.

### Step 4: Test

Run this background script to verify setup:

```javascript
var helpers = new TSMAIRequestHelpers();

// Test configuration
var apiKey = gs.getProperty('openai.api.key');
var model = gs.getProperty('openai.api.model');

gs.info('API Key configured: ' + (apiKey ? 'Yes' : 'No'));
gs.info('Model: ' + (model || 'Using default'));

// Test API call
var response = helpers.callOpenAI('Say hello!', true, null, 50);
if (response.success) {
  gs.info('✅ OpenAI integration working!');
  gs.info('Response: ' + response.content);
} else {
  gs.error('❌ Error: ' + response.error);
}

// Test orchestrator
var orchestrator = new TSMAIRequestOrchestrator();
gs.info('✅ Orchestrator loaded successfully');
```

## 🔄 What Changed in v2.0.0?

### ❌ Removed (Company-Specific)
- MID server integration
- Hardcoded 'alliander-ai-assistant' model
- Company-specific infrastructure dependencies

### ✅ Added (Generic)
- Direct OpenAI REST API calls
- Configurable system properties
- Portable, open-source ready code

### 🔧 Updated
All 5 AI modules now use `TSMAIRequestHelpers.callOpenAI()` with generic implementation:
- TSMAIAgentCore.js (4 API calls)
- TSMAIClassifier.js (1 API call)
- TSMAISearchEngine.js (3 API calls)
- TSMAIQuestionGenerator.js (1 API call)
- TSMAITicketFactory.js (1 API call)

**Total:** 10 OpenAI API calls, all using generic helper

## 🚫 What NOT to Use

### Old/Deprecated Files (Don't exist anymore):
- ❌ `TSMAIRequestCore.js` - Old 2,733-line monolithic script (refactored)
- ❌ MID server specific implementations
- ❌ Any files with `.old`, `.backup`, `_deprecated` suffixes

### Obsolete Documentation:
- ❌ `INSTALLATION.md` - Removed (replaced by OPENAI_SETUP.md)
- ❌ `PRODUCTION_CHECKLIST.md` - Removed (integrated into documentation)

## 📊 Architecture Overview

```
User Request
    ↓
Widget (server.js)
    ↓
TSMAIRequestOrchestrator ← Main Entry Point
    ├─▶ TSMAIStatusTracker
    ├─▶ TSMAIClassifier
    │   └─▶ TSMAIRequestHelpers (OpenAI)
    ├─▶ TSMAISearchEngine
    │   └─▶ TSMAIRequestHelpers (OpenAI)
    ├─▶ TSMAIQuestionGenerator
    │   └─▶ TSMAIRequestHelpers (OpenAI)
    ├─▶ TSMAIAgentCore
    │   ├─▶ TSMAIRequestHelpers (OpenAI)
    │   └─▶ TSMAISearchEngine
    └─▶ TSMAITicketFactory
        └─▶ TSMAISearchEngine
            └─▶ TSMAIRequestHelpers (OpenAI)
    ↓
Created Ticket (INC/REQ/CHG/PRB/HR/QUERY)
```

## 💡 Usage Example

```javascript
// In widget server script or background script:

// Initialize orchestrator
var orchestrator = new TSMAIRequestOrchestrator();

// Generate intelligent response
var result = orchestrator.generateIntelligentResponse(
  'I need a new laptop',
  'request',
  null,  // sessionId (optional)
  []     // screenshots (optional)
);

// Result contains:
// - classification: { type: 'request', confidence: 'high' }
// - suggestions: [...AI suggestions...]
// - knowledgeArticles: [...relevant KB articles...]
// - catalogItems: [...relevant catalog items...]
// - directAnswer: { answer: '...', reasoning: '...' }

// Submit request (creates ticket)
var ticket = orchestrator.submitUniversalRequest({
  initialRequest: 'I need a new laptop',
  requestTypeHint: 'request',
  responses: ['HP', 'Windows 11', 'Sales department'],
  aiQuestions: [...questions from generator...]
});

// Returns:
// {
//   success: true,
//   requestNumber: 'REQ0010001',
//   requestType: 'Service Request',
//   sys_id: 'abc123...'
// }
```

## 🆘 Troubleshooting

### "OpenAI API key not configured"
- Create system property: `openai.api.key`
- Value must start with `sk-`

### "Module not found" errors
- Import scripts in dependency order (see Step 2)
- TSMAIRequestHelpers must load first

### "HTTP 401 Unauthorized" from OpenAI
- Check API key is valid
- Test at https://platform.openai.com/playground

### Widget not loading
- Verify all 8 Script Includes are imported
- Check browser console for errors
- Verify system properties are set

## 📖 More Documentation

- **Complete Setup:** `/OPENAI_SETUP.md`
- **Architecture Details:** `scripts/REFACTORING_GUIDE.md`
- **Dependencies:** `scripts/MODULE_DEPENDENCY_DIAGRAM.md`
- **Widget Technical Docs:** `widgets/ai_universal_request_handler/TECHNICAL_DOCUMENTATION.md`

## 🎉 Ready to Go!

With all 8 Script Includes and the widget imported, plus the 2 system properties configured, you're ready to use the AI Universal Request Widget!

**Test it:** Navigate to the Service Portal and find the widget. Try "I need a new laptop" to see it in action!
