// Get canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements (assuming these are already defined from previous steps)
const instructionsScreen = document.getElementById('instructionsScreen');
const gameContainer = document.getElementById('game-container');
const scoreDisplay = document.getElementById('score');
const staminaDisplay = document.getElementById('stamina');
const protectionCountDisplay = document.getElementById('protectionCount');
const currentHeightDisplay = document.getElementById('currentHeight');
const gameOverScreen = document.getElementById('gameOverScreen');
const finalScoreDisplay = document.getElementById('finalScore');
const highScoreDisplayElement = document.getElementById('highScoreDisplay');
const restartButton = document.getElementById('restartButton');
const uiContainer = document.getElementById('ui-container');

// Game constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 1200;
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

const CLIMBER_BODY_WIDTH = 12;
const CLIMBER_BODY_HEIGHT = 18;
const CLIMBER_HEAD_RADIUS = 5;
const CLIMBER_COLOR = '#3345cc'; 
const CLIMBER_HEAD_COLOR = '#FFC0CB'; 
const CLIMBER_REACH = 75;

const MAX_STAMINA = 180; // Increased from 100 for more endurance
const STAMINA_REGEN_PER_SECOND = 5;         // Stamina points regenerated per second while resting
const STAMINA_REGEN_CRACK_BONUS = 2.5;      // Extra stamina regen per second on a crack grip
const STAMINA_COST_MOVE = 15;               // Stamina cost for successfully reaching a new grip
const STAMINA_COST_PER_SECOND_MOVING = 7;   // Stamina cost per second while actively moving
const STAMINA_COST_FALL_CAUGHT = 40;        // Stamina penalty for a fall caught by protection
const STAMINA_RECOVERY_THRESHOLD = 25;      // Stamina level at which climber is no longer exhausted
const INITIAL_PROTECTION_COUNT = 3;
const MAX_CATCHABLE_FALL_DISTANCE = 360; // Approx 6 grips fall limit

const GRIP_SIZE_MIN = 7;
const GRIP_SIZE_MAX = 14;
const GRIP_AVG_SIZE = (GRIP_SIZE_MIN + GRIP_SIZE_MAX) / 2;
const MIN_GRIP_SEPARATION = GRIP_AVG_SIZE * 2.25; // Min distance between centers of any two grips
const GRIP_PROXIMITY_REVEAL_DISTANCE = CLIMBER_REACH * 1.2;
const GRIP_ACTIVE_DURATION = 250;
const GRIP_COLOR_HIDDEN = 'rgba(100, 100, 100, 0.1)';
const GRIP_COLOR_VISIBLE = '#999090'; // Gray
const GRIP_COLOR_ACTIVE = '#FFFF00';
const GRIP_COLOR_DEGRADING = '#FFA500';
const GRIP_COLOR_FAILED = '#404040';

const PROTECTION_SIZE = 8;
const PROTECTION_COLOR = '#00FFFF';
const PROTECTION_LAND_WINDOW_Y = PROTECTION_SIZE * 2;
const PROTECTION_LAND_WINDOW_X = PROTECTION_SIZE * 3;

const GRAVITY = 1500;
const TERMINAL_GRAVITY_MULTIPLIER = 1.8;
const FALL_SPEED_MAX = 900; // Max speed climber can fall (pixels per second)
const TERMINAL_FALL_RESET_DELAY = 2500;

const WALL_COLOR_MIN_SHADE = 70;
const WALL_COLOR_MAX_SHADE = 100;
const WALL_CHUNK_SIZE = 40;

// ADDED: Rope styling and start coordinates
const ROPE_COLOR = '#559940';
const ROPE_THICKNESS = 2;
const ROUTE_START_COORDS = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 30 }; // Fixed anchor point at bottom-center

// Game state variables
let climber;
let grips = [];
let protections = [];
let cameraY = 0;
let targetCameraY = 0; // New variable to track target camera position
let score = 0;
let maxAchievedRawY;
let gameState = 'initial';
let wallTexture = [];
let terminalFallTimer = null;
let animationFrameId = null;
let showDebugInfo = false; // For toggling debug display

// High Score
const HIGH_SCORE_KEY = 'verticalOdysseyHighScore';
let highScore = 0;

// Audio
let audioCtx;

function initAudio() {
    // ... (Audio functions as before) ...
    if (audioCtx) return; 
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.warn("Web Audio API is not supported. Sound effects disabled.");
        audioCtx = null;
    }
}

function playSound(type) {
    if (!audioCtx) return;
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    let duration = 0.15;

    switch (type) {
        case 'grab':
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(540, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            duration = 0.1;
            break;
        case 'placeProtection':
            oscillator.type = 'sawtooth'; // Was 'noise'
            oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
            duration = 0.1;
            break;
        case 'fall':
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(200, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.5);
            gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
            duration = 0.5;
            break;
        case 'terminalFallSound':
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.8);
            gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
            duration = 0.8;
            break;
        case 'degradeTick':
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.02, audioCtx.currentTime);
            duration = 0.08;
            break;
        case 'gripFail':
            oscillator.type = 'sawtooth';
            const bandpass = audioCtx.createBiquadFilter();
            bandpass.type = "bandpass";
            bandpass.frequency.setValueAtTime(1000, audioCtx.currentTime);
            bandpass.Q.setValueAtTime(0.7, audioCtx.currentTime);
            oscillator.connect(bandpass);
            bandpass.connect(gainNode);
            gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
            duration = 0.2;
            break;
        case 'fallCaughtSound':
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(300, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.5);
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            duration = 0.5;
            break;
        default: return;
    }
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + duration);
}

class Climber {
    constructor(x, y) {
        this.id = `climber-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; // Unique ID
        this.x = x; // Center X of the climber
        this.y = y; // Center Y of the climber (approx mid-body)
        this.canvasY = 0; // Y position on the canvas after camera adjustment

        // Dimensions for drawing
        this.bodyWidth = CLIMBER_BODY_WIDTH;
        this.bodyHeight = CLIMBER_BODY_HEIGHT;
        this.headRadius = CLIMBER_HEAD_RADIUS;

        this.color = CLIMBER_COLOR;
        this.headColor = CLIMBER_HEAD_COLOR;

        this.stamina = MAX_STAMINA;
        this.currentGrip = null;
        this.isFalling = false;
        this.velocityY = 0;
        this.reach = CLIMBER_REACH;
        this.protectionInventory = INITIAL_PROTECTION_COUNT;

        // Fall and recovery properties
        this.yAtFallStart = 0;
        this.targetYAfterFall = 0;
        this.catchProtection = null;
        this.isRecovering = false;
        this.recoveryTimer = null;
        this.fallDistance = 0; // Initialize fallDistance
        this.isSwingRecovering = false; // Flag for swing during recovery
        this.RECOVERY_DURATION = 2000; // Duration for recovery in ms
        this.recoverSound = 'fallCaughtSound'; // Sound to play at recovery end
        this.catchSound = 'fallCaughtSound'; // Sound to play when caught by protection

        // ADDED: Rope mechanics properties
        this.ropePathNodes = [{ x: ROUTE_START_COORDS.x, y: ROUTE_START_COORDS.y, type: 'start', id: 'start-anchor' }]; // Initialize with the starting anchor
        this.ropeAnchorX = this.x;
        this.ropeAnchorY = this.y - this.bodyHeight * 0.4; // Approx waist position
        this.playedFallSoundThisFall = false; // Flag to manage fall sound playback
    }

    draw() {
        this.canvasY = this.y - cameraY;
        //console.log(`DRAWCLIMBER: Drawing climber at X: ${this.x.toFixed(2)}, Y: ${this.y.toFixed(2)}`);
        // --- CLIMBER DRAWING ---
        // The "animation" of the climber is its position (this.x, this.canvasY) changing each frame.
        // The shape itself is static in this version.
        // For sprite-based animation (like in many 2D games):
        // 1. You'd have an image (sprite sheet) with different poses (frames) of the climber.
        // 2. You'd load this image.
        // 3. In this draw() function, you'd select a specific frame from the sprite sheet
        //    based on the climber's state (e.g., reaching, idle, falling) and draw that part of the image
        //    using ctx.drawImage(this.spriteSheet, frameX, frameY, frameWidth, frameHeight, this.x - offset, this.canvasY - offset, drawWidth, drawHeight).
        //
        // Using an SVG:
        // - If you have an SVG file, you could load it as an image and draw it.
        // - Or, you could parse the SVG's path data and draw it using canvas path commands. This is complex.
        // - Creating a detailed SVG *from* a raster image (like your JPG link) automatically is very hard
        //   and usually not practical for clean game assets. It's better to trace or create it manually.

        // Current simple shape drawing: Body and Head
        const bodyTopY = this.canvasY - this.bodyHeight / 2 + this.headRadius / 2; // Adjust body pos for head
        const headCenterX = this.x;
        const headCenterY = bodyTopY - this.headRadius * 1.2; // Position head above body

        // DEBUG LOG: Check climber's world Y and canvas Y, cameraY, and targetCameraY, especially during fall
        if (this.isFalling) {
            //console.log(`Climber Draw (Falling): WorldY: ${this.y.toFixed(1)}, CanvasY: ${this.canvasY.toFixed(1)}, CameraY: ${cameraY.toFixed(1)}, TargetCamY: ${typeof targetCameraY !== 'undefined' ? targetCameraY.toFixed(1) : 'undefined'}`);
        }

        // Optimization: Don't draw if completely off-screen vertically
        if (this.canvasY < -this.bodyHeight * 2 || this.canvasY > CANVAS_HEIGHT + this.bodyHeight * 2) {
            // console.log(`Climber not drawn: Off-screen. CanvasY: ${this.canvasY.toFixed(1)}`);
            return;
        }

        // Body (rounded rectangle)
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.roundRect(
            this.x - this.bodyWidth / 2,
            bodyTopY,
            this.bodyWidth,
            this.bodyHeight,
            this.bodyWidth / 4 // Corner radius
        );
        ctx.fill();

        // Head (circle)
        ctx.fillStyle = this.headColor;
        ctx.beginPath();
        ctx.arc(headCenterX, headCenterY, this.headRadius, 0, Math.PI * 2);
        ctx.fill();

        // Draw reach indicator
        if (this.currentGrip && !this.isFalling && this.stamina > 0 && (gameState === 'playing' || gameState === 'falling')) {
            ctx.beginPath();
            // Anchor reach circle from approx hand position if body is drawn, else from center
            const reachAnchorX = this.x; 
            const reachAnchorY = this.y - this.bodyHeight * 0.2; // Approx shoulder/hand height
            ctx.arc(reachAnchorX, reachAnchorY - cameraY, this.reach, 0, Math.PI * 2.1);
            ctx.strokeStyle = 'rgba(200, 200, 200, 0.08)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }

    update(deltaTimeInSeconds) { 
        // console.log(`Climber.update() called. ID: ${this.id}, isFalling: ${this.isFalling}, isRecovering: ${this.isRecovering}, gameState: ${gameState}, y: ${this.y.toFixed(2)}, x: ${this.x.toFixed(2)}, stamina: ${this.stamina.toFixed(1)}`);

        if (this.isRecovering) {
            this.recoveryTimer -= deltaTimeInSeconds * 1000; // recoveryTimer is in ms

            // Reset fall sound flag when recovering
            this.resetFallSoundFlag();

            if (this.isSwingRecovering && this.currentGrip && typeof this.fallDistance === 'number' && !isNaN(this.fallDistance) && this.fallDistance > 0) {
                const SWING_SPEED_CONSTANT = 0.006;
                const MAX_SWING_AMPLITUDE_FACTOR = 0.6; // Proportion of fallDistance
                const MAX_ABS_SWING_CAP = this.bodyHeight * 3; // Absolute cap on swing width

                const normalized_time_left = Math.max(0, this.recoveryTimer / this.RECOVERY_DURATION); // Ensure 0 to 1
                const damping_multiplier = Math.pow(normalized_time_left, 1.5);

                let max_horizontal_amplitude_feet = this.fallDistance * MAX_SWING_AMPLITUDE_FACTOR;
                max_horizontal_amplitude_feet = Math.min(max_horizontal_amplitude_feet, MAX_ABS_SWING_CAP);

                const current_swing_phase = Date.now() * SWING_SPEED_CONSTANT;
                const current_x_offset = damping_multiplier * max_horizontal_amplitude_feet * Math.sin(current_swing_phase);
                
                this.x = this.currentGrip.x + current_x_offset;

                const L_effective_to_feet = this.fallDistance + (this.bodyHeight / 2);
                // Ensure radicand is non-negative (should be if max_horizontal_amplitude_feet <= L_effective_to_feet)
                const radicand = Math.pow(L_effective_to_feet, 2) - Math.pow(current_x_offset, 2);
                const y_displacement_from_pivot = Math.sqrt(Math.max(0, radicand));
                
                this.y = this.currentGrip.y + y_displacement_from_pivot;

            } else if (this.isSwingRecovering && this.currentGrip) {
                // Fallback if fallDistance is bad or zero: center on grip X, Y at targetYAfterFall (lowest point)
                this.x = this.currentGrip.x;
                if (typeof this.targetYAfterFall === 'number') { // targetYAfterFall should be set
                    this.y = this.targetYAfterFall;
                }
            }

            if (this.recoveryTimer <= 0) {
                const wasSwingRecovering = this.isSwingRecovering;
                this.isRecovering = false;
                this.isSwingRecovering = false; 
                gameState = 'playing'; 
                console.log("Climber recovery complete.");
                // Removed sound at recovery completion
                if (this.currentGrip) {
                    this.x = this.currentGrip.x; // Snap X at the END of recovery
                    if (wasSwingRecovering && typeof this.targetYAfterFall === 'number') {
                        // Ensure Y is at the lowest point of the swing arc
                        this.y = this.targetYAfterFall; 
                    } else if (!wasSwingRecovering) {
                        // For non-swing recoveries, snap to grip's actual Y
                         this.y = this.currentGrip.y;
                    } else if (wasSwingRecovering) { // Fallback if targetYAfterFall wasn't set
                        this.y = this.currentGrip.y + this.fallDistance + (this.bodyHeight / 2);
                    }
                } 
                this.catchProtection = null;
                
                // Activate grips within reach after recovery
                this.activateGripsWithinReach();
            }
            return; 
        }

        if (this.isFalling) {
            if (this.catchProtection) { 
                gameState = 'fallingToSafety';
                // Apply gravity and cap speed
                const oldVelocityY = this.velocityY;
                this.velocityY += GRAVITY * deltaTimeInSeconds;
                if (this.velocityY > FALL_SPEED_MAX * 0.85) {
                    this.velocityY = FALL_SPEED_MAX * 0.85;
                }
                const newVelocityY = this.velocityY;
                const yChange = newVelocityY * deltaTimeInSeconds; // yChange calculated
                this.y += yChange; // Climber's y is updated using yChange

                console.log(`FallSpeedCalc: dT=${deltaTimeInSeconds.toFixed(4)}, G=${GRAVITY}, oldVelY=${oldVelocityY.toFixed(2)}, newVelY=${newVelocityY.toFixed(2)}, yChange=${yChange.toFixed(3)}, newClimberY=${this.y.toFixed(2)}`);

                // Calculate swing motion based on fall distance
                if (typeof this.fallDistance === 'number' && !isNaN(this.fallDistance)) {
                    const swingFactor = Math.min(1, this.fallDistance / (this.bodyHeight * 3)); 
                    this.x = this.catchProtection.x + Math.sin(Date.now() * 0.002 * swingFactor) * this.fallDistance * 0.2 * swingFactor; 
                } else {
                    console.error("Climber.update (fallingToSafety): this.fallDistance is not a valid number. x calculation skipped.");
                    // Keep current x or revert to catchProtection.x as a fallback if fallDistance is bad
                    if (this.catchProtection) this.x = this.catchProtection.x;
                }

                // Check if we've reached the target position after fall
                if (Math.abs(this.y - this.targetYAfterFall) < 5 || (this.velocityY > 0 && this.y > this.targetYAfterFall) || (this.velocityY < 0 && this.y < this.targetYAfterFall) ) { 
                    this.y = this.targetYAfterFall;
                    this.isFalling = false;
                    this.isRecovering = true;
                    this.isSwingRecovering = true; // Indicate swing recovery starts
                    this.recoveryTimer = this.RECOVERY_DURATION;
                    this.currentGrip = this.catchProtection; 
                    // DO NOT SNAP X HERE to allow swing to continue
                    console.log(`Fall caught by protection ${this.catchProtection.id}. Starting recovery.`);
                    
                    // Play catch sound if not already played a fall sound
                    if (!this.playedFallSoundThisFall) {
                        playSound(this.catchSound);
                        this.playedFallSoundThisFall = true;
                    }
                    
                    // Mark the protection as used
                    if (this.catchProtection && typeof this.catchProtection.use === 'function') {
                        this.catchProtection.use(); 
                    } else {
                        console.warn("catchProtection or catchProtection.use() is invalid");
                    }
                }
            } else { 
                // Terminal falling
                gameState = 'terminalFalling';
                this.velocityY += GRAVITY * deltaTimeInSeconds;
                if (this.velocityY > FALL_SPEED_MAX) this.velocityY = FALL_SPEED_MAX;
                this.y += this.velocityY * deltaTimeInSeconds;
                
                // Play terminal fall sound if not already played
                if (!this.playedFallSoundThisFall) {
                    playSound('terminalFallSound');
                    this.playedFallSoundThisFall = true;
                }
                
                // Check if climber has fallen off screen
                if (this.y > CANVAS_HEIGHT + cameraY + this.bodyHeight) { 
                    console.log("Climber fallen off screen. Game Over.");
                    setGameOver();
                }
            }
            return; 
        } else {
            // Reset fall sound flag when not falling
            this.resetFallSoundFlag();
        }

        if (gameState === 'playing') {
            if (this.isMoving && this.targetGrip) {
                const dx = this.targetGrip.x - this.x;
                const dy = this.targetGrip.y - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < (this.speed * deltaTimeInSeconds) + 1) { 
                    this.x = this.targetGrip.x;
                    this.y = this.targetGrip.y;
                    this.isMoving = false;
                    this.currentGrip = this.targetGrip;
                    this.targetGrip.state = 'used';
                    console.log(`Climber reached grip ${this.currentGrip.id}. X: ${this.x.toFixed(1)}, Y: ${this.y.toFixed(1)}`);
                    playSound(this.moveSound, 0.3); 
                    this.targetGrip = null; 
                    this.stamina -= STAMINA_COST_MOVE;
                    if (this.y < maxAchievedRawY) maxAchievedRawY = this.y;
                    updateUI(); 
                } else {
                    this.x += (dx / distance) * this.speed * deltaTimeInSeconds;
                    this.y += (dy / distance) * this.speed * deltaTimeInSeconds;
                    this.stamina -= STAMINA_COST_PER_SECOND_MOVING * deltaTimeInSeconds;
                }
            } else if (!this.isMoving && this.currentGrip) {
                this.stamina += STAMINA_REGEN_PER_SECOND * deltaTimeInSeconds;
                if (this.stamina > MAX_STAMINA) this.stamina = MAX_STAMINA;
                if (this.currentGrip.isCrack) { 
                    this.stamina += STAMINA_REGEN_CRACK_BONUS * deltaTimeInSeconds;
                    if (this.stamina > MAX_STAMINA) this.stamina = MAX_STAMINA;
                }
            }
            if (this.stamina <= 0 && !this.isExhausted) {
                this.isExhausted = true;
                playSound(this.exhaustedSound);
                console.log("Climber exhausted!");
                if (this.currentGrip && (!this.currentGrip.isCrack && this.currentGrip.quality < 0.8) && Math.random() < 0.75) { 
                    console.log("Exhaustion causes a fall from a non-crack/poor grip!");
                    this.fall();
                }
            }
            if (this.stamina > STAMINA_RECOVERY_THRESHOLD) {
                this.isExhausted = false; 
            }
        }
    }

    fall() {
        if (this.isFalling || this.isRecovering || gameState === 'fallingToSafety' || gameState === 'recovering') return; // Already falling or recovering

        this.isFalling = true;
        this.yAtFallStart = this.y;
        console.log(`Climber.fall() triggered. yAtFallStart: ${this.yAtFallStart.toFixed(2)}, x: ${this.x.toFixed(2)}`);

        const previousGrip = this.currentGrip;
        this.currentGrip = null;
        
        // Play fall sound only once per fall event
        if (!this.playedFallSoundThisFall) {
            playSound('fall');
            this.playedFallSoundThisFall = true;
        }
        
        if (previousGrip) previousGrip.state = 'failed';

        // Find the last anchor point (last node in ropePathNodes)
        let lastAnchor = null;
        for (let i = this.ropePathNodes.length - 1; i >= 0; i--) {
            if (this.ropePathNodes[i].type === 'protection' || this.ropePathNodes[i].type === 'start') {
                lastAnchor = this.ropePathNodes[i];
                break;
            }
        }

        // Calculate rope length out and potential fall distance
        let ropeLengthOut = 0;
        if (lastAnchor) {
            // Calculate distance from last anchor to climber's current position
            const dx = this.x - lastAnchor.x;
            const dy = this.y - lastAnchor.y;
            ropeLengthOut = Math.sqrt(dx * dx + dy * dy);
            console.log(`Rope length out from last anchor: ${ropeLengthOut.toFixed(2)}`);
        }

        // Check for terminal fall conditions
        const SEVEN_GRIPS_FALL_THRESHOLD_PIXELS = 420; // Approx 7 grips height
        const isFallBelowRouteStart = this.y > ROUTE_START_COORDS.y;
        const isExcessiveFallDistance = lastAnchor && lastAnchor.type === 'protection' && 
                                       ropeLengthOut > MAX_CATCHABLE_FALL_DISTANCE;

        if (ropeLengthOut > SEVEN_GRIPS_FALL_THRESHOLD_PIXELS || isFallBelowRouteStart || isExcessiveFallDistance) {
            // Terminal fall - will be handled in update()
            console.log("Terminal fall condition met:");
            if (ropeLengthOut > SEVEN_GRIPS_FALL_THRESHOLD_PIXELS) console.log(" - Fall distance exceeds threshold");
            if (isFallBelowRouteStart) console.log(" - Fall below route start");
            if (isExcessiveFallDistance) console.log(" - Excessive fall on protection piece");
            
            gameState = 'terminalFalling';
            
            // Play terminal fall sound if not already played
            if (!this.playedFallSoundThisFall) {
                playSound('terminalFallSound');
                this.playedFallSoundThisFall = true;
            }
            
            return;
        }

        // Non-terminal fall - find the highest protection below climber
        this.catchProtection = null;
        let highestProtectionBelowClimber = null;

        // Find the highest protection piece below the climber
        for (const node of this.ropePathNodes) {
            if (node.type === 'protection' && node.y > this.yAtFallStart) {
                // Protection is BELOW the climber's fall start point
                if (!highestProtectionBelowClimber || node.y < highestProtectionBelowClimber.y) {
                    // Find the actual protection object that matches this node
                    for (const p of protections) {
                        if (p.id === node.id) {
                            highestProtectionBelowClimber = p;
                            break;
                        }
                    }
                }
            }
        }

        if (highestProtectionBelowClimber) {
            const fallDistanceToProtection = highestProtectionBelowClimber.y - this.yAtFallStart;
            console.log(`Highest protection below climber found at Y: ${highestProtectionBelowClimber.y.toFixed(2)}. Fall distance: ${fallDistanceToProtection.toFixed(2)}`);

            this.catchProtection = highestProtectionBelowClimber;
            this.fallDistance = fallDistanceToProtection;
            this.targetYAfterFall = this.catchProtection.y + this.fallDistance + (this.bodyHeight / 2);
            
            console.log(`Fall caught by protection at Y: ${this.catchProtection.y.toFixed(2)}`);
            console.log(`Target Y after fall (swing): ${this.targetYAfterFall.toFixed(2)}`);
            
            gameState = 'fallingToSafety';
            this.velocityY = 0;
            
            // Play catch sound if not already played a fall sound
            if (!this.playedFallSoundThisFall) {
                playSound(this.catchSound);
                this.playedFallSoundThisFall = true;
            }
            
            // Reduce stamina when caught by protection
            this.stamina -= STAMINA_COST_FALL_CAUGHT;
            if (this.stamina < 0) this.stamina = 0;
        } else {
            // No protection to catch the fall - terminal fall
            console.log("No protection to catch the fall.");
            gameState = 'terminalFalling';
            
            // Play terminal fall sound if not already played
            if (!this.playedFallSoundThisFall) {
                playSound('terminalFallSound');
                this.playedFallSoundThisFall = true;
            }
        }
    }

    moveToGrip(grip) {
        if (!grip || grip.state === 'failed' || grip.state === 'hidden' || this.isFalling || this.isRecovering) {
            // console.log(`Cannot move to grip: ${grip ? grip.state : 'null'}, isFalling: ${this.isFalling}, isRecovering: ${this.isRecovering}`);
            return false;
        }

        if (this.canReachGrip(grip)) {
            if (this.currentGrip) {
                this.currentGrip.release();
            }
            this.x = grip.x;
            this.y = grip.y;
            this.currentGrip = grip;
            grip.grab(this);
            this.stamina -= STAMINA_COST_MOVE;
            if (this.stamina < 0) this.stamina = 0;

            // Update targetCameraY to center the new grip on screen
            // This will cause updateCamera() to smoothly move the camera.
            targetCameraY = grip.y - CANVAS_HEIGHT / 2; 
            // Ensure targetCameraY doesn't go below 0 (initial screen position)
            if (targetCameraY < 0) targetCameraY = 0;

            playSound('grab');
            // console.log(`Moved to grip at ${grip.x.toFixed(0)}, ${grip.y.toFixed(0)}. Stamina: ${this.stamina.toFixed(1)}`);
            
            // Update maxAchievedRawY if climber moves higher
            if (this.y < maxAchievedRawY) {
                maxAchievedRawY = this.y;
            }
            // NOTE: We no longer add regular grips to ropePathNodes
            // Only protection pieces should be in ropePathNodes
            return true;
        } else {
            // console.log("Cannot reach grip.");
            return false;
        }
    }

    canReachGrip(grip) {
        // Anchor reach check from approx shoulder/hand height
        const reachAnchorX = this.x; 
        const reachAnchorY = this.y - this.bodyHeight * 0.2; 

        const distX = grip.x - reachAnchorX;
        const distY = grip.y - reachAnchorY;
        const distance = Math.sqrt(distX * distX + distY * distY);
        // Allow reaching grips slightly below current anchor for flexibility
        return distance <= this.reach && grip.y < reachAnchorY + this.reach * 0.5;
    }

    resetFallSoundFlag() {
        this.playedFallSoundThisFall = false;
        //console.log("Fall sound flag reset");
    }
    
    activateGripsWithinReach() {
        // Find and activate all grips within reach after a fall
        //console.log("Activating grips within reach after fall/recovery");
        let activatedCount = 0;
        
        for (const grip of grips) {
            if (grip.state === 'hidden' && this.canReachGrip(grip)) {
                grip.activate();
                activatedCount++;
            }
        }
        
        //console.log(`Activated ${activatedCount} grips within reach`);
        
        // If no grips are within reach, generate some new ones
        if (activatedCount === 0) {
            //console.log("No grips within reach, generating new ones");
            generateGripsAroundClimber();
        }
    }

    placeProtection() {
        if (this.protectionInventory > 0 && this.currentGrip && this.currentGrip.isCrack) {
            const newProtection = new Protection(this.x, this.y + PROTECTION_SIZE);
            let tooClose = false;
            for(const p of protections) {
                const dist = Math.sqrt(Math.pow(p.x - newProtection.x, 2) + Math.pow(p.y - newProtection.y, 2));
                if (dist < PROTECTION_SIZE * 4) { tooClose = true; break; }
            }
            if (!tooClose) {
                protections.push(newProtection);
                protections.sort((a, b) => a.y - b.y);
                this.protectionInventory--;
                playSound('placeProtection');
                // ADDED: Add new protection to rope path history with proper object structure
                const protectionNode = { 
                    x: newProtection.x, 
                    y: newProtection.y, 
                    type: 'protection', 
                    id: newProtection.id 
                };
                this.ropePathNodes.push(protectionNode);
            }
        }
    }
}

class Grip {
    constructor(x, y, size) {
        this.x = x; this.y = y; this.size = size;
        this.state = 'hidden'; this.timer = 0;
        this.degradationTime = GRIP_ACTIVE_DURATION + (Math.random() * 100 - 50);
        this.isCrack = Math.random() < 0.35; // 35% chance of being a crack

        if (this.isCrack) {
            this.angle = (Math.random() - 0.5) * (20 * Math.PI / 180); // +/- 10 degrees for crack orientation

            // Crack visual properties for two parallel lines
            const minGapPercent = 0.15; // Minimum gap as percentage of grip size
            const maxGapPercent = 0.30; // Maximum gap as percentage of grip size
            this.crackGap = this.size * (minGapPercent + Math.random() * (maxGapPercent - minGapPercent));

            const targetTotalWidth = this.size / 1.20; // Target overall visual width for the crack feature
            this.crackSideWidth = (targetTotalWidth - this.crackGap) / 2;

            const minSideWidth = this.size * 0.1; // Minimum width for each side of the crack
            if (this.crackSideWidth < minSideWidth) {
                this.crackSideWidth = minSideWidth;
                // Optional: could recalculate crackGap here if side width is clamped to maintain targetTotalWidth
                // For simplicity, we'll just clamp the side width.
            }
        } else { // Not a crack
            this.angle = Math.random() * Math.PI * 2; // Full random angle for non-cracks
        }
    }
    draw() {
        const canvasY = this.y - cameraY;
        if (canvasY < -this.size || canvasY > CANVAS_HEIGHT + this.size) return;

        ctx.save(); // Save the current state
        ctx.translate(this.x, canvasY); // Move to the grip's position
        ctx.rotate(this.angle); // Rotate by the grip's angle

        ctx.beginPath();
        let color = GRIP_COLOR_HIDDEN;
        switch (this.state) {
            case 'visible': color = GRIP_COLOR_VISIBLE; break;
            case 'active': color = GRIP_COLOR_ACTIVE; break;
            case 'degrading': color = GRIP_COLOR_DEGRADING; break;
            case 'failed': color = GRIP_COLOR_FAILED; break;
        }

        if(this.isCrack && (this.state !== 'hidden' && this.state !== 'failed')) {
            ctx.fillStyle = color;
            const crackHeight = this.size * 1.4;
            const yPos = -crackHeight / 2; // Vertically center the crack lines

            // Draw the first (left) side of the crack
            ctx.fillRect(
                -this.crackGap / 2 - this.crackSideWidth, // x position
                yPos,                                     // y position
                this.crackSideWidth,                      // width
                crackHeight                               // height
            );

            // Draw the second (right) side of the crack
            ctx.fillRect(
                this.crackGap / 2,                        // x position
                yPos,                                     // y position
                this.crackSideWidth,                      // width
                crackHeight                               // height
            );
        } else {
            ctx.fillStyle = color;
            // Adjust x and y to be relative to the translated/rotated origin (0,0)
            if (this.state !== 'hidden' && this.state !== 'failed') {
                ctx.arc(0, 0, this.size / 2, Math.PI, Math.PI * 2, false); // Flat side up (upper semi-circle)
            } else {
                ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2, false); // Full circle for hidden/failed
            }
            ctx.fill();
        }
        ctx.restore(); // Restore the state
    }
    update(climberRef) {
        if (this.state === 'hidden') {
            const distX = this.x - climberRef.x;
            const distY = this.y - climberRef.y;
            const distance = Math.sqrt(distX * distX + distY * distY);
            
            // DEBUG LOG for one specific grip to avoid flooding, or a few
            if (this.x > 150 && this.x < 250 && this.y > 400 && this.y < 500) { // Example: Check a grip in a certain zone
                console.log(`Grip Update (Hidden): ID(approx ${Math.round(this.x)},${Math.round(this.y)}) Climber(${climberRef.x.toFixed(1)},${climberRef.y.toFixed(1)}) Dist: ${distance.toFixed(1)}, RevealAt: ${GRIP_PROXIMITY_REVEAL_DISTANCE}`);
            }

            if (distance < GRIP_PROXIMITY_REVEAL_DISTANCE) {
                this.state = 'visible';
                // DEBUG LOG
                console.log(`Grip State Change: ID(approx ${Math.round(this.x)},${Math.round(this.y)}) now VISIBLE`);
            }
        }
        if (this.state === 'active' || this.state === 'degrading') {
            this.timer++;
            if (this.state === 'active' && this.timer > this.degradationTime * 0.6) { this.state = 'degrading'; playSound('degradeTick'); }
            if (this.timer > this.degradationTime) {
                const wasNotFailed = this.state !== 'failed'; this.state = 'failed'; // Make previous grip unusable or visually failed
                if (wasNotFailed) playSound('gripFail');
                if (climberRef.currentGrip === this) climberRef.fall();
            }
        }
    }
    activate() { if (this.state !== 'failed') { this.state = 'active'; this.timer = 0; } }
    fail() { this.state = 'failed'; }
    release() { this.state = 'degrading'; }
    grab(climberRef) { this.activate(); this.climberRef = climberRef; }
}

class Protection {
    constructor(x, y) {
        this.id = `protection-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; // Added ID
        this.x = x; this.y = y; this.size = PROTECTION_SIZE; this.color = PROTECTION_COLOR;
        this.isUsed = false; // Example property for use()
    }
    draw() {
        const canvasY = this.y - cameraY;
        // Simple square for protection placeholder
        ctx.fillStyle = this.isUsed ? '#707070' : this.color; // Change color if used
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        // Draw a shape that looks like a climbing nut/cam or a bolt hanger
        // A simple representation: a small rectangle (body) with a loop (eye)
        const bodyWidth = this.size * 0.6;
        const bodyHeight = this.size * 0.8;
        const eyeRadius = this.size * 0.3;

        ctx.roundRect(this.x - bodyWidth / 2, canvasY - bodyHeight / 2, bodyWidth, bodyHeight, 2);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(this.x, canvasY - bodyHeight / 2 - eyeRadius * 0.8, eyeRadius, Math.PI * 0.2, Math.PI * 0.8, true); // Eye of the protection
        ctx.lineWidth = 2;
        ctx.strokeStyle = this.isUsed ? '#505050' : '#303030';
        ctx.stroke();
    }
    use() { // Added use method
        console.log(`Protection ${this.id} at Y:${this.y.toFixed(1)} used.`);
        this.isUsed = true;
        // Potentially trigger a sound or visual change directly here if needed
        // playSound('protectionUsed'); // Example if you have such a sound
    }
}

class Rockface {
    constructor(canvas, pauseButtonId) { // Renamed parameter for clarity
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.pauseBtn = document.getElementById(pauseButtonId); // Use the passed ID
        this.running = true;
        this.lastTime = performance.now();
        
        // Use existing wall color constants
        this.WALL_COLOR_MIN_SHADE = WALL_COLOR_MIN_SHADE;
        this.WALL_COLOR_MAX_SHADE = WALL_COLOR_MAX_SHADE;
        
        this.shapes = []; // Initialize shapes array
        this.briefAnimationTimeout = null;
        this.briefAnimationDuration = 400; // milliseconds for brief animation (0.5 sec)

        this.init();
    }

    init() {
        this.w = CANVAS_WIDTH;
        this.h = CANVAS_HEIGHT;
        this.canvas.width = this.w;
        this.canvas.height = this.h;
        
        this.shapes = this.makeShapes(); // Corrected: makeShapes returns the array
        
        // Event listeners
        window.addEventListener('resize', () => this.handleResize());
        
        // Start animation -- REMOVED from here, managed by gameLoop
        // requestAnimationFrame((now) => this.animate(now));
    }

    // Utility: random gray color using existing wall color range
    randomGray() {
        const gray = Math.floor(Math.random() * (this.WALL_COLOR_MAX_SHADE - this.WALL_COLOR_MIN_SHADE)) + this.WALL_COLOR_MIN_SHADE;
        return `rgb(${gray},${gray},${gray})`;
    }

    // Generate a single jagged longitudinal polygon
    makeJaggedPoly(opts) {
        const {len, width, edges, angle, spread} = opts;
        const points = [];
        let x = 0, y = 0;
        points.push({x, y});
        
        for (let i = 1; i < edges-1; i++) {
            const t = i / (edges-1);
            y = t * len + (Math.random()-0.5) * len*0.01;
            const side = (Math.random()-0.1) * width * (0.99 + t*1.5) * spread;
            x = side;
            points.push({x, y});
        }
        
        points.push({
            x: -width/2 + (Math.random()-0.5)*width*0.2, 
            y: len + (Math.random()-0.5)*len*0.03
        });
        points.push({
            x: width/2 + (Math.random()-0.5)*width*0.2, 
            y: len + (Math.random()-0.5)*len*0.03
        });
        
        for (let i = edges-2; i > 0; i--) {
            let p = points[i];
            points.push({x: -p.x, y: p.y});
        }
        
        const rad = angle;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        for (let pt of points) {
            let nx = pt.x * cos - pt.y * sin;
            let ny = pt.x * sin + pt.y * cos;
            pt.x = nx;
            pt.y = ny;
        }
        
        return points;
    }

    // Generate all shapes
    makeShapes(numShapes = 150) {
        const newShapes = []; // Changed variable name to avoid conflict
        
        for (let i = 0; i < numShapes; i++) {
            const big = Math.pow(Math.random(), 2.2);
            const len = (this.h * 0.16) + big * (this.h * 0.25);
            const width = (5 + Math.random() * 18) * (1 - big) + (20 + Math.random() * 40) * big;
            const ratio = len / width;
            if (ratio > 30) continue;
            
            const edges = Math.floor(3 + Math.random() * 7);
            // const spread = (this.w * 0.4); // spread in makeJaggedPoly seems to be a multiplier
            const baseAngle = (-Math.PI/2) + (i/(numShapes-1) - 0.5) * (Math.PI/1.2);
            
            newShapes.push({
                points: this.makeJaggedPoly({len, width, edges, angle: 0, spread: 1}), // Pass spread as 1 if it's a multiplier
                baseAngle,
                angle: baseAngle + (Math.random()-0.5)*0.04,
                x: this.w/2,
                y: this.h*0.07 + Math.random()*this.h*0.03, // Initial Y position
                len,
                width,
                color: this.randomGray(),
                speed: 0.1 + big * 1.1 + Math.random()*0.2,
                drift: (Math.random()-0.9)*0.12,
                grow: 3 + big*0.11 + Math.random()*0.03, // Initial scale
                // edges, // already used in makeJaggedPoly
                // spread: 2 + Math.random()*0.2, // already used in makeJaggedPoly
                t: Math.random()*this.h // time offset for animation variation
            });
        }
        
        return newShapes; // Return the generated shapes
    }

    // drawShape now takes cameraY to adjust its y-translation
    drawShape(shape, currentCameraY) { 
        this.ctx.save();
        // Apply camera offset to the shape's y position during translation
        this.ctx.translate(shape.x, shape.y - currentCameraY); 
        this.ctx.rotate(shape.angle + Math.PI / 2); // Original rotation
        this.ctx.scale(shape.grow, shape.grow);
        this.ctx.beginPath();
        let pts = shape.points;
        this.ctx.moveTo(pts[0].x, pts[0].y);
        for (let i=1; i<pts.length; i++) {
            this.ctx.lineTo(pts[i].x, pts[i].y);
        }
        this.ctx.closePath();
        this.ctx.fillStyle = shape.color;
        this.ctx.globalAlpha = 0.93;
        this.ctx.fill();
        this.ctx.globalAlpha = 1.0;
        this.ctx.restore();
    }

    // New draw method for rendering, called by gameLoop
    draw(currentCameraY) {
        // gameLoop's clearRect is assumed to be primary.
        // If Rockface had a specific background itself, it would draw it here.
        for (let shape of this.shapes) {
            // Optional: Add basic culling here if shape.y - currentCameraY is way off-screen
            // For example: if (shape.y - currentCameraY + shape.len * shape.grow < 0 || shape.y - currentCameraY - shape.len * shape.grow > this.h) continue;
            this.drawShape(shape, currentCameraY);
        }
    }

    // animate method now only updates shape states, does not draw
    animate(now, currentCameraY) { // Pass currentCameraY for recycling logic
        let dt = 0;
        if (this.running) {
             // Use a consistent delta time calculation, ensure lastTime is updated
             dt = Math.min(0.06, (now - this.lastTime) / 16.66); 
        }

        for (let i = 0; i < this.shapes.length; i++) {
            let shape = this.shapes[i];
            if (this.running) {
                // Recycling logic - check if shape is off-screen relative to camera
                const shapeTopEdgeCanvas = shape.y - (shape.len * shape.grow / 2) - currentCameraY; // Approximate top edge on canvas
                const shapeBottomEdgeCanvas = shape.y + (shape.len * shape.grow / 2) - currentCameraY; // Approximate bottom edge on canvas
                const shapeLeftEdgeCanvas = shape.x - (shape.width * shape.grow / 2); // Approximate left edge
                const shapeRightEdgeCanvas = shape.x + (shape.width * shape.grow / 2); // Approximate right edge

                if (shapeRightEdgeCanvas < -40 || shapeLeftEdgeCanvas > this.w + 40 || shapeBottomEdgeCanvas < -100 || shapeTopEdgeCanvas > this.h + 100) { 
                    // Create properties for a single new shape
                    const newShapeProps = this.makeShapes(1)[0]; 
                    // Replace the old shape's properties with new ones
                    this.shapes[i] = Object.assign({}, newShapeProps); 
                    // Reset position relative to current view or canvas edges
                    this.shapes[i].x = this.w + (shape.width * shape.grow / 2) + Math.random() * 50; // Come in from the right
                    this.shapes[i].y = currentCameraY + (Math.random() * this.h); // Appear anywhere vertically in viewport
                    // Reset growth and other dynamic properties for the new shape
                    this.shapes[i].grow = 3 + newShapeProps.big * 0.11 + Math.random()*0.03; // Reset to initial scale range
                    this.shapes[i].t = Math.random() * this.h; // Reset time offset
                }
            }
        }
        
        if (this.running) {
            this.lastTime = now; // Update lastTime only if running and after dt calculation
        }
    }

    togglePause() {
        this.running = !this.running;
        if (this.pauseBtn) this.pauseBtn.textContent = this.running ? "Pause BG" : "Run BG"; // Updated text
        if (this.running) {
            this.lastTime = performance.now();
        }
    }

    handleResize() {
        this.w = CANVAS_WIDTH;
        this.h = CANVAS_HEIGHT;
        this.canvas.width = this.w;
        this.canvas.height = this.h;
        this.shapes = this.makeShapes(); // Regenerate shapes on resize
    }

    triggerBriefAnimation() {
        this.running = true;
        this.lastTime = performance.now(); // Ensure animate method's timer condition can be met

        // Clear any existing timeout to prevent premature stopping if triggered again quickly
        if (this.briefAnimationTimeout) {
            clearTimeout(this.briefAnimationTimeout);
        }

        this.briefAnimationTimeout = setTimeout(() => {
            this.running = false;
            this.briefAnimationTimeout = null; // Clear the stored timeout ID
        }, this.briefAnimationDuration);
    }
}

// Wall texture generation (simple colored chunks background)
function generateWallTexture() {
    wallTexture = []; // Initialize as an empty array
    const numCols = Math.ceil(CANVAS_WIDTH / WALL_CHUNK_SIZE);
    // Generate enough rows to cover a few screens to allow for camera movement
    const numRows = Math.ceil((CANVAS_HEIGHT * 3) / WALL_CHUNK_SIZE); // Increased rows for more scroll depth

    for (let r = 0; r < numRows; r++) {
        for (let c = 0; c < numCols; c++) {
            const shade = WALL_COLOR_MIN_SHADE + Math.random() * (WALL_COLOR_MAX_SHADE - WALL_COLOR_MIN_SHADE);
            wallTexture.push({ 
                x: c * WALL_CHUNK_SIZE, 
                y: r * WALL_CHUNK_SIZE, 
                color: `rgb(${shade},${shade},${shade})`
            });
        }
    }
}

// Function to draw the static wall texture (called before Rockface shapes)
function drawWallBackground(currentCameraY) {
    ctx.save();
    ctx.translate(0, -currentCameraY); // Apply camera offset

    for (const chunk of wallTexture) {
        // Basic culling: only draw chunks visible in the current viewport
        const chunkTopOnCanvas = chunk.y;
        const chunkBottomOnCanvas = chunk.y + WALL_CHUNK_SIZE;
        if (chunkBottomOnCanvas >= 0 && chunkTopOnCanvas <= CANVAS_HEIGHT + currentCameraY ) { // Check against original y for texture
             // Check if chunk is within visible camera range (cameraY to cameraY + CANVAS_HEIGHT)
            if (chunk.y + WALL_CHUNK_SIZE > currentCameraY && chunk.y < currentCameraY + CANVAS_HEIGHT) {
                ctx.fillStyle = chunk.color;
                ctx.fillRect(chunk.x, chunk.y, WALL_CHUNK_SIZE, WALL_CHUNK_SIZE);
            }
        }
    }
    ctx.restore();

    // The animated Rockface shapes are drawn AFTER this background in the main gameLoop
    if (rockface) {
        rockface.draw(currentCameraY); // Rockface draws its dynamic shapes over the static wall
    }
}

function updateCamera() {
    if (!climber) return;

    const deltaTime = Math.min(0.1, (performance.now() - lastGameLoopTime) / 1000); // Consistent deltaTime

    if (climber.isFalling && climber.velocityY > 0 && gameState === 'terminalFalling') { 
        // During terminal fall, camera follows climber down directly (or with some offset)
        targetCameraY = climber.y - CANVAS_HEIGHT * 0.8; // Keep climber towards bottom of screen during fall
        // cameraY += climber.velocityY * 0.3 * (60 * deltaTime); // Old direct velocity based movement
    } else if (gameState !== 'gameOver' && gameState !== 'paused' && gameState !== 'terminalFalling') {
        // For normal play, targetCameraY would be updated when climber grabs a new grip (in Climber.moveToGrip)
        // Here, we just ensure cameraY smoothly moves towards whatever targetCameraY is set to.
        // No automatic scrolling based on climber's screen position unless targetCameraY changes.
    }

    // Smoothly interpolate cameraY towards targetCameraY
    const cameraSpeed = 2; // Adjust for desired camera follow speed
    cameraY += (targetCameraY - cameraY) * cameraSpeed * deltaTime;

    if (cameraY < 0) cameraY = 0; // Prevent camera from going above the top
}

function isTooCloseToExistingGrips(x, y, minDistanceSquared, existingGrips) {
    for (const existingGrip of existingGrips) {
        const dX = x - existingGrip.x;
        const dY = y - existingGrip.y;
        if ((dX * dX + dY * dY) < minDistanceSquared) {
            return true;
        }
    }
    return false;
}

function generateGrips(targetTotalGrips = 250) { 
    //console.log("CASCADE_DEBUG: Defining generateGrips NOW... Version 3"); 
    grips = [];
    const startGripY = CANVAS_HEIGHT - 60;
    const startGrip = new Grip(CANVAS_WIDTH / 2, startGripY, GRIP_SIZE_MAX);
    startGrip.state = 'active';
    startGrip.isCrack = true;
    grips.push(startGrip);
    
    let mainProgressionGrip = startGrip;
    const MIN_DIST_SQ = MIN_GRIP_SEPARATION * MIN_GRIP_SEPARATION;

    const worldTopY = -(CANVAS_HEIGHT * 2.5); 

    while (grips.length < targetTotalGrips && mainProgressionGrip.y > worldTopY) {
        let primaryGripMade = false;
        let currentSourceForAux = mainProgressionGrip; 

        for (let attempt = 0; attempt < 8 && !primaryGripMade; attempt++) { 
            let nextY = mainProgressionGrip.y - (CLIMBER_REACH * 0.5 + Math.random() * CLIMBER_REACH * 0.4); 
            let nextX = mainProgressionGrip.x + (Math.random() - 0.5) * CLIMBER_REACH * 1.0; 
            
            nextX = Math.max(GRIP_SIZE_MAX, Math.min(CANVAS_WIDTH - GRIP_SIZE_MAX, nextX));
            nextY = Math.max(worldTopY, nextY); 

            const dPriX = nextX - mainProgressionGrip.x;
            const dPriY = nextY - mainProgressionGrip.y;
            const distToSourceSq = dPriX * dPriX + dPriY * dPriY;

            if (distToSourceSq > CLIMBER_REACH * CLIMBER_REACH || 
                (distToSourceSq < (CLIMBER_REACH*0.3)*(CLIMBER_REACH*0.3) && nextY > worldTopY + CANVAS_HEIGHT/2) ) { 
                continue;
            }

            if (!isTooCloseToExistingGrips(nextX, nextY, MIN_DIST_SQ, grips)) {
                const size = GRIP_SIZE_MIN + Math.random() * (GRIP_SIZE_MAX - GRIP_SIZE_MIN);
                const newPrimaryGrip = new Grip(nextX, nextY, size);
                grips.push(newPrimaryGrip);
                mainProgressionGrip = newPrimaryGrip;
                currentSourceForAux = newPrimaryGrip;
                primaryGripMade = true;
            }
        }

        if (!primaryGripMade || grips.length >= targetTotalGrips) break; 

        const numAuxGripsToTry = 1 + Math.floor(Math.random() * 2); 
        for (let i = 0; i < numAuxGripsToTry && grips.length < targetTotalGrips; i++) {
            for (let attempt = 0; attempt < 5; attempt++) {
                const angle = (Math.random() * Math.PI * 1.8) - (Math.PI * 0.9); 
                const distance = (CLIMBER_REACH * 0.35) + (Math.random() * CLIMBER_REACH * 0.6); 

                let auxNextX = currentSourceForAux.x + Math.cos(angle) * distance;
                let auxNextY = currentSourceForAux.y + Math.sin(angle) * distance; 
                
                auxNextX = Math.max(GRIP_SIZE_MAX, Math.min(CANVAS_WIDTH - GRIP_SIZE_MAX, auxNextX));
                auxNextY = Math.max(worldTopY, Math.min(currentSourceForAux.y + CLIMBER_REACH * 0.35, auxNextY)); 

                const dAuxX = auxNextX - currentSourceForAux.x;
                const dAuxY = auxNextY - currentSourceForAux.y;
                const distToSourceSq = dAuxX*dAuxX + dAuxY*dAuxY;

                if (distToSourceSq > CLIMBER_REACH * CLIMBER_REACH || distToSourceSq < (CLIMBER_REACH*0.2)*(CLIMBER_REACH*0.2)) continue;

                if (!isTooCloseToExistingGrips(auxNextX, auxNextY, MIN_DIST_SQ, grips)) {
                    const auxSize = GRIP_SIZE_MIN + Math.random() * (GRIP_SIZE_MAX - GRIP_SIZE_MIN);
                    const newAuxGrip = new Grip(auxNextX, auxNextY, auxSize);
                    grips.push(newAuxGrip);
                    break; 
                }
            }
        }
    }
     if (grips.length <= 1 && targetTotalGrips > 1) {
        const g = new Grip(startGrip.x + 20, startGrip.y - 20, GRIP_SIZE_MAX);
        if(!isTooCloseToExistingGrips(g.x, g.y, MIN_DIST_SQ, grips)) grips.push(g);
    }
}

function generateGripsAroundClimber() {
    //console.log("CASCADE_DEBUG: Defining generateGripsAroundClimber NOW... Version 3"); 
    if (!climber) return;

    const generationRangeY = CANVAS_HEIGHT; 
    let highestGripY = Infinity; 
    if (grips.length > 0) {
        grips.forEach(grip => {
            if (grip.y < highestGripY) highestGripY = grip.y; 
        });
    } else {
        highestGripY = Infinity; 
    }
    
    if (grips.length === 0 || climber.y < highestGripY + CANVAS_HEIGHT * 0.5) { 
        const numberOfNewGrips = Math.floor(Math.random() * 3) + 2; 
        //console.log(`Generating ${numberOfNewGrips} new grips. Highest existing grip Y: ${highestGripY === Infinity ? 'N/A' : highestGripY.toFixed(2)}, Climber Y: ${climber.y.toFixed(2)}`);

        for (let i = 0; i < numberOfNewGrips; i++) {
            const newGripX = Math.random() * (CANVAS_WIDTH - GRIP_SIZE_MAX);
            const newGripY = climber.y - (Math.random() * CANVAS_HEIGHT * 0.8) - GRIP_HEIGHT_FIXED - 20; 

            const minDistanceSquared = 100 * 100; 
            let tooClose = false;
            for (const existingGrip of grips) {
                const distSq = (existingGrip.x - newGripX) ** 2 + (existingGrip.y - newGripY) ** 2;
                if (distSq < minDistanceSquared) {
                    tooClose = true;
                    break;
                }
            }

            if (!tooClose) { 
                const newGrip = new Grip(newGripX, newGripY);
                grips.push(newGrip);
                // console.log(`Generated new grip at X: ${newGripX.toFixed(2)}, Y: ${newGripY.toFixed(2)}`);
            } else {
                // console.log(`Skipped generating grip: too close. X: ${newGripX.toFixed(2)}, Y: ${newGripY.toFixed(2)}`);
            }
        }
    }
}

function startGamePlay() {
    //console.log("Starting game play...");
    initAudio(); 

    // Load high score from localStorage before starting the game
    loadHighScore();
    
    gameState = 'playing';
    score = 0;
    maxAchievedRawY = CANVAS_HEIGHT; 
    cameraY = 0;
    targetCameraY = 0; // Initialize targetCameraY here
    lastGameLoopTime = performance.now(); // Initialize for first deltaTime calculation

    // Always (re)initialize rockface here for the game session.
    // This ensures it uses the 'canvas' object and 'pauseBgButton' as intended
    // for the Rockface's internal pause visualization features.
    // The Rockface constructor calls its own init(), which handles makeShapes, handleResize, etc.
    rockface = new Rockface(canvas, 'pauseBgButton'); 

    grips = [];
    protections = [];
    generateGrips(); 
    
    const initialGrip = grips.length > 0 ? grips.find(g => g.y > CANVAS_HEIGHT - 100 && g.y < CANVAS_HEIGHT && Math.abs(g.x - CANVAS_WIDTH/2) < CANVAS_WIDTH/4) || grips[0] : new Grip(CANVAS_WIDTH/2, CANVAS_HEIGHT - 60, GRIP_SIZE_MAX);
    if(grips.length === 0 || !grips.includes(initialGrip)) { 
        initialGrip.state = 'active';
        initialGrip.isCrack = true; 
        if(!grips.includes(initialGrip)) grips.push(initialGrip);
    }
    initialGrip.state = 'active'; 

    climber = new Climber(initialGrip.x, initialGrip.y);
    climber.currentGrip = initialGrip;

    instructionsScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    uiContainer.classList.remove('hidden');

    updateUI();

    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = requestAnimationFrame(gameLoop);
    //console.log("Game loop started with ID:", animationFrameId);
}

function updateUI() {
    // Calculate and update current score
    score = Math.max(0, Math.floor((CANVAS_HEIGHT - maxAchievedRawY) / 10));
    scoreDisplay.textContent = score;
    
    // Update high score display in the in-game UI
    const inGameHighScoreDisplay = document.getElementById('inGameHighScore');
    if (inGameHighScoreDisplay) {
        inGameHighScoreDisplay.textContent = highScore;
    }
    
    // Update other UI elements if climber exists
    if (climber) {
        staminaDisplay.textContent = Math.floor(climber.stamina);
        protectionCountDisplay.textContent = climber.protectionInventory;
        currentHeightDisplay.textContent = Math.max(0, Math.floor((CANVAS_HEIGHT - climber.y) / 10));
        
        // Update high score if current score is higher
        if (score > highScore) {
            highScore = score;
            saveHighScore();
            // Update all high score displays
            if (inGameHighScoreDisplay) {
                inGameHighScoreDisplay.textContent = highScore;
            }
            if (highScoreDisplayElement) {
                highScoreDisplayElement.textContent = highScore;
            }
        }
    } else {
        staminaDisplay.textContent = Math.floor(MAX_STAMINA); 
        protectionCountDisplay.textContent = INITIAL_PROTECTION_COUNT; 
        currentHeightDisplay.textContent = 0; 
    }
}

function loadHighScore() { const storedHighScore = localStorage.getItem(HIGH_SCORE_KEY); highScore = storedHighScore ? parseInt(storedHighScore, 10) : 0; }
function saveHighScore() { localStorage.setItem(HIGH_SCORE_KEY, highScore.toString()); }

function checkEndConditions() {
    if (gameState === 'terminalFalling') return; 

    if (climber.y < -(CANVAS_HEIGHT * 2)) { 
        setGameOver();
    }
    if (climber.isFalling && climber.y >= (CANVAS_HEIGHT + cameraY - climber.bodyHeight / 2) && protections.length === 0 && gameState !== 'terminalFalling') {
        setGameOver();
    }
}

function setGameOver() {
    if (gameState === 'gameOver') return; 
    gameState = 'gameOver';
    if (animationFrameId) { 
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    // Calculate final score based on max height achieved
    const finalScore = Math.max(0, Math.floor((CANVAS_HEIGHT - maxAchievedRawY) / 10));
    
    // Update high score if the current score is higher
    if (finalScore > highScore) {
        highScore = finalScore;
        saveHighScore(); // Save the new high score to localStorage
    }
    
    // Update the display elements
    finalScoreDisplay.textContent = finalScore;
    highScoreDisplayElement.textContent = highScore;
    
    if (rockface) {
        rockface.handleResize(); 
        rockface.running = true; 
    }
    
    instructionsScreen.classList.add('hidden');
    gameContainer.classList.add('hidden');
    uiContainer.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');
}

function drawDebugInfo() {
    if (!climber || gameState === 'initial' || gameState === 'gameOver') return;
    let reachableCount = 0;
    let visibleAndReachableCount = 0;

    grips.forEach(grip => {
        if (grip.state !== 'failed' && grip.state !== 'hidden' && climber.canReachGrip(grip)) { 
            reachableCount++;
            if (grip.state !== 'hidden') {
                visibleAndReachableCount++;
            }
        }
    });

    ctx.fillStyle = "rgba(0,0,0,0.75)";
    const debugBoxHeight = 80;
    ctx.fillRect(5, CANVAS_HEIGHT - debugBoxHeight - 5, 220, debugBoxHeight);
    ctx.fillStyle = "#0F0"; 
    ctx.font = "12px Courier New";
    ctx.fillText(`Climber Reach: ${climber.reach.toFixed(0)}`, 10, CANVAS_HEIGHT - debugBoxHeight + 10);
    ctx.fillText(`Reachable Grips (any): ${reachableCount}`, 10, CANVAS_HEIGHT - debugBoxHeight + 30);
    ctx.fillText(`Reachable (visible): ${visibleAndReachableCount}`, 10, CANVAS_HEIGHT - debugBoxHeight + 50);
    ctx.fillText(`Total Grips on Wall: ${grips.length}`, 10, CANVAS_HEIGHT - debugBoxHeight + 70);
}

let lastGameLoopTime = 0;
let rockface;
console.log("CASCADE_DEBUG: Defining gameLoop NOW... Version with deltaTime and generateGrips"); 
function gameLoop(timestamp) {
    if (gameState === 'gameOver') {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = null; 
        return; 
    }

    // Calculate deltaTime in seconds
    const deltaTimeInSeconds = Math.min(0.1, (timestamp - lastGameLoopTime) / 1000); // Cap deltaTime to prevent large jumps
    lastGameLoopTime = timestamp;

    if (gameState === 'playing' || gameState === 'fallingToSafety' || gameState === 'recovering' || gameState === 'terminalFalling') {
        if(climber) climber.update(deltaTimeInSeconds); 
        if(climber && grips.length > 0) { grips.forEach(grip => grip.update(climber, deltaTimeInSeconds)); } // UNCOMMENTED
        
        if(climber && gameState === 'playing') { 
            // console.log("CASCADE_DEBUG: gameLoop running, ABOUT TO CALL generateGripsAroundClimber."); 
            generateGripsAroundClimber(); // Re-enabled
        }
    }

    if(climber) updateCamera(); 

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (rockface) {
        // Rockface.animate now takes cameraY for its internal logic (e.g., shape recycling)
        rockface.animate(timestamp, cameraY); 
        // rockface.draw(cameraY); // This direct call is removed. drawWallBackground will call it.
    }
    // drawWallBackground handles drawing the static texture AND the dynamic Rockface shapes over it.
    drawWallBackground(cameraY); 

    // Always draw the rope if the climber exists, regardless of game state
    if (climber) {
        // Draw rope in all states - falling, playing, recovering
        drawRope();
    }

    grips.forEach(grip => grip.draw(cameraY)); 
    protections.forEach(p => p.draw(cameraY)); 
    if(climber) climber.draw(cameraY); 

    updateUI();
    if(showDebugInfo && climber) drawDebugInfo();
    checkEndConditions(); 

    if (gameState !== 'gameOver' && gameState !== 'paused') { // Ensure 'paused' state also stops the loop if implemented fully
        animationFrameId = requestAnimationFrame(gameLoop);
    } else if (gameState === 'gameOver' && animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

function drawRope() {
    if (!climber || !climber.ropePathNodes || climber.ropePathNodes.length === 0) return;

    ctx.save(); 
    ctx.strokeStyle = ROPE_COLOR; 
    ctx.lineWidth = ROPE_THICKNESS; 
    ctx.beginPath();

    // Start from climber's waist position (approximated)
    const climberWaistY = climber.y - climber.bodyHeight * 0.4;
    const climberScreenY = climberWaistY - cameraY;
    ctx.moveTo(climber.x, climberScreenY); 
    
    // Special case for falling/recovering with a catch protection
    if (climber.catchProtection && (gameState === 'fallingToSafety' || gameState === 'recovering')) {
        // Draw direct line to the catch protection
        const protectionScreenY = climber.catchProtection.y - cameraY;
        ctx.lineTo(climber.catchProtection.x, protectionScreenY);
        //console.log(`Rope: Drawing to catchProtection ${climber.catchProtection.id} at X:${climber.catchProtection.x}, Y-Screen:${protectionScreenY}`);
        
        // Find the catch protection in ropePathNodes
        let catchProtectionIndex = -1;
        for (let i = 0; i < climber.ropePathNodes.length; i++) {
            const node = climber.ropePathNodes[i];
            if (node.type === 'protection' && node.id === climber.catchProtection.id) {
                catchProtectionIndex = i;
                break;
            }
        }
        
        // Draw from catch protection to the rest of the protection pieces and the start anchor
        if (catchProtectionIndex >= 0) {
            // Find all protection pieces below the catch protection
            for (let i = catchProtectionIndex - 1; i >= 0; i--) {
                const node = climber.ropePathNodes[i];
                // Only draw through protection pieces and the start anchor
                if (node.type === 'protection' || node.type === 'start') {
                    const nodeScreenY = node.y - cameraY;
                    ctx.lineTo(node.x, nodeScreenY);
                }
            }
        }
    } else {
        // Normal case: draw through protection pieces and start anchor only
        let lastProtectionIndex = -1;
        
        // Find the last protection piece (closest to climber)
        for (let i = climber.ropePathNodes.length - 1; i >= 0; i--) {
            if (climber.ropePathNodes[i].type === 'protection') {
                lastProtectionIndex = i;
                break;
            }
        }
        
        // If we found a protection piece, draw to it
        if (lastProtectionIndex >= 0) {
            const lastProtection = climber.ropePathNodes[lastProtectionIndex];
            const protectionScreenY = lastProtection.y - cameraY;
            ctx.lineTo(lastProtection.x, protectionScreenY);
            
            // Then draw through all remaining protection pieces and the start anchor
            for (let i = lastProtectionIndex - 1; i >= 0; i--) {
                const node = climber.ropePathNodes[i];
                if (node.type === 'protection' || node.type === 'start') {
                    const nodeScreenY = node.y - cameraY;
                    ctx.lineTo(node.x, nodeScreenY);
                }
            }
        } else {
            // No protection pieces, draw directly to the start anchor
            for (let i = climber.ropePathNodes.length - 1; i >= 0; i--) {
                const node = climber.ropePathNodes[i];
                if (node.type === 'start') {
                    const nodeScreenY = node.y - cameraY;
                    ctx.lineTo(node.x, nodeScreenY);
                    break; // Only need to find the start anchor
                }
            }
        }
    }
    
    ctx.stroke();
    ctx.restore(); 
}

function handleCanvasClick(event) {
    if (climber && (climber.isRecovering || gameState === 'fallingToSafety' || gameState === 'recovering')) return;
    if (gameState === 'start') { 
        startGamePlay();
        return; 
    }
    if (gameState !== 'playing') return;
    initAudio(); 

    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top + cameraY;

    let bestGrip = null; let minDistToClick = Infinity;
    grips.forEach(grip => {
        if (grip.state !== 'failed' && grip.state !== 'hidden' && climber.canReachGrip(grip)) { 
            const distToClickX = grip.x - clickX;
            const distToClickY = grip.y - clickY;
            const currentDistToClick = Math.sqrt(distToClickX * distToClickX + distToClickY * distToClickY);
            if (currentDistToClick < grip.size * 2.5 && currentDistToClick < minDistToClick) { 
                minDistToClick = currentDistToClick; bestGrip = grip;
            }
        }
    });
    if (bestGrip) climber.moveToGrip(bestGrip);
}

function handleKeyPress(event) {
    if (climber && (climber.isRecovering || gameState === 'fallingToSafety' || gameState === 'recovering')) return;

    if (event.key === 'd' || event.key === 'D') { 
        showDebugInfo = !showDebugInfo;
        return; 
    }

    if (gameState === 'initial' || gameState === 'start' || gameState === 'gameOver') {
        if (event.code === 'Space' || event.key === 'Enter' || event.key === ' ') {
            startGamePlay();
        }
        return; 
    }

    if (gameState !== 'playing' && gameState !== 'falling') return;
    
    if (event.key === 'p' || event.key === 'P') {
        if (gameState === 'playing' && climber) { 
            climber.placeProtection();
        }
    }
}

function initGame(showInstructions = true) {
    console.log("Initializing game (showInstructions: " + showInstructions + ")");
    if (animationFrameId) { 
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    score = 0;
    updateUI(); 

    if (rockface) {
        rockface.handleResize(); 
        rockface.running = true; 
    }
    
    if (showInstructions) {
        gameState = 'start';
        instructionsScreen.classList.remove('hidden');
        gameContainer.classList.add('hidden');
        gameOverScreen.classList.add('hidden');
        
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
    } else { 
        startGamePlay(); 
    }
}

if (!window.verticalOdysseyListenersAttached) {
    document.addEventListener('keydown', handleKeyPress);
    canvas.addEventListener('click', handleCanvasClick);
    restartButton.addEventListener('click', () => {
        initGame(false); 
    });
    window.verticalOdysseyListenersAttached = true;
}

document.addEventListener('DOMContentLoaded', () => {
    // rockface = new Rockface(canvas, 'restartButton'); // Removed: Rockface will be initialized in startGamePlay
    initGame(true); 
});
