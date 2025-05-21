import {
    CLIMBER_FACE_STATE_FORWARD, CLIMBER_FACE_STATE_TURNING, CLIMBER_FACE_STATE_TURNED,
    CLIMBER_IDLE_LOOK_PHASE_NONE, CLIMBER_IDLE_LOOK_PHASE_TURNING_LEFT, CLIMBER_IDLE_LOOK_PHASE_LOOKING_LEFT,
    CLIMBER_IDLE_LOOK_PHASE_RETURNING_FROM_LEFT, CLIMBER_IDLE_LOOK_PHASE_TURNING_RIGHT,
    CLIMBER_IDLE_LOOK_PHASE_LOOKING_RIGHT, CLIMBER_IDLE_LOOK_PHASE_RETURNING_FROM_RIGHT,
    TURN_ANIMATION_DURATION, IDLE_TIMEOUT_DURATION, IDLE_LOOK_PAUSE_DURATION, MIN_IDLE_FEATURE_SCALE,
    CLIMBER_FEATURE_OFFSET_HEAD_RADIUS_RATIO, // Needed for facial feature offset calculation
    CLIMBER_BODY_HEIGHT, // Needed for rope climbing hand animation
    // Added constants for drawing:
    CLIMBER_COLOR, CLIMBER_HEAD_COLOR,
    CLIMBER_CAP_COLOR, CLIMBER_CAP_HEIGHT_FACTOR, CLIMBER_CAP_WIDTH_FACTOR, CLIMBER_CAP_TOP_Y_OFFSET_FACTOR,
    CLIMBER_HAND_COLOR, CLIMBER_HAND_HEAD_RADIUS_RATIO,
    CLIMBER_BEARD_COLOR, CLIMBER_BEARD_WIDTH_HEAD_RADIUS_RATIO, 
    CLIMBER_BEARD_BASE_Y_HEAD_CENTER_OFFSET_FACTOR, CLIMBER_BEARD_LENGTH_FACTOR,
    CLIMBER_GOGGLE_LENS_COLOR, CLIMBER_GOGGLE_FRAME_COLOR, CLIMBER_GOGGLE_LENS_RADIUS_FACTOR, 
    CLIMBER_GOGGLE_CENTER_Y_OFFSET_FACTOR, CLIMBER_GOGGLE_SEPARATION_FACTOR, 
    CLIMBER_GOGGLE_FRAME_THICKNESS_FACTOR, CLIMBER_GOGGLE_STRAP_THICKNESS
} from './constants.js';

export class ClimberAnimationManager {
    constructor(headRadius, bodyHeight) {
        this.headRadius = headRadius; // Store for calculations if needed directly
        this.bodyHeight = bodyHeight; // Store for calculations if needed directly

        // Facial features animation
        this.facialFeaturesState = CLIMBER_FACE_STATE_FORWARD;
        this.turnAnimationProgress = 0;

        // Idle look animation
        this.idleTimer = 0;
        this.isPerformingIdleLook = false;
        this.idleLookPhase = CLIMBER_IDLE_LOOK_PHASE_NONE;
        this.idleLookPauseTimer = 0;

        // Rope climbing specific animation properties
        this.ropeClimbingHands = { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } };
        this.ropeClimbingAnimationActive = false;
        this.ropeClimbingAnimationTimer = 0;
    }

    update(deltaTimeInSeconds, climberStatus) {
        // Handle idle look animation timer and state transitions
        if (!climberStatus.isFalling && !climberStatus.isHangingOnGrip && !climberStatus.isBelayingUp && !this.isPerformingIdleLook) {
            this.idleTimer += deltaTimeInSeconds * 1000;
            if (this.idleTimer >= IDLE_TIMEOUT_DURATION) {
                this.isPerformingIdleLook = true;
                this.idleTimer = 0;
                this.idleLookPhase = CLIMBER_IDLE_LOOK_PHASE_TURNING_LEFT;
                this.turnAnimationProgress = 0;
            }
        } else if (climberStatus.isFalling || climberStatus.isHangingOnGrip || climberStatus.isBelayingUp) {
            this.resetIdleAnimation();
        }

        if (this.isPerformingIdleLook) {
            this._updateIdleLookAnimation(deltaTimeInSeconds);
        }

        // Handle facial feature turning animation (for moving to grip)
        if (this.facialFeaturesState === CLIMBER_FACE_STATE_TURNING && !this.isPerformingIdleLook) {
            this.turnAnimationProgress += (deltaTimeInSeconds * 1000) / TURN_ANIMATION_DURATION;
            if (this.turnAnimationProgress >= 1) {
                this.turnAnimationProgress = 1;
                this.facialFeaturesState = CLIMBER_FACE_STATE_TURNED;
            }
        }

        // Handle rope climbing animation
        if (this.ropeClimbingAnimationActive) {
            this._updateRopeClimbingAnimation(deltaTimeInSeconds);
        }
    }

    _updateIdleLookAnimation(deltaTimeInSeconds) {
        const turnDuration = TURN_ANIMATION_DURATION / 2; // Half duration for one side turn

        switch (this.idleLookPhase) {
            case CLIMBER_IDLE_LOOK_PHASE_TURNING_LEFT:
            case CLIMBER_IDLE_LOOK_PHASE_RETURNING_FROM_LEFT:
            case CLIMBER_IDLE_LOOK_PHASE_TURNING_RIGHT:
            case CLIMBER_IDLE_LOOK_PHASE_RETURNING_FROM_RIGHT:
                this.turnAnimationProgress += (deltaTimeInSeconds * 1000) / turnDuration;
                if (this.turnAnimationProgress >= 1) {
                    this.turnAnimationProgress = 1;
                    if (this.idleLookPhase === CLIMBER_IDLE_LOOK_PHASE_TURNING_LEFT) this.idleLookPhase = CLIMBER_IDLE_LOOK_PHASE_LOOKING_LEFT;
                    else if (this.idleLookPhase === CLIMBER_IDLE_LOOK_PHASE_RETURNING_FROM_LEFT) this.idleLookPhase = CLIMBER_IDLE_LOOK_PHASE_TURNING_RIGHT;
                    else if (this.idleLookPhase === CLIMBER_IDLE_LOOK_PHASE_TURNING_RIGHT) this.idleLookPhase = CLIMBER_IDLE_LOOK_PHASE_LOOKING_RIGHT;
                    else if (this.idleLookPhase === CLIMBER_IDLE_LOOK_PHASE_RETURNING_FROM_RIGHT) {
                        this.idleLookPhase = CLIMBER_IDLE_LOOK_PHASE_NONE;
                        this.isPerformingIdleLook = false;
                    }
                    if (this.idleLookPhase === CLIMBER_IDLE_LOOK_PHASE_LOOKING_LEFT || this.idleLookPhase === CLIMBER_IDLE_LOOK_PHASE_LOOKING_RIGHT) {
                        this.idleLookPauseTimer = 0;
                    }
                    this.turnAnimationProgress = 0;
                }
                break;
            case CLIMBER_IDLE_LOOK_PHASE_LOOKING_LEFT:
            case CLIMBER_IDLE_LOOK_PHASE_LOOKING_RIGHT:
                this.idleLookPauseTimer += deltaTimeInSeconds * 1000;
                if (this.idleLookPauseTimer >= IDLE_LOOK_PAUSE_DURATION) {
                    if (this.idleLookPhase === CLIMBER_IDLE_LOOK_PHASE_LOOKING_LEFT) this.idleLookPhase = CLIMBER_IDLE_LOOK_PHASE_RETURNING_FROM_LEFT;
                    else if (this.idleLookPhase === CLIMBER_IDLE_LOOK_PHASE_LOOKING_RIGHT) this.idleLookPhase = CLIMBER_IDLE_LOOK_PHASE_RETURNING_FROM_RIGHT;
                    this.turnAnimationProgress = 0;
                }
                break;
        }
    }

    _updateRopeClimbingAnimation(deltaTimeInSeconds) {
        this.ropeClimbingAnimationTimer += deltaTimeInSeconds * 1000;
        const handMoveDuration = 200; // ms for one hand to complete its upward movement
        const progress = (this.ropeClimbingAnimationTimer % (handMoveDuration * 2)) / handMoveDuration;
        const handOffsetY = this.bodyHeight * 0.3; // Base offset from body center to hand Y
        const handReachY = this.bodyHeight * 0.5;  // How far hand reaches up during animation

        if (this.ropeClimbingAnimationTimer % (handMoveDuration * 2) < handMoveDuration) {
            // Left hand moves up, right hand stays at mid-point
            this.ropeClimbingHands.left.y = -this.bodyHeight / 2 - handOffsetY - handReachY * Math.sin(progress * Math.PI);
            this.ropeClimbingHands.right.y = -this.bodyHeight / 2 - handOffsetY;
        } else {
            // Right hand moves up, left hand stays at mid-point
            this.ropeClimbingHands.right.y = -this.bodyHeight / 2 - handOffsetY - handReachY * Math.sin(progress * Math.PI);
            this.ropeClimbingHands.left.y = -this.bodyHeight / 2 - handOffsetY;
        }
        // Keep hands centered horizontally for now
        this.ropeClimbingHands.left.x = 0;
        this.ropeClimbingHands.right.x = 0;
    }

    // --- Control Methods --- 
    startFaceTurn() {
        if (!this.isPerformingIdleLook) { // Don't override idle look with grip turning
            this.facialFeaturesState = CLIMBER_FACE_STATE_TURNING;
            this.turnAnimationProgress = 0;
        }
    }

    finishFaceTurn() {
         if (this.facialFeaturesState === CLIMBER_FACE_STATE_TURNING) {
            this.facialFeaturesState = CLIMBER_FACE_STATE_TURNED;
            this.turnAnimationProgress = 1; // Ensure it's fully turned for drawing logic
         }
    }

    resetFaceTurn() {
        this.facialFeaturesState = CLIMBER_FACE_STATE_FORWARD;
        this.turnAnimationProgress = 0;
        // If an idle look was in progress, it should be reset by notifyActivity/resetIdleAnimation
    }

    startRopeClimbingAnimation() {
        this.ropeClimbingAnimationActive = true;
        this.ropeClimbingAnimationTimer = 0;
    }

    stopRopeClimbingAnimation() {
        this.ropeClimbingAnimationActive = false;
    }

    resetIdleAnimation() {
        this.isPerformingIdleLook = false;
        this.idleLookPhase = CLIMBER_IDLE_LOOK_PHASE_NONE;
        this.idleTimer = 0;
        // Do not reset turnAnimationProgress here if a non-idle turn might be active.
        // If a non-idle turn should also be reset, call resetFaceTurn().
    }

    notifyActivity() { // Call this when climber moves, grabs, falls etc.
        this.resetIdleAnimation();
    }

    // --- Drawing Methods --- 
    drawClimber(ctx, climber) {
        // climber object contains: x, canvasY, bodyWidth, bodyHeight, headRadius, color, headColor

        // Draw body
        ctx.fillStyle = climber.color;
        ctx.fillRect(-climber.bodyWidth / 2, -climber.bodyHeight / 2, climber.bodyWidth, climber.bodyHeight);

        // Draw head
        ctx.fillStyle = climber.headColor;
        ctx.beginPath();
        ctx.arc(0, -climber.bodyHeight / 2 - climber.headRadius, climber.headRadius, 0, Math.PI * 2);
        ctx.fill();

        // Draw Cap
        const capHeightLocal = climber.headRadius * CLIMBER_CAP_HEIGHT_FACTOR;
        const capWidthLocal = climber.headRadius * CLIMBER_CAP_WIDTH_FACTOR;
        const headAbsoluteTopY = -climber.bodyHeight / 2 - climber.headRadius;

        const capVisualTopY = headAbsoluteTopY + climber.headRadius * CLIMBER_CAP_TOP_Y_OFFSET_FACTOR;
        const capBaseYLocal = capVisualTopY + capHeightLocal;

        ctx.fillStyle = CLIMBER_CAP_COLOR;
        ctx.beginPath();
        ctx.moveTo(-capWidthLocal / 2, capBaseYLocal); 
        const controlY = 2 * capVisualTopY - capBaseYLocal;
        ctx.quadraticCurveTo(0, controlY, capWidthLocal / 2, capBaseYLocal);
        ctx.closePath(); 
        ctx.fill();

        // Draw facial features based on state and animation progress
        this.drawFacialFeatures(ctx, climber); 

        // Draw rope climbing hands if animation is active
        if (this.getRopeClimbingHandsPositions()) { 
            this.drawRopeClimbingHands(ctx, climber); 
        }
    }

    drawRopeClimbingHands(ctx, climber) { 
        const hands = this.getRopeClimbingHandsPositions();
        if (!hands) {
            return; 
        }

        ctx.fillStyle = CLIMBER_HAND_COLOR; 
        const handRadius = climber.headRadius * CLIMBER_HAND_HEAD_RADIUS_RATIO;

        // Left Hand
        ctx.beginPath();
        ctx.arc(hands.left.x, hands.left.y, handRadius, 0, Math.PI * 2);
        ctx.fill();

        // Right Hand
        ctx.beginPath();
        ctx.arc(hands.right.x, hands.right.y, handRadius, 0, Math.PI * 2);
        ctx.fill();
    }

    drawFacialFeatures(ctx, climber) { 
        ctx.save();
        const headTopY = -climber.bodyHeight / 2 - climber.headRadius;

        const { scaleX, offsetX, featureAlpha } = this.getFacialAnimationParams();

        if (featureAlpha <= 0) {
            ctx.restore();
            return; 
        }

        ctx.globalAlpha = featureAlpha;

        // --- Circular Goggles ---
        const lensRadius = climber.headRadius * CLIMBER_GOGGLE_LENS_RADIUS_FACTOR * Math.abs(scaleX); 
        const goggleCenterY = headTopY + climber.headRadius * CLIMBER_GOGGLE_CENTER_Y_OFFSET_FACTOR; 
        const lensSeparation = climber.headRadius * CLIMBER_GOGGLE_SEPARATION_FACTOR * scaleX; 
        let frameThickness = climber.headRadius * CLIMBER_GOGGLE_FRAME_THICKNESS_FACTOR * Math.abs(scaleX);
        frameThickness = Math.max(0.5, frameThickness); 

        if (lensRadius > 0.5) { 
            ctx.lineWidth = frameThickness;
            ctx.fillStyle = CLIMBER_GOGGLE_LENS_COLOR;
            ctx.strokeStyle = CLIMBER_GOGGLE_FRAME_COLOR;

            ctx.beginPath();
            ctx.arc(offsetX - lensSeparation, goggleCenterY, lensRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(offsetX + lensSeparation, goggleCenterY, lensRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            let strapThickness = CLIMBER_GOGGLE_STRAP_THICKNESS * Math.abs(scaleX);
            strapThickness = Math.max(0.5, strapThickness); 
            ctx.lineWidth = strapThickness; 
            ctx.beginPath();
            const strapY = goggleCenterY; 
            const leftLensOuterEdgeX = offsetX - lensSeparation - lensRadius;
            const rightLensOuterEdgeX = offsetX + lensSeparation + lensRadius;
            
            ctx.moveTo(leftLensOuterEdgeX, strapY);
            ctx.lineTo(offsetX - (climber.headRadius * 0.9) * Math.abs(scaleX), strapY); 
            
            ctx.moveTo(rightLensOuterEdgeX, strapY);
            ctx.lineTo(offsetX + (climber.headRadius * 0.9) * Math.abs(scaleX), strapY); 
            ctx.stroke();
        }

        // --- Beard ---
        const beardWidth = climber.headRadius * CLIMBER_BEARD_WIDTH_HEAD_RADIUS_RATIO * Math.abs(scaleX);
        const beardBaseY = headTopY + climber.headRadius * CLIMBER_BEARD_BASE_Y_HEAD_CENTER_OFFSET_FACTOR;
        const beardLength = climber.headRadius * CLIMBER_BEARD_LENGTH_FACTOR;
        const beardTipY = beardBaseY + beardLength;

        if (beardWidth > 0.5 && beardLength > 0.5) {
            ctx.fillStyle = CLIMBER_BEARD_COLOR;
            ctx.beginPath();
            ctx.moveTo(offsetX - beardWidth / 2, beardBaseY);
            ctx.lineTo(offsetX + beardWidth / 2, beardBaseY);
            ctx.lineTo(offsetX, beardTipY);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }

    // --- Getter Methods for Drawing Logic (already existing, just for context) ---
    getFacialAnimationParams() {
        let scaleX = 1;
        let offsetX = 0;
        let featureAlpha = 1;

        if (this.isPerformingIdleLook) {
            const progress = this.turnAnimationProgress;
            const minScale = MIN_IDLE_FEATURE_SCALE;

            switch (this.idleLookPhase) {
                case CLIMBER_IDLE_LOOK_PHASE_TURNING_LEFT:
                    scaleX = 1 - (1 - minScale) * progress;
                    offsetX = -this.headRadius * CLIMBER_FEATURE_OFFSET_HEAD_RADIUS_RATIO * progress;
                    break;
                case CLIMBER_IDLE_LOOK_PHASE_LOOKING_LEFT:
                    scaleX = minScale;
                    offsetX = -this.headRadius * CLIMBER_FEATURE_OFFSET_HEAD_RADIUS_RATIO;
                    break;
                case CLIMBER_IDLE_LOOK_PHASE_RETURNING_FROM_LEFT:
                    scaleX = minScale + (1 - minScale) * progress;
                    offsetX = -this.headRadius * CLIMBER_FEATURE_OFFSET_HEAD_RADIUS_RATIO * (1 - progress);
                    break;
                case CLIMBER_IDLE_LOOK_PHASE_TURNING_RIGHT:
                    scaleX = 1 - (1 - minScale) * progress;
                    offsetX = this.headRadius * CLIMBER_FEATURE_OFFSET_HEAD_RADIUS_RATIO * progress;
                    break;
                case CLIMBER_IDLE_LOOK_PHASE_LOOKING_RIGHT:
                    scaleX = minScale;
                    offsetX = this.headRadius * CLIMBER_FEATURE_OFFSET_HEAD_RADIUS_RATIO;
                    break;
                case CLIMBER_IDLE_LOOK_PHASE_RETURNING_FROM_RIGHT:
                    scaleX = minScale + (1 - minScale) * progress;
                    offsetX = this.headRadius * CLIMBER_FEATURE_OFFSET_HEAD_RADIUS_RATIO * (1 - progress);
                    break;
                default:
                    scaleX = 1;
                    offsetX = 0;
                    break;
            }
        } else {
            // Original head turn animation (when moving to a grip)
            if (this.facialFeaturesState === CLIMBER_FACE_STATE_TURNING) {
                scaleX = 1 - this.turnAnimationProgress; // Features scale down as head turns
                offsetX = -this.headRadius * CLIMBER_FEATURE_OFFSET_HEAD_RADIUS_RATIO * this.turnAnimationProgress; // Features move opposite to head turn
                featureAlpha = 1 - this.turnAnimationProgress;
            } else if (this.facialFeaturesState === CLIMBER_FACE_STATE_TURNED) {
                featureAlpha = 0; // Features are not visible when fully turned
            }
        }
        return { scaleX, offsetX, featureAlpha };
    }

    getRopeClimbingHandsPositions() {
        if (!this.ropeClimbingAnimationActive) {
            return null;
        }
        return this.ropeClimbingHands;
    }
}
