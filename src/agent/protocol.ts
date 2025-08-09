import { z } from 'zod';

export const ToolCallSchema = z.object({
  tool: z.string(),
  arguments: z.record(z.any()).default({})
});

export const FinalAnswerSchema = z.object({
  final: z.string()
});

export type ToolCall = z.infer<typeof ToolCallSchema>;
export type FinalAnswer = z.infer<typeof FinalAnswerSchema>;

export function parseAssistantResponse(text: string): { type: 'tool'; call: ToolCall } | { type: 'final'; answer: string } | { type: 'invalid'; error: string } {
  const tryParse = (raw: string) => {
    try {
      const obj = JSON.parse(raw);
      const final = FinalAnswerSchema.safeParse(obj);
      if (final.success) return { kind: 'final', value: final.data.final } as const;
      const tool = ToolCallSchema.safeParse(obj);
      if (tool.success) return { kind: 'tool', value: tool.data } as const;
      return { kind: 'error', value: 'JSON did not match expected schemas' } as const;
    } catch (e: any) {
      return { kind: 'error', value: e?.message || 'invalid JSON' } as const;
    }
  };

  const direct = tryParse(text.trim());
  if (direct.kind === 'final') return { type: 'final', answer: direct.value };
  if (direct.kind === 'tool') return { type: 'tool', call: direct.value };

  const m = /```json\s*([\s\S]*?)```/i.exec(text);
  if (m) {
    const fromFence = tryParse(m[1]);
    if (fromFence.kind === 'final') return { type: 'final', answer: fromFence.value };
    if (fromFence.kind === 'tool') return { type: 'tool', call: fromFence.value };
  }
  return { type: 'invalid', error: typeof direct.value === 'string' ? direct.value : 'Unrecognized response' };
}
