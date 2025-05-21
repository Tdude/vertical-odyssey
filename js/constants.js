/**
 * @file constants.js
 * @description This file contains all the global constants used throughout the Vertical Odyssey game.
 * These constants define various game parameters, such as canvas dimensions, climber properties,
 * grip characteristics, pump rules, physics values, and UI settings.
 */

export const GAME_VERSION = "1.1.0"; // Added game version

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 1200;

// Dynamic canvas dimensions, updated at runtime
export let dynamicCanvasWidth = CANVAS_WIDTH;
export let dynamicCanvasHeight = CANVAS_HEIGHT;

export function updateDynamicCanvasDimensions(width, height) {
    dynamicCanvasWidth = width;
    dynamicCanvasHeight = height;
}

export const CLIMBER_BODY_WIDTH = 12;
export const CLIMBER_BODY_HEIGHT = 18;
export const CLIMBER_HEAD_RADIUS = 10;
export const CLIMBER_COLOR = '#3345cc';
export const CLIMBER_HEAD_COLOR = '#ffc0cb';
export const CLIMBER_BEARD_COLOR = '#dd551e'; // A brownish-red, like sienna or reddish-brown
export const CLIMBER_GOGGLE_FRAME_COLOR = '#222222'; // Dark grey for goggle frame
export const CLIMBER_GOGGLE_LENS_COLOR = 'rgba(244, 149, 6, 0.8)'; // semi-transparent for lenses

// New circular goggle style constants
export const CLIMBER_GOGGLE_LENS_RADIUS_FACTOR = 0.35;  // Factor of headRadius
export const CLIMBER_GOGGLE_CENTER_Y_OFFSET_FACTOR = 0.4; // Factor of headRadius, offset downwards from headTopY to lens center
export const CLIMBER_GOGGLE_SEPARATION_FACTOR = 0.45;   // Factor of headRadius, for horizontal separation of lenses from center
export const CLIMBER_GOGGLE_FRAME_THICKNESS_FACTOR = 0.1; // Factor of headRadius for frame thickness, or a fixed pixel value
export const CLIMBER_GOGGLE_STRAP_THICKNESS = 1.5;     // Pixels for strap thickness

export const CLIMBER_REACH = 75;

// Pump (formerly Stamina) - Inverted: 0 is good (not pumped), MAX_PUMP is bad (fall)
export const MAX_PUMP = 100; // Climber falls if pump reaches this
export const PUMP_STARTING_LEVEL = 0; // Climber starts with no pump
export const PUMP_DECREASE_PER_SECOND = 5; // Pump reduction per second when resting
export const PUMP_DECREASE_CRACK_BONUS = 2.5; // Additional pump reduction on cracks
export const PUMP_INCREASE_MOVE = 15; // Pump gained when making a move
export const PUMP_GRIP_SIZE_PENALTY_FACTOR = 1.0; // Multiplier for how much SMALLER grips increase pump hanging cost. 1.0 means smallest grip effectively doubles base hanging cost.
export const PUMP_INCREASE_PER_SECOND_MOVING = 7; // Pump gained per second during active movement
export const PUMP_INCREASE_FALL_CAUGHT = 40; // Pump gained when a fall is caught by protection
export const PUMP_LOW_THRESHOLD = 25; // Pump level considered low (good condition)
export const INITIAL_PROTECTION_COUNT = 3;
export const MAX_CATCHABLE_FALL_DISTANCE = 360;

export const PUMP_INCREASE_PER_SECOND_HANGING = 0.5; // Pump gained per second while hanging statically on a grip

export const GRIP_TYPE_NORMAL = 'normal';
export const GRIP_TYPE_CRACK = 'crack';

// Grip Size Ranges (Original, now primarily for Cracks)
export const GRIP_SIZE_MIN = 8;
export const GRIP_SIZE_MAX = 18;

// Grip Size Ranges (Specific Types)
export const GRIP_SIZE_NORMAL_MIN = 10;
export const GRIP_SIZE_NORMAL_MAX = 18; // Reduced from 64

// Average size for 'normal' grips, used in generation logic elsewhere
export const GRIP_AVG_SIZE = (GRIP_SIZE_NORMAL_MIN + GRIP_SIZE_NORMAL_MAX) / 2;

// Chance for a 'normal' grip to visually be a crack
export const NORMAL_GRIP_CRACK_CHANCE = 0.20; // 20% chance

export const GRIP_WIDTH = GRIP_SIZE_NORMAL_MAX; // Define GRIP_WIDTH for generation logic
// export const MIN_STARTING_GRIP_DISTANCE_FROM_CLIMBER = 30; // Min distance for the very first grips from climber's start - REPLACED

// New simplified constants for initial reachable grips:
// Y positions are calculated as climberStartY - (factor * CLIMBER_REACH)
export const INITIAL_REACHABLE_GRIP_Y_FACTORS = [0.45, 0.65, 0.85]; 

export const MIN_GRIP_SEPARATION_MULTIPLIER = 4; // Used to calculate MIN_GRIP_SEPARATION
export const MIN_GRIP_SEPARATION = GRIP_SIZE_NORMAL_MAX * MIN_GRIP_SEPARATION_MULTIPLIER;
export const NUM_INITIAL_REACHABLE_GRIPS = 3; // Target number of initial grips within reach
export const NUM_INITIAL_REFERENCE_GRIPS = 6; // Target number of initial grips for reference (visible but outside reach)
export const GRIP_AVG_VERTICAL_SEPARATION_INITIAL_FILLER = 50; // Average vertical spacing for the column of filler grips at start.
export const GRIP_SELECTION_RADIUS = 128; // Radius around climber's hand for selecting grips
export const GRIP_PROXIMITY_REVEAL_DISTANCE = 175; // Grips within this distance of climber become visible
export const GRIP_REVEAL_DURATION = 500; // ms for shimmer/reveal animation

// Grip Active State & Degradation
export const GRIP_ACTIVE_DURATION = 10000;      // ms, how long a grip stays usable before failing
export const GRIP_COLOR_HIDDEN = 'rgba(100, 100, 100, 0.1)';
export const GRIP_COLOR_VISIBLE = 'rgb(174, 173, 170)';
export const GRIP_COLOR_ACTIVE = 'rgb(192, 184, 124)';
export const GRIP_COLOR_DEGRADING = 'rgb(113, 62, 62)'; // This will be the END color of degradation if we lerp
export const GRIP_COLOR_DEGRADING_START = 'rgb(210, 200, 140)'; // Start color for degrading grips (brighter yellowish grey)
export const GRIP_COLOR_FAILED = '#404040';
export const GRIP_REVIVAL_DURATION = 3000;
export const GRIP_BLINK_INTERVAL = 250;
export const GRIP_DEGRADE_TRANSITION_DURATION = 4000; // Duration for the degrading color fade in ms
export const GRIP_COLOR_REVIVABLE_PRIMARY = GRIP_COLOR_ACTIVE;
export const GRIP_COLOR_REVIVABLE_SECONDARY = GRIP_COLOR_VISIBLE;

// Grip Generation Limits
export const MAX_GRIPS = 200; // Absolute maximum grips in the game
export const MAX_GRIPS_ON_SCREEN = 50; // Max grips to attempt to keep rendered/active
export const MIN_Y_FOR_GRIP_GENERATION = -20000; // Stop generating grips below this Y coord
export const DYNAMIC_GRIP_GENERATION_BATCH_SIZE = 3; // Number of grips to attempt to generate in one dynamic call

export const PROTECTION_SIZE = 8;
export const PROTECTION_COLOR = '#00FFFF';
export const PROTECTION_LAND_WINDOW_Y = PROTECTION_SIZE * 2;
export const PROTECTION_LAND_WINDOW_X = PROTECTION_SIZE * 3;

export const GRAVITY = 0.8;
export const TERMINAL_GRAVITY_MULTIPLIER = 1.8;
export const FALL_SPEED_MAX = 900;
export const TERMINAL_FALL_RESET_DELAY = 2500;
export const MAX_FALL_DURATION_NO_CATCH = 7000;
export const MIN_FALL_DISTANCE_FOR_SOUND = 5; // pixels, min fall distance to trigger a sound
export const MAX_FALL_DISTANCE_FOR_SOUND = CANVAS_HEIGHT * 0.20; // 20% of canvas height, for scaling fall sounds
export const ROPE_SLACK_FACTOR = 1.2; // Factor for rope slack/stretch in fall calculations

export const WALL_COLOR_MIN_SHADE = 70;
export const WALL_COLOR_MAX_SHADE = 100;
export const WALL_CHUNK_SIZE = 40;

export const ROPE_COLOR = '#559940';
export const ROPE_THICKNESS = 2;
export const ROUTE_START_COORDS = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 30 };

export const ENDLESS_SCROLL_TRIGGER_Y = -CANVAS_HEIGHT * 2.5;
export const ENDLESS_SCROLL_SPEED = 60;
export const CLIMBER_HOVER_TARGET_Y_ON_SCREEN = CANVAS_HEIGHT * 0.4;

// Camera specific constants
export const CAMERA_CLIMBER_Y_SCREEN_THRESHOLD_FACTOR = 0.4; // When climber's screen Y pos is less than this factor of canvas height, camera moves up.

export const HIGH_SCORE_KEY = 'verticalOdysseyHighScore';

// Climber Animation and State Constants
export const TURN_ANIMATION_DURATION = 300; // milliseconds
export const IDLE_TIMEOUT_DURATION = 5000; // 5 seconds to trigger idle look
export const IDLE_LOOK_PAUSE_DURATION = 1000; // 1 second pause when looking left/right
export const MIN_IDLE_FEATURE_SCALE = 0.2; // Min scale for features when looking aside during idle
export const RECOVERY_DURATION = 2000; // Duration for recovery in ms

export const CLIMBER_WAIST_BODY_HEIGHT_RATIO = 0.4;
export const CLIMBER_HAND_COLOR = 'rgba(50, 50, 50, 0.8)';
export const CLIMBER_HAND_HEAD_RADIUS_RATIO = 0.3;
export const CLIMBER_FEATURE_COLOR = 'rgba(0, 0, 0, 0.7)';
export const CLIMBER_FEATURE_OFFSET_HEAD_RADIUS_RATIO = 0.5;
export const CLIMBER_BEARD_WIDTH_HEAD_RADIUS_RATIO = 0.8; // Width of the beard base as a factor of head radius
export const CLIMBER_BEARD_BASE_Y_HEAD_CENTER_OFFSET_FACTOR = -0.2; // Offset from head center Y to the top edge of the beard (0.5 means it starts at lower 1/4 of head)
export const CLIMBER_BEARD_LENGTH_FACTOR = 1.1; // Length (height) of the beard as a factor of head radius

// Cap Constants
export const CLIMBER_CAP_COLOR = CLIMBER_BEARD_COLOR; // Use beard color for the cap
export const CLIMBER_CAP_HEIGHT_FACTOR = 1;      // Height of the cap relative to head radius
export const CLIMBER_CAP_WIDTH_FACTOR = 2.2;       // Width of the cap's base relative to head radius
export const CLIMBER_CAP_TOP_Y_OFFSET_FACTOR = -1.2; // How much the top-center of the cap dips from the head's absolute top

export const CLIMBER_FACE_STATE_FORWARD = 'facingForward';
export const CLIMBER_FACE_STATE_TURNING = 'turningHead';
export const CLIMBER_FACE_STATE_TURNED = 'headTurned';

export const CLIMBER_IDLE_LOOK_PHASE_NONE = 'none';
export const CLIMBER_IDLE_LOOK_PHASE_TURNING_LEFT = 'turningLeft';
export const CLIMBER_IDLE_LOOK_PHASE_LOOKING_LEFT = 'lookingLeft';
export const CLIMBER_IDLE_LOOK_PHASE_RETURNING_FROM_LEFT = 'returningFromLeft';
export const CLIMBER_IDLE_LOOK_PHASE_TURNING_RIGHT = 'turningRight';
export const CLIMBER_IDLE_LOOK_PHASE_LOOKING_RIGHT = 'lookingRight';
export const CLIMBER_IDLE_LOOK_PHASE_RETURNING_FROM_RIGHT = 'returningFromRight';

// Input constants
export const MOVE_DEBOUNCE_INTERVAL = 200; // ms, for climber movement

// Grip waviness/facets
export const GRIP_ROUND_WAVINESS_SEGMENTS = 8; // Number of segments for the wavy effect
export const GRIP_ROUND_WAVINESS_AMPLITUDE = 0.8; // Max radius variation factor (e.g., 0.15 for 15%)

// Rope Node Types
export const ROPE_NODE_TYPE_START = 'start';
export const ROPE_NODE_TYPE_ANCHOR = 'anchor';
export const ROPE_NODE_TYPE_CLIMBER = 'climber';
export const ROPE_NODE_TYPE_PROTECTION = 'protection';

// Sound Event Names
// Grouped for clarity and consistency.

// General Climber Actions & Feedback
export const SOUND_GRAB = 'grab';                           // For climber grabbing a grip
export const SOUND_PLACE_PROTECTION = 'placeProtection';      // For climber successfully placing protection
export const SOUND_CANNOT_PLACE_PROTECTION = 'cannotPlaceProtectionSound';
export const SOUND_NO_PROTECTION_LEFT = 'noProtectionLeftSound';
export const SOUND_GRIP_FAIL = 'gripFail';                  // When a grip fails/breaks or climber slips
export const SOUND_BELAY_CLICK = 'belayClick';              // Sound for belaying action (e.g., taking in rope)
export const SOUND_DEGRADE_TICK = 'degradeTick';            // Subtle tick for degradation effects (e.g. stamina, grip integrity)

// Fall Related Sounds
export const SOUND_FALL_CAUGHT = 'fallCaughtSound';         // When a fall is caught by protection
export const SOUND_FALL_SHORT = 'fallShortSound';
export const SOUND_FALL_MEDIUM = 'fallMediumSound';
export const SOUND_FALL_LONG = 'fallLongSound';             // UGHH-sound for a long fall
export const SOUND_FALL_TERMINAL = 'terminalFallSound';     // Sound for a game-ending fall

// Rope Specific Sounds
export const SOUND_ROPE_SLACK_OUT = 'ropeSlackOutSound';
export const SOUND_ROPE_SLACK_IN = 'ropeSlackInSound';

// --- End of Sound Event Names ---

// Add other sound event names here as identified, e.g.:
// export const SOUND_GRIP_GRAB = 'gripGrabSound';
// export const SOUND_STAMINA_LOW = 'staminaLowSound';
// export const SOUND_GAME_START = 'start';
// export const SOUND_GAME_OVER = 'gameOver';

export const DEBUG_MODE = false; // Set to true for verbose logging and debug features, false for production
export const DEBUG_GRIPS = true;
export const DEBUG_GRIPS_DETAILED = true; // Added for more verbose grip reveal logging
export const CONSOLE_LOG_STYLE_GAME_INIT = 'color: #2ecc71; font-weight: bold;'; // Green for game init
export const CONSOLE_LOG_STYLE_GAME_RESET = 'color: #f39c12; font-weight: bold;'; // Orange for game reset

// Gameplay
export const DYNAMIC_GRIP_GENERATION_CAMERA_THRESHOLD_FACTOR = 0.75; // Determines how far above the camera view new grips start generating. Value closer to 0 means grips generate further above.
export const SUMMIT_TARGET_Y = 20; // World Y-coordinate for the summit (top of the game world)
