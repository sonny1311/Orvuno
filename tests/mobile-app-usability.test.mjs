import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('js/core/MobileAppUsabilityIntegration.js','utf8');

assert.match(source,/root\.dataset\.orvunoUxStore=store/,'mobile UX must mark the active store');
assert.match(source,/\['amazon','google','web'\]/,'mobile UX must support Amazon, Google and web');
assert.match(source,/--orvuno-touch:46px/,'mobile touch targets must be large enough');
assert.match(source,/min-height:44px/,'interactive controls must keep a practical minimum touch height');
assert.match(source,/z-index:4000/,'bottom navigation must stay below dialogs');
assert.match(source,/z-index:120000/,'dialogs must stay above the navigation');
assert.match(source,/html\.orvuno-modal-open #world-main-nav/,'navigation must hide while a modal is open');
assert.match(source,/overscroll-behavior:none/,'modal background scrolling must be locked');
assert.match(source,/orientation:landscape/,'landscape mode must be handled');
assert.match(source,/max-height:560px/,'short app viewports must be handled');
assert.match(source,/prefers-reduced-motion:reduce/,'reduced-motion accessibility must be respected');
assert.match(source,/safe-area-inset-bottom/,'app safe areas must be respected');
assert.match(source,/visualViewport/,'virtual-keyboard/viewport changes must be observed');

console.log('PASS: Amazon, Google and web mobile usability gates');
