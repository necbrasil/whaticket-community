import Message from "../models/Message";
import Ticket from "../models/Ticket";
import IsGroupNumber from "./IsGroupNumber";

const SerializeWbotMsgId = (ticket: Ticket, message: Message): string => {
  const serializedMsgId = `${message.fromMe}_${ticket.contact.number}@${
    ticket.isGroup || IsGroupNumber(ticket.contact.number) ? "g" : "c"
  }.us_${message.id}`;

  return serializedMsgId;
};

export default SerializeWbotMsgId;
