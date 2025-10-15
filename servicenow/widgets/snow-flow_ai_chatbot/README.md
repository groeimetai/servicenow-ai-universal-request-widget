# ServiceNow Service Portal Widget: Snow-Flow AI Chatbot

## Overview
- **Type**: Service Portal Widget
- **Table**: sp_widget
- **sys_id**: 01d01d6983176a502a7ea130ceaad376
- **Created**: 2025-08-11 07:58:05
- **Updated**: 2025-09-22 17:21:10

## Files
- **snow-flow_ai_chatbot.template.html** - HTML template with Angular bindings
- **snow-flow_ai_chatbot.server.js** - Server-side script (ES5 ONLY)
- **snow-flow_ai_chatbot.client.js** - Client-side AngularJS controller
- **snow-flow_ai_chatbot.css** - Widget-specific CSS styles
- **snow-flow_ai_chatbot.options.json** - Widget instance options configuration

## Validation Rules
### Template-Server Data Binding
Every {{data.x}} in template must have data.x in server script

### Template-Client Method Binding
Every ng-click in template must have matching method in client

## Widget Development Guidelines

1. **Server Script** must be ES5 (no modern JavaScript)
2. **Template** references must match server data properties
3. **Client Script** must implement all template methods
4. **CSS** should use prefixed classes
5. Test widget in Service Portal after pushing

## Editing Instructions

1. **Edit files** using Claude Code's native tools
2. **Maintain coherence** between related files
3. **Use ES5 only** in server-side scripts (no modern JavaScript)
4. **Test locally** if possible
5. **Run pushArtifact** to sync changes back to ServiceNow

## Commands

```bash
# Push changes back to ServiceNow
snow-flow sync push-artifact 01d01d6983176a502a7ea130ceaad376

# Cleanup local files (after sync)
snow-flow sync cleanup 01d01d6983176a502a7ea130ceaad376

# Check sync status
snow-flow sync status 01d01d6983176a502a7ea130ceaad376
```
