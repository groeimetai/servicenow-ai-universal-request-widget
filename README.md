# Snow-Flow: Multi-Agent ServiceNow Development Platform 🚀

Snow-Flow is a powerful multi-agent AI platform that revolutionizes ServiceNow development through intelligent automation, natural language processing, and autonomous deployment capabilities. Built with 11 specialized MCP (Model Context Protocol) servers, Snow-Flow enables developers to create, manage, and deploy ServiceNow artifacts using simple natural language commands.

## 🆕 What's New

### ⚡ v2.0.1 - Real-Time Status Polling (Latest)

**NOW WITH REAL-TIME FEEDBACK!** 🔴 LIVE

The AI Universal Request Handler widget now shows **actual server processing progress** instead of simulated delays:

- ✅ **Real-Time Updates** - See actual AI processing steps as they happen
- ✅ **Accurate Timing** - Fast requests complete quickly, slow requests show ongoing progress
- ✅ **Server Polling** - Client polls every 500ms for live status updates
- ✅ **No Fake Delays** - Removed hardcoded timeouts (300ms, 800ms, 1400ms)
- ✅ **Better UX** - Users understand exactly what's happening

**Technical:** Uses existing TSMAIStatusTracker session storage + client polling infrastructure that was previously unused.

**Documentation:** See [REALTIME_STATUS_IMPLEMENTATION.md](./REALTIME_STATUS_IMPLEMENTATION.md) for complete details.

### 🌐 v2.0.0 - Generic OpenAI Integration

**BREAKING CHANGE - Now GitHub Ready!** 🎉

The AI modules have been completely refactored to use **generic OpenAI REST API** instead of company-specific MID server routing. This makes the project:

- ✅ **Portable** - Works on any ServiceNow instance
- ✅ **Open Source Ready** - No proprietary dependencies
- ✅ **Easy Configuration** - Just two system properties needed
- ✅ **Cost Effective** - Direct OpenAI API calls, no middleware

**What Changed:**
- 🔧 All 5 AI modules now use `TSMAIRequestHelpers.js` (10 API calls total)
- 🔑 Configure with system properties: `openai.api.key` and `openai.api.model`
- 🚀 No MID server required - direct HTTPS to OpenAI API
- 📚 Complete setup guide: [OPENAI_SETUP.md](./OPENAI_SETUP.md)

**Migration:** No code changes needed! Just configure the two system properties and you're ready.

### v1.1.51 - Critical Fixes

#### 🎯 All User Issues Resolved!
- **ROOT CAUSE SOLVED**: Flow Designer validation failures completely eliminated
- **JSON SCHEMA FLEXIBILITY**: Accepts both "steps" and "activities" arrays with auto-conversion
- **DOCUMENTATION SYNC**: Init command now creates comprehensive CLAUDE.md (373 lines vs 15)
- **COMPLETE GUIDE**: New users get full Snow-Flow development environment from day one

### 🧠 Intelligent Error Recovery (v1.1.48-1.1.49)
- **AUTOMATIC FALLBACKS**: Flow Designer → Business Rule conversion when deployment fails
- **SMART SESSIONS**: Update Sets auto-create when none exist - no more "no active session" errors
- **ZERO MANUAL WORK**: All systematic errors from user feedback now automatically handled
- **COMPREHENSIVE TESTING**: Enhanced flow testing with Business Rule fallback detection

### 🚀 Enhanced Swarm Command (v1.1.42+)
Most intelligent features are now **enabled by default** - één command voor alles!
- **DEFAULT TRUE**: `--smart-discovery`, `--live-testing`, `--auto-deploy`, `--auto-rollback`, `--shared-memory`, `--progress-monitoring`
- **INTELLIGENT ORCHESTRATION**: Uses `snow_orchestrate_development` MCP tool automatically
- **NO FLAGS NEEDED**: Just run `snow-flow swarm "create widget"` and everything works!

### 🔍 Real-Time ServiceNow Integration (v1.1.41+)
- **LIVE VALIDATION**: `snow_validate_live_connection` - real-time auth and permission checking
- **SMART PREVENTION**: `snow_discover_existing_flows` - prevents duplicate flows
- **LIVE TESTING**: `snow_test_flow_execution` - real flow testing in live instances
- **BATCH VALIDATION**: `batch_deployment_validator` - comprehensive multi-artifact validation
- **AUTO ROLLBACK**: `deployment_rollback_manager` - automatic rollback with backup creation

## 🌟 Key Features

### 🤖 11 Specialized MCP Servers
Each server provides autonomous capabilities for different aspects of ServiceNow development:

1. **Deployment MCP** - Autonomous widget and application deployment
2. **Update Set MCP** - Professional change tracking and deployment management
3. **Intelligent MCP** - AI-powered artifact discovery and editing
4. **Graph Memory MCP** - Relationship tracking and impact analysis
5. **Platform Development MCP** - Development workflow automation
6. **Integration MCP** - Third-party system integration
7. **Operations MCP** - Operations and monitoring management
8. **Automation MCP** - Workflow and process automation
9. **Security & Compliance MCP** - Security auditing and compliance
10. **Reporting & Analytics MCP** - Data _analysis and reporting
11. **Memory MCP** - Multi-agent coordination and todo management

### 🎯 Core Capabilities

- **Natural Language Processing**: Create complex ServiceNow artifacts using plain English/Dutch commands
- **Intelligent Decision Making**: Automatically determines optimal architecture (flow vs subflow)
- **Zero Configuration**: All values dynamically discovered from your ServiceNow instance
- **Autonomous Deployment**: Direct deployment to ServiceNow with automatic error handling
- **Update Set Management**: Professional change tracking like ServiceNow pros use
- **Global Scope Strategy**: Intelligent scope selection with fallback mechanisms
- **Multi-Agent Coordination**: Parallel execution for complex tasks

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- ServiceNow instance with admin access
- OAuth application configured in ServiceNow

### Installation

```bash
# Install Snow-Flow globally
npm install -g snow-flow

# Initialize Snow-Flow in your project directory
snow-flow init
```

#### Alternative: Install from source
```bash
# Clone the repository
git clone https://github.com/groeimetai/snow-flow.git
cd snow-flow

# Install dependencies
npm install

# Build the project
npm run build

# Link globally (optional)
npm link
```

### Configuration

1. Create a `.env` file in the project root:
```env
SNOW_INSTANCE=your-instance.service-now.com
SNOW_CLIENT_ID=your-oauth-client-id
SNOW_CLIENT_SECRET=your-oauth-client-secret
SNOW_USERNAME=your-username
SNOW_PASSWORD=your-password
```

2. Set up OAuth in ServiceNow (see [SERVICENOW-OAUTH-SETUP.md](./SERVICENOW-OAUTH-SETUP.md))

3. Authenticate with ServiceNow:
```bash
snow-flow auth login
```

### 🎯 MCP Server Activation (v1.1.25+)

Snow-Flow now includes **automatic MCP server activation** for Claude Code! During initialization, you'll be prompted to automatically start Claude Code with all 11 MCP servers pre-loaded:

```bash
snow-flow init

# You'll see:
# 🚀 Would you like to start Claude Code with MCP servers automatically? (Y/n)
# Press Y to launch Claude Code with all MCP servers ready to use!
```

The MCP servers are automatically:
- ✅ Configured with correct paths for global npm installations
- ✅ Registered in Claude Code's settings
- ✅ Activated without manual approval steps
- ✅ Ready to use immediately after initialization

If you need to manually activate MCP servers later:
```bash
# For Mac/Linux:
claude --mcp-config .mcp.json

# For Windows:
claude.exe --mcp-config .mcp.json
```

## 💡 Usage Examples

### Create a Complex Flow with Natural Language
```bash
snow-flow sparc "Create an approval workflow for iPhone 6 orders that notifies managers, creates tasks, and updates inventory"
```

### Deploy a Widget Directly to ServiceNow
```bash
snow-flow sparc "Create and deploy a widget that shows all critical incidents with real-time updates"
```

### Start a Multi-Agent Swarm for Complex Projects
```bash
# Most intelligent features are enabled by default!
snow-flow swarm "Build a complete incident management system with dashboard, workflows, and notifications"

# Default settings:
# ✅ --smart-discovery (true) - Reuses existing artifacts
# ✅ --live-testing (true) - Tests in real-time
# ✅ --auto-deploy (true) - Deploys automatically (safe with update sets)
# ✅ --auto-rollback (true) - Rollbacks on failures
# ✅ --shared-memory (true) - Agents share context
# ✅ --progress-monitoring (true) - Real-time status

# Add --auto-permissions to enable automatic permission escalation
snow-flow swarm "Create enterprise workflow" --auto-permissions

# Disable specific features with --no- prefix
snow-flow swarm "Test workflow" --no-auto-deploy --no-live-testing
```

### Intelligent Artifact Discovery
```bash
snow-flow sparc "Find and modify the approval workflow to add an extra approval step for orders over $1000"
```

### Create Flows in Dutch
```bash
snow-flow sparc "Maak een flow voor het automatisch toewijzen van incidenten aan de juiste groep op basis van categorie"
```

## 🛠️ Advanced Features

### Flow vs Subflow Intelligence
Snow-Flow automatically analyzes your requirements and decides whether to create a main flow or break it into reusable subflows:
- Complexity analysis
- Reusability assessment
- Performance optimization
- Maintainability considerations

### Update Set Management
Professional change tracking just like ServiceNow developers use:
```bash
# Create a new update set for your feature
snow-flow sparc "Create update set for new approval features"

# All subsequent changes are automatically tracked
snow-flow sparc "Add approval widget to portal"
```

### Global Scope Strategy
Intelligent deployment scope selection:
- Automatic permission validation
- Fallback mechanisms for restricted environments
- Environment-aware deployment (dev/test/prod)

### Template Matching
Recognizes common patterns and applies best practices:
- Approval workflows
- Fulfillment processes
- Notification systems
- Integration patterns

## 🔧 New MCP Tools (v1.1.44+)

### Catalog Item Search with Fuzzy Matching
Find catalog items even when you don't know the exact name:
```javascript
// In Claude Code with MCP tools
snow_catalog_item_search({
  query: "iPhone",          // Finds iPhone 6S, iPhone 7, etc.
  fuzzy_match: true,       // Intelligent variations
  category_filter: "mobile devices",
  include_variables: true  // Get catalog variables
});
```

### Flow Testing with Mock Data
Test flows without affecting production data:
```javascript
snow_test_flow_with_mock({
  flow_id: "equipment_provisioning_flow",
  create_test_user: true,      // Auto-creates test user
  mock_catalog_items: true,    // Creates test items
  mock_catalog_data: [
    {
      name: "Test iPhone 6S",
      price: "699.00"
    }
  ],
  simulate_approvals: true,    // Auto-approves
  cleanup_after_test: true     // Removes test data
});
```

### Direct Catalog-Flow Linking
Link catalog items directly to flows for automated fulfillment:
```javascript
snow_link_catalog_to_flow({
  catalog_item_id: "iPhone 6S",
  flow_id: "mobile_provisioning_flow",
  link_type: "flow_catalog_process",  // Modern approach
  variable_mapping: [
    {
      catalog_variable: "phone_model",
      flow_input: "device_type"
    },
    {
      catalog_variable: "user_department",
      flow_input: "department"
    }
  ],
  trigger_condition: 'current.stage == "request_approved"',
  execution_options: {
    run_as: "user",    // 🔒 SEC-001 FIX: Default to 'user' to prevent privilege escalation
    wait_for_completion: true
  },
  test_link: true  // Creates test request
});
```

### Bulk Deployment
Deploy multiple artifacts in a single transaction:
```javascript
snow_bulk_deploy({
  artifacts: [
    { type: "widget", data: widgetData },
    { type: "flow", data: flowData },
    { type: "script", data: scriptData }
  ],
  transaction_mode: true,  // All-or-nothing deployment
  parallel: true,         // Deploy simultaneously
  dry_run: false
});
```

## 📁 Project Structure

```
snow-flow/
├── src/
│   ├── mcp/                    # 11 MCP server implementations
│   ├── orchestrator/           # Flow composition and intelligence
│   ├── strategies/             # Deployment and scope strategies
│   ├── api/                    # ServiceNow API integration
│   ├── managers/               # Resource and scope management
│   └── utils/                  # Utilities and helpers
├── .snow-flow/                 # Snow-Flow configuration
├── .claude/                    # Claude configuration
├── memory/                     # Persistent agent memory
└── coordination/               # Multi-agent coordination
```

## 🔧 Development Commands

```bash
# Run tests
npm test

# Run linting
npm run lint

# Type checking
npm run typecheck

# Development mode
npm run dev

# Build for production
npm run build
```

## 📚 Documentation

- [MCP Server Documentation](./MCP_SERVERS.md) - Detailed info on all 11 MCP servers
- [OAuth Setup Guide](./SERVICENOW-OAUTH-SETUP.md) - ServiceNow OAuth configuration
- [Update Set Guide](./UPDATE_SET_DEPLOYMENT_GUIDE.md) - Professional change management
- [API Integration Guide](./API_INTEGRATION_GUIDE.md) - ServiceNow API details
- **[OpenAI Setup Guide](./OPENAI_SETUP.md)** - 🆕 Generic OpenAI configuration (v2.0.0)

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines (coming soon).

## 🔒 Security

- All credentials stored securely in environment variables
- OAuth 2.0 authentication with ServiceNow
- No hardcoded values - everything discovered dynamically
- Secure token management with automatic refresh

## 🎯 Use Cases

### For ServiceNow Developers
- Rapidly prototype flows and workflows
- Automate repetitive development tasks
- Ensure consistency across implementations
- Reduce development time by 80%

### For ServiceNow Architects
- Validate architectural decisions
- Ensure best practices are followed
- Analyze impact of changes
- Optimize performance and maintainability

### For ServiceNow Administrators
- Quick deployments and updates
- Professional change tracking
- Automated testing and validation
- Simplified migration between instances

## 🚦 Roadmap

- [ ] Visual flow designer integration
- [ ] Enhanced Neo4j graph visualization
- [ ] Multi-instance synchronization
- [ ] AI-powered code review
- [ ] Automated testing framework
- [ ] Performance optimization recommendations

## 🆕 What's New in v1.1.25

### Automatic MCP Server Activation 🎯
- **Interactive Prompt**: During `snow-flow init`, you're now prompted to automatically start Claude Code with all MCP servers
- **Zero Manual Steps**: No more manual MCP approval in Claude Code - servers load automatically using `claude --mcp-config`
- **Cross-Platform Support**: Works on Mac, Linux, and Windows with platform-specific activation scripts
- **Instant Availability**: All 11 ServiceNow MCP servers are immediately available in Claude Code after initialization

### Previous Updates
- **v1.1.24**: Added `snow-flow mcp debug` command for troubleshooting MCP configurations
- **v1.1.23**: Fixed .npmignore to include essential .claude configuration files
- **v1.1.22**: Verified global npm installation correctly registers all MCP servers
- **v1.1.20**: Added enabledMcpjsonServers to ensure MCP visibility in Claude Code

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

Built with the power of Claude AI and the ServiceNow platform. Special thanks to the ServiceNow developer community for inspiration and best practices.

---

**Ready to revolutionize your ServiceNow development?** Start with `snow-flow init` and experience the future of ServiceNow automation! 🚀
