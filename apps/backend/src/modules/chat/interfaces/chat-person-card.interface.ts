/**
 * What a colleague may see about another person in the chat — enough to know
 * who they are (name, role, photo), nothing more: no phone, no salary, no
 * location. The full employee record stays admin-only.
 */
export interface ChatPersonCard {
  id: string;
  fullName: string;
  position: string | null;
  department: string | null;
  avatarUrl: string | null;
  /** false for "Ma’muriyat" (the admin side), true for a colleague. */
  isEmployee: boolean;
}
