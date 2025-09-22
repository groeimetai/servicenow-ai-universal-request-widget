# Snow-Flow Development Documentation

## About Snow-Flow

**Snow-Flow** is an advanced ServiceNow development and orchestration framework that was used to build this AI Universal Request Handler Widget. Snow-Flow provides comprehensive MCP (Model Context Protocol) integration for ServiceNow development.

## How This Widget Was Built with Snow-Flow

### 1. Widget Development & Deployment
```javascript
// Snow-Flow deployment tools used:
snow_deploy_widget         // Automated widget deployment
snow_pull_artifact         // Widget synchronization
snow_validate_coherence    // HTML/Client/Server validation
snow_push_artifact         // Push changes to ServiceNow
```

### 2. ES5 JavaScript Compliance
Snow-Flow automatically ensures ES5 compatibility for ServiceNow's Rhino engine:
- No arrow functions `() => {}`
- No template literals `` `${var}` ``
- No `const`/`let` declarations
- No async/await
- All code validated before deployment

### 3. Multi-Language Implementation
Snow-Flow's language detection framework:
```javascript
// Automatic system language detection
getUserSystemLanguage() {
  var sessionLang = gs.getSession().getLanguage();
  // Dutch/English detection and fallback
}
```

### 4. Knowledge Base Integration
Snow-Flow's knowledge search capabilities:
```javascript
searchKnowledgeBase()        // Multi-strategy search
evaluateKnowledgeRelevance() // AI-powered relevance scoring
performEnhancedKnowledgeSearch() // Advanced search algorithms
```

### 5. AI Integration
Snow-Flow's OpenAI integration:
- Model: **GPT-4o-mini** (not GPT-4)
- Fallback model: **GPT-4o-mini**
- Temperature: 0.3 for consistent responses
- Smart token management

## Snow-Flow MCP Servers Used

This widget leverages multiple Snow-Flow MCP servers:

### ServiceNow Deployment Server
- Widget deployment with coherence validation
- Update Set management
- Rollback capabilities

### ServiceNow Operations Server
- Table queries and operations
- Record creation (incidents, requests, tasks)
- Field discovery

### ServiceNow Automation Server
- Script execution with output capture
- Background script testing
- System property management

### ServiceNow Local Development Server
- Artifact synchronization
- ES5 conversion and validation
- Local/remote file management

## Key Snow-Flow Features in This Widget

### 1. Intelligent Request Processing
- AI-powered classification (simple vs complex)
- Dynamic question generation
- Self-service suggestion system

### 2. Widget Coherence
Snow-Flow ensures perfect communication between:
- **Server Script**: Data initialization and API calls
- **Client Script**: User interaction handling
- **HTML Template**: Data binding and display

### 3. Fallback Mechanisms
- API failure handling
- Default question sets
- Graceful degradation

### 4. Performance Optimization
- Intelligent caching
- Batch operations
- Optimized search algorithms

## Development Commands Used

```bash
# Widget development
snow_pull_artifact({ sys_id: 'widget_id', table: 'sp_widget' })
snow_validate_artifact_coherence({ sys_id: 'widget_id' })
snow_push_artifact({ sys_id: 'widget_id' })

# Testing
snow_execute_script_with_output({ script: 'ES5 test code' })
snow_query_table({ table: 'kb_knowledge', query: 'search_term' })

# Deployment
snow_deploy_widget({ config: widgetConfig })
snow_ensure_active_update_set({ context: 'widget development' })
```

## Snow-Flow Architecture Benefits

### 1. MCP Integration
- 22+ specialized MCP servers
- Comprehensive ServiceNow API coverage
- Intelligent error handling

### 2. Development Efficiency
- Automated ES5 conversion
- Real-time validation
- Local/remote synchronization

### 3. Production Readiness
- Automatic Update Set tracking
- Deployment validation
- Rollback capabilities

### 4. Multi-Agent Orchestration
- Task distribution
- Parallel processing
- Intelligent coordination

## Why Snow-Flow?

Snow-Flow was chosen for this project because it provides:

1. **Reliability**: Proven framework for ServiceNow development
2. **Compliance**: Automatic ES5 compatibility
3. **Efficiency**: Rapid development and deployment
4. **Quality**: Built-in validation and testing
5. **Integration**: Seamless ServiceNow platform integration

## Snow-Flow Resources

- **MCP Servers**: 22+ specialized ServiceNow servers
- **Tools**: 500+ ServiceNow-specific tools
- **Validation**: Automatic code and configuration validation
- **Documentation**: Comprehensive CLAUDE.md guidelines

---

**This widget demonstrates the power of Snow-Flow for ServiceNow development** - combining AI capabilities, platform integration, and development best practices into a production-ready solution.