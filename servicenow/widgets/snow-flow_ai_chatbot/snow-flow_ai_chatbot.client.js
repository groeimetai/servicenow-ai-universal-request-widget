function($scope, $timeout, $sce) {
    var c = this;
    // Initialize data - ES5 compliant
    c.data.messages = c.data.messages || [];
    c.data.userInput = '';
    c.data.loading = false;
    c.data.connected = true;
    c.data.selectedModel = c.data.selectedModel || 'gpt-5-nano-2025-08-07';
    c.data.tokenUsage = 0;
    c.data.orderState = {};
    c.data.suggestedActions = [];
    c.data.activeContext = null;
    c.data.language = 'nl';
    c.data.theme = 'light';
    c.data.inputPlaceholder = 'Type je vraag hier...';
    // Enhanced conversation state tracking - matches server side
    c.data.conversationState = c.data.conversationState || {
        phase: 'idle',
        selectedItem: null,
        currentStep: 0,
        itemComplexity: 'simple',
        approvalRequired: false
    };
    // Form data for dynamic forms
    $scope.formData = {};
    $scope.showSettings = false;
    // Trust HTML for Angular - ES5
    $scope.trustAsHtml = function(html) {
        return $sce.trustAsHtml(html);
    };
    // Initialize with enhanced suggested actions
    function initializeSuggestedActions() {
        c.data.suggestedActions = [
            { icon: '💻', text: 'Laptop bestellen', action: 'order_laptop' },
            { icon: '📱', text: 'Telefoon aanvragen', action: 'order_phone' },
            { icon: '🖥️', text: 'Monitor bestellen', action: 'order_monitor' },
            { icon: '⌨️', text: 'Toetsenbord & muis', action: 'order_keyboard' },
            { icon: '🖨️', text: 'Printer aanvragen', action: 'order_printer' },
            { icon: '🔑', text: 'Toegang aanvragen', action: 'request_access' },
            { icon: '❓', text: 'IT Hulp', action: 'it_help' },
            { icon: '📚', text: 'Kennisbank', action: 'knowledge_base' }
        ];
    }
    // Handle suggested action click
    $scope.handleSuggestedAction = function(action) {
        var actionTexts = {
            'order_laptop': 'Ik wil een laptop bestellen',
            'order_phone': 'Ik wil een telefoon aanvragen',
            'order_monitor': 'Ik wil een monitor bestellen',
            'order_keyboard': 'Ik wil een toetsenbord en muis bestellen',
            'order_printer': 'Ik wil een printer aanvragen',
            'request_access': 'Ik heb toegang nodig tot een applicatie',
            'it_help': 'Ik heb een IT probleem',
            'knowledge_base': 'Zoek in de kennisbank'
        };
        c.data.userInput = actionTexts[action.action] || action.text;
        $scope.sendMessage();
    };
    // Handle quick action from welcome screen
    $scope.quickAction = function(text) {
        c.data.userInput = text;
        $scope.sendMessage();
    };
    // Enhanced catalog item selection with styling
    $scope.selectCatalogItem = function(item) {
        // Update conversation state
        c.data.conversationState.phase = 'item_selected';
        c.data.conversationState.selectedItem = item;
        c.data.conversationState.itemComplexity = item.complexity || 'simple';
        c.data.conversationState.approvalRequired = item.requiresApproval || false;
        // Enhanced context bar with styling based on complexity
        var contextClass = 'ordering';
        if (item.requiresApproval) {
            contextClass = 'approval';
        }
        c.data.activeContext = {
            icon: '🛒',
            text: 'Bestelling: ' + item.name + (item.complexity !== 'simple' ? ' (' + getComplexityLabel(item.complexity) + ')' : ''),
            class: contextClass
        };
        // Clear suggested actions to focus on ordering
        c.data.suggestedActions = [];
        // CRITICAL FIX: Direct function call instead of relying on AI parsing
        c.server.get({
            action: 'start_conversational_ordering',
            item_id: item.id,
            item_name: item.name,
            conversationState: c.data.conversationState,
            context: c.data.activeContext
        }).then(handleEnhancedServerResponse);
        // Show loading state
        c.data.loading = true;
        // Add user message with complexity indication
        var complexityEmoji = getComplexityEmoji(item.complexity);
        var userMessage = {
            type: 'user',
            text: 'Ik wil "' + item.name + '" bestellen ' + complexityEmoji,
            timestamp: new Date().toLocaleTimeString('nl-NL', {hour: '2-digit', minute: '2-digit'})
        };
        c.data.messages.push(userMessage);
        scrollToBottom();
    };
    // Helper functions for complexity
    function getComplexityLabel(complexity) {
        var labels = {
            'simple': 'Eenvoudig',
            'moderate': 'Matig',
            'complex': 'Complex',
            'very_complex': 'Zeer Complex'
        };
        return labels[complexity] || 'Onbekend';
    }
    function getComplexityEmoji(complexity) {
        var emojis = {
            'simple': '✅',
            'moderate': '🟡', 
            'complex': '🟠',
            'very_complex': '🔴'
        };
        return emojis[complexity] || 'ℹ️';
    }
    // Enhanced form submission with progress tracking
    $scope.submitForm = function(formId) {
        // Validate form data
        var hasData = false;
        var formValue = '';
        for (var key in $scope.formData) {
            if ($scope.formData.hasOwnProperty(key) && $scope.formData[key]) {
                hasData = true;
                formValue = $scope.formData[key];
                break;
            }
        }
        if (!hasData) {
            // Enhanced validation error with consistent styling
            var errorMsg = c.data.language === 'nl' ? 
                'Vul alsjeblieft een antwoord in.' : 
                'Please fill in an answer.';
            alert(errorMsg);
            return;
        }
        // Show user's answer in chat with enhanced styling
        var userMessage = {
            type: 'user',
            text: formValue,
            timestamp: new Date().toLocaleTimeString('nl-NL', {hour: '2-digit', minute: '2-digit'})
        };
        c.data.messages.push(userMessage);
        // Show loading with enhanced indicator
        c.data.loading = true;
        scrollToBottom();
        // Update conversation state progress
        if (c.data.conversationState.phase === 'collecting_variables') {
            c.data.conversationState.currentStep++;
        }
        // Submit to server
        c.server.get({
            action: 'submit_form',
            formId: formId,
            formData: $scope.formData,
            conversationState: c.data.conversationState  // CRITICAL: Pass conversation state
        }).then(function(response) {
            c.data.loading = false;
            if (response.data.success) {
                // Clear form data
                $scope.formData = {};
                // Add enhanced response message
                var message = {
                    type: 'ai',
                    richContent: response.data.richContent || null,
                    text: response.data.response,
                    timestamp: new Date().toLocaleTimeString('nl-NL', {hour: '2-digit', minute: '2-digit'})
                };
                c.data.messages.push(message);
                // Update conversation state if provided
                if (response.data.conversationState) {
                    c.data.conversationState = response.data.conversationState;
                    updateContextBar();
                }
                scrollToBottom();
            } else {
                var errorMessage = {
                    type: 'ai',
                    text: 'Error: ' + (response.data.error || 'Form submission failed'),
                    timestamp: new Date().toLocaleTimeString('nl-NL', {hour: '2-digit', minute: '2-digit'})
                };
                c.data.messages.push(errorMessage);
                scrollToBottom();
            }
        });
    };
    // Enhanced context bar updates
    function updateContextBar() {
        if (c.data.conversationState.selectedItem) {
            var item = c.data.conversationState.selectedItem;
            var phase = c.data.conversationState.phase;
            var contextClass = 'ordering';
            var contextText = '';
            if (phase === 'collecting_variables') {
                contextClass = 'ordering';
                var progress = c.data.conversationState.currentStep || 0;
                var total = c.data.conversationState.itemVariables ? c.data.conversationState.itemVariables.length : 1;
                contextText = 'Bestelling: ' + item.name + ' (Vraag ' + (progress + 1) + ' van ' + total + ')';
            } else if (phase === 'confirming_order') {
                contextClass = c.data.conversationState.approvalRequired ? 'approval' : 'ordering';
                contextText = 'Bevestiging: ' + item.name + (c.data.conversationState.approvalRequired ? ' (Goedkeuring vereist)' : '');
            } else {
                contextText = 'Bestelling: ' + item.name;
            }
            c.data.activeContext = {
                icon: '🛒',
                text: contextText,
                class: contextClass
            };
        }
    }
    // Cancel form with enhanced cleanup
    $scope.cancelForm = function() {
        $scope.formData = {};
        c.data.activeContext = null;
        c.data.conversationState.phase = 'idle';
        c.data.conversationState.selectedItem = null;
        c.data.conversationState.currentStep = 0;
        // Send cancellation message
        c.data.userInput = 'Ik wil de bestelling annuleren';
        $scope.sendMessage();
    };
    // Enhanced action button handling
    $scope.handleAction = function(action) {
        if (action.type === 'message') {
            c.data.userInput = action.value;
            $scope.sendMessage();
        } else if (action.type === 'url') {
            window.open(action.value, '_blank');
        } else if (action.type === 'function') {
            // Show enhanced loading
            c.data.loading = true;
            // Call server with specific function
            c.server.get({
                action: 'execute_action',
                actionType: action.value,
                conversationState: c.data.conversationState  // CRITICAL: Pass conversation state for order confirmation
            }).then(function(response) {
                c.data.loading = false;
                if (response.data.success) {
                    // Add enhanced response message
                    var message = {
                        type: 'ai',
                        richContent: response.data.richContent || null,
                        text: response.data.response,
                        timestamp: new Date().toLocaleTimeString('nl-NL', {hour: '2-digit', minute: '2-digit'})
                    };
                    c.data.messages.push(message);
                    // Update enhanced states
                    if (response.data.conversationState) {
                        c.data.conversationState = response.data.conversationState;
                        updateContextBar();
                    }
                    if (response.data.suggestedActions) {
                        c.data.suggestedActions = response.data.suggestedActions;
                    }
                    scrollToBottom();
                }
            });
        }
    };
    // Send quick reply
    $scope.sendQuickReply = function(reply) {
        c.data.userInput = reply.value || reply.text;
        $scope.sendMessage();
    };
    // Enhanced send message function
    $scope.sendMessage = function() {
        if (!c.data.userInput || c.data.userInput.trim() === '') {
            return;
        }
        // Clear suggested actions when sending message
        c.data.suggestedActions = [];
        var userMessage = {
            type: 'user',
            text: c.data.userInput,
            timestamp: new Date().toLocaleTimeString('nl-NL', {hour: '2-digit', minute: '2-digit'})
        };
        c.data.messages.push(userMessage);
        var messageText = c.data.userInput;
        c.data.userInput = '';
        c.data.loading = true;
        scrollToBottom();
        // Send to server with enhanced context
        c.server.get({
            action: 'send_message',
            message: messageText,
            model: c.data.selectedModel,
            orderState: c.data.orderState,
            conversationState: c.data.conversationState,
            context: c.data.activeContext,
            language: c.data.language
        }).then(handleEnhancedServerResponse);
    };
    // Enhanced server response handler
    function handleEnhancedServerResponse(response) {
        c.data.loading = false;
        // FIX: Check if response and response.data exist before accessing success
        if (!response || !response.data) {
            console.error('[Chatbot] Invalid response from server:', response);
            var errorMessage = {
                type: 'ai',
                text: 'Er is een fout opgetreden bij de communicatie met de server. Probeer het opnieuw.',
                timestamp: new Date().toLocaleTimeString('nl-NL', {hour: '2-digit', minute: '2-digit'})
            };
            c.data.messages.push(errorMessage);
            scrollToBottom();
            return;
        }
        if (response.data.success) {
            // Update enhanced order state
            if (response.data.orderState) {
                c.data.orderState = response.data.orderState;
            }
            // Update enhanced conversation state
            if (response.data.conversationState) {
                c.data.conversationState = response.data.conversationState;
                updateContextBar();
            }
            // Update context with enhanced styling
            if (response.data.context) {
                c.data.activeContext = response.data.context;
            }
            // Update suggested actions
            if (response.data.suggestedActions) {
                c.data.suggestedActions = response.data.suggestedActions;
            }
            // Create enhanced AI message
            var aiMessage = {
                type: 'ai',
                richContent: response.data.richContent || null,
                text: response.data.response,
                timestamp: new Date().toLocaleTimeString('nl-NL', {hour: '2-digit', minute: '2-digit'})
            };
            c.data.messages.push(aiMessage);
            // Apply enhanced styling after message is added
            $timeout(function() {
                applyEnhancedStyling();
            }, 100);
            if (response.data.tokenUsage) {
                c.data.tokenUsage = response.data.tokenUsage;
            }
            // Special handling for enhanced order completion
            if (c.data.conversationState.phase === 'idle' && 
                (response.data.response.indexOf('Gefeliciteerd') > -1 || 
                 response.data.response.indexOf('succesvol') > -1)) {
                // Enhanced order completion cleanup
                c.data.activeContext = null;
                c.data.conversationState.selectedItem = null;
                c.data.conversationState.approvalRequired = false;
                // Show enhanced celebration and reset
                setTimeout(function() {
                    initializeSuggestedActions();
                    $scope.$apply();
                }, 3000);
            }
        } else {
            var errorMessage = {
                type: 'ai',
                text: 'Error: ' + (response.data.error || 'Failed to get response'),
                timestamp: new Date().toLocaleTimeString('nl-NL', {hour: '2-digit', minute: '2-digit'})
            };
            c.data.messages.push(errorMessage);
        }
        scrollToBottom();
    }
    // Apply enhanced styling to rich content elements
    function applyEnhancedStyling() {
        // Apply complexity badges to catalog cards
        var catalogCards = document.querySelectorAll('.catalog-card');
        for (var i = 0; i < catalogCards.length; i++) {
            var card = catalogCards[i];
            var complexity = 'simple'; // Default
            // Extract complexity from data if available
            var cardData = card.getAttribute('data-complexity');
            if (cardData) {
                complexity = cardData;
            }
            card.setAttribute('data-complexity', complexity);
        }
        // Apply form progress indicators
        var formCards = document.querySelectorAll('.form-card');
        for (var j = 0; j < formCards.length; j++) {
            var form = formCards[j];
            var progress = 0;
            // Calculate progress based on conversation state
            if (c.data.conversationState.phase === 'collecting_variables' && 
                c.data.conversationState.itemVariables) {
                var current = c.data.conversationState.currentVariableIndex || 0;
                var total = c.data.conversationState.itemVariables.length;
                progress = Math.round((current / total) * 100);
            }
            form.setAttribute('data-progress', progress.toString());
        }
        // Apply enhanced context bar styling
        var contextBars = document.querySelectorAll('.context-bar');
        for (var k = 0; k < contextBars.length; k++) {
            var contextBar = contextBars[k];
            if (c.data.activeContext && c.data.activeContext.class) {
                contextBar.classList.add(c.data.activeContext.class);
            }
        }
        // Apply validation styling to info cards
        var infoCars = document.querySelectorAll('.info-card');
        for (var l = 0; l < infoCars.length; l++) {
            var infoCard = infoCars[l];
            var title = infoCard.querySelector('.info-title');
            if (title && (title.textContent.indexOf('Validatie') > -1 || 
                         title.textContent.indexOf('wordt voorbereid') > -1)) {
                infoCard.classList.add('validation');
            }
        }
    }
    // Scroll to bottom helper
    function scrollToBottom() {
        $timeout(function() {
            var container = document.getElementById('chatMessages');
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        }, 100);
    }
    // Handle Enter key
    $scope.handleKeyPress = function(event) {
        if (event.keyCode === 13 && !event.shiftKey) {
            event.preventDefault();
            $scope.sendMessage();
        }
    };
    // Enhanced clear context
    $scope.clearContext = function() {
        c.data.activeContext = null;
        c.data.orderState = {};
        c.data.conversationState = {
            phase: 'idle',
            selectedItem: null,
            currentStep: 0,
            itemComplexity: 'simple',
            approvalRequired: false
        };
        initializeSuggestedActions();
    };
    // Toggle settings panel
    $scope.toggleSettings = function() {
        $scope.showSettings = !$scope.showSettings;
    };
    // Update language with enhanced feedback
    $scope.updateLanguage = function() {
        c.data.inputPlaceholder = c.data.language === 'nl' ? 
            'Type je vraag hier...' : 'Type your question here...';
        // Update UI based on language with enhanced styling
        c.server.get({
            action: 'update_language',
            language: c.data.language
        }).then(function(response) {
            if (response.data.success) {
                // Show language change confirmation
                var langName = c.data.language === 'nl' ? 'Nederlands' : 'English';
                var confirmMessage = {
                    type: 'ai',
                    richContent: {
                        type: 'info',
                        icon: '🌍',
                        title: 'Taal Gewijzigd',
                        content: 'Interface taal is gewijzigd naar ' + langName,
                        color: '#000'
                    },
                    text: '',
                    timestamp: new Date().toLocaleTimeString('nl-NL', {hour: '2-digit', minute: '2-digit'})
                };
                c.data.messages.push(confirmMessage);
                scrollToBottom();
            }
        });
    };
    // Enhanced theme update
    $scope.updateTheme = function() {
        var widget = document.querySelector('.snow-flow-chatbot');
        if (widget) {
            if (c.data.theme === 'dark') {
                widget.classList.add('dark-theme');
            } else {
                widget.classList.remove('dark-theme');
            }
            // Show theme change confirmation
            var themeMessage = {
                type: 'ai',
                richContent: {
                    type: 'info',
                    icon: c.data.theme === 'dark' ? '🌙' : '☀️',
                    title: 'Thema Gewijzigd',
                    content: 'Interface thema is gewijzigd naar ' + (c.data.theme === 'dark' ? 'donker' : 'licht'),
                    color: '#000'
                },
                text: '',
                timestamp: new Date().toLocaleTimeString('nl-NL', {hour: '2-digit', minute: '2-digit'})
            };
            c.data.messages.push(themeMessage);
            scrollToBottom();
        }
    };
    // Enhanced attach menu with catalog search shortcuts
    $scope.toggleAttachMenu = function() {
        var quickSearches = [
            { term: 'laptop', icon: '💻' },
            { term: 'monitor', icon: '🖥️' },
            { term: 'telefoon', icon: '📱' },
            { term: 'toetsenbord', icon: '⌨️' },
            { term: 'muis', icon: '🖱️' },
            { term: 'printer', icon: '🖨️' },
            { term: 'software', icon: '💿' },
            { term: 'toegang', icon: '🔑' }
        ];
        c.data.suggestedActions = [];
        for (var i = 0; i < quickSearches.length; i++) {
            c.data.suggestedActions.push({
                icon: quickSearches[i].icon,
                text: 'Zoek ' + quickSearches[i].term,
                action: 'search_' + quickSearches[i].term
            });
        }
    };
    // Enhanced export chat
    $scope.exportChat = function() {
        var chatText = 'Snow-Flow AI Assistant - Enhanced Chat Export\n';
        chatText += 'Geëxporteerd op: ' + new Date().toLocaleString('nl-NL') + '\n';
        chatText += 'Model: ' + c.data.selectedModel + '\n';
        chatText += 'Tokens gebruikt: ' + (c.data.tokenUsage || 0) + '\n\n';
        // Add conversation state info
        if (c.data.conversationState.phase !== 'idle') {
            chatText += '--- Conversatie Status ---\n';
            chatText += 'Fase: ' + c.data.conversationState.phase + '\n';
            if (c.data.conversationState.selectedItem) {
                chatText += 'Geselecteerd item: ' + c.data.conversationState.selectedItem.name + '\n';
                chatText += 'Complexiteit: ' + (c.data.conversationState.itemComplexity || 'onbekend') + '\n';
                chatText += 'Goedkeuring vereist: ' + (c.data.conversationState.approvalRequired ? 'Ja' : 'Nee') + '\n';
            }
            chatText += '\n';
        }
        // Add messages
        for (var i = 0; i < c.data.messages.length; i++) {
            var msg = c.data.messages[i];
            var sender = msg.type === 'user' ? 'Gebruiker' : 'AI Assistant';
            chatText += '[' + msg.timestamp + '] ' + sender + ': ' + msg.text + '\n';
            // Add rich content info if present
            if (msg.richContent) {
                chatText += '  [Rich Content: ' + msg.richContent.type + ']\n';
            }
            chatText += '\n';
        }
        // Create enhanced download
        var blob = new Blob([chatText], {type: 'text/plain;charset=utf-8'});
        var url = window.URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'snow-flow-enhanced-chat-' + new Date().toISOString().substr(0,10) + '.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        // Show export confirmation
        var exportMessage = {
            type: 'ai',
            richContent: {
                type: 'status',
                title: 'Chat Geëxporteerd',
                message: 'Je chat is succesvol gedownload.',
                status: 'success',
                statusIcon: '💾',
                details: [
                    { label: 'Berichten', value: c.data.messages.length.toString() },
                    { label: 'Tokens', value: (c.data.tokenUsage || 0).toString() }
                ]
            },
            text: '',
            timestamp: new Date().toLocaleTimeString('nl-NL', {hour: '2-digit', minute: '2-digit'})
        };
        c.data.messages.push(exportMessage);
        scrollToBottom();
    };
    // Enhanced clear chat
    $scope.clearChat = function() {
        var confirmText = c.data.language === 'nl' ? 
            'Weet je zeker dat je het gesprek wilt wissen?' : 
            'Are you sure you want to clear the conversation?';
        if (confirm(confirmText)) {
            c.data.messages = [];
            c.data.tokenUsage = 0;
            c.data.orderState = {};
            c.data.conversationState = {
                phase: 'idle',
                selectedItem: null,
                currentStep: 0,
                itemComplexity: 'simple',
                approvalRequired: false
            };
            c.data.activeContext = null;
            initializeSuggestedActions();
            c.server.get({action: 'clear_chat'});
        }
    };
    // Enhanced model change
    $scope.changeModel = function() {
        c.server.get({
            action: 'change_model',
            model: c.data.selectedModel
        }).then(function(response) {
            if (response.data.success) {
                var infoMessage = {
                    type: 'ai',
                    richContent: {
                        type: 'info',
                        icon: '🔄',
                        title: 'AI Model Gewisseld',
                        content: 'Overgeschakeld naar <strong>' + c.data.selectedModel + '</strong>. De AI gebruikt nu dit model voor alle gesprekken en catalog interacties.',
                        color: '#000'
                    },
                    text: '',
                    timestamp: new Date().toLocaleTimeString('nl-NL', {hour: '2-digit', minute: '2-digit'})
                };
                c.data.messages.push(infoMessage);
                scrollToBottom();
            }
        });
    };
    // Auto-resize textarea
    angular.element(document).ready(function() {
        var textarea = document.querySelector('.chat-textarea');
        if (textarea) {
            textarea.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = Math.min(this.scrollHeight, 120) + 'px';
            });
        }
    });
    // Enhanced initialization
    c.server.get({action: 'init'}).then(function(response) {
        if (response.data.welcomeMessage && response.data.welcomeMessage !== '') {
            if (c.data.messages.length > 0) {
                c.data.messages.push({
                    type: 'ai',
                    text: response.data.welcomeMessage,
                    timestamp: new Date().toLocaleTimeString('nl-NL', {hour: '2-digit', minute: '2-digit'})
                });
            }
        }
        // Initialize enhanced suggested actions
        initializeSuggestedActions();
        // Apply initial enhanced styling
        $timeout(function() {
            applyEnhancedStyling();
        }, 500);
    });
    // Focus input on load
    $timeout(function() {
        var textarea = document.querySelector('.chat-textarea');
        if (textarea) {
            textarea.focus();
        }
    }, 500);
    // Enhanced periodic styling updates
    $timeout(function() {
        applyEnhancedStyling();
    }, 1000);
}