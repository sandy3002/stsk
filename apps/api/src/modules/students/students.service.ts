export class StudentsService {
  calculateRemainingClasses(required: number, attended: number): number {
    return Math.max(0, required - attended);
  }
}
