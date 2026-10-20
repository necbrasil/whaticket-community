import Contact from "../../../models/Contact";
import ContactCustomField from "../../../models/ContactCustomField";
import Message from "../../../models/Message";
import Ticket from "../../../models/Ticket";
import CreateOrUpdateContactService from "../../../services/ContactServices/CreateOrUpdateContactService";
import LinkContactLidService from "../../../services/ContactServices/LinkContactLidService";

// The models and the database are mocked: these tests cover the service logic
// only, they do not need (or touch) a real database.
jest.mock("../../../database", () => ({
  __esModule: true,
  default: { transaction: jest.fn(async (fn: any) => fn("transaction")) }
}));
jest.mock("../../../libs/socket", () => ({
  getIO: () => ({ emit: jest.fn() })
}));
jest.mock("../../../utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));
jest.mock("../../../models/Contact", () => ({
  __esModule: true,
  default: { findOne: jest.fn(), findAll: jest.fn(), create: jest.fn() }
}));
jest.mock("../../../models/Ticket", () => ({
  __esModule: true,
  default: { update: jest.fn() }
}));
jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: { update: jest.fn() }
}));
jest.mock("../../../models/ContactCustomField", () => ({
  __esModule: true,
  default: { update: jest.fn() }
}));

const fakeContact = (data: Record<string, unknown>): any => {
  const contact: any = { ...data };
  contact.update = jest.fn(async (values: Record<string, unknown>) => {
    Object.assign(contact, values);
    return contact;
  });
  contact.destroy = jest.fn();
  return contact;
};

const mockFindOne = (contacts: any[]) => {
  (Contact.findOne as jest.Mock).mockImplementation(
    async ({ where }: any) =>
      contacts.find(c => Object.keys(where).every(k => c[k] === where[k])) ||
      null
  );
};

describe("CreateOrUpdateContactService", () => {
  it("keeps the phone when a LID-only message arrives for a known contact", async () => {
    const contact = fakeContact({
      id: 1,
      name: "Maria",
      number: "5511999990000",
      lid: "123@lid"
    });
    mockFindOne([contact]);

    await CreateOrUpdateContactService({
      name: "123",
      number: "123",
      lid: "123@lid",
      isGroup: false
    });

    expect(contact.number).toBe("5511999990000");
    expect(contact.name).toBe("Maria");
    expect(Contact.create).not.toHaveBeenCalled();
  });

  it("creates a LID-only contact for an unknown lid", async () => {
    mockFindOne([]);
    (Contact.create as jest.Mock).mockImplementation(async v => v);

    await CreateOrUpdateContactService({
      name: "Joao",
      number: "456",
      lid: "456@lid",
      isGroup: false
    });

    expect(Contact.create).toHaveBeenCalledWith(
      expect.objectContaining({ number: "456", lid: "456@lid" })
    );
  });

  it("merges a LID-only contact into the phone contact, moving its data", async () => {
    const byNumber = fakeContact({
      id: 1,
      name: "Maria",
      number: "5511999990000"
    });
    const byLid = fakeContact({
      id: 2,
      name: "789",
      number: "789",
      lid: "789@lid"
    });
    mockFindOne([byNumber, byLid]);

    await CreateOrUpdateContactService({
      name: "Maria",
      number: "5511999990000",
      lid: "789:12@lid",
      isGroup: false
    });

    [Ticket, Message, ContactCustomField].forEach(model =>
      expect(model.update).toHaveBeenCalledWith(
        { contactId: 1 },
        expect.objectContaining({ where: { contactId: 2 } })
      )
    );
    expect(byLid.destroy).toHaveBeenCalled();
    expect(byNumber.lid).toBe("789@lid");
    expect(byNumber.number).toBe("5511999990000");
  });

  it("replaces a digits-only name with the real one", async () => {
    const contact = fakeContact({
      id: 3,
      name: "789",
      number: "789",
      lid: "789@lid"
    });
    mockFindOne([contact]);

    await CreateOrUpdateContactService({
      name: "Joao",
      number: "5511888880000",
      lid: "789@lid",
      isGroup: false
    });

    expect(contact.name).toBe("Joao");
    expect(contact.number).toBe("5511888880000");
  });
});

describe("LinkContactLidService", () => {
  it("does not create anything when neither number nor lid is known", async () => {
    (Contact.findAll as jest.Mock).mockResolvedValue([]);

    await LinkContactLidService({ number: "5511999990000", lid: "123@lid" });

    expect(Contact.create).not.toHaveBeenCalled();
    expect(Contact.findAll).toHaveBeenCalled();
  });

  it("gives a LID-only contact its phone", async () => {
    const contact = fakeContact({
      id: 4,
      name: "789",
      number: "789",
      lid: "789@lid"
    });
    (Contact.findAll as jest.Mock).mockResolvedValue([contact]);

    await LinkContactLidService({ number: "5511999990000", lid: "789@lid" });

    expect(contact.number).toBe("5511999990000");
    expect(contact.lid).toBe("789@lid");
  });
});
