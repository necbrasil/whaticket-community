import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // base64 of the WhatsApp messageSecret, needed to decrypt later edits of
    // the message
    await queryInterface.addColumn("Messages", "messageSecret", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Messages", "messageSecret");
  }
};
