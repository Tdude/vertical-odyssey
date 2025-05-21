/**
 * @file protection.js
 * @description Defines the Protection class, representing a piece of protection (e.g., a nut or cam)
 * placed by the climber. Protections can be used to catch falls or as belay anchors.
 */

// Assumed global: ctx, cameraY. These will need to be passed or accessed via a game manager.
import { PROTECTION_SIZE, PROTECTION_COLOR } from './constants.js';

class Protection {
    constructor(x, y, { getCtxFn } = {}) {
        this.id = `protection-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.x = x;
        this.y = y;
        this.size = PROTECTION_SIZE;
        this.color = PROTECTION_COLOR;
        this.isUsed = false; // Has a fall been caught by this piece?
        this.state = 'placed'; // 'placed', 'loaded_fall', 'used_for_belay'

        this.getContext = getCtxFn || (() => window.ctx); // Fallback to global ctx
    }

    draw() {
        const currentCtx = this.getContext();
        if (!currentCtx) return;

        const canvasY = this.y + cameraY; // Apply camera offset
        if (canvasY < -this.size || canvasY > window.CANVAS_HEIGHT + this.size) return; // Culling

        currentCtx.fillStyle = this.color;
        if (this.state === 'loaded_fall') {
            currentCtx.fillStyle = 'orange'; // Indicate it has taken a fall
        } else if (this.state === 'used_for_belay') {
            currentCtx.fillStyle = 'cyan'; // Indicate used as belay anchor
        }
        
        currentCtx.beginPath();
        currentCtx.arc(this.x, canvasY, this.size, 0, Math.PI * 2);
        currentCtx.fill();

        // Maybe add a small line to indicate it's 'clipped' to the rope if applicable
    }

    /**
     * Marks the protection as used, typically after catching a fall or being used as a belay point.
     * @param {string} usageType - How the protection was used ('loaded_fall', 'used_for_belay').
     */
    use(usageType = 'loaded_fall') {
        this.isUsed = true;
        this.state = usageType;
        // console.log(`CASCADE_PROTECTION: Protection ${this.id} marked as ${this.state}`);
    }

    /**
     * Resets the protection's state if needed (e.g., if game has complex reuse mechanics).
     * For now, protections are single-use for catching a fall or permanent as belay anchors.
     */
    release() {
        // This might be used if protections could be retrieved, but currently they are not.
        // For now, 'used_for_belay' implies it's part of the rope path.
        // 'loaded_fall' means it caught a fall and is visually distinct.
    }
}

export { Protection };
