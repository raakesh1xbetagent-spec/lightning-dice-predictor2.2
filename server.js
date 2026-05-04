// ============================================================
// server.js (v11.3 - Independent Dual Model + Simple Telegram Messages)
// Features: 3-Step Pattern Detection | Independent CONTINUE & SWITCH Models
// Telegram: Simple, clean messages for both bots
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

// ============ SIMPLE TELEGRAM MESSAGE FORMATS ============

// CONTINUE Model - Simple Message Formats
function formatContinueTriggerMessage(patternString, predictedGroup) {
    return `✅ Pattern: ${patternString}\n🎯 Next: ${predictedGroup}`;
}

function formatContinueWrongMessage(predictedGroup, actualGroup, retryCount) {
    return `❌ Wrong! Next: ${actualGroup} (Retry #${retryCount})`;
}

function formatContinueCorrectMessage(predictedGroup, actualGroup) {
    return `✅ Correct! ${predictedGroup} was right.`;
}

function formatContinueSubPatternMessage(currentPattern, subPattern) {
    return `🔍 Sub: ${subPattern}\n📍 Under: ${currentPattern}`;
}

// SWITCH Model - Simple Message Formats
function formatSwitchTriggerMessage(patternString, predictedGroup) {
    return `✅ Pattern: ${patternString}\n🎯 Next: ${predictedGroup}`;
}

function formatSwitchWrongMessage(predictedGroup, actualGroup, retryCount) {
    return `❌ Wrong! Next: ${actualGroup} (Retry #${retryCount})`;
}

function formatSwitchCorrectMessage(predictedGroup, actualGroup) {
    return `✅ Correct! ${predictedGroup} was right.`;
}

function formatSwitchSubPatternMessage(currentPattern, subPattern) {
    return `🔍 Sub: ${subPattern}\n📍 Under: ${currentPattern}`;
}

// Store last message IDs for editing
let continueLastMessageId = null;
let switchLastMessageId = null;
let continueLastChatId = null;
let switchLastChatId = null;

// Helper to send or edit message
async function sendOrEditTelegramMessage(botToken, chatId, message, isContinue = true) {
    if (!botToken || !chatId) return null;
    
    const lastMessageId = isContinue ? continueLastMessageId : switchLastMessageId;
    const lastChatId = isContinue ? continueLastChatId : switchLastChatId;
    
    try {
        const url = `https://api.telegram.org/bot${botToken}/`;
        
        if (lastMessageId && lastChatId === chatId) {
            await axios.post(`${url}editMessageText`, {
                chat_id: chatId,
                message_id: lastMessageId,
                text: message,
                parse_mode: 'HTML'
            });
            console.log(`📱 ${isContinue ? 'CONTINUE' : 'SWITCH'} Bot: Message EDITED`);
            return lastMessageId;
        } else {
            const response = await axios.post(`${url}sendMessage`, {
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML'
            });
            const newMessageId = response.data.result.message_id;
            console.log(`📱 ${isContinue ? 'CONTINUE' : 'SWITCH'} Bot: New message SENT`);
            
            if (isContinue) {
                continueLastMessageId = newMessageId;
                continueLastChatId = chatId;
            } else {
                switchLastMessageId = newMessageId;
                switchLastChatId = chatId;
            }
            return newMessageId;
        }
    } catch (error) {
        if (error.response?.status === 400) {
            try {
                const response = await axios.post(`${url}sendMessage`, {
                    chat_id: chatId,
                    text: message,
                    parse_mode: 'HTML'
                });
                const newMessageId = response.data.result.message_id;
                if (isContinue) {
                    continueLastMessageId = newMessageId;
                    continueLastChatId = chatId;
                } else {
                    switchLastMessageId = newMessageId;
                    switchLastChatId = chatId;
                }
                return newMessageId;
            } catch (e) {
                console.error(`❌ ${isContinue ? 'CONTINUE' : 'SWITCH'} Bot send error:`, e.message);
            }
        } else {
            console.error(`❌ ${isContinue ? 'CONTINUE' : 'SWITCH'} Bot error:`, error.message);
        }
        return null;
    }
}

// Send pattern trigger notification
async function sendPatternTriggerNotification(patternString, predictedGroup, activeModel) {
    console.log(`🎯 Sending pattern trigger notification for pattern: ${patternString} using ${activeModel}`);
    
    if (activeModel === 'CONTINUE') {
        const message = formatContinueTriggerMessage(patternString, predictedGroup);
        await sendOrEditTelegramMessage(
            process.env.CONTINUE_BOT_TOKEN,
            process.env.CONTINUE_CHAT_ID,
            message,
            true
        );
    } else {
        const message = formatSwitchTriggerMessage(patternString, predictedGroup);
        await sendOrEditTelegramMessage(
            process.env.SWITCH_BOT_TOKEN,
            process.env.SWITCH_CHAT_ID,
            message,
            false
        );
    }
}

// Send sub-pattern notification
async function sendSubPatternNotification(currentPattern, subPattern, activeModel) {
    console.log(`🔍 Sending sub-pattern notification: ${subPattern}`);
    
    if (activeModel === 'CONTINUE') {
        const message = formatContinueSubPatternMessage(currentPattern, subPattern);
        await sendOrEditTelegramMessage(
            process.env.CONTINUE_BOT_TOKEN,
            process.env.CONTINUE_CHAT_ID,
            message,
            true
        );
    } else {
        const message = formatSwitchSubPatternMessage(currentPattern, subPattern);
        await sendOrEditTelegramMessage(
            process.env.SWITCH_BOT_TOKEN,
            process.env.SWITCH_CHAT_ID,
            message,
            false
        );
    }
}

// Send wrong prediction notification
async function sendWrongNotification(modelUsed, predictedGroup, actualGroup, retryCount) {
    if (modelUsed === 'CONTINUE') {
        const message = formatContinueWrongMessage(predictedGroup, actualGroup, retryCount);
        await sendOrEditTelegramMessage(
            process.env.CONTINUE_BOT_TOKEN,
            process.env.CONTINUE_CHAT_ID,
            message,
            true
        );
    } else {
        const message = formatSwitchWrongMessage(predictedGroup, actualGroup, retryCount);
        await sendOrEditTelegramMessage(
            process.env.SWITCH_BOT_TOKEN,
            process.env.SWITCH_CHAT_ID,
            message,
            false
        );
    }
}

// Send correct prediction notification
async function sendCorrectNotification(modelUsed, predictedGroup, actualGroup) {
    if (modelUsed === 'CONTINUE') {
        const message = formatContinueCorrectMessage(predictedGroup, actualGroup);
        await sendOrEditTelegramMessage(
            process.env.CONTINUE_BOT_TOKEN,
            process.env.CONTINUE_CHAT_ID,
            message,
            true
        );
    } else {
        const message = formatSwitchCorrectMessage(predictedGroup, actualGroup);
        await sendOrEditTelegramMessage(
            process.env.SWITCH_BOT_TOKEN,
            process.env.SWITCH_CHAT_ID,
            message,
            false
        );
    }
}

// ============ DATABASE SETUP ============
const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log('📁 Created data directory:', dbDir);
}

const dbPath = path.join(dbDir, 'lightning_dice.db');
console.log('📂 Database path:', dbPath);
const db = new sqlite3.Database(dbPath);

// Create tables (UPDATED for v11.3 - with both model predictions)
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
        user_preference TEXT,
        sub_pattern_detected TEXT,
        continue_prediction TEXT,
        switch_prediction TEXT
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
    
    db.run(`CREATE TABLE IF NOT EXISTS sub_pattern_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        current_pattern TEXT,
        sub_pattern TEXT,
        description TEXT,
        detected_at DATETIME
    )`);
    
    // Add new columns if not exist
    db.run(`ALTER TABLE predictions ADD COLUMN continue_prediction TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column')) {}
    });
    db.run(`ALTER TABLE predictions ADD COLUMN switch_prediction TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column')) {}
    });
    
    db.run(`INSERT OR IGNORE INTO user_settings (id, preference, updated_at) VALUES (1, 'AUTO', datetime('now'))`);
    
    console.log('✅ Database tables created/verified (v11.3 ready)');
});

// ============ AI MODEL INITIALIZATION ============
let serverAI = null;
let lastSubPatternNotification = null;
let lastPatternTriggerNotification = null;

async function initNewAI() {
    console.log('🤖 Initializing Independent Dual Model 3-Step Pattern AI (v11.3)...');
    serverAI = new NewPatternAI();
    
    // Register sub-pattern callback
    serverAI.setSubPatternCallback(async (subPatternData) => {
        console.log(`🔍 Sub-pattern callback triggered:`, subPatternData);
        
        const now = Date.now();
        if (lastSubPatternNotification && (now - lastSubPatternNotification) < 10000) {
            console.log(`⏱️ Skipping duplicate sub-pattern notification (within 10s)`);
            return;
        }
        lastSubPatternNotification = now;
        
        if (subPatternData.currentPattern && subPatternData.subPattern) {
            await sendSubPatternNotification(
                subPatternData.currentPattern,
                subPatternData.subPattern,
                subPatternData.activeModel || 'CONTINUE'
            );
            
            db.run(`INSERT INTO sub_pattern_log (current_pattern, sub_pattern, description, detected_at) VALUES (?, ?, ?, ?)`,
                [subPatternData.currentPattern, subPatternData.subPattern, subPatternData.description, new Date().toISOString()],
                (err) => {
                    if (err) console.error('Error saving sub-pattern log:', err);
                    else console.log(`💾 Sub-pattern saved to database`);
                }
            );
            
            broadcast({
                type: 'sub_pattern_detected',
                data: {
                    currentPattern: subPatternData.currentPattern,
                    subPattern: subPatternData.subPattern,
                    description: subPatternData.description,
                    timestamp: subPatternData.timestamp,
                    continueModelValue: subPatternData.continueModelValue,
                    switchModelValue: subPatternData.switchModelValue,
                    activeModel: subPatternData.activeModel
                }
            });
        }
    });
    
    try {
        const userPref = await new Promise((resolve) => {
            db.get(`SELECT preference FROM user_settings WHERE id = 1`, (err, row) => {
                resolve(row ? row.preference : 'AUTO');
            });
        });
        serverAI.setUserPreference(userPref);
        console.log(`👤 User preference loaded: ${userPref}`);
        
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
    
    console.log(`✅ AI ready - Independent Dual Model 3-Step Pattern AI v11.3`);
    console.log(`📋 INDEPENDENT DUAL MODEL SYSTEM (v11.3):`);
    console.log(`   🔵 CONTINUE Model: Always predicts LAST result (INDEPENDENT)`);
    console.log(`   🟡 SWITCH Model: Always predicts PREVIOUS result (INDEPENDENT)`);
    console.log(`   ✨ Models do NOT affect each other!`);
    console.log(`📱 Telegram: Simple, clean messages`);
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
    console.log(`\n⚡ Lightning Dice Predictor v11.3 - Independent Dual Model AI`);
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
                    subPatternDetected: p.sub_pattern_detected,
                    continuePrediction: p.continue_prediction,
                    switchPrediction: p.switch_prediction,
                    timestamp: new Date(p.prediction_timestamp),
                    isPending: p.actual_group === null
                }));
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
                if (results && results.length > 0) {
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
        const bothPredictions = serverAI.getBothPredictions();
        
        if (prediction.status === "PREDICTION_READY" && prediction.pattern) {
            const now = Date.now();
            if (!lastPatternTriggerNotification || (now - lastPatternTriggerNotification) > 5000) {
                lastPatternTriggerNotification = now;
                
                await sendPatternTriggerNotification(
                    prediction.pattern,
                    prediction.predictedGroup,
                    prediction.activeModel
                );
            }
        }
        
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
            bothPredictions: bothPredictions,
            subPatternDetected: prediction.subPatternDetected || null
        };
    }
    
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
    
    if (prediction.status === "WAITING" || prediction.predictedGroup === 'WAITING' || prediction.predictedGroup === null) {
        console.log(`⚠️ NOT saving prediction for ${resultId} - AI is in WAITING mode (no valid prediction)`);
        return null;
    }
    
    let continueValue = null;
    let switchValue = null;
    let activeModel = null;
    let userPreference = null;
    let subPatternDetected = null;
    let continuePrediction = null;
    let switchPrediction = null;
    
    if (serverAI) {
        const dynamicVals = serverAI.getDynamicValues();
        continueValue = dynamicVals.continueValue;
        switchValue = dynamicVals.switchValue;
        activeModel = dynamicVals.activeModel;
        userPreference = dynamicVals.userPreference;
        subPatternDetected = dynamicVals.subPatternDetected || null;
        continuePrediction = dynamicVals.continuePrediction;
        switchPrediction = dynamicVals.switchPrediction;
    }
    
    console.log(`\n📝 SAVING PREDICTION for ${resultId}:`);
    console.log(`   Pattern: ${prediction.pattern3step || 'N/A'}`);
    console.log(`   Active Model: ${activeModel || prediction.protectionType || 'N/A'}`);
    console.log(`   FINAL Prediction: ${prediction.predictedGroup || 'N/A'}`);
    console.log(`   🔵 CONTINUE predicts: ${continuePrediction || '--'}`);
    console.log(`   🟡 SWITCH predicts: ${switchPrediction || '--'}`);
    
    const existing = await new Promise((resolve) => {
        db.get(`SELECT id FROM predictions WHERE result_id = ?`, [resultId], (err, row) => {
            resolve(row);
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
                    user_preference = ?,
                    sub_pattern_detected = ?,
                    continue_prediction = ?,
                    switch_prediction = ?
                    WHERE result_id = ?`,
                [prediction.pattern3step, modelToSave, prediction.predictedGroup, new Date().toISOString(), 
                 isRetry, retryNumber, continueValue, switchValue, modelToSave, prefToSave, subPatternDetected,
                 continuePrediction, switchPrediction, resultId],
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
                    result_id, pattern_3step, protection_type, predicted_group, prediction_timestamp,
                    is_correct, is_retry, retry_number, continue_value, switch_value, active_model, 
                    user_preference, sub_pattern_detected, continue_prediction, switch_prediction
                ) VALUES (?, ?, ?, ?, ?, -1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
            
            stmt.run([resultId, prediction.pattern3step, modelToSave, prediction.predictedGroup, new Date().toISOString(),
                      isRetry, retryNumber, continueValue, switchValue, modelToSave, prefToSave, 
                      subPatternDetected, continuePrediction, switchPrediction], (err) => {
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
        db.get(`SELECT predicted_group, pattern_3step, protection_type, is_retry, retry_number, active_model, sub_pattern_detected, continue_prediction, switch_prediction FROM predictions WHERE result_id = ?`, [resultId], (err, row) => {
            resolve(row);
        });
    });
    
    if (!prediction) {
        console.log(`⚠️ No prediction found for ${resultId}, cannot update`);
        return null;
    }
    
    const isCorrect = (prediction.predicted_group === actualGroup) ? 1 : 0;
    const retryCount = prediction.retry_number || 0;
    const modelUsed = prediction.active_model || prediction.protection_type || 'CONTINUE';
    
    console.log(`   FINAL Predicted: ${prediction.predicted_group} → ${isCorrect ? '✓ CORRECT' : '✗ WRONG'}`);
    console.log(`   Model Used: ${modelUsed}`);
    
    let continueCorrect = null;
    let switchCorrect = null;
    let newContinuePrediction = null;
    let newSwitchPrediction = null;
    
    if (serverAI) {
        const updateResult = serverAI.updateWithResult(actualGroup);
        console.log(`   AI Accuracy updated: ${serverAI.getAccuracy().toFixed(1)}%`);
        
        const modelsStatus = serverAI.getModelsStatus();
        console.log(`   Models Status - CONTINUE: ${modelsStatus.continue.isActive ? 'ACTIVE' : 'INACTIVE'}, SWITCH: ${modelsStatus.switch.isActive ? 'ACTIVE' : 'INACTIVE'}`);
        
        continueCorrect = updateResult.continueCorrect;
        switchCorrect = updateResult.switchCorrect;
        newContinuePrediction = updateResult.continuePrediction;
        newSwitchPrediction = updateResult.switchPrediction;
    }
    
    // Send simple notification
    if (isCorrect === 1) {
        await sendCorrectNotification(modelUsed, prediction.predicted_group, actualGroup);
    } else {
        await sendWrongNotification(modelUsed, prediction.predicted_group, actualGroup, retryCount + 1);
    }
    
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
    
    let enhancedPredictionData = { ...predictionData };
    if (serverAI) {
        const dynamicVals = serverAI.getDynamicValues();
        enhancedPredictionData.dynamicContinueValue = dynamicVals.continueValue;
        enhancedPredictionData.dynamicSwitchValue = dynamicVals.switchValue;
        enhancedPredictionData.isPredictionModeActive = serverAI.isActive();
        enhancedPredictionData.activeModel = dynamicVals.activeModel;
        enhancedPredictionData.userPreference = dynamicVals.userPreference;
        enhancedPredictionData.subPatternDetected = dynamicVals.subPatternDetected || null;
        
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

// ============ GAME DATA COLLECTION ============
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
                    console.log(`📜 Last 3 results: ${last3Results ? last3Results.join(' → ') : 'not enough data'}`);
                    
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
                    const group = getGroup(game.result.total);
                    
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
        
        let enhancedPrediction = { ...currentPrediction };
        if (serverAI) {
            const dynamicVals = serverAI.getDynamicValues();
            enhancedPrediction.dynamicContinueValue = dynamicVals.continueValue;
            enhancedPrediction.dynamicSwitchValue = dynamicVals.switchValue;
            enhancedPrediction.isPredictionModeActive = serverAI.isActive();
            enhancedPrediction.activeModel = dynamicVals.activeModel;
            enhancedPrediction.userPreference = dynamicVals.userPreference;
            enhancedPrediction.subPatternDetected = dynamicVals.subPatternDetected || null;
            
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

// Keep all other existing API endpoints (they work the same)

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
            sub_pattern_detected: p.sub_pattern_detected,
            continue_prediction: p.continue_prediction,
            switch_prediction: p.switch_prediction,
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
    
    let enhancedPrediction = { ...prediction };
    if (serverAI) {
        const dynamicVals = serverAI.getDynamicValues();
        enhancedPrediction.dynamicContinueValue = dynamicVals.continueValue;
        enhancedPrediction.dynamicSwitchValue = dynamicVals.switchValue;
        enhancedPrediction.isPredictionModeActive = serverAI.isActive();
        enhancedPrediction.activeModel = dynamicVals.activeModel;
        enhancedPrediction.userPreference = dynamicVals.userPreference;
        enhancedPrediction.subPatternDetected = dynamicVals.subPatternDetected || null;
        
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

app.get('/api/sub-pattern-history', (req, res) => {
    db.all(`SELECT * FROM sub_pattern_log ORDER BY detected_at DESC LIMIT 50`, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows || []);
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
        version: '11.3',
        timestamp: new Date().toISOString(),
        clients: clients.size,
        uptime: process.uptime(),
        aiReady: serverAI !== null,
        aiActive: serverAI ? serverAI.isActive() : false,
        continueTelegramActive: !!(process.env.CONTINUE_BOT_TOKEN && process.env.CONTINUE_CHAT_ID),
        switchTelegramActive: !!(process.env.SWITCH_BOT_TOKEN && process.env.SWITCH_CHAT_ID),
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
        
        const subPatternCount = await new Promise((resolve) => {
            db.get(`SELECT COUNT(*) as count FROM sub_pattern_log`, (err, row) => {
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
            version: '11.3',
            database: {
                path: dbPath,
                exists: fs.existsSync(dbPath)
            },
            counts: {
                results: resultsCount,
                validPredictions: predictionsCount,
                subPatternDetections: subPatternCount
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
                continueBot: !!(process.env.CONTINUE_BOT_TOKEN && process.env.CONTINUE_CHAT_ID),
                switchBot: !!(process.env.SWITCH_BOT_TOKEN && process.env.SWITCH_CHAT_ID),
                simpleMessages: true
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
console.log('🤖 Independent Dual Model 3-Step Pattern AI v11.3 active');
console.log('🔌 WebSocket server ready for real-time updates');
console.log('📱 Telegram: Simple, clean messages for both bots');
console.log('✨ Models are INDEPENDENT - they do NOT affect each other!');

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
