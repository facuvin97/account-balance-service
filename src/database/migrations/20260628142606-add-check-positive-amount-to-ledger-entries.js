'use strict';

const CONSTRAINT_NAME = 'chk_ledger_entries_positive_amount';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addConstraint('ledger_entries', {
      fields: ['amount'],
      type: 'check',
      where: { amount: { [require('sequelize').Op.gt]: 0 } },
      name: CONSTRAINT_NAME,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('ledger_entries', CONSTRAINT_NAME);
  },
};
