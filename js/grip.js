/**
 * @file grip.js
 * @description Defines the Grip class, representing individual handholds or footholds in the game.
 * Grips have various states (hidden, visible, active, degrading, failed, revivable)
 * and properties like size, type (regular or crack), and timers for state transitions.
 */

import { 
    GRIP_SIZE_MIN, GRIP_SIZE_MAX, GRIP_COLOR_VISIBLE, GRIP_COLOR_ACTIVE, 
    GRIP_COLOR_FAILED, GRIP_COLOR_HIDDEN, 
    GRIP_TYPE_NORMAL, GRIP_TYPE_CRACK, 
    GRIP_COLOR_REVIVABLE_PRIMARY, GRIP_COLOR_REVIVABLE_SECONDARY,
    GRIP_ACTIVE_DURATION, GRIP_REVIVAL_DURATION, GRIP_BLINK_INTERVAL,
    GRIP_COLOR_DEGRADING_START, GRIP_DEGRADE_TRANSITION_DURATION,
    GRIP_REVEAL_DURATION, CLIMBER_REACH,
    GRIP_SIZE_NORMAL_MIN, GRIP_SIZE_NORMAL_MAX,
    NORMAL_GRIP_CRACK_CHANCE,
    GRIP_ROUND_WAVINESS_SEGMENTS, GRIP_ROUND_WAVINESS_AMPLITUDE,
    GRIP_PROXIMITY_REVEAL_DISTANCE
} from './constants.js';
import { getRandomChance, getRandomAngle, getRandomElement, getRandomFloat, lerpColor, hexToRgb } from './utils.js'; // Added hexToRgb

// Assumed global: ctx, playSound, climber (for climberRef)
// We'll need to pass ctx for drawing, and handle playSound and climber interactions via parameters or a game manager instance.

class Grip {
    constructor(x, y, id, type = GRIP_TYPE_NORMAL, isInitialGrip = false, initialSize = null, options = {}) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.type = type; // normal, crack
        this.isInitialGripFlag = isInitialGrip; // Store this for potential future use, though not directly used in current logic changes

        // Win condition flags
        this.isWinGrip = options.isWinGrip || false;
        this.isPreLastGrip = options.isPreLastGrip || false;

        // Determine size based on type, or use initialSize if provided
        if (initialSize !== null) {
            this.size = initialSize;
        } else {
            switch (this.type) {
                case GRIP_TYPE_NORMAL:
                    this.size = getRandomFloat(GRIP_SIZE_NORMAL_MIN, GRIP_SIZE_NORMAL_MAX);
                    break;
                case GRIP_TYPE_CRACK:
                    this.size = getRandomFloat(GRIP_SIZE_MIN, GRIP_SIZE_MAX); // Original range for cracks
                    break;
                default:
                    this.size = getRandomFloat(GRIP_SIZE_NORMAL_MIN, GRIP_SIZE_NORMAL_MAX); // Fallback
                    break;
            }
        }

        this.state = 'hidden'; // hidden, revealing, visible, active, degrading, failed, revivable, reviving
        this.timer = 0; // General purpose timer for states
        this.stateStartTime = 0; // Timestamp when the current state started
        this.activeDuration = GRIP_ACTIVE_DURATION + getRandomFloat(-500, 500); // ms, slight variation
        this.parsedVisibleColor = hexToRgb(GRIP_COLOR_VISIBLE); // Pre-parse for shimmer
        this.degradationTime = GRIP_ACTIVE_DURATION + (getRandomFloat(-50, 50)); // Slight variation
        
        // Determine if it's a crack based on type and chance
        if (this.type === GRIP_TYPE_CRACK) {
            this.isCrack = true; // Crack types are always cracks
        } else if (this.type === GRIP_TYPE_NORMAL) {
            this.isCrack = getRandomChance(NORMAL_GRIP_CRACK_CHANCE);
        } else {
            this.isCrack = false; // Fallback for any other types
        }

        this.revealTimer = 100; // Timer for reveal animation
        this.isReachable = false; // Tracks if the grip is currently within climber's reach

        // Restore potentially missing properties (assuming default initial values if not known)
        this.lastTouchedByProtection = false; 
        this.isProtectionTarget = false; 
        this.shimmerAngle = 0;

        if (this.isCrack) {
            this.angle = getRandomAngle(); // Cracks can also have any orientation
            const minGapPercent = 0.15;
            const maxGapPercent = 0.30;
            this.crackGap = this.size * (minGapPercent + getRandomFloat(0, maxGapPercent - minGapPercent));
            const targetTotalWidth = this.size / 1.20;
            this.crackSideWidth = (targetTotalWidth - this.crackGap) / 2;
            const minSideWidth = this.size * 0.1;
            if (this.crackSideWidth < minSideWidth) {
                this.crackSideWidth = minSideWidth;
            }
        } else {
            this.angle = getRandomAngle(); // Random orientation
            // Initialize perturbations for grip waviness/faceting
            this.roundGripPerturbations = [];
            const numSegments = Math.floor(getRandomFloat(3, GRIP_ROUND_WAVINESS_SEGMENTS + 1)); // Min 3, max GRIP_ROUND_WAVINESS_SEGMENTS
            for (let i = 0; i < numSegments; i++) {
                this.roundGripPerturbations.push(getRandomFloat(-GRIP_ROUND_WAVINESS_AMPLITUDE, GRIP_ROUND_WAVINESS_AMPLITUDE));
            }
        }

        this.isRevivable = false; // Can this grip become revivable after being used/failed?
        this.revivalTimer = 0;    // Countdown timer when in 'reviving' state
        this.blinkOn = true;      // For blinking animation during revival
        this.blinkTimer = 0;

        this.climberRef = null; // Reference to the climber currently on this grip

        // Dependency injection for functions that might come from other modules
        this.playSound = options.playSoundFn || null; 
        this.getClimber = options.getClimberCb || null; 
        this.getContext = options.getCtxFn || null; 

        // Distortion properties - static per grip
        this.distortionScaleX = getRandomFloat(0.85, 1.15); // e.g., 15% variation
        this.distortionScaleY = getRandomFloat(0.85, 1.15);

        // Static shadow properties per grip
        const maxShadowRandomOffsetX = 2.5;
        const maxShadowRandomOffsetY = 2.5;
        const maxShadowRandomRotationAngle = 0.08; // Radians, approx +/- 4.5 degrees
        this.staticShadowOffsetX = getRandomFloat(-maxShadowRandomOffsetX, maxShadowRandomOffsetX);
        this.staticShadowOffsetY = getRandomFloat(-maxShadowRandomOffsetY, maxShadowRandomOffsetY);
        this.staticShadowRotationAngle = getRandomFloat(-maxShadowRandomRotationAngle, maxShadowRandomRotationAngle);

        // Static crack waviness properties per grip
        if (this.isCrack) {
            this.crackPerturbFactors = {
                side1Left: getRandomFloat(-1, 1),
                side1Right: getRandomFloat(-1, 1),
                side2Left: getRandomFloat(-1, 1),
                side2Right: getRandomFloat(-1, 1),
            };
        } else {
            // No need for sliceSweepAngle
        }
    }

    _parseRgb(rgbString) {
        const match = rgbString.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
        if (match) {
            return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) };
        }
        return null; // Or a default color
    }

    draw(cameraY) { 
        const currentCtx = this.getContext();
        if (!currentCtx) return;

        currentCtx.save();
        currentCtx.translate(this.x, this.y + cameraY); // Apply camera offset
        currentCtx.scale(this.distortionScaleX, this.distortionScaleY); // Apply static distortion scaling
        currentCtx.rotate(this.angle);

        let fillColor = GRIP_COLOR_VISIBLE; // Default color
        let alpha = 1.0;

        switch (this.state) {
            case 'hidden':
                fillColor = GRIP_COLOR_HIDDEN;
                break;
            case 'revealing':
                if (this.parsedVisibleColor) {
                    const revealProgress = Math.min(1, this.revealTimer / GRIP_REVEAL_DURATION);
                    alpha = revealProgress; // Fade in
                    fillColor = `rgba(${this.parsedVisibleColor.r}, ${this.parsedVisibleColor.g}, ${this.parsedVisibleColor.b}, ${alpha})`;
                } else {
                    fillColor = GRIP_COLOR_VISIBLE; // Fallback
                }
                break;
            case 'visible':
                // GRIP_COLOR_OUT_OF_REACH has been removed by the user.
                // Visible grips will now use GRIP_COLOR_VISIBLE regardless of reachability.
                fillColor = GRIP_COLOR_VISIBLE;
                break;
            case 'active': 
                fillColor = GRIP_COLOR_ACTIVE; // Active state has its own color, not affected by out-of-reach grey
                break;
            case 'degrading':
                const factor = Math.min(1, this.timer / GRIP_DEGRADE_TRANSITION_DURATION);
                fillColor = lerpColor(GRIP_COLOR_DEGRADING_START, GRIP_COLOR_VISIBLE, factor); // Degrading has its own color progression
                break;
            case 'failed': 
                if (this.isRevivable) {
                    const blinkOn = Math.floor((Date.now() - this.stateStartTime) / GRIP_BLINK_INTERVAL) % 2 === 0;
                    fillColor = blinkOn ? GRIP_COLOR_REVIVABLE_PRIMARY : GRIP_COLOR_REVIVABLE_SECONDARY;
                } else {
                    fillColor = GRIP_COLOR_FAILED;
                } // Failed state has its own color/logic
                break;
            case 'reviving': 
                // Assuming blinkOn is correctly set in update method for this state if needed for reviving visual
                fillColor = this.blinkOn ? GRIP_COLOR_VISIBLE : GRIP_COLOR_HIDDEN; // Reviving has its own visual logic
                break;
            case 'revivable': 
                // Assuming blinkOn is correctly set in update method for this state
                fillColor = this.blinkOn ? GRIP_COLOR_REVIVABLE_PRIMARY : GRIP_COLOR_REVIVABLE_SECONDARY; // Revivable state has its own color
                break;
            default: // Includes 'hidden', 'revealing', 'reviving' and potentially others if not explicitly cased
                // If a grip is 'visible' but not reachable, it gets a specific color.
                // Otherwise, for 'hidden', 'revealing', etc., they use their distinct appearance logic.
                // The default here should probably be GRIP_COLOR_HIDDEN or a fallback,
                // as other states like 'active', 'failed' have their own cases.
                // The previous logic here was complex and also relied on GRIP_COLOR_OUT_OF_REACH.
                // Given the 'visible' case above now handles 'visible' grips simply,
                // this default can be simplified to GRIP_COLOR_HIDDEN for states not explicitly handled.
                fillColor = GRIP_COLOR_HIDDEN; 
                break;
        }

        // Shadow properties
        const shadowDarkenFactor = 0.3; // 0: original color, 1: black
        let r_shadow = 0, g_shadow = 0, b_shadow = 0;
        let alpha_shadow = 1.0; // Default full alpha for shadow
        let finalShadowColor = 'rgba(0,0,0,0.4)'; // Fallback shadow color

        if (typeof fillColor === 'string' && fillColor.startsWith('#')) { // Hex color
            const baseRgb = hexToRgb(fillColor); // Assumes hexToRgb is available
            if (baseRgb) {
                r_shadow = Math.round(baseRgb.r * (1 - shadowDarkenFactor));
                g_shadow = Math.round(baseRgb.g * (1 - shadowDarkenFactor));
                b_shadow = Math.round(baseRgb.b * (1 - shadowDarkenFactor));
                // Alpha for hex-derived shadows defaults to 1.0 (opaque)
                finalShadowColor = `rgba(${r_shadow},${g_shadow},${b_shadow},${alpha_shadow})`;
            }
        } else if (typeof fillColor === 'string' && fillColor.startsWith('rgba')) { // RGBA color string
            const match = fillColor.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
            if (match) {
                r_shadow = Math.round(parseInt(match[1]) * (1 - shadowDarkenFactor));
                g_shadow = Math.round(parseInt(match[2]) * (1 - shadowDarkenFactor));
                b_shadow = Math.round(parseInt(match[3]) * (1 - shadowDarkenFactor));
                alpha_shadow = parseFloat(match[4]); // Use original alpha for shadow
                finalShadowColor = `rgba(${r_shadow},${g_shadow},${b_shadow},${alpha_shadow})`;
            }
        }

        // Apply the determined fill color to the context
        currentCtx.fillStyle = fillColor;

        // The main fillStyle for the grip will be set before drawing the main shape parts

        if (this.isCrack) {
            const perturbationAmount = this.crackSideWidth * 1.5; // Increase for more waviness

            const drawWavyRectSide = (startX, rectWidth, rectHeight, perturbFactorLeft, perturbFactorRight) => {
                currentCtx.beginPath(); // Path for one side of the crack

                const xLeft = startX;
                const xRight = startX + rectWidth;
                const yTop = -rectHeight / 2;
                const yBottom = rectHeight / 2;
                const yMid = 0; // Midpoint for vertical curve control

                // Use stored perturbation factors
                const perturbRightCtrl = xRight + perturbFactorRight * perturbationAmount;
                const perturbLeftCtrl = xLeft + perturbFactorLeft * perturbationAmount;

                currentCtx.moveTo(xLeft, yTop); // Start at top-left
                currentCtx.lineTo(xRight, yTop); // Draw top edge

                // Draw wavy right edge from top-right to bottom-right
                currentCtx.quadraticCurveTo(perturbRightCtrl, yMid, xRight, yBottom);

                currentCtx.lineTo(xLeft, yBottom); // Draw bottom edge

                // Draw wavy left edge from bottom-left to top-left
                currentCtx.quadraticCurveTo(perturbLeftCtrl, yMid, xLeft, yTop);

                currentCtx.closePath();
                currentCtx.fill(); // Fill this side
            };

            // Draw Side 1 (left piece of the crack)
            currentCtx.save();
            currentCtx.translate(this.staticShadowOffsetX, this.staticShadowOffsetY);
            currentCtx.rotate(this.staticShadowRotationAngle); // Additional random rotation for shadow
            currentCtx.fillStyle = finalShadowColor;
            drawWavyRectSide(-this.crackSideWidth - this.crackGap / 2, this.crackSideWidth, this.size, this.crackPerturbFactors.side1Left, this.crackPerturbFactors.side1Right);
            currentCtx.restore();

            currentCtx.fillStyle = fillColor; // Set for main shape
            drawWavyRectSide(-this.crackSideWidth - this.crackGap / 2, this.crackSideWidth, this.size, this.crackPerturbFactors.side1Left, this.crackPerturbFactors.side1Right);

            // Draw Side 2 (right piece of the crack)
            currentCtx.save();
            currentCtx.translate(this.staticShadowOffsetX, this.staticShadowOffsetY);
            currentCtx.rotate(this.staticShadowRotationAngle); // Additional random rotation for shadow
            currentCtx.fillStyle = finalShadowColor;
            drawWavyRectSide(this.crackGap / 2, this.crackSideWidth, this.size, this.crackPerturbFactors.side2Left, this.crackPerturbFactors.side2Right);
            currentCtx.restore();

            currentCtx.fillStyle = fillColor; // Set for main shape
            drawWavyRectSide(this.crackGap / 2, this.crackSideWidth, this.size, this.crackPerturbFactors.side2Left, this.crackPerturbFactors.side2Right);

        } else {
            // Handle non-crack grips (circles/ellipses)
            // Shadow first
            currentCtx.fillStyle = finalShadowColor;
            currentCtx.save();
            currentCtx.translate(this.staticShadowOffsetX, this.staticShadowOffsetY);
            currentCtx.rotate(this.staticShadowRotationAngle); // Use the correct property name
            // Draw wavy shadow shape
            this.drawWavyRoundShape(currentCtx); 
            currentCtx.restore();

            // Main grip shape
            currentCtx.fillStyle = fillColor;
            // Draw wavy main shape
            this.drawWavyRoundShape(currentCtx);
        }

        currentCtx.restore(); // Restore from the initial save (translate, scale, rotate)
    }

    // Method to draw the wavy/faceted shape for non-crack grips
    drawWavyRoundShape(ctx) {
        ctx.beginPath();
        const baseRadius = this.size / 2; // this.size is treated as diameter for non-crack grips
        const numInstanceSegments = this.roundGripPerturbations.length;

        if (numInstanceSegments === 0) { // Should not happen if constructor ran correctly
            ctx.arc(0, 0, baseRadius, 0, 2 * Math.PI);
            ctx.fill();
            return;
        }

        for (let i = 0; i < numInstanceSegments; i++) {
            const angle = (i / numInstanceSegments) * 2 * Math.PI;
            // Ensure we access perturbations safely, though lengths should match
            const perturbation = this.roundGripPerturbations[i % numInstanceSegments] || 0;
            const perturbedRadiusFactor = 1 + perturbation;
            const radius = baseRadius * perturbedRadiusFactor;
            const x = radius * Math.cos(angle);
            const y = radius * Math.sin(angle);

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
        ctx.fill();
    }


    update(deltaTime, climber, cameraY) {
        const now = Date.now();

        // Update isReachable status
        // Only check reachability if the grip is in a state where it *could* be interacted with directly
        // or its color might change based on reach (e.g. 'visible')
        // Active grips are inherently reachable by the climber on them.
        if (this.state === 'visible' || this.state === 'degrading' || this.state === 'failed' || this.state === 'revivable') {
            if (climber !== undefined) { 
                const distance = Math.sqrt(Math.pow(climber.x - this.x, 2) + Math.pow(climber.y - this.y, 2));
                this.isReachable = distance < CLIMBER_REACH;
            } else {
                this.isReachable = false; // Default if climber coords unavailable for check
            }
        } else if (this.state === 'active') {
            this.isReachable = true; // Grip is active, so it's reachable by definition for the climber on it
        } else {
             // For states like 'hidden', 'revealing', 'reviving', the isReachable flag is less critical for color or interaction logic handled here.
            this.isReachable = false; 
        }

        // State-specific update logic
        if (this.state === 'revealing') {
            this.revealTimer += deltaTime * 1000;
            if (this.revealTimer >= GRIP_REVEAL_DURATION) {
                this.changeState('visible');
                this.revealTimer = 0; 
            }
        } else if (this.state === 'active') {
            this.timer += deltaTime * 1000;
            if (this.timer >= this.activeDuration) {
                this.changeState('degrading');
            }
        } else if (this.state === 'degrading') {
            this.timer += deltaTime * 1000;
            if (this.timer >= GRIP_DEGRADE_TRANSITION_DURATION) { // how long it *stays* degrading
                this.changeState('failed');
            }
        } else if (this.state === 'failed') {
            if (this.isRevivable) {
                this.stateStartTime = this.stateStartTime || now; // Ensure stateStartTime is set for blinking
                // Blink logic is handled in draw based on stateStartTime
            } else {
                // If not revivable, it just stays 'failed'
            }
        } else if (this.state === 'reviving') {
            this.revivalTimer += deltaTime * 1000;
            this.blinkTimer += deltaTime * 1000;
            if (this.blinkTimer > GRIP_BLINK_INTERVAL) {
                this.blinkOn = !this.blinkOn;
                this.blinkTimer = 0;
            }
            if (this.revivalTimer >= GRIP_REVIVAL_DURATION) {
                this.changeState('visible');
                // Potentially reset other properties like activeDuration here if needed
            }
        } else if (this.state === 'revivable') {
            this.stateStartTime = this.stateStartTime || now; // Ensure stateStartTime is set for blinking
            this.blinkTimer += deltaTime * 1000;
            if (this.blinkTimer > GRIP_BLINK_INTERVAL) {
                this.blinkOn = !this.blinkOn;
                this.blinkTimer = 0;
            }
        }
    }

    changeState(newState) {
        this.state = newState;
        this.stateStartTime = Date.now();
    }

    activate() {
        if (this.state === 'hidden' || this.state === 'visible') {
            this.state = 'revealing'; // Or 'active' if direct activation is desired
            this.revealTimer = 0;
        }
    }

    release() {
        // If it was 'active' and not a crack, it might start degrading or go to visible
        // For simplicity, if it's not a crack, it just becomes 'visible' again unless it's set to degrade immediately.
        // Crack grips don't degrade from simple use, only from prolonged active state.
        if (this.state === 'active' && !this.isCrack) {
            // Option: make it 'visible' or start 'degrading' faster
            // this.state = 'visible'; // Or could set to 'degrading' based on game rules
        }
    }

    grab(climberInstance) {
        if (this.state === 'failed' || this.state === 'degrading' || this.state === 'hidden') {
            return false; // Cannot grab a failed, degrading, or hidden grip (unless rules change)
        }
        this.climberRef = climberInstance;
        this.state = 'active';
        this.timer = 0; // Reset timer when grabbed
        this.isRevivable = false; // If it was revivable, it's now active
        this.revivalTimer = 0;
        return true;
    }
}

// Export the class if using ES6 modules
export { Grip }; // if it's part of a larger module structure
