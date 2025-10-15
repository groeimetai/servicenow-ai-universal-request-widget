# OpenAI Configuration Guide

This document explains how to configure the generic OpenAI integration for the ServiceNow AI Assistant.

## Overview

The AI Assistant now uses **direct OpenAI REST API calls** instead of MID server routing. This makes the solution:
- ✅ **Portable** - Works on any ServiceNow instance
- ✅ **Generic** - No company-specific infrastructure required
- ✅ **Configurable** - Easy to customize per environment
- ✅ **GitHub-ready** - Can be shared as open source

## Required System Properties

You need to create **two system properties** in your ServiceNow instance:

### 1. OpenAI API Key

**Property Name:** `openai.api.key`
**Type:** String (Password)
**Description:** Your OpenAI API key from https://platform.openai.com/api-keys

**To Create:**
1. Navigate to **System Properties > System Properties** in ServiceNow
2. Click **New**
3. Fill in:
   - **Name:** `openai.api.key`
   - **Type:** `String`
   - **Value:** Your OpenAI API key (starts with `sk-...`)
   - **Description:** OpenAI API key for AI Assistant integration
   - **Protection:** Password (recommended to hide the value)
4. Click **Submit**

### 2. OpenAI Model Selection

**Property Name:** `openai.api.model`
**Type:** String
**Description:** The OpenAI model to use for AI processing
**Default Value:** `gpt-5-nano-2025-08-07`

**Supported Models:**
- `gpt-5-nano-2025-08-07` - Latest nano model (fast, cost-effective)
- `gpt-4o` - GPT-4 optimized (higher quality)
- `gpt-4o-mini` - GPT-4 optimized mini (balanced)
- `gpt-3.5-turbo` - GPT-3.5 (legacy)

**To Create:**
1. Navigate to **System Properties > System Properties**
2. Click **New**
3. Fill in:
   - **Name:** `openai.api.model`
   - **Type:** `String`
   - **Value:** `gpt-5-nano-2025-08-07` (or your preferred model)
   - **Description:** OpenAI model for AI Assistant
4. Click **Submit**

## How It Works

### TSMAIRequestHelpers.js

All AI calls now go through the `TSMAIRequestHelpers` Script Include which:

1. **Retrieves Configuration:**
   ```javascript
   var apiKey = gs.getProperty('openai.api.key');
   var model = gs.getProperty('openai.api.model', 'gpt-5-nano-2025-08-07');
   ```

2. **Calls OpenAI API Directly:**
   ```javascript
   var request = new sn_ws.RESTMessageV2();
   request.setEndpoint('https://api.openai.com/v1/chat/completions');
   request.setHttpMethod('POST');
   request.setRequestHeader('Authorization', 'Bearer ' + apiKey);
   request.setRequestHeader('Content-Type', 'application/json');
   ```

3. **Handles Model-Specific Parameters:**
   - GPT-5 and GPT-4o models: Use `max_completion_tokens` parameter
   - GPT-5 models: Only support `temperature: 1`
   - Other models: Use `max_tokens` parameter and `temperature: 0.3`

### Updated Modules

All AI modules now use the generic helper:

1. **TSMAIAgentCore.js** - Direct answers and suggestions (4 calls)
2. **TSMAIClassifier.js** - Request classification (1 call)
3. **TSMAISearchEngine.js** - Knowledge and catalog search (3 calls)
4. **TSMAIQuestionGenerator.js** - Dynamic question generation (1 call)
5. **TSMAITicketFactory.js** - AI-enhanced ticket creation (1 call)

**Total:** 10 OpenAI API calls, all using the generic helper

## Verification

### Test the Configuration

1. Navigate to **Scripts - Background**
2. Run this test script:

```javascript
var helpers = new TSMAIRequestHelpers();

// Test API key is configured
var apiKey = gs.getProperty('openai.api.key');
if (!apiKey) {
  gs.error('❌ OpenAI API key not configured!');
  gs.error('Create system property: openai.api.key');
} else {
  gs.info('✅ OpenAI API key is configured');
}

// Test model is configured
var model = gs.getProperty('openai.api.model');
if (!model) {
  gs.warn('⚠️  OpenAI model not configured, will use default: gpt-5-nano-2025-08-07');
} else {
  gs.info('✅ OpenAI model configured: ' + model);
}

// Test API call
var testPrompt = 'Say "Hello from ServiceNow!" if you receive this message.';
var response = helpers.callOpenAI(testPrompt, true, null, 50);

if (response.success) {
  gs.info('✅ OpenAI API call successful!');
  gs.info('Response: ' + response.content);
} else {
  gs.error('❌ OpenAI API call failed: ' + response.error);
}
```

### Expected Output

```
✅ OpenAI API key is configured
✅ OpenAI model configured: gpt-5-nano-2025-08-07
✅ OpenAI API call successful!
Response: Hello from ServiceNow!
```

## Cost Management

### Monitor API Usage

OpenAI charges per token used. Monitor usage at: https://platform.openai.com/usage

### Cost-Effective Models

- **gpt-5-nano-2025-08-07** - Most cost-effective, fast responses
- **gpt-4o-mini** - Good balance of quality and cost
- **gpt-4o** - Highest quality, higher cost

### Token Limits per Module

Each module has optimized token limits:

- **Classifier:** 50 tokens (quick yes/no classification)
- **Search Keyword Extraction:** 50 tokens (extract keywords)
- **Search Relevance Evaluation:** 100 tokens (evaluate results)
- **Question Generator:** 2000 tokens (generate 1-5 questions)
- **Agent Answers:** 400 tokens (provide direct answers)
- **Knowledge Search:** 800 tokens (format knowledge articles)
- **Catalog Filtering:** 50 tokens (filter catalog items)
- **Ticket Categorization:** 1000 tokens (comprehensive analysis)

## Troubleshooting

### API Key Not Working

**Error:** `OpenAI API key not configured`

**Solution:**
1. Verify system property exists: `openai.api.key`
2. Check the value starts with `sk-`
3. Test the key at https://platform.openai.com/playground

### API Call Fails

**Error:** `HTTP 401 - Unauthorized`

**Solution:**
- Your API key is invalid or expired
- Generate a new key at https://platform.openai.com/api-keys

**Error:** `HTTP 429 - Rate Limit`

**Solution:**
- You've exceeded your OpenAI rate limit
- Check your usage at https://platform.openai.com/usage
- Upgrade your plan or wait for the limit to reset

**Error:** `HTTP 500 - Internal Server Error`

**Solution:**
- OpenAI API is temporarily unavailable
- Check status at https://status.openai.com/
- System will automatically fall back to default questions/answers

### Model Not Supported

**Error:** `Invalid model specified`

**Solution:**
- Use a supported model from the list above
- Check available models at https://platform.openai.com/docs/models
- Default is `gpt-5-nano-2025-08-07`

## Migration from MID Server

If you're migrating from the old MID server implementation:

### What Changed

**Before (MID Server):**
```javascript
// Hardcoded company-specific model
var response = helpers.callOpenAI(prompt, llmEnabled, 'alliander-ai-assistant', maxTokens);
```

**After (Generic):**
```javascript
// Uses configurable system property
var response = helpers.callOpenAI(prompt, llmEnabled, null, maxTokens);
```

### Migration Steps

1. ✅ **TSMAIRequestHelpers.js** - Already updated with generic implementation
2. ✅ **All AI modules** - Already updated to use generic helper
3. **Create system properties:**
   - `openai.api.key` with your OpenAI API key
   - `openai.api.model` with your preferred model
4. **Test the integration** using the verification script above
5. **Remove MID server configuration** (if applicable)

### No Code Changes Required

All modules automatically use the new generic implementation. Just configure the system properties and you're ready!

## Security Considerations

### Protect Your API Key

- ✅ Use **Password** type for `openai.api.key` system property
- ✅ Restrict access to system properties with ACLs
- ✅ Never commit API keys to version control
- ✅ Rotate keys regularly

### Network Requirements

The ServiceNow instance must be able to reach:
- `https://api.openai.com` (OpenAI API endpoint)

**Firewall Rules:**
- **Outbound HTTPS (443)** to `api.openai.com`
- No inbound rules required

### Data Privacy

- User requests are sent to OpenAI for processing
- OpenAI's data usage policy: https://openai.com/policies/usage-policies
- Consider data classification before enabling

## Support

### Documentation

- OpenAI API Docs: https://platform.openai.com/docs
- ServiceNow REST API: https://docs.servicenow.com/bundle/tokyo-application-development/page/integrate/inbound-rest/concept/c_RESTAPI.html

### Issues

Report issues at: [Your GitHub repository]

## Changelog

### v2.0.0 - Generic OpenAI Integration

**Date:** 2025-10-15

**Changes:**
- ✅ Removed MID server dependency
- ✅ Added direct OpenAI REST API integration
- ✅ Made configuration dynamic via system properties
- ✅ Updated all 5 AI modules (10 total API calls)
- ✅ Added model-specific parameter handling
- ✅ Improved error handling and fallback logic

**Migration:** No code changes required, just configure system properties
