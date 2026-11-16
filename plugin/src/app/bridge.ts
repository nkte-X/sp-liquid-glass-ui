// iframe → plugin.js messaging. The host forwards PLUGIN_MESSAGE to the
// plugin's onMessage handler and answers with PLUGIN_MESSAGE_RESPONSE /
// PLUGIN_MESSAGE_ERROR carrying the same messageId
// (src/app/plugins/util/plugin-iframe.util.ts in the app).

import type { LgxMessage, LgxState } from '../protocol';

const TIMEOUT_MS = 8000;

export const send = <T = LgxState>(message: LgxMessage): Promise<T> =>
  new Promise((resolve, reject) => {
    const messageId = `lgx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    const done = (): void => {
      window.removeEventListener('message', onMessage);
      clearTimeout(timer);
    };

    const onMessage = (event: MessageEvent): void => {
      const data = event.data as {
        type?: string;
        messageId?: string;
        result?: unknown;
        error?: string;
      };
      if (!data || data.messageId !== messageId) return;
      if (data.type === 'PLUGIN_MESSAGE_RESPONSE') {
        done();
        const result = data.result as T | { error: string };
        if (result && typeof result === 'object' && 'error' in result) reject(new Error(result.error));
        else resolve(result as T);
      } else if (data.type === 'PLUGIN_MESSAGE_ERROR') {
        done();
        reject(new Error(data.error || 'plugin error'));
      }
    };

    const timer = setTimeout(() => {
      done();
      reject(new Error('No answer from plugin.js — is the plugin enabled?'));
    }, TIMEOUT_MS);

    window.addEventListener('message', onMessage);
    window.parent.postMessage({ type: 'PLUGIN_MESSAGE', message, messageId }, '*');
  });
