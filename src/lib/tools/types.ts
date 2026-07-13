/**
 * A tool Darkwords executes itself, in the browser, when Claude calls it.
 * (Web search and code execution run on Anthropic's servers instead and never
 * come through here.)
 */
export interface ClientTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  /** Runs the tool and returns the text handed back to the model. */
  run(input: Record<string, unknown>, signal?: AbortSignal): Promise<string>;
  /** Short line shown in the message margin once the call resolves. */
  summarize?(input: Record<string, unknown>, result: string): string;
}
