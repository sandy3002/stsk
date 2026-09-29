import { Injectable } from '@nestjs/common';

@Injectable()
export class DashboardService {
  getSummary() {
    return {
      totalStudents: 128,
      passed: 76,
      failed: 24,
      nextExamDate: '2026-10-20',
    };
  }
}
