import * as THREE from 'three';

/**
 * OrbitalMechanics computes Keplerian orbital elements for planet positions.
 * Uses simplified Keplerian elements with Newton-Raphson iteration for
 * solving Kepler's equation.
 */
export class OrbitalMechanics {
  /**
   * Calculate the orbital position of a planet at a given simulation time.
   * @param {Object} planetData - Planet data containing orbital parameters.
   * @param {number} planetData.distanceDisplay - Semi-major axis in display units.
   * @param {number} planetData.orbitalPeriod - Orbital period in days.
   * @param {number} planetData.eccentricity - Orbital eccentricity (0 = circular).
   * @param {number} planetData.inclination - Orbital inclination in degrees.
   * @param {number} timeDays - Current simulation time in days.
   * @returns {{ x: number, y: number, z: number }} Position in display coordinates.
   */
  static calculatePosition(planetData, timeDays) {
    const { distanceDisplay: a, orbitalPeriod, eccentricity: e, inclination } = planetData;

    if (!orbitalPeriod || !a) {
      return { x: 0, y: 0, z: 0 };
    }

    // Mean anomaly: M = (2 * PI / T) * t
    const M = ((2 * Math.PI) / orbitalPeriod) * timeDays;

    // Solve Kepler's equation: M = E - e * sin(E)
    // Using Newton-Raphson iteration
    const E = OrbitalMechanics._solveKepler(M, e);

    // True anomaly from eccentric anomaly
    const sinV = (Math.sqrt(1 - e * e) * Math.sin(E)) / (1 - e * Math.cos(E));
    const cosV = (Math.cos(E) - e) / (1 - e * Math.cos(E));
    const v = Math.atan2(sinV, cosV);

    // Distance from focus: r = a * (1 - e * cos(E))
    const r = a * (1 - e * Math.cos(E));

    // Position in orbital plane
    const x = r * Math.cos(v);
    const z = r * Math.sin(v);

    // Apply inclination rotation around x-axis
    const incRad = THREE.MathUtils.degToRad(inclination || 0);
    const y = z * Math.sin(incRad);
    const zFinal = z * Math.cos(incRad);

    return { x, y, z: zFinal };
  }

  /**
   * Solve Kepler's equation M = E - e * sin(E) using Newton-Raphson method.
   * @param {number} M - Mean anomaly in radians.
   * @param {number} e - Eccentricity.
   * @param {number} [maxIterations=10] - Maximum iterations for convergence.
   * @returns {number} Eccentric anomaly E in radians.
   */
  static _solveKepler(M, e, maxIterations = 10) {
    // Initial guess
    let E = M;

    for (let i = 0; i < maxIterations; i++) {
      const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
      E -= dE;

      // Converged when correction is negligible
      if (Math.abs(dE) < 1e-8) {
        break;
      }
    }

    return E;
  }

  /**
   * Generate an array of points along an elliptical orbit path.
   * Used for rendering orbit lines.
   * @param {Object} planetData - Planet data containing orbital parameters.
   * @param {number} [segments=128] - Number of segments for the orbit path.
   * @returns {Float32Array} Flat array of xyz positions.
   */
  static generateOrbitPath(planetData, segments = 128) {
    const { distanceDisplay: a, eccentricity: e, inclination } = planetData;

    if (!a) {
      return new Float32Array(0);
    }

    const ecc = e || 0;
    const incRad = THREE.MathUtils.degToRad(inclination || 0);
    const positions = new Float32Array(segments * 3);

    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;

      // Elliptical radius at this angle (using polar equation of ellipse)
      const r = (a * (1 - ecc * ecc)) / (1 + ecc * Math.cos(angle));

      const x = r * Math.cos(angle);
      const z = r * Math.sin(angle);

      // Apply inclination
      positions[i * 3] = x;
      positions[i * 3 + 1] = z * Math.sin(incRad);
      positions[i * 3 + 2] = z * Math.cos(incRad);
    }

    return positions;
  }
}
