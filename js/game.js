/**
 * @file game.js
 * @description Core game logic, state management, and main game loop for Vertical Odyssey.
 */

// Module-level variables to hold instances and state
let ctx; // Canvas rendering context
let climberInstance;
let gripInstances = [];
let protectionInstances = [];
let rockfaceManagerInstance;
let ropeManagerInstance; // Declare ropeManagerInstance at module level

let currentScore = 0;
let maxAchievedClimberY = 0; // For scoring, raw Y value
let currentGameState = 'initial'; // 'initial', 'loading', 'start', 'playing', 'gameOver', 'instructions', 'gameWon'
let gameTerminalFallTimer = null;
let gameAnimationFrameId = null;
let currentHighScore = 0;
let lastGameLoopTimestamp = 0;

// Dependencies to be injected (callbacks or module references)
let UIModule, AudioModule, InputModule, ConstantsModule;
let ClimberClass, GripClass, ProtectionClass, RockfaceClass, drawWallBackgroundFunction;
import { getRandomFloat } from './utils.js';
import * as CameraModule from './camera.js';
import { RopeManager } from './ropeManager.js'; // Import RopeManager

/**
 * Initializes the game with all necessary modules and configurations.
 * @param {HTMLCanvasElement} canvasElement - The main game canvas.
 * @param {object} modules - Object containing imported modules (UI, Audio, Input, Constants, class refs).
 * @param {object} uiConfig - Configuration for UI element IDs.
 * @param {boolean} showInstructions - Whether to show instructions on initial load.
 */
function initCoreGame(canvasElement, modules, uiConfig, showInstructions) {
    // console.log(`CASCADE_GAME_LOG: Initializing Vertical Odyssey Version ${modules.Constants.GAME_VERSION}`);
    
    // Set canvas dimensions BEFORE getting context, for best practice
    canvasElement.width = modules.Constants.CANVAS_WIDTH;
    canvasElement.height = modules.Constants.CANVAS_HEIGHT;
    
    ctx = canvasElement.getContext('2d'); // Assuming setupCanvas is done externally or here
                                        // If setupCanvas (DPR scaling) is needed, it should be called.

    // Store module references
    UIModule = modules.UI;
    AudioModule = modules.Audio;
    InputModule = modules.Input;
    ConstantsModule = modules.Constants;
    CameraModule.initCamera(ConstantsModule); // Initialize CameraModule
    ClimberClass = modules.Climber;
    GripClass = modules.Grip;
    ProtectionClass = modules.Protection;
    RockfaceClass = modules.Rockface;
    drawWallBackgroundFunction = modules.drawWallBackground;

    AudioModule.initAudio();
    InputModule.initInputListeners(
        canvasElement,
        CameraModule.getCameraY, // Use CameraModule for camera Y
        () => climberInstance,
        () => gripInstances,
        () => currentGameState
    );
    UIModule.initUI(uiConfig);
    UIModule.setupDebugButton(() => {
        const newDebugState = UIModule.toggleDebugInfo();
        document.getElementById(uiConfig.debugButtonId).textContent = newDebugState ? 'Hide Debug' : 'Show Debug';
    });

    currentHighScore = parseInt(localStorage.getItem('climbingHighScoreVO') || '0', 10);

    // Setup Rockface
    rockfaceManagerInstance = new RockfaceClass(canvasElement, uiConfig.pauseButtonId, ConstantsModule);

    resetCoreGame(false); // Reset game state but don't show start screen yet.

    // Check for browser features (e.g., Web Audio API) - UI module can handle display
    const unsupported = [];
    if (!window.AudioContext && !window.webkitAudioContext) unsupported.push('Web Audio API');
    if (unsupported.length > 0) {
        UIModule.displayUnsupportedFeaturesMessage(unsupported);
    }

    if (showInstructions) {
        currentGameState = 'instructions';
        UIModule.showInstructionsScreen({
            onCloseInstructions: () => showStartMenu(), // If there's another way to close instructions
            onStartGameFromInstructions: startCoreGame // This will be called by the button
        });
        // The 'any key' listener might still be useful if the user doesn't click the button,
        // but it could also conflict. For now, the button is the primary way.
        // Consider if InputModule.initStartScreenListener(showStartMenu) is still needed here or if it should be removed/adapted.
        // For now, let's keep it, but prioritize the button click.
        InputModule.initStartScreenListener(showStartMenu);
    } else {
        showStartMenu();
    }
    // Initial gameLoop call might be triggered by UI interaction (e.g., StartButton)
    // or called here if the game should start animating parts of the start screen.
    if (!gameAnimationFrameId) {
        lastGameLoopTimestamp = performance.now(); // For first deltaTime calculation
        gameAnimationFrameId = requestAnimationFrame(gameLoop);
    }
}

function showStartMenu() {
    currentGameState = 'start';
    // console.log("CASCADE_GAME_LOG: Game state set to 'start'");
    UIModule.showStartScreen({
        onStart: startCoreGame,
        onShowInstructions: () => {
            currentGameState = 'instructions';
            UIModule.showInstructionsScreen({ onCloseInstructions: () => showStartMenu() });
            InputModule.initStartScreenListener(showStartMenu);
        }
    });
}

function resetCoreGame(showStartScreen = true) {
    if (ConstantsModule.DEBUG_MODE) {
        console.log(`%cCASCADE_GAME_LOG: resetCoreGame called. nextGripId at start of reset: ${nextGripId}`, ConstantsModule.CONSOLE_LOG_STYLE_GAME_RESET);
    }
    // console.log("CASCADE_RESET_CORE: ENTERED resetCoreGame");
    // console.log("CASCADE_GAME_LOG: resetCoreGame called");
    // console.log(`CASCADE_RESET_CORE: resetCoreGame called. showStartScreen: ${showStartScreen}. gripInstances before reset: ${gripInstances ? gripInstances.length : 'null'}`);
    if (gameAnimationFrameId) cancelAnimationFrame(gameAnimationFrameId);
    gameAnimationFrameId = null;
    clearTimeout(gameTerminalFallTimer);

    CameraModule.resetCamera(); // Reset camera using CameraModule
    currentScore = 0;
    maxAchievedClimberY = ConstantsModule.CANVAS_HEIGHT - 150; // Initial climber Y for scoring reference

    // Instantiate RopeManager before Climber
    if (!ropeManagerInstance) { // Create if it doesn't exist (e.g. first reset)
        ropeManagerInstance = new RopeManager(null, ConstantsModule);
    } else {
        ropeManagerInstance.reset(); // If it exists, just reset it
        ropeManagerInstance.climber = null; // Clear previous climber reference
    }

    climberInstance = new ClimberClass(
        ConstantsModule.CANVAS_WIDTH / 2,
        ConstantsModule.CANVAS_HEIGHT - 150,
        ConstantsModule.CLIMBER_SIZE, 
        ConstantsModule.CLIMBER_COLOR,
        ConstantsModule, // Pass all constants
        ropeManagerInstance, // Pass RopeManager instance
        AudioModule.playSound, // Pass playSound function
        CameraModule.getCameraY // Pass getter for cameraY from CameraModule
    );

    // Assign the created climberInstance to the ropeManagerInstance
    if (ropeManagerInstance) {
        ropeManagerInstance.climber = climberInstance;
        // Potentially call a reset or init method on ropeManager if it needs to set up based on the new climber
        // For now, direct assignment is okay based on its current constructor. If RopeManager.reset() needs climber, adjust.
        // The current placeholder RopeManager's reset doesn't use the climber, so this is fine.
    }

    // Conditional full world regeneration
    if (nextGripId === 0 || gripInstances.length === 0) {
        if (ConstantsModule.DEBUG_MODE) {
            console.log(`%cCASCADE_GAME_LOG: resetCoreGame - Performing full grip and world generation. Initial nextGripId: ${nextGripId}`, ConstantsModule.CONSOLE_LOG_STYLE_GAME_RESET);
        }
        gripInstances.length = 0;
        protectionInstances.length = 0;
        highestGeneratedGripY = 0;
        nextGripId = 0; // CRITICAL: Reset for a true fresh start
        localGenerateGrips(15); // Generate initial grips
    } else {
        if (ConstantsModule.DEBUG_MODE) {
            console.log(`%cCASCADE_GAME_LOG: resetCoreGame - Grips already exist. Skipping full regeneration. Current nextGripId: ${nextGripId}`, ConstantsModule.CONSOLE_LOG_STYLE_GAME_RESET);
        }
        // Note: If protections are tied to specific grips, their reset logic might need review
        // if we are not clearing gripInstances but ARE resetting player inventory.
        // For now, if grips exist, we assume protections on the wall also persist.
    }

    // Reveal grips near the climber's starting position
    if (climberInstance && gripInstances && gripInstances.length > 0) {
        climberInstance.revealNearbyGrips(gripInstances);
    }

    // Pass climber's starting pump, and maxPump for UI bar calculation
    const climberInitialStats = { 
        currentPump: ConstantsModule.PUMP_STARTING_LEVEL, 
        maxPump: ConstantsModule.MAX_PUMP 
    };
    UIModule.updateUI(currentScore, ConstantsModule.PUMP_STARTING_LEVEL, 'Ready to Climb!', climberInitialStats, {});

    if (showStartScreen) {
        showStartMenu();
    }
    // Ensure game loop continues if it was stopped
    if (!gameAnimationFrameId && (currentGameState === 'start' || currentGameState === 'instructions')) {
        lastGameLoopTimestamp = performance.now(); // For first deltaTime calculation
        gameAnimationFrameId = requestAnimationFrame(gameLoop);
    }
}

function startCoreGame() {
    // console.log('CASCADE_START_CORE: ENTERED startCoreGame');
    // console.log("CASCADE_GAME_LOG: startCoreGame called");
    // console.log(`CASCADE_START_CORE: startCoreGame called. Current gameState: ${currentGameState}`);
    currentGameState = 'playing';
    UIModule.showGameScreen();
    // console.log(`CASCADE_START_CORE: Calling resetCoreGame(false) from startCoreGame.`);
    resetCoreGame(false); // Reset game logic, but don't show start screen
    // console.log(`CASCADE_START_CORE: Returned from resetCoreGame. gripInstances.length: ${gripInstances ? gripInstances.length : 'null'}`);
    AudioModule.playSound('start');
    
    if (rockfaceManagerInstance) {
        rockfaceManagerInstance.running = true;
    } else {
        // console.error("CASCADE_ERROR_GAME: rockfaceManagerInstance is null in startCoreGame!");
        return; 
    }

    if (!gameAnimationFrameId) {
        lastGameLoopTimestamp = performance.now(); // For first deltaTime calculation
        // console.log(`CASCADE_DEBUG_GAMELOOP: Initiating gameLoop from startCoreGame. Timestamp: ${lastGameLoopTimestamp}`);
        gameAnimationFrameId = requestAnimationFrame(gameLoop); 
    } else {
        // console.warn(`CASCADE_DEBUG_GAMELOOP: gameLoop already running or gameAnimationFrameId not null (${gameAnimationFrameId}) when startCoreGame called.`);
    }
}

function gameOverCore() {
    // console.log("CASCADE_GAME_LOG: gameOverCore called");
    currentGameState = 'gameOver';
    AudioModule.playSound('gameOver');
    if (currentScore > currentHighScore) {
        currentHighScore = currentScore;
        localStorage.setItem('climbingHighScoreVO', currentHighScore.toString());
    }
    UIModule.showGameOverScreen(currentScore, currentHighScore, { onRestart: startCoreGame });
    if (rockfaceManagerInstance) rockfaceManagerInstance.running = false;
    if (gameAnimationFrameId) cancelAnimationFrame(gameAnimationFrameId);
    gameAnimationFrameId = null;
}

let highestGeneratedGripY = 0; // Track the Y position of the highest generated grip row
let nextGripId = 0; // Counter for generating unique grip IDs

// --- Helper Functions for Grip Generation ---

function _createGrip(x, y, type, isInitialFlag, size, gripOptions) {
    const gripId = `grip-${nextGripId++}`;
    if (ConstantsModule.DEBUG_MODE) {
        console.log(`CASCADE_CREATE_GRIP_LOG: Creating grip with ID: ${gripId}`);
    }
    // isInitialFlag in GripClass constructor is for 'isSpecialInitial' which affects early lifetime/behavior.
    // Forcing initial grips to be 'active' immediately or have different properties can be done here if needed.
    return new GripClass(
        x,
        y,
        gripId,
        type,
        isInitialFlag, // True for grips generated in the initial batch (forceCount > 0)
        size, // null allows GripClass to use default sizing logic
        gripOptions
    );
}

// Basic overlap check helper
function _isTooClose(newGrip, existingGrips, checkCount = 3) {
    // Check against the last few grips in the provided array
    const startIndex = Math.max(0, existingGrips.length - checkCount);
    for (let i = existingGrips.length - 1; i >= startIndex; i--) {
        const prevGrip = existingGrips[i];
        if (Math.abs(newGrip.x - prevGrip.x) < ConstantsModule.GRIP_AVG_SIZE && 
            Math.abs(newGrip.y - prevGrip.y) < ConstantsModule.GRIP_AVG_SIZE * 1.5) {
            return true;
        }
    }
    return false;
}

function _generateInitialReachableGrips(climberStartX, climberStartY, gripOptions, currentGrips) {
    if (ConstantsModule.DEBUG_MODE) {
        console.log(`CASCADE_DEBUG_GRIPS: Generating initial reachable grips. Current nextGripId before loop: ${nextGripId}`);
    }
    const newReachableGrips = [];
    let highestYInBatch = climberStartY;

    for (let i = 0; i < ConstantsModule.NUM_INITIAL_REACHABLE_GRIPS; i++) {
        let x, y;
        const yFactor = ConstantsModule.INITIAL_REACHABLE_GRIP_Y_FACTORS[i] || ConstantsModule.INITIAL_REACHABLE_GRIP_Y_FACTORS[ConstantsModule.INITIAL_REACHABLE_GRIP_Y_FACTORS.length -1]; // Fallback to last factor
        y = climberStartY - (yFactor * ConstantsModule.CLIMBER_REACH);

        // Fan out X positions: 0 is center, 1 is leftish, 2 is rightish
        if (i === 0) { // Lowest, most central
            x = climberStartX + getRandomFloat(-ConstantsModule.CLIMBER_REACH * 0.2, ConstantsModule.CLIMBER_REACH * 0.2);
        } else if (i === 1) { // Middle, to one side
            x = climberStartX - getRandomFloat(ConstantsModule.CLIMBER_REACH * 0.3, ConstantsModule.CLIMBER_REACH * 0.7);
        } else { // Highest, to the other side
            x = climberStartX + getRandomFloat(ConstantsModule.CLIMBER_REACH * 0.3, ConstantsModule.CLIMBER_REACH * 0.7);
        }
        x = Math.max(ConstantsModule.GRIP_AVG_SIZE, Math.min(x, ConstantsModule.CANVAS_WIDTH - ConstantsModule.GRIP_AVG_SIZE)); // Clamp to canvas

        const gripSize = getRandomFloat(ConstantsModule.GRIP_SIZE_NORMAL_MIN * 1.1, ConstantsModule.GRIP_SIZE_NORMAL_MAX * 1.1); // Slightly larger
        const newGrip = _createGrip(x, y, ConstantsModule.GRIP_TYPE_NORMAL, true, gripSize, gripOptions);

        if (_isTooClose(newGrip, currentGrips.concat(newReachableGrips))) {
            if (ConstantsModule.DEBUG_MODE) {
                console.log(`CASCADE_GAME_LOG: Reachable grip ${newGrip.id} too close. Adjusting X.`);
            }
            newGrip.x += (getRandomFloat(0,1) > 0.5 ? 1: -1) * ConstantsModule.GRIP_AVG_SIZE * 2;
            newGrip.x = Math.max(ConstantsModule.GRIP_AVG_SIZE, Math.min(newGrip.x, ConstantsModule.CANVAS_WIDTH - ConstantsModule.GRIP_AVG_SIZE));
        }

        newGrip.state = 'visible'; // SET STATE DIRECTLY

        newReachableGrips.push(newGrip);
        if (y < highestYInBatch) highestYInBatch = y;
        if (ConstantsModule.DEBUG_MODE) {
            console.log(`CASCADE_DEBUG_GRIPS: Reachable grip ${i}: x=${x.toFixed(1)}, y=${y.toFixed(1)}, factor=${yFactor}`);
        }
    }
    return { grips: newReachableGrips, highestY: highestYInBatch };
}

function _generateInitialReferenceGrips(climberStartX, currentHighestOverallY, gripOptions, currentGrips) {
    if (ConstantsModule.DEBUG_MODE) {
        console.log('CASCADE_DEBUG_GRIPS: Generating initial reference grips.');
    }
    const newReferenceGrips = [];
    let highestYInBatch = currentHighestOverallY;
    let lastRefGripY = currentHighestOverallY;

    for (let i = 0; i < ConstantsModule.NUM_INITIAL_REFERENCE_GRIPS; i++) {
        const referenceXRange = ConstantsModule.CANVAS_WIDTH * 0.35;
        let x = climberStartX + getRandomFloat(-referenceXRange, referenceXRange);
        // Stack above the highest reachable grip with some separation
        const yOffset = ConstantsModule.MIN_GRIP_SEPARATION * (0.8 + i * 0.6) + getRandomFloat(-10, 10);
        let y = lastRefGripY - yOffset;
        x = Math.max(ConstantsModule.GRIP_AVG_SIZE, Math.min(x, ConstantsModule.CANVAS_WIDTH - ConstantsModule.GRIP_AVG_SIZE)); // Clamp to canvas

        const newGrip = _createGrip(x, y, ConstantsModule.GRIP_TYPE_NORMAL, true, null, gripOptions);

        if (_isTooClose(newGrip, currentGrips.concat(newReferenceGrips))) {
            if (ConstantsModule.DEBUG_MODE) {
                console.log(`CASCADE_GAME_LOG: Reference grip ${newGrip.id} too close. Adjusting X.`);
            }
            newGrip.x += (getRandomFloat(0,1) > 0.5 ? 1: -1) * ConstantsModule.GRIP_AVG_SIZE * 2;
            newGrip.x = Math.max(ConstantsModule.GRIP_AVG_SIZE, Math.min(newGrip.x, ConstantsModule.CANVAS_WIDTH - ConstantsModule.GRIP_AVG_SIZE));
        }

        newGrip.state = 'visible'; // SET STATE DIRECTLY

        newReferenceGrips.push(newGrip);
        lastRefGripY = y;
        if (y < highestYInBatch) highestYInBatch = y;
        if (ConstantsModule.DEBUG_MODE) {
            console.log(`CASCADE_DEBUG_GRIPS: Reference grip ${i}: x=${x.toFixed(1)}, y=${y.toFixed(1)}`);
        }
    }
    return { grips: newReferenceGrips, highestY: highestYInBatch };
}

function _generateInitialFillerGrips(numFillerToMake, startY, climberStartX, gripOptions) {
    if (numFillerToMake <= 0) return { grips: [], highestY: startY };
    if (ConstantsModule.DEBUG_MODE) {
        console.log(`CASCADE_DEBUG_GRIPS: Generating ${numFillerToMake} initial filler grips.`);
    }
    const newFillerGrips = [];
    let currentFillerY = startY;

    for (let i = 0; i < numFillerToMake; i++) {
        currentFillerY -= (ConstantsModule.GRIP_AVG_VERTICAL_SEPARATION_INITIAL_FILLER + getRandomFloat(-5, 5));
        const x = climberStartX + getRandomFloat(-ConstantsModule.GRIP_AVG_SIZE * 0.3, ConstantsModule.GRIP_AVG_SIZE * 0.3); // Tightly packed around center
        const newGrip = _createGrip(x, currentFillerY, ConstantsModule.GRIP_TYPE_NORMAL, true, null, gripOptions);
        newGrip.state = 'visible'; // SET STATE DIRECTLY

        newFillerGrips.push(newGrip);
        // Note: Overlap check for fillers is omitted for simplicity as they form a column.
        if (ConstantsModule.DEBUG_MODE) {
            console.log(`CASCADE_DEBUG_GRIPS: Filler grip ${i}: x=${x.toFixed(1)}, y=${currentFillerY.toFixed(1)}`);
        }
    }
    return { grips: newFillerGrips, highestY: currentFillerY };
}

function _generateDynamicGrips(currentHighestY, climberStartYForRef, currentCameraYVal, gripOptions) {
    if (ConstantsModule.DEBUG_MODE) {
        console.log('CASCADE_GRIP_LOG: Dynamic generation.');
    }
    const dynamicallyGeneratedGrips = [];
    let highestYInBatch = currentHighestY;

    for (let d = 0; d < ConstantsModule.DYNAMIC_GRIP_GENERATION_BATCH_SIZE; d++) {
        if (gripInstances.length >= ConstantsModule.MAX_GRIPS_ON_SCREEN) {
            if (ConstantsModule.DEBUG_MODE) {
                console.log('CASCADE_GRIP_LOG: Max grips on screen reached during dynamic generation.');
            }
            break;
        }
        if (gripInstances.length >= ConstantsModule.MAX_GRIPS) {
            if (ConstantsModule.DEBUG_MODE) {
                console.log('CASCADE_GRIP_LOG: Absolute MAX_GRIPS reached during dynamic generation.');
            }
            break;
        }

        const effectiveBaseY = (currentHighestY === climberStartYForRef || currentHighestY === 0)
            ? climberStartYForRef - ConstantsModule.MIN_GRIP_SEPARATION
            : Math.min(currentHighestY - ConstantsModule.MIN_GRIP_SEPARATION, currentCameraYVal - ConstantsModule.MIN_GRIP_SEPARATION * 2);
        
        const yPos = effectiveBaseY - getRandomFloat(ConstantsModule.MIN_GRIP_SEPARATION * 0.8, ConstantsModule.CANVAS_HEIGHT * 0.25);

        if (yPos < ConstantsModule.MIN_Y_FOR_GRIP_GENERATION) {
            if (ConstantsModule.DEBUG_MODE) {
                console.log(`CASCADE_GRIP_LOG: MIN_Y_FOR_GRIP_GENERATION (${ConstantsModule.MIN_Y_FOR_GRIP_GENERATION}) reached. yPos: ${yPos}.`);
            }
            break;
        }

        const gripEffectiveWidth = ConstantsModule.GRIP_WIDTH || ConstantsModule.GRIP_SIZE_MAX;
        const xPos = getRandomFloat(gripEffectiveWidth, ConstantsModule.CANVAS_WIDTH - gripEffectiveWidth);
        const size = getRandomFloat(ConstantsModule.GRIP_SIZE_MIN, ConstantsModule.GRIP_SIZE_MAX);
        const gripType = (Math.random() < ConstantsModule.NORMAL_GRIP_CRACK_CHANCE) ? ConstantsModule.GRIP_TYPE_CRACK : ConstantsModule.GRIP_TYPE_NORMAL;
        
        const newGrip = _createGrip(xPos, yPos, gripType, false, size, gripOptions);
        newGrip.state = 'hidden'; // SET STATE DIRECTLY

        if (_isTooClose(newGrip, dynamicallyGeneratedGrips.concat(gripInstances), 5)) {
            if (ConstantsModule.DEBUG_MODE) {
                console.log(`CASCADE_GRIP_LOG: Dynamic grip ${newGrip.id} too close, skipping.`);
            }
            nextGripId--; // Decrement because _createGrip increments it
            continue;
        }

        dynamicallyGeneratedGrips.push(newGrip);
        if (yPos < highestYInBatch) highestYInBatch = yPos;
        if (ConstantsModule.DEBUG_MODE) {
            console.log(`CASCADE_GRIP_LOG: Dynamic grip ${dynamicallyGeneratedGrips.length}: x=${xPos.toFixed(1)}, y=${yPos.toFixed(1)}, type=${gripType}`);
        }
    }
    return { grips: dynamicallyGeneratedGrips, highestY: highestYInBatch };
}

// --- Main Grip Generation Function ---

function localGenerateGrips(forceCount = 0, currentCameraYVal) {
    if (ConstantsModule.DEBUG_MODE) {
        console.log('CASCADE_GRIP_LOG: ENTERED localGenerateGrips');
    }

    const gripOptions = {
        getCtxFn: () => ctx,
        playSoundFn: AudioModule.playSound,
        getClimberCb: () => climberInstance
    };

    let newGripsMadeThisCall = 0;
    let tempHighestGeneratedY = highestGeneratedGripY; // Use a temp var for this call's generation pass

    const climberStartY = ConstantsModule.CANVAS_HEIGHT - 150;
    const climberStartX = ConstantsModule.CANVAS_WIDTH / 2;

    if (forceCount > 0) {
        // console.log(`CASCADE_GRIP_LOG: Initial generation with forceCount: ${forceCount}`);
        let allInitialGrips = [];

        // 1. Reachable Grips
        const reachableResult = _generateInitialReachableGrips(climberStartX, climberStartY, gripOptions, gripInstances);
        allInitialGrips = allInitialGrips.concat(reachableResult.grips);
        if (reachableResult.grips.length > 0) {
            tempHighestGeneratedY = Math.min(tempHighestGeneratedY === 0 ? climberStartY : tempHighestGeneratedY, reachableResult.highestY);
        }

        // 2. Reference Grips (start from the highest Y of reachable grips)
        const refResult = _generateInitialReferenceGrips(climberStartX, tempHighestGeneratedY, gripOptions, gripInstances.concat(allInitialGrips));
        allInitialGrips = allInitialGrips.concat(refResult.grips);
        if (refResult.grips.length > 0) {
            tempHighestGeneratedY = Math.min(tempHighestGeneratedY, refResult.highestY);
        }

        // 3. Filler Grips (up to forceCount)
        const numSpecialGripsMade = ConstantsModule.NUM_INITIAL_REACHABLE_GRIPS + ConstantsModule.NUM_INITIAL_REFERENCE_GRIPS;
        const numFillerToMake = forceCount - numSpecialGripsMade;
        const fillerResult = _generateInitialFillerGrips(numFillerToMake, tempHighestGeneratedY, climberStartX, gripOptions);
        allInitialGrips = allInitialGrips.concat(fillerResult.grips);
        if (fillerResult.grips.length > 0) {
            tempHighestGeneratedY = Math.min(tempHighestGeneratedY, fillerResult.highestY);
        }

        gripInstances.push(...allInitialGrips);
        newGripsMadeThisCall = allInitialGrips.length;

        // Mark the very first grip for logging if this is the absolute first generation pass
        if (gripInstances.length === newGripsMadeThisCall && newGripsMadeThisCall > 0 && gripInstances[0]) {
            gripInstances[0].isFirstGripForLogging = true;
        }

    } else { // Dynamic generation during gameplay
        const generationThresholdPoint = currentCameraYVal - (ConstantsModule.CANVAS_HEIGHT * ConstantsModule.DYNAMIC_GRIP_GENERATION_CAMERA_THRESHOLD_FACTOR);
        const shouldGenerateDynamically = highestGeneratedGripY === 0 || highestGeneratedGripY > generationThresholdPoint;

        if (ConstantsModule.DEBUG_MODE) {
            console.log(
                `CASCADE_GRIP_LOG: Dynamic check. ` +
                `highestGeneratedGripY: ${highestGeneratedGripY.toFixed(1)}, ` +
                `currentCameraY: ${currentCameraYVal.toFixed(1)}, ` +
                `CANVAS_HEIGHT: ${ConstantsModule.CANVAS_HEIGHT}, ` +
                `THRESHOLD_FACTOR: ${ConstantsModule.DYNAMIC_GRIP_GENERATION_CAMERA_THRESHOLD_FACTOR}, ` +
                `generationThresholdPoint: ${generationThresholdPoint.toFixed(1)}, ` +
                `shouldGenerateDynamically: ${shouldGenerateDynamically}`
            );
        }

        if (shouldGenerateDynamically) {
            if (ConstantsModule.DEBUG_MODE) {
                console.log(`CASCADE_GRIP_LOG: Dynamic generation triggered. highestGeneratedGripY: ${highestGeneratedGripY.toFixed(1)}, currentCameraY: ${currentCameraYVal.toFixed(1)}`);
            }
            // Pass the current highestGeneratedGripY to _generateDynamicGrips for context
            const dynamicResult = _generateDynamicGrips(highestGeneratedGripY, climberStartY, currentCameraYVal, gripOptions);
            
            if (dynamicResult.grips.length > 0) {
                gripInstances.push(...dynamicResult.grips);
                newGripsMadeThisCall += dynamicResult.grips.length; // Ensure accumulation
                
                // Update tempHighestGeneratedY for this current call to localGenerateGrips
                // if this batch's highestY is truly higher (smaller value) or if tempHighestGeneratedY is at its initial (0) state.
                if (dynamicResult.highestY < tempHighestGeneratedY || tempHighestGeneratedY === 0) { 
                    tempHighestGeneratedY = dynamicResult.highestY;
                }
                if (ConstantsModule.DEBUG_MODE) {
                    console.log(`CASCADE_GRIP_LOG: Dynamically generated ${dynamicResult.grips.length} grips. New highest Y in batch: ${dynamicResult.highestY.toFixed(1)}`);
                }
            }
        }
    }

    // Update the global highestGeneratedGripY if new grips were made and they are higher
    if (newGripsMadeThisCall > 0) {
        if (highestGeneratedGripY === 0 || tempHighestGeneratedY < highestGeneratedGripY) {
            highestGeneratedGripY = tempHighestGeneratedY;
        }
    }

    if (ConstantsModule.DEBUG_MODE) {
        console.log(`CASCADE_GRIP_LOG: localGenerateGrips finished. Made total ${newGripsMadeThisCall} new grips this call. Total gripInstances.length: ${gripInstances.length}. HighestGeneratedGripY: ${highestGeneratedGripY.toFixed(1)}`);
    }
}

function updateAndDrawGrips(deltaTime) {
    if (!gripInstances || !ctx) return; // Also ensure ctx is available

    for (let i = gripInstances.length - 1; i >= 0; i--) {
        const grip = gripInstances[i];
        // Pass climber coordinates to grip.update for reachability checks
        const camY = CameraModule.getCameraY();
        if (climberInstance) {
            grip.update(deltaTime, camY, climberInstance.x, climberInstance.y);
        } else {
            grip.update(deltaTime, camY); // Fallback if climberInstance is somehow not yet defined
        }
        grip.draw(camY); // Grip draw method needs ctx and cameraY, handled internally by grip if getCtxFn used
        
        // Culling grips far below the camera
        if (grip.y - camY > ConstantsModule.CANVAS_HEIGHT + grip.size * 2 && grip.state !== 'active') { // Corrected culling logic: grip.y is world, so grip.y - camY is screen y
            gripInstances.splice(i, 1);
        }
    }
}

function addGameProtection(x, y) {
    const newProtection = new ProtectionClass(x, y, { getCtxFn: () => ctx });
    protectionInstances.push(newProtection);
    if(climberInstance) climberInstance.lastProtectionPlacementTime = performance.now();
}

function updateAndDrawProtections() {
    protectionInstances.forEach(p => {
        p.draw(); // Protection draw method needs ctx and cameraY, handled internally if getCtxFn used
    });
}

function drawClimberRope() {
    if (!climberInstance || !ctx) return;
    const ropePath = climberInstance.getRopePath(protectionInstances);
    if (ropePath.length < 2) return;

    const camY = CameraModule.getCameraY();
    ctx.beginPath();
    ctx.moveTo(ropePath[0].x, ropePath[0].y - camY);
    for (let i = 1; i < ropePath.length; i++) {
        ctx.lineTo(ropePath[i].x, ropePath[i].y - camY);
    }
    ctx.strokeStyle = ConstantsModule.ROPE_COLOR || 'grey';
    ctx.lineWidth = ConstantsModule.ROPE_THICKNESS || 2;
    ctx.stroke();
}

// Function to check and reveal the win grip if conditions are met
function checkAndRevealWinGrip() {
    if (!gripInstances || gripInstances.length === 0) {
        return; // No grips to check
    }

    let winGrip = null;
    const preLastGrips = [];

    for (const grip of gripInstances) {
        if (grip.isWinGrip) {
            winGrip = grip;
        }
        if (grip.isPreLastGrip) {
            preLastGrips.push(grip);
        }
    }

    // If there are no pre-last grips defined, or no win grip, we can't proceed
    if (!winGrip || preLastGrips.length === 0) {
        return;
    }

    let allPreLastActivated = true;
    for (const pGrip of preLastGrips) {
        // Define 'activated' as any state that's not 'hidden' or 'visible' or 'revealing'
        // This implies the climber has interacted with it or it has naturally expired.
        if (pGrip.state === 'hidden' || pGrip.state === 'visible' || pGrip.state === 'revealing') {
            allPreLastActivated = false;
            break;
        }
    }

    if (allPreLastActivated && winGrip.state === 'hidden') {
        // console.log("CASCADE_GAME_LOG: All pre-last grips activated! Revealing win grip.");
        winGrip.state = 'revealing'; // Use 'revealing' to trigger animation
        winGrip.revealTimer = 0; // Start reveal animation
        winGrip.stateStartTime = performance.now(); // Set state start time for revealing animation
        if (AudioModule && AudioModule.playSound) {
            AudioModule.playSound('winGripRevealed'); // Placeholder for a specific sound
        }
    }
}

function gameLoop(timestamp) {
    if (!lastGameLoopTimestamp) {
        lastGameLoopTimestamp = timestamp;
    }

    if (currentGameState === 'gameOver' || currentGameState === 'gameWon') {
        // console.log(`CASCADE_DEBUG_GAMELOOP: Game is over or won. Exiting loop. State: ${currentGameState}`);
        if (gameAnimationFrameId) cancelAnimationFrame(gameAnimationFrameId);
        return;
    }

    const deltaTime = (timestamp - lastGameLoopTimestamp) / 1000; // seconds
    lastGameLoopTimestamp = timestamp;

    const currentCameraY = CameraModule.getCameraY();

    // Update Rockface logic (animation, recycling, etc.)
    if (rockfaceManagerInstance) {
        rockfaceManagerInstance.animate(timestamp, currentCameraY);
    }

    // Clear the entire canvas for the new frame
    ctx.clearRect(0, 0, ConstantsModule.CANVAS_WIDTH, ConstantsModule.CANVAS_HEIGHT);

    // Draw Rockface first as background
    if (rockfaceManagerInstance) {
        rockfaceManagerInstance.draw(currentCameraY);
    }

    // Game logic updates based on state
    if (currentGameState === 'playing') {
        // Update and draw game elements
        updateAndDrawGrips(deltaTime); // Pass deltaTime if grips have animations/updates
        updateAndDrawProtections(); 
        
        // Draw climber and rope
        if (climberInstance) {
            climberInstance.draw(ctx, currentCameraY); 
        }
        if (ropeManagerInstance) {
            ropeManagerInstance.update(deltaTime, protectionInstances); // Update rope logic
            ropeManagerInstance.draw(ctx, currentCameraY); // Draw the rope
        }

        // Update UI elements like score, pump, etc.
        if (climberInstance) {
            try {
                climberInstance.update(deltaTime, gripInstances, protectionInstances, (type, _options) => {
                    if (type === 'fall') gameOverCore();
                    else if (type === 'belayFail') gameOverCore(); // Or some other consequence
                    else if (type === 'belaySuccess') { /* Handle belay success, e.g. move climber */ }
                    else if (type === 'placeProtection') {
                        addGameProtection(climberInstance.x, climberInstance.y);
                    }
                }, CameraModule.getCameraY()); // Pass cameraY from CameraModule
            } catch (e) {
                // console.error("CASCADE_ERROR_GAMELOOP: Error in climberInstance.update():", e);
                currentGameState = 'gameOver'; // Or a new 'error' state
                gameAnimationFrameId = null; 
                return; // Stop this gameLoop iteration
            }

            // Update score based on highest point reached
            const climberEffectiveY = climberInstance.y; // World Y
            const scoreableHeight = (ConstantsModule.CANVAS_HEIGHT - 150) - climberEffectiveY; // Positive as climber moves up (Y decreases)
            if (scoreableHeight > currentScore * 10) { // Assuming 10 world units per score point from original conversion
                 currentScore = Math.floor(scoreableHeight / 10);
                 // maxAchievedClimberY might need re-evaluation if it was screen-based. 
                 // If it's truly highest world Y reached, it's just -climberInstance.y (or similar)
                 // For now, this scoring logic change seems more robust than the previous one based on camera.
            }
        } else {
            // console.warn("CASCADE_DEBUG_GAMELOOP: climberInstance is null in 'playing' state.");
        }

        // Update camera
        if (climberInstance) {
            CameraModule.updateCamera(climberInstance.y);
        }

        // Generate new grips if needed
        // The decision of *whether* to generate grips is now primarily inside localGenerateGrips itself,
        // based on highestGeneratedGripY and camera position.
        // We just need to ensure it's called when the game is active.
        localGenerateGrips(0, CameraModule.getCameraY()); // Pass cameraY
        
        UIModule.updateUI(
            currentScore,
            climberInstance ? climberInstance.stamina : 0,
            climberInstance && climberInstance.state === 'falling' ? 'Falling!' : (climberInstance.state === 'idle' ? 'Resting' : 'Climbing'),
            climberInstance ? { x: climberInstance.x, y: climberInstance.y, state: climberInstance.state } : {},
            { cameraY: CameraModule.getCameraY(), gripCount: gripInstances ? gripInstances.length : 0 }
        );

        // Check and reveal win grip if conditions are met
        checkAndRevealWinGrip();

        if (currentScore >= ConstantsModule.TARGET_SCORE_TO_WIN) {
            // gameWonCore(); // Assuming gameWonCore exists - This was in original, make sure it's defined or handle missing
            if (typeof gameWonCore === 'function') {
                gameWonCore();
            } else {
                // console.warn("CASCADE_DEBUG_GAMELOOP: gameWonCore function not found.");
            }
        }

    } else if (currentGameState === 'start' || currentGameState === 'gameOver' || currentGameState === 'instructions' || currentGameState === 'gameWon') {
        // console.log(`CASCADE_DEBUG_GAMELOOP: State is '${currentGameState}'. UI should handle visuals.`);
    }

    if (currentGameState !== 'gameOver' && currentGameState !== 'gameWon') {
        gameAnimationFrameId = requestAnimationFrame(gameLoop);
    } else {
        // Game is over or won, ensure the loop doesn't continue and any existing frame is cancelled.
        // console.log(`CASCADE_DEBUG_GAMELOOP: Game state is '${currentGameState}', not requesting next frame (loop end condition). FrameId was: ${gameAnimationFrameId}`);
        if (gameAnimationFrameId) { // Only cancel if it has a valid ID (it might have been cancelled by gameOverCore/gameWonCore already)
             cancelAnimationFrame(gameAnimationFrameId);
        }
        gameAnimationFrameId = null; // Ensure it's null
    }
}

export { initCoreGame }; // Export only the main initializer
