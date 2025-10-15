# AI Universal Request Handler - Technical Documentation

## Widget Overview

**Name:** AI Universal Request Handler
**Type:** Service Portal Widget
**sys_id:** b3a0b8dd83dbe6502a7ea130ceaad355
**Created:** 2025-08-10 10:59:09
**Updated:** 2025-09-24 06:55:51

### What does this widget do?

This widget is a smart form that helps users submit requests. Instead of users having to choose between incident, service request, or question themselves, the AI automatically analyzes their input and guides them through the right process. The widget:

- Reads what the user writes and automatically determines what type of request it is
- Searches for relevant information in the Knowledge Base and Service Catalog
- Asks smart follow-up questions to complete the request
- Automatically creates a ticket with an AI-generated summary
- Shows real-time updates about what's happening during processing

### Key Features

- **AI classification**: Automatically recognizes whether it's an incident, service request, question, or HR case
- **Live status updates**: Every 500ms update about what's happening (classifying, searching, AI generating response)
- **Dynamic questions**: AI generates specific follow-up questions based on the request type
- **Knowledge integration**: Automatically searches KB articles and catalog items
- **Screenshot uploads**: Max 3 files of 5MB each
- **Multilingual**: Automatically detects Dutch or English
- **Datacenter LLM**: Uses the Alliander AI model via MID Server

---

## High-Level Architecture

### How the widget works - simply explained

```
┌─────────────────────────────────────────────────────────┐
│                   What the user sees                    │
│            (Service Portal in browser)                  │
└───────────────────────┬─────────────────────────────────┘
                        │
                        │ User types question
                        │
    ┌───────────────────┼───────────────────┐
    │                   │                   │
    ▼                   ▼                   ▼
┌─────────┐      ┌─────────────┐      ┌─────────┐
│  HTML   │◀────▶│  JavaScript │      │   CSS   │
│Template │      │   (Client)  │      │ Styling │
└─────────┘      └──────┬──────┘      └─────────┘
                        │
                        │ Sends data to server
                        ▼
        ┌───────────────────────────────────┐
        │   Server Script (Action Router)   │
        │   Routes everything to modules    │
        └──────────────┬────────────────────┘
                       │
                       │ Calls
                       ▼
        ┌───────────────────────────────────┐
        │  TSMAIRequestOrchestrator         │
        │  (Main coordinator of everything) │
        └─────┬───┬───┬───┬───┬─────────────┘
              │   │   │   │   │
              │   │   │   │   └─── TSMAI Modules (8 total)
              ▼   ▼   ▼   ▼   ▼
        ┌──────────────────────────────────┐
        │   StatusTracker - Track status   │
        │   Classifier - Determine type    │
        │   SearchEngine - Search KB/Catalog│
        │   QuestionGenerator - Make questions│
        │   AgentCore - AI responses       │
        │   TicketFactory - Create tickets │
        └────────────┬──────────────────────┘
                     │
                     │ Talks to AI
                     ▼
        ┌──────────────────────────────────┐
        │   Datacenter LLM via MID Server  │
        │   (Alliander AI model)           │
        └──────────────────────────────────┘
```

**What happens in this diagram:**
1. User sees HTML form and types a question
2. JavaScript in the browser sends the question to the ServiceNow server
3. Server script receives the question and passes it to the Orchestrator
4. Orchestrator uses 8 different modules to process the question
5. Modules talk to the Datacenter LLM (AI model) for smart responses
6. Response comes back via the same route to the user

---

## Widget Files - What's Where

The widget consists of 4 main files, each with its own task:

### 1. Template (HTML) - 115 lines

**What is this?**
This is the form that the user sees. All buttons, text fields, progress bars - everything visual.

**Main sections:**

The widget has **different routes** that show/hide sections based on the classified ticket type:

```
├─ Input Section (Always visible)
│  ├─ Large text field where user types question
│  ├─ Dropdown menu for type hint (incident/service request/question)
│  └─ "Submit" button to start
│
├─ AI Response Section (Shows after classification)
│  ├─ Spinning loader during processing
│  ├─ Progress bar showing how far we are
│  ├─ Status messages per step (classifying, searching, AI thinking)
│  ├─ AI suggestions in cards
│  └─ Links to found KB articles
│
├─ Question List Section (Dynamic based on ticket type)
│  ├─ Different questions for each ticket type:
│  │  ├─ Incident → When did it start? What error? Which system?
│  │  ├─ Service Request → What do you need? For which user? When needed?
│  │  ├─ Question → What information? Related to which topic?
│  │  └─ HR Case → Leave dates? Contract question? Salary inquiry?
│  │
│  ├─ Input fields (text/dropdown/checkbox depending on question type)
│  ├─ Red asterisk (*) for required questions
│  ├─ Screenshot upload section (max 3 files × 5MB)
│  │  └─ ⚠️ ONLY visible for INCIDENTS
│  └─ "Submit form" button
│
└─ Confirmation Section (Shows after successful submission)
   ├─ Green checkmark + success message
   ├─ Ticket number (e.g., INC0010123, RITM0010456, HR0001234)
   └─ "New request" button to start over
```

**Important: Dynamic Field Visibility**

The widget adapts its form based on AI classification:

- **Screenshot Upload**: Only shown AFTER AI generates questions AND only for incidents
  ```javascript
  ng-show="c.data.showQuestions && c.data.requestType === 'incident'"
  ```
  This means:
  1. User submits initial request
  2. AI classifies as incident
  3. AI generates questions
  4. Question list appears WITH screenshot upload button
  5. User can now attach screenshots before final submission

- **Questions**: Different questions generated per type
  ```javascript
  // Incident → technical troubleshooting questions
  // Service Request → fulfillment requirement questions
  // Question → information request clarifications
  // HR Case → HR-specific detail questions
  ```

- **Confirmation Message**: Changes based on ticket created
  ```javascript
  // Incident: "Your incident INC0010123 has been created"
  // Service Request: "Your request RITM0010456 has been submitted"
  // Question: "Your question has been logged"
  // HR Case: "Your HR case HR0001234 has been created"
  ```

**Important HTML examples:**

```html
<!-- User types question here -->
<textarea ng-model="c.data.initialRequest"
          placeholder="Describe your request...">
</textarea>

<!-- Submit button that calls JavaScript function -->
<button ng-click="c.submitInitialRequest()">
  Submit
</button>

<!-- Show questions when AI has generated them -->
<div ng-show="c.data.showQuestions">
  <div ng-repeat="question in c.data.questions">
    <label>{{question.question}}</label>
    <input ng-model="question.answer">
  </div>
</div>

<!-- Progress bar that grows as we progress -->
<div class="progress-bar"
     style="width:{{c.data.progressPercentage}}%">
</div>
```

**What do ng-model, ng-click, etc. mean?**
These are commands that connect the HTML to the JavaScript:
- `ng-model="c.data.initialRequest"` → what user types is stored in variable
- `ng-click="c.submitInitialRequest()"` → when user clicks, execute function
- `ng-show="c.data.showQuestions"` → show this HTML section only if variable is true
- `ng-repeat` → repeat this HTML section for each item in the list

### 2. Client Script (JavaScript in browser) - 450 lines

**What is this?**
This is the "brain" of the widget that runs in the user's browser. It handles all interaction: buttons that work, data going to the server, updates appearing.

**Main function** - What happens when user clicks "Submit":

```javascript
c.submitInitialRequest = function() {
  // 1. Check if user filled in something
  if (!c.data.initialRequest) {
    alert('Please enter a question');
    return;
  }

  // 2. Turn on loading spinner
  c.data.loading = true;

  // 3. Create unique session ID for this user
  c.data.sessionId = 'session_' + new Date().getTime();

  // 4. Send everything to server
  c.server.get({
    action: 'generateResponse',
    initialRequest: c.data.initialRequest,
    requestTypeHint: c.data.requestTypeHint,
    sessionId: c.data.sessionId,
    screenshots: c.data.uploadedScreenshots
  }).then(function(response) {
    // 5. Server response is back, show it
    c.data.suggestions = response.data.result.suggestions;
    c.data.questions = response.data.result.questions;
    c.data.sources = response.data.result.sources;
    c.data.showQuestions = true;
    c.data.loading = false;
  });

  // 6. Start live status updates (check every 500ms where we are)
  c.pollStatus();
};
```

**Screenshot upload:**

```javascript
c.handleFileUpload = function(event) {
  var file = event.target.files[0];

  // Check: not too large (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    alert('File too large');
    return;
  }

  // Check: max 3 screenshots
  if (c.data.uploadedScreenshots.length >= 3) {
    alert('Maximum 3 screenshots');
    return;
  }

  // Read file and convert to base64
  var reader = new FileReader();
  reader.onload = function(e) {
    c.data.uploadedScreenshots.push({
      fileName: file.name,
      contentType: file.type,
      size: file.size,
      data: e.target.result.split(',')[1]  // Base64 without prefix
    });
    $scope.$apply();  // Tell system that data changed
  };
  reader.readAsDataURL(file);
};
```

**Live status updates:**

This calls itself every 500ms to check status:

```javascript
c.pollStatus = function() {
  c.data.statusPollTimer = $timeout(function() {
    // Ask server: where are we now?
    c.server.get({
      action: 'getStatus',
      sessionId: c.data.sessionId
    }).then(function(response) {
      // Update progress bar
      var steps = response.data.result.steps;
      var completed = steps.filter(function(s) {
        return s.status === 'completed';
      }).length;
      c.data.progressPercentage = (completed / steps.length) * 100;

      // Keep checking until everything is done
      if (!c.data.processingComplete) {
        c.pollStatus();  // Call yourself again in 500ms
      }
    });
  }, 500);  // Wait 500 milliseconds
};
```

**Final form submission:**

```javascript
c.submitFinalForm = function() {
  // 1. Collect all data
  var submissionData = {
    initialRequest: c.data.initialRequest,
    requestType: c.data.requestType,
    answers: c.data.questions,  // All questions + answers
    screenshots: c.data.uploadedScreenshots,
    userLanguage: c.data.userSystemLanguage
  };

  // 2. Send to server to create ticket
  c.server.get({
    action: 'submitRequest',
    submissionData: JSON.stringify(submissionData)
  }).then(function(response) {
    // 3. Show success message with ticket number
    c.data.showConfirmation = true;
    c.data.ticketNumber = response.data.result.ticketNumber;
  });
};
```

### 3. Server Script (JavaScript on ServiceNow server) - 115 lines

**What is this?**
This script runs on the ServiceNow server (not in the browser). It receives all requests from the client and routes them to the right modules. It's essentially a traffic controller: "You want to check status? Go to StatusTracker. You want AI response? Go to Orchestrator."

**Main function - Action Router:**

```javascript
// Detect which language user speaks
function getUserSystemLanguage() {
  var sessionLang = gs.getSession().getLanguage();
  if (sessionLang && sessionLang.toLowerCase().indexOf('nl') >= 0) {
    return 'Dutch';
  }
  return 'English';
}

// Set language for client
data.userSystemLanguage = getUserSystemLanguage();
data.isDutch = data.userSystemLanguage === 'Dutch';

// Action Router - like a receptionist who transfers your call
if (input && input.action) {
  switch (input.action) {

    case 'generateResponse':
      // Client asks: generate AI response for this question
      data.result = new TSMAIRequestOrchestrator()
        .generateIntelligentResponse(
          input.initialRequest,
          input.requestTypeHint,
          input.sessionId,
          input.screenshots
        );
      break;

    case 'getStatus':
      // Client asks: where are we with processing?
      var orchestrator = new TSMAIRequestOrchestrator();
      data.result = orchestrator.getStatus(input.sessionId);
      break;

    case 'submitRequest':
      // Client asks: create the ticket
      data.result = new TSMAIRequestOrchestrator()
        .submitUniversalRequest(
          JSON.parse(input.submissionData)
        );
      break;
  }
}
```

**Why so simple?**
The server script contains NO business logic. It's intentionally kept simple so that all complex logic sits in reusable modules. If we want to change how AI works, we only need to adjust the modules, not the widget script.

### 4. CSS Styling - 550 lines

**What is this?**
This makes the widget beautiful and user-friendly. Colors, spacing, animations, responsive design for mobile.

**Main components:**

```css
/* Suggestion cards with hover effect */
.ai-suggestion-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 15px;
  background: #f9f9f9;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.ai-suggestion-card:hover {
  background: #ffffff;
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

/* Progress bar that grows */
.ai-progress-bar {
  height: 8px;
  background: #4CAF50;  /* Green */
  border-radius: 4px;
  transition: width 0.3s ease;
}

/* Status indicators with different colors */
.ai-status-step.completed {
  color: #4CAF50;  /* Green = done */
}

.ai-status-step.in_progress {
  color: #2196F3;  /* Blue = working */
  font-weight: bold;
}

.ai-status-step.pending {
  color: #999;  /* Gray = waiting */
}

/* Spinning loader */
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.ai-loading-spinner {
  animation: spin 1s linear infinite;
}

/* Responsive for mobile */
@media (max-width: 768px) {
  .ai-request-container {
    padding: 10px;
  }
}
```

---

## TSMAI Modules - The Engine Under the Hood

The widget itself is relatively simple. The real magic happens in 8 modules that contain all AI and business logic.

### Module Overview

```
TSMAIRequestOrchestrator - Conductor that controls everything (563 lines)
│
├─ TSMAIStatusTracker - Tracks where we are (91 lines)
├─ TSMAIClassifier - Determines incident/service request/question (182 lines)
├─ TSMAISearchEngine - Searches KB and Catalog (944 lines - largest!)
├─ TSMAIQuestionGenerator - Creates smart questions (230 lines)
├─ TSMAIAgentCore - Generates AI responses (480 lines)
├─ TSMAITicketFactory - Creates tickets (468 lines)
└─ TSMAIRequestHelpers - Utility functions and AI calls (base)

Total: ~2900 lines of business logic
```

### 1. TSMAIRequestOrchestrator - The Main Coordinator

**What does it do?**
This is the conductor of an orchestra. It calls all other modules in the right order. The widget ONLY talks to this Orchestrator, never directly to other modules.

**Main function - Process user question:**

```javascript
generateIntelligentResponse(request, type, sessionId, screenshots) {

  // STEP 1: Start status tracking for live updates
  this.statusTracker.initStatusTracker(sessionId);

  // STEP 2: Classify the question
  // Is it an incident? Service request? Question?
  this.statusTracker.updateStatus(sessionId, 'classify_request', 'in_progress');
  var classification = this.classifier.classifyRequest(request, type);
  this.statusTracker.updateStatus(sessionId, 'classify_request', 'completed');

  // STEP 3: Search for relevant info
  // Search Knowledge Base and Service Catalog
  this.statusTracker.updateStatus(sessionId, 'search_knowledge', 'in_progress');
  var searchResults = this.searchEngine.searchUnified(request, classification);
  this.statusTracker.updateStatus(sessionId, 'search_knowledge', 'completed');

  // STEP 4: Generate AI response
  // Use found KB articles as context for AI
  this.statusTracker.updateStatus(sessionId, 'generate_ai_response', 'in_progress');
  var aiResponse = this.agentCore.generateDirectAnswerWithKnowledge(
    request,
    searchResults.knowledgeArticles
  );

  // STEP 5: Generate follow-up questions
  var questions = this.questionGen.generateQuestionsFromAI(request, classification);
  this.statusTracker.updateStatus(sessionId, 'generate_ai_response', 'completed');

  // STEP 6: Return everything to widget
  return {
    success: true,
    classification: classification,
    suggestions: aiResponse.suggestions,
    questions: questions,
    sources: searchResults.knowledgeArticles
  };
}
```

**Ticket creation function:**

```javascript
submitUniversalRequest(data) {

  // STEP 1: Determine final ticket type
  var finalType = data.requestType || 'incident';

  // STEP 2: Build complete description
  // Combine: initial request + all answers + AI summary
  var fullDescription = this.buildFullDescription(data);

  // STEP 3: Create ticket
  var ticketResult = this.ticketFactory.createIncidentWithAI(data);

  // STEP 4: Add screenshots
  if (data.screenshots && data.screenshots.length > 0) {
    this.ticketFactory.attachScreenshotsToRecord(
      data.screenshots,
      'incident',
      ticketResult.ticketSysId
    );
  }

  // STEP 5: Return ticket info
  return {
    success: true,
    ticketNumber: ticketResult.ticketNumber,
    message: 'Your incident has been created'
  };
}
```

### 2. TSMAIStatusTracker - Live Updates

**What does it do?**
Tracks where we are in the process so the user can see live what's happening. This provides the "Classifying...", "Searching Knowledge Base...", "AI generating response..." messages.

**How does it work?**
Uses GlideSession (server-side storage) to store status. Every 500ms the widget fetches the status and updates the UI.

**Example timeline:**

```
T=0ms:     [Classifying: waiting...]
           [Searching: waiting...]
           [AI response: waiting...]
           Progress: 0%

T=500ms:   [Classifying: working...] ← BLUE
           [Searching: waiting...]
           [AI response: waiting...]
           Progress: 0%

T=1000ms:  [Classifying: done!] ← GREEN
           [Searching: working...] ← BLUE
           [AI response: waiting...]
           Progress: 33%

T=2000ms:  [Classifying: done!] ← GREEN
           [Searching: done!] ← GREEN
           [AI response: working...] ← BLUE
           Progress: 67%

T=5000ms:  [Classifying: done!] ← GREEN
           [Searching: done!] ← GREEN
           [AI response: done!] ← GREEN
           Progress: 100%
```

### 3. TSMAIClassifier - Type Recognition

**What does it do?**
Determines what type of request it is. Uses AI as the primary method with keyword matching as fallback.

**How does it work - Two-tier approach:**

**PRIMARY: AI Classification (via Datacenter LLM)**
- Sends user request to AI with classification prompt
- AI analyzes context, intent, and nuance
- More accurate than keyword matching
- Can handle complex requests like "My manager asked me to get the new software but it doesn't work"
- Returns classification with confidence score

**FALLBACK: Keyword Matching**
- Only used when:
  - AI/LLM is not available
  - AI call fails or times out
  - System property `datacenter.llm.enabled` = false
- Fast but less accurate
- Looks for signal words in text

**Keyword lists (fallback only):**

**Incident keywords:**
- "not working", "broken", "down", "defect", "problem"
- "error", "crash", "outage", "failed"

**Service Request keywords:**
- "would like", "request", "need", "access"
- "new", "install", "order", "license"

**HR keywords:**
- "leave", "vacation", "sick", "salary", "contract"

**Example classification flow:**

```
User: "My laptop doesn't work anymore"

PRIMARY (AI):
→ Sends to LLM: "Classify this request: My laptop doesn't work anymore"
→ AI analyzes: Technical issue, broken hardware/software
→ Result: INCIDENT (confidence: 0.95)
✓ USED

FALLBACK (Keyword):
→ Only runs if AI fails
→ Keywords: "doesn't", "work", "anymore"
→ Match: incident keywords
→ Result: INCIDENT
⚠️ Not used (AI succeeded)
```

**Why this approach?**
- **AI is smarter**: Understands context, not just keywords
  - "I need my laptop fixed" → AI: INCIDENT (keyword would match "need" = SERVICE REQUEST ❌)
  - "Can you help me understand the leave policy?" → AI: QUESTION (keyword would match "leave" = HR CASE ❌)
- **Keyword is reliable**: Always works, even if AI is down
- **Fast failover**: If AI takes >5 seconds, fallback kicks in automatically

### 4. TSMAISearchEngine - Search KB and Catalog

**What does it do?**
This is the largest module (944 lines) that does all the search work. Searches Knowledge Base articles and Service Catalog items using **contextual search** (semantic similarity).

**Why is this important?**
Before AI gives a response, we want to first check if there are existing KB articles. We use those as context for the AI ("here's what we've already documented, use this in your answer").

**Strategy: Contextual Search (Semantic)**

```
1. Convert user query to embedding (vector representation)
   ↓
   "My laptop won't start" → [0.234, -0.512, 0.891, ...]

2. Search Knowledge Base using semantic similarity
   ↓
   Finds articles with similar MEANING, not just matching words
   Example: Finds "Computer startup issues" even though no exact word match

3. Score results on semantic relevance (0-1)
   ↓
   Cosine similarity between query embedding and KB article embeddings

4. Filter: only results with score > 0.5
   ↓

5. Sort: highest similarity score first
   ↓

6. Return top 10 results with metadata
   ↓
   Includes: title, snippet, relevance score, sys_id, article link
```

**Why Contextual Search instead of Keywords?**

**Traditional Keyword Search:**
```
Query: "My laptop won't start"
Searches for: "laptop" AND "start"
Misses: "Computer boot failure" (no matching words) ❌
```

**Contextual/Semantic Search:**
```
Query: "My laptop won't start"
Understands meaning: startup problems, boot issues, power failures
Finds:
  - "Computer boot failure" ✓ (similar meaning)
  - "Laptop power issues" ✓ (similar meaning)
  - "Windows startup troubleshooting" ✓ (related concept)
```

**How it works technically:**

```javascript
// 1. Generate embedding for user query
var queryEmbedding = generateEmbedding(userRequest);

// 2. Search KB articles with similar embeddings
var kbResults = searchKnowledgeBaseBySimilarity(
  queryEmbedding,
  threshold: 0.5,
  limit: 10
);

// 3. Each result includes semantic relevance score
{
  title: "Laptop startup issues",
  snippet: "If your laptop won't turn on...",
  relevanceScore: 0.87,  // High semantic similarity
  sys_id: "abc123",
  url: "/kb_view.do?sys_id=abc123"
}
```

**Benefits:**
- Finds relevant articles even with different wording
- Understands synonyms and related concepts
- Better matches for multilingual queries (Dutch/English)
- More accurate than keyword matching

### 5. TSMAIQuestionGenerator - Smart Question Creation

**What does it do?**
Uses AI to generate targeted follow-up questions for **ALL ticket types** (Incident, Service Request, Question, HR Case). Depending on the request type and content, the AI asks 3-5 questions that help complete the request.

**Works for all routes:**
- ✅ **Incident** → Technical troubleshooting questions
- ✅ **Service Request** → Fulfillment requirement questions
- ✅ **Question** → Information clarification questions
- ✅ **HR Case** → HR-specific detail questions

**Why use AI?**
Because every situation is different. For "laptop not working" you want different questions than for "need new phone" or "when is my holiday pay". AI dynamically generates the best questions based on both the ticket type AND the specific situation.

**Example AI output per type:**

**Incident:** "My Outlook keeps crashing"
```json
[
  {
    "question": "When exactly does Outlook crash?",
    "type": "text",
    "required": true
  },
  {
    "question": "How many times per day does this happen?",
    "type": "select",
    "options": ["1-2 times", "3-5 times", "More than 5 times"],
    "required": true
  },
  {
    "question": "Do other Office apps work normally?",
    "type": "select",
    "options": ["Yes", "No, they crash too", "Not tested"],
    "required": false
  }
]
```

**Service Request:** "I need access to the financial application"
```json
[
  {
    "question": "Which financial application do you need access to?",
    "type": "text",
    "required": true
  },
  {
    "question": "What is your job role?",
    "type": "text",
    "required": true
  },
  {
    "question": "When do you need this access?",
    "type": "select",
    "options": ["Urgent (today)", "This week", "Next week", "No rush"],
    "required": true
  },
  {
    "question": "Who is your manager for approval?",
    "type": "text",
    "required": true
  }
]
```

**Question:** "How do I request vacation days?"
```json
[
  {
    "question": "Is this for immediate vacation or future planning?",
    "type": "select",
    "options": ["Immediate (next 2 weeks)", "Future planning"],
    "required": true
  },
  {
    "question": "Have you checked the self-service portal?",
    "type": "select",
    "options": ["Yes, but couldn't find it", "No, not yet"],
    "required": false
  }
]
```

**HR Case:** "When do I get my holiday pay?"
```json
[
  {
    "question": "Are you asking about this year's holiday pay?",
    "type": "select",
    "options": ["Yes, current year", "Previous year", "Both"],
    "required": true
  },
  {
    "question": "Have you already received a partial payment?",
    "type": "select",
    "options": ["Yes", "No", "Not sure"],
    "required": true
  },
  {
    "question": "What is your employee number?",
    "type": "text",
    "required": true
  }
]
```

**How AI adapts the questions:**
- Uses ticket classification (incident/request/question/HR)
- Analyzes specific user request content
- Generates contextually relevant questions
- Determines which questions are mandatory vs optional
- Chooses appropriate input types (text/select/checkbox)

### 6. TSMAIAgentCore - AI Intelligence

**What does it do?**
This is the "brain" that generates AI responses. Uses found KB articles as context to give a smart answer.

**Example:**

```
User: "My Outlook keeps crashing"

SearchEngine finds:
- KB article: "Outlook performance issues"
- KB article: "PST file too large"

AgentCore builds prompt for AI:
"User question: My Outlook keeps crashing

Relevant knowledge base articles:
- Outlook performance issues
  Outlook can become slow when PST files are larger than 10GB...
- PST file too large
  Large PST files can cause crashes..."

AI generates response:
"It sounds like your Outlook might be having issues with a PST
file that's too large. Here are some steps:

1. Check PST size via File > Info
2. Archive old emails
3. Start Outlook in Safe Mode: outlook.exe /safe"

Parsed to:
{
  answer: "It sounds like your Outlook...",
  suggestions: [
    "Check PST size",
    "Archive old emails",
    "Start Outlook in Safe Mode"
  ],
  confidence: 0.85
}
```

### 7. TSMAITicketFactory - Ticket Creation

**What does it do?**
Actually creates the ticket in ServiceNow. Uses AI to make a professional summary and automatically determines priority and category.

**Flow:**

```
1. Generate AI summary
   ↓
   Input: "My laptop won't work anymore"
   + Answers: "This morning at 9:00", "Black screen"
   ↓
   AI determines:
   {
     short_description: "Laptop won't start - hardware issue",
     category: "Hardware",
     subcategory: "Laptop",
     priority: 2,  // High
     urgency: 2    // Medium
   }

2. Create incident record
   ↓
   var gr = new GlideRecord('incident');
   gr.short_description = ...
   gr.category = ...
   gr.priority = ...
   gr.insert()

3. Add screenshots as attachments

4. Return ticket number: "INC0010123"
```

### 8. TSMAIRequestHelpers - Utility Functions

**What does it do?**
Foundation module with shared functions. Most important: the `callOpenAI()` function that makes all AI calls via Datacenter LLM.

**Core function:**

```javascript
callOpenAI(messages, temperature, maxTokens) {

  // 1. Check if LLM is enabled
  var llmEnabled = gs.getProperty('datacenter.llm.enabled');
  if (llmEnabled !== 'true') return null;

  // 2. Get API key
  var apiKey = gs.getProperty('al.api.key.datacenter.llm');

  // 3. Build request
  var requestBody = {
    model: 'alliander-ai-assistant',
    messages: messages,
    temperature: 0.7,
    max_tokens: 1500
  };

  // 4. Create REST Message
  var restMessage = new sn_ws.RESTMessageV2(
    'Datacenter LLM REST',
    'vfos120b POST'
  );

  // 5. Set headers
  restMessage.setRequestHeader('Authorization', 'Bearer ' + apiKey);
  restMessage.setRequestBody(JSON.stringify(requestBody));

  // 6. Execute via MID Server
  var response = restMessage.execute();
  var parsed = JSON.parse(response.getBody());

  // 7. Return AI response + sources
  return {
    content: parsed.choices[0].message.content,
    sources: parsed.sources || []  // Datacenter LLM feature!
  };
}
```

---

## Complete Data Flow - User Submits Question

This is what happens from the moment a user clicks "Submit":

```
1. USER types: "My laptop won't start anymore"
   Clicks: "Submit"
   ↓

2. CLIENT SCRIPT
   ├─ Validate: Is there text? ✓
   ├─ Create session ID: "session_1704123456"
   ├─ Turn on spinner
   ├─ Start polling (every 500ms)
   └─ c.server.get({action: 'generateResponse', ...})
   ↓

3. SERVER SCRIPT
   ├─ Receive request
   ├─ Check action: "generateResponse" ✓
   └─ new TSMAIRequestOrchestrator().generateIntelligentResponse(...)
   ↓

4. ORCHESTRATOR
   │
   ├─ STEP 1: Init status (3 steps: pending)
   │
   ├─ STEP 2: Classify (AI-powered)
   │  ├─ Classifier: Call Datacenter LLM for classification
   │  ├─ AI analyzes: "My laptop won't start anymore"
   │  ├─ AI determines: Technical issue, hardware/software failure
   │  └─ Result: 'incident' (confidence: 0.95) ✓
   │
   ├─ STEP 3: Search KB + Catalog (Contextual/Semantic)
   │  ├─ Generate embedding: "My laptop won't start"
   │  ├─ Search KB using semantic similarity
   │  ├─ Find articles by MEANING, not just keywords
   │  └─ Found: 2 articles with relevance > 0.5 ✓
   │
   ├─ STEP 4: Generate AI Response
   │  ├─ Build context with found KB articles
   │  ├─ Call Datacenter LLM via MID Server
   │  │  ├─ POST to LLM endpoint with KB context
   │  │  ├─ Wait 3 seconds...
   │  │  └─ Response: {content: "It sounds like...", sources: [...]}
   │  └─ Parse suggestions from response
   │
   ├─ STEP 5: Generate questions
   │  ├─ Call LLM for question generation
   │  └─ Response: [{question: "When did this happen?"}, ...]
   │
   └─ Return everything:
      {
        classification: 'incident',
        suggestions: ["Check power", "Reset laptop"],
        questions: [{...}, {...}],
        sources: [{KB article}, {LLM source}]
      }
   ↓

5. CLIENT SCRIPT receives response
   ├─ Stop polling
   ├─ c.data.suggestions = response.suggestions
   ├─ c.data.questions = response.questions
   ├─ c.data.showQuestions = true
   └─ Spinner off
   ↓

6. HTML UPDATE
   ├─ Hide spinner
   ├─ Show AI suggestions in cards
   ├─ Show sources (KB + LLM)
   └─ Show question list with input fields

TIME: ~5-8 seconds total
```

---

## Datacenter LLM Integration

### Why MID Server?

The Datacenter LLM runs in the internal Alliander network and is not directly accessible from the internet. The MID Server is inside the network and can reach the LLM. ServiceNow sends requests to the MID Server, which forwards them to the LLM.

### Architecture:

```
Widget → RequestHelpers → REST Message → MID Server → Datacenter LLM
                                                            ↓
                                                       AI response
                                                            +
                                                       Source attribution
                                                            ↓
Widget ← RequestHelpers ← REST Message ← MID Server ← Response
```

### Extended Response Format

Standard OpenAI only returns text. Datacenter LLM adds extra info:

```json
{
  "choices": [{
    "message": {
      "content": "Your laptop may not start because..."
    }
  }],
  "sources": [{
    "filename": "laptop_troubleshooting.pdf",
    "page": 15,
    "description": "Hardware troubleshooting guide"
  }],
  "metadata": [{
    "relevance": "high",
    "confidence": 0.88
  }]
}
```

This enables us to:
- Show source attribution (transparency)
- Build trust ("answer based on documentation")
- Have compliance and audit trail

---

## File Structure & Deployment

### Deployment Order

**IMPORTANT**: Script Includes must be deployed in this order:

```
1. TSMAIRequestHelpers     (Foundation)
2. TSMAIStatusTracker      (Standalone)
3. TSMAIClassifier         (→ RequestHelpers)
4. TSMAISearchEngine       (→ RequestHelpers)
5. TSMAIQuestionGenerator  (→ RequestHelpers)
6. TSMAIAgentCore          (→ RequestHelpers, SearchEngine)
7. TSMAITicketFactory      (→ SearchEngine)
8. TSMAIRequestOrchestrator (→ ALL modules)
```

### Dependencies

```
TSMAIRequestHelpers (base)
    ↑
    ├── Classifier
    ├── SearchEngine
    │       ↑
    │       ├── AgentCore
    │       └── TicketFactory
    └── QuestionGenerator

TSMAIStatusTracker (standalone)

Orchestrator (uses all modules)
    ↑
Widget Server Script (uses only Orchestrator)
    ↑
Widget Client Script
```

---

## Performance

### Typical Times

| Step | Time | What happens |
|------|------|-------------|
| Classification | 800-2000ms | AI classification via Datacenter LLM |
| KB Search | 1000-2000ms | Contextual search using embeddings |
| LLM Call | 2000-5000ms | AI generates response with KB context |
| Question Gen | 1000-2000ms | AI creates dynamic questions |
| Ticket Create | 500-1000ms | Database insert with attachments |

**Total:**
- Initial request → AI response: 5-12 seconds
- Final submit → ticket: 1-3 seconds

---

## Configuration

### System Properties

```javascript
// LLM (REQUIRED)
datacenter.llm.enabled = true
al.api.key.datacenter.llm = <api-key>

// Features
ai.universal.handler.enabled = true
knowledge.search.enabled = true
```

### REST Message

```
Table: sys_rest_message
Name: Datacenter LLM REST
Method: vfos120b POST
Endpoint: ${datacenter.llm.endpoint}/api/llm/chat
MID Server: al_dc_llm_mid
```

---

**Document Version:** 2.0 (English)
**Last Updated:** October 15, 2025
**Author:** TSM AI Development Team
**Status:** Production Ready
