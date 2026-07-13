export type Role = 'user' | 'assistant';

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  /** base64 data URL — used for both preview and as an API content block */
  dataUrl: string;
}

export interface ToolCallInfo {
  id: string;
  name: string;
  input: string;
  output?: string;
  isError?: boolean;
}

export interface ImageGenInfo {
  /** base64 data URL of the generated image */
  src: string;
  label: string;
}

export interface ParagraphPart {
  type: 'para';
  text: string;
}
export interface HeadingPart {
  type: 'heading';
  text: string;
}
export interface ListPart {
  type: 'list';
  items: string[];
}
export interface CodePart {
  type: 'code';
  text: string;
}
export type ContentPart = ParagraphPart | HeadingPart | ListPart | CodePart;

/** A prior answer kept when a message is regenerated. */
export interface MessageVariant {
  rawText: string;
  parts: ContentPart[];
  thinking?: string;
  tools?: ToolCallInfo[];
  imageGen?: ImageGenInfo[];
}

export interface ChatMessage {
  id: string;
  role: Role;
  displayName: string;
  personaId?: string;
  nameColor?: string;
  time: string;
  attachments: Attachment[];
  parts: ContentPart[];
  rawText: string;
  thinking?: string;
  thinkingOpen?: boolean;
  tools?: ToolCallInfo[];
  imageGen?: ImageGenInfo[];
  streaming?: boolean;
  error?: string;
  /** Every version of this reply, oldest first. Present once regenerated. */
  variants?: MessageVariant[];
  variantIndex?: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export type ThemeId = 'ink' | 'ember' | 'dusk';

export interface ThemeDef {
  id: ThemeId;
  color: string;
  label: string;
}

export type ModelId = 'opus' | 'sonnet' | 'haiku';

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface ModelDef {
  id: ModelId;
  apiModel: string;
  name: string;
  short: string;
  blurb: string;
  /** Adaptive thinking + the `effort` control (not supported on Haiku). */
  supportsThinking: boolean;
  /**
   * Programmatic tool calling — Claude invoking tools from inside code
   * execution. The dynamic-filtering web-search/fetch variants depend on it;
   * models without it must pin tools to `allowed_callers: ["direct"]`.
   */
  supportsProgrammaticTools: boolean;
  maxTokens: number;
}

export interface ToolsEnabled {
  web: boolean;
  code: boolean;
  files: boolean;
  image: boolean;
}

/** How the system prompt is composed. */
export type PromptMode = 'personality' | 'custom' | 'none' | 'party';

/** A brief fact the assistant keeps about the user, injected into the prompt. */
export interface Memory {
  id: string;
  text: string;
  createdAt: number;
}

/** A SKILL.md instruction package, loaded on demand by the model. */
export interface Skill {
  id: string;
  name: string;
  description: string;
  content: string;
  enabled: boolean;
}

/** A remote MCP server, connected via Anthropic's MCP connector. */
export interface McpServer {
  id: string;
  name: string;
  url: string;
  authToken?: string;
  enabled: boolean;
}

export type PanelId = 'settings' | 'history' | 'gallery' | null;
export type SettingsTab =
  | 'model'
  | 'tools'
  | 'personality'
  | 'memory'
  | 'skills'
  | 'theme'
  | 'apikeys'
  | 'data';

export interface GalleryItem {
  id: string;
  label: string;
  kind: 'Generated' | 'Uploaded';
  /** base64 data URL — the actual image bytes */
  src: string;
  createdAt: number;
}
