import type { Attachment, GalleryItem, PanelId, SettingsTab } from '../../types';
import type { SliceCreator } from '../types';

/** Drawer/panel state, the composer's draft input and uploads, and the gallery. */
export interface UiSlice {
  activePanel: PanelId;
  panelTab: SettingsTab;
  modelPickerOpen: boolean;

  input: string;
  pendingUploads: Attachment[];
  galleryItems: GalleryItem[];

  /** The image currently open full-size, if any. */
  lightbox: { src: string; label: string } | null;

  setInput: (text: string) => void;
  addUpload: (att: Attachment) => void;
  removeUpload: (id: string) => void;

  openSettings: () => void;
  openHistory: () => void;
  openGallery: () => void;
  openLightbox: (image: { src: string; label: string }) => void;
  closeLightbox: () => void;
  closePanel: () => void;
  setPanelTab: (tab: SettingsTab) => void;
  toggleModelPicker: () => void;
}

export const createUiSlice: SliceCreator<UiSlice> = (set) => ({
  activePanel: null,
  panelTab: 'personality',
  modelPickerOpen: false,

  input: '',
  pendingUploads: [],
  galleryItems: [],
  lightbox: null,

  setInput: (text) => set({ input: text }),
  addUpload: (att) => set((s) => ({ pendingUploads: [...s.pendingUploads, att] })),
  removeUpload: (id) => set((s) => ({ pendingUploads: s.pendingUploads.filter((u) => u.id !== id) })),

  openSettings: () => set({ activePanel: 'settings', panelTab: 'personality', modelPickerOpen: false }),
  openHistory: () => set({ activePanel: 'history', modelPickerOpen: false }),
  openGallery: () => set({ activePanel: 'gallery', modelPickerOpen: false }),
  openLightbox: (image) => set({ lightbox: image }),
  closeLightbox: () => set({ lightbox: null }),
  closePanel: () => set({ activePanel: null, modelPickerOpen: false }),
  setPanelTab: (tab) => set({ panelTab: tab }),
  toggleModelPicker: () => set((s) => ({ modelPickerOpen: !s.modelPickerOpen })),
});
