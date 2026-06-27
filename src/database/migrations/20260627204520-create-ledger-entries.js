'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      "CREATE TYPE enum_ledger_entry_type AS ENUM ('deposit', 'withdrawal', 'transfer_in', 'transfer_out');"
    );

    await queryInterface.createTable('ledger_entries', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
      },
      account_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'accounts', key: 'id' },
        onDelete: 'RESTRICT',
      },
      amount: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false,
      },
      type: {
        type: 'enum_ledger_entry_type',
        allowNull: false,
      },
      related_transfer_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'transfers', key: 'id' },
        onDelete: 'RESTRICT',
      },
      idempotency_key: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.addIndex('ledger_entries', ['account_id', 'created_at']);
    await queryInterface.addIndex('ledger_entries', ['idempotency_key']);
    await queryInterface.addIndex('ledger_entries', ['related_transfer_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ledger_entries');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_ledger_entry_type;');
  },
};
