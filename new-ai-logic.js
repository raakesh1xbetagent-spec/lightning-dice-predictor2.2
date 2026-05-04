// ============================================================
// new-ai-logic.js (v11.2 - Independent Dual Model with Selector + Sub-Pattern Detection)
// 
// 6 Patterns for 3-Step Detection (ONLY for pattern detection trigger):
// 1. LOW → HIGH → MEDIUM
// 2. HIGH → LOW → MEDIUM
// 3. MEDIUM → LOW → HIGH
// 4. MEDIUM → HIGH → LOW
// 5. LOW → MEDIUM → HIGH
// 6. HIGH → MEDIUM → LOW
//
// NEW v11.2 FEATURES:
// - MODELS ARE INDEPENDENT: One model's success/failure does NOT affect the other
// - Both models always stay active until they individually get correct
// - Sub-Pattern Detection while in prediction mode
// - Sub-Pattern Alert callbacks for Telegram & Web
// - CONTINUE Model: Always predicts LAST result (dynamic update on wrong)
// - SWITCH Model: Always predicts PREVIOUS result (dynamic update on wrong)
// - Selector Model: Learns which model works best for each pattern
// - User can choose: CONTINUE only, SWITCH only, or AUTO (selector decides)
// ============================================================

class ContinueModel {
    constructor() {
        this.name = "CONTINUE";
        this.dynamicRecentData = null;
        this.dynamicPreviousData = null;
        this.isActive = false;
        this.consecutiveWrongCount = 0;
        this.totalPredictions = 0;
        this.correctPredictions = 0;
        this.accuracy = 0;
    }
    
    initialize(patternData) {
        this.dynamicRecentData = patternData.recentData;
        this.dynamicPreviousData = patternData.previousData;
        this.isActive = true;
        this.consecutiveWrongCount = 0;
        console.log(`   🔵 CONTINUE Model initialized: LAST = ${this.dynamicRecentData}`);
    }
    
    predict() {
        return {
            predictedGroup: this.dynamicRecentData,
            confidence: 75,
            description: `CONTINUE: Last result (${this.dynamicRecentData})`
        };
    }
    
    updateWithResult(actualGroup) {
        this.totalPredictions++;
        const isCorrect = (this.dynamicRecentData === actualGroup);
        if (isCorrect) {
            this.correctPredictions++;
            this.isActive = false;
            console.log(`   🔵 CONTINUE Model: CORRECT! Deactivating THIS model only.`);
        } else {
            this.consecutiveWrongCount++;
            this.dynamicPreviousData = this.dynamicRecentData;
            this.dynamicRecentData = actualGroup;
            console.log(`   🔵 CONTINUE Model: WRONG! Updated LAST = ${this.dynamicRecentData}`);
        }
        this.accuracy = (this.correctPredictions / this.totalPredictions) * 100;
        return { isCorrect, newValue: this.dynamicRecentData, keepActive: !isCorrect };
    }
    
    reset() {
        this.isActive = false;
        this.consecutiveWrongCount = 0;
        this.dynamicRecentData = null;
        this.dynamicPreviousData = null;
    }
    
    getStatus() {
        return {
            name: this.name,
            isActive: this.isActive,
            currentValue: this.dynamicRecentData,
            previousValue: this.dynamicPreviousData,
            wrongCount: this.consecutiveWrongCount,
            accuracy: this.accuracy,
            totalPredictions: this.totalPredictions,
            correctPredictions: this.correctPredictions
        };
    }
}

class SwitchModel {
    constructor() {
        this.name = "SWITCH";
        this.dynamicRecentData = null;
        this.dynamicPreviousData = null;
        this.isActive = false;
        this.consecutiveWrongCount = 0;
        this.totalPredictions = 0;
        this.correctPredictions = 0;
        this.accuracy = 0;
    }
    
    initialize(patternData) {
        this.dynamicRecentData = patternData.recentData;
        this.dynamicPreviousData = patternData.previousData;
        this.isActive = true;
        this.consecutiveWrongCount = 0;
        console.log(`   🟡 SWITCH Model initialized: PREVIOUS = ${this.dynamicPreviousData}`);
    }
    
    predict() {
        return {
            predictedGroup: this.dynamicPreviousData,
            confidence: 75,
            description: `SWITCH: Previous result (${this.dynamicPreviousData})`
        };
    }
    
    updateWithResult(actualGroup) {
        this.totalPredictions++;
        const isCorrect = (this.dynamicPreviousData === actualGroup);
        if (isCorrect) {
            this.correctPredictions++;
            this.isActive = false;
            console.log(`   🟡 SWITCH Model: CORRECT! Deactivating THIS model only.`);
        } else {
            this.consecutiveWrongCount++;
            this.dynamicPreviousData = this.dynamicRecentData;
            this.dynamicRecentData = actualGroup;
            console.log(`   🟡 SWITCH Model: WRONG! Updated PREVIOUS = ${this.dynamicPreviousData}`);
        }
        this.accuracy = (this.correctPredictions / this.totalPredictions) * 100;
        return { isCorrect, newValue: this.dynamicPreviousData, keepActive: !isCorrect };
    }
    
    reset() {
        this.isActive = false;
        this.consecutiveWrongCount = 0;
        this.dynamicRecentData = null;
        this.dynamicPreviousData = null;
    }
    
    getStatus() {
        return {
            name: this.name,
            isActive: this.isActive,
            currentValue: this.dynamicPreviousData,
            recentValue: this.dynamicRecentData,
            wrongCount: this.consecutiveWrongCount,
            accuracy: this.accuracy,
            totalPredictions: this.totalPredictions,
            correctPredictions: this.correctPredictions
        };
    }
}

class SelectorModel {
    constructor() {
        this.name = "SELECTOR";
        this.patternStats = {};
        this.userPreference = "AUTO";
    }
    
    setUserPreference(preference) {
        if (preference === "AUTO" || preference === "CONTINUE" || preference === "SWITCH") {
            this.userPreference = preference;
            console.log(`🎯 Selector: User preference set to ${preference}`);
            return true;
        }
        return false;
    }
    
    getUserPreference() {
        return this.userPreference;
    }
    
    initializePattern(patternString) {
        if (!this.patternStats[patternString]) {
            this.patternStats[patternString] = {
                continueCorrect: 0,
                continueTotal: 0,
                switchCorrect: 0,
                switchTotal: 0,
                continueAccuracy: 0,
                switchAccuracy: 0,
                lastUsed: null,
                occurrences: 0
            };
        }
    }
    
    recordResult(patternString, modelUsed, isCorrect) {
        this.initializePattern(patternString);
        const stats = this.patternStats[patternString];
        
        if (modelUsed === "CONTINUE") {
            stats.continueTotal++;
            if (isCorrect) stats.continueCorrect++;
            stats.continueAccuracy = (stats.continueCorrect / stats.continueTotal) * 100;
        } else if (modelUsed === "SWITCH") {
            stats.switchTotal++;
            if (isCorrect) stats.switchCorrect++;
            stats.switchAccuracy = (stats.switchCorrect / stats.switchTotal) * 100;
        }
        stats.occurrences++;
        stats.lastUsed = new Date().toISOString();
        
        console.log(`   📊 Selector updated: ${patternString} - CONTINUE: ${stats.continueAccuracy.toFixed(1)}% | SWITCH: ${stats.switchAccuracy.toFixed(1)}%`);
    }
    
    decide(patternString) {
        if (this.userPreference === "CONTINUE") {
            return { decision: "CONTINUE", reason: "User selected CONTINUE only", method: "user_preference" };
        }
        if (this.userPreference === "SWITCH") {
            return { decision: "SWITCH", reason: "User selected SWITCH only", method: "user_preference" };
        }
        
        this.initializePattern(patternString);
        const stats = this.patternStats[patternString];
        
        if (stats.continueTotal < 3 && stats.switchTotal < 3) {
            console.log(`   🤖 Selector: Not enough data for ${patternString}, using CONTINUE as default`);
            return { decision: "CONTINUE", reason: "Not enough data yet", method: "default" };
        }
        
        if (stats.continueAccuracy > stats.switchAccuracy) {
            return { decision: "CONTINUE", reason: `Better accuracy: ${stats.continueAccuracy.toFixed(1)}% vs ${stats.switchAccuracy.toFixed(1)}%`, method: "historical" };
        } else if (stats.switchAccuracy > stats.continueAccuracy) {
            return { decision: "SWITCH", reason: `Better accuracy: ${stats.switchAccuracy.toFixed(1)}% vs ${stats.continueAccuracy.toFixed(1)}%`, method: "historical" };
        } else {
            if (stats.continueTotal >= stats.switchTotal) {
                return { decision: "CONTINUE", reason: "Equal accuracy, CONTINUE has more data", method: "tiebreaker" };
            } else {
                return { decision: "SWITCH", reason: "Equal accuracy, SWITCH has more data", method: "tiebreaker" };
            }
        }
    }
    
    getPatternStats(patternString) {
        if (!this.patternStats[patternString]) {
            return {
                continueAccuracy: 0,
                switchAccuracy: 0,
                continueCorrect: 0,
                continueTotal: 0,
                switchCorrect: 0,
                switchTotal: 0,
                occurrences: 0
            };
        }
        return this.patternStats[patternString];
    }
    
    getAllStats() {
        return this.patternStats;
    }
    
    reset() {
        this.patternStats = {};
        console.log(`🎯 Selector: All pattern statistics reset`);
    }
}

class NewPatternAI {
    constructor() {
        this.version = "11.2";
        this.name = "Independent Dual Model 3-Step Pattern AI with Selector & Sub-Pattern Detection";
        
        this.patterns = [
            "LOW→HIGH→MEDIUM",
            "HIGH→LOW→MEDIUM",
            "MEDIUM→LOW→HIGH",
            "MEDIUM→HIGH→LOW",
            "LOW→MEDIUM→HIGH",
            "HIGH→MEDIUM→LOW"
        ];
        
        this.patternMapping = {
            "LOW→HIGH→MEDIUM": {
                continueGroup: "MEDIUM",
                switchGroup: "HIGH",
                description: "LOW থেকে HIGH হয়ে MEDIUM এ এসেছে",
                recentData: "MEDIUM",
                previousData: "HIGH"
            },
            "HIGH→LOW→MEDIUM": {
                continueGroup: "MEDIUM",
                switchGroup: "LOW",
                description: "HIGH থেকে LOW হয়ে MEDIUM এ এসেছে",
                recentData: "MEDIUM",
                previousData: "LOW"
            },
            "MEDIUM→LOW→HIGH": {
                continueGroup: "HIGH",
                switchGroup: "LOW",
                description: "MEDIUM থেকে LOW হয়ে HIGH এ এসেছে",
                recentData: "HIGH",
                previousData: "LOW"
            },
            "MEDIUM→HIGH→LOW": {
                continueGroup: "LOW",
                switchGroup: "HIGH",
                description: "MEDIUM থেকে HIGH হয়ে LOW এ এসেছে",
                recentData: "LOW",
                previousData: "HIGH"
            },
            "LOW→MEDIUM→HIGH": {
                continueGroup: "HIGH",
                switchGroup: "MEDIUM",
                description: "LOW থেকে MEDIUM হয়ে HIGH এ এসেছে",
                recentData: "HIGH",
                previousData: "MEDIUM"
            },
            "HIGH→MEDIUM→LOW": {
                continueGroup: "LOW",
                switchGroup: "MEDIUM",
                description: "HIGH থেকে MEDIUM হয়ে LOW এ এসেছে",
                recentData: "LOW",
                previousData: "MEDIUM"
            }
        };
        
        this.continueModel = new ContinueModel();
        this.switchModel = new SwitchModel();
        this.selector = new SelectorModel();
        
        this.activeModel = null;
        this.currentPattern = null;
        
        // NEW v11.2: Store both model predictions separately
        this.currentContinuePrediction = null;
        this.currentSwitchPrediction = null;
        
        // Sub-pattern tracking
        this.subPatternDetected = null;
        this.last3ResultsHistory = [];
        this.subPatternCallback = null;
        
        this.patternHistory = [];
        this.totalPredictions = 0;
        this.correctPredictions = 0;
        this.accuracy = 0;
        
        this.patternOccurrences = {};
        
        for (const pattern of this.patterns) {
            this.patternOccurrences[pattern] = {
                count: 0,
                lastSeen: null,
                continueCount: 0,
                switchCount: 0,
                continueCorrect: 0,
                switchCorrect: 0,
                continueAccuracy: 0,
                switchAccuracy: 0
            };
        }
        
        console.log(`🤖 ${this.name} initialized with ${this.patterns.length} patterns`);
        console.log(`📋 INDEPENDENT DUAL MODEL SYSTEM (v11.2):`);
        console.log(`   🔵 CONTINUE Model: Always predicts LAST result (INDEPENDENT)`);
        console.log(`   🟡 SWITCH Model: Always predicts PREVIOUS result (INDEPENDENT)`);
        console.log(`   ✨ Models do NOT affect each other!`);
        console.log(`   🎯 Selector Model: Learns which model works best per pattern`);
        console.log(`   🔍 Sub-Pattern Detection: Detects patterns while in prediction mode`);
        console.log(`   👤 User can choose: CONTINUE only, SWITCH only, or AUTO (selector decides)`);
    }
    
    /**
     * Set callback for sub-pattern detection
     */
    setSubPatternCallback(callback) {
        this.subPatternCallback = callback;
        console.log(`🔍 Sub-pattern callback registered`);
    }
    
    /**
     * Check for sub-patterns while in prediction mode
     */
    checkForSubPattern(last3Results) {
        if (!last3Results || last3Results.length !== 3) {
            return null;
        }
        
        const patternString = this.getPatternString(last3Results);
        
        if (this.isPatternMatch(patternString)) {
            const isDifferentPattern = (this.currentPattern !== patternString);
            const isNewDetection = (this.subPatternDetected !== patternString);
            
            if (isDifferentPattern && isNewDetection) {
                this.subPatternDetected = patternString;
                
                const patternInfo = this.patternMapping[patternString];
                
                console.log(`🔍 SUB-PATTERN DETECTED!`);
                console.log(`   Current Active Pattern: ${this.currentPattern}`);
                console.log(`   New Sub-Pattern: ${patternString}`);
                
                if (this.subPatternCallback) {
                    this.subPatternCallback({
                        type: 'SUB_PATTERN_DETECTED',
                        currentPattern: this.currentPattern,
                        subPattern: patternString,
                        description: patternInfo?.description || 'Valid 3-step pattern',
                        timestamp: new Date().toISOString(),
                        continueModelValue: this.continueModel.dynamicRecentData,
                        switchModelValue: this.switchModel.dynamicPreviousData,
                        activeModel: this.activeModel
                    });
                }
                
                return {
                    detected: true,
                    currentPattern: this.currentPattern,
                    subPattern: patternString,
                    description: patternInfo?.description
                };
            }
        }
        
        return { detected: false };
    }
    
    getLastResults(count) {
        const results = [];
        for (let i = 0; i < this.patternHistory.length && results.length < count; i++) {
            if (this.patternHistory[i].actualGroup) {
                results.unshift(this.patternHistory[i].actualGroup);
            }
        }
        return results;
    }
    
    setUserPreference(preference) {
        return this.selector.setUserPreference(preference);
    }
    
    getUserPreference() {
        return this.selector.getUserPreference();
    }
    
    getPatternString(last3Results) {
        if (!last3Results || last3Results.length !== 3) {
            return null;
        }
        return `${last3Results[0]}→${last3Results[1]}→${last3Results[2]}`;
    }
    
    getPatternData(patternString) {
        const parts = patternString.split('→');
        if (parts.length !== 3) return null;
        return {
            first: parts[0],
            second: parts[1],
            third: parts[2],
            recentData: parts[2],
            previousData: parts[1]
        };
    }
    
    isPatternMatch(patternString) {
        return this.patterns.includes(patternString);
    }
    
    resetActivePattern() {
        console.log(`🔄 Resetting models. Going back to WAIT mode.`);
        this.continueModel.reset();
        this.switchModel.reset();
        this.activeModel = null;
        this.currentPattern = null;
        this.subPatternDetected = null;
        this.currentContinuePrediction = null;
        this.currentSwitchPrediction = null;
    }
    
    getModelsStatus() {
        return {
            continue: this.continueModel.getStatus(),
            switch: this.switchModel.getStatus(),
            activeModel: this.activeModel,
            currentPattern: this.currentPattern,
            userPreference: this.selector.getUserPreference(),
            subPatternDetected: this.subPatternDetected
        };
    }
    
    predict(last3Results, protectionType = null) {
        // Check for sub-patterns when in prediction mode
        if (this.activeModel && (this.continueModel.isActive || this.switchModel.isActive)) {
            if (last3Results && last3Results.length === 3) {
                this.checkForSubPattern(last3Results);
            }
        }
        
        // CASE 1: Active model exists - we are in prediction mode
        if (this.activeModel && (this.continueModel.isActive || this.switchModel.isActive)) {
            const isContinueActive = (this.activeModel === "CONTINUE" && this.continueModel.isActive);
            const isSwitchActive = (this.activeModel === "SWITCH" && this.switchModel.isActive);
            
            if (isContinueActive || isSwitchActive) {
                const activeModelInst = this.activeModel === "CONTINUE" ? this.continueModel : this.switchModel;
                const prediction = activeModelInst.predict();
                
                // Store both model predictions for display
                this.currentContinuePrediction = this.continueModel.isActive ? this.continueModel.predict().predictedGroup : this.continueModel.dynamicRecentData;
                this.currentSwitchPrediction = this.switchModel.isActive ? this.switchModel.predict().predictedGroup : this.switchModel.dynamicPreviousData;
                
                console.log(`🔄 Active prediction mode with ${this.activeModel} Model`);
                console.log(`   🔵 CONTINUE predicts: ${this.currentContinuePrediction}`);
                console.log(`   🟡 SWITCH predicts: ${this.currentSwitchPrediction}`);
                
                let confidence = 70;
                const stats = this.selector.getPatternStats(this.currentPattern);
                if (this.activeModel === "CONTINUE") {
                    confidence = Math.min(92, Math.max(45, (confidence + stats.continueAccuracy) / 2));
                } else {
                    confidence = Math.min(92, Math.max(45, (confidence + stats.switchAccuracy) / 2));
                }
                
                this.recordPrediction({
                    pattern: this.currentPattern,
                    protectionType: this.activeModel,
                    predictedGroup: prediction.predictedGroup,
                    timestamp: new Date().toISOString(),
                    confidence: confidence,
                    actualGroup: null,
                    isRetry: activeModelInst.consecutiveWrongCount > 0,
                    retryNumber: activeModelInst.consecutiveWrongCount,
                    continueValue: this.continueModel.dynamicRecentData,
                    switchValue: this.switchModel.dynamicPreviousData,
                    continuePrediction: this.currentContinuePrediction,
                    switchPrediction: this.currentSwitchPrediction
                });
                
                return {
                    status: "PREDICTION_READY",
                    pattern: this.currentPattern,
                    protectionType: this.activeModel,
                    predictedGroup: prediction.predictedGroup,
                    confidence: Math.round(confidence),
                    continueValue: this.continueModel.dynamicRecentData,
                    switchValue: this.switchModel.dynamicPreviousData,
                    continueModelPrediction: this.currentContinuePrediction,
                    switchModelPrediction: this.currentSwitchPrediction,
                    description: prediction.description,
                    waitingForData: false,
                    isRetry: activeModelInst.consecutiveWrongCount > 0,
                    retryCount: activeModelInst.consecutiveWrongCount,
                    activeModel: this.activeModel,
                    userPreference: this.selector.getUserPreference(),
                    message: `${this.activeModel} Model active${activeModelInst.consecutiveWrongCount > 0 ? ` (Retry #${activeModelInst.consecutiveWrongCount})` : ''}`,
                    last3Results: last3Results,
                    subPatternDetected: this.subPatternDetected
                };
            }
        }
        
        // CASE 2: Need to check for new pattern (WAIT mode)
        if (!last3Results || last3Results.length !== 3) {
            console.log(`⚠️ Cannot detect pattern: need exactly 3 results, got ${last3Results?.length || 0}`);
            return {
                status: "WAITING",
                pattern: null,
                protectionType: null,
                predictedGroup: null,
                confidence: 0,
                message: `Waiting for 3 results. Currently have ${last3Results?.length || 0}`,
                waitingForData: true
            };
        }
        
        const patternString = this.getPatternString(last3Results);
        console.log(`🔍 Checking pattern: ${patternString}`);
        
        // CASE 3: Pattern does NOT match - stay in WAIT mode
        if (!this.isPatternMatch(patternString)) {
            console.log(`❌ Pattern does NOT match any of the 6 patterns. Staying in WAIT mode.`);
            return {
                status: "WAITING",
                pattern: patternString,
                protectionType: null,
                predictedGroup: null,
                confidence: 0,
                message: `Pattern "${patternString}" does not match any known pattern. Waiting for pattern to form.`,
                waitingForData: true,
                matchedPatterns: this.patterns
            };
        }
        
        // CASE 4: Pattern matched! START prediction mode with selected model
        console.log(`✅ Pattern MATCHED! Starting prediction mode.`);
        
        const patternData = this.getPatternData(patternString);
        this.currentPattern = patternString;
        this.subPatternDetected = null;
        
        this.continueModel.initialize(patternData);
        this.switchModel.initialize(patternData);
        
        let selectedModel = protectionType;
        let decisionInfo = null;
        
        if (!selectedModel) {
            const decision = this.selector.decide(patternString);
            selectedModel = decision.decision;
            decisionInfo = decision;
            console.log(`   🤖 Selector decided: ${selectedModel} - ${decision.reason}`);
        } else {
            console.log(`   👤 Manual selection: ${selectedModel}`);
        }
        
        this.activeModel = selectedModel;
        
        // Store both model predictions
        this.currentContinuePrediction = this.continueModel.predict().predictedGroup;
        this.currentSwitchPrediction = this.switchModel.predict().predictedGroup;
        
        const activeModelInst = this.activeModel === "CONTINUE" ? this.continueModel : this.switchModel;
        const prediction = activeModelInst.predict();
        
        let confidence = 70;
        const stats = this.selector.getPatternStats(patternString);
        if (this.activeModel === "CONTINUE") {
            confidence = Math.min(92, Math.max(45, (confidence + stats.continueAccuracy) / 2));
        } else {
            confidence = Math.min(92, Math.max(45, (confidence + stats.switchAccuracy) / 2));
        }
        
        this.recordPrediction({
            pattern: patternString,
            protectionType: selectedModel,
            predictedGroup: prediction.predictedGroup,
            timestamp: new Date().toISOString(),
            confidence: Math.round(confidence),
            actualGroup: null,
            isRetry: false,
            retryNumber: 0,
            continueValue: this.continueModel.dynamicRecentData,
            switchValue: this.switchModel.dynamicPreviousData,
            continuePrediction: this.currentContinuePrediction,
            switchPrediction: this.currentSwitchPrediction
        });
        
        console.log(`🎯 PREDICTION MODE ACTIVATED with ${selectedModel} Model`);
        console.log(`   Pattern: ${patternString}`);
        console.log(`   🔵 CONTINUE predicts: ${this.currentContinuePrediction}`);
        console.log(`   🟡 SWITCH predicts: ${this.currentSwitchPrediction}`);
        console.log(`   🎯 FINAL prediction (${selectedModel}): ${prediction.predictedGroup} (${Math.round(confidence)}% confidence)`);
        
        return {
            status: "PREDICTION_READY",
            pattern: patternString,
            protectionType: selectedModel,
            predictedGroup: prediction.predictedGroup,
            confidence: Math.round(confidence),
            continueValue: this.continueModel.dynamicRecentData,
            switchValue: this.switchModel.dynamicPreviousData,
            continueModelPrediction: this.currentContinuePrediction,
            switchModelPrediction: this.currentSwitchPrediction,
            description: prediction.description,
            decisionInfo: decisionInfo,
            waitingForData: false,
            isActive: true,
            activeModel: this.activeModel,
            userPreference: this.selector.getUserPreference(),
            message: `Pattern matched! Using ${selectedModel} Model. Models are INDEPENDENT.`,
            last3Results: last3Results,
            subPatternDetected: null
        };
    }
    
    updateWithResult(actualGroup) {
        const pendingIndex = this.patternHistory.findIndex(p => p.actualGroup === null);
        
        if (pendingIndex === -1) {
            console.log(`⚠️ No pending prediction to update`);
            return {
                isCorrect: false,
                message: "No pending prediction found"
            };
        }
        
        const prediction = this.patternHistory[pendingIndex];
        prediction.actualGroup = actualGroup;
        prediction.isCorrect = (prediction.predictedGroup === actualGroup);
        
        this.totalPredictions++;
        if (prediction.isCorrect) {
            this.correctPredictions++;
        }
        this.accuracy = (this.correctPredictions / this.totalPredictions) * 100;
        
        const occurrence = this.patternOccurrences[prediction.pattern];
        if (occurrence) {
            occurrence.count++;
            occurrence.lastSeen = new Date().toISOString();
            
            if (prediction.protectionType === "CONTINUE") {
                occurrence.continueCount++;
                if (prediction.isCorrect) {
                    occurrence.continueCorrect++;
                }
                occurrence.continueAccuracy = (occurrence.continueCorrect / occurrence.continueCount) * 100;
            } else if (prediction.protectionType === "SWITCH") {
                occurrence.switchCount++;
                if (prediction.isCorrect) {
                    occurrence.switchCorrect++;
                }
                occurrence.switchAccuracy = (occurrence.switchCorrect / occurrence.switchCount) * 100;
            }
        }
        
        this.selector.recordResult(prediction.pattern, prediction.protectionType, prediction.isCorrect);
        
        // ★★★ KEY CHANGE: Update BOTH models independently ★★★
        // Each model updates itself based on actual result
        // They do NOT affect each other's active status
        
        const continueResult = this.continueModel.updateWithResult(actualGroup);
        const switchResult = this.switchModel.updateWithResult(actualGroup);
        
        console.log(`📊 UPDATE RESULT:`);
        console.log(`   Pattern: ${prediction.pattern}`);
        console.log(`   🔵 CONTINUE: ${continueResult.isCorrect ? '✓ CORRECT' : '✗ WRONG'} - ${continueResult.keepActive ? 'KEEP ACTIVE' : 'DEACTIVATED'}`);
        console.log(`   🟡 SWITCH: ${switchResult.isCorrect ? '✓ CORRECT' : '✗ WRONG'} - ${switchResult.keepActive ? 'KEEP ACTIVE' : 'DEACTIVATED'}`);
        console.log(`   🎯 Active Model (for final): ${prediction.protectionType}`);
        console.log(`   Predicted: ${prediction.predictedGroup} → Actual: ${actualGroup}`);
        
        const selectorStats = this.selector.getPatternStats(prediction.pattern);
        console.log(`   Selector Stats - CONTINUE: ${selectorStats.continueAccuracy.toFixed(1)}% | SWITCH: ${selectorStats.switchAccuracy.toFixed(1)}%`);
        console.log(`   Overall Accuracy: ${this.accuracy.toFixed(1)}% (${this.correctPredictions}/${this.totalPredictions})`);
        
        // Update current predictions for next round
        this.currentContinuePrediction = this.continueModel.isActive ? this.continueModel.predict().predictedGroup : this.continueModel.dynamicRecentData;
        this.currentSwitchPrediction = this.switchModel.isActive ? this.switchModel.predict().predictedGroup : this.switchModel.dynamicPreviousData;
        
        // Check if both models are now inactive (both got correct)
        const bothInactive = (!this.continueModel.isActive && !this.switchModel.isActive);
        
        if (bothInactive) {
            console.log(`✅ BOTH models are correct! Resetting to WAIT mode.`);
            this.resetActivePattern();
            
            return {
                isCorrect: prediction.isCorrect,
                predictedGroup: prediction.predictedGroup,
                actualGroup: actualGroup,
                newAccuracy: this.accuracy,
                resetPattern: true,
                message: "Both models correct! Reset to WAIT mode.",
                modelUsed: prediction.protectionType,
                selectorStats: selectorStats,
                continueActive: this.continueModel.isActive,
                switchActive: this.switchModel.isActive,
                continueCorrect: continueResult.isCorrect,
                switchCorrect: switchResult.isCorrect
            };
        } else {
            console.log(`📊 Model status - CONTINUE: ${this.continueModel.isActive ? 'ACTIVE' : 'INACTIVE'}, SWITCH: ${this.switchModel.isActive ? 'ACTIVE' : 'INACTIVE'}`);
            
            return {
                isCorrect: prediction.isCorrect,
                predictedGroup: prediction.predictedGroup,
                actualGroup: actualGroup,
                newAccuracy: this.accuracy,
                keepPattern: true,
                modelUsed: prediction.protectionType,
                modelStillActive: true,
                newContinueValue: this.continueModel.dynamicRecentData,
                newSwitchValue: this.switchModel.dynamicPreviousData,
                selectorStats: selectorStats,
                continueActive: this.continueModel.isActive,
                switchActive: this.switchModel.isActive,
                continueCorrect: continueResult.isCorrect,
                switchCorrect: switchResult.isCorrect,
                continuePrediction: this.currentContinuePrediction,
                switchPrediction: this.currentSwitchPrediction,
                message: `${prediction.protectionType} prediction was ${prediction.isCorrect ? 'correct' : 'wrong'}. Models continue independently.`
            };
        }
    }
    
    updateWithNewResult(newResult) {
        if (this.activeModel && (this.continueModel.isActive || this.switchModel.isActive)) {
            console.log(`🔄 New result detected while in prediction mode: ${newResult}`);
            
            // Update both models independently
            this.continueModel.updateWithResult(newResult);
            this.switchModel.updateWithResult(newResult);
            
            this.currentContinuePrediction = this.continueModel.isActive ? this.continueModel.predict().predictedGroup : this.continueModel.dynamicRecentData;
            this.currentSwitchPrediction = this.switchModel.isActive ? this.switchModel.predict().predictedGroup : this.switchModel.dynamicPreviousData;
            
            return {
                updated: true,
                continueValue: this.continueModel.dynamicRecentData,
                switchValue: this.switchModel.dynamicPreviousData,
                activeModel: this.activeModel,
                continuePrediction: this.currentContinuePrediction,
                switchPrediction: this.currentSwitchPrediction,
                message: `Both models updated with new result: ${newResult}`
            };
        }
        return {
            updated: false,
            message: "Not in prediction mode, no update needed"
        };
    }
    
    isActive() {
        return (this.activeModel && (this.continueModel.isActive || this.switchModel.isActive));
    }
    
    getActivePatternInfo() {
        if (!this.isActive()) {
            return {
                isActive: false,
                message: "No active pattern. AI is in WAIT mode."
            };
        }
        
        return {
            isActive: true,
            pattern: this.currentPattern,
            activeModel: this.activeModel,
            continueValue: this.continueModel.dynamicRecentData,
            switchValue: this.switchModel.dynamicPreviousData,
            continueModelActive: this.continueModel.isActive,
            switchModelActive: this.switchModel.isActive,
            continueWrongCount: this.continueModel.consecutiveWrongCount,
            switchWrongCount: this.switchModel.consecutiveWrongCount,
            userPreference: this.selector.getUserPreference(),
            subPatternDetected: this.subPatternDetected,
            continuePrediction: this.currentContinuePrediction,
            switchPrediction: this.currentSwitchPrediction,
            message: `Active: ${this.currentPattern} | CONTINUE: ${this.continueModel.isActive ? 'ACTIVE' : 'INACTIVE'} | SWITCH: ${this.switchModel.isActive ? 'ACTIVE' : 'INACTIVE'}`
        };
    }
    
    recordPrediction(predictionData) {
        this.patternHistory.unshift({
            ...predictionData,
            id: Date.now()
        });
        
        if (this.patternHistory.length > 1000) {
            this.patternHistory.pop();
        }
    }
    
    getPatternStats() {
        const stats = {};
        
        for (const pattern of this.patterns) {
            const occ = this.patternOccurrences[pattern];
            const selectorStats = this.selector.getPatternStats(pattern);
            const mapping = this.patternMapping[pattern];
            stats[pattern] = {
                occurrences: occ.count,
                lastSeen: occ.lastSeen,
                continueAccuracy: Math.round(selectorStats.continueAccuracy),
                switchAccuracy: Math.round(selectorStats.switchAccuracy),
                continueStats: `${selectorStats.continueCorrect}/${selectorStats.continueTotal}`,
                switchStats: `${selectorStats.switchCorrect}/${selectorStats.switchTotal}`,
                recommendedProtection: selectorStats.continueAccuracy > selectorStats.switchAccuracy ? "CONTINUE" : (selectorStats.switchAccuracy > selectorStats.continueAccuracy ? "SWITCH" : "CONTINUE (default)"),
                recentData: mapping.recentData,
                previousData: mapping.previousData,
                description: mapping.description
            };
        }
        
        return stats;
    }
    
    getSelectorStats() {
        return this.selector.getAllStats();
    }
    
    getStats() {
        return {
            name: this.name,
            version: this.version,
            totalPredictions: this.totalPredictions,
            correctPredictions: this.correctPredictions,
            accuracy: this.accuracy,
            patternsCount: this.patterns.length,
            patternHistoryLength: this.patternHistory.length,
            isActive: this.isActive(),
            activePatternInfo: this.getActivePatternInfo(),
            patternStats: this.getPatternStats(),
            modelsStatus: this.getModelsStatus(),
            selectorStats: this.getSelectorStats(),
            userPreference: this.selector.getUserPreference()
        };
    }
    
    getAccuracy() {
        return this.accuracy;
    }
    
    getDynamicValues() {
        return {
            continueValue: this.continueModel.dynamicRecentData,
            switchValue: this.switchModel.dynamicPreviousData,
            isActive: this.isActive(),
            activeModel: this.activeModel,
            userPreference: this.selector.getUserPreference(),
            continueModelActive: this.continueModel.isActive,
            switchModelActive: this.switchModel.isActive,
            continueWrongCount: this.continueModel.consecutiveWrongCount,
            switchWrongCount: this.switchModel.consecutiveWrongCount,
            subPatternDetected: this.subPatternDetected,
            continuePrediction: this.currentContinuePrediction,
            switchPrediction: this.currentSwitchPrediction
        };
    }
    
    getBothPredictions() {
        return {
            continue: {
                value: this.currentContinuePrediction || this.continueModel.dynamicRecentData,
                active: this.continueModel.isActive,
                accuracy: this.continueModel.accuracy,
                originalValue: this.continueModel.dynamicRecentData
            },
            switch: {
                value: this.currentSwitchPrediction || this.switchModel.dynamicPreviousData,
                active: this.switchModel.isActive,
                accuracy: this.switchModel.accuracy,
                originalValue: this.switchModel.dynamicPreviousData
            }
        };
    }
    
    exportState() {
        return {
            version: this.version,
            totalPredictions: this.totalPredictions,
            correctPredictions: this.correctPredictions,
            accuracy: this.accuracy,
            patternOccurrences: this.patternOccurrences,
            patternHistory: this.patternHistory.slice(0, 100),
            selectorStats: this.selector.getAllStats(),
            userPreference: this.selector.getUserPreference(),
            currentPattern: this.currentPattern,
            activeModel: this.activeModel,
            subPatternDetected: this.subPatternDetected,
            continueModelState: {
                dynamicRecentData: this.continueModel.dynamicRecentData,
                dynamicPreviousData: this.continueModel.dynamicPreviousData,
                isActive: this.continueModel.isActive,
                consecutiveWrongCount: this.continueModel.consecutiveWrongCount,
                totalPredictions: this.continueModel.totalPredictions,
                correctPredictions: this.continueModel.correctPredictions,
                accuracy: this.continueModel.accuracy
            },
            switchModelState: {
                dynamicRecentData: this.switchModel.dynamicRecentData,
                dynamicPreviousData: this.switchModel.dynamicPreviousData,
                isActive: this.switchModel.isActive,
                consecutiveWrongCount: this.switchModel.consecutiveWrongCount,
                totalPredictions: this.switchModel.totalPredictions,
                correctPredictions: this.switchModel.correctPredictions,
                accuracy: this.switchModel.accuracy
            }
        };
    }
    
    loadState(state) {
        if (!state) return;
        
        this.version = state.version || this.version;
        this.totalPredictions = state.totalPredictions || 0;
        this.correctPredictions = state.correctPredictions || 0;
        this.accuracy = state.accuracy || 0;
        
        if (state.patternOccurrences) {
            this.patternOccurrences = state.patternOccurrences;
        }
        
        if (state.patternHistory) {
            this.patternHistory = state.patternHistory;
        }
        
        if (state.selectorStats) {
            this.selector.patternStats = state.selectorStats;
        }
        
        if (state.userPreference) {
            this.selector.setUserPreference(state.userPreference);
        }
        
        if (state.currentPattern) {
            this.currentPattern = state.currentPattern;
            this.activeModel = state.activeModel;
            this.subPatternDetected = state.subPatternDetected || null;
            
            if (state.continueModelState) {
                this.continueModel.dynamicRecentData = state.continueModelState.dynamicRecentData;
                this.continueModel.dynamicPreviousData = state.continueModelState.dynamicPreviousData;
                this.continueModel.isActive = state.continueModelState.isActive;
                this.continueModel.consecutiveWrongCount = state.continueModelState.consecutiveWrongCount;
                this.continueModel.totalPredictions = state.continueModelState.totalPredictions;
                this.continueModel.correctPredictions = state.continueModelState.correctPredictions;
                this.continueModel.accuracy = state.continueModelState.accuracy;
            }
            
            if (state.switchModelState) {
                this.switchModel.dynamicRecentData = state.switchModelState.dynamicRecentData;
                this.switchModel.dynamicPreviousData = state.switchModelState.dynamicPreviousData;
                this.switchModel.isActive = state.switchModelState.isActive;
                this.switchModel.consecutiveWrongCount = state.switchModelState.consecutiveWrongCount;
                this.switchModel.totalPredictions = state.switchModelState.totalPredictions;
                this.switchModel.correctPredictions = state.switchModelState.correctPredictions;
                this.switchModel.accuracy = state.switchModelState.accuracy;
            }
            
            this.currentContinuePrediction = this.continueModel.isActive ? this.continueModel.predict().predictedGroup : this.continueModel.dynamicRecentData;
            this.currentSwitchPrediction = this.switchModel.isActive ? this.switchModel.predict().predictedGroup : this.switchModel.dynamicPreviousData;
            
            if (this.activeModel && (this.continueModel.isActive || this.switchModel.isActive)) {
                console.log(`🔄 Loaded active state: Pattern ${this.currentPattern}`);
                console.log(`   🔵 CONTINUE: ${this.continueModel.isActive ? 'ACTIVE' : 'INACTIVE'}`);
                console.log(`   🟡 SWITCH: ${this.switchModel.isActive ? 'ACTIVE' : 'INACTIVE'}`);
            }
        }
        
        console.log(`📀 AI state loaded: ${this.totalPredictions} predictions, ${this.accuracy.toFixed(1)}% accuracy`);
        console.log(`   Selector has data for ${Object.keys(this.selector.patternStats).length} patterns`);
    }
    
    forceReset() {
        console.log(`🔧 Manual force reset triggered.`);
        this.resetActivePattern();
        this.selector.reset();
        this.subPatternDetected = null;
        return {
            success: true,
            message: "AI has been reset. Now in WAIT mode with fresh selector data."
        };
    }
    
    getProtectionTypes() {
        return ['CONTINUE', 'SWITCH', 'AUTO'];
    }
    
    getAllPatterns() {
        return this.patterns;
    }
    
    getPatternMapping() {
        return this.patternMapping;
    }
    
    setActiveModel(modelType) {
        const validModels = ['CONTINUE', 'SWITCH', 'AUTO'];
        if (!validModels.includes(modelType)) {
            console.log(`⚠️ Invalid model type: ${modelType}`);
            return false;
        }
        
        if (modelType === 'AUTO') {
            this.selector.setUserPreference('AUTO');
        } else if (modelType === 'CONTINUE') {
            this.selector.setUserPreference('CONTINUE');
        } else if (modelType === 'SWITCH') {
            this.selector.setUserPreference('SWITCH');
        }
        
        console.log(`🔧 Active model set to: ${modelType}`);
        return true;
    }
    
    getRuleDescription(patternString) {
        const mapping = this.patternMapping[patternString];
        if (!mapping) return null;
        
        return {
            pattern: patternString,
            continueRule: `CONTINUE Model = Last Result (dynamic)`,
            switchRule: `SWITCH Model = Previous Result (dynamic)`,
            description: mapping.description
        };
    }
}

function createPatternFromResults(results) {
    if (!results || results.length < 3) {
        return null;
    }
    const last3 = results.slice(-3);
    return `${last3[0]}→${last3[1]}→${last3[2]}`;
}

function isValidPattern(patternString) {
    const validPatterns = [
        "LOW→HIGH→MEDIUM",
        "HIGH→LOW→MEDIUM",
        "MEDIUM→LOW→HIGH",
        "MEDIUM→HIGH→LOW",
        "LOW→MEDIUM→HIGH",
        "HIGH→MEDIUM→LOW"
    ];
    return validPatterns.includes(patternString);
}

module.exports = {
    NewPatternAI,
    ContinueModel,
    SwitchModel,
    SelectorModel,
    createPatternFromResults,
    isValidPattern
};
