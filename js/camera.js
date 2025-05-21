/**
 * @file camera.js
 * @description Manages the game camera's position and behavior.
 */

let currentCameraY = 0;
let internalConstants = null;

/**
 * Initializes the camera module with necessary constants.
 * @param {object} constants - The game's constants module.
 */
export function initCamera(constants) {
    internalConstants = constants;
    currentCameraY = 0;
    if (internalConstants.DEBUG_MODE) {
        console.log('CASCADE_CAMERA_LOG: Camera initialized.');
    }
}

/**
 * Resets the camera's Y position to 0.
 */
export function resetCamera() {
    currentCameraY = 0;
    if (internalConstants && internalConstants.DEBUG_MODE) {
        console.log('CASCADE_CAMERA_LOG: Camera reset.');
    }
}

/**
 * Updates the camera's Y position based on the climber's world Y position.
 * @param {number} climberWorldY - The climber's absolute Y position in the game world.
 */
export function updateCamera(climberWorldY) {
    if (!internalConstants) {
        console.error("CASCADE_CAMERA_ERROR: Constants not initialized in Camera module.");
        return;
    }

    const climbThreshold = internalConstants.CANVAS_HEIGHT * internalConstants.CAMERA_CLIMBER_Y_SCREEN_THRESHOLD_FACTOR;
    
    // If the climber's position on the screen (climberWorldY - currentCameraY)
    // is less than the threshold, move the camera up.
    if (climberWorldY - currentCameraY < climbThreshold) {
        currentCameraY = climberWorldY - climbThreshold;
    }

    // Ensure camera doesn't go below 0 (top of the game world)
    currentCameraY = Math.max(0, currentCameraY);
}

/**
 * Gets the current Y position of the camera.
 * @returns {number} The current camera Y offset.
 */
export function getCameraY() {
    return currentCameraY;
}
