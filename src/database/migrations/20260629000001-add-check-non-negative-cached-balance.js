'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE accounts
      ADD CONSTRAINT check_balance_non_negative
      CHECK (cached_balance >= 0);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE accounts
      DROP CONSTRAINT check_balance_non_negative;
    `);
  },
};
