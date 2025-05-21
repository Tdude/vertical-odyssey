/**
 * @file input.js
 * @description Manages keyboard and mouse input for the game.
 */

const lastKeys = {
    left: false,
    right: false,
    up: false, // Jump / Mantle
    down: false, // Look down / Place protection preparation
    placeProtection: false, // 'P' or other key for placing protection
    // Add other keys as needed, e.g., space for jump if different from 'up'
};

function handleKeyDown(e) {
    // gameState check might be needed here or in the climber's input handling logic
    // to prevent actions during menus, gameOver, etc.
    switch (e.key) {
        case 'ArrowLeft':
        case 'a':
            lastKeys.left = true;
            break;
        case 'ArrowRight':
        case 'd':
            lastKeys.right = true;
            break;
        case 'ArrowUp':
        case 'w':
            lastKeys.up = true;
            break;
        case 'ArrowDown':
        case 's':
            lastKeys.down = true;
            break;
        case 'p': // Key for placing protection
        case 'P':
            lastKeys.placeProtection = true;
            break;
        // Potentially prevent default for arrow keys if they scroll the page
        // if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        //     e.preventDefault(); 
        // }
    }
}

function handleKeyUp(e) {
    switch (e.key) {
        case 'ArrowLeft':
        case 'a':
            lastKeys.left = false;
            break;
        case 'ArrowRight':
        case 'd':
            lastKeys.right = false;
            break;
        case 'ArrowUp':
        case 'w':
            lastKeys.up = false;
            break;
        case 'ArrowDown':
        case 's':
            lastKeys.down = false;
            break;
        case 'p':
        case 'P':
            lastKeys.placeProtection = false;
            break;
    }
}

/**
 * Initializes the keyboard and mouse event listeners.
 * @param {HTMLCanvasElement} canvasElement - The game canvas element for mouse click events.
 * @param {function} getCameraY - Function to get the current camera Y offset.
 * @param {function} getClimber - Function to get the climber instance.
 * @param {function} getGrips - Function to get the array of grip instances.
 * @param {string} getCurrentGameState - Function to get the current game state.
 */
function initInputListeners(canvasElement, getCameraY, getClimber, getGrips, getCurrentGameState) {
    document.removeEventListener('keydown', handleKeyDown); // Remove if already attached
    document.removeEventListener('keyup', handleKeyUp);     // Remove if already attached
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    console.log("CASCADE_INPUT: Keyboard input listeners initialized.");

    if (canvasElement) {
        const handleMouseClick = (event) => {
            if (getCurrentGameState() !== 'playing') {
                console.log("CASCADE_INPUT: Click ignored, game not in 'playing' state.");
                return; // Only process clicks if the game is actively being played
            }

            const rect = canvasElement.getBoundingClientRect();
            const scaleX = canvasElement.width / (rect.width * (window.devicePixelRatio || 1)); // Adjust for DPR and CSS scaling
            const scaleY = canvasElement.height / (rect.height * (window.devicePixelRatio || 1));
            
            // Calculate click coordinates relative to the canvas, scaled appropriately
            const canvasClickX = (event.clientX - rect.left) * scaleX;
            const canvasClickY = (event.clientY - rect.top) * scaleY;

            const cameraY = getCameraY();
            const climber = getClimber();
            const grips = getGrips();

            // Convert canvas click coordinates to world coordinates
            const worldX = canvasClickX;
            const worldY = canvasClickY - cameraY; // Adjust for camera offset

            console.log(`CASCADE_INPUT: Mouse click detected at canvas(x:${canvasClickX.toFixed(1)}, y:${canvasClickY.toFixed(1)}), world(x:${worldX.toFixed(1)}, y:${worldY.toFixed(1)})`);

            if (climber && typeof climber.attemptGrab === 'function') {
                climber.attemptGrab(worldX, worldY, grips);
            } else {
                console.error('CASCADE_INPUT_ERROR: Climber instance or attemptGrab method not available.');
            }
        };

        // Remove existing listener before adding a new one to prevent duplicates if init is called multiple times
        canvasElement.removeEventListener('click', handleMouseClick); // Ensure this is the same function reference if using named functions
        canvasElement.addEventListener('click', handleMouseClick);
        console.log("CASCADE_INPUT: Mouse click listener initialized on canvas.");
    } else {
        console.warn("CASCADE_INPUT: Canvas element not provided. Mouse click listener not initialized.");
    }
}

/**
 * Gets the current state of the keys.
 * @returns {object} The lastKeys object.
 */
function getInputState() {
    return lastKeys;
}

/**
 * Initializes a one-time event listener for the start screen.
 * Removes itself after the first key press.
 * @param {function} startGameCallback - The function to call when a key is pressed.
 */
function initStartScreenListener(startGameCallback) {
    const handleAnyKeyDown = (event) => {
        // Optional: Check if the event target is not an input/button if you have them on the start screen
        // if (event.target.tagName === 'INPUT' || event.target.tagName === 'BUTTON') {
        //     return; 
        // }
        console.log("CASCADE_INPUT: 'Any key' pressed on start screen.");
        startGameCallback();
        document.removeEventListener('keydown', handleAnyKeyDown);
    };
    document.addEventListener('keydown', handleAnyKeyDown);
    console.log("CASCADE_INPUT: 'Any key' listener for start screen initialized.");
}

export { initInputListeners, getInputState, initStartScreenListener };
