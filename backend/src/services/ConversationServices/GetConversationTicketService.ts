import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";

// The ticket messages sent from the conversations page go to: the contact's
// latest open/pending ticket, or a new open one without an owner.
const GetConversationTicketService = async (
  contactId: string,
  userId: number
): Promise<Ticket> => {
  const contact = await Contact.findByPk(contactId);
  if (!contact) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  const current = await Ticket.findOne({
    where: {
      contactId,
      status: { [Op.or]: ["open", "pending"] },
      // tickets of a deleted connection have no whatsappId and can't send
      whatsappId: { [Op.gt]: 0 }
    },
    order: [["updatedAt", "DESC"]]
  });
  if (current) return current;

  const whatsapp = await GetDefaultWhatsApp(userId);

  return Ticket.create({
    contactId: contact.id,
    status: "open",
    isGroup: contact.isGroup,
    unreadMessages: 0,
    whatsappId: whatsapp.id
  });
};

export default GetConversationTicketService;
