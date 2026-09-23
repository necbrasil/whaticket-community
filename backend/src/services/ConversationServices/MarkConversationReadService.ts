import { Op } from "sequelize";
import { getIO } from "../../libs/socket";
import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";

const MarkConversationReadService = async (contactId: string): Promise<void> => {
  const tickets = await Ticket.findAll({
    where: { contactId },
    include: ["contact"]
  });
  if (tickets.length === 0) return;

  const unreadMessages = await Message.findAll({
    where: {
      ticketId: { [Op.in]: tickets.map(ticket => ticket.id) },
      fromMe: false,
      read: false
    },
    attributes: ["ticketId"],
    group: ["ticketId"]
  });
  const unreadTicketIds = new Set(unreadMessages.map(msg => msg.ticketId));

  await Promise.all(
    tickets
      .filter(ticket => unreadTicketIds.has(ticket.id))
      .map(ticket => SetTicketMessagesAsRead(ticket))
  );

  // clears the unread badge on every agent's conversation list
  getIO()
    .to("notification")
    .emit("conversation", { action: "read", contactId: Number(contactId) });
};

export default MarkConversationReadService;
