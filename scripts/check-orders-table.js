require('dotenv').config();
const { getSql } = require('../lib/db');

async function checkOrdersTable() {
  const sql = getSql();
  try {
    const rows = await sql`SELECT * FROM orders;`;
    console.log("Orders table row count:", rows.length);
    console.log(rows);
  } catch (error) {
    console.error("Error checking orders table:", error);
  } finally {
    sql.end();
  }
}

checkOrdersTable();
