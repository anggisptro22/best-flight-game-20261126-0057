/**
 * input.js — Keyboard Input Handling and Action Queue
 * ES Module for Stratos Courier Flight Game
 */

export class Input {
  constructor() {
    // Continuous control states (-1 to 1 or delta)
    this.pitch = 0;          // -1 (pitch up) to 1 (pitch down)
    this.roll = 0;           // -1 (roll/turn left) to 1 (roll/turn right)
    this.throttleDelta = 0;  // -1 (throttle down), 0 (hold), 1 (throttle up)

    // Edge-triggered action queue ('view', 'restart', 'mute', etc.)
    this.actions = [];

    // Internal key state tracking
    this.keys = Object.create(null);

    // Bind event handlers
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);

    // Attach listeners
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  /**
   * Handles keydown events, prevents default scrolling on arrow keys and space,
   * updates continuous control states and queues edge-triggered actions.
   * @param {KeyboardEvent} e 
   */
  _onKeyDown(e) {
    const key = e.key;
    const code = e.code;

    // Prevent default browser scrolling on navigation / control keys
    if (
      key === 'ArrowUp' ||
      key === 'ArrowDown' ||
      key === 'ArrowLeft' ||
      key === 'ArrowRight' ||
      key === ' ' ||
      code === 'Space'
    ) {
      e.preventDefault();
    }

    // Edge-triggered actions on initial press (prevent repeat spam on hold)
    if (!this.keys[code] && !this.keys[key.toLowerCase()]) {
      const lowerKey = key.toLowerCase();
      if (lowerKey === 'v') {
        this.actions.push('view');
      } else if (lowerKey === 'r') {
        this.actions.push('restart');
      } else if (lowerKey === 'm') {
        this.actions.push('mute');
      }
    }

    this.keys[code] = true;
    this.keys[key.toLowerCase()] = true;
    this.updateControls();
  }

  /**
   * Handles keyup events, clears key states and updates control states.
   * @param {KeyboardEvent} e 
   */
  _onKeyUp(e) {
    const key = e.key;
    const code = e.code;

    if (
      key === 'ArrowUp' ||
      key === 'ArrowDown' ||
      key === 'ArrowLeft' ||
      key === 'ArrowRight' ||
      key === ' ' ||
      code === 'Space'
    ) {
      e.preventDefault();
    }

    this.keys[code] = false;
    this.keys[key.toLowerCase()] = false;
    this.updateControls();
  }

  /**
   * Recalculates continuous control values based on current key states.
   */
  updateControls() {
    // Pitch: ArrowUp (pitch up / -1), ArrowDown (pitch down / 1)
    this.pitch = 0;
    if (this.keys['ArrowUp'] || this.keys['arrowup']) {
      this.pitch = -1;
    }
    if (this.keys['ArrowDown'] || this.keys['arrowdown']) {
      this.pitch = 1;
    }

    // Roll / Turn: ArrowLeft (roll left / -1), ArrowRight (roll right / 1)
    this.roll = 0;
    if (this.keys['ArrowLeft'] || this.keys['arrowleft']) {
      this.roll = -1;
    }
    if (this.keys['ArrowRight'] || this.keys['arrowright']) {
      this.roll = 1;
    }

    // Throttle Delta: w / W (throttle up / 1), s / S (throttle down / -1)
    this.throttleDelta = 0;
    if (this.keys['KeyW'] || this.keys['w']) {
      this.throttleDelta = 1;
    }
    if (this.keys['KeyS'] || this.keys['s']) {
      this.throttleDelta = -1;
    }
  }

  /**
   * Consumes and returns the next edge-triggered action from the queue.
   * @returns {string|undefined} action name
   */
  consumeAction() {
    return this.actions.shift();
  }

  /**
   * Cleans up event listeners.
   */
  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }
}
