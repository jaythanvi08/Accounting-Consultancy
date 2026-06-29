export type Gender = 'Male' | 'Female' | 'Other';

export type Profession =
  | 'Accountant'
  | 'CA'
  | 'Business Owner'
  | 'Student'
  | 'Other';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  age: number;
  profession: Profession;
  gender: Gender;
  createdAt: string;
}

export interface AuthSession {
  token: string;
  user: User;
  issuedAt: number;
}

export interface LoginPayload {
  /** Email or phone — auto-detected by the form. */
  identifier: string;
  password: string;
  remember: boolean;
}

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  age: number;
  profession: Profession;
  gender: Gender;
  password: string;
}
