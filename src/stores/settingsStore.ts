import { create } from 'zustand';
import { load, Store } from '@tauri-apps/plugin-store';

export interface Settings {
  anthropicApiKey: string;
  openaiApiKey: string;
  ollamaBaseUrl: string;
}

interface SettingsState {
  settings: Settings;
  isLoaded: boolean;
  isSaving: boolean;

  // Actions
  loadSettings: () => Promise<void>;
  updateSettings: (updates: Partial<Settings>) => Promise<void>;
  getApiKey: (provider: 'anthropic' | 'openai' | 'ollama') => string;
}

const DEFAULT_SETTINGS: Settings = {
  anthropicApiKey: '',
  openaiApiKey: '',
  ollamaBaseUrl: 'http://localhost:11434',
};

let store: Store | null = null;

async function getStore(): Promise<Store> {
  if (!store) {
    store = await load('settings.json');
  }
  return store;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  isLoaded: false,
  isSaving: false,

  loadSettings: async () => {
    try {
      const s = await getStore();
      const anthropicApiKey = await s.get<string>('anthropicApiKey') ?? '';
      const openaiApiKey = await s.get<string>('openaiApiKey') ?? '';
      const ollamaBaseUrl = await s.get<string>('ollamaBaseUrl') ?? 'http://localhost:11434';

      set({
        settings: { anthropicApiKey, openaiApiKey, ollamaBaseUrl },
        isLoaded: true,
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
      set({ isLoaded: true });
    }
  },

  updateSettings: async (updates: Partial<Settings>) => {
    set({ isSaving: true });
    try {
      const s = await getStore();
      const current = get().settings;
      const newSettings = { ...current, ...updates };

      // Save each key
      if (updates.anthropicApiKey !== undefined) {
        await s.set('anthropicApiKey', updates.anthropicApiKey);
      }
      if (updates.openaiApiKey !== undefined) {
        await s.set('openaiApiKey', updates.openaiApiKey);
      }
      if (updates.ollamaBaseUrl !== undefined) {
        await s.set('ollamaBaseUrl', updates.ollamaBaseUrl);
      }

      await s.save();
      set({ settings: newSettings });
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    } finally {
      set({ isSaving: false });
    }
  },

  getApiKey: (provider: 'anthropic' | 'openai' | 'ollama') => {
    const { settings } = get();
    switch (provider) {
      case 'anthropic':
        return settings.anthropicApiKey;
      case 'openai':
        return settings.openaiApiKey;
      case 'ollama':
        return ''; // Ollama doesn't need an API key
      default:
        return '';
    }
  },
}));
