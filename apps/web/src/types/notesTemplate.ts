// A snippet doctors drop into session notes with one click. `shared` ones are
// hospital-wide (admin-managed); the rest belong to the signed-in user.
export interface NotesTemplate {
  id: string;
  label: string;
  text: string;
  shared: boolean;
  canEdit: boolean;
}

export interface NotesTemplateListResponse {
  items: NotesTemplate[];
}

export interface CreateNotesTemplateData {
  label: string;
  text: string;
  // Admins only — false saves it as their own instead of hospital-wide.
  shared?: boolean;
}

export type UpdateNotesTemplateData = Partial<
  Omit<CreateNotesTemplateData, "shared">
>;
