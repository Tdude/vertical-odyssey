import {
    CLIMBER_BODY_WIDTH, CLIMBER_BODY_HEIGHT, CLIMBER_HEAD_RADIUS,
    CLIMBER_COLOR, CLIMBER_HEAD_COLOR, MAX_PUMP, CLIMBER_REACH,
    INITIAL_PROTECTION_COUNT, ROUTE_START_COORDS,
    RECOVERY_DURATION, 
    PUMP_INCREASE_PER_SECOND_HANGING, PUMP_DECREASE_PER_SECOND, PUMP_DECREASE_CRACK_BONUS,
    PUMP_INCREASE_MOVE, PUMP_INCREASE_FALL_CAUGHT, PUMP_STARTING_LEVEL,
    GRIP_SIZE_MIN, GRIP_SIZE_MAX, PUMP_GRIP_SIZE_PENALTY_FACTOR,
    GRIP_PROXIMITY_REVEAL_DISTANCE, DEBUG_GRIPS_DETAILED, 
    CLIMBER_WAIST_BODY_HEIGHT_RATIO, 
    ROPE_NODE_TYPE_START, 
    // Sound Constants
    SOUND_FALL_CAUGHT, SOUND_GRAB, SOUND_PLACE_PROTECTION, 
    SOUND_CANNOT_PLACE_PROTECTION, SOUND_NO_PROTECTION_LEFT,
} from './constants.js';
import { ClimberAnimationManager } from './climberAnimation.js';
import { RopeManager } from './ropeManager.js';

/**
 * @class Climber
 * Represents the player-controlled climber character in the game.
 * Manages the climber's state, movement, pump, interactions with grips and protections,
 * fall mechanics, rope physics, and animations including facial expressions and idle behaviors.
 */
export class Climber {
    constructor(x, y, size, color, constants, playSoundFn, getCameraYFn) { 
        this.id = `climber-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; 
        this.x = x; 
        this.y = y; 
        this.canvasY = 0; 

        // Store passed dependencies
        this.playSoundFn = playSoundFn;
        this.getCameraYFn = getCameraYFn; 

        // Dimensions for drawing
        this.bodyWidth = CLIMBER_BODY_WIDTH;
        this.bodyHeight = CLIMBER_BODY_HEIGHT;
        this.headRadius = CLIMBER_HEAD_RADIUS;

        this.color = CLIMBER_COLOR;
        this.headColor = CLIMBER_HEAD_COLOR;

        this.pump = PUMP_STARTING_LEVEL; // Initialize pump to starting level
        this.currentGrip = null;
        this.isFalling = false;
        this.velocityY = 0;
        this.reach = CLIMBER_REACH; // Store reach on the climber instance
        this.protectionInventory = INITIAL_PROTECTION_COUNT;

        // Fall and recovery properties
        this.yAtFallStart = 0;
        this.targetYAfterFall = 0;
        this.catchProtection = null; 
        this.isRecovering = false;
        this.recoveryTimer = null;
        this.fallDistance = 0;
        this.isSwingRecovering = false;

        // this.recoverSound = SOUND_FALL_CAUGHT; //  SOUND_FALL_CAUGHT is used directly where needed
        // this.catchSound = SOUND_FALL_CAUGHT; // SOUND_FALL_CAUGHT is used directly where needed
        this.isBelayingUp = false;

        // Movement debounce timers
        this.moveDebounceTimerLeft = 0;
        this.moveDebounceTimerRight = 0;
        this.moveDebounceTimerUp = 0;
        this.moveDebounceTimerDown = 0;

        // Initialize Animation Manager
        this.animationManager = new ClimberAnimationManager(this.headRadius, this.bodyHeight);
        // Initialize Rope Manager
        this.ropeManager = new RopeManager(this.x, this.y, this.bodyHeight, this.playSoundFn);
    }

    draw(ctx) { 
        // Translate to climber's position for easier drawing
        ctx.save();
        ctx.translate(this.x, this.canvasY);

        // Delegate all drawing to the animation manager
        this.animationManager.drawClimber(ctx, this);

        ctx.restore();
    }

    _applyFallPhysics(deltaTimeInSeconds) {
        this.velocityY += GRAVITY * deltaTimeInSeconds;
        if (this.velocityY > FALL_SPEED_MAX) {
            this.velocityY = FALL_SPEED_MAX;
        }
        this.y += this.velocityY * deltaTimeInSeconds;
        this.fallDistance = this.y - this.yAtFallStart;
    }

    _checkFallCompletion(gameOverCallback) {
        if (this.y >= this.targetYAfterFall) {
            this.y = this.targetYAfterFall;
            this.isFalling = false;
            this.velocityY = 0;
            this.isRecovering = true;
            this.recoveryTimer = RECOVERY_DURATION;
            this.pump += PUMP_INCREASE_FALL_CAUGHT; 
            if (this.pump > MAX_PUMP) this.pump = MAX_PUMP;

            // Update climber's X position based on swing
            this.x = this.catchProtection.newClimberX; // newClimberX is from RopeManager's fall details
            
            // Simplify rope path now that fall is caught
            if (this.catchProtection && this.catchProtection.catchProtectionNode) {
                 this.ropeManager.simplifyRopePathAfterFall(this.catchProtection.catchProtectionNode.id, this.x, this.y);
            }

            this.animationManager.notifyActivity();
            this.animationManager.resetFaceTurn(); // Face forward after fall recovery starts

            // Play catch sound if there was a protection, otherwise it's a ground fall
            if (this.catchProtection && this.catchProtection.catchProtectionNode.type !== ROPE_NODE_TYPE_START) {
                this.playSoundFn(SOUND_FALL_CAUGHT);
            }

            if (this.catchProtection && this.catchProtection.catchProtectionNode.type === ROPE_NODE_TYPE_START && this.y >= ROUTE_START_COORDS.y) {
                // Fell to the ground
                gameOverCallback('Fell to the ground!');
            }
        }
    }

    _findCatchProtectionAndCalculateFall() {
        const fallDetails = this.ropeManager.getFallCatchDetails(this.yAtFallStart, this.x);

        this.catchProtection = {
            catchProtectionNode: fallDetails.catchProtection, // The actual node object
            newClimberX: fallDetails.newClimberX // Store the calculated X after swing
        };
        this.fallDistance = fallDetails.fallDistance;
        this.targetYAfterFall = fallDetails.targetYAfterFall;

        // Sound playing for fall distance is now handled within RopeManager.getFallCatchDetails
        this.playedFallSoundThisFall = true; // Assume sound was attempted by RopeManager

        // Log fall details for debugging
        // console.log(`Fall Details: Distance=${this.fallDistance.toFixed(2)}, TargetY=${this.targetYAfterFall.toFixed(2)}, CaughtBy=${this.catchProtection.catchProtectionNode.id}, NewX=${this.catchProtection.newClimberX}`);
    }
    
    _handleFallRecovery(deltaTimeInSeconds) {
        this.recoveryTimer -= deltaTimeInSeconds;
        if (this.recoveryTimer <= 0) {
            this.isRecovering = false;
            this.recoveryTimer = null;
            // Potentially, re-attach to the last grip if the fall was very short and caught by it,
            // or if the catch protection is a grip itself. For now, just recover.
            // If there was a swing, we might need a swing recovery phase or animation.
            // For now, assume recovery means climber is stable and can act.
            if (this.currentGrip) { // If climber was on a grip, re-establish that connection visually/logically
                // This might need adjustment if the fall significantly changed position relative to the grip
            } else {
                // If not on a grip, climber is hanging free on the rope. 
                // UI should probably indicate this state and allow belaying up or searching for grips.
            }
        }
    }

    update(deltaTimeInSeconds, gripInstances, protectionInstances, gameOverCallback, cameraYFromGame) {
        this.canvasY = this.y - cameraYFromGame;

        // Update Animation Manager
        this.animationManager.update(deltaTimeInSeconds, {
            isFalling: this.isFalling,
            isHangingOnGrip: !!this.currentGrip,
            isBelayingUp: this.isBelayingUp
        });

        // Update Rope Manager with current climber position
        this.ropeManager.updateClimberAnchor(this.x, this.y);

        // Movement debounce updates
        const DEBOUNCE_DECREMENT = deltaTimeInSeconds * 1000; // Assuming timers are in ms
        if (this.moveDebounceTimerLeft > 0) this.moveDebounceTimerLeft -= DEBOUNCE_DECREMENT;
        if (this.moveDebounceTimerRight > 0) this.moveDebounceTimerRight -= DEBOUNCE_DECREMENT;
        if (this.moveDebounceTimerUp > 0) this.moveDebounceTimerUp -= DEBOUNCE_DECREMENT;
        if (this.moveDebounceTimerDown > 0) this.moveDebounceTimerDown -= DEBOUNCE_DECREMENT;

        // Reveal/activate/hide grips based on proximity
        if (gripInstances && gripInstances.length > 0) {
            this.revealNearbyGrips(gripInstances); // This now handles all grip state changes based on proximity
        }

        if (this.isFalling) {
            this._applyFallPhysics(deltaTimeInSeconds);
            this._checkFallCompletion(gameOverCallback);
        } else if (this.isRecovering) {
            this._handleFallRecovery(deltaTimeInSeconds);
        } else if (this.isBelayingUp) {
            // Belay logic handled by belayUp method, triggered by input
            // Pump might still apply if belaying is strenuous - for now, no pump change during belay
        } else {
            // Normal state: hanging on a grip or idle
            if (this.currentGrip) {
                // Pump DECREASE while on a good grip (resting) or INCREASE on bad grip
                // This is a simplified model. Original might have had more nuance.
                let pumpChangeRate = PUMP_INCREASE_PER_SECOND_HANGING; // Default: pump increases
                if (this.currentGrip.isRest) { // Assuming a property like 'isRest' for rest grips
                     pumpChangeRate = -PUMP_DECREASE_PER_SECOND; // Pump decreases on rest
                     if (this.currentGrip.type === 'crack') { // Bonus for crack rests
                         pumpChangeRate -= PUMP_DECREASE_CRACK_BONUS;
                     }
                }
                this.pump += pumpChangeRate * deltaTimeInSeconds;
                this.x = this.currentGrip.x; // Stay on grip
                this.y = this.currentGrip.y;

            } else {
                // Not on a grip and not falling/recovering/belaying - Dangling on rope
                this.pump += PUMP_INCREASE_PER_SECOND_HANGING * deltaTimeInSeconds; // Pump increases while dangling
                // Sway or other idle behavior for dangling could be added here.
            }
            // Clamp pump after all increases/decreases for the frame
            this.pump = Math.max(0, Math.min(this.pump, MAX_PUMP));

            // Check for fall due to max pump
            if (this.pump >= MAX_PUMP) {
                this.fall('Exhaustion - Pumped out!');
                if (gameOverCallback) {
                    // Consider if game over should be immediate or after fall is resolved
                    // gameOverCallback('pump_out'); 
                }
            }
        }
    }

    moveToGrip(grip, gripInstances, protectionInstances) {
        if (this.isFalling || this.isRecovering || this.isBelayingUp) return false;

        const distance = Math.hypot(this.x - grip.x, this.y - grip.y);
        if (distance > this.reach) {
            return false; // Grip out of reach
        }

        if (this.currentGrip) {
            // currentGrip.release(); // Assuming grips have a release method
        }

        if (Math.abs(this.x - grip.x) > this.bodyWidth * 0.5) {
            this.animationManager.startFaceTurn();
        } else {
            this.animationManager.resetFaceTurn();
        }

        this.x = grip.x;
        this.y = grip.y;
        this.currentGrip = grip;
        // grip.grab(this); // Assuming grips have a grab method
        this.pump += PUMP_INCREASE_MOVE;
        if (this.pump > MAX_PUMP) this.pump = MAX_PUMP;

        this.playSoundFn(SOUND_GRAB, { variation: Math.random() * 0.2 + 0.9 });
        this.animationManager.notifyActivity();
        
        // If climber was recovering, successfully moving to a grip ends recovery early
        if (this.isRecovering) {
            this.isRecovering = false;
            this.recoveryTimer = null;
            this.catchProtection = null; 
        }
        this.resetFallSoundFlag(); // Reset sound flag after successful move
        return true;
    }

    belayUp(deltaTimeInSeconds, startOrStop) {
        if (this.isFalling || this.isRecovering) return;

        if (startOrStop === 'start' && !this.isBelayingUp) {
            if (this.currentGrip) return; // Cannot belay if holding a grip
            this.isBelayingUp = true;
            this.animationManager.startRopeClimbingAnimation();
            this.ropeManager.startBelay();
            this.playSoundFn(SOUND_BELAY_START, { loop: false }); 
        } else if (startOrStop === 'stop' && this.isBelayingUp) {
            this.isBelayingUp = false;
            this.animationManager.stopRopeClimbingAnimation();
            this.ropeManager.finishBelay();
            this.playSoundFn(SOUND_BELAY_STOP, { loop: false }); 
        }

        if (this.isBelayingUp && deltaTimeInSeconds > 0) {
            const belaySpeed = CLIMBER_BELAY_SPEED; // Pixels per second
            const dy = belaySpeed * deltaTimeInSeconds;
            const newClimberY = this.y - dy;

            // Check if move is allowed by rope manager (not pulling against taut rope)
            if (this.ropeManager.updateBelaySlackAndCheckLimit(this.x, newClimberY)) {
                const lastProtectionY = this.ropeManager.getLastProtectionY();
                if (newClimberY < lastProtectionY - this.headRadius) { // Don't belay past (above) last protection point
                    this.y = newClimberY;
                    this.animationManager.notifyActivity();
                } else {
                    // Reached near last protection, stop further belay unless it's the start anchor far below
                    if (this.ropeManager.lastProtectionNodeIndex === 0 && newClimberY < ROUTE_START_COORDS.y - this.headRadius) {
                        this.y = newClimberY;
                        this.animationManager.notifyActivity();
                    } else {
                        // console.log("Belay limited by protection proximity.");
                        // Optionally play a 'rope taut' sound or provide other feedback
                    }
                }
            } else {
                 // console.log("Belay move blocked by rope manager (rope taut).");
                 // Optionally play a 'rope taut' sound
            }
        }
    }

    placeProtection(protection, protectionInstances) {
        if (this.isFalling || this.isRecovering || this.isBelayingUp) return false;
        if (this.protectionInventory <= 0) {
            // console.log("No protection left to place.");
            this.playSoundFn(SOUND_NO_PROTECTION_LEFT);
            return false; // No protection left
        }

        // Protection must be placed on a valid grip that the climber is currently holding
        if (!this.currentGrip || this.currentGrip.id !== protection.relatedGripId) {
            // console.log("Cannot place protection: not on the related grip or not on any grip.");
            this.playSoundFn(SOUND_CANNOT_PLACE_PROTECTION);
            return false;
        }
        
        // Check if this protection instance has already been used as a rope node point
        // This check might be better inside RopeManager if it stores all node IDs
        // For now, assume protections are unique and can be clipped once.
        // if (this.ropePathNodes.some(node => node.id === protection.id)) {
        //     console.log("Protection already clipped.");
        //     return false; 
        // }

        this.ropeManager.placeProtection(protection.x, protection.y, protection.id);
        this.protectionInventory--;
        this.playSoundFn(SOUND_PLACE_PROTECTION);
        this.animationManager.notifyActivity();
        // console.log(`Placed protection ${protection.id}. Inventory: ${this.protectionInventory}`);
        return true;
    }

    recoverFromPump() {
        if (this.isFalling || this.isRecovering || this.isBelayingUp) return;

        // Climber must be on a "no-hands" rest grip to recover pump
        if (this.currentGrip && this.currentGrip.type === 'crack' && this.currentGrip.isRest) {
            this.pump -= (PUMP_DECREASE_PER_SECOND + PUMP_DECREASE_CRACK_BONUS) * (1/60); // Assuming 60 FPS, recover per frame
            if (this.pump < 0) this.pump = 0;
            // console.log(`Recovering pump on crack rest. Pump: ${this.pump.toFixed(2)}`);
            this.animationManager.notifyActivity(); // Keep animations active during recovery if needed
        } else {
            // console.log("Cannot recover pump: not on a suitable rest grip.");
        }
    }

    // Method to get the current rope path for drawing
    getRopePath() {
        return this.ropeManager.getPath();
    }

    // REMOVED addRopeNode as its functionality is covered by RopeManager
    // addRopeNode(x, y, type, id = null) {
    //     // ... logic moved to RopeManager or made redundant ...
    // }

    getPump() {
        return this.pump;
    }

    // Consolidated method to manage grip visibility and activation
    revealNearbyGrips(gripInstances) {
        if (!gripInstances) return;

        gripInstances.forEach(grip => {
            if (grip === this.currentGrip) {
                // The current grip is always 'active' and 'reachable'
                if (grip.state !== 'active') grip.changeState('active'); 
                grip.isReachable = true;
                return; // Skip further checks for the current grip
            }

            const distance = Math.hypot(this.x - grip.x, this.y - grip.y);

            if (distance <= this.reach) {
                // Grip is within direct reach
                if (grip.state !== 'active') {
                    grip.changeState('active'); 
                }
                grip.isReachable = true;
            } else if (distance <= GRIP_PROXIMITY_REVEAL_DISTANCE) {
                // Grip is within proximity but not direct reach
                if (grip.state === 'hidden') {
                    grip.changeState('revealing');
                    grip.revealTimer = 0; // Reset timer for reveal animation
                }
                grip.isReachable = false;
            } else {
                // Grip is far away
                if (grip.state !== 'hidden') {
                    grip.changeState('hidden');
                }
                grip.isReachable = false;
            }
        });
    }

    // Method to check if the climber can reach a specific grip
    canReachGrip(grip) {
        if (!grip) return false;
        const distance = Math.hypot(this.x - grip.x, this.y - grip.y);
        return distance <= this.reach; // Using the new this.reach property
    }

    handleInput(inputState, deltaTime, gripInstances, addProtectionCallback, protectionInstances) { 
        if (this.isFalling || this.isRecovering || this.isBelayingUp) return; 

        // Protection Placement
        if (inputState.KeyP && !inputState.prevKeyP) { 
            if (this.placeProtection(addProtectionCallback, gripInstances)) {
                // Optional: play sound or feedback specifically for placement success through game.js if needed
            } else {
                // Optional: play sound for placement failure (e.g. no inventory, no grip)
                if (this.playSoundFn) this.playSoundFn('error'); // A generic error sound
            }
            inputState.prevKeyP = true; // Mark as processed for this press
            return; // Prioritize protection placement over movement in same frame
        } else if (!inputState.KeyP) {
            inputState.prevKeyP = false;
        }

        // Belay Up
        if (inputState.KeyB && !inputState.prevKeyB) {
            this.belayUp(protectionInstances);
            inputState.prevKeyB = true; // Mark as processed for this press
            return; // Prioritize belay action
        } else if (!inputState.KeyB) {
            inputState.prevKeyB = false;
        }

        let targetGrip = null;
        let minDistanceSq = Infinity;

        if (inputState.ArrowLeft || inputState.ArrowRight || inputState.ArrowUp || inputState.ArrowDown) {
            gripInstances.forEach(grip => {
                if (grip === this.currentGrip) {
                    // The current grip is always 'active' and 'reachable'
                    if (grip.state !== 'active') grip.changeState('active'); 
                    grip.isReachable = true;
                    return; // Skip further checks for the current grip
                }

                const distance = Math.hypot(this.x - grip.x, this.y - grip.y);

                if (distance <= this.reach) {
                    // Grip is within direct reach
                    if (grip.state !== 'active') {
                        grip.changeState('active'); 
                    }
                    grip.isReachable = true;
                } else if (distance <= GRIP_PROXIMITY_REVEAL_DISTANCE) {
                    // Grip is within proximity but not direct reach
                    if (grip.state === 'hidden') {
                        grip.changeState('revealing');
                        grip.revealTimer = 0; // Reset timer for reveal animation
                    }
                    grip.isReachable = false;
                } else {
                    // Grip is far away
                    if (grip.state !== 'hidden') {
                        grip.changeState('hidden');
                    }
                    grip.isReachable = false;
                }

                if (grip.state === 'hidden' || !this.canReachGrip(grip)) return;

                const dx = grip.x - this.x;
                const dy = grip.y - this.y;

                // Basic directional filtering
                if (inputState.ArrowLeft && dx >= 0) return;  // Moving left, grip is to the right
                if (inputState.ArrowRight && dx <= 0) return; // Moving right, grip is to the left
                if (inputState.ArrowUp && dy >= 0) return;      // Moving up, grip is below or same level
                if (inputState.ArrowDown && dy <= 0) return;    // Moving down, grip is above or same level
                
                // Prioritize vertical movement if ArrowUp/Down is pressed
                // If only horizontal, then horizontal distance matters more.
                // If vertical, vertical distance matters more.
                let weightedDistanceSq;
                if (inputState.ArrowUp || inputState.ArrowDown) {
                    // Heavily penalize horizontal distance if vertical movement is intended
                    weightedDistanceSq = (dy * dy) + (dx * dx * 10); 
                } else {
                    // Penalize vertical distance if horizontal movement is intended
                    weightedDistanceSq = (dx * dx) + (dy * dy * 5); 
                }

                if (weightedDistanceSq < minDistanceSq) {
                    minDistanceSq = weightedDistanceSq;
                    targetGrip = grip;
                }
            });

            if (targetGrip) {
                // Debounce movement - only allow move if key was just pressed or held for a bit
                let moveAction = false;
                const keyMap = {
                    ArrowLeft: { pressed: inputState.ArrowLeft, prev: inputState.prevArrowLeft, timer: 'moveDebounceTimerLeft' },
                    ArrowRight: { pressed: inputState.ArrowRight, prev: inputState.prevArrowRight, timer: 'moveDebounceTimerRight' },
                    ArrowUp: { pressed: inputState.ArrowUp, prev: inputState.prevArrowUp, timer: 'moveDebounceTimerUp' },
                    ArrowDown: { pressed: inputState.ArrowDown, prev: inputState.prevArrowDown, timer: 'moveDebounceTimerDown' },
                };

                for (const key in keyMap) {
                    if (keyMap[key].pressed) {
                        if (!keyMap[key].prev || (this[keyMap[key].timer] && this[keyMap[key].timer] <= 0) ) {
                            moveAction = true;
                            this[keyMap[key].timer] = MOVE_DEBOUNCE_INTERVAL; // Reset debounce timer
                        }
                        inputState[`prev${key}`] = true; // Update previous state
                        if (this[keyMap[key].timer] > 0) {
                            this[keyMap[key].timer] -= deltaTime * 1000;
                        }
                    } else {
                        inputState[`prev${key}`] = false;
                        this[keyMap[key].timer] = 0; // Reset timer if key is released
                    }
                }

                if (moveAction) {
                    this.moveToGrip(targetGrip, gripInstances);
                }
            }
        }
    }


    attemptGrab(clickWorldX, clickWorldY, allGrips) {
        if (this.isFalling || this.isRecovering || this.isBelayingUp) {
            console.log("CLIMBER_GRAB_ATTEMPT: Cannot grab, climber is falling, recovering, or belaying.");
            return false;
        }

        let bestClickedGrip = null;
        let minDistanceToClimberSq = Infinity;

        for (const grip of allGrips) {
            // Ensure grip is in a grabbable state (e.g., visible, active)
            // The Grip class's canGrab() method might be more suitable if it exists and checks all conditions.
            // For now, checking common interactive states.
            if (grip.state !== 'visible' && grip.state !== 'active' && grip.state !== 'revealing') {
                continue; 
            }

            // Check if the click is within the grip's bounding box.
            // Assuming grip.size is diameter for a circular grip model.
            const dxClickToGrip = clickWorldX - grip.x;
            const dyClickToGrip = clickWorldY - grip.y;
            const distanceToGripCenterSq = dxClickToGrip * dxClickToGrip + dyClickToGrip * dyClickToGrip;
            const gripRadius = grip.size / 2;

            if (distanceToGripCenterSq <= gripRadius * gripRadius) { // Click is on this grip
                // Calculate distance from climber to this specific grip *before* the reach check
                const dxClimberToGrip = this.x - grip.x;
                const dyClimberToGrip = this.y - grip.y;

                // Now check if this clicked grip is within the climber's actual reach
                if (this.canReachGrip(grip)) {
                    // If multiple clickable grips are stacked, prefer the one the climber is closer to.
                    // Or, simply take the first one found. For simplicity, let's find the *closest to climber* among *clicked & reachable* grips.
                    const distanceClimberToGripSq = dxClimberToGrip * dxClimberToGrip + dyClimberToGrip * dyClimberToGrip;

                    if (distanceClimberToGripSq < minDistanceToClimberSq) {
                        minDistanceToClimberSq = distanceClimberToGripSq;
                        bestClickedGrip = grip;
                    }
                } else {
                    console.log(`CLIMBER_GRAB_ATTEMPT: Grip ${grip.id.substring(grip.id.length-5)} clicked, but NOT in reach. Dist: ${Math.sqrt(dxClimberToGrip*dxClimberToGrip + dyClimberToGrip*dyClimberToGrip).toFixed(1)}, Reach: ${this.reach}`);
                }
            }
        }

        if (bestClickedGrip) {
            console.log(`CLIMBER_GRAB_ATTEMPT: Attempting to move to clicked grip: ${bestClickedGrip.id.substring(bestClickedGrip.id.length-5)}`);
            // Pass allGrips to moveToGrip as it might be needed for context (e.g. updating other grips)
            return this.moveToGrip(bestClickedGrip, allGrips); 
        } else {
            console.log("CLIMBER_GRAB_ATTEMPT: No grabbable grip found at click location or within reach.");
            // Optional: Play a "miss" sound
            // if (this.playSoundFn) this.playSoundFn('miss_click'); // Example sound
            return false;
        }
    }
    // Method to move the climber towards a grip
    moveToGrip(grip) {
        if (!grip || !this.canReachGrip(grip)) {
            console.warn("Cannot move to grip: grip is null or unreachable.");
            this.logDetailedClimberState('moveToGrip_fail_unreachable');
            if (this.currentGrip) {
                this.currentGrip.failedAttemptCount = (this.currentGrip.failedAttemptCount || 0) + 1;
            }
            return false;
        }

        if (this.currentGrip) {
            this.currentGrip.release(); // Release previous grip
            this.ropeManager.updateClimberAnchor(this.x, this.y); // update rope anchor to previous grip loc
            this.ropeManager.addNode(this.x, this.y,this.currentGrip.id); // Add node for previous grip

        }

        // Move to the new grip
        this.currentGrip = grip;
        this.x = grip.x;
        this.y = grip.y;
        grip.grab(this); // Let the grip know it's been grabbed
        this.playSoundFn(SOUND_GRAB, { variation: Math.random() * 0.2 + 0.9 });

        this.isFalling = false; // Stop falling if we were
        this.fallDistance = 0;  // Reset fall distance
        this.velocityY = 0;     // Reset velocity

        // Update pump
        this.pump += PUMP_INCREASE_MOVE; 
        this.pump = Math.max(0, Math.min(this.pump, MAX_PUMP));
        this.uiManager.updatePump(this.pump, MAX_PUMP);

        this.ropeManager.updateClimberAnchor(this.x,this.y); // Update rope to new grip
        this.ropeManager.addNode(this.x, this.y, this.currentGrip.id);

        // Ensure climber is not stuck in belaying state
        if (this.isBelayingUp) {
            this.stopBelay();
        }

        this.debugLog(`Moved to grip ${grip.id} at (${grip.x}, ${grip.y}). Pump: ${this.pump.toFixed(1)}`);
        this.logDetailedClimberState('moveToGrip_success');
        return true;
    }

    // Method for the climber to fall
    fall(reason = 'Lost grip') {
        if (this.isFalling || this.isRecovering || this.isBelayingUp) return; // Already falling or belaying (can't fall while belaying)

        // console.log(`Climber falling: ${reason}`);
        this.isFalling = true;
        this.yAtFallStart = this.y;
        // this.xAtFallStart = this.x; // xAtFallStart is passed directly to ropeManager
        this.velocityY = 0; // Initial fall velocity
        this.currentGrip = null; // Detach from any grip
        this.playedFallSoundThisFall = false;

        this.animationManager.notifyActivity();
        this.animationManager.resetFaceTurn(); // Face forward when falling

        this._findCatchProtectionAndCalculateFall();
    }

    // Method to remove the oldest protection piece
    removeOldestProtection() {
        if (this.placedProtections.length > 0) {
            const removedProtection = this.placedProtections.shift(); // Remove from the beginning of the array
            this.debugLog(`Removed oldest protection at (${removedProtection.x.toFixed(0)}, ${removedProtection.y.toFixed(0)})`);
            // The protection instance itself is removed from the array. 
            // If it needs to be removed from a global list of protections, that should be handled by the Game class or similar.
            this.rockFace.removeProtection(removedProtection); // Assuming RockFace handles the visual/logical removal from the game world
        }
    }

    // Method to handle belaying up
    belayUp(deltaTimeInSeconds, startOrStop) {
        if (this.isFalling || this.isRecovering) return;

        if (startOrStop === 'start' && !this.isBelayingUp) {
            if (this.currentGrip) return; // Cannot belay if holding a grip
            this.isBelayingUp = true;
            this.animationManager.startRopeClimbingAnimation();
            this.ropeManager.startBelay();
            this.playSoundFn(SOUND_BELAY_START, { loop: false }); 
        } else if (startOrStop === 'stop' && this.isBelayingUp) {
            this.isBelayingUp = false;
            this.animationManager.stopRopeClimbingAnimation();
            this.ropeManager.finishBelay();
            this.playSoundFn(SOUND_BELAY_STOP, { loop: false }); 
        }

        if (this.isBelayingUp && deltaTimeInSeconds > 0) {
            const belaySpeed = CLIMBER_BELAY_SPEED; // Pixels per second
            const dy = belaySpeed * deltaTimeInSeconds;
            const newClimberY = this.y - dy;

            // Check if move is allowed by rope manager (not pulling against taut rope)
            if (this.ropeManager.updateBelaySlackAndCheckLimit(this.x, newClimberY)) {
                const lastProtectionY = this.ropeManager.getLastProtectionY();
                if (newClimberY < lastProtectionY - this.headRadius) { // Don't belay past (above) last protection point
                    this.y = newClimberY;
                    this.animationManager.notifyActivity();
                } else {
                    // Reached near last protection, stop further belay unless it's the start anchor far below
                    if (this.ropeManager.lastProtectionNodeIndex === 0 && newClimberY < ROUTE_START_COORDS.y - this.headRadius) {
                        this.y = newClimberY;
                        this.animationManager.notifyActivity();
                    } else {
                        // console.log("Belay limited by protection proximity.");
                        // Optionally play a 'rope taut' sound or provide other feedback
                    }
                }
            } else {
                 // console.log("Belay move blocked by rope manager (rope taut).");
                 // Optionally play a 'rope taut' sound
            }
        }
    }

    // Debug logging helper
    debugLog(message) {
        if (DEBUG_MODE) {
            console.log(`[Climber] ${message}`);
        }
    }
    
    // Extended debug logging for detailed state
    logDetailedClimberState(context = 'Generic') {
        if (DEBUG_MODE && DEBUG_CLIMBER_DETAILED) {
            console.log(`[Climber Detailed State - ${context}]: 
                Position: (${this.x.toFixed(2)}, ${this.y.toFixed(2)}), CanvasY: ${this.canvasY ? this.canvasY.toFixed(2) : 'N/A'}
                VelocityY: ${this.velocityY.toFixed(2)}, IsFalling: ${this.isFalling}, FallDistance: ${this.fallDistance.toFixed(2)}
                CurrentGrip: ${this.currentGrip ? this.currentGrip.id : 'None'}, TargetGrip: ${this.targetGrip ? this.targetGrip.id : 'None'}
                Pump: ${this.pump.toFixed(2)} / ${MAX_PUMP}
                Protections: ${this.protectionCount} (Placed: ${this.placedProtections.length})
                Rope Slack: ${this.ropeManager ? this.ropeManager.slack.toFixed(2) : 'N/A'}, Rope Length: ${this.ropeManager ? this.ropeManager.totalLength.toFixed(2) : 'N/A'}
                IsRecovering: ${this.isRecovering}, RecoveryTimer: ${this.recoveryTimer.toFixed(2)}
                IsBelayingUp: ${this.isBelayingUp}, BelayRopeConsumed: ${this.belayRopeConsumed.toFixed(2)}
                Move Debounce (L/R/U/D): ${this.moveDebounceTimerLeft.toFixed(0)}/${this.moveDebounceTimerRight.toFixed(0)}/${this.moveDebounceTimerUp.toFixed(0)}/${this.moveDebounceTimerDown.toFixed(0)}
            `);
        }
    }
}
