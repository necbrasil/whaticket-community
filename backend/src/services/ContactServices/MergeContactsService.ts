import sequelize from "../../database";
import Contact from "../../models/Contact";
import ContactCustomField from "../../models/ContactCustomField";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import { logger } from "../../utils/logger";

// Folds `secondary` into `primary`. The FKs to contacts cascade, so everything
// pointing at the secondary is moved before it is destroyed; `changes` are
// applied to the primary afterwards (the secondary's unique lid is released by then).
const MergeContactsService = async (
  primary: Contact,
  secondary: Contact,
  changes: Partial<Contact> = {}
): Promise<void> => {
  await sequelize.transaction(async transaction => {
    const options = { where: { contactId: secondary.id }, transaction };

    await Ticket.update({ contactId: primary.id }, options);
    await Message.update({ contactId: primary.id }, options);
    await ContactCustomField.update({ contactId: primary.id }, options);

    await secondary.destroy({ transaction });
    await primary.update(changes, { transaction });
  });

  logger.info({
    info: "Merged contacts by number and lid",
    primaryContactId: primary.id,
    mergedContactId: secondary.id
  });
};

export default MergeContactsService;
