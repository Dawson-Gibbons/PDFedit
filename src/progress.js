// progress.js — Progress tracking (most logic is in upload.js; this handles the continue button)

let _state, _helpers;

export function initProgress(state, helpers) {
  _state = state;
  _helpers = helpers;
}
