import { differenceInMinutes } from "date-fns";
import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import { whatsappProvider } from "../../providers/WhatsApp";
import GetContactChatId from "../../helpers/GetContactChatId";
import { handleMessageEdit } from "../../handlers/handleWhatsappEvents";

// WhatsApp rejects edits older than this
const EDIT_WINDOW_MINUTES = 15;

const EditWhatsAppMessage = async (
  messageId: string,
  body: string
): Promise<void> => {
  const text = (body || "").trim();
  if (!text) {
    throw new AppError("ERR_EDIT_EMPTY_MESSAGE");
  }

  const message = await Message.findByPk(messageId, {
    include: [
      {
        model: Ticket,
        as: "ticket",
        include: ["contact"]
      }
    ]
  });

  if (!message) {
    throw new AppError("No message found with this ID.", 404);
  }

  if (!message.fromMe || message.isDeleted || message.mediaType !== "chat") {
    throw new AppError("ERR_EDIT_NOT_ALLOWED");
  }

  if (
    differenceInMinutes(new Date(), new Date(message.createdAt)) >=
    EDIT_WINDOW_MINUTES
  ) {
    throw new AppError("ERR_EDIT_WINDOW_EXPIRED");
  }

  const { ticket } = message;

  try {
    await whatsappProvider.editMessage(
      ticket.whatsappId,
      GetContactChatId(ticket.contact, ticket.isGroup),
      message.id,
      text
    );
  } catch (err) {
    throw new AppError("ERR_EDITING_WAPP_MSG");
  }

  // updates the panel right away; WhatsApp's echo of the edit is idempotent
  await handleMessageEdit(message.id, text);
};

export default EditWhatsAppMessage;
