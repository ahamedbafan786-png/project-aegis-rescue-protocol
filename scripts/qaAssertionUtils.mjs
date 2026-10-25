/**
 * PROJECT AEGIS — QA ASSERTION UTILITIES
 * Enforces strict finite numerical assertions, geometric non-overlap verification,
 * and negative test validation fixtures.
 */

export function assertFinite(val, label) {
  if (typeof val !== 'number' || !Number.isFinite(val)) {
    throw new Error(`Numeric assertion failed: ${label} must be a finite number (received: ${String(val)})`);
  }
  return val;
}

export function assertExactInt(actual, expected, label) {
  assertFinite(actual, `${label} (actual)`);
  assertFinite(expected, `${label} (expected)`);
  if (!Number.isInteger(actual)) {
    throw new Error(`Integer assertion failed: ${label} must be an integer (received: ${actual})`);
  }
  if (!Number.isInteger(expected)) {
    throw new Error(`Integer assertion failed: ${label} expected value must be an integer (received: ${expected})`);
  }
  if (actual !== expected) {
    throw new Error(`Assertion failed for ${label}: expected exact integer ${expected}, got ${actual}`);
  }
  return actual;
}

export function assertFloatClose(actual, expected, tolerance = 0.001, label) {
  assertFinite(actual, `${label} (actual)`);
  assertFinite(expected, `${label} (expected)`);
  assertFinite(tolerance, `${label} (tolerance)`);
  const diff = Math.abs(actual - expected);
  if (diff > tolerance) {
    throw new Error(`Assertion failed for ${label}: expected ${expected} (±${tolerance}), got ${actual} (diff: ${diff.toFixed(4)})`);
  }
  return actual;
}

export function assertDimensionsPositive(rect, label) {
  assertFinite(rect?.width, `${label}.width`);
  assertFinite(rect?.height, `${label}.height`);
  if (rect.width <= 0 || rect.height <= 0) {
    throw new Error(`Dimension assertion failed for ${label}: width (${rect.width}) and height (${rect.height}) must be strictly positive (> 0)`);
  }
}

export function intersects(r1, r2) {
  return !(
    r1.right <= r2.left ||
    r1.left >= r2.right ||
    r1.bottom <= r2.top ||
    r1.top >= r2.bottom
  );
}

export function assertNonOverlap(rect1, rect2, label1, label2) {
  assertDimensionsPositive(rect1, label1);
  assertDimensionsPositive(rect2, label2);
  assertFinite(rect1.left, `${label1}.left`);
  assertFinite(rect1.right, `${label1}.right`);
  assertFinite(rect1.top, `${label1}.top`);
  assertFinite(rect1.bottom, `${label1}.bottom`);
  assertFinite(rect2.left, `${label2}.left`);
  assertFinite(rect2.right, `${label2}.right`);
  assertFinite(rect2.top, `${label2}.top`);
  assertFinite(rect2.bottom, `${label2}.bottom`);

  if (intersects(rect1, rect2)) {
    throw new Error(`Overlap assertion failed: ${label1} [L:${rect1.left}, R:${rect1.right}, T:${rect1.top}, B:${rect1.bottom}] intersects ${label2} [L:${rect2.left}, R:${rect2.right}, T:${rect2.top}, B:${rect2.bottom}]`);
  }
}

export function assertInViewportBounds(rect, vpWidth, vpHeight, label) {
  assertDimensionsPositive(rect, label);
  assertFinite(vpWidth, 'vpWidth');
  assertFinite(vpHeight, 'vpHeight');
  assertFinite(rect.left, `${label}.left`);
  assertFinite(rect.right, `${label}.right`);
  assertFinite(rect.top, `${label}.top`);
  assertFinite(rect.bottom, `${label}.bottom`);

  const clipped = rect.left < 0 || rect.top < 0 || rect.right > vpWidth || rect.bottom > vpHeight;
  if (clipped) {
    throw new Error(`Viewport clipping assertion failed for ${label}: [L:${rect.left}, T:${rect.top}, R:${rect.right}, B:${rect.bottom}] clipped outside viewport (${vpWidth}x${vpHeight})`);
  }
}

/**
 * Executes a comprehensive suite of negative tests against the assertion functions themselves.
 * Proves that invalid fixtures (NaN, Infinity, strings, overlapping rects, clipped rects,
 * zero/negative dimensions, mismatched metrics) are genuinely detected and rejected.
 */
export function runNegativeAssertionSelfTests() {
  const tests = [
    {
      name: 'assertFinite rejects NaN',
      fn: () => assertFinite(NaN, 'test'),
      expectedPattern: /must be a finite number/,
    },
    {
      name: 'assertFinite rejects Infinity',
      fn: () => assertFinite(Infinity, 'test'),
      expectedPattern: /must be a finite number/,
    },
    {
      name: 'assertFinite rejects -Infinity',
      fn: () => assertFinite(-Infinity, 'test'),
      expectedPattern: /must be a finite number/,
    },
    {
      name: 'assertFinite rejects strings ("20")',
      fn: () => assertFinite("20", 'test'),
      expectedPattern: /must be a finite number/,
    },
    {
      name: 'assertFinite rejects null',
      fn: () => assertFinite(null, 'test'),
      expectedPattern: /must be a finite number/,
    },
    {
      name: 'assertFinite rejects undefined',
      fn: () => assertFinite(undefined, 'test'),
      expectedPattern: /must be a finite number/,
    },
    {
      name: 'assertExactInt rejects non-integer floats (20.5 vs 20)',
      fn: () => assertExactInt(20.5, 20, 'test'),
      expectedPattern: /must be an integer/,
    },
    {
      name: 'assertExactInt rejects mismatched integer (19 vs 20)',
      fn: () => assertExactInt(19, 20, 'test'),
      expectedPattern: /expected exact integer 20, got 19/,
    },
    {
      name: 'assertExactInt rejects NaN actual',
      fn: () => assertExactInt(NaN, 20, 'test'),
      expectedPattern: /must be a finite number/,
    },
    {
      name: 'assertFloatClose rejects out-of-tolerance float (22.5 vs 20.0)',
      fn: () => assertFloatClose(22.5, 20.0, 0.01, 'test'),
      expectedPattern: /expected 20/,
    },
    {
      name: 'assertFloatClose rejects NaN actual',
      fn: () => assertFloatClose(NaN, 20.0, 0.01, 'test'),
      expectedPattern: /must be a finite number/,
    },
    {
      name: 'assertDimensionsPositive rejects zero width',
      fn: () => assertDimensionsPositive({ width: 0, height: 30 }, 'test'),
      expectedPattern: /strictly positive/,
    },
    {
      name: 'assertDimensionsPositive rejects negative height',
      fn: () => assertDimensionsPositive({ width: 40, height: -5 }, 'test'),
      expectedPattern: /strictly positive/,
    },
    {
      name: 'assertNonOverlap detects overlapping bounding boxes',
      fn: () => assertNonOverlap(
        { left: 100, right: 200, top: 10, bottom: 40, width: 100, height: 30 },
        { left: 180, right: 250, top: 10, bottom: 40, width: 70, height: 30 },
        'RectA',
        'RectB'
      ),
      expectedPattern: /Overlap assertion failed/,
    },
    {
      name: 'assertInViewportBounds detects left viewport clip (< 0)',
      fn: () => assertInViewportBounds(
        { left: -10, right: 50, top: 10, bottom: 40, width: 60, height: 30 },
        390,
        844,
        'ClippedBadge'
      ),
      expectedPattern: /Viewport clipping assertion failed/,
    },
    {
      name: 'assertInViewportBounds detects right viewport clip (> vpWidth)',
      fn: () => assertInViewportBounds(
        { left: 350, right: 410, top: 10, bottom: 40, width: 60, height: 30 },
        390,
        844,
        'ClippedBadge'
      ),
      expectedPattern: /Viewport clipping assertion failed/,
    },
  ];

  let verifiedCount = 0;
  for (const t of tests) {
    let threw = false;
    let actualError = null;
    try {
      t.fn();
    } catch (err) {
      threw = true;
      actualError = err.message;
      if (!t.expectedPattern.test(actualError)) {
        throw new Error(`Negative test '${t.name}' threw unexpected message: "${actualError}"`);
      }
    }
    if (!threw) {
      throw new Error(`Negative test verification failed: '${t.name}' unexpectedly passed without throwing!`);
    }
    verifiedCount++;
  }
  return verifiedCount;
}
