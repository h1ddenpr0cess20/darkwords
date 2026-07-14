import type { McpServer, Memory, Skill } from '../../types';
import { makeId } from '../../lib/id';
import { parseSkill } from '../../lib/tools/skills';
import { resetMcpSession } from '../../lib/tools/mcpClient';
import type { SliceCreator } from '../types';

export interface LibrarySlice {
  memoryEnabled: boolean;
  memoryLimit: number;
  memories: Memory[];

  skills: Skill[];
  mcpServers: McpServer[];

  toggleMemory: () => void;
  setMemoryLimit: (limit: number) => void;
  addMemory: (text: string) => void;
  removeMemory: (id: string) => void;
  clearMemories: () => void;

  importSkill: (fileName: string, source: string) => void;
  toggleSkill: (id: string) => void;
  removeSkill: (id: string) => void;

  addMcpServer: (server: Omit<McpServer, 'id' | 'enabled'>) => void;
  toggleMcpServer: (id: string) => void;
  removeMcpServer: (id: string) => void;
}

export const createLibrarySlice: SliceCreator<LibrarySlice> = (set) => ({
  memoryEnabled: false,
  memoryLimit: 25,
  memories: [],
  skills: [],
  mcpServers: [],

  toggleMemory: () => set((s) => ({ memoryEnabled: !s.memoryEnabled })),
  setMemoryLimit: (limit) =>
    set((s) => {
      const next = Math.max(1, Math.floor(limit) || 1);
      return { memoryLimit: next, memories: s.memories.slice(-next) };
    }),
  addMemory: (text) =>
    set((s) => {
      const trimmed = text.trim();
      if (!trimmed) return {};
      const memories = [...s.memories, { id: makeId('mem'), text: trimmed, createdAt: Date.now() }];
      return { memories: memories.slice(-s.memoryLimit) };
    }),
  removeMemory: (id) => set((s) => ({ memories: s.memories.filter((m) => m.id !== id) })),
  clearMemories: () => set({ memories: [] }),

  importSkill: (fileName, source) =>
    set((s) => {
      const parsed = parseSkill(fileName, source);
      if (!parsed.content) return {};
      const others = s.skills.filter((sk) => sk.name.toLowerCase() !== parsed.name.toLowerCase());
      return { skills: [...others, { id: makeId('skill'), ...parsed, enabled: true }] };
    }),
  toggleSkill: (id) =>
    set((s) => ({ skills: s.skills.map((sk) => (sk.id === id ? { ...sk, enabled: !sk.enabled } : sk)) })),
  removeSkill: (id) => set((s) => ({ skills: s.skills.filter((sk) => sk.id !== id) })),

  addMcpServer: (server) =>
    set((s) => {
      const name = server.name.trim();
      const url = server.url.trim();
      if (!name || !url) return {};
      const others = s.mcpServers.filter((m) => m.name !== name);
      return {
        mcpServers: [
          ...others,
          { id: makeId('mcp'), name, url, authToken: server.authToken?.trim() || undefined, enabled: true },
        ],
      };
    }),
  toggleMcpServer: (id) => {
    resetMcpSession(id);
    set((s) => ({ mcpServers: s.mcpServers.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m)) }));
  },
  removeMcpServer: (id) => {
    resetMcpSession(id);
    set((s) => ({ mcpServers: s.mcpServers.filter((m) => m.id !== id) }));
  },
});
