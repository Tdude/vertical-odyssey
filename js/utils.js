// Utility functions for the Vertical Odyssey game

/**
 * Returns a random floating-point number between min (inclusive) and max (exclusive).
 * @param {number} min - The minimum value.
 * @param {number} max - The maximum value.
 * @returns {number} A random float between min and max.
 */
export function getRandomFloat(min, max) {
    return Math.random() * (max - min) + min;
}

/**
 * Returns a random integer between min (inclusive) and max (inclusive).
 * @param {number} min - The minimum value.
 * @param {number} max - The maximum value.
 * @returns {number} A random integer between min and max.
 */
export function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Returns true if Math.random() is less than the given probability.
 * @param {number} probability - The probability threshold (0.0 to 1.0).
 * @returns {boolean} True if the random check passes, false otherwise.
 */
export function getRandomChance(probability) {
    return Math.random() < probability;
}

/**
 * Returns a random angle in radians (0 to 2*PI).
 * @returns {number} A random angle in radians.
 */
export function getRandomAngle() {
    return Math.random() * Math.PI * 2;
}

/**
 * Returns a random element from the given array.
 * @param {Array<any>} arr - The array to pick an element from.
 * @returns {any | undefined} A random element from the array, or undefined if the array is empty or null.
 */
export function getRandomElement(arr) {
    if (!arr || arr.length === 0) {
        return undefined;
    }
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Linearly interpolates between two RGB colors.
 * @param {string} color1 - The starting color string in 'rgb(r, g, b)' format.
 * @param {string} color2 - The ending color string in 'rgb(r, g, b)' format.
 * @param {number} factor - The interpolation factor (0 to 1). 0 returns color1, 1 returns color2.
 * @returns {string} The interpolated color string in 'rgb(r, g, b)' format.
 */
export function lerpColor(color1, color2, factor) {
    const c1 = color1.match(/\d+/g).map(Number);
    const c2 = color2.match(/\d+/g).map(Number);

    const r = Math.round(c1[0] + (c2[0] - c1[0]) * factor);
    const g = Math.round(c1[1] + (c2[1] - c1[1]) * factor);
    const b = Math.round(c1[2] + (c2[2] - c1[2]) * factor);

    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Converts a HEX color string to an RGB object or string.
 * @param {string} hex - The hex color string (e.g., "#FF0000" or "FF0000").
 * @param {boolean} asString - If true, returns 'rgb(r,g,b)' string. Otherwise, returns {r, g, b} object.
 * @returns {string | {r: number, g: number, b: number} | null} RGB representation or null if invalid hex.
 */
export function hexToRgb(hex, asString = false) {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);

    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) {
        return null;
    }

    const rgb = {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    };

    return asString ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : rgb;
}