import { QueryTypes } from "sequelize";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";

interface Request {
  searchParam?: string;
  pageNumber?: string;
}

interface ConversationRow {
  contactId: number;
  lastAt: Date;
  lastBody: string | null;
  lastFromMe: number | null;
  lastMediaType: string | null;
  unread: number;
}

export interface Conversation {
  contact: Contact;
  lastMessage: string;
  lastMessageFromMe: boolean;
  lastMediaType: string | null;
  updatedAt: Date;
  unread: number;
}

interface Response {
  conversations: Conversation[];
  count: number;
  hasMore: boolean;
}

// One entry per contact that has a ticket, ordered by its last message like
// WhatsApp (ticket status changes don't reorder). Unread is counted from the
// messages: Ticket.unreadMessages isn't kept up to date by every provider.
const ListConversationsService = async ({
  searchParam = "",
  pageNumber = "1"
}: Request): Promise<Response> => {
  const limit = 30;
  const offset = limit * (+pageNumber - 1);
  const search = searchParam.trim().toLowerCase();

  // columns are utf8mb4_bin (case sensitive), so compare lowercased
  const where = search
    ? "WHERE (LOWER(c.name) LIKE :like OR c.number LIKE :like)"
    : "";
  const replacements = { like: `%${search}%`, limit, offset };

  const { sequelize } = Ticket;
  if (!sequelize) throw new Error("Sequelize not initialized");

  const lastMessageOf = (column: string) =>
    `(SELECT m.${column} FROM Messages m JOIN Tickets t ON t.id = m.ticketId
       WHERE t.contactId = x.contactId ORDER BY m.createdAt DESC LIMIT 1)`;

  const rows = await sequelize.query<ConversationRow>(
    `SELECT x.contactId,
       COALESCE(${lastMessageOf("createdAt")}, x.lastUpdate) AS lastAt,
       ${lastMessageOf("body")} AS lastBody,
       ${lastMessageOf("fromMe")} AS lastFromMe,
       ${lastMessageOf("mediaType")} AS lastMediaType,
       (SELECT COUNT(*) FROM Messages m JOIN Tickets t ON t.id = m.ticketId
         WHERE t.contactId = x.contactId AND m.fromMe = 0 AND m.read = 0) AS unread
     FROM (SELECT contactId, MAX(updatedAt) AS lastUpdate FROM Tickets GROUP BY contactId) x
     JOIN Contacts c ON c.id = x.contactId
     ${where}
     ORDER BY lastAt DESC, x.contactId DESC
     LIMIT :limit OFFSET :offset`,
    { replacements, type: QueryTypes.SELECT }
  );

  const [{ count }] = await sequelize.query<{ count: number }>(
    `SELECT COUNT(DISTINCT t.contactId) AS count
     FROM Tickets t JOIN Contacts c ON c.id = t.contactId
     ${where}`,
    { replacements, type: QueryTypes.SELECT }
  );

  const contacts = await Contact.findAll({
    where: { id: rows.map(row => row.contactId) },
    attributes: ["id", "name", "number", "profilePicUrl", "isGroup"]
  });
  const contactsById = new Map(contacts.map(contact => [contact.id, contact]));

  const conversations: Conversation[] = [];
  rows.forEach(row => {
    const contact = contactsById.get(row.contactId);
    if (!contact) return;
    conversations.push({
      contact,
      lastMessage: row.lastBody || "",
      lastMessageFromMe: Boolean(row.lastFromMe),
      lastMediaType: row.lastMediaType,
      updatedAt: row.lastAt,
      unread: Number(row.unread)
    });
  });

  return {
    conversations,
    count: Number(count),
    hasMore: Number(count) > offset + rows.length
  };
};

export default ListConversationsService;
