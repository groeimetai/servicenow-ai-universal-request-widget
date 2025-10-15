# 🤖 AI Universal Request Handler for ServiceNow

**Intelligent, AI-powered Service Portal widget that automatically classifies and processes user requests in ServiceNow**

![Version](https://img.shields.io/badge/version-2.0.1-blue.svg)
![ServiceNow](https://img.shields.io/badge/ServiceNow-Quebec+-green.svg)
![License](https://img.shields.io/badge/license-MIT-orange.svg)

## 🌟 What is this?

An advanced Service Portal widget that uses **AI to automatically understand** what users need, instead of forcing them to navigate complex forms. The widget:

- 🎯 **Auto-classifies requests** - Detects whether it's an incident, service request, question, or HR case
- ⚡ **Real-time status updates** - Shows live processing progress (v2.0.1)
- 🔍 **Intelligent search** - Finds relevant Knowledge Base articles and Catalog items
- 🤔 **Dynamic questions** - Generates contextual follow-up questions based on request type
- 📸 **Screenshot support** - Attach visual evidence to incidents
- 🌐 **Multilingual** - Automatically detects Dutch or English
- 🎨 **Modern UI** - Clean, responsive design that works on mobile

## 🆕 Latest Updates

### v2.0.1 - Real-Time Status Polling
- ✅ **LIVE feedback** - Client polls server every 500ms for actual processing status
- ✅ **Accurate timing** - Fast requests complete quickly, slow requests show progress
- ✅ **No fake delays** - Removed hardcoded timeouts, using real server-side tracking

### v2.0.0 - Generic OpenAI Integration
- ✅ **Portable** - Works with any OpenAI-compatible API (OpenAI, Azure, Anthropic, custom)
- ✅ **Configurable** - Uses ServiceNow system properties for API credentials
- ✅ **No dependencies** - Removed company-specific MID server requirements

## 🚀 Quick Start

### 1️⃣ Prerequisites

- ServiceNow instance (Quebec or newer recommended)
- OpenAI API key (or compatible API)
- Service Portal enabled
- Basic ServiceNow admin rights

### 2️⃣ Configuration

Create two system properties in ServiceNow:

**System Properties > System Properties:**

```javascript
// Required: Your OpenAI API key
openai.api.key = sk-proj-...

// Required: Model to use
openai.api.model = gpt-4o-mini
```

### 3️⃣ Installation

**Step 1: Import Script Includes** (in this order)

Navigate to **System Definition > Script Includes** and import these files from `servicenow/scripts/`:

1. `TSMAIRequestHelpers.js` - Foundation (no dependencies)
2. `TSMAIStatusTracker.js` - Status tracking (no dependencies)
3. `TSMAIClassifier.js` - Request classification
4. `TSMAIQuestionGenerator.js` - Dynamic questions
5. `TSMAISearchEngine.js` - KB/Catalog search
6. `TSMAIAgentCore.js` - AI intelligence
7. `TSMAITicketFactory.js` - Ticket creation
8. `TSMAIRequestOrchestrator.js` - Main coordinator

**Step 2: Import Widget**

Navigate to **Service Portal > Widgets** and create a new widget:

- Copy files from `servicenow/widgets/ai_universal_request_handler/`
- Import: `*.client.js`, `*.server.js`, `*.template.html`, `*.css`

**Step 3: Add to Portal Page**

Add the widget to your Service Portal page using the Page Designer.

### 4️⃣ Test Installation

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
```

## 📖 Documentation

- **[Quick Start Guide](./servicenow/QUICK_START.md)** - Complete setup instructions
- **[OpenAI Setup](./OPENAI_SETUP.md)** - Detailed API configuration
- **[Technical Documentation](./servicenow/widgets/ai_universal_request_handler/TECHNICAL_DOCUMENTATION.md)** - Architecture and code details

## 🎨 Features in Detail

### Intelligent Classification

The AI automatically determines request type by analyzing the user's description:

- **Incident** - "My laptop won't start"
- **Service Request** - "I need access to the financial application"
- **Question** - "How do I request vacation days?"
- **HR Case** - "When do I get my holiday pay?"

### Real-Time Status Tracking

Users see live updates during AI processing:

```
✓ Connecting to AI...
→ Classifying request...
  Searching Knowledge Base...
  Generating AI response...
```

### Dynamic Question Generation

AI generates contextual follow-up questions based on:

1. Request type (incident/service request/question/HR)
2. Specific situation described by user
3. Information needed to complete the ticket

**Example for "Outlook keeps crashing":**
- When exactly does Outlook crash?
- How many times per day?
- Do other Office apps work normally?

### Knowledge Integration

Automatically searches:
- **Knowledge Base articles** - Using semantic search (finds by meaning, not just keywords)
- **Service Catalog items** - Relevant services for service requests
- **Solutions** - Previous resolutions from similar tickets

## 🏗️ Architecture

### Widget Components

```
ai_universal_request_handler/
├── *.client.js          ← Client-side logic (AngularJS)
├── *.server.js          ← Server-side routing
├── *.template.html      ← User interface (HTML)
└── *.css                ← Styling
```

### Backend Modules

```
TSMAIRequestOrchestrator  ← Main coordinator
│
├── TSMAIStatusTracker    ← Real-time status
├── TSMAIClassifier       ← AI classification
├── TSMAISearchEngine     ← KB/Catalog search
├── TSMAIQuestionGenerator ← Dynamic questions
├── TSMAIAgentCore        ← AI responses
├── TSMAITicketFactory    ← Ticket creation
└── TSMAIRequestHelpers   ← OpenAI integration
```

**Total:** ~2,900 lines of modular, maintainable code

## 🔧 Technical Stack

- **Frontend:** AngularJS (ServiceNow Service Portal)
- **Backend:** ServiceNow Server-Side JavaScript (Rhino/ES5)
- **AI:** OpenAI API (or compatible: Azure OpenAI, Anthropic, custom)
- **Search:** Semantic search using embeddings
- **Storage:** ServiceNow GlideRecord + Session storage

## ⚙️ System Requirements

| Component | Requirement |
|-----------|-------------|
| ServiceNow | Quebec+ (tested on Tokyo, Utah, Vancouver, Washington) |
| Browser | Modern browser (Chrome, Firefox, Edge, Safari) |
| Mobile | Responsive design, works on iOS/Android |
| API | OpenAI API key or compatible endpoint |

## 📊 Performance

Typical processing times:

| Operation | Time |
|-----------|------|
| Classification | 800-2000ms |
| Knowledge Base search | 1000-2000ms |
| AI response generation | 2000-5000ms |
| Question generation | 1000-2000ms |
| Ticket creation | 500-1000ms |

**Total:** 5-12 seconds from request to AI response

## 🔒 Security & Privacy

- ✅ API keys stored in encrypted ServiceNow system properties
- ✅ Data sent to OpenAI complies with your organization's policies
- ✅ No data logging by default (configure as needed)
- ✅ Role-based access control through ServiceNow ACLs
- ✅ Screenshot uploads validated (type, size, count)

**Note:** Review your organization's data privacy policies before sending sensitive data to external AI APIs.

## 🛠️ Customization

### Change AI Model

```javascript
// System property: openai.api.model
gpt-4o-mini              // Fast, cost-effective (default)
gpt-4o                   // More capable
gpt-3.5-turbo            // Budget option
```

### Configure Ticket Types

Edit `TSMAIClassifier.js` to add custom ticket types:

```javascript
var customTypes = ['incident', 'service_request', 'question', 'hr_case', 'your_custom_type'];
```

### Modify Question Templates

Edit `TSMAIQuestionGenerator.js` to customize AI prompts:

```javascript
var prompt = 'Generate 3-5 questions for this ' + requestType + ' request...';
```

## 🐛 Troubleshooting

### "OpenAI API key not configured"
→ Create system property `openai.api.key` with your API key

### "Module not found" errors
→ Import Script Includes in the correct dependency order (see Installation)

### "HTTP 401 Unauthorized"
→ Verify your OpenAI API key is valid at https://platform.openai.com

### Widget not loading
→ Check browser console for errors, verify all 8 Script Includes imported

### Status polling not working
→ Ensure v2.0.1+ client script, check session storage permissions

## 🤝 Contributing

This is an open-source project. Contributions welcome!

1. Fork the repository
2. Create your feature branch
3. Test thoroughly in ServiceNow
4. Submit a pull request

## 📜 License

MIT License - see [LICENSE](./LICENSE) file for details

## 💡 Development

This widget was developed using [Snow-Flow](https://github.com/anthropics/snow-flow), an AI-powered ServiceNow development framework. Snow-Flow accelerates ServiceNow development through intelligent automation and natural language processing.

## 🙏 Credits

- **Architecture:** Modular TSMAI (TypeScript-Modular AI) design pattern
- **AI Integration:** OpenAI GPT-4/GPT-3.5 via REST API
- **Real-time Updates:** Server-side session storage + client polling
- **Development:** Snow-Flow AI development platform

## 📧 Support

For questions, issues, or feature requests:
- Open an issue on GitHub
- Check the [Technical Documentation](./servicenow/widgets/ai_universal_request_handler/TECHNICAL_DOCUMENTATION.md)
- Review the [Quick Start Guide](./servicenow/QUICK_START.md)

---

**Made with ❤️ and AI for the ServiceNow community**
