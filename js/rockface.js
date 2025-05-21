/**
 * @file rockface.js
 * @description Manages the visual representation of the rock face, including its dynamic jagged shapes
 * and the static textured background.
 */

// Assumed globals for now: ctx, cameraY, wallTexture (for generate/drawWallBackground initially)
// Constants like CANVAS_WIDTH, CANVAS_HEIGHT, WALL_CHUNK_SIZE, etc., will need to be imported.

// Placeholder for constants that will be imported
// import { CANVAS_WIDTH, CANVAS_HEIGHT, WALL_COLOR_MIN_SHADE, WALL_COLOR_MAX_SHADE, WALL_CHUNK_SIZE } from './constants.js';
/**
 * @file rockface.js
 * @description Manages the visual representation of the rock face, monolith style.
 * Closely based on script10.js monolith logic with modifications.
 */

/**
 * @file rockface.js
 * @description Manages the visual representation of the rock face, including its dynamic jagged shapes.
 * Aims to replicate the visual style of an older monolith version.
 */

class Rockface {
    constructor(canvas, pauseButtonId, constants = {}, initialCameraY = 0) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.pauseBtn = document.getElementById(pauseButtonId);
        
        this.constants = constants;
        this.CANVAS_WIDTH = this.constants.CANVAS_WIDTH || 800;
        this.CANVAS_HEIGHT = this.constants.CANVAS_HEIGHT || 800;
        this.WALL_COLOR_MIN_SHADE = this.constants.WALL_COLOR_MIN_SHADE || 30;
        this.WALL_COLOR_MAX_SHADE = this.constants.WALL_COLOR_MAX_SHADE || 100;
        // Match old alpha, allow override via constants
        this.ROCK_SHAPE_ALPHA = this.constants.ROCK_SHAPE_ALPHA !== undefined ? this.constants.ROCK_SHAPE_ALPHA : 0.93;

        this.shapes = [];
        this.currentCameraY = initialCameraY;

        this.running = true;
        this.lastTime = performance.now();
        this.briefAnimationTimeout = null;
        this.briefAnimationDuration = 400; // ms

        this.init();
    }

    init() {
        this.shapes = this.makeShapes(150); // Number of monoliths
        if (this.pauseBtn) {
            this.pauseBtn.addEventListener('click', () => this.togglePause());
            this.pauseBtn.textContent = this.running ? "Pause BG" : "Run BG";
        }
        // Event listener for resize should be added by the main application,
        // which then calls rockfaceInstance.handleResize(newWidth, newHeight).
    }

    randomGray() {
        const gray = Math.floor(Math.random() * (this.WALL_COLOR_MAX_SHADE - this.WALL_COLOR_MIN_SHADE + 1)) + this.WALL_COLOR_MIN_SHADE;
        return `rgb(${gray},${gray},${gray})`;
    }

    makeJaggedPoly(opts) {
        const { len, width, edges, angle = 0, spread = 1 } = opts; // angle here is for polygon internal structure, not world rotation
        const points = [];
        let x = 0, y = 0;
        points.push({ x, y });

        for (let i = 1; i < edges - 1; i++) {
            const t = i / (edges - 1);
            y = t * len + (Math.random() - 0.5) * len * 0.01;
            const side = (Math.random() - 0.1) * width * (0.99 + t * 1.5) * spread;
            x = side;
            points.push({ x, y });
        }

        points.push({ x: -width / 2 + (Math.random() - 0.5) * width * 0.2, y: len + (Math.random() - 0.5) * len * 0.03 });
        points.push({ x: width / 2 + (Math.random() - 0.5) * width * 0.2, y: len + (Math.random() - 0.5) * len * 0.03 });

        for (let i = edges - 2; i > 0; i--) {
            points.push({ x: -points[i].x, y: points[i].y });
        }

        const rad = angle;
        const cosA = Math.cos(rad);
        const sinA = Math.sin(rad);
        for (let pt of points) {
            let nx = pt.x * cosA - pt.y * sinA;
            let ny = pt.x * sinA + pt.y * cosA;
            pt.x = nx;
            pt.y = ny;
        }
        return points;
    }

    // Generates the core geometric and visual properties for a new shape
    _generateCoreShapeProperties() {
        const bigFactor = Math.pow(Math.random(), 2.2);
        const len = (this.CANVAS_HEIGHT * 0.16) + bigFactor * (this.CANVAS_HEIGHT * 0.25);
        const widthFactor = (5 + Math.random() * 18) * (1 - bigFactor) + (20 + Math.random() * 40) * bigFactor;
        const width = Math.max(1, widthFactor); // Ensure width is at least 1 to avoid div by zero or extreme ratios

        if (width === 0) return null; // Should be caught by Math.max(1, ...) but defensive
        const ratio = len / width;
        if (ratio > 30) return null; // Old version's ratio check

        const edges = Math.floor(3 + Math.random() * 7); // Old version's edge count
        
        // Old version's 'grow' property (direct scale factor)
        const currentScale = 3 + bigFactor * 0.11 + Math.random() * 0.03; 

        return {
            points: this.makeJaggedPoly({ len, width, edges, angle: 0, spread: 1 }),
            len,
            width,
            color: this.randomGray(),
            currentScale, // This is the static scale factor
            t: Math.random() * this.CANVAS_HEIGHT, // Old 't' property
        };
    }
    
    // Configures a single shape, either for initial generation or recycling
    _configureSingleShape(isInitial = true, oldShapeForRecycling = null) {
        const coreProperties = this._generateCoreShapeProperties();
        if (!coreProperties) return null;

        let x, y;

        if (isInitial) {
            // Old version: initial X fixed at center, Y in a narrow band near top
            x = this.CANVAS_WIDTH / 2;
            y = this.CANVAS_HEIGHT * 0.07 + Math.random() * this.CANVAS_HEIGHT * 0.03;
        } else { // Recycling
            if (!oldShapeForRecycling) {
                console.warn("Old shape not provided for recycling config, defaulting to initial placement.");
                x = this.CANVAS_WIDTH / 2;
                y = this.CANVAS_HEIGHT * 0.07 + Math.random() * this.CANVAS_HEIGHT * 0.03;
            } else {
                // Old version: recycled shapes appear from the right, Y anywhere in viewport
                // The x-offset used the old shape's width and scale (grow)
                x = this.CANVAS_WIDTH + (oldShapeForRecycling.width * oldShapeForRecycling.currentScale / 2) + Math.random() * 50;
                y = this.currentCameraY + (Math.random() * this.CANVAS_HEIGHT);
            }
        }

        return {
            ...coreProperties,
            x,
            y,
            baseAngle: 0, // Placeholder: will be set by makeShapes or preserved from old shape
            currentAngle: 0, // Placeholder: will be set based on baseAngle + jitter
            age: 0, // Reset age, though not used by old animation logic for recycling
        };
    }
    
    makeShapes(numShapes = 150) {
        const newShapes = [];
        for (let i = 0; i < numShapes; i++) {
            let shapeConfig = null;
            let attempts = 0;
            while (!shapeConfig && attempts < 15) { 
                shapeConfig = this._configureSingleShape(true); // isInitial = true
                attempts++;
            }
            if (!shapeConfig) {
                console.warn(`Failed to create shape ${i} after ${attempts} attempts.`);
                continue; 
            }

            // Fanning angle based on index
            shapeConfig.baseAngle = (-Math.PI / 2) + (i / (numShapes - 1) - 0.5) * (Math.PI / 1.1);
            // Final orientation with jitter, non-rotating
            shapeConfig.currentAngle = shapeConfig.baseAngle + (Math.random() - 0.5) * 0.04; 
            newShapes.push(shapeConfig);
        }
        return newShapes;
    }

    drawShape(shape, currentCameraY) {
        // Culling logic (same as provided in non-working example, seems reasonable)
        const yCanvasTip = shape.y - currentCameraY;
        // Approximate visible height considering scale, assuming polygon points are roughly centered around origin before scaling.
        // For a more accurate bottom edge, one would need to know the max y of shape.points * shape.currentScale.
        // Using shape.len as a proxy for height.
        const yCanvasBase = yCanvasTip + (shape.len * shape.currentScale); 

        if (yCanvasBase < 0 || yCanvasTip > this.CANVAS_HEIGHT) {
            return; 
        }
        const approxHalfWidth = (shape.width * shape.currentScale) / 2;
        const shapeCanvasLeft = shape.x - approxHalfWidth;
        const shapeCanvasRight = shape.x + approxHalfWidth;
        if (shapeCanvasRight < 0 || shapeCanvasLeft > this.CANVAS_WIDTH) {
            return;
        }

        this.ctx.save();
        this.ctx.translate(shape.x, shape.y - currentCameraY); 
        this.ctx.rotate(shape.currentAngle + Math.PI / 2); // Old rotation style
        this.ctx.scale(shape.currentScale, shape.currentScale); // Use the static scale
        
        this.ctx.beginPath();
        const pts = shape.points;
        if (!pts || pts.length === 0) {
            this.ctx.restore(); return;
        }
        this.ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
            this.ctx.lineTo(pts[i].x, pts[i].y);
        }
        this.ctx.closePath();
        this.ctx.fillStyle = shape.color;
        this.ctx.globalAlpha = this.ROCK_SHAPE_ALPHA; // Use configured alpha
        this.ctx.fill();
        this.ctx.restore();
    }

    draw(currentGlobalCameraY) {
        this.currentCameraY = currentGlobalCameraY; 
        if (!this.running && !this.briefAnimationTimeout) return;
        // Game loop should clear canvas before calling this
        this.shapes.forEach(shape => this.drawShape(shape, this.currentCameraY));
    }

    animateLogic(dt, currentGlobalCameraY) { // dt is not used if shapes are static
        if (!this.running) return; // Only proceed if running

        this.currentCameraY = currentGlobalCameraY;

        this.shapes.forEach((shape, index) => {
            // shape.age += dt * 1000; // Not used for old recycling logic

            // Old recycling condition (checking all 4 edges)
            // Approximate boundaries of the shape on canvas
            const shapeRadiusEstimate = Math.max(shape.len, shape.width) * shape.currentScale / 2;
            const shapeCenterYOnCanvas = shape.y - this.currentCameraY;
            
            const shapeTopEdgeCanvas = shapeCenterYOnCanvas - shapeRadiusEstimate;
            const shapeBottomEdgeCanvas = shapeCenterYOnCanvas + shapeRadiusEstimate;
            const shapeCenterXOnCanvas = shape.x;
            const shapeLeftEdgeCanvas = shapeCenterXOnCanvas - shapeRadiusEstimate;
            const shapeRightEdgeCanvas = shapeCenterXOnCanvas + shapeRadiusEstimate;
            
            // Old recycling margins: top/bottom +/-100, left/right +/-40
            const isOffscreen = shapeRightEdgeCanvas < -40 ||
                                shapeLeftEdgeCanvas > this.CANVAS_WIDTH + 40 ||
                                shapeBottomEdgeCanvas < -100 ||
                                shapeTopEdgeCanvas > this.CANVAS_HEIGHT + 100;

            if (isOffscreen) {
                let newShapeConfig = null;
                let attempts = 0;
                while(!newShapeConfig && attempts < 10) {
                    // Pass the current shape being replaced for its width/scale info (for x-repositioning)
                    // and its baseAngle (to preserve the fan slot).
                    newShapeConfig = this._configureSingleShape(false, shape); 
                    attempts++;
                }

                if (newShapeConfig) {
                    newShapeConfig.baseAngle = shape.baseAngle; // Preserve the fanning slot
                    newShapeConfig.currentAngle = newShapeConfig.baseAngle + (Math.random() - 0.5) * 0.04; // Apply new jitter
                    this.shapes[index] = newShapeConfig;
                } else {
                    // If creating a new shape fails, to avoid errors or losing shapes,
                    // we could log it. For now, the shape is not replaced if _configureSingleShape returns null.
                    // This might happen if _generateCoreShapeProperties returns null repeatedly (e.g. due to ratio check).
                    console.warn(`Recycling failed for shape at index ${index}, keeping old shape for now.`);
                }
            }
        });
    }

    animate(timestamp, cameraY) { 
        if (!this.running && !this.briefAnimationTimeout) {
            return; 
        }

        const now = timestamp;
        const elapsed = now - this.lastTime;
        this.lastTime = now;
        // Time delta in seconds, though not directly used by static shapes, good for consistency
        const timeDeltaSeconds = Math.min(0.1, elapsed / 1000); // Cap delta to avoid large jumps

        if (this.running) { 
            this.animateLogic(timeDeltaSeconds, cameraY);
        }
    }

    togglePause() {
        if (this.briefAnimationTimeout) {
            clearTimeout(this.briefAnimationTimeout);
            this.briefAnimationTimeout = null;
        }
        this.running = !this.running;
        if (this.pauseBtn) this.pauseBtn.textContent = this.running ? "Pause BG" : "Run BG";
        if (this.running) {
            this.lastTime = performance.now(); 
        }
    }

    runBriefly() {
        this.running = true; 
        if (this.pauseBtn) this.pauseBtn.textContent = "Pause BG"; // Visually indicate it's running
        this.lastTime = performance.now();

        if (this.briefAnimationTimeout) clearTimeout(this.briefAnimationTimeout);
        this.briefAnimationTimeout = setTimeout(() => {
            this.running = false; 
            if (this.pauseBtn) this.pauseBtn.textContent = "Run BG"; // Revert text after brief run
            this.briefAnimationTimeout = null;
        }, this.briefAnimationDuration);
    }

    // Call this from your main application when the canvas resizes
    handleResize(newWidth, newHeight) {
        this.CANVAS_WIDTH = newWidth;
        this.CANVAS_HEIGHT = newHeight;
        // The canvas element's width/height attributes should be set by the calling code
        // that owns the canvas element.
        this.shapes = this.makeShapes(this.shapes.length || 150); // Regenerate shapes, try to keep similar count
        this.draw(this.currentCameraY); // Optionally redraw immediately
    }
}

export default Rockface;