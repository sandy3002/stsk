import { describe, expect, it } from 'vitest';
import { StudentsService } from './students.service.js';

describe('StudentsService', () => {
  it('calculates remaining classes without going below zero', () => {
    const service = new StudentsService();

    expect(service.calculateRemainingClasses(10, 8)).toBe(2);
    expect(service.calculateRemainingClasses(5, 8)).toBe(0);
  });
});
