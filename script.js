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
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

const CLIMBER_BODY_WIDTH = 12;
const CLIMBER_BODY_HEIGHT = 18;
const CLIMBER_HEAD_RADIUS = 5;
const CLIMBER_COLOR = '#FF4500'; 
const CLIMBER_HEAD_COLOR = '#FFC0CB'; 
const CLIMBER_REACH = 75;

const MAX_STAMINA = 180; // Increased from 100 for more endurance
const STAMINA_DECREASE_RATE = 0.09; // Lower is slower drain
const INITIAL_PROTECTION_COUNT = 3;

const GRIP_SIZE_MIN = 7;
const GRIP_SIZE_MAX = 14;
const GRIP_AVG_SIZE = (GRIP_SIZE_MIN + GRIP_SIZE_MAX) / 2;
const MIN_GRIP_SEPARATION = GRIP_AVG_SIZE * 2.25; // Min distance between centers of any two grips
const GRIP_PROXIMITY_REVEAL_DISTANCE = CLIMBER_REACH * 1.2;
const GRIP_ACTIVE_DURATION = 250;
const GRIP_COLOR_HIDDEN = 'rgba(100, 100, 100, 0.1)';
const GRIP_COLOR_VISIBLE = '#909090';
const GRIP_COLOR_ACTIVE = '#FFFF00';
const GRIP_COLOR_DEGRADING = '#FFA500';
const GRIP_COLOR_FAILED = '#404040';

const PROTECTION_SIZE = 8;
const PROTECTION_COLOR = '#00FFFF';
const PROTECTION_LAND_WINDOW_Y = PROTECTION_SIZE * 2;
const PROTECTION_LAND_WINDOW_X = PROTECTION_SIZE * 3;

const GRAVITY = 0.25;
const TERMINAL_GRAVITY_MULTIPLIER = 1.8;
const FALL_SPEED_MAX = 6;
const TERMINAL_FALL_RESET_DELAY = 2500;

const WALL_COLOR_MIN_SHADE = 70;
const WALL_COLOR_MAX_SHADE = 100;
const WALL_CHUNK_SIZE = 40;

// Game state variables
let climber;
let grips = [];
let protections = [];
let cameraY = 0;
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
    // ... (Audio functions as before) ...
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
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(760, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
            duration = 0.15;
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
            oscillator.type = 'noise';
            const bandpass = audioCtx.createBiquadFilter();
            bandpass.type = "bandpass";
            bandpass.frequency.setValueAtTime(1000, audioCtx.currentTime);
            bandpass.Q.setValueAtTime(0.7, audioCtx.currentTime);
            oscillator.connect(bandpass);
            bandpass.connect(gainNode);
            gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
            duration = 0.2;
            break;
        default: return;
    }
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + duration);
}


class Climber {
    constructor(x, y) {
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

        // For potential image/sprite animation in the future
        // this.spriteSheet = null; // Would hold the loaded image
        // this.currentFrame = 0;
        // this.animationState = 'idle'; // e.g., 'idle', 'reaching', 'falling'
    }

    draw() {
        this.canvasY = this.y - cameraY;
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

    update() {
        // The key parts for "animation" are:
        // this.y += this.velocityY; (for falling)
        // this.x = grip.x; this.y = grip.y; (when moving to a grip)
        // These change the climber's coordinates, and the draw() function then renders
        // the climber at these new coordinates in the next frame.
        if (gameState === 'terminalFalling') {
            this.velocityY += GRAVITY * TERMINAL_GRAVITY_MULTIPLIER; 
            this.y += this.velocityY;
        } else if (this.isFalling) {
            this.velocityY += GRAVITY;
            if (this.velocityY > FALL_SPEED_MAX) this.velocityY = FALL_SPEED_MAX;
            this.y += this.velocityY;

            let landedOnProtection = false;
            for (const p of protections) {
                if (this.y >= p.y && this.y <= p.y + PROTECTION_LAND_WINDOW_Y && Math.abs(this.x - p.x) < PROTECTION_LAND_WINDOW_X) {
                    this.y = p.y;
                    this.isFalling = false;
                    this.velocityY = 0;
                    this.stamina = MAX_STAMINA / 1.5;
                    this.currentGrip = null;
                    landedOnProtection = true;
                    gameState = 'playing';
                    break;
                }
            }
            if (!landedOnProtection && this.y >= (CANVAS_HEIGHT + cameraY + this.height)) { 
                if (gameState !== 'terminalFalling') { 
                    gameState = 'terminalFalling';
                    playSound('terminalFallSound');
                    if (terminalFallTimer) clearTimeout(terminalFallTimer);
                    terminalFallTimer = setTimeout(() => {
                        initGame(true); 
                    }, TERMINAL_FALL_RESET_DELAY);
                }
            }
        } else if (this.currentGrip && (this.currentGrip.state === 'active' || this.currentGrip.state === 'degrading')) {
            this.stamina -= STAMINA_DECREASE_RATE;
            if (this.stamina <= 0) {
                this.stamina = 0;
                this.fall();
            }
        }

        if (!this.isFalling && gameState !== 'terminalFalling' && this.y < maxAchievedRawY) {
            maxAchievedRawY = this.y;
        }

        if (gameState !== 'terminalFalling') { 
            const targetCameraY = this.y - CANVAS_HEIGHT * (2/3);
            if (this.y - cameraY < CANVAS_HEIGHT / 3) {
                cameraY -= (CANVAS_HEIGHT / 3 - (this.y - cameraY)) * 0.1;
            } else if (this.y - cameraY > CANVAS_HEIGHT * (2/3) && cameraY < this.y - CANVAS_HEIGHT * (2/3)) {
                cameraY += ((this.y-cameraY) - CANVAS_HEIGHT * (2/3)) * 0.1;
            }
            if (cameraY < 0) cameraY = 0;
        } else { 
            cameraY += this.velocityY * 0.1; 
        }
    }

    moveTo(grip) {
        if (this.currentGrip && this.currentGrip.state === 'active') {
            this.currentGrip.state = 'degrading';
        }
        this.x = grip.x; // This updates the climber's position
        this.y = grip.y; // This updates the climber's position
        this.currentGrip = grip;
        grip.activate();
        this.isFalling = false;
        this.velocityY = 0;
        playSound('grab');
        if (rockface) { // Ensure rockface instance exists
            rockface.triggerBriefAnimation();
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

    fall() {
        if (this.isFalling || gameState === 'terminalFalling') return;
        this.currentGrip = null;
        this.isFalling = true;
        this.velocityY = 0;
        gameState = 'falling';
        playSound('fall');
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
            }
        }
    }
}

class Grip {
    constructor(x, y, size) {
        this.x = x; this.y = y; this.size = size;
        this.state = 'hidden'; this.timer = 0;
        this.degradationTime = GRIP_ACTIVE_DURATION + (Math.random() * 100 - 50);
        this.isCrack = Math.random() < 0.35; // 35% chance of being a crack, can be higher for specific types
    }
    draw() {
        const canvasY = this.y - cameraY;
        if (canvasY < -this.size || canvasY > CANVAS_HEIGHT + this.size) return;
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
            ctx.fillRect(this.x - this.size / 2.5, canvasY - this.size * 0.7, this.size/1.25, this.size * 1.4);
            if (this.state === 'active' || this.state === 'degrading' || this.state === 'visible') {
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.fillRect(this.x - this.size * 0.1, canvasY - this.size * 0.7, this.size*0.2, this.size*1.4);
            }
        } else { ctx.fillStyle = color; ctx.arc(this.x, canvasY, this.size / 2, 0, Math.PI * 2); ctx.fill(); }
    }
    update(climberRef) {
        if (this.state === 'hidden') {
            const distX = this.x - climberRef.x; const distY = this.y - climberRef.y;
            const distance = Math.sqrt(distX * distX + distY * distY);
            if (distance < GRIP_PROXIMITY_REVEAL_DISTANCE) this.state = 'visible';
        }
        if (this.state === 'active' || this.state === 'degrading') {
            this.timer++;
            if (this.state === 'active' && this.timer > this.degradationTime * 0.6) { this.state = 'degrading'; playSound('degradeTick'); }
            if (this.timer > this.degradationTime) {
                const wasNotFailed = this.state !== 'failed'; this.fail();
                if (wasNotFailed) playSound('gripFail');
                if (climberRef.currentGrip === this) climberRef.fall();
            }
        }
    }
    activate() { if (this.state !== 'failed') { this.state = 'active'; this.timer = 0; } }
    fail() { this.state = 'failed'; }
}

class Protection {
    constructor(x, y) { this.x = x; this.y = y; this.size = PROTECTION_SIZE; this.color = PROTECTION_COLOR; }
    draw() {
        const canvasY = this.y - cameraY;
        if (canvasY < -this.size || canvasY > CANVAS_HEIGHT + this.size) return;
        ctx.fillStyle = this.color; ctx.beginPath();
        ctx.moveTo(this.x - this.size / 2, canvasY - this.size / 2);
        ctx.lineTo(this.x + this.size / 2, canvasY - this.size / 2);
        ctx.lineTo(this.x + this.size / 3, canvasY + this.size / 2);
        ctx.lineTo(this.x - this.size / 3, canvasY + this.size / 2);
        ctx.closePath(); ctx.fill();
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
        
        this.shapes = this.makeShapes();
        
        // Event listeners
        window.addEventListener('resize', () => this.handleResize());
        
        // Start animation -- REMOVED
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
    makeShapes() {
        const shapes = [];
        const numShapes = 18;
        
        for (let i = 0; i < numShapes; i++) {
            const big = Math.pow(Math.random(), 2.2);
            const len = (this.h * 0.16) + big * (this.h * 0.25);
            const width = (5 + Math.random() * 18) * (1 - big) + (20 + Math.random() * 40) * big;
            const ratio = len / width;
            if (ratio > 30) continue;
            
            const edges = Math.floor(3 + Math.random() * 7);
            const spread = (this.w * 0.4);
            const baseAngle = (-Math.PI/2) + (i/(numShapes-1) - 0.5) * (Math.PI/1.2);
            
            shapes.push({
                points: this.makeJaggedPoly({len, width, edges, angle: 0, spread: 1}),
                baseAngle,
                angle: baseAngle + (Math.random()-0.5)*0.04,
                x: this.w/2,
                y: this.h*0.07 + Math.random()*this.h*0.03,
                len,
                width,
                color: this.randomGray(),
                speed: 0.1 + big * 1.1 + Math.random()*0.2,
                drift: (Math.random()-0.9)*0.12,
                grow: 3 + big*0.11 + Math.random()*0.03,
                edges,
                spread: 2 + Math.random()*0.2,
                t: Math.random()*this.h
            });
        }
        
        return shapes;
    }

    drawShape(shape) {
        this.ctx.save();
        this.ctx.translate(shape.x, shape.y);
        this.ctx.rotate(shape.angle + Math.PI / 2);
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

    animate(now) {
        this.ctx.clearRect(0, 0, this.w, this.h);
        
        let dt = 0;
        if (this.running) {
             dt = Math.min(0.06, (now - this.lastTime) / 16.66);
        }

        for (let shape of this.shapes) {
            if (this.running) {
                shape.x -= shape.speed * dt;
                shape.y += Math.sin(shape.baseAngle) * shape.speed * dt * 0.7;
                shape.grow += dt * 0.0007 * shape.len;
                shape.angle += shape.drift * dt * 0.01;

                if (shape.x + shape.len < -40 || shape.y < -100 || shape.y > this.h + 100) {
                    // Only re-initialize if running, to prevent shapes popping in/out when paused and resized.
                    Object.assign(shape, this.makeShapes()[0]); 
                    shape.x = this.w/2;
                    shape.y = this.h*0.07 + Math.random()*this.h*0.03;
                }
            }
            this.drawShape(shape);
        }
        
        if (this.running) {
            this.lastTime = now;
        }
        // Removed requestAnimationFrame call
    }

    togglePause() {
        this.running = !this.running;
        this.pauseBtn.textContent = this.running ? "Pause" : "Resume";
        if (this.running) {
            this.lastTime = performance.now();
        }
    }

    handleResize() {
        this.w = CANVAS_WIDTH;
        this.h = CANVAS_HEIGHT;
        this.canvas.width = this.w;
        this.canvas.height = this.h;
        this.shapes = this.makeShapes();
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
            // The main gameLoop will continue to call animate, which will now draw the static state
        }, this.briefAnimationDuration);
    }
}

function generateWallTexture() {
    wallTexture = [];
    const numCols = Math.ceil(CANVAS_WIDTH / WALL_CHUNK_SIZE);
    const numRows = Math.ceil((CANVAS_HEIGHT * 4) / WALL_CHUNK_SIZE);
    for (let r = 0; r < numRows; r++) {
        for (let c = 0; c < numCols; c++) {
            const shade = WALL_COLOR_MIN_SHADE + Math.random() * (WALL_COLOR_MAX_SHADE - WALL_COLOR_MIN_SHADE);
            wallTexture.push({ x: c * WALL_CHUNK_SIZE, y: r * WALL_CHUNK_SIZE, color: `rgb(${shade},${shade},${shade})`});
        }
    }
}

function drawWallBackground() {
    ctx.fillStyle = '#383838'; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    for (const chunk of wallTexture) {
        const chunkCanvasY = chunk.y - cameraY;
        if (chunkCanvasY + WALL_CHUNK_SIZE >= 0 && chunkCanvasY <= CANVAS_HEIGHT) {
            ctx.fillStyle = chunk.color; ctx.fillRect(chunk.x, chunkCanvasY, WALL_CHUNK_SIZE, WALL_CHUNK_SIZE);
        }
    }
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

function generateGrips(targetTotalGrips = 250) { // Increased target for denser feel
    grips = [];
    const startGripY = CANVAS_HEIGHT - 60;
    const startGrip = new Grip(CANVAS_WIDTH / 2, startGripY, GRIP_SIZE_MAX);
    startGrip.state = 'active';
    startGrip.isCrack = true;
    grips.push(startGrip);
    
    let mainProgressionGrip = startGrip;
    const MIN_DIST_SQ = MIN_GRIP_SEPARATION * MIN_GRIP_SEPARATION;

    const worldTopY = -(CANVAS_HEIGHT * 2.5); // How far up grips can be generated

    while (grips.length < targetTotalGrips && mainProgressionGrip.y > worldTopY) {
        let primaryGripMade = false;
        let currentSourceForAux = mainProgressionGrip; // Default source for aux grips

        // 1. Generate a primary "progressive" grip from mainProgressionGrip
        for (let attempt = 0; attempt < 8 && !primaryGripMade; attempt++) { // Increased attempts
            // Try to go mostly up, but with some horizontal variance
            let nextY = mainProgressionGrip.y - (CLIMBER_REACH * 0.5 + Math.random() * CLIMBER_REACH * 0.4); // 50% to 90% of reach upwards
            let nextX = mainProgressionGrip.x + (Math.random() - 0.5) * CLIMBER_REACH * 1.0; // Spread up to 0.5 reach L/R
            
            nextX = Math.max(GRIP_SIZE_MAX, Math.min(CANVAS_WIDTH - GRIP_SIZE_MAX, nextX));
            nextY = Math.max(worldTopY, nextY); // Don't generate above world top

            const dPriX = nextX - mainProgressionGrip.x;
            const dPriY = nextY - mainProgressionGrip.y;
            const distToSourceSq = dPriX * dPriX + dPriY * dPriY;

            // Ensure it's a decent move, within reach, and not too short unless near top
            if (distToSourceSq > CLIMBER_REACH * CLIMBER_REACH || 
                (distToSourceSq < (CLIMBER_REACH * 0.3) * (CLIMBER_REACH * 0.3) && nextY > worldTopY + CANVAS_HEIGHT/2) ) { // Avoid tiny moves unless near end
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

        if (!primaryGripMade || grips.length >= targetTotalGrips) break; // Could not make a primary, or done

        // 2. Generate auxiliary grips from currentSourceForAux
        const numAuxGripsToTry = 1 + Math.floor(Math.random() * 2); // 1 or 2 aux grips
        for (let i = 0; i < numAuxGripsToTry && grips.length < targetTotalGrips; i++) {
            for (let attempt = 0; attempt < 5; attempt++) {
                const angle = (Math.random() * Math.PI * 1.8) - (Math.PI * 0.9); // -162 to +162 deg, wide spread
                const distance = (CLIMBER_REACH * 0.35) + (Math.random() * CLIMBER_REACH * 0.6); // 35% to 95% of reach

                let auxNextX = currentSourceForAux.x + Math.cos(angle) * distance;
                // Allow aux grips to be slightly lower than their source
                let auxNextY = currentSourceForAux.y + Math.sin(angle) * distance; 
                
                auxNextX = Math.max(GRIP_SIZE_MAX, Math.min(CANVAS_WIDTH - GRIP_SIZE_MAX, auxNextX));
                auxNextY = Math.max(worldTopY, Math.min(currentSourceForAux.y + CLIMBER_REACH * 0.35, auxNextY)); // Clamp Y: not above top, not too far below source

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
     // Ensure start grip is accessible if few grips generated
    if (grips.length <= 1 && targetTotalGrips > 1) {
        const g = new Grip(startGrip.x + 20, startGrip.y - 20, GRIP_SIZE_MAX);
        if(!isTooCloseToExistingGrips(g.x, g.y, MIN_DIST_SQ, grips)) grips.push(g);
    }
}

function startGamePlay() {
    initAudio();
    gameState = 'playing';

    instructionsScreen.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    uiContainer.classList.remove('hidden'); 
    gameOverScreen.classList.add('hidden');

    cameraY = 0;
    score = 0;
    if (rockface) rockface.handleResize(); // Reset Rockface visuals
    rockface.running = false; // Start with a static background
    generateGrips(); 
    const initialGrip = grips.length > 0 ? grips[0] : new Grip(CANVAS_WIDTH/2, CANVAS_HEIGHT - 60, GRIP_SIZE_MAX); // Fallback if gen fails
    if(grips.length === 0) { // Ensure at least one grip if generation was problematic
        initialGrip.state = 'active';
        initialGrip.isCrack = true;
        grips.push(initialGrip);
    }

    climber = new Climber(initialGrip.x, initialGrip.y);
    climber.currentGrip = initialGrip;
    maxAchievedRawY = climber.y;
    protections = [];
    
    updateUI();

    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    lastTime = performance.now();
    animationFrameId = requestAnimationFrame(gameLoop);
}

function updateUI() {
    score = Math.max(0, Math.floor((CANVAS_HEIGHT - maxAchievedRawY) / 10));
    scoreDisplay.textContent = score;
    staminaDisplay.textContent = Math.floor(climber.stamina);
    protectionCountDisplay.textContent = climber.protectionInventory;
    currentHeightDisplay.textContent = Math.max(0, Math.floor((CANVAS_HEIGHT - climber.y) / 10));
}

function loadHighScore() { const storedHighScore = localStorage.getItem(HIGH_SCORE_KEY); highScore = storedHighScore ? parseInt(storedHighScore, 10) : 0; }
function saveHighScore() { localStorage.setItem(HIGH_SCORE_KEY, highScore.toString()); }

function checkEndConditions() {
    // terminal fall handles its own reset path)
    if (gameState === 'terminalFalling') return; 

    if (climber.y < -(CANVAS_HEIGHT * 2)) { 
        setGameOver();
    }
    // Use climber.bodyHeight for more accurate off-screen check
    if (climber.isFalling && climber.y >= (CANVAS_HEIGHT + cameraY - climber.bodyHeight / 2) && protections.length === 0 && gameState !== 'terminalFalling') {
        setGameOver();
    }
}

function setGameOver() {
    if (gameState === 'gameOver') return; 
    gameState = 'gameOver';
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
    if (terminalFallTimer) clearTimeout(terminalFallTimer);

    finalScoreDisplay.textContent = score;
    if (score > highScore) { highScore = score; saveHighScore(); }
    highScoreDisplayElement.textContent = highScore;

    uiContainer.classList.add('hidden');
    gameContainer.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');
    instructionsScreen.classList.add('hidden');
}

function drawDebugInfo() {
    if (!climber || gameState === 'initial' || gameState === 'gameOver') return;
    let reachableCount = 0;
    let visibleAndReachableCount = 0;

    grips.forEach(grip => {
        if (grip.state !== 'failed' && grip !== climber.currentGrip && climber.canReachGrip(grip)) {
            reachableCount++;
            if (grip.state !== 'hidden') {
                visibleAndReachableCount++;
            }
        }
    });

    ctx.fillStyle = "rgba(0,0,0,0.75)";
    const debugBoxHeight = 80;
    ctx.fillRect(5, CANVAS_HEIGHT - debugBoxHeight - 5, 220, debugBoxHeight);
    ctx.fillStyle = "#0F0"; // Green debug text
    ctx.font = "12px Courier New";
    ctx.fillText(`Climber Reach: ${climber.reach.toFixed(0)}`, 10, CANVAS_HEIGHT - debugBoxHeight + 10);
    ctx.fillText(`Reachable Grips (any): ${reachableCount}`, 10, CANVAS_HEIGHT - debugBoxHeight + 30);
    ctx.fillText(`Reachable (visible): ${visibleAndReachableCount}`, 10, CANVAS_HEIGHT - debugBoxHeight + 50);
    ctx.fillText(`Total Grips on Wall: ${grips.length}`, 10, CANVAS_HEIGHT - debugBoxHeight + 70);
}

let lastTime = 0;
let rockface;
function gameLoop(timestamp) {
    // ... (gameLoop largely as before) ...
    if (gameState === 'gameOver') {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        return;
    }
    animationFrameId = requestAnimationFrame(gameLoop); 

    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    if (gameState === 'playing' || gameState === 'falling' || gameState === 'terminalFalling') {
        climber.update();
        grips.forEach(grip => grip.update(climber));
        
        // ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT); // Removed, Rockface.animate will clear
        // drawWallBackground(); // Removed
        if (rockface) rockface.animate(timestamp); // Rockface clears and draws background

        protections.forEach(p => p.draw());
        grips.forEach(grip => grip.draw());
        climber.draw();
        
        if (climber.currentGrip && !climber.isFalling && protections.length > 0 && gameState !== 'terminalFalling') {
            // ... rope drawing ...
            let ropeTargetProtection = null;
            for (let i = 0; i < protections.length; i++) {
                if (protections[i].y >= climber.y) { ropeTargetProtection = protections[i]; break; }
            }
            if (!ropeTargetProtection && protections.length > 0) ropeTargetProtection = protections[0];
            if (ropeTargetProtection) {
                ctx.beginPath(); ctx.moveTo(climber.x, climber.y - cameraY);
                ctx.lineTo(ropeTargetProtection.x, ropeTargetProtection.y - cameraY);
                ctx.strokeStyle = 'rgba(230, 230, 230, 0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
            }
        }
        updateUI();
        checkEndConditions(); 
        if (showDebugInfo) drawDebugInfo(); // Draw debug info if toggled
    }
}

function handleCanvasClick(event) {
    if (gameState === 'start') { // Changed from 'initial' to 'start'
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
        if (grip.state !== 'failed' && grip.state !== 'hidden' && climber.canReachGrip(grip)) { // Ensure grip is visible too
            const distToClickX = grip.x - clickX; const distToClickY = grip.y - clickY;
            const currentDistToClick = Math.sqrt(distToClickX * distToClickX + distToClickY * distToClickY);
            if (currentDistToClick < grip.size * 2.5 && currentDistToClick < minDistToClick) { // Click closer to this grip
                minDistToClick = currentDistToClick; bestGrip = grip;
            }
        }
    });
    if (bestGrip) climber.moveTo(bestGrip);
}

function handleKeyPress(event) {
    if (event.key === 'd' || event.key === 'D') { // Toggle debug info
        showDebugInfo = !showDebugInfo;
        if (!showDebugInfo && (gameState === 'playing' || gameState === 'falling')) {
            // Force a redraw to clear debug if it was turned off
            // This is a bit hacky; ideally, redraw would be more structured
            // For now, it will clear on next gameLoop tick.
        }
        return; // Consume the 'd' key press for debug toggle
    }

    if (gameState === 'initial') {
        startGamePlay();
        return;
    }
    if (gameState !== 'playing' && gameState !== 'falling') return;
    initAudio();

    if (event.key === 'p' || event.key === 'P') {
        if (gameState === 'playing') climber.placeProtection();
    }
}

function initGame(showInstructions = true) {
    console.log("Initializing game (showInstructions: " + showInstructions + ")");
    if (animationFrameId) { // Stop any existing game loop
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    // Reset general scores and UI elements
    score = 0;
    updateUI(); // Shows 0 score, default stamina/protection based on potential new climber in startGamePlay

    if (rockface) {
        rockface.handleResize(); // Reset Rockface visuals
        rockface.running = true; // Ensure rockface animation is ready
    }
    
    if (showInstructions) {
        gameState = 'start';
        instructionsScreen.classList.remove('hidden');
        gameContainer.classList.add('hidden');
        gameOverScreen.classList.add('hidden');
        
        // Clear the canvas and wait for player to start the game via interaction.
        // The gameLoop (and thus Rockface animation) will not run yet.
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        // Optionally, draw a static background here if desired while on instructions.
        // For example: if (rockface && rockface.shapes && rockface.shapes.length > 0) rockface.drawShape(rockface.shapes[0]);
        
    } else { // Restarting game (e.g., from game over button)
        startGamePlay(); // This will set up screens, game state, and start the gameLoop
    }
}

// Event Listeners (ensure they are not duplicated if script is re-run in some contexts)
// A simple way to avoid duplicates if this script block could be evaluated multiple times:
if (!window.verticalOdysseyListenersAttached) {
    document.addEventListener('keydown', handleKeyPress);
    canvas.addEventListener('click', handleCanvasClick);
    restartButton.addEventListener('click', () => {
        initGame(false); 
    });
    window.verticalOdysseyListenersAttached = true;
}

// Initial Setup
document.addEventListener('DOMContentLoaded', () => {
    rockface = new Rockface(canvas, 'restartButton'); 
    initGame(true); // Initialize the game, showing instructions by default
});
