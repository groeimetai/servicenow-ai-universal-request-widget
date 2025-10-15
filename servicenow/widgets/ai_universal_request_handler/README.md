# ServiceNow Service Portal Widget: AI Universal Request Handler

## Overview
- **Type**: Service Portal Widget
- **Table**: sp_widget
- **sys_id**: b3a0b8dd83dbe6502a7ea130ceaad355
- **Created**: 2025-08-10 10:59:09
- **Updated**: 2025-09-24 06:55:51

## Files
- **ai_universal_request_handler.template.html** - HTML template with Angular bindings
- **ai_universal_request_handler.server.js** - Server-side script (ES5 ONLY)
- **ai_universal_request_handler.client.js** - Client-side AngularJS controller
- **ai_universal_request_handler.css** - Widget-specific CSS styles
- **ai_universal_request_handler.options.json** - Widget instance options configuration

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
snow-flow sync push-artifact b3a0b8dd83dbe6502a7ea130ceaad355

# Cleanup local files (after sync)
snow-flow sync cleanup b3a0b8dd83dbe6502a7ea130ceaad355

# Check sync status
snow-flow sync status b3a0b8dd83dbe6502a7ea130ceaad355
```
