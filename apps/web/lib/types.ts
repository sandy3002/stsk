export const BELT_RANKS = [
  'White',
  'Red',
  'Yellow',
  'Orange',
  'Green',
  'Blue',
  'Blue Stripe',
  'Purple',
  'Purple Stripe',
  'Brown',
  'Brown Stripe',
  'Brown Double Stripe',
  'Black',
] as const;

export type BeltRank = (typeof BELT_RANKS)[number];

export type ExamStatus = 'passed' | 'failed' | 'pending';

export type AttendanceStatus = 'present' | 'absent';
export type SessionType = 'regular' | 'sparring' | 'grading';

export type TuitionStatus = 'paid' | 'unpaid' | 'waived';
export type PaymentMethod = 'cash' | 'upi';

export type NoticeCategory = 'announcement' | 'exam_schedule' | 'holiday';
