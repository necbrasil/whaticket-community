import { Op } from "sequelize";
import Contact from "../models/Contact";

// Names saved in our contacts, by the user part of a number or LID jid
const GetSavedContactNames = async (
  users: string[]
): Promise<Map<string, string>> => {
  const names = new Map<string, string>();
  if (users.length === 0) return names;

  const contacts = await Contact.findAll({
    where: {
      isGroup: false,
      [Op.or]: [
        { number: { [Op.in]: users } },
        { lid: { [Op.in]: users.map(user => `${user}@lid`) } }
      ]
    }
  });

  contacts.forEach(contact => {
    if (!contact.name || contact.name === contact.number) return;
    names.set(contact.number, contact.name);
    if (contact.lid) names.set(contact.lid.split("@")[0], contact.name);
  });

  return names;
};

export default GetSavedContactNames;
