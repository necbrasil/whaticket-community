import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Messages", "isEdited", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    // JSON list of { emoji, jid, fromMe }
    await queryInterface.addColumn("Messages", "reactions", {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Messages", "reactions");
    await queryInterface.removeColumn("Messages", "isEdited");
  }
};
