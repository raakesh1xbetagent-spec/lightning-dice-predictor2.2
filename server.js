// ============================================================
// MODIFIED server.js (v11.0 - Dual Model with Selector)
// Features: 3-Step Pattern Detection | CONTINUE & SWITCH Models | Selector Model
// Telegram: ONLY sends notifications for VALID predictions (not WAITING mode)
// UPDATED: Dual model system with user preference support
// ============================================================

// Fix memory leak warnings
require('events').EventEmitter.defaultMaxListeners = 20;
process.setMaxListeners(20);

// Load environment variables for Telegram
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const WebSocket = require('ws');
const fs = require('fs');

// ============ AI IMPORT ============
const { NewPatternAI } = require('./new-ai-logic');

const app = express();
const PORT = process.env.PORT || 3000;

// ============ TELEGRAM NOTIFICATION STATE ============
let aiMissCount = 0;
let alertTriggered = false;

// ============ TELEGRAM FUNCTIONS - ONLY FOR VALID PREDICTIONS ============

async function sendTelegramWrongNotification(actualGroup, predictedGroup, retryCount = 0, modelUsed = null) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    
    if (!botToken || !chatId) {
        console.log('⚠️ Telegram token or chat ID not set. Skipping notification.');
        return;
    }
    
    // CRITICAL FIX: Don't send notification if prediction was WAITING mode
    if (!predictedGroup || predictedGroup === 'WAITING' || predictedGroup === '--' || predictedGroup === null) {
        console.log(`📱 Telegram: Skipping notification - Invalid prediction (${predictedGroup})`);
        return;
    }
    
    const retryText = retryCount > 0 ? ` (Retry #${retryCount})` : '';
    const modelText = modelUsed ? ` [${modelUsed} Model]` : '';
    
    const message = `❌ WRONG PREDICTION ❌${modelText}

Predicted: ${predictedGroup}
Actual: ${actualGroup}${retryText}`;

    try {
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        await axios.post(url, {
            chat_id: chatId,
            text: message
        });
        console.log(`📱 Telegram: WRONG notification sent for ${predictedGroup} → ${actualGroup}`);
    } catch (error) {
        console.error('❌ Telegram error:', error.message);
    }
}

async function sendTelegramCorrectNotification(actualGroup, predictedGroup, wasRetry = false, retryCount = 0, modelUsed = null) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    
    if (!botToken || !chatId) {
        return;
    }
    
    // CRITICAL FIX: Don't send notification if prediction was WAITING mode
    if (!predictedGroup || predictedGroup === 'WAITING' || predictedGroup === '--' || predictedGroup === null) {
        console.log(`📱 Telegram: Skipping notification - Invalid prediction (${predictedGroup})`);
        return;
    }
    
    const retryText = wasRetry ? ` (Correct after ${retryCount} retries)` : '';
    const modelText = modelUsed ? ` [${modelUsed} Model]` : '';
    
    const message = `✅ CORRECT PREDICTION ✅${modelText}

Predicted: ${predictedGroup}
Actual: ${actualGroup}${retryText}`;

    try {
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        await axios.post(url, {
            chat_id: chatId,
            text: message
        });
        console.log(`📱 Telegram: CORRECT notification sent for ${predictedGroup} → ${actualGroup}`);
    } catch (error) {
        console.error('❌ Telegram error:', error.message);
    }
}

// Ensure database directory exists
const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log('📁 Created data directory:', dbDir);
}

// Database setup
const dbPath = path.join(dbDir, 'lightning_dice.db');
console.log('📂 Database path:', dbPath);
const db = new sqlite3.Database(dbPath);

// Create tables (UPDATED for v11.0)
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS results (
        id TEXT PRIMARY KEY,
        total INTEGER,
        group_name TEXT,
        multiplier INTEGER,
        dice_values TEXT,
        timestamp DATETIME,
        winners INTEGER,
        payout INTEGER
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS predictions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        result_id TEXT UNIQUE,
        pattern_3step TEXT,
        protection_type TEXT,
        predicted_group TEXT,
        prediction_timestamp DATETIME,
        actual_group TEXT,
        actual_timestamp DATETIME,
        is_correct INTEGER DEFAULT -1,
        is_retry INTEGER DEFAULT 0,
        retry_number INTEGER DEFAULT 0,
        continue_value TEXT,
        switch_value TEXT,
        active_model TEXT,
        user_preference TEXT
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS ai_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        total_predictions INTEGER DEFAULT 0,
        correct_predictions INTEGER DEFAULT 0,
        accuracy REAL DEFAULT 0,
        last_updated DATETIME
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS pattern_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern_3step TEXT NOT NULL,
        protection_type TEXT NOT NULL,
        predicted_group TEXT NOT NULL,
        occurrence_count INTEGER DEFAULT 1,
        last_seen DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS ai_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        state_data TEXT,
        updated_at DATETIME
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS user_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        preference TEXT DEFAULT 'AUTO',
        updated_at DATETIME
    )`);
    
    // Add new columns if not exists
    db.run(`ALTER TABLE predictions ADD COLUMN is_retry INTEGER DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('Table already has is_retry column');
        }
    });
    db.run(`ALTER TABLE predictions ADD COLUMN retry_number INTEGER DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('Table already has retry_number column');
        }
    });
    db.run(`ALTER TABLE predictions ADD COLUMN continue_value TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('Table already has continue_value column');
        }
    });
    db.run(`ALTER TABLE predictions ADD COLUMN switch_value TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('Table already has switch_value column');
        }
    });
    db.run(`ALTER TABLE predictions ADD COLUMN active_model TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('Table already has active_model column');
        }
    });
    db.run(`ALTER TABLE predictions ADD COLUMN user_preference TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('Table already has user_preference column');
        }
    });
    
    // Create user_settings default record
    db.run(`INSERT OR IGNORE INTO user_settings (id, preference, updated_at) VALUES (1, 'AUTO', datetime('now'))`);
    
    console.log('✅ Database tables created/verified (v11.0 ready)');
});

// ============ AI MODEL INITIALIZATION ============
let serverAI = null;

async function initNewAI() {
    console.log('🤖 Initializing Dual Model 3-Step Pattern AI (v11.0)...');
    serverAI = new NewPatternAI();
    
    try {
        // Load user preference
        const userPref = await new Promise((resolve) => {
            db.get(`SELECT preference FROM user_settings WHERE id = 1`, (err, row) => {
                if (err || !row) {
                    resolve('AUTO');
                } else {
                    resolve(row.preference);
                }
            });
        });
        serverAI.setUserPreference(userPref);
        console.log(`👤 User preference loaded: ${userPref}`);
        
        // Load AI state
        const savedState = await new Promise((resolve) => {
            db.get(`SELECT state_data FROM ai_state WHERE id = 1`, (err, row) => {
                if (err || !row) {
                    resolve(null);
                } else {
                    try {
                        resolve(JSON.parse(row.state_data));
                    } catch (e) {
                        resolve(null);
                    }
                }
            });
        });
        
        if (savedState) {
            serverAI.loadState(savedState);
            console.log(`📀 Loaded AI state from database`);
        }
    } catch (err) {
        console.log('No existing AI state found, starting fresh');
    }
    
    console.log(`✅ AI ready - Dual Model 3-Step Pattern AI active with ${serverAI.patterns.length} patterns`);
    console.log(`📋 NEW DUAL MODEL SYSTEM (v11.0):`);
    console.log(`   🔵 CONTINUE Model: Always predicts LAST result`);
    console.log(`   🟡 SWITCH Model: Always predicts PREVIOUS result`);
    console.log(`   🎯 Selector Model: Learns which model works best per pattern`);
    console.log(`   👤 User can choose: CONTINUE only, SWITCH only, or AUTO`);
    console.log(`📱 Telegram: ONLY sends for VALID predictions (ignores WAITING mode)`);
}

// Save AI state to database periodically
async function saveAIState() {
    if (!serverAI) return;
    
    try {
        const state = serverAI.exportState();
        db.run(`INSERT OR REPLACE INTO ai_state (id, state_data, updated_at) VALUES (1, ?, ?)`,
            [JSON.stringify(state), new Date().toISOString()],
            (err) => {
                if (err) console.error('Error saving AI state:', err);
                else console.log('💾 AI state saved to database');
            }
        );
    } catch (err) {
        console.error('Error exporting AI state:', err);
    }
}

// Save user preference to database
async function saveUserPreference(preference) {
    return new Promise((resolve) => {
        db.run(`UPDATE user_settings SET preference = ?, updated_at = ? WHERE id = 1`,
            [preference, new Date().toISOString()],
            (err) => {
                if (err) {
                    console.error('Error saving user preference:', err);
                    resolve(false);
                } else {
                    console.log(`💾 User preference saved: ${preference}`);
                    resolve(true);
                }
            }
        );
    });
}

setInterval(saveAIState, 5 * 60 * 1000);

// ============ CORS & MIDDLEWARE ============
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static('public'));

// ============ WEB SOCKET SERVER ============
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n⚡ Lightning Dice Predictor v11.0 - Dual Model AI`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`🚀 Server running on port ${PORT}\n`);
    initNewAI();
    setTimeout(checkDatabaseOnStartup, 2000);
});

const wss = new WebSocket.Server({ server });

const clients = new Set();

wss.on('connection', (ws) => {
    ws.setMaxListeners(20);
    
    ws.once('error', (error) => {
        console.error('WebSocket error:', error);
    });
    
    clients.add(ws);
    console.log(`🔌 Client connected. Total clients: ${clients.size}`);
    
    ws.on('close', () => {
        clients.delete(ws);
        console.log(`🔌 Client disconnected. Total clients: ${clients.size}`);
    });
});

function broadcast(data) {
    const message = JSON.stringify(data);
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// ============ DATA RETRIEVAL HELPER FUNCTIONS ============

function getResultsData(limit = 100) {
    return new Promise((resolve) => {
        db.all(`SELECT id, total, group_name as groupName, multiplier, dice_values as diceValues, timestamp 
                FROM results ORDER BY timestamp DESC LIMIT ?`, [limit], (err, rows) => {
            if (err) {
                console.error('Error in getResultsData:', err);
                resolve([]);
            } else {
                const formatted = (rows || []).map(row => ({
                    id: row.id,
                    total: row.total,
                    group: row.groupName,
                    multiplier: row.multiplier,
                    diceValues: row.diceValues,
                    timestamp: row.timestamp
                }));
                formatted.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                console.log(`✅ getResultsData returning ${formatted.length} results`);
                resolve(formatted);
            }
        });
    });
}

function getPredictionsData(limit = 500) {
    return new Promise((resolve) => {
        db.all(`SELECT p.*, r.total, r.dice_values, r.timestamp as result_time
                FROM predictions p
                LEFT JOIN results r ON p.result_id = r.id
                WHERE p.predicted_group IS NOT NULL 
                  AND p.predicted_group != 'WAITING'
                  AND p.predicted_group != '--'
                  AND p.pattern_3step IS NOT NULL
                  AND p.pattern_3step != '--'
                ORDER BY p.prediction_timestamp DESC LIMIT ?`, [limit], (err, rows) => {
            if (err) {
                console.error('Error in getPredictionsData:', err);
                resolve([]);
            } else {
                const transformed = (rows || []).map(p => ({
                    id: p.result_id,
                    time: p.prediction_timestamp ? new Date(p.prediction_timestamp).toLocaleTimeString() : '--',
                    dice: p.dice_values || '--',
                    total: p.total || '--',
                    actualGroup: p.actual_group || '?',
                    pattern3step: p.pattern_3step || '--',
                    protectionType: p.protection_type || '--',
                    predictedGroup: p.predicted_group || '--',
                    isCorrect: p.is_correct === 1,
                    isRetry: p.is_retry === 1,
                    retryNumber: p.retry_number || 0,
                    continueValue: p.continue_value,
                    switchValue: p.switch_value,
                    activeModel: p.active_model,
                    userPreference: p.user_preference,
                    timestamp: new Date(p.prediction_timestamp),
                    isPending: p.actual_group === null
                }));
                console.log(`✅ getPredictionsData returning ${transformed.length} valid predictions (WAITING filtered out)`);
                resolve(transformed);
            }
        });
    });
}

function getStatsData() {
    return new Promise((resolve) => {
        db.get(`SELECT 
                    COUNT(*) as totalRounds,
                    COALESCE(AVG(total), 0) as avgResult,
                    (SELECT group_name FROM results GROUP BY group_name ORDER BY COUNT(*) DESC LIMIT 1) as mostActiveGroup
                FROM results`, (err, stats) => {
            if (err) {
                console.error('Error in getStatsData:', err);
                resolve({ totalRounds: 0, avgResult: 0, mostActiveGroup: 'LOW', lightningBoost: 0 });
            } else {
                db.get(`SELECT COUNT(*) as lightningCount FROM results WHERE multiplier > 10`, (err, lightning) => {
                    db.get(`SELECT COUNT(*) as total FROM results`, (err, total) => {
                        const lightningPercent = total && total.total > 0 ? (lightning?.lightningCount || 0) / total.total * 100 : 0;
                        resolve({
                            totalRounds: stats?.totalRounds || 0,
                            avgResult: stats?.avgResult ? stats.avgResult.toFixed(2) : 0,
                            mostActiveGroup: stats?.mostActiveGroup || 'LOW',
                            lightningBoost: Math.round(lightningPercent)
                        });
                    });
                });
            }
        });
    });
}

function getAIStatsData() {
    return new Promise((resolve) => {
        db.get(`SELECT total_predictions, correct_predictions, accuracy FROM ai_stats ORDER BY id DESC LIMIT 1`, (err, row) => {
            if (err) {
                console.error('Error in getAIStatsData:', err);
                resolve({ totalPredictions: 0, accuracy: 0 });
            } else {
                resolve(row || { totalPredictions: 0, accuracy: 0 });
            }
        });
    });
}

function getPreviousResultsForPrediction(limit = 10) {
    return new Promise((resolve) => {
        db.all(`SELECT group_name as group_value, id, timestamp FROM results ORDER BY timestamp DESC LIMIT ?`, [limit], (err, results) => {
            if (err) {
                console.error('Error getting previous results:', err);
                resolve([]);
            } else {
                console.log(`📊 getPreviousResultsForPrediction returned ${results?.length || 0} results`);
                if (results && results.length > 0) {
                    console.log(`   Last groups: ${results.map(r => r.group_value).join(', ')}`);
                    const formatted = results.map(r => ({ group: r.group_value, id: r.id, timestamp: r.timestamp }));
                    resolve(formatted);
                } else {
                    resolve([]);
                }
            }
        });
    });
}

async function getLast3Results() {
    const results = await getPreviousResultsForPrediction(3);
    if (results.length >= 3) {
        return [results[2].group, results[1].group, results[0].group];
    }
    return null;
}

async function getCurrentPredictionData() {
    const last3Results = await getLast3Results();
    
    if (!last3Results || last3Results.length < 3) {
        console.log(`⚠️ Not enough history for prediction (need 3 results, waiting...)`);
        return {
            pattern3step: null,
            protectionType: null,
            predictedGroup: 'WAITING',
            confidence: 0,
            waitingForData: true,
            last3Results: null,
            status: "WAITING",
            message: `Waiting for 3 results. Currently have ${last3Results?.length || 0}`
        };
    }
    
    console.log(`🔮 Checking pattern for: ${last3Results.join(' → ')}`);
    
    if (serverAI) {
        const prediction = serverAI.predict(last3Results, null);
        
        // Get both models' predictions
        const bothPredictions = serverAI.getBothPredictions();
        
        return {
            pattern3step: prediction.pattern,
            protectionType: prediction.protectionType,
            predictedGroup: prediction.predictedGroup,
            confidence: prediction.confidence,
            waitingForData: prediction.status === "WAITING",
            last3Results: last3Results,
            status: prediction.status,
            description: prediction.description,
            continueGroup: prediction.continueValue,
            switchGroup: prediction.switchValue,
            continueModelPrediction: prediction.continueModelPrediction,
            switchModelPrediction: prediction.switchModelPrediction,
            isRetry: prediction.isRetry || false,
            retryCount: prediction.retryCount || 0,
            recentData: prediction.continueValue,
            previousData: prediction.switchValue,
            activeModel: prediction.activeModel,
            userPreference: prediction.userPreference,
            bothPredictions: bothPredictions
        };
    }
    
    // Fallback
    console.log(`⚠️ AI not initialized, using fallback prediction`);
    const patternString = `${last3Results[0]}→${last3Results[1]}→${last3Results[2]}`;
    return {
        pattern3step: patternString,
        protectionType: 'CONTINUE',
        predictedGroup: last3Results[0],
        confidence: 50,
        waitingForData: false,
        last3Results: last3Results,
        status: "PREDICTION_READY",
        description: "Fallback prediction (AI not ready)"
    };
}

async function savePredictionOnly(resultId, last3Results) {
    if (!last3Results) {
        console.log(`⚠️ Cannot save prediction for ${resultId}: insufficient history (need 3 results)`);
        return null;
    }
    
    console.log(`🔮 Generating prediction for ${resultId}...`);
    console.log(`   Last 3 Results: ${last3Results.join(' → ')}`);
    
    const prediction = await getCurrentPredictionData();
    
    // CRITICAL FIX: Don't save WAITING predictions to database
    if (prediction.status === "WAITING" || prediction.predictedGroup === 'WAITING' || prediction.predictedGroup === null) {
        console.log(`⚠️ NOT saving prediction for ${resultId} - AI is in WAITING mode (no valid prediction)`);
        return null;
    }
    
    // Get current dynamic values from AI if available
    let continueValue = null;
    let switchValue = null;
    let activeModel = null;
    let userPreference = null;
    
    if (serverAI) {
        const dynamicVals = serverAI.getDynamicValues();
        continueValue = dynamicVals.continueValue;
        switchValue = dynamicVals.switchValue;
        activeModel = dynamicVals.activeModel;
        userPreference = dynamicVals.userPreference;
    }
    
    console.log(`\n📝 SAVING PREDICTION for ${resultId}:`);
    console.log(`   Pattern (3-Step): ${prediction.pattern3step || 'N/A'}`);
    console.log(`   Active Model: ${activeModel || prediction.protectionType || 'N/A'}`);
    console.log(`   Predicted Group: ${prediction.predictedGroup || 'N/A'}`);
    console.log(`   Is Retry: ${prediction.isRetry || false}`);
    console.log(`   Retry Count: ${prediction.retryCount || 0}`);
    console.log(`   CONTINUE Value: ${continueValue || 'N/A'}`);
    console.log(`   SWITCH Value: ${switchValue || 'N/A'}`);
    console.log(`   User Preference: ${userPreference || 'AUTO'}`);
    
    const existing = await new Promise((resolve) => {
        db.get(`SELECT id FROM predictions WHERE result_id = ?`, [resultId], (err, row) => {
            if (err) {
                console.error('Error checking existing prediction:', err);
                resolve(null);
            } else {
                resolve(row);
            }
        });
    });
    
    const isRetry = prediction.isRetry ? 1 : 0;
    const retryNumber = prediction.retryCount || 0;
    const modelToSave = activeModel || prediction.protectionType || 'CONTINUE';
    const prefToSave = userPreference || 'AUTO';
    
    if (existing) {
        return new Promise((resolve) => {
            db.run(`UPDATE predictions SET 
                    pattern_3step = ?,
                    protection_type = ?,
                    predicted_group = ?,
                    prediction_timestamp = ?,
                    is_retry = ?,
                    retry_number = ?,
                    continue_value = ?,
                    switch_value = ?,
                    active_model = ?,
                    user_preference = ?
                    WHERE result_id = ?`,
                [prediction.pattern3step, modelToSave, prediction.predictedGroup, new Date().toISOString(), isRetry, retryNumber, continueValue, switchValue, modelToSave, prefToSave, resultId],
                (err) => {
                    if (err) {
                        console.error('Error updating prediction:', err);
                        resolve(null);
                    } else {
                        console.log(`✅ Prediction UPDATED for ${resultId}`);
                        resolve(prediction);
                    }
                }
            );
        });
    } else {
        return new Promise((resolve) => {
            const stmt = db.prepare(`INSERT INTO predictions (
                    result_id,
                    pattern_3step,
                    protection_type,
                    predicted_group,
                    prediction_timestamp,
                    is_correct,
                    is_retry,
                    retry_number,
                    continue_value,
                    switch_value,
                    active_model,
                    user_preference
                ) VALUES (?, ?, ?, ?, ?, -1, ?, ?, ?, ?, ?, ?)`);
            
            stmt.run([resultId, prediction.pattern3step, modelToSave, prediction.predictedGroup, new Date().toISOString(), isRetry, retryNumber, continueValue, switchValue, modelToSave, prefToSave], (err) => {
                if (err) {
                    console.error('Error saving prediction:', err);
                    resolve(null);
                } else {
                    console.log(`✅ Prediction INSERTED for ${resultId}`);
                    resolve(prediction);
                }
            });
            stmt.finalize();
        });
    }
}

async function updatePredictionWithResult(resultId, actualGroup) {
    console.log(`\n📊 UPDATING PREDICTION with result for ${resultId}:`);
    console.log(`   ACTUAL RESULT: ${actualGroup}`);
    
    const prediction = await new Promise((resolve) => {
        db.get(`SELECT predicted_group, pattern_3step, protection_type, is_retry, retry_number, active_model FROM predictions WHERE result_id = ?`, [resultId], (err, row) => {
            if (err) {
                console.error('Error fetching prediction:', err);
                resolve(null);
            } else {
                resolve(row);
            }
        });
    });
    
    if (!prediction) {
        console.log(`⚠️ No prediction found for ${resultId}, cannot update`);
        return null;
    }
    
    const isCorrect = (prediction.predicted_group === actualGroup) ? 1 : 0;
    const isRetry = prediction.is_retry === 1;
    const retryCount = prediction.retry_number || 0;
    const modelUsed = prediction.active_model || prediction.protection_type || 'CONTINUE';
    
    console.log(`   PREDICTED: ${prediction.predicted_group} → ${isCorrect ? '✓ CORRECT' : '✗ WRONG'}`);
    console.log(`   Model Used: ${modelUsed}`);
    console.log(`   Is Retry: ${isRetry}, Retry Count: ${retryCount}`);
    
    // Update AI model with the actual result
    if (serverAI) {
        const updateResult = serverAI.updateWithResult(actualGroup);
        console.log(`   AI Accuracy updated: ${serverAI.getAccuracy().toFixed(1)}%`);
        
        // Log model status after update
        const modelsStatus = serverAI.getModelsStatus();
        console.log(`   Models Status - CONTINUE: ${modelsStatus.continue.isActive ? 'ACTIVE' : 'INACTIVE'}, SWITCH: ${modelsStatus.switch.isActive ? 'ACTIVE' : 'INACTIVE'}`);
        console.log(`   Active Model: ${modelsStatus.activeModel || 'none'}`);
    }
    
    // ============ TELEGRAM NOTIFICATION - ONLY FOR VALID PREDICTIONS ============
    if (isCorrect === 1) {
        await sendTelegramCorrectNotification(actualGroup, prediction.predicted_group, isRetry, retryCount, modelUsed);
        aiMissCount = 0;
        alertTriggered = false;
    } else {
        aiMissCount++;
        await sendTelegramWrongNotification(actualGroup, prediction.predicted_group, retryCount, modelUsed);
    }
    // ============ END TELEGRAM LOGIC ============
    
    return new Promise((resolve) => {
        db.run(`UPDATE predictions SET
                actual_group = ?,
                actual_timestamp = ?,
                is_correct = ?
                WHERE result_id = ?`,
            [actualGroup, new Date().toISOString(), isCorrect, resultId],
            async (err) => {
                if (err) {
                    console.error('Error updating prediction with result:', err);
                } else {
                    console.log(`✅ Prediction UPDATED with result for ${resultId}`);
                    await updateAIStatsTable(isCorrect === 1);
                }
                resolve({ prediction, correct: isCorrect, modelUsed });
            }
        );
    });
}

async function updateAIStatsTable(correct) {
    return new Promise((resolve) => {
        db.get(`SELECT total_predictions, correct_predictions FROM ai_stats ORDER BY id DESC LIMIT 1`, (err, stat) => {
            const total = (stat ? stat.total_predictions : 0) + 1;
            const correctTotal = (stat ? stat.correct_predictions : 0) + (correct ? 1 : 0);
            const accuracy = (correctTotal / total) * 100;
            
            db.run(`INSERT INTO ai_stats (total_predictions, correct_predictions, accuracy, last_updated)
                    VALUES (?, ?, ?, ?)`,
                [total, correctTotal, accuracy, new Date().toISOString()],
                () => resolve()
            );
        });
    });
}

async function broadcastFullDataOnNewResult(gameResult, predictionData) {
    console.log(`📡 Preparing broadcast for ${clients.size} clients...`);
    
    const [results, predictions, stats, aiStats] = await Promise.all([
        getResultsData(100),
        getPredictionsData(500),
        getStatsData(),
        getAIStatsData()
    ]);
    
    results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Add dynamic values to prediction data if available
    let enhancedPredictionData = { ...predictionData };
    if (serverAI) {
        const dynamicVals = serverAI.getDynamicValues();
        enhancedPredictionData.dynamicContinueValue = dynamicVals.continueValue;
        enhancedPredictionData.dynamicSwitchValue = dynamicVals.switchValue;
        enhancedPredictionData.isPredictionModeActive = serverAI.isActive();
        enhancedPredictionData.activeModel = dynamicVals.activeModel;
        enhancedPredictionData.userPreference = dynamicVals.userPreference;
        
        const bothPredictions = serverAI.getBothPredictions();
        enhancedPredictionData.continueModelPrediction = bothPredictions.continue.value;
        enhancedPredictionData.switchModelPrediction = bothPredictions.switch.value;
        enhancedPredictionData.continueModelActive = bothPredictions.continue.active;
        enhancedPredictionData.switchModelActive = bothPredictions.switch.active;
        
        const modelsStatus = serverAI.getModelsStatus();
        enhancedPredictionData.modelsStatus = modelsStatus;
    }
    
    const message = JSON.stringify({
        type: 'new_result',
        result: {
            id: gameResult.id,
            total: gameResult.total,
            group: gameResult.group_name,
            multiplier: gameResult.multiplier,
            diceValues: gameResult.dice_values,
            timestamp: gameResult.timestamp
        },
        prediction: enhancedPredictionData,
        history: predictions,
        stats: stats,
        aiStats: aiStats,
        allResults: results
    });
    
    let sentCount = 0;
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
            sentCount++;
        }
    });
    console.log(`✅ Broadcast sent to ${sentCount} clients`);
}

let lastGameId = null;
let isCollecting = false;
let pendingPredictions = new Set();

function getGroup(number) {
    if (number >= 3 && number <= 9) return 'LOW';
    if (number >= 10 && number <= 11) return 'MEDIUM';
    if (number >= 12 && number <= 18) return 'HIGH';
    return 'UNKNOWN';
}

async function saveGameResult(game) {
    const total = game.result.total;
    const group = getGroup(total);
    const multipliers = game.result.luckyNumbersList || [];
    const multiplierItem = multipliers.find(m => m.outcome === `LightningDice_Total${total}`);
    const diceValues = game.result.value || '⚀ ⚀ ⚀';
    
    const result = {
        id: game.id,
        total: total,
        group_name: group,
        multiplier: multiplierItem ? multiplierItem.multiplier : 1,
        dice_values: diceValues,
        timestamp: new Date(game.settledAt).toISOString(),
        winners: game.totalWinners || 0,
        payout: game.totalAmount || 0
    };
    
    return new Promise((resolve, reject) => {
        db.run(`INSERT OR REPLACE INTO results (id, total, group_name, multiplier, dice_values, timestamp, winners, payout)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [result.id, result.total, result.group_name, result.multiplier, result.dice_values, result.timestamp, result.winners, result.payout],
            (err) => {
                if (err) {
                    console.error('Error saving result:', err);
                    reject(err);
                } else {
                    console.log(`💾 Result saved: ${result.id} -> ${result.group_name}`);
                    setTimeout(() => resolve(result), 100);
                }
            }
        );
    });
}

async function collectData() {
    if (isCollecting) return;
    isCollecting = true;
    
    try {
        const response = await axios.get('https://api-cs.casino.org/svc-evolution-game-events/api/lightningdice/latest', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            },
            timeout: 10000
        });
        
        if (response.data && response.data.data) {
            const game = response.data.data;
            const gameId = game.id;
            
            if (lastGameId !== gameId) {
                lastGameId = gameId;
                
                const exists = await new Promise((resolve) => {
                    db.get(`SELECT id FROM results WHERE id = ?`, [gameId], (err, row) => {
                        resolve(!!row);
                    });
                });
                
                if (!exists) {
                    console.log(`🆕 New game detected: ${gameId}`);
                    
                    const last3Results = await getLast3Results();
                    console.log(`📜 Last 3 results for prediction: ${last3Results ? last3Results.join(' → ') : 'not enough data'}`);
                    
                    let predictionData = null;
                    
                    if (last3Results && last3Results.length >= 3) {
                        pendingPredictions.add(gameId);
                        console.log(`🔮 Saving prediction FIRST for ${gameId}...`);
                        predictionData = await savePredictionOnly(gameId, last3Results);
                        if (predictionData) {
                            broadcast({ type: 'prediction_pending', data: { result_id: gameId } });
                            console.log(`✅ Prediction SAVED before result for ${gameId}`);
                        } else {
                            console.log(`⚠️ No valid prediction saved for ${gameId} (WAITING mode)`);
                        }
                    } else {
                        console.log(`⚠️ Cannot save prediction: need 3+ history, got ${last3Results?.length || 0}`);
                    }
                    
                    const savedResult = await saveGameResult(game);
                    
                    const totalResult = game.result.total;
                    const group = getGroup(totalResult);
                    
                    if (predictionData) {
                        await updatePredictionWithResult(gameId, group);
                    }
                    
                    pendingPredictions.delete(gameId);
                    
                    const currentPrediction = await getCurrentPredictionData();
                    await broadcastFullDataOnNewResult(savedResult, currentPrediction);
                    
                    console.log(`✅ Complete flow done for game: ${gameId}`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Data collection error:', error.message);
    }
    
    isCollecting = false;
}

async function checkDatabaseOnStartup() {
    console.log('\n🔍 STARTUP DATABASE CHECK:');
    const resultCount = await new Promise((resolve) => {
        db.get(`SELECT COUNT(*) as count FROM results`, (err, row) => {
            resolve(row ? row.count : 0);
        });
    });
    console.log(`   📊 Total results in database: ${resultCount}`);
    
    if (resultCount > 0) {
        const lastResults = await new Promise((resolve) => {
            db.all(`SELECT group_name, timestamp FROM results ORDER BY timestamp DESC LIMIT 5`, (err, rows) => {
                resolve(rows || []);
            });
        });
        console.log(`   🎲 Last 5 results:`, lastResults.map(r => r.group_name).join(' → '));
        
        const last3 = lastResults.slice(0, 3).map(r => r.group_name);
        console.log(`   📐 Last 3-step pattern: ${last3.join(' → ')}`);
        
        if (serverAI) {
            const patternString = `${last3[0]}→${last3[1]}→${last3[2]}`;
            const isMatch = serverAI.isPatternMatch(patternString);
            console.log(`   🔍 Pattern "${patternString}" - ${isMatch ? 'MATCHES ✓' : 'DOES NOT MATCH (WAIT MODE) ✗'}`);
        }
    }
    console.log('');
}

// ============ API ENDPOINTS ============

app.get('/api/all-data', async (req, res) => {
    try {
        const [results, predictions, stats, aiStats, currentPrediction] = await Promise.all([
            getResultsData(100),
            getPredictionsData(500),
            getStatsData(),
            getAIStatsData(),
            getCurrentPredictionData()
        ]);
        
        results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Add dynamic values to response
        let enhancedPrediction = { ...currentPrediction };
        if (serverAI) {
            const dynamicVals = serverAI.getDynamicValues();
            enhancedPrediction.dynamicContinueValue = dynamicVals.continueValue;
            enhancedPrediction.dynamicSwitchValue = dynamicVals.switchValue;
            enhancedPrediction.isPredictionModeActive = serverAI.isActive();
            enhancedPrediction.activeModel = dynamicVals.activeModel;
            enhancedPrediction.userPreference = dynamicVals.userPreference;
            enhancedPrediction.continueModelActive = dynamicVals.continueModelActive;
            enhancedPrediction.switchModelActive = dynamicVals.switchModelActive;
            
            const bothPredictions = serverAI.getBothPredictions();
            enhancedPrediction.continueModelPrediction = bothPredictions.continue.value;
            enhancedPrediction.switchModelPrediction = bothPredictions.switch.value;
            
            const modelsStatus = serverAI.getModelsStatus();
            enhancedPrediction.modelsStatus = modelsStatus;
        }
        
        res.json({
            success: true,
            results: results,
            predictions: predictions,
            stats: stats,
            aiStats: aiStats,
            currentPrediction: enhancedPrediction,
            aiDynamicValues: serverAI ? serverAI.getDynamicValues() : null,
            modelsStatus: serverAI ? serverAI.getModelsStatus() : null
        });
    } catch (error) {
        console.error('Error loading all data:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/predictions', (req, res) => {
    const limit = parseInt(req.query.limit) || 500;
    
    db.all(`SELECT p.*, r.total, r.dice_values, r.timestamp as result_time
            FROM predictions p
            LEFT JOIN results r ON p.result_id = r.id
            WHERE p.predicted_group IS NOT NULL 
              AND p.predicted_group != 'WAITING'
              AND p.predicted_group != '--'
              AND p.pattern_3step IS NOT NULL
              AND p.pattern_3step != '--'
            ORDER BY p.prediction_timestamp DESC LIMIT ?`, [limit], (err, predictions) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        const transformed = predictions.map(p => ({
            result_id: p.result_id,
            total: p.total || null,
            actual_group: p.actual_group || null,
            dice_values: p.dice_values || null,
            result_time: p.result_time || null,
            pattern_3step: p.pattern_3step,
            protection_type: p.protection_type,
            predicted_group: p.predicted_group,
            is_correct: p.is_correct,
            is_retry: p.is_retry === 1,
            retry_number: p.retry_number || 0,
            continue_value: p.continue_value,
            switch_value: p.switch_value,
            active_model: p.active_model,
            user_preference: p.user_preference,
            prediction_timestamp: p.prediction_timestamp,
            is_pending: p.actual_group === null
        }));
        
        res.json(transformed);
    });
});

app.get('/api/results', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    
    db.all(`SELECT * FROM results ORDER BY timestamp DESC LIMIT ? OFFSET ?`, [limit, offset], (err, results) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        db.get(`SELECT COUNT(*) as total FROM results`, (err, count) => {
            res.json({
                data: results,
                pagination: {
                    page: page,
                    limit: limit,
                    total: count ? count.total : 0,
                    pages: Math.ceil((count ? count.total : 0) / limit)
                }
            });
        });
    });
});

app.get('/api/stats', (req, res) => {
    db.get(`SELECT 
                COUNT(*) as total_rounds,
                AVG(total) as avg_result,
                (SELECT group_name FROM results GROUP BY group_name ORDER BY COUNT(*) DESC LIMIT 1) as most_active_group
            FROM results`, (err, stats) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        db.get(`SELECT COUNT(*) as lightning_count FROM results WHERE multiplier > 10`, (err, lightning) => {
            db.get(`SELECT COUNT(*) as total FROM results`, (err, total) => {
                const lightningPercent = total && total.total > 0 ? (lightning.lightning_count / total.total) * 100 : 0;
                res.json({
                    totalRounds: stats ? stats.total_rounds : 0,
                    avgResult: stats ? stats.avg_result.toFixed(2) : 0,
                    mostActiveGroup: stats ? stats.most_active_group : 'LOW',
                    lightningBoost: Math.round(lightningPercent)
                });
            });
        });
    });
});

app.get('/api/ai-stats', (req, res) => {
    db.get(`SELECT total_predictions, correct_predictions, accuracy FROM ai_stats ORDER BY id DESC LIMIT 1`, (err, stats) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(stats || { total_predictions: 0, correct_predictions: 0, accuracy: 0 });
    });
});

app.get('/api/current-prediction', async (req, res) => {
    const prediction = await getCurrentPredictionData();
    
    // Add dynamic values if AI is active
    let enhancedPrediction = { ...prediction };
    if (serverAI) {
        const dynamicVals = serverAI.getDynamicValues();
        enhancedPrediction.dynamicContinueValue = dynamicVals.continueValue;
        enhancedPrediction.dynamicSwitchValue = dynamicVals.switchValue;
        enhancedPrediction.isPredictionModeActive = serverAI.isActive();
        enhancedPrediction.activeModel = dynamicVals.activeModel;
        enhancedPrediction.userPreference = dynamicVals.userPreference;
        enhancedPrediction.continueModelActive = dynamicVals.continueModelActive;
        enhancedPrediction.switchModelActive = dynamicVals.switchModelActive;
        
        const bothPredictions = serverAI.getBothPredictions();
        enhancedPrediction.continueModelPrediction = bothPredictions.continue.value;
        enhancedPrediction.switchModelPrediction = bothPredictions.switch.value;
        
        const modelsStatus = serverAI.getModelsStatus();
        enhancedPrediction.modelsStatus = modelsStatus;
    }
    
    res.json({
        success: true,
        prediction: enhancedPrediction
    });
});

app.get('/api/ai-dynamic-values', (req, res) => {
    if (serverAI) {
        res.json({
            success: true,
            isActive: serverAI.isActive(),
            dynamicValues: serverAI.getDynamicValues(),
            activePatternInfo: serverAI.getActivePatternInfo(),
            modelsStatus: serverAI.getModelsStatus(),
            bothPredictions: serverAI.getBothPredictions(),
            selectorStats: serverAI.getSelectorStats()
        });
    } else {
        res.json({
            success: false,
            message: "AI not initialized"
        });
    }
});

app.get('/api/user-preference', async (req, res) => {
    try {
        const row = await new Promise((resolve) => {
            db.get(`SELECT preference FROM user_settings WHERE id = 1`, (err, row) => {
                resolve(row);
            });
        });
        res.json({
            success: true,
            preference: row ? row.preference : 'AUTO'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/user-preference', express.json(), async (req, res) => {
    try {
        const { preference } = req.body;
        if (!preference || !['AUTO', 'CONTINUE', 'SWITCH'].includes(preference)) {
            return res.status(400).json({ success: false, error: 'Invalid preference. Must be AUTO, CONTINUE, or SWITCH' });
        }
        
        await saveUserPreference(preference);
        if (serverAI) {
            serverAI.setUserPreference(preference);
        }
        
        res.json({
            success: true,
            preference: preference,
            message: `User preference updated to ${preference}`
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/models-status', (req, res) => {
    if (serverAI) {
        res.json({
            success: true,
            modelsStatus: serverAI.getModelsStatus(),
            bothPredictions: serverAI.getBothPredictions(),
            selectorStats: serverAI.getSelectorStats()
        });
    } else {
        res.json({
            success: false,
            message: "AI not initialized"
        });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        version: '11.0',
        timestamp: new Date().toISOString(),
        clients: clients.size,
        uptime: process.uptime(),
        aiReady: serverAI !== null,
        aiActive: serverAI ? serverAI.isActive() : false,
        telegramActive: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
        userPreference: serverAI ? serverAI.getUserPreference() : 'AUTO'
    });
});

app.get('/api/diagnostic', async (req, res) => {
    try {
        const resultsCount = await new Promise((resolve) => {
            db.get(`SELECT COUNT(*) as count FROM results`, (err, row) => {
                resolve(row ? row.count : 0);
            });
        });
        
        const predictionsCount = await new Promise((resolve) => {
            db.get(`SELECT COUNT(*) as count FROM predictions WHERE predicted_group IS NOT NULL AND predicted_group != 'WAITING'`, (err, row) => {
                resolve(row ? row.count : 0);
            });
        });
        
        const lastResults = await new Promise((resolve) => {
            db.all(`SELECT id, total, group_name, timestamp FROM results ORDER BY timestamp DESC LIMIT 10`, (err, rows) => {
                resolve(rows || []);
            });
        });
        
        const last3Pattern = lastResults.slice(0, 3).map(r => r.group_name);
        const patternString = last3Pattern.length === 3 ? `${last3Pattern[0]}→${last3Pattern[1]}→${last3Pattern[2]}` : null;
        const isPatternMatch = serverAI && patternString ? serverAI.isPatternMatch(patternString) : false;
        
        res.json({
            success: true,
            version: '11.0',
            database: {
                path: dbPath,
                exists: fs.existsSync(dbPath)
            },
            counts: {
                results: resultsCount,
                validPredictions: predictionsCount
            },
            last10Results: lastResults,
            last3StepPattern: last3Pattern,
            patternMatch: isPatternMatch,
            aiStatus: serverAI ? `initialized (${serverAI.version})` : 'not initialized',
            aiAccuracy: serverAI ? serverAI.getAccuracy() : 0,
            aiActive: serverAI ? serverAI.isActive() : false,
            aiDynamicValues: serverAI ? serverAI.getDynamicValues() : null,
            modelsStatus: serverAI ? serverAI.getModelsStatus() : null,
            userPreference: serverAI ? serverAI.getUserPreference() : 'AUTO',
            telegram: {
                configured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
                onlyValidPredictions: true
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start background data collection
setInterval(collectData, 3000);
collectData();

console.log('📊 Background data collection started (every 3 seconds)');
console.log('🤖 Dual Model 3-Step Pattern AI v11.0 active - 6 patterns loaded');
console.log('🔌 WebSocket server ready for real-time updates');
console.log('📱 Telegram: ONLY sends for VALID predictions (WAITING mode is ignored)');
console.log('📈 v11.0 Features:');
console.log('   - 3-Step Pattern Detection (TRIGGER only)');
console.log('   - 🔵 CONTINUE Model = Last Result (updates dynamically)');
console.log('   - 🟡 SWITCH Model = Previous Result (updates dynamically)');
console.log('   - 🎯 Selector Model learns which model works best');
console.log('   - 👤 User can choose: CONTINUE only, SWITCH only, or AUTO');
console.log('   - Retry with same model until CORRECT');
console.log('   - Real-Time Learning');
console.log('✅ FIXED: WAITING predictions are NOT saved to database and NOT sent to Telegram');

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, saving AI state and closing gracefully...');
    await saveAIState();
    server.close(() => {
        console.log('Server closed');
        db.close(() => {
            console.log('Database connection closed');
            process.exit(0);
        });
    });
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, saving AI state and closing gracefully...');
    await saveAIState();
    server.close(() => {
        console.log('Server closed');
        db.close(() => {
            console.log('Database connection closed');
            process.exit(0);
        });
    });
});
