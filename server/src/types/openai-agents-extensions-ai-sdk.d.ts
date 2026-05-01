// Ambient declaration for @openai/agents-extensions/ai-sdk subpath export.
// TypeScript's commonjs moduleResolution doesn't resolve package exports maps,
// so we declare the public surface we use directly.
declare module '@openai/agents-extensions/ai-sdk' {
  import type {
    Model,
    ModelRequest,
    ModelResponse,
    ModelRetryAdvice,
    ModelRetryAdviceRequest,
    StreamEvent,
  } from '@openai/agents';

  export class AiSdkModel implements Model {
    getResponse(request: ModelRequest): Promise<ModelResponse>;
    getStreamedResponse(request: ModelRequest): AsyncIterable<StreamEvent>;
    getRetryAdvice?(args: ModelRetryAdviceRequest): Promise<ModelRetryAdvice | undefined> | ModelRetryAdvice | undefined;
  }

  export function aisdk(model: unknown): AiSdkModel;
}
