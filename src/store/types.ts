import type { StateCreator } from 'zustand';
import type { UiSlice } from './slices/uiSlice';
import type { SettingsSlice } from './slices/settingsSlice';
import type { TtsSlice } from './slices/ttsSlice';
import type { LibrarySlice } from './slices/librarySlice';
import type { DataSlice } from './slices/dataSlice';
import type { PartySlice } from './slices/partySlice';
import type { ConversationsSlice } from './slices/conversationsSlice';
import type { ChatSlice } from './slices/chatSlice';

export type AppState = UiSlice &
  SettingsSlice &
  TtsSlice &
  LibrarySlice &
  DataSlice &
  PartySlice &
  ConversationsSlice &
  ChatSlice;

/** Every slice is written against the whole store, so cross-slice reads stay typed. */
export type SliceCreator<T> = StateCreator<AppState, [['zustand/persist', unknown]], [], T>;
