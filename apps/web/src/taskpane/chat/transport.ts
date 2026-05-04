import { DefaultChatTransport } from 'ai';
import { getToken } from '../api';
import type { Host } from '@shared/schemas/conversation';

export function makeChatTransport(args: { host: Host; providerId: string; modelId: string }) {
  return new DefaultChatTransport({
    api: '/api/chat',
    headers: () => ({ Authorization: `Bearer ${getToken()}` }),
    prepareSendMessagesRequest: ({ id, messages, trigger, messageId }) => {
      if (trigger === 'submit-user-message') {
        return {
          body: {
            id,
            host: args.host,
            providerId: args.providerId,
            modelId: args.modelId,
            trigger,
            message: messages[messages.length - 1],
          },
        };
      }
      return {
        body: {
          id,
          host: args.host,
          providerId: args.providerId,
          modelId: args.modelId,
          trigger,
          messageId,
        },
      };
    },
  });
}
