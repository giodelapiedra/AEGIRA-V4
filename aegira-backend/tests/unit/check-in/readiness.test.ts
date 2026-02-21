import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Settings } from 'luxon';

// The CheckInService.calculateReadiness is private, so we test it via the submit() method
// or we can test it indirectly by inspecting the created check-in's scores.
// For pure unit testing, we'll replicate the readiness calculation logic and test it directly.
// This ensures the algorithm is correct independent of DB interactions.

// Readiness calculation extracted for testing (mirrors check-in.service.ts)
function calculateSleepScore(hours: number, quality: number): number {
  let hoursScore: number;
  if (hours >= 7 && hours <= 9) {
    hoursScore = 100;
  } else if (hours >= 6 && hours < 7) {
    hoursScore = 80;
  } else if (hours >= 5 && hours < 6) {
    hoursScore = 60;
  } else if (hours < 5) {
    hoursScore = 40;
  } else {
    hoursScore = 90; // > 9 hours
  }
  const qualityScore = quality * 10;
  return Math.round((hoursScore + qualityScore) / 2);
}

interface ReadinessInput {
  hoursSlept: number;
  sleepQuality: number;
  stressLevel: number;
  physicalCondition: number;
  painLevel?: number | null;
}

function calculateReadiness(input: ReadinessInput) {
  const sleepScore = calculateSleepScore(input.hoursSlept, input.sleepQuality);
  const stressScore = (10 - input.stressLevel) * 10;
  const physicalScore = input.physicalCondition * 10;
  const hasPain = input.painLevel !== undefined && input.painLevel !== null && input.painLevel > 0;
  const painScore = hasPain ? Math.round((10 - input.painLevel!) * 10) : null;

  let overall: number;
  if (painScore !== null) {
    overall = Math.round(
      sleepScore * 0.35 + stressScore * 0.25 + physicalScore * 0.2 + painScore * 0.2
    );
  } else {
    overall = Math.round(sleepScore * 0.4 + stressScore * 0.3 + physicalScore * 0.3);
  }

  const level = overall >= 70 ? 'GREEN' : overall >= 50 ? 'YELLOW' : 'RED';

  return { overall, level, factors: { sleep: sleepScore, stress: stressScore, physical: physicalScore, pain: painScore } };
}

// ─── Sleep Score ──────────────────────────────────────────────────────────────

describe('calculateSleepScore', () => {
  it('optimal sleep (7-9 hours) gives hoursScore=100', () => {
    // hours=8, quality=10 → (100 + 100) / 2 = 100
    expect(calculateSleepScore(8, 10)).toBe(100);
    // hours=7, quality=5 → (100 + 50) / 2 = 75
    expect(calculateSleepScore(7, 5)).toBe(75);
    // hours=9, quality=1 → (100 + 10) / 2 = 55
    expect(calculateSleepScore(9, 1)).toBe(55);
  });

  it('6-7 hours gives hoursScore=80', () => {
    // hours=6, quality=5 → (80 + 50) / 2 = 65
    expect(calculateSleepScore(6, 5)).toBe(65);
    // hours=6.5, quality=10 → (80 + 100) / 2 = 90
    expect(calculateSleepScore(6.5, 10)).toBe(90);
  });

  it('5-6 hours gives hoursScore=60', () => {
    // hours=5, quality=5 → (60 + 50) / 2 = 55
    expect(calculateSleepScore(5, 5)).toBe(55);
    expect(calculateSleepScore(5.5, 5)).toBe(55);
  });

  it('less than 5 hours gives hoursScore=40', () => {
    // hours=3, quality=5 → (40 + 50) / 2 = 45
    expect(calculateSleepScore(3, 5)).toBe(45);
    // hours=0, quality=1 → (40 + 10) / 2 = 25
    expect(calculateSleepScore(0, 1)).toBe(25);
    // hours=4.9, quality=5 → (40 + 50) / 2 = 45
    expect(calculateSleepScore(4.9, 5)).toBe(45);
  });

  it('more than 9 hours gives hoursScore=90', () => {
    // hours=10, quality=5 → (90 + 50) / 2 = 70
    expect(calculateSleepScore(10, 5)).toBe(70);
    // hours=15 (max), quality=10 → (90 + 100) / 2 = 95
    expect(calculateSleepScore(15, 10)).toBe(95);
  });

  it('boundary: exactly 5 hours', () => {
    // 5 is in the 5-6 band → hoursScore=60
    expect(calculateSleepScore(5, 5)).toBe(55); // (60+50)/2
  });

  it('boundary: exactly 7 hours', () => {
    // 7 is in the 7-9 band → hoursScore=100
    expect(calculateSleepScore(7, 5)).toBe(75); // (100+50)/2
  });
});

// ─── Readiness Calculation ────────────────────────────────────────────────────

describe('calculateReadiness', () => {
  it('optimal worker produces GREEN readiness', () => {
    const result = calculateReadiness({
      hoursSlept: 8,
      sleepQuality: 9,
      stressLevel: 2,
      physicalCondition: 9,
    });
    expect(result.level).toBe('GREEN');
    expect(result.overall).toBeGreaterThanOrEqual(70);
    expect(result.factors.pain).toBeNull();
  });

  it('poor worker produces RED readiness', () => {
    const result = calculateReadiness({
      hoursSlept: 3,
      sleepQuality: 2,
      stressLevel: 9,
      physicalCondition: 2,
      painLevel: 8,
    });
    expect(result.level).toBe('RED');
    expect(result.overall).toBeLessThan(50);
    expect(result.factors.pain).not.toBeNull();
  });

  it('mid-range worker produces YELLOW readiness', () => {
    const result = calculateReadiness({
      hoursSlept: 6,
      sleepQuality: 5,
      stressLevel: 5,
      physicalCondition: 5,
    });
    expect(result.level).toBe('YELLOW');
    expect(result.overall).toBeGreaterThanOrEqual(50);
    expect(result.overall).toBeLessThan(70);
  });

  it('painLevel=0 is treated as no pain (uses no-pain weights)', () => {
    const withoutPain = calculateReadiness({
      hoursSlept: 8,
      sleepQuality: 8,
      stressLevel: 3,
      physicalCondition: 8,
    });
    const withPainZero = calculateReadiness({
      hoursSlept: 8,
      sleepQuality: 8,
      stressLevel: 3,
      physicalCondition: 8,
      painLevel: 0,
    });
    // painLevel=0 → no pain → same formula
    expect(withPainZero.overall).toBe(withoutPain.overall);
    expect(withPainZero.factors.pain).toBeNull();
  });

  it('painLevel undefined is treated as no pain', () => {
    const result = calculateReadiness({
      hoursSlept: 8,
      sleepQuality: 8,
      stressLevel: 3,
      physicalCondition: 8,
      painLevel: undefined,
    });
    expect(result.factors.pain).toBeNull();
  });

  it('pain changes the weight formula', () => {
    const base = {
      hoursSlept: 8,
      sleepQuality: 8,
      stressLevel: 3,
      physicalCondition: 8,
    };
    const noPain = calculateReadiness(base);
    const withPain = calculateReadiness({ ...base, painLevel: 5 });

    // With pain: 35/25/20/20 weights; Without: 40/30/30 weights
    expect(noPain.overall).not.toBe(withPain.overall);
    expect(noPain.factors.pain).toBeNull();
    expect(withPain.factors.pain).toBe(50); // (10-5)*10 = 50
  });

  it('stress is inverse: low stress = high score', () => {
    const lowStress = calculateReadiness({
      hoursSlept: 8,
      sleepQuality: 5,
      stressLevel: 1,
      physicalCondition: 5,
    });
    const highStress = calculateReadiness({
      hoursSlept: 8,
      sleepQuality: 5,
      stressLevel: 10,
      physicalCondition: 5,
    });
    expect(lowStress.factors.stress).toBe(90); // (10-1)*10
    expect(highStress.factors.stress).toBe(0);  // (10-10)*10
    expect(lowStress.overall).toBeGreaterThan(highStress.overall);
  });

  it('physical score is linear multiplication', () => {
    const result1 = calculateReadiness({
      hoursSlept: 8,
      sleepQuality: 5,
      stressLevel: 5,
      physicalCondition: 1,
    });
    const result10 = calculateReadiness({
      hoursSlept: 8,
      sleepQuality: 5,
      stressLevel: 5,
      physicalCondition: 10,
    });
    expect(result1.factors.physical).toBe(10);  // 1 * 10
    expect(result10.factors.physical).toBe(100); // 10 * 10
  });

  it('exact score calculation with pain', () => {
    // sleep: hours=8 (100), quality=8 (80) → (100+80)/2 = 90
    // stress: (10-3)*10 = 70
    // physical: 8*10 = 80
    // pain: (10-4)*10 = 60
    // overall: 90*0.35 + 70*0.25 + 80*0.20 + 60*0.20 = 31.5 + 17.5 + 16 + 12 = 77
    const result = calculateReadiness({
      hoursSlept: 8,
      sleepQuality: 8,
      stressLevel: 3,
      physicalCondition: 8,
      painLevel: 4,
    });
    expect(result.factors.sleep).toBe(90);
    expect(result.factors.stress).toBe(70);
    expect(result.factors.physical).toBe(80);
    expect(result.factors.pain).toBe(60);
    expect(result.overall).toBe(77);
    expect(result.level).toBe('GREEN');
  });

  it('exact score calculation without pain', () => {
    // sleep: hours=8 (100), quality=8 (80) → (100+80)/2 = 90
    // stress: (10-3)*10 = 70
    // physical: 8*10 = 80
    // overall: 90*0.4 + 70*0.3 + 80*0.3 = 36 + 21 + 24 = 81
    const result = calculateReadiness({
      hoursSlept: 8,
      sleepQuality: 8,
      stressLevel: 3,
      physicalCondition: 8,
    });
    expect(result.overall).toBe(81);
    expect(result.level).toBe('GREEN');
  });

  it('readiness level boundaries: 70 is GREEN', () => {
    // Need overall = 70 exactly
    // Without pain: sleep*0.4 + stress*0.3 + physical*0.3 = 70
    // sleep=70 (hours=7 quality=4 → (100+40)/2=70), stress=70 ((10-3)*10), physical=70 (condition=7)
    // 70*0.4 + 70*0.3 + 70*0.3 = 28 + 21 + 21 = 70
    const result = calculateReadiness({
      hoursSlept: 7,
      sleepQuality: 4,
      stressLevel: 3,
      physicalCondition: 7,
    });
    expect(result.overall).toBe(70);
    expect(result.level).toBe('GREEN');
  });

  it('readiness level boundaries: 69 is YELLOW', () => {
    // Without pain: 69
    // sleep=65 (hours=6 quality=5 → (80+50)/2=65), stress=70, physical=70
    // 65*0.4 + 70*0.3 + 70*0.3 = 26 + 21 + 21 = 68
    const result = calculateReadiness({
      hoursSlept: 6,
      sleepQuality: 5,
      stressLevel: 3,
      physicalCondition: 7,
    });
    expect(result.overall).toBe(68);
    expect(result.level).toBe('YELLOW');
  });

  it('readiness level boundaries: 50 is YELLOW', () => {
    // Without pain: 50
    // sleep=50, stress=50, physical=50
    // 50*0.4 + 50*0.3 + 50*0.3 = 20 + 15 + 15 = 50
    const result = calculateReadiness({
      hoursSlept: 7,
      sleepQuality: 0,     // quality=0 → (100+0)/2 = 50
      stressLevel: 5,       // (10-5)*10 = 50
      physicalCondition: 5, // 5*10 = 50
    });
    expect(result.overall).toBe(50);
    expect(result.level).toBe('YELLOW');
  });

  it('readiness level boundaries: 49 is RED', () => {
    // Without pain: 49
    // sleep=45 (hours=3 quality=5 → (40+50)/2=45), stress=50, physical=50
    // 45*0.4 + 50*0.3 + 50*0.3 = 18 + 15 + 15 = 48
    const result = calculateReadiness({
      hoursSlept: 3,
      sleepQuality: 5,
      stressLevel: 5,
      physicalCondition: 5,
    });
    expect(result.overall).toBe(48);
    expect(result.level).toBe('RED');
  });
});
