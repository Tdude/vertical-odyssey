/**
 * @file audio.js
 * @description Manages all audio functionalities for the Vertical Odyssey game,
 * including initializing the Web Audio API context and playing various sound effects.
 */

import {
    SOUND_GRAB, SOUND_PLACE_PROTECTION, SOUND_CANNOT_PLACE_PROTECTION, SOUND_NO_PROTECTION_LEFT,
    SOUND_GRIP_FAIL, SOUND_BELAY_CLICK, SOUND_DEGRADE_TICK,
    SOUND_FALL_CAUGHT, SOUND_FALL_SHORT, SOUND_FALL_MEDIUM, SOUND_FALL_LONG, SOUND_FALL_TERMINAL,
    SOUND_ROPE_SLACK_OUT, SOUND_ROPE_SLACK_IN
} from './constants.js';

let audioCtx;

/**
 * Initializes the Web Audio API context.
 * This function should be called once, preferably after a user interaction.
 */
export function initAudio() {
    if (audioCtx) return;
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.warn("Web Audio API is not supported. Sound effects disabled.");
        audioCtx = null;
    }
}

/**
 * Plays a sound effect based on the provided type.
 * @param {string} type - The type of sound to play (e.g., 'grab', 'fall').
 */
export function playSound(type) {
    if (!audioCtx) return;
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    let duration = 0.15;

    switch (type) {
        case SOUND_GRAB:
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(540, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            duration = 0.1;
            break;
        case SOUND_PLACE_PROTECTION:
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
            duration = 0.1;
            break;
        case SOUND_FALL_SHORT: // New case, distinct from medium/long
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(300, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.25);
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            duration = 0.25;
            break;
        case SOUND_FALL_MEDIUM: // Mapped from old 'fall'
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(200, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.5);
            gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
            duration = 0.5;
            break;
        case SOUND_FALL_LONG: // New case, distinct sound for long falls
            oscillator.type = 'noise'; // Using noise for a more impactful 'ughh' sound
            // For noise, frequency isn't directly set. We'll use a bandpass filter to shape it.
            const fallLongFilter = audioCtx.createBiquadFilter();
            fallLongFilter.type = 'bandpass';
            fallLongFilter.frequency.setValueAtTime(400, audioCtx.currentTime); // Center frequency
            fallLongFilter.Q.setValueAtTime(1, audioCtx.currentTime);
            oscillator.connect(fallLongFilter);
            fallLongFilter.connect(gainNode);
            gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.05, audioCtx.currentTime + 0.7);
            duration = 0.7;
            break;
        case SOUND_FALL_TERMINAL:
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.8);
            gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
            duration = 0.8;
            break;
        case SOUND_DEGRADE_TICK:
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(50, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.02, audioCtx.currentTime);
            duration = 0.08;
            break;
        case SOUND_GRIP_FAIL:
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
        case SOUND_FALL_CAUGHT:
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(300, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.5);
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            duration = 0.5;
            break;
        case SOUND_BELAY_CLICK:
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(700, audioCtx.currentTime);
            oscillator.frequency.setValueAtTime(880, audioCtx.currentTime + 0.03);
            gainNode.gain.setValueAtTime(0.06, audioCtx.currentTime);
            duration = 0.06;
            break;
        case SOUND_CANNOT_PLACE_PROTECTION: // New case
            oscillator.type = 'square'; 
            oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
            duration = 0.1;
            break;
        case SOUND_NO_PROTECTION_LEFT: // New case
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(220, audioCtx.currentTime);
            oscillator.frequency.setValueAtTime(180, audioCtx.currentTime + 0.05);
            gainNode.gain.setValueAtTime(0.07, audioCtx.currentTime);
            duration = 0.15;
            break;
        case SOUND_ROPE_SLACK_OUT: // New case
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(100, audioCtx.currentTime); 
            oscillator.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.3);
            gainNode.gain.setValueAtTime(0.04, audioCtx.currentTime);
            duration = 0.3;
            break;
        case SOUND_ROPE_SLACK_IN: // New case
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(120, audioCtx.currentTime); 
            oscillator.frequency.exponentialRampToValueAtTime(70, audioCtx.currentTime + 0.2);
            gainNode.gain.setValueAtTime(0.03, audioCtx.currentTime);
            duration = 0.2;
            break;
        default: 
            console.warn(`Unknown sound type: ${type}`);
            return;
    }
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + duration);
}
