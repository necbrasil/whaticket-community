import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";

interface Request {
  contactId: string;
  pageNumber?: string;
}

interface Response {
  messages: Message[];
  contact: Contact;
  ticketIds: number[];
  count: number;
  hasMore: boolean;
}

// All messages of a contact, across every ticket, newest page first.
const ListConversationMessagesService = async ({
  contactId,
  pageNumber = "1"
}: Request): Promise<Response> => {
  const contact = await Contact.findByPk(contactId);
  if (!contact) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  const tickets = await Ticket.findAll({
    where: { contactId },
    attributes: ["id"]
  });
  const ticketIds = tickets.map(ticket => ticket.id);

  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: messages } = await Message.findAndCountAll({
    where: { ticketId: ticketIds },
    limit,
    include: [
      "contact",
      {
        model: Message,
        as: "quotedMsg",
        include: ["contact"]
      }
    ],
    offset,
    order: [["createdAt", "DESC"]]
  });

  return {
    messages: messages.reverse(),
    contact,
    ticketIds,
    count,
    hasMore: count > offset + messages.length
  };
};

export default ListConversationMessagesService;
