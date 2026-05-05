import { DefaultChatTransport } from 'ai';
import { getToken } from '../api';
import type { Host } from '@autooffice/shared';

export function makeChatTransport(args: {
  host: Host;
  getProviderId: () => string;
  getModelId: () => string;
}) {
  return new DefaultChatTransport({
    api: '/api/chat',
    headers: () => ({ Authorization: `Bearer ${getToken()}` }),
    prepareSendMessagesRequest: ({ id, messages, trigger, messageId }) => {
      const providerId = args.getProviderId();
      const modelId = args.getModelId();
      if (trigger === 'submit-message') {
        return {
          body: {
            id,
            host: args.host,
            providerId,
            modelId,
            trigger,
            message: messages[messages.length - 1],
          },
        };
      }
      return {
        body: {
          id,
          host: args.host,
          providerId,
          modelId,
          trigger,
          messageId,
        },
      };
    },
  });
}
