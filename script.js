/**
 * @file script.js
 * @description Entry point for Vertical Odyssey. Imports modules, sets up the canvas,
 * and initializes the main game logic.
 */

// Import all necessary modules and classes
import * as Game from './js/game.js';
import { Climber } from './js/climber.js';
import { Grip } from './js/grip.js';
import { Protection } from './js/protection.js';
import Rockface from './js/rockface.js';
import * as UI from './js/ui.js';
import * as Audio from './js/audio.js';
import * as Input from './js/input.js';
import * as Constants from './js/constants.js';

// Utility for canvas setup with DPR scaling
function setupCanvas(canvasElement) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvasElement.getBoundingClientRect();
    canvasElement.width = rect.width * dpr;
    canvasElement.height = rect.height * dpr;
    const context = canvasElement.getContext('2d');
    context.scale(dpr, dpr);
    Constants.updateDynamicCanvasDimensions(rect.width, rect.height);
    return context; // Though context isn't directly used by script.js anymore, game.js might need it from canvas.
}

// DOM Element IDs Configuration
const uiElementIds = {
    scoreDisplayId: 'score',
    inGameHighScoreId: 'in-game-high-score',
    staminaDisplayId: 'pump', 
    protectionCountId: 'protection-count',
    currentHeightId: 'current-height',
    messageDisplayId: 'message',
    debugInfoPanelId: 'debug-info', 
    startScreenId: 'start-screen', 
    gameContainerId: 'game-container',
    gameOverScreenId: 'game-over-screen', 
    gameWonScreenId: 'game-won-screen',
    instructionsScreenId: 'instructions-screen', 
    unsupportedFeaturesScreenId: 'unsupported-features-screen', 
    startButtonId: 'start-button', 
    restartButtonId: 'restart-button', 
    startGameFullscreenButtonId: 'start-game-fullscreen', 
    restartButtonWinId: 'restart-button-win',
    finalScoreId: 'final-score', 
    highScoreGameOverId: 'high-score-game-over',
    finalScoreWinId: 'final-score-win',
    highScoreWinId: 'high-score-win',
    instructionsButtonId: 'instructions-button', 
    closeInstructionsButtonId: 'close-instructions-button', 
    debugButtonId: 'debug-button', 
    pauseButtonId: 'pause-bg-button' 
};

// Initialize Game on Load
window.addEventListener('load', () => {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) {
        console.error('CASCADE_ERROR: gameCanvas not found!');
        UI.displayUnsupportedFeaturesMessage(['Game Canvas element missing.']); // Use UI module if available
        return;
    }
    setupCanvas(canvas); 

    console.log(`CASCADE_SCRIPT_LOG: Vertical Odyssey Version ${Constants.GAME_VERSION || 'Unknown'} loading via script.js entry point.`);

    // Bundle all modules and classes to pass to the game initializer
    const gameModules = {
        UI,
        Audio,
        Input,
        Constants,
        Climber,
        Grip,
        Protection,
        Rockface
    };

    // Initialize the core game logic
    // The 'true' argument indicates to show instructions on the first load.
    Game.initCoreGame(canvas, gameModules, uiElementIds, true); 
});
