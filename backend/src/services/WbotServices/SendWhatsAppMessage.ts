import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import { whatsappProvider, ProviderMessage } from "../../providers/WhatsApp";

import formatBody from "../../helpers/Mustache";
import GetContactChatId from "../../helpers/GetContactChatId";

export interface MessageMention {
  id: string;
  number: string;
  name: string;
}

interface Request {
  body: string;
  ticket: Ticket;
  quotedMsg?: Message;
  mentions?: MessageMention[];
}

// The text shows "@Name"; WhatsApp needs "@number" to render the mention
const applyMentions = (
  body: string,
  mentions: MessageMention[]
): { text: string; ids: string[] } => {
  let text = body;
  const ids: string[] = [];

  // longest names first, so "@Ana Maria" isn't taken for "@Ana"
  [...mentions]
    .sort((a, b) => b.name.length - a.name.length)
    .forEach(mention => {
      const displayed = `@${mention.name}`;
      if (!mention.id || !mention.number || !text.includes(displayed)) return;
      text = text.split(displayed).join(`@${mention.number}`);
      ids.push(mention.id);
    });

  return { text, ids };
};

const SendWhatsAppMessage = async ({
  body,
  ticket,
  quotedMsg,
  mentions
}: Request): Promise<ProviderMessage> => {
  if (!ticket.whatsappId) {
    throw new AppError("ERR_TICKET_NO_WHATSAPP");
  }

  const chatId = GetContactChatId(ticket.contact, ticket.isGroup);

  const { text, ids } =
    ticket.isGroup && Array.isArray(mentions) && mentions.length
      ? applyMentions(body, mentions)
      : { text: body, ids: [] as string[] };

  try {
    const sentMessage = await whatsappProvider.sendMessage(
      ticket.whatsappId,
      chatId,
      formatBody(text, ticket.contact),
      {
        quotedMessageId: quotedMsg?.id,
        quotedMessageFromMe: quotedMsg?.fromMe,
        linkPreview: false,
        mentions: ids.length ? ids : undefined
      }
    );

    await ticket.update({ lastMessage: body });
    return sentMessage;
  } catch (err) {
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMessage;
