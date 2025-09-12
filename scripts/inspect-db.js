require("dotenv").config();
const { neon } = require("@neondatabase/serverless");

/**
 * A script to connect to the Neon DB using CommonJS (require) syntax,
 * list all tables in 'public', along with their columns and any indexes.
 */
(async () => {
  try {
    // Initialize Neon client
    const sql = neon(process.env.DATABASE_URL);

    // Get a list of tables in 'public' schema
    const tables = await sql`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `;

    if (!tables || tables.length === 0) {
      console.log("No tables found in the 'public' schema.");
      process.exit(0);
    }

    // For each table, list columns and indexes
    for (const { tablename } of tables) {
      console.log(`\n=== Table: ${tablename} ===`);

      // Retrieve columns
      const columns = await sql`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = ${tablename}
        ORDER BY ordinal_position;
      `;

      if (!columns || columns.length === 0) {
        console.log(`  No columns for table "${tablename}".`);
      } else {
        console.log("  Columns:");
        columns.forEach((col) => {
          const { column_name, data_type, is_nullable, column_default } = col;
          console.log(
            `    - ${column_name} [${data_type}] nullable=${is_nullable}, default=${column_default}`,
          );
        });
      }

      // Retrieve indexes
      const indexes = await sql`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = ${tablename}
        ORDER BY indexname;
      `;

      if (!indexes || indexes.length === 0) {
        console.log(`  No indexes for table "${tablename}".`);
      } else {
        console.log("  Indexes:");
        indexes.forEach((ix) => {
          console.log(`    - ${ix.indexname}: ${ix.indexdef}`);
        });
      }
    }

    process.exit(0);
  } catch (error) {
    console.error("Error inspecting the database:", error);
    process.exit(1);
  }
})();
