// ============================================================
// new-ai-logic.js (v12.0 - SWITCH ONLY Model)
// 
// 6 Patterns for 3-Step Detection (ONLY for pattern detection trigger):
// 1. LOW → HIGH → MEDIUM
// 2. HIGH → LOW → MEDIUM
// 3. MEDIUM → LOW → HIGH
// 4. MEDIUM → HIGH → LOW
// 5. LOW → MEDIUM → HIGH
// 6. HIGH → MEDIUM → LOW
//
// NEW v12.0 SWITCH ONLY SYSTEM:
// - SWITCH Model: Always predicts PREVIOUS result (dynamic update on wrong)
// - No CONTINUE Model, No Selector Model
// - Simple, focused, single model prediction
// ============================================================

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
            confidence: 80,
            description: `SWITCH: Previous result (${this.dynamicPreviousData})`
        };
    }
    
    updateWithResult(actualGroup) {
        this.totalPredictions++;
        const isCorrect = (this.dynamicPreviousData === actualGroup);
        if (isCorrect) {
            this.correctPredictions++;
            this.isActive = false;
            console.log(`   🟡 SWITCH Model: CORRECT! Deactivating.`);
        } else {
            this.consecutiveWrongCount++;
            // Update dynamic values with actual result
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

class NewPatternAI {
    constructor() {
        this.version = "12.0";
        this.name = "SWITCH ONLY 3-Step Pattern AI";
        
        // Define the 6 patterns (ONLY for detection trigger)
        this.patterns = [
            "LOW→HIGH→MEDIUM",
            "HIGH→LOW→MEDIUM",
            "MEDIUM→LOW→HIGH",
            "MEDIUM→HIGH→LOW",
            "LOW→MEDIUM→HIGH",
            "HIGH→MEDIUM→LOW"
        ];
        
        // Pattern mapping for display purposes only
        this.patternMapping = {
            "LOW→HIGH→MEDIUM": {
                switchGroup: "HIGH",
                description: "LOW থেকে HIGH হয়ে MEDIUM এ এসেছে",
                recentData: "MEDIUM",
                previousData: "HIGH"
            },
            "HIGH→LOW→MEDIUM": {
                switchGroup: "LOW",
                description: "HIGH থেকে LOW হয়ে MEDIUM এ এসেছে",
                recentData: "MEDIUM",
                previousData: "LOW"
            },
            "MEDIUM→LOW→HIGH": {
                switchGroup: "LOW",
                description: "MEDIUM থেকে LOW হয়ে HIGH এ এসেছে",
                recentData: "HIGH",
                previousData: "LOW"
            },
            "MEDIUM→HIGH→LOW": {
                switchGroup: "HIGH",
                description: "MEDIUM থেকে HIGH হয়ে LOW এ এসেছে",
                recentData: "LOW",
                previousData: "HIGH"
            },
            "LOW→MEDIUM→HIGH": {
                switchGroup: "MEDIUM",
                description: "LOW থেকে MEDIUM হয়ে HIGH এ এসেছে",
                recentData: "HIGH",
                previousData: "MEDIUM"
            },
            "HIGH→MEDIUM→LOW": {
                switchGroup: "MEDIUM",
                description: "HIGH থেকে MEDIUM হয়ে LOW এ এসেছে",
                recentData: "LOW",
                previousData: "MEDIUM"
            }
        };
        
        // Single SWITCH Model
        this.switchModel = new SwitchModel();
        
        // Which model is currently active (always SWITCH when active)
        this.isActiveMode = false;
        this.currentPattern = null;
        
        // Pattern tracking history
        this.patternHistory = [];
        this.totalPredictions = 0;
        this.correctPredictions = 0;
        this.accuracy = 0;
        
        // Pattern-specific learning data
        this.patternOccurrences = {};
        
        // Initialize pattern occurrences counter
        for (const pattern of this.patterns) {
            this.patternOccurrences[pattern] = {
                count: 0,
                lastSeen: null,
                switchCount: 0,
                switchCorrect: 0,
                switchAccuracy: 0
            };
        }
        
        console.log(`🤖 ${this.name} initialized with ${this.patterns.length} patterns`);
        console.log(`📋 NEW SWITCH ONLY SYSTEM (v12.0):`);
        console.log(`   🟡 SWITCH Model: Always predicts PREVIOUS result`);
        console.log(`   🔄 Updates dynamically on wrong prediction`);
        console.log(`   ✅ Resets to WAIT mode on correct prediction`);
    }
    
    /**
     * Get last 3 results as a pattern string
     */
    getPatternString(last3Results) {
        if (!last3Results || last3Results.length !== 3) {
            return null;
        }
        return `${last3Results[0]}→${last3Results[1]}→${last3Results[2]}`;
    }
    
    /**
     * Get recent and previous data from pattern
     */
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
    
    /**
     * Check if a pattern matches any of the 6 defined patterns
     */
    isPatternMatch(patternString) {
        return this.patterns.includes(patternString);
    }
    
    /**
     * Reset model and go back to WAIT mode
     */
    resetActivePattern() {
        console.log(`🔄 Resetting SWITCH model. Going back to WAIT mode.`);
        this.switchModel.reset();
        this.isActiveMode = false;
        this.currentPattern = null;
    }
    
    /**
     * Get current status of the model
     */
    getModelsStatus() {
        return {
            switch: this.switchModel.getStatus(),
            isActive: this.isActiveMode,
            currentPattern: this.currentPattern
        };
    }
    
    /**
     * MAIN PREDICTION FUNCTION
     */
    predict(last3Results) {
        
        // CASE 1: Active model exists - we are in prediction mode
        if (this.isActiveMode && this.switchModel.isActive) {
            const prediction = this.switchModel.predict();
            
            console.log(`🔄 Active prediction mode with SWITCH Model`);
            console.log(`   SWITCH Model prediction: ${prediction.predictedGroup}`);
            
            // Calculate confidence based on historical data
            let confidence = 75;
            const patternStats = this.patternOccurrences[this.currentPattern];
            if (patternStats && patternStats.switchCount > 0) {
                confidence = Math.min(92, Math.max(45, (confidence + patternStats.switchAccuracy) / 2));
            }
            
            this.recordPrediction({
                pattern: this.currentPattern,
                protectionType: "SWITCH",
                predictedGroup: prediction.predictedGroup,
                timestamp: new Date().toISOString(),
                confidence: confidence,
                actualGroup: null,
                isRetry: this.switchModel.consecutiveWrongCount > 0,
                retryNumber: this.switchModel.consecutiveWrongCount,
                switchValue: this.switchModel.dynamicPreviousData
            });
            
            return {
                status: "PREDICTION_READY",
                pattern: this.currentPattern,
                protectionType: "SWITCH",
                predictedGroup: prediction.predictedGroup,
                confidence: Math.round(confidence),
                switchValue: this.switchModel.dynamicPreviousData,
                description: prediction.description,
                waitingForData: false,
                isRetry: this.switchModel.consecutiveWrongCount > 0,
                retryCount: this.switchModel.consecutiveWrongCount,
                activeModel: "SWITCH",
                message: `SWITCH Model active${this.switchModel.consecutiveWrongCount > 0 ? ` (Retry #${this.switchModel.consecutiveWrongCount})` : ''}`,
                last3Results: last3Results
            };
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
        
        // CASE 4: Pattern matched! START prediction mode with SWITCH model
        console.log(`✅ Pattern MATCHED! Starting prediction mode.`);
        
        const patternData = this.getPatternData(patternString);
        this.currentPattern = patternString;
        
        // Initialize SWITCH model with pattern data
        this.switchModel.initialize(patternData);
        this.isActiveMode = true;
        
        const prediction = this.switchModel.predict();
        
        // Calculate confidence
        let confidence = 75;
        const patternStats = this.patternOccurrences[patternString];
        if (patternStats && patternStats.switchCount > 0) {
            confidence = Math.min(92, Math.max(45, (confidence + patternStats.switchAccuracy) / 2));
        }
        
        this.recordPrediction({
            pattern: patternString,
            protectionType: "SWITCH",
            predictedGroup: prediction.predictedGroup,
            timestamp: new Date().toISOString(),
            confidence: Math.round(confidence),
            actualGroup: null,
            isRetry: false,
            retryNumber: 0,
            switchValue: this.switchModel.dynamicPreviousData
        });
        
        console.log(`🎯 PREDICTION MODE ACTIVATED with SWITCH Model`);
        console.log(`   Pattern: ${patternString}`);
        console.log(`   SWITCH Model prediction: ${prediction.predictedGroup} (${Math.round(confidence)}% confidence)`);
        console.log(`   📌 Will retry with SAME model until CORRECT`);
        console.log(`   📌 Values update dynamically with each new result`);
        
        return {
            status: "PREDICTION_READY",
            pattern: patternString,
            protectionType: "SWITCH",
            predictedGroup: prediction.predictedGroup,
            confidence: Math.round(confidence),
            switchValue: this.switchModel.dynamicPreviousData,
            description: prediction.description,
            waitingForData: false,
            isActive: true,
            activeModel: "SWITCH",
            message: `Pattern matched! Using SWITCH Model.`,
            last3Results: last3Results
        };
    }
    
    /**
     * Update AI with actual result
     */
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
        
        // Update overall statistics
        this.totalPredictions++;
        if (prediction.isCorrect) {
            this.correctPredictions++;
        }
        this.accuracy = (this.correctPredictions / this.totalPredictions) * 100;
        
        // Update pattern-specific learning data
        const occurrence = this.patternOccurrences[prediction.pattern];
        if (occurrence) {
            occurrence.count++;
            occurrence.lastSeen = new Date().toISOString();
            occurrence.switchCount++;
            if (prediction.isCorrect) {
                occurrence.switchCorrect++;
            }
            occurrence.switchAccuracy = (occurrence.switchCorrect / occurrence.switchCount) * 100;
        }
        
        // Update the SWITCH model
        const modelUpdateResult = this.switchModel.updateWithResult(actualGroup);
        
        console.log(`📊 UPDATE RESULT:`);
        console.log(`   Pattern: ${prediction.pattern}`);
        console.log(`   Active Model: SWITCH`);
        console.log(`   Predicted: ${prediction.predictedGroup} → Actual: ${actualGroup}`);
        console.log(`   Result: ${prediction.isCorrect ? '✓ CORRECT' : '✗ WRONG'}`);
        
        // Get pattern stats for display
        const patternStats = this.patternOccurrences[prediction.pattern];
        console.log(`   Pattern Stats - SWITCH: ${patternStats?.switchAccuracy?.toFixed(1) || 0}% (${patternStats?.switchCorrect || 0}/${patternStats?.switchCount || 0})`);
        console.log(`   Overall Accuracy: ${this.accuracy.toFixed(1)}% (${this.correctPredictions}/${this.totalPredictions})`);
        
        // Handle the result
        if (prediction.isCorrect) {
            console.log(`✅ CORRECT! Resetting SWITCH model. Going back to WAIT mode.`);
            this.resetActivePattern();
            
            return {
                isCorrect: true,
                predictedGroup: prediction.predictedGroup,
                actualGroup: actualGroup,
                newAccuracy: this.accuracy,
                resetPattern: true,
                message: "Correct prediction! Reset to WAIT mode.",
                modelUsed: "SWITCH",
                patternStats: patternStats
            };
        } else {
            console.log(`❌ WRONG! Keeping SWITCH Model active.`);
            console.log(`   Wrong count: ${this.switchModel.consecutiveWrongCount}`);
            
            return {
                isCorrect: false,
                predictedGroup: prediction.predictedGroup,
                actualGroup: actualGroup,
                newAccuracy: this.accuracy,
                keepPattern: true,
                modelUsed: "SWITCH",
                modelStillActive: modelUpdateResult?.keepActive || false,
                newSwitchValue: this.switchModel.dynamicPreviousData,
                patternStats: patternStats,
                message: `Wrong prediction! SWITCH Model continues.`
            };
        }
    }
    
    /**
     * Update dynamic values externally
     */
    updateWithNewResult(newResult) {
        if (this.isActiveMode && this.switchModel.isActive) {
            console.log(`🔄 New result detected while in prediction mode: ${newResult}`);
            this.switchModel.updateWithResult(newResult);
            
            return {
                updated: true,
                switchValue: this.switchModel.dynamicPreviousData,
                activeModel: "SWITCH",
                message: `Dynamic values updated with new result: ${newResult}`
            };
        }
        return {
            updated: false,
            message: "Not in prediction mode, no update needed"
        };
    }
    
    /**
     * Check if AI is currently in active prediction mode
     */
    isActive() {
        return (this.isActiveMode && this.switchModel.isActive);
    }
    
    /**
     * Get current active pattern info
     */
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
            activeModel: "SWITCH",
            switchValue: this.switchModel.dynamicPreviousData,
            switchModelActive: this.switchModel.isActive,
            switchWrongCount: this.switchModel.consecutiveWrongCount,
            message: `Active: ${this.currentPattern} | Model: SWITCH`
        };
    }
    
    /**
     * Record a prediction for future learning
     */
    recordPrediction(predictionData) {
        this.patternHistory.unshift({
            ...predictionData,
            id: Date.now()
        });
        
        if (this.patternHistory.length > 1000) {
            this.patternHistory.pop();
        }
    }
    
    /**
     * Get pattern statistics with learning data
     */
    getPatternStats() {
        const stats = {};
        
        for (const pattern of this.patterns) {
            const occ = this.patternOccurrences[pattern];
            const mapping = this.patternMapping[pattern];
            stats[pattern] = {
                occurrences: occ.count,
                lastSeen: occ.lastSeen,
                switchAccuracy: Math.round(occ.switchAccuracy),
                switchStats: `${occ.switchCorrect}/${occ.switchCount}`,
                switchGroup: mapping.switchGroup,
                description: mapping.description
            };
        }
        
        return stats;
    }
    
    /**
     * Get overall AI stats
     */
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
            modelsStatus: this.getModelsStatus()
        };
    }
    
    /**
     * Get current accuracy
     */
    getAccuracy() {
        return this.accuracy;
    }
    
    /**
     * Get current dynamic values
     */
    getDynamicValues() {
        return {
            switchValue: this.switchModel.dynamicPreviousData,
            isActive: this.isActive(),
            activeModel: this.isActiveMode ? "SWITCH" : null,
            switchModelActive: this.switchModel.isActive,
            switchWrongCount: this.switchModel.consecutiveWrongCount
        };
    }
    
    /**
     * Get SWITCH model prediction
     */
    getSwitchPrediction() {
        return {
            value: this.switchModel.dynamicPreviousData,
            active: this.switchModel.isActive,
            accuracy: this.switchModel.accuracy
        };
    }
    
    /**
     * Export state for database persistence
     */
    exportState() {
        return {
            version: this.version,
            totalPredictions: this.totalPredictions,
            correctPredictions: this.correctPredictions,
            accuracy: this.accuracy,
            patternOccurrences: this.patternOccurrences,
            patternHistory: this.patternHistory.slice(0, 100),
            currentPattern: this.currentPattern,
            isActiveMode: this.isActiveMode,
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
    
    /**
     * Load state from database
     */
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
        
        if (state.currentPattern) {
            this.currentPattern = state.currentPattern;
            this.isActiveMode = state.isActiveMode || false;
            
            if (state.switchModelState) {
                this.switchModel.dynamicRecentData = state.switchModelState.dynamicRecentData;
                this.switchModel.dynamicPreviousData = state.switchModelState.dynamicPreviousData;
                this.switchModel.isActive = state.switchModelState.isActive;
                this.switchModel.consecutiveWrongCount = state.switchModelState.consecutiveWrongCount;
                this.switchModel.totalPredictions = state.switchModelState.totalPredictions;
                this.switchModel.correctPredictions = state.switchModelState.correctPredictions;
                this.switchModel.accuracy = state.switchModelState.accuracy;
            }
            
            if (this.isActiveMode && this.switchModel.isActive) {
                console.log(`🔄 Loaded active state: Pattern ${this.currentPattern}, Model SWITCH`);
            }
        }
        
        console.log(`📀 AI state loaded: ${this.totalPredictions} predictions, ${this.accuracy.toFixed(1)}% accuracy`);
    }
    
    /**
     * Force reset
     */
    forceReset() {
        console.log(`🔧 Manual force reset triggered.`);
        this.resetActivePattern();
        return {
            success: true,
            message: "AI has been reset. Now in WAIT mode."
        };
    }
    
    /**
     * Get available protection types (always SWITCH now)
     */
    getProtectionTypes() {
        return ['SWITCH'];
    }
    
    /**
     * Get all defined patterns
     */
    getAllPatterns() {
        return this.patterns;
    }
    
    /**
     * Get pattern mapping
     */
    getPatternMapping() {
        return this.patternMapping;
    }
    
    /**
     * Get rule description for a pattern
     */
    getRuleDescription(patternString) {
        const mapping = this.patternMapping[patternString];
        if (!mapping) return null;
        
        return {
            pattern: patternString,
            switchRule: `SWITCH Model = Previous Result (dynamic)`,
            description: mapping.description
        };
    }
}

// ============================================================
// Helper functions
// ============================================================

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

// ============================================================
// EXPORT
// ============================================================
module.exports = {
    NewPatternAI,
    SwitchModel,
    createPatternFromResults,
    isValidPattern
};
