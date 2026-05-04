// ============================================================
// COMPLETE script.js (UPDATED FOR v11.3 - Independent Dual Model)
// Features: 3-Step Pattern Detection | CONTINUE & SWITCH Models | Selector Model
// NEW: Unified table with CONTINUE, SWITCH, FINAL columns with color coding
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
        this.userPreference = 'AUTO';
        
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
        console.log('🚀 Initializing Independent Dual Model 3-Step Pattern AI System v11.3...');
        this.bindEvents();
        
        await this.loadUserPreference();
        await this.loadInitialData();
        this.setupWebSocket();
        this.setupCollapsibleStats();
        this.setupPreferenceSelector();
        this.isInitialized = true;
    }
    
    async loadUserPreference() {
        try {
            const response = await fetch(`${this.apiBase}/user-preference`);
            const data = await response.json();
            if (data.success) {
                this.userPreference = data.preference;
                console.log(`👤 User preference loaded: ${this.userPreference}`);
                this.updatePreferenceSelectorUI();
            }
        } catch (error) {
            console.error('Error loading user preference:', error);
        }
    }
    
    async updateUserPreference(preference) {
        try {
            const response = await fetch(`${this.apiBase}/user-preference`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ preference: preference })
            });
            const data = await response.json();
            if (data.success) {
                this.userPreference = preference;
                console.log(`👤 User preference updated to: ${preference}`);
                this.updatePreferenceSelectorUI();
                await this.loadInitialData();
                return true;
            }
        } catch (error) {
            console.error('Error updating user preference:', error);
        }
        return false;
    }
    
    updatePreferenceSelectorUI() {
        const continueRadio = document.getElementById('prefContinue');
        const switchRadio = document.getElementById('prefSwitch');
        const autoRadio = document.getElementById('prefAuto');
        
        if (continueRadio) continueRadio.checked = (this.userPreference === 'CONTINUE');
        if (switchRadio) switchRadio.checked = (this.userPreference === 'SWITCH');
        if (autoRadio) autoRadio.checked = (this.userPreference === 'AUTO');
    }
    
    setupPreferenceSelector() {
        const continueRadio = document.getElementById('prefContinue');
        const switchRadio = document.getElementById('prefSwitch');
        const autoRadio = document.getElementById('prefAuto');
        
        if (continueRadio) {
            continueRadio.addEventListener('change', (e) => {
                if (e.target.checked) this.updateUserPreference('CONTINUE');
            });
        }
        if (switchRadio) {
            switchRadio.addEventListener('change', (e) => {
                if (e.target.checked) this.updateUserPreference('SWITCH');
            });
        }
        if (autoRadio) {
            autoRadio.addEventListener('change', (e) => {
                if (e.target.checked) this.updateUserPreference('AUTO');
            });
        }
    }
    
    async loadInitialData() {
        console.log('📥 Loading initial data...');
        
        try {
            const response = await fetch(`${this.apiBase}/all-data`);
            if (!response.ok) throw new Error('Failed to load initial data');
            const data = await response.json();
            
            this.allResults = (data.results || []).sort((a, b) => {
                return new Date(b.timestamp) - new Date(a.timestamp);
            });
            
            this.predictionHistory = (data.predictions || []).filter(p => {
                return p.predictedGroup && 
                       p.predictedGroup !== 'WAITING' && 
                       p.predictedGroup !== '--' &&
                       p.pattern3step && 
                       p.pattern3step !== '--';
            });
            this.currentPrediction = data.currentPrediction || null;
            
            if (data.modelsStatus) {
                this.modelsStatus = data.modelsStatus;
            }
            
            if (this.allResults.length >= 3) {
                const last3 = this.allResults.slice(0, 3).map(r => r.group);
                console.log(`📊 Last 3 results: ${last3.join(' → ')}`);
                console.log(`📊 Pattern check: ${this.checkPatternMatch(last3) ? 'MATCH (TRIGGER)' : 'NO MATCH (WAIT MODE)'}`);
            }
            
            console.log(`✅ Filtered prediction history: ${this.predictionHistory.length} valid predictions`);
            
            this.displayPrediction(this.currentPrediction);
            this.renderHistoryTable();
            this.updateRecentResultsDisplay();
            this.updateStatisticsTable();
            this.updateGroupProbabilities();
            this.updateStatsDisplay(data.stats);
            this.updateLast3ResultsDisplay();
            
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
        
        if (this.allResults.length >= 3) {
            const last3 = this.allResults.slice(0, 3).map(r => r.group);
            const patternString = `${last3[0]} → ${last3[1]} → ${last3[2]}`;
            if (last3Container) last3Container.innerHTML = `<strong>${patternString}</strong>`;
            
            const isMatch = this.checkPatternMatch(last3);
            if (patternStatusEl) {
                if (isMatch) {
                    patternStatusEl.innerHTML = '<span class="status-match">✅ PATTERN MATCHED - Prediction mode ACTIVE</span>';
                } else {
                    patternStatusEl.innerHTML = '<span class="status-wait">⏳ WAIT MODE - Pattern not recognized</span>';
                }
            }
        } else {
            if (last3Container) last3Container.innerHTML = `<strong>-- → -- → --</strong> <span style="color:#fbbf24;">(Need ${3 - this.allResults.length} more results)</span>`;
            if (patternStatusEl) {
                patternStatusEl.innerHTML = '<span class="status-wait">⏳ Waiting for 3 results...</span>';
            }
        }
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
                } else if (data.type === 'sub_pattern_detected') {
                    console.log('🔍 Sub-pattern detected via WebSocket!', data.data);
                    this.handleSubPatternAlert(data.data);
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
    
    handleSubPatternAlert(data) {
        console.log('🔍 Showing sub-pattern alert:', data);
        
        const alertDiv = document.getElementById('subAlert');
        const continuePatternEl = document.getElementById('subContinueVal');
        const switchPatternEl = document.getElementById('subSwitchVal');
        const timeEl = document.getElementById('subTime');
        
        if (!alertDiv) return;
        
        if (continuePatternEl) {
            continuePatternEl.innerHTML = `${data.subPattern}<br><span style="font-size:9px;">Current: ${data.currentPattern || '--'}</span>`;
        }
        if (switchPatternEl) {
            switchPatternEl.innerHTML = `${data.subPattern}<br><span style="font-size:9px;">Current: ${data.currentPattern || '--'}</span>`;
        }
        if (timeEl) {
            timeEl.innerHTML = `🕐 Detected: ${new Date(data.timestamp).toLocaleTimeString()}`;
        }
        
        alertDiv.style.display = 'block';
        alertDiv.style.animation = 'none';
        setTimeout(() => {
            alertDiv.style.animation = 'slideIn 0.5s ease';
        }, 10);
        
        setTimeout(() => {
            if (alertDiv.style.display !== 'none') {
                alertDiv.style.display = 'none';
            }
        }, 12000);
    }
    
    handleRealtimeUpdate(data) {
        console.log('📨 Processing realtime update:', data.type);
        
        if (data.allResults) {
            this.allResults = data.allResults.sort((a, b) => {
                return new Date(b.timestamp) - new Date(a.timestamp);
            });
            console.log(`📊 Updated allResults with ${this.allResults.length} entries`);
            this.updateRecentResultsDisplay();
            this.updateStatisticsTable();
            this.updateGroupProbabilities();
            this.updateLast3ResultsDisplay();
        }
        
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
        
        if (data.prediction && data.result) {
            const predictedGroup = data.prediction.predictedGroup || '--';
            const pattern3step = data.prediction.pattern3step || data.prediction.pattern || '--';
            
            if (predictedGroup !== 'WAITING' && predictedGroup !== '--' && pattern3step !== '--') {
                const newPrediction = {
                    id: data.result.id,
                    time: new Date().toLocaleTimeString(),
                    dice: data.result.diceValues || '--',
                    total: data.result.total,
                    actualGroup: data.result.group,
                    pattern3step: pattern3step,
                    protectionType: data.prediction.activeModel || data.prediction.protectionType || '--',
                    predictedGroup: predictedGroup,
                    isCorrect: data.prediction.isCorrect || false,
                    timestamp: new Date(),
                    isPending: false,
                    continueValue: data.prediction.dynamicContinueValue || data.prediction.continueValue,
                    switchValue: data.prediction.dynamicSwitchValue || data.prediction.switchValue,
                    continueModelPrediction: data.prediction.continueModelPrediction,
                    switchModelPrediction: data.prediction.switchModelPrediction,
                    continuePrediction: data.prediction.continueModelPrediction,
                    switchPrediction: data.prediction.switchModelPrediction
                };
                this.predictionHistory.unshift(newPrediction);
                if (this.predictionHistory.length > 1000) this.predictionHistory.pop();
                console.log(`✅ Added valid prediction to history: ${predictedGroup}`);
            }
            this.renderHistoryTable();
        }
        
        if (data.history) {
            this.predictionHistory = data.history;
            this.renderHistoryTable();
        }
        
        if (data.prediction) {
            this.currentPrediction = data.prediction;
            this.displayPrediction(data.prediction);
        }
        
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
    
    displayPrediction(prediction) {
        if (!prediction || prediction.waitingForData || prediction.status === 'WAITING') {
            this.showWaitingState();
            return;
        }
        
        this.currentPrediction = prediction;
        
        const patternNameEl = document.getElementById('patternName');
        const protectionTypeEl = document.getElementById('protectionType');
        const predictionGroupEl = document.getElementById('predictionGroup');
        const predictionConfidenceEl = document.getElementById('predictionConfidence');
        const finalName = document.getElementById('finalName');
        const finalConfidence = document.getElementById('finalConfidence');
        const finalExplanation = document.getElementById('finalExplanation');
        const confidenceFill = document.getElementById('confidenceFill');
        const finalWeights = document.getElementById('finalWeights');
        const activeModelDisplay = document.getElementById('activeModelDisplay');
        
        const pattern3step = prediction.pattern3step || prediction.pattern || '--';
        const activeModel = prediction.activeModel || prediction.protectionType || '--';
        const predictedGroup = prediction.predictedGroup || '--';
        const confidence = prediction.confidence || 50;
        
        const continueModelPrediction = prediction.continueModelPrediction || prediction.continueGroup || '--';
        const switchModelPrediction = prediction.switchModelPrediction || prediction.switchGroup || '--';
        const continueValue = prediction.dynamicContinueValue || prediction.continueValue || continueModelPrediction;
        const switchValue = prediction.dynamicSwitchValue || prediction.switchValue || switchModelPrediction;
        const isPredictionModeActive = prediction.isPredictionModeActive || false;
        
        if (patternNameEl) patternNameEl.innerHTML = `<span class="pattern-highlight">${pattern3step}</span>`;
        if (protectionTypeEl) {
            const protectionClass = activeModel === 'CONTINUE' ? 'protection-continue' : 'protection-switch';
            protectionTypeEl.innerHTML = `<span class="${protectionClass}">${activeModel}</span>`;
        }
        if (predictionGroupEl) predictionGroupEl.innerHTML = `${this.getGroupIcon(predictedGroup)} ${predictedGroup}`;
        if (predictionConfidenceEl) predictionConfidenceEl.textContent = `${confidence}%`;
        if (activeModelDisplay) activeModelDisplay.textContent = activeModel;
        
        if (finalName) finalName.textContent = predictedGroup;
        if (confidenceFill) confidenceFill.style.width = `${confidence}%`;
        if (finalConfidence) finalConfidence.textContent = `${confidence}%`;
        
        if (finalExplanation) {
            if (isPredictionModeActive) {
                finalExplanation.innerHTML = `
                    <strong>🎯 INDEPENDENT DUAL MODEL ACTIVE</strong><br>
                    Pattern: <strong>${pattern3step}</strong><br><br>
                    🔵 CONTINUE: <strong style="color:#4ade80;">${continueModelPrediction}</strong><br>
                    🟡 SWITCH: <strong style="color:#fbbf24;">${switchModelPrediction}</strong><br><br>
                    🎯 FINAL: <strong>${predictedGroup}</strong> (${activeModel} Model)<br>
                    <span style="font-size:11px;">✨ Models are INDEPENDENT - they don't affect each other</span>
                `;
            } else {
                finalExplanation.innerHTML = `Pattern <strong>${pattern3step}</strong> detected. Using <strong>${activeModel}</strong> model: predicting <strong>${predictedGroup}</strong> with ${confidence}% confidence.`;
            }
        }
        
        if (finalWeights) {
            finalWeights.innerHTML = `
                <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; margin-top: 5px;">
                    <div style="display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap;">
                        <div style="text-align: center; flex: 1;">
                            <span style="color:#4ade80;">🔵 CONTINUE</span><br>
                            <strong style="font-size: 18px; color:#4ade80;">${continueValue || '--'}</strong>
                        </div>
                        <div style="text-align: center; flex: 1;">
                            <span style="color:#fbbf24;">🟡 SWITCH</span><br>
                            <strong style="font-size: 18px; color:#fbbf24;">${switchValue || '--'}</strong>
                        </div>
                    </div>
                </div>
            `;
        }
        
        if (prediction.subPatternDetected) {
            this.handleSubPatternAlert({
                subPattern: prediction.subPatternDetected,
                currentPattern: pattern3step,
                timestamp: new Date().toISOString()
            });
        }
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
        const finalWeights = document.getElementById('finalWeights');
        const activeModelDisplay = document.getElementById('activeModelDisplay');
        
        if (patternNameEl) patternNameEl.innerHTML = '<span class="waiting-text">⏳ Waiting for 3 results...</span>';
        if (protectionTypeEl) protectionTypeEl.innerHTML = '<span class="waiting-text">--</span>';
        if (predictionGroupEl) predictionGroupEl.innerHTML = '<span class="waiting-text">WAITING</span>';
        if (predictionConfidenceEl) predictionConfidenceEl.textContent = '0%';
        if (activeModelDisplay) activeModelDisplay.textContent = 'WAIT';
        if (finalName) finalName.textContent = 'WAITING';
        if (finalConfidence) finalConfidence.textContent = '0%';
        if (confidenceFill) confidenceFill.style.width = '0%';
        if (finalExplanation) {
            const needed = 3 - (this.allResults?.length || 0);
            finalExplanation.innerHTML = `⏳ Pattern recognition requires 3 results. Currently have ${this.allResults?.length || 0} results. ${needed > 0 ? `Need ${needed} more result(s).` : 'Analyzing pattern...'}`;
        }
        if (finalWeights) finalWeights.innerHTML = '';
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
    
    // NEW: Render history table with CONTINUE, SWITCH, FINAL columns
    renderHistoryTable() {
        const tbody = document.getElementById('historyBody');
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
            const actualGroup = item.actualGroup;
            const hasActual = actualGroup && actualGroup !== '?';
            
            // CONTINUE prediction
            const continuePred = item.continuePrediction || item.continueModelPrediction || item.continueValue || '--';
            const continueCorrect = (continuePred === actualGroup && hasActual);
            const continueDisplay = `${continuePred} ${continueCorrect ? '✓' : (hasActual ? '✗' : '')}`;
            const continueClass = continueCorrect ? 'pred-correct' : (hasActual ? 'pred-wrong' : 'pred-pending');
            
            // SWITCH prediction
            const switchPred = item.switchPrediction || item.switchModelPrediction || item.switchValue || '--';
            const switchCorrect = (switchPred === actualGroup && hasActual);
            const switchDisplay = `${switchPred} ${switchCorrect ? '✓' : (hasActual ? '✗' : '')}`;
            const switchClass = switchCorrect ? 'pred-correct' : (hasActual ? 'pred-wrong' : 'pred-pending');
            
            // FINAL prediction
            const finalPred = item.predictedGroup || '--';
            const finalCorrect = item.isCorrect === true;
            const finalDisplay = `${finalPred} ${finalCorrect ? '✓' : (hasActual ? '✗' : '⏳')}`;
            const finalClass = finalCorrect ? 'pred-correct' : (hasActual ? 'pred-wrong' : 'pred-pending');
            
            return `
                <tr>
                    <td style="font-size: 10px;">${item.time || '--'}</td>
                    <td style="font-size: 10px;">🎲 ${item.dice || '--'}</td>
                    <td><strong>${item.total || '--'}</strong><br><small>${hasActual ? actualGroup : 'pending'}</small></td>
                    <td><span class="pattern-badge" style="background:rgba(139,92,246,0.2);padding:4px 8px;border-radius:12px;font-size:9px;">${item.pattern3step || '--'}</span></td>
                    <td class="prediction-cell ${continueClass}">${continueDisplay}</td>
                    <td class="prediction-cell ${switchClass}">${switchDisplay}</td>
                    <td class="prediction-cell ${finalClass}">${finalDisplay}</td>
                </tr>
            `;
        }).join('');
        
        this.updatePaginationControls();
    }
    
    updatePaginationControls() {
        const totalPages = Math.max(1, Math.ceil(this.predictionHistory.length / this.itemsPerPage));
        const pageInfo = document.getElementById('pageInfo');
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        
        if (pageInfo) pageInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
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
                <div class="result-box ${isLightning ? 'lightning' : ''}">
                    <div>${groupIcon} ${result.total}</div>
                    <div style="font-size:9px;">${result.multiplier || 1}x</div>
                    <div style="font-size:8px;">${time}</div>
                </div>
            `;
        }).join('');
    }
    
    updateStatisticsTable() {
        const tbody = document.getElementById('statsBody');
        if (!tbody) return;
        
        if (!this.allResults || this.allResults.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">No data available yet...</td></tr>';
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
            const lowPercent = document.getElementById('lowPercent');
            const mediumPercent = document.getElementById('mediumPercent');
            const highPercent = document.getElementById('highPercent');
            if (lowPercent) lowPercent.textContent = '0%';
            if (mediumPercent) mediumPercent.textContent = '0%';
            if (highPercent) highPercent.textContent = '0%';
            return;
        }
        
        const recentResults = this.allResults.slice(0, 10);
        const recentCount = { LOW: 0, MEDIUM: 0, HIGH: 0 };
        recentResults.forEach(r => { if (r && r.group) recentCount[r.group]++; });
        
        const total = recentResults.length || 1;
        const lowPercent = document.getElementById('lowPercent');
        const mediumPercent = document.getElementById('mediumPercent');
        const highPercent = document.getElementById('highPercent');
        const lowTrend = document.getElementById('lowTrend');
        const mediumTrend = document.getElementById('mediumTrend');
        const highTrend = document.getElementById('highTrend');
        
        if (lowPercent) lowPercent.textContent = `${Math.round((recentCount.LOW / total) * 100)}%`;
        if (mediumPercent) mediumPercent.textContent = `${Math.round((recentCount.MEDIUM / total) * 100)}%`;
        if (highPercent) highPercent.textContent = `${Math.round((recentCount.HIGH / total) * 100)}%`;
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
        
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
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
        const predictionCard = document.querySelector('.prediction-card');
        if (predictionCard) {
            predictionCard.style.animation = 'none';
            setTimeout(() => predictionCard.style.animation = 'slideIn 0.3s ease', 10);
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
