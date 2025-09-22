# Installation Guide - AI Universal Request Handler Widget

## 🚀 Quick Start Guide

### Prerequisites Checklist
- [ ] ServiceNow instance with admin access
- [ ] Service Portal activated
- [ ] OpenAI API key obtained
- [ ] Knowledge Base module activated (optional)

## 📝 Step-by-Step Installation

### 1️⃣ Configure System Properties

Navigate to **System Properties > System** and add:

```properties
# Required Properties
ai.openai.api.key = sk-xxxxxxxxxxxxxxxxxxxxx
ai.openai.api.url = https://api.openai.com/v1/chat/completions
ai.openai.model.primary = gpt-4o-mini
ai.openai.model.fallback = gpt-3.5-turbo

# Optional Properties
ai.widget.knowledge.enabled = true
ai.widget.knowledge.max_results = 5
ai.widget.suggestions.max = 5
ai.widget.selfservice.enabled = true
ai.widget.language.default = auto
ai.widget.debug = false
```

### 2️⃣ Create REST Message for OpenAI

#### A. Create REST Message

1. Go to **System Web Services > Outbound > REST Message**
2. Click **New**
3. Fill in:
   - **Name**: `OpenAI Chat`
   - **Endpoint**: `https://api.openai.com/v1/chat/completions`
   - **Description**: `OpenAI Chat Completion API for AI Widget`
4. Click **Submit**

#### B. Create HTTP Method

1. In the REST Message, click **New** in HTTP Methods
2. Configure:
   - **Name**: `Create Chat Completion`
   - **HTTP Method**: `POST`
   - **Endpoint**: `https://api.openai.com/v1/chat/completions`

#### C. Add HTTP Headers

In the HTTP Method, add these headers:

| Header | Value |
|--------|-------|
| Authorization | Bearer ${ai.openai.api.key} |
| Content-Type | application/json |

#### D. Add Variables

Create these variables in the HTTP Method:

| Variable | Type | Test Value |
|----------|------|------------|
| messages | String | [{"role":"user","content":"Hello"}] |
| model | String | gpt-4o-mini |
| temperature | String | 0.3 |
| max_tokens | String | 500 |

#### E. Test the Connection

1. Click **Test**
2. You should receive a 200 response with AI-generated content

### 3️⃣ Import the Widget

#### Method A: Manual Import

1. Navigate to **Service Portal > Widgets**
2. Click **New**
3. Set basic information:
   - **Name**: `AI Universal Request Handler`
   - **ID**: `ai_universal_request_handler`
   - **Description**: `AI-powered universal request handler with self-service`

4. Copy content from repository:
   - **HTML Template**: Copy entire content from `widget/src/template.html`
   - **CSS - SCSS**: Copy entire content from `widget/css/styles.css`
   - **Client Controller**: Copy entire content from `widget/src/client.js`
   - **Server Script**: Copy entire content from `widget/src/server.js`

5. Click **Submit**

#### Method B: Update Set Import

1. Download the Update Set from releases
2. Go to **System Update Sets > Retrieved Update Sets**
3. Import the XML file
4. Preview and Commit

### 4️⃣ Add Widget to Portal

1. Navigate to **Service Portal > Pages**
2. Select your target page (e.g., `index` or `catalog`)
3. Open in **Page Designer**
4. From widget library, drag **AI Universal Request Handler** to page
5. Configure widget instance options:

```json
{
  "enable_knowledge": true,
  "max_suggestions": 5,
  "enable_self_service": true,
  "default_language": "auto",
  "show_confidence_score": false
}
```

6. Save the page

### 5️⃣ Configure Knowledge Base (Optional)

For optimal performance:

1. Ensure knowledge articles are:
   - Published (`workflow_state = published`)
   - Not expired (`valid_to >= today`)
   - Properly categorized

2. Create knowledge base if needed:
   - Go to **Knowledge > Administration > Knowledge Bases**
   - Create new knowledge base for AI-searchable content

### 6️⃣ Set User Permissions

Grant these roles as needed:

| Role | Purpose |
|------|---------|
| `itil` | Create incidents and requests |
| `knowledge.user` | Read knowledge articles |
| `sp_user` | Access Service Portal |

### 7️⃣ Test the Installation

1. Open Service Portal as end user
2. Navigate to page with widget
3. Test with sample request: "How do I reset my password?"
4. Verify:
   - [ ] AI responds with answer
   - [ ] Knowledge articles appear (if available)
   - [ ] Language detection works
   - [ ] Ticket creation works

## 🔧 Configuration Options

### Widget Instance Options

Configure in Page Designer:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enable_knowledge` | Boolean | true | Enable knowledge base search |
| `max_suggestions` | Number | 5 | Maximum self-service suggestions |
| `enable_self_service` | Boolean | true | Show self-service options |
| `default_language` | String | auto | Default language (auto/en/nl) |
| `show_confidence_score` | Boolean | false | Display AI confidence scores |
| `enable_feedback` | Boolean | true | Allow user feedback |

### Server Script Customization

Modify these sections as needed:

```javascript
// Request categories
var requestCategories = [
  { value: 'incident', label: 'Incident' },
  { value: 'request', label: 'Service Request' },
  // Add your categories
];

// Record creation mapping
switch(category) {
  case 'incident':
    // Customize incident creation
    break;
  case 'request':
    // Customize request creation
    break;
}
```

### CSS Customization

Adjust branding in CSS:

```css
.ai-request-container {
  --primary-color: #000;        /* Your primary color */
  --success-color: #27ae60;     /* Success state color */
  --info-color: #3498db;        /* Information color */
  --danger-color: #e74c3c;      /* Error state color */
}
```

## ⚠️ Troubleshooting

### Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| No AI response | Missing API key | Check `ai.openai.api.key` property |
| Widget not loading | Script error | Check browser console for errors |
| Knowledge not found | Unpublished articles | Ensure articles are published |
| Language always English | Session language not set | Set user's preferred language |
| Cannot create tickets | Missing permissions | Grant `itil` role to users |

### Debug Mode

Enable debugging:

1. Set property: `ai.widget.debug = true`
2. Check system logs: **System Logs > System Log > Application Logs**
3. Look for entries starting with "AI Widget:"

### Verification Steps

Run these checks:

```javascript
// In Scripts - Background
// Test OpenAI connection
var api_key = gs.getProperty('ai.openai.api.key');
gs.info('API Key configured: ' + (api_key ? 'Yes' : 'No'));

// Test REST Message
var r = new sn_ws.RESTMessageV2('OpenAI Chat', 'Create Chat Completion');
r.setStringParameterNoEscape('model', 'gpt-4o-mini');
r.setStringParameterNoEscape('messages', '[{"role":"user","content":"test"}]');
var response = r.execute();
gs.info('API Response: ' + response.getStatusCode());
```

## 📚 Additional Resources

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [ServiceNow Service Portal Documentation](https://docs.servicenow.com/bundle/washingtondc-servicenow-platform/page/build/service-portal/concept/service-portal.html)
- [Widget Development Guide](https://developer.servicenow.com/dev.do#!/learn/learning-plans/washingtondc/servicenow_application_developer/app_store_learnv2_serviceportal_washingtondc_creating_custom_widgets)

## 🆘 Support

If you encounter issues:

1. Check the [GitHub Issues](https://github.com/groeimetai/servicenow-ai-universal-request-widget/issues)
2. Enable debug mode and collect logs
3. Create a new issue with:
   - ServiceNow version
   - Error messages
   - Debug logs
   - Steps to reproduce

---

**Installation typically takes 15-30 minutes** | **No coding required** | **Production ready**