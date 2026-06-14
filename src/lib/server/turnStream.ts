/**
 * SSE helper: stream a scope's persisted turn timeline to the client until the
 * run reaches a terminal state. Mirrors debate-fact-checker's SSE transport but
 * tails the agent_turns table (so a run survives client disconnects).
 */
import { listTurns } from '@/lib/agent/turns';
import type { TurnScopeType } from '@/lib/agent/types';

export function turnStreamResponse(
  scopeType: TurnScopeType,
  scopeSlug: string,
  isTerminal: () => boolean,
  startAfterId = 0,
): Response {
  const encoder = new TextEncoder();
  let lastId = startAfterId;

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      const flush = () => {
        for (const turn of listTurns(scopeType, scopeSlug, lastId)) {
          lastId = turn.id;
          send('turn', turn);
        }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(timer);
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      send('init', { scopeSlug });
      try {
        flush();
        if (isTerminal()) {
          send('done', { scopeSlug });
          close();
          return;
        }
      } catch {
        close();
        return;
      }

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          close();
        }
      }, 10_000);

      const timer = setInterval(() => {
        try {
          flush();
          if (isTerminal()) {
            send('done', { scopeSlug });
            close();
          }
        } catch {
          close();
        }
      }, 800);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
