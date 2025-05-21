/**
 * @file ui.js
 * @description Manages all UI elements, interactions, and updates for the game.
 */

import { MAX_PUMP, PUMP_STARTING_LEVEL } from './constants.js'; // Import PUMP constants

// Assumed constants to be imported or passed: GAME_VERSION
// Assumed game state and score variables will be accessed via a shared mechanism or passed as parameters.

let scoreDisplay, highScoreDisplay, inGameHighScoreDisplay, pumpDisplay, protectionDisplay, heightDisplay, debugInfoPanel, debugButton, messageDisplay; // Renamed staminaDisplay to pumpDisplay
let finalScoreDisplay, finalScoreWinDisplay, highScoreGameOverDisplay, highScoreWinDisplay;
let startButton, instructionsButton, restartButton, restartButtonWin, startGameFullscreenButton; // Added startGameFullscreenButton
let gameContainer, startScreen, gameOverScreen, instructionsScreen, gameWonScreen;

let showDebugInfo = false;

/**
 * Initializes UI elements by selecting them from the DOM.
 * @param {object} config - Configuration object containing IDs for UI elements.
 *                          Expected keys: scoreId, inGameHighScoreId, pumpId, protectionCountId, currentHeightId, // Changed staminaId to pumpId
 *                          startScreenId, gameContainerId, gameOverScreenId, instructionsScreenId, gameWonScreenId,
 *                          startButtonId, instructionsButtonId, restartButtonId, restartButtonWinId, debugButtonId,
 *                          finalScoreId, highScoreGameOverId, finalScoreWinId, highScoreWinId, debugInfoPanelId,
 *                          messageDisplayId, startGameFullscreenButtonId // Added startGameFullscreenButtonId
 */
function initUI(config) {
    // Main game container and screens
    gameContainer = document.getElementById(config.gameContainerId);
    startScreen = document.getElementById(config.startScreenId);
    gameOverScreen = document.getElementById(config.gameOverScreenId);
    instructionsScreen = document.getElementById(config.instructionsScreenId);
    gameWonScreen = document.getElementById(config.gameWonScreenId);

    // Scoreboard elements
    scoreDisplay = document.getElementById(config.scoreId);
    inGameHighScoreDisplay = document.getElementById(config.inGameHighScoreId); // For during gameplay
    pumpDisplay = document.getElementById(config.pumpId); // Changed from staminaId
    protectionDisplay = document.getElementById(config.protectionCountId);
    heightDisplay = document.getElementById(config.currentHeightId);

    // End screen score displays
    finalScoreDisplay = document.getElementById(config.finalScoreId); // Game Over
    highScoreGameOverDisplay = document.getElementById(config.highScoreGameOverId); // Game Over
    finalScoreWinDisplay = document.getElementById(config.finalScoreWinId); // Game Won
    highScoreWinDisplay = document.getElementById(config.highScoreWinId); // Game Won

    // Buttons
    startButton = document.getElementById(config.startButtonId);
    console.log(`CASCADE_UI_INIT: Attempting to find startButton with ID '${config.startButtonId}'. Found: ${startButton ? 'YES' : 'NO'}`);
    instructionsButton = document.getElementById(config.instructionsButtonId);
    restartButton = document.getElementById(config.restartButtonId); // Game Over screen
    restartButtonWin = document.getElementById(config.restartButtonWinId); // Game Won screen
    startGameFullscreenButton = document.getElementById(config.startGameFullscreenButtonId); // Initialize new button

    // Debug elements
    debugInfoPanel = document.getElementById(config.debugInfoPanelId);
    debugButton = document.getElementById(config.debugButtonId);

    // Message Display
    messageDisplay = document.getElementById(config.messageDisplayId);

    // Initial UI state setup
    if (gameContainer) gameContainer.classList.add('hidden');
    if (gameOverScreen) gameOverScreen.classList.add('hidden');
    if (instructionsScreen) instructionsScreen.classList.add('hidden');
    if (gameWonScreen) gameWonScreen.classList.add('hidden');
    if (startScreen) startScreen.classList.remove('hidden');

    if (debugInfoPanel && !config.initialDebugState) {
        debugInfoPanel.classList.add('hidden');
    }
    if (debugButton) {
        debugButton.textContent = config.initialDebugState ? 'Hide Debug' : 'Show Debug';
    }

    // Return object with references to elements if needed by game.js for event listeners
    return { startButton, instructionsButton, restartButton, restartButtonWin, debugButton, startGameFullscreenButton }; 
}

/**
 * Updates the displayed score, pump, and messages.
 * @param {number} currentScore - The player's current score.
 * @param {number} currentPump - The climber's current pump level. // Renamed from currentStamina
 * @param {string} messageText - A message to display to the player.
 * @param {object} climberStats - Object with climber's debug info (e.g., x, y, velocityY, state, currentPump, maxPump).
 * @param {object} gameStats - Object with game's debug info (e.g., cameraY, activeGrips).
 * @param {number} currentHeightVal - The current height of the climber.
 * @param {number} protectionCountVal - The number of protections used.
 * @param {number} currentHighScoreVal - The current high score.
 */
function updateUI(currentScore, currentPump, messageText = '', climberStats = {}, gameStats = {}, currentHeightVal, protectionCountVal, currentHighScoreVal) { // Renamed currentStamina to currentPump
    if (scoreDisplay) scoreDisplay.textContent = `Score: ${currentScore}`;
    if (pumpDisplay) {
        pumpDisplay.textContent = `Pump: ${Math.round(currentPump)}`; // Updated text
        // Pump is 0 (good) to MAX_PUMP (bad). Bar should fill up as pump increases.
        // Percentage here represents how 'full' the pump meter is, i.e., how close to MAX_PUMP.
        const pumpPercentage = (currentPump / (climberStats.maxPump || MAX_PUMP)) * 100;
        pumpDisplay.style.width = `${pumpPercentage}%`;

        // Colors: Low pump (good) = green, Medium pump = orange, High pump (bad) = red
        if (pumpPercentage >= 70) { // High pump is dangerous
            pumpDisplay.style.backgroundColor = 'red';
        } else if (pumpPercentage >= 30) { // Medium pump is a caution
            pumpDisplay.style.backgroundColor = 'orange';
        } else { // Low pump is good
            pumpDisplay.style.backgroundColor = 'green';
        }
    }
    if (messageDisplay) messageDisplay.textContent = messageText;

    if (showDebugInfo && debugInfoPanel) {
        debugInfoPanel.innerHTML = 
            `Climber: X:${climberStats.x?.toFixed(1)}, Y:${climberStats.y?.toFixed(1)}, VVel:${climberStats.velocityY?.toFixed(2)}, State:${climberStats.state}<br>
            Grips: ${gameStats.activeGrips || 0}, Protections: ${gameStats.protectionsCount || 0} <br>
            CameraY: ${gameStats.cameraY?.toFixed(1)}, MaxRawY: ${gameStats.maxAchievedRawY?.toFixed(1)} <br>
            Game State: ${gameStats.currentGameState || 'N/A'}`;
    }

    if (heightDisplay) heightDisplay.textContent = `Height: ${currentHeightVal}`;
    if (protectionDisplay) protectionDisplay.textContent = `Protections: ${protectionCountVal}`;
    if (inGameHighScoreDisplay) inGameHighScoreDisplay.textContent = `High Score: ${currentHighScoreVal}`;
}

function showStartScreen({ onStart, onShowInstructions }) {
    console.log(`CASCADE_UI_LOG: showStartScreen called. Received onStart type: ${typeof onStart}, name: ${onStart ? onStart.name : 'undefined'}`);
    if (startScreen) startScreen.classList.remove('hidden');
    if (gameContainer) gameContainer.classList.add('hidden');
    if (gameOverScreen) gameOverScreen.classList.add('hidden');
    if (instructionsScreen) instructionsScreen.classList.add('hidden');
    if (gameWonScreen) gameWonScreen.classList.add('hidden');

    // Remove old listeners before adding new ones to prevent multiple triggers
    if (startButton) {
        console.log(`CASCADE_UI_LOG: Attaching click listener to startButton. Name: ${onStart ? onStart.name : 'undefined'}`);
        startButton.addEventListener('click', () => {
            console.log(`CASCADE_UI_LOG: Start button clicked. Executing onStart callback (expected: startCoreGame).`);
            onStart();
        });
    }
    if (instructionsButton) {
        const newInstructionsButton = instructionsButton.cloneNode(true);
        instructionsButton.parentNode.replaceChild(newInstructionsButton, instructionsButton);
        instructionsButton = newInstructionsButton;
        instructionsButton.addEventListener('click', onShowInstructions);
    }
}

function showInstructionsScreen({ onCloseInstructions, onStartGameFromInstructions }) { // Added onStartGameFromInstructions
    if (instructionsScreen) instructionsScreen.classList.remove('hidden');
    if (startScreen) startScreen.classList.add('hidden');
    // Add event listener for closing instructions, typically any key or a specific button

    if (startGameFullscreenButton && onStartGameFromInstructions) {
        // Clone and replace to ensure fresh listeners
        const newStartGameFullscreenButton = startGameFullscreenButton.cloneNode(true);
        startGameFullscreenButton.parentNode.replaceChild(newStartGameFullscreenButton, startGameFullscreenButton);
        startGameFullscreenButton = newStartGameFullscreenButton;
        
        startGameFullscreenButton.addEventListener('click', () => {
            console.log("CASCADE_UI_LOG: 'Start Game from Instructions' button clicked.");
            onStartGameFromInstructions();
        });
    } else if (!startGameFullscreenButton) {
        console.error("CASCADE_UI_ERROR: startGameFullscreenButton not found in showInstructionsScreen.");
    } else if (!onStartGameFromInstructions) {
        console.warn("CASCADE_UI_WARN: onStartGameFromInstructions callback not provided to showInstructionsScreen.");
    }
}

function showGameScreen() {
    console.log("CASCADE_UI_LOG: showGameScreen called");
    if (gameContainer) {
        console.log("CASCADE_UI_LOG: gameContainer found. Initial classes: ", gameContainer.className);
        gameContainer.classList.remove('hidden');
        console.log("CASCADE_UI_LOG: gameContainer classes after removing 'hidden': ", gameContainer.className);
        console.log("CASCADE_UI_LOG: gameContainer dimensions: OffsetWidth=", gameContainer.offsetWidth, " OffsetHeight=", gameContainer.offsetHeight);
        console.log("CASCADE_UI_LOG: gameContainer computed style display: ", window.getComputedStyle(gameContainer).display);
    } else {
        console.error("CASCADE_UI_ERROR: gameContainer element not found in showGameScreen!");
    }
    if (startScreen) startScreen.classList.add('hidden');
    if (gameOverScreen) gameOverScreen.classList.add('hidden');
    if (instructionsScreen) instructionsScreen.classList.add('hidden');
    if (gameWonScreen) gameWonScreen.classList.add('hidden');
}

function showGameOverScreen(score, highScore, onRestart) {
    if (gameOverScreen) gameOverScreen.classList.remove('hidden');
    if (gameContainer) gameContainer.classList.add('hidden');
    if (startScreen) startScreen.classList.add('hidden');
    if (instructionsScreen) instructionsScreen.classList.add('hidden');
    if (gameWonScreen) gameWonScreen.classList.add('hidden');

    if (finalScoreDisplay) finalScoreDisplay.textContent = score;
    if (highScoreGameOverDisplay) highScoreGameOverDisplay.textContent = highScore;

    if (restartButton) {
        // Clone and replace to remove old listeners if any, then add the new one
        const newRestartButton = restartButton.cloneNode(true);
        restartButton.parentNode.replaceChild(newRestartButton, restartButton);
        restartButton = newRestartButton;
        restartButton.addEventListener('click', onRestart);
    }
}

function showGameWonScreen(score, highScore, onRestart) {
    if (gameWonScreen) gameWonScreen.classList.remove('hidden');
    if (gameContainer) gameContainer.classList.add('hidden');
    if (startScreen) startScreen.classList.add('hidden');
    if (gameOverScreen) gameOverScreen.classList.add('hidden');
    if (instructionsScreen) instructionsScreen.classList.add('hidden');

    if (finalScoreWinDisplay) finalScoreWinDisplay.textContent = score;
    if (highScoreWinDisplay) highScoreWinDisplay.textContent = highScore;

    if (restartButtonWin) {
        const newRestartButtonWin = restartButtonWin.cloneNode(true);
        restartButtonWin.parentNode.replaceChild(newRestartButtonWin, restartButtonWin);
        restartButtonWin = newRestartButtonWin;
        restartButtonWin.addEventListener('click', onRestart);
    }
}

function toggleDebugInfo() {
    showDebugInfo = !showDebugInfo;
    if (debugInfoPanel) {
        debugInfoPanel.classList.toggle('hidden');
    }
    return showDebugInfo; // Return current state
}

function setupDebugButton(callback) {
    if (debugButton) {
        debugButton.onclick = callback; // Callback would typically call toggleDebugInfo and update button text
    }
}

function displayUnsupportedFeaturesMessage(features) {
    if (unsupportedFeaturesScreen) {
        const message = `Warning: Your browser does not support: ${features.join(', ')}. The game might not work as expected.`;
        unsupportedFeaturesScreen.textContent = message;
        unsupportedFeaturesScreen.classList.remove('hidden');
    }
}

export {
    initUI,
    showStartScreen,
    showInstructionsScreen,
    showGameScreen,
    showGameOverScreen,
    showGameWonScreen,
    updateUI,
    toggleDebugInfo,
    setupDebugButton,
    displayUnsupportedFeaturesMessage
};
