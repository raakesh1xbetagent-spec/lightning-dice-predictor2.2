// ============================================================
// COMPLETE script.js (UPDATED FOR v12.0 - SWITCH ONLY)
// Features: 3-Step Pattern Detection (TRIGGER) | SWITCH Model Only
// FIXED: Shows SWITCH model predictions only
// ============================================================

class LightningDiceApp {
    constructor() {
        this.apiBase = '/api';
        this.ws = null;
        this.allResults = [];
        this.predictionHistory = [];
        this.currentPrediction = null;
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.isInitialized = false;
        
        // Available 3-Step Patterns (ONLY for trigger detection)
        this.validPatterns = [
            "LOW→HIGH→MEDIUM",
            "HIGH→LOW→MEDIUM",
            "MEDIUM→LOW→HIGH",
            "MEDIUM→HIGH→LOW",
            "LOW→MEDIUM→HIGH",
            "HIGH→MEDIUM→LOW"
        ];
        
        this.groups = {
            LOW: { name: 'LOW', range: '3-9', numbers: [3,4,5,6,7,8,9], icon: '🔴' },
            MEDIUM: { name: 'MEDIUM', range: '10-11', numbers: [10,11], icon: '🟡' },
            HIGH: { name: 'HIGH', range: '12-18', numbers: [12,13,14,15,16,17,18], icon: '🟢' }
        };
        
        this.init();
    }
    
    async init() {
        console.log('🚀 Initializing SWITCH ONLY 3-Step Pattern AI System v12.0...');
        this.bindEvents();
        
        await this.loadInitialData();
        this.setupWebSocket();
        this.setupCollapsibleStats();
        this.isInitialized = true;
    }
    
    async loadInitialData() {
        console.log('📥 Loading initial data...');
        
        try {
            const response = await fetch(`${this.apiBase}/all-data`);
            if (!response.ok) throw new Error('Failed to load initial data');
            const data = await response.json();
            
            // Sort results by timestamp descending (newest first)
            this.allResults = (data.results || []).sort((a, b) => {
                return new Date(b.timestamp) - new Date(a.timestamp);
            });
            
            // Filter out WAITING predictions from history
            this.predictionHistory = (data.predictions || []).filter(p => {
                return p.predictedGroup && 
                       p.predictedGroup !== 'WAITING' && 
                       p.predictedGroup !== '--' &&
                       p.pattern3step && 
                       p.pattern3step !== '--';
            });
            this.currentPrediction = data.currentPrediction || null;
            
            // Store models status if available
            if (data.modelsStatus) {
                this.modelsStatus = data.modelsStatus;
            }
            
            // Log pattern info
            if (this.allResults.length >= 3) {
                const last3 = this.allResults.slice(0, 3).map(r => r.group);
                console.log(`📊 Last 3 results: ${last3.join(' → ')}`);
                console.log(`📊 Pattern check: ${this.checkPatternMatch(last3) ? 'MATCH (TRIGGER)' : 'NO MATCH (WAIT MODE)'}`);
            }
            
            console.log(`✅ Filtered prediction history: ${this.predictionHistory.length} valid predictions (WAITING removed)`);
            
            this.displayPrediction(this.currentPrediction);
            this.renderHistoryTable();
            this.updateRecentResultsDisplay();
            this.updateStatisticsTable();
            this.updateGroupProbabilities();
            this.updateStatsDisplay(data.stats);
            this.updateLast3ResultsDisplay();
            this.updateModelsStatusDisplay();
            
            console.log(`✅ Initial data loaded: ${this.allResults.length} results, ${this.predictionHistory.length} valid predictions`);
        } catch (error) {
            console.error('Error loading initial data:', error);
            setTimeout(() => this.loadInitialData(), 2000);
        }
    }
    
    checkPatternMatch(last3Results) {
        if (!last3Results || last3Results.length !== 3) return false;
        const patternString = `${last3Results[0]}→${last3Results[1]}→${last3Results[2]}`;
        return this.validPatterns.includes(patternString);
    }
    
    updateLast3ResultsDisplay() {
        const last3Container = document.getElementById('last3Results');
        const patternStatusEl = document.getElementById('patternStatus');
        
        if (!last3Container) return;
        
        if (this.allResults.length >= 3) {
            const last3 = this.allResults.slice(0, 3).map(r => r.group);
            const patternString = `${last3[0]} → ${last3[1]} → ${last3[2]}`;
            last3Container.innerHTML = `<strong>${patternString}</strong>`;
            
            const isMatch = this.checkPatternMatch(last3);
            if (patternStatusEl) {
                if (isMatch) {
                    patternStatusEl.innerHTML = '<span class="status-match">✅ PATTERN MATCHED - SWITCH Model ACTIVE</span>';
                } else {
                    patternStatusEl.innerHTML = '<span class="status-wait">⏳ WAIT MODE - Pattern not recognized, waiting for next result</span>';
                }
            }
        } else {
            last3Container.innerHTML = `<strong>-- → -- → --</strong> <span style="color:#fbbf24;">(Need ${3 - this.allResults.length} more results)</span>`;
            if (patternStatusEl) {
                patternStatusEl.innerHTML = '<span class="status-wait">⏳ Collecting data... waiting for 3 results</span>';
            }
        }
    }
    
    updateModelsStatusDisplay() {
        const modelsStatusDiv = document.getElementById('modelsStatus');
        if (!modelsStatusDiv) return;
        
        // Get SWITCH model status from current prediction or modelsStatus
        let switchValue = '--';
        let switchAccuracy = 0;
        let isActive = false;
        let retryCount = 0;
        
        if (this.currentPrediction && !this.currentPrediction.waitingForData) {
            switchValue = this.currentPrediction.switchValue || this.currentPrediction.dynamicSwitchValue || '--';
            isActive = this.currentPrediction.isPredictionModeActive || false;
            retryCount = this.currentPrediction.retryCount || 0;
        }
        
        if (this.modelsStatus && this.modelsStatus.switch) {
            switchAccuracy = this.modelsStatus.switch.accuracy || 0;
            if (this.modelsStatus.switch.currentValue) {
                switchValue = this.modelsStatus.switch.currentValue;
            }
            isActive = this.modelsStatus.switch.isActive || isActive;
        }
        
        const activeClass = isActive ? 'active-card' : '';
        const statusText = isActive ? '🟢 ACTIVE' : '⚪ INACTIVE';
        const retryText = retryCount > 0 ? `<div class="retry-info">🔄 Retry #${retryCount}</div>` : '';
        
        modelsStatusDiv.innerHTML = `
            <div class="models-title">🔬 SWITCH MODEL STATUS</div>
            <div class="model-cards">
                <div class="model-card switch-card ${activeClass}">
                    <div class="model-name">🟡 SWITCH MODEL</div>
                    <div class="model-value switch">${switchValue}</div>
                    <div class="model-accuracy">Accuracy: ${switchAccuracy.toFixed(1)}%</div>
                    <div class="model-status">${statusText}</div>
                    ${retryText}
                </div>
            </div>
        `;
    }
    
    displayPrediction(prediction) {
        if (!prediction) {
            console.log('⚠️ No prediction data available');
            this.showWaitingState();
            return;
        }
        
        this.currentPrediction = prediction;
        
        // Update pattern info
        const patternNameEl = document.getElementById('patternName');
        const protectionTypeEl = document.getElementById('protectionType');
        const predictionGroupEl = document.getElementById('predictionGroup');
        const predictionConfidenceEl = document.getElementById('predictionConfidence');
        const patternDescriptionEl = document.getElementById('patternDescription');
        const activeModelDisplay = document.getElementById('activeModelDisplay');
        
        // Update final prediction card
        const finalIcon = document.getElementById('finalIcon');
        const finalName = document.getElementById('finalName');
        const finalRange = document.getElementById('finalRange');
        const confidenceFill = document.getElementById('confidenceFill');
        const finalConfidence = document.getElementById('finalConfidence');
        const finalExplanation = document.getElementById('finalExplanation');
        const predictionType = document.getElementById('predictionType');
        const finalWeights = document.getElementById('finalWeights');
        
        // Check if waiting for data
        if (prediction.waitingForData || prediction.status === 'WAITING') {
            this.showWaitingState();
            return;
        }
        
        // Pattern matched - show prediction
        const pattern3step = prediction.pattern3step || prediction.pattern || '--';
        const predictedGroup = prediction.predictedGroup || prediction.ensemble || '--';
        const confidence = prediction.confidence || prediction.ensembleConfidence || 50;
        const description = prediction.description || this.getPatternDescription(pattern3step);
        const isRetry = prediction.isRetry || false;
        const retryCount = prediction.retryCount || 0;
        
        // Get SWITCH model values
        const switchValue = prediction.switchValue || prediction.dynamicSwitchValue || '--';
        const isPredictionModeActive = prediction.isPredictionModeActive || false;
        
        if (patternNameEl) patternNameEl.innerHTML = `<span class="pattern-highlight">${pattern3step}</span>`;
        if (protectionTypeEl) {
            protectionTypeEl.innerHTML = `<span class="protection-switch">SWITCH</span>`;
        }
        if (activeModelDisplay) {
            activeModelDisplay.innerHTML = isPredictionModeActive ? '<span class="status-active">SWITCH ACTIVE</span>' : '<span class="status-match">WAIT MODE</span>';
        }
        if (predictionGroupEl) predictionGroupEl.innerHTML = `${this.getGroupIcon(predictedGroup)} ${predictedGroup}`;
        if (predictionConfidenceEl) predictionConfidenceEl.textContent = `${confidence}%`;
        if (patternDescriptionEl) {
            if (isRetry && retryCount > 0) {
                patternDescriptionEl.innerHTML = `${description} <span class="retry-badge">Retry #${retryCount}</span>`;
            } else {
                patternDescriptionEl.textContent = description;
            }
        }
        
        // Final prediction card
        if (finalIcon) finalIcon.textContent = this.getGroupIcon(predictedGroup);
        if (finalName) finalName.textContent = predictedGroup;
        if (finalRange) finalRange.textContent = `(${this.getGroupRange(predictedGroup)})`;
        if (confidenceFill) confidenceFill.style.width = `${confidence}%`;
        if (finalConfidence) finalConfidence.textContent = `${confidence}%`;
        if (predictionType) predictionType.textContent = `(SWITCH Model)`;
        
        // Enhanced explanation
        if (finalExplanation) {
            if (isPredictionModeActive) {
                const retryText = isRetry ? `<br><span style="color:#fbbf24;">🔄 Retry #${retryCount} - Same model continues until correct</span>` : '';
                finalExplanation.innerHTML = `
                    <strong>🎯 SWITCH MODEL PREDICTION MODE ACTIVE</strong><br>
                    Pattern <strong>${pattern3step}</strong> detected (TRIGGER).<br><br>
                    🟡 <strong>SWITCH Model</strong> predicts: <strong style="color:#fbbf24;">${predictedGroup}</strong><br>
                    <span style="font-size:11px;">(Always predicts PREVIOUS result)</span><br><br>
                    <span style="font-size:11px; opacity:0.7;">🔄 Values update automatically with each new result until correct.</span>
                    ${retryText}
                `;
            } else {
                finalExplanation.innerHTML = `Pattern <strong>${pattern3step}</strong> detected. Using <strong>SWITCH</strong> model: predicting <strong>${predictedGroup}</strong> with ${confidence}% confidence.<br><span style="font-size:11px;">(Predicts PREVIOUS result from the pattern)</span>`;
            }
        }
        
        // Show SWITCH model's current value
        if (finalWeights) {
            finalWeights.innerHTML = `
                <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; margin-top: 5px;">
                    <div style="text-align: center;">
                        <span style="color:#fbbf24;">🟡 SWITCH Model</span><br>
                        <strong style="font-size: 24px; color:#fbbf24;">${switchValue}</strong><br>
                        <span style="font-size: 10px;">Previous Result (Dynamic)</span>
                        ${isRetry ? `<div style="margin-top: 8px;"><span class="retry-badge">⚠️ Wrong prediction - Model continues with updated value</span></div>` : ''}
                    </div>
                </div>
            `;
        }
        
        // Update models status display
        this.updateModelsStatusDisplay();
    }
    
    showWaitingState() {
        const patternNameEl = document.getElementById('patternName');
        const protectionTypeEl = document.getElementById('protectionType');
        const predictionGroupEl = document.getElementById('predictionGroup');
        const predictionConfidenceEl = document.getElementById('predictionConfidence');
        const finalName = document.getElementById('finalName');
        const finalConfidence = document.getElementById('finalConfidence');
        const finalExplanation = document.getElementById('finalExplanation');
        const confidenceFill = document.getElementById('confidenceFill');
        const predictionType = document.getElementById('predictionType');
        const finalWeights = document.getElementById('finalWeights');
        const activeModelDisplay = document.getElementById('activeModelDisplay');
        
        if (patternNameEl) patternNameEl.innerHTML = '<span class="waiting-text">⏳ Waiting for 3 results...</span>';
        if (protectionTypeEl) protectionTypeEl.innerHTML = '<span class="waiting-text">--</span>';
        if (activeModelDisplay) activeModelDisplay.innerHTML = '<span class="status-wait">WAIT MODE</span>';
        if (predictionGroupEl) predictionGroupEl.innerHTML = '<span class="waiting-text">WAITING</span>';
        if (predictionConfidenceEl) predictionConfidenceEl.textContent = '0%';
        if (finalName) finalName.textContent = 'WAITING';
        if (finalConfidence) finalConfidence.textContent = '0%';
        if (confidenceFill) confidenceFill.style.width = '0%';
        if (predictionType) predictionType.textContent = '(WAIT MODE)';
        if (finalExplanation) {
            const needed = 3 - (this.allResults?.length || 0);
            finalExplanation.innerHTML = `⏳ Pattern recognition requires 3 results. Currently have ${this.allResults?.length || 0} results. ${needed > 0 ? `Need ${needed} more result(s) to analyze pattern.` : 'Analyzing pattern...'}<br><br>
            <span style="font-size:11px;">✨ When pattern matches, SWITCH MODEL activates:<br>
            🟡 SWITCH Model predicts PREVIOUS result (updates dynamically on wrong prediction)</span>`;
        }
        if (finalWeights) finalWeights.innerHTML = '';
        
        // Update models status to show inactive
        this.updateModelsStatusDisplay();
    }
    
    getPatternDescription(pattern) {
        const descriptions = {
            "LOW→HIGH→MEDIUM": "LOW থেকে HIGH হয়ে MEDIUM এ এসেছে - SWITCH Model predicts: HIGH",
            "HIGH→LOW→MEDIUM": "HIGH থেকে LOW হয়ে MEDIUM এ এসেছে - SWITCH Model predicts: LOW",
            "MEDIUM→LOW→HIGH": "MEDIUM থেকে LOW হয়ে HIGH এ এসেছে - SWITCH Model predicts: LOW",
            "MEDIUM→HIGH→LOW": "MEDIUM থেকে HIGH হয়ে LOW এ এসেছে - SWITCH Model predicts: HIGH",
            "LOW→MEDIUM→HIGH": "LOW থেকে MEDIUM হয়ে HIGH এ এসেছে - SWITCH Model predicts: MEDIUM",
            "HIGH→MEDIUM→LOW": "HIGH থেকে MEDIUM হয়ে LOW এ এসেছে - SWITCH Model predicts: MEDIUM"
        };
        return descriptions[pattern] || "3-step pattern detected - SWITCH model activated (predicts previous result)";
    }
    
    updateStatsDisplay(stats) {
        if (!stats) return;
        
        const totalRoundsEl = document.getElementById('totalRounds');
        const avgResultEl = document.getElementById('avgResult');
        const mostActiveGroupEl = document.getElementById('mostActiveGroup');
        const lightningBoostEl = document.getElementById('lightningBoost');
        
        if (totalRoundsEl) totalRoundsEl.textContent = (stats.totalRounds || 0).toLocaleString();
        if (avgResultEl) avgResultEl.textContent = stats.avgResult || '0.00';
        if (mostActiveGroupEl) mostActiveGroupEl.textContent = stats.mostActiveGroup || 'LOW';
        if (lightningBoostEl) lightningBoostEl.textContent = `${stats.lightningBoost || 0}%`;
    }
    
    renderHistoryTable() {
        const tbody = document.getElementById('historyTableBody');
        if (!tbody) return;
        
        if (!this.predictionHistory || this.predictionHistory.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7">No predictions yet. Waiting for pattern match...</td></tr>';
            this.updatePaginationControls();
            return;
        }
        
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const pageItems = this.predictionHistory.slice(startIndex, startIndex + this.itemsPerPage);
        
        if (pageItems.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7">No history data on this page...</td></tr>';
            this.updatePaginationControls();
            return;
        }
        
        tbody.innerHTML = pageItems.map(item => {
            const getIcon = (g) => {
                if (g === 'LOW') return '🔴';
                if (g === 'MEDIUM') return '🟡';
                if (g === 'HIGH') return '🟢';
                return '⚪';
            };
            
            const getBadgeClass = (isCorrect, isPending) => {
                if (isPending) return 'pending';
                if (isCorrect === true) return 'correct';
                if (isCorrect === false) return 'incorrect';
                return '';
            };
            
            const getCheckmark = (isCorrect, isPending) => {
                if (isPending) return '⏳';
                if (isCorrect === true) return '✓';
                if (isCorrect === false) return '✗';
                return '?';
            };
            
            const isPending = item.isPending || false;
            const actualDisplay = item.actualGroup && item.actualGroup !== '?' ? `${getIcon(item.actualGroup)} ${item.actualGroup}` : 'Pending';
            const protectionDisplay = 'SWITCH';
            const retryText = item.isRetry ? `<div style="font-size:8px; opacity:0.6;">Retry #${item.retryNumber || 0}</div>` : '';
            
            return `
                <tr>
                    <td style="font-size: 11px;">${item.time || '--'}</td>
                    <td class="dice-values" style="font-size: 11px;">🎲 ${item.dice || '--'}</td>
                    <td><strong>${item.total || '--'}</strong><br><small>${actualDisplay}</small></td>
                    <td><span class="pattern-badge">${item.pattern3step || '--'}</span></td>
                    <td><span class="protection-badge badge-switch">${protectionDisplay}</span>${retryText}</td>
                    <td><span class="prediction-badge">${getIcon(item.predictedGroup)} ${item.predictedGroup || '--'}</span></td>
                    <td><span class="result-badge ${getBadgeClass(item.isCorrect, isPending)}">${getCheckmark(item.isCorrect, isPending)}</span></td>
                </tr>
            `;
        }).join('');
        
        this.updatePaginationControls();
    }
    
    updatePaginationControls() {
        const totalPages = Math.max(1, Math.ceil(this.predictionHistory.length / this.itemsPerPage));
        const paginationInfo = document.getElementById('paginationInfo');
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        
        if (paginationInfo) paginationInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
        if (prevBtn) prevBtn.disabled = this.currentPage === 1;
        if (nextBtn) nextBtn.disabled = this.currentPage === totalPages;
    }
    
    updateRecentResultsDisplay() {
        const resultsGrid = document.getElementById('resultsGrid');
        if (!resultsGrid) return;
        
        if (!this.allResults || this.allResults.length === 0) {
            resultsGrid.innerHTML = '<div class="loading">No results yet. Waiting for data...</div>';
            return;
        }
        
        const recentResults = this.allResults.slice(0, 10);
        resultsGrid.innerHTML = recentResults.map(result => {
            const isLightning = result.multiplier > 10;
            const time = result.timestamp ? new Date(result.timestamp).toLocaleTimeString() : '--';
            const groupIcon = this.groups[result.group]?.icon || '🎲';
            
            return `
                <div class="result-card ${isLightning ? 'lightning' : ''}">
                    <div class="result-number">${groupIcon} ${result.total}</div>
                    <div class="result-multiplier">${result.multiplier || 1}x</div>
                    <div class="result-time">${time}</div>
                    <div class="result-dice">${result.diceValues || '--'}</div>
                </div>
            `;
        }).join('');
    }
    
    updateStatisticsTable() {
        const tbody = document.getElementById('statsTableBody');
        if (!tbody) return;
        
        if (!this.allResults || this.allResults.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">No data available yet......</td></tr>';
            return;
        }
        
        const numberStats = {};
        this.allResults.forEach(result => {
            if (!numberStats[result.total]) {
                numberStats[result.total] = { count: 0, lastSeen: result.timestamp };
            }
            numberStats[result.total].count++;
            if (result.timestamp > numberStats[result.total].lastSeen) {
                numberStats[result.total].lastSeen = result.timestamp;
            }
        });
        
        const sortedNumbers = Object.keys(numberStats).sort((a,b) => parseInt(a) - parseInt(b));
        const total = this.allResults.length;
        
        tbody.innerHTML = sortedNumbers.map(num => {
            const stat = numberStats[num];
            const numInt = parseInt(num);
            let group = this.getGroup(numInt);
            const groupClass = `group-${group.toLowerCase()}`;
            const percentage = total > 0 ? ((stat.count / total) * 100).toFixed(1) : 0;
            const timeAgo = this.getTimeAgo(stat.lastSeen);
            
            return `
                <tr>
                    <td><strong>${num}</strong></td>
                    <td><span class="group-badge ${groupClass}">${group}</span></td>
                    <td>${stat.count}</td>
                    <td>${percentage}%</td>
                    <td>${timeAgo}</td>
                </tr>
            `;
        }).join('');
    }
    
    updateGroupProbabilities() {
        if (!this.allResults || this.allResults.length === 0) {
            const lowProb = document.getElementById('lowProb');
            const mediumProb = document.getElementById('mediumProb');
            const highProb = document.getElementById('highProb');
            if (lowProb) lowProb.textContent = '0%';
            if (mediumProb) mediumProb.textContent = '0%';
            if (highProb) highProb.textContent = '0%';
            return;
        }
        
        const recentResults = this.allResults.slice(0, 30);
        const recentCount = { LOW: 0, MEDIUM: 0, HIGH: 0 };
        recentResults.forEach(r => { if (r && r.group) recentCount[r.group]++; });
        
        const total = recentResults.length || 1;
        const lowProb = document.getElementById('lowProb');
        const mediumProb = document.getElementById('mediumProb');
        const highProb = document.getElementById('highProb');
        const lowTrend = document.getElementById('lowTrend');
        const mediumTrend = document.getElementById('mediumTrend');
        const highTrend = document.getElementById('highTrend');
        
        if (lowProb) lowProb.textContent = `${Math.round((recentCount.LOW / total) * 100)}%`;
        if (mediumProb) mediumProb.textContent = `${Math.round((recentCount.MEDIUM / total) * 100)}%`;
        if (highProb) highProb.textContent = `${Math.round((recentCount.HIGH / total) * 100)}%`;
        if (lowTrend) lowTrend.textContent = this.getTrendText(recentCount.LOW, total);
        if (mediumTrend) mediumTrend.textContent = this.getTrendText(recentCount.MEDIUM, total);
        if (highTrend) highTrend.textContent = this.getTrendText(recentCount.HIGH, total);
    }
    
    getTrendText(count, total) {
        const percentage = (count / total) * 100;
        if (percentage > 40) return '🔥 Hot streak';
        if (percentage > 20) return '📈 Warming up';
        if (percentage > 10) return '⚖️ Average';
        return '❄️ Cooling down';
    }
    
    getGroupIcon(group) {
        if (group === 'LOW') return '🔴';
        if (group === 'MEDIUM') return '🟡';
        if (group === 'HIGH') return '🟢';
        return '⚪';
    }
    
    getGroupRange(group) {
        if (group === 'LOW') return '3-9';
        if (group === 'MEDIUM') return '10-11';
        if (group === 'HIGH') return '12-18';
        return '-';
    }
    
    getGroup(number) {
        const num = parseInt(number);
        if (num >= 3 && num <= 9) return 'LOW';
        if (num >= 10 && num <= 11) return 'MEDIUM';
        if (num >= 12 && num <= 18) return 'HIGH';
        return 'UNKNOWN';
    }
    
    getTimeAgo(date) {
        if (!date) return 'Unknown';
        const diffMins = Math.floor((new Date() - new Date(date)) / 60000);
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
        return `${Math.floor(diffMins / 1440)}d ago`;
    }
    
    updateConnectionStatus(isConnected) {
        const statusText = document.getElementById('statusText');
        const statusDot = document.querySelector('.status-dot');
        if (statusText) statusText.textContent = isConnected ? 'Live' : 'Reconnecting...';
        if (statusDot) statusDot.style.background = isConnected ? '#4ade80' : '#ef4444';
    }
    
    setupWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        let reconnectDelay = 1000;
        const maxDelay = 30000;
        
        const connect = () => {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('🔌 WebSocket connected - listening for real-time updates');
                reconnectDelay = 1000;
                this.updateConnectionStatus(true);
            };
            
            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                
                if (data.type === 'new_result') {
                    console.log('🆕 Real-time update received via WebSocket');
                    this.handleRealtimeUpdate(data);
                } else if (data.type === 'prediction_pending') {
                    console.log('⏳ Prediction pending update');
                    this.updatePendingStatus(data.data);
                }
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus(false);
            };
            
            this.ws.onclose = () => {
                console.log(`WebSocket disconnected, reconnecting in ${reconnectDelay}ms...`);
                this.updateConnectionStatus(false);
                setTimeout(connect, reconnectDelay);
                reconnectDelay = Math.min(reconnectDelay * 1.5, maxDelay);
            };
        };
        
        connect();
    }
    
    handleRealtimeUpdate(data) {
        console.log('📨 Processing realtime update:', data.type);
        
        // Update allResults from server with proper sorting
        if (data.allResults) {
            this.allResults = data.allResults.sort((a, b) => {
                return new Date(b.timestamp) - new Date(a.timestamp);
            });
            console.log(`📊 Updated allResults with ${this.allResults.length} entries`);
            if (this.allResults.length >= 3) {
                const last3 = this.allResults.slice(0, 3).map(r => r.group);
                console.log(`📊 Last 3 pattern: ${last3.join(' → ')}`);
            }
            this.updateRecentResultsDisplay();
            this.updateStatisticsTable();
            this.updateGroupProbabilities();
            this.updateLast3ResultsDisplay();
        }
        
        // Add new result to allResults array
        if (data.result) {
            const exists = this.allResults.some(r => r.id === data.result.id);
            if (!exists) {
                this.allResults.unshift(data.result);
                this.allResults.sort((a, b) => {
                    return new Date(b.timestamp) - new Date(a.timestamp);
                });
                if (this.allResults.length > 100) this.allResults.pop();
                
                this.updateRecentResultsDisplay();
                this.updateStatisticsTable();
                this.updateGroupProbabilities();
                this.updateLast3ResultsDisplay();
            }
        }
        
        // Only add valid prediction to history (not WAITING)
        if (data.prediction && data.result) {
            const predictedGroup = data.prediction.predictedGroup || data.prediction.ensemble || '--';
            const pattern3step = data.prediction.pattern3step || data.prediction.pattern || '--';
            
            // Only add if it's a valid prediction (not WAITING)
            if (predictedGroup !== 'WAITING' && predictedGroup !== '--' && pattern3step !== '--') {
                const newPrediction = {
                    id: data.result.id,
                    time: new Date().toLocaleTimeString(),
                    dice: data.result.diceValues || '--',
                    total: data.result.total,
                    actualGroup: data.result.group,
                    pattern3step: pattern3step,
                    protectionType: 'SWITCH',
                    predictedGroup: predictedGroup,
                    isCorrect: data.prediction.isCorrect || false,
                    isRetry: data.prediction.isRetry || false,
                    retryNumber: data.prediction.retryCount || 0,
                    timestamp: new Date(),
                    isPending: false,
                    switchValue: data.prediction.dynamicSwitchValue || data.prediction.switchValue
                };
                this.predictionHistory.unshift(newPrediction);
                if (this.predictionHistory.length > 1000) this.predictionHistory.pop();
                console.log(`✅ Added valid prediction to history: ${predictedGroup} using SWITCH model`);
            } else {
                console.log(`⚠️ Skipping WAITING prediction in history`);
            }
            this.renderHistoryTable();
        }
        
        // Update predictions history if provided (already filtered by server)
        if (data.history) {
            this.predictionHistory = data.history;
            this.renderHistoryTable();
        }
        
        // Update current prediction display
        if (data.prediction) {
            this.currentPrediction = data.prediction;
            this.displayPrediction(data.prediction);
        }
        
        // Update models status
        if (data.prediction && data.prediction.modelsStatus) {
            this.modelsStatus = data.prediction.modelsStatus;
            this.updateModelsStatusDisplay();
        }
        
        // Update other UI components
        if (data.stats) this.updateStatsDisplay(data.stats);
        
        this.updateGroupProbabilities();
        this.updateStatisticsTable();
        this.animateNewResult();
    }
    
    updatePendingStatus(data) {
        const pendingPrediction = this.predictionHistory.find(p => p.id === data.result_id);
        if (pendingPrediction) {
            pendingPrediction.isPending = true;
            this.renderHistoryTable();
        }
    }
    
    setupCollapsibleStats() {
        const statsHeader = document.getElementById('statsHeader');
        const statsContent = document.getElementById('statsContent');
        const toggleIcon = document.getElementById('toggleIcon');
        
        if (statsHeader && statsContent && toggleIcon) {
            statsHeader.addEventListener('click', () => {
                const isVisible = statsContent.style.display !== 'none';
                statsContent.style.display = isVisible ? 'none' : 'block';
                toggleIcon.classList.toggle('open', !isVisible);
            });
        }
    }
    
    bindEvents() {
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) refreshBtn.addEventListener('click', () => this.loadInitialData());
        
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        if (prevBtn) prevBtn.addEventListener('click', () => this.changePage(-1));
        if (nextBtn) nextBtn.addEventListener('click', () => this.changePage(1));
    }
    
    changePage(delta) {
        const newPage = this.currentPage + delta;
        const totalPages = Math.max(1, Math.ceil(this.predictionHistory.length / this.itemsPerPage));
        if (newPage >= 1 && newPage <= totalPages) {
            this.currentPage = newPage;
            this.renderHistoryTable();
        }
    }
    
    animateNewResult() {
        const predictionBox = document.querySelector('.prediction-section');
        if (predictionBox) {
            predictionBox.style.animation = 'none';
            setTimeout(() => predictionBox.style.animation = 'slideIn 0.3s ease', 10);
        }
    }
}

// Initialize app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.app = new LightningDiceApp();
    });
} else {
    window.app = new LightningDiceApp();
}
