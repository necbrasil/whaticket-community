import { join } from "path";
import { promisify } from "util";
import { writeFile } from "fs";
import * as Sentry from "@sentry/node";

import { getIO } from "../libs/socket";
import { logger } from "../utils/logger";
import { debounce } from "../helpers/Debounce";
import formatBody from "../helpers/Mustache";

import Contact from "../models/Contact";
import Ticket from "../models/Ticket";
import Message, { MessageReaction } from "../models/Message";

import CreateMessageService from "../services/MessageServices/CreateMessageService";
import CreateOrUpdateContactService from "../services/ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../services/TicketServices/FindOrCreateTicketService";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import CreateContactService from "../services/ContactServices/CreateContactService";

import { whatsappProvider } from "../providers/WhatsApp/whatsappProvider";
import { MessageType, MessageAck } from "../providers/WhatsApp/types";
import GetContactChatId from "../helpers/GetContactChatId";

const writeFileAsync = promisify(writeFile);

export interface ContactPayload {
  name: string;
  number: string;
  lid?: string;
  profilePicUrl?: string;
  isGroup: boolean;
}

export interface MessagePayload {
  id: string;
  body: string;
  fromMe: boolean;
  hasMedia: boolean;
  type: MessageType;
  timestamp: number;
  from: string;
  to: string;
  hasQuotedMsg?: boolean;
  quotedMsgId?: string;
  mediaUrl?: string;
  mediaType?: string;
  ack?: MessageAck;
}

export interface MediaPayload {
  filename: string;
  mimetype: string;
  data: string;
}

export interface WhatsappContextPayload {
  whatsappId: number;
  unreadMessages: number;
  groupContact?: ContactPayload;
}

const makeRandomId = (length: number): string => {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
};

const processLocationMessage = (
  messagePayload: MessagePayload
): MessagePayload => {
  if (messagePayload.type !== "location") return messagePayload;

  return messagePayload;
};

const saveMediaFile = async (mediaPayload: MediaPayload): Promise<string> => {
  const randomId = makeRandomId(5);
  const { filename: originalFilename } = mediaPayload;

  let filename: string;
  if (!originalFilename) {
    const [extension] = mediaPayload.mimetype.split("/")[1].split(";");
    filename = `${randomId}-${new Date().getTime()}.${extension}`;
  } else {
    const baseName = originalFilename.split(".").slice(0, -1).join(".");
    const extension = originalFilename.split(".").slice(-1)[0];
    filename = `${baseName}.${randomId}.${extension}`;
  }

  try {
    await writeFileAsync(
      join(__dirname, "..", "..", "public", filename),
      mediaPayload.data,
      "base64"
    );
  } catch (err) {
    Sentry.captureException(err);
    logger.error(err);
  }

  return filename;
};

const processVcardMessage = async (
  messagePayload: MessagePayload
): Promise<void> => {
  if (messagePayload.type !== "vcard") return;

  try {
    const array = messagePayload.body.split("\n");
    const phoneNumbers: Array<{ number: string }> = [];
    let contactName = "";

    array.forEach(line => {
      const values = line.split(":");
      values.forEach((value, index) => {
        if (value.indexOf("+") !== -1) {
          phoneNumbers.push({ number: value });
        }
        if (value.indexOf("FN") !== -1 && values[index + 1]) {
          contactName = values[index + 1];
        }
      });
    });

    await Promise.all(
      phoneNumbers.map(({ number }) =>
        CreateContactService({
          name: contactName,
          number: number.replace(/\D/g, "")
        })
      )
    );
  } catch (error) {
    logger.error("Error processing vcard message:", error);
  }
};

const handleQueueLogic = async (
  whatsappId: number,
  messageBody: string,
  ticket: Ticket,
  contactPayload: ContactPayload
): Promise<void> => {
  const { queues, greetingMessage } = await ShowWhatsAppService(whatsappId);

  if (queues.length === 1) {
    await UpdateTicketService({
      ticketData: { queueId: queues[0].id },
      ticketId: ticket.id
    });
    return;
  }

  const selectedOption = messageBody;
  const choosenQueue = queues[+selectedOption - 1];

  if (choosenQueue) {
    await UpdateTicketService({
      ticketData: { queueId: choosenQueue.id },
      ticketId: ticket.id
    });

    const body = formatBody(
      `\u200e${choosenQueue.greetingMessage}`,
      contactPayload as any
    );

    try {
      await whatsappProvider.sendMessage(
        whatsappId,
        GetContactChatId(contactPayload, false),
        body
      );
    } catch (error) {
      logger.error("Error sending queue greeting message:", error);
    }
  } else {
    let options = "";
    queues.forEach((queue, index) => {
      options += `*${index + 1}* - ${queue.name}\n`;
    });

    const body = formatBody(
      `\u200e${greetingMessage}\n${options}`,
      contactPayload as any
    );

    const debouncedSentMessage = debounce(
      async () => {
        try {
          await whatsappProvider.sendMessage(
            whatsappId,
            GetContactChatId(contactPayload, false),
            body
          );
        } catch (error) {
          logger.error("Error sending queue options message:", error);
        }
      },
      3000,
      ticket.id
    );

    debouncedSentMessage();
  }
};

export const handleMessage = async (
  messagePayload: MessagePayload,
  contactPayload: ContactPayload,
  contextPayload: WhatsappContextPayload,
  mediaPayload?: MediaPayload
): Promise<void> => {
  try {
    const processedMessage = processLocationMessage(messagePayload);

    const contact = await CreateOrUpdateContactService({
      name: contactPayload.name,
      number: contactPayload.number,
      lid: contactPayload.lid,
      profilePicUrl: contactPayload.profilePicUrl,
      isGroup: contactPayload.isGroup
    });

    let groupContact: Contact | undefined;
    if (contextPayload.groupContact) {
      groupContact = await CreateOrUpdateContactService({
        name: contextPayload.groupContact.name,
        number: contextPayload.groupContact.number,
        lid: contextPayload.groupContact.lid,
        profilePicUrl: contextPayload.groupContact.profilePicUrl,
        isGroup: contextPayload.groupContact.isGroup
      });
    }

    const whatsapp = await ShowWhatsAppService(contextPayload.whatsappId);
    if (
      contextPayload.unreadMessages === 0 &&
      whatsapp.farewellMessage &&
      formatBody(whatsapp.farewellMessage, contact) === processedMessage.body
    ) {
      return;
    }

    const ticket = await FindOrCreateTicketService(
      contact,
      contextPayload.whatsappId,
      contextPayload.unreadMessages,
      groupContact
    );

    const messageData: any = {
      id: processedMessage.id,
      ticketId: ticket.id,
      contactId: processedMessage.fromMe ? undefined : contact.id,
      body: processedMessage.body,
      fromMe: processedMessage.fromMe,
      read: processedMessage.fromMe,
      mediaType: processedMessage.type,
      quotedMsgId: processedMessage.quotedMsgId,
      ack: processedMessage.ack !== undefined ? processedMessage.ack : 0
    };

    if (mediaPayload && processedMessage.hasMedia) {
      const filename = await saveMediaFile(mediaPayload);
      messageData.mediaUrl = filename;
      messageData.body = processedMessage.body || filename;
      const [mediaType] = mediaPayload.mimetype.split("/");
      messageData.mediaType = mediaType;
    }

    let lastMessageText = "";
    if (processedMessage.type === "location") {
      lastMessageText = processedMessage.body.includes("Localization")
        ? processedMessage.body
        : "Localization";
    } else {
      lastMessageText = processedMessage.body || mediaPayload?.filename || "";
    }

    await ticket.update({ lastMessage: lastMessageText });

    await CreateMessageService({ messageData });

    await processVcardMessage(processedMessage);

    if (
      !ticket.queue &&
      !contextPayload.groupContact &&
      !processedMessage.fromMe &&
      !ticket.userId &&
      whatsapp.queues.length >= 1
    ) {
      await handleQueueLogic(
        contextPayload.whatsappId,
        processedMessage.body,
        ticket,
        contactPayload
      );
    }
  } catch (err) {
    Sentry.captureException(err);
    logger.error({
      info: "Error handling message",
      err,
      messagePayload,
      contactPayload,
      contextPayload,
      mediaPayload
    });
  }
};

export interface HistoryMessage {
  message: MessagePayload;
  // group messages only: the participant who sent it
  sender?: ContactPayload;
  // lazy, so media is only downloaded for messages not imported yet
  downloadMedia?: () => Promise<MediaPayload | undefined>;
}

export interface HistoryChat {
  whatsappId: number;
  contact: ContactPayload;
  // sorted oldest first
  messages: HistoryMessage[];
}

const toDate = (timestamp: number): Date =>
  new Date(timestamp < 1e12 ? timestamp * 1000 : timestamp);

// Saves old messages from the WhatsApp history sync. Unlike handleMessage it
// sends nothing (no greeting / queue options) and doesn't notify the panel:
// messages go to the contact's latest ticket, or to a new closed ticket.
export const importHistoryChat = async ({
  whatsappId,
  contact: contactPayload,
  messages
}: HistoryChat): Promise<number> => {
  const contact = await CreateOrUpdateContactService(contactPayload);

  let ticket = await Ticket.findOne({
    where: { contactId: contact.id, whatsappId },
    order: [["updatedAt", "DESC"]]
  });
  const ticketCreatedByImport = !ticket;

  const senders = new Map<string, Contact>();
  const getSender = async (sender: ContactPayload): Promise<Contact> => {
    const key = sender.number || sender.lid || "";
    const cached = senders.get(key);
    if (cached) return cached;

    const senderContact = await CreateOrUpdateContactService(sender);
    senders.set(key, senderContact);
    return senderContact;
  };

  let imported = 0;

  /* eslint-disable no-restricted-syntax, no-await-in-loop */
  for (const { message, sender, downloadMedia } of messages) {
    try {
      const alreadyImported = await Message.count({
        where: { id: message.id }
      });
      if (alreadyImported) continue;

      const date = toDate(message.timestamp);

      if (!ticket) {
        ticket = await Ticket.create(
          {
            contactId: contact.id,
            whatsappId,
            status: "closed",
            isGroup: contactPayload.isGroup,
            unreadMessages: 0,
            lastMessage: message.body,
            createdAt: date,
            updatedAt: date
          },
          { silent: true }
        );
      }

      let contactId: number | undefined;
      if (!message.fromMe) {
        contactId = sender ? (await getSender(sender)).id : contact.id;
      }

      const quotedMsgExists = message.quotedMsgId
        ? await Message.count({ where: { id: message.quotedMsgId } })
        : 0;

      const messageData: any = {
        id: message.id,
        ticketId: ticket.id,
        contactId,
        body: message.body,
        fromMe: message.fromMe,
        read: true,
        mediaType: message.type,
        quotedMsgId: quotedMsgExists ? message.quotedMsgId : undefined,
        ack: message.ack !== undefined ? message.ack : 0,
        createdAt: date,
        updatedAt: date
      };

      if (message.hasMedia && downloadMedia) {
        const mediaPayload = await downloadMedia();
        if (mediaPayload?.mimetype) {
          const filename = await saveMediaFile(mediaPayload);
          messageData.mediaUrl = filename;
          messageData.body = message.body || filename;
          const [mediaType] = mediaPayload.mimetype.split("/");
          messageData.mediaType = mediaType;
        }
      }

      await Message.create(messageData, { silent: true });

      if (ticketCreatedByImport && date >= ticket.updatedAt) {
        // instance.save() drops updatedAt when silent, the static update keeps it
        await Ticket.update(
          { lastMessage: messageData.body, updatedAt: date },
          { where: { id: ticket.id }, silent: true }
        );
        ticket.setDataValue("updatedAt", date);
      }

      imported += 1;
    } catch (err) {
      logger.error({
        info: "Error importing history message",
        err,
        messageId: message.id
      });
    }
  }
  /* eslint-enable no-restricted-syntax, no-await-in-loop */

  return imported;
};

// Reloads a message as the panel renders it and pushes it to the open chats
// and to the conversations list.
const emitMessageUpdate = async (messageId: string): Promise<void> => {
  const message = await Message.findByPk(messageId, {
    include: [
      "contact",
      {
        model: Message,
        as: "quotedMsg",
        include: ["contact"]
      }
    ]
  });
  if (!message) return;

  getIO()
    .to(message.ticketId.toString())
    .to("notification")
    .emit("appMessage", { action: "update", message });
};

// The sender edited the message on WhatsApp.
export const handleMessageEdit = async (
  messageId: string,
  body: string
): Promise<void> => {
  try {
    const message = await Message.findByPk(messageId);
    if (!message || !body) return;

    await message.update({ body, isEdited: true });
    await emitMessageUpdate(messageId);
  } catch (err) {
    logger.error({ info: "Error handling message edit", err, messageId });
  }
};

// The sender deleted the message for everyone on WhatsApp. The text is kept
// (marked as deleted) so the team still knows what was said.
export const handleMessageRevoke = async (messageId: string): Promise<void> => {
  try {
    const message = await Message.findByPk(messageId);
    if (!message || message.isDeleted) return;

    await message.update({ isDeleted: true });
    await emitMessageUpdate(messageId);
  } catch (err) {
    logger.error({ info: "Error handling message revoke", err, messageId });
  }
};

// Someone reacted to a message; an empty emoji removes their reaction.
export const handleMessageReaction = async (
  messageId: string,
  reaction: MessageReaction
): Promise<void> => {
  try {
    const message = await Message.findByPk(messageId);
    if (!message) return;

    const others = message.reactions.filter(
      r => !(r.fromMe === reaction.fromMe && r.jid === reaction.jid)
    );
    message.reactions = reaction.emoji ? [...others, reaction] : others;
    await message.save();

    await emitMessageUpdate(messageId);
  } catch (err) {
    logger.error({ info: "Error handling message reaction", err, messageId });
  }
};

export const handleMessageAck = async (
  messageId: string,
  ack: MessageAck
): Promise<void> => {
  await new Promise(r => setTimeout(r, 500));

  const io = getIO();

  try {
    const messageToUpdate = await Message.findByPk(messageId, {
      include: [
        "contact",
        {
          model: Message,
          as: "quotedMsg",
          include: ["contact"]
        }
      ]
    });

    // receipts can arrive out of order: never go back (e.g. read -> delivered)
    if (!messageToUpdate || ack <= messageToUpdate.ack) {
      return;
    }

    await messageToUpdate.update({ ack });

    // "notification" too: the conversations list shows the last message ticks
    io.to(messageToUpdate.ticketId.toString())
      .to("notification")
      .emit("appMessage", {
        action: "update",
        message: messageToUpdate
      });
  } catch (err) {
    Sentry.captureException(err);
    logger.error(`Error handling message ack: ${err}`);
  }
};
