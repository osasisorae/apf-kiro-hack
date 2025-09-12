const { getSql, initDb } = require('../../lib/db');

module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Simple authentication check (in production, use proper auth)
  const { password } = req.query;
  if (password !== 'aurum2025') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Initialize database
    await initDb();
    const sql = getSql();

    // Get all waitlist entries
    const waitlistData = await sql`
      SELECT id, email, timestamp, source, ip, user_agent 
      FROM waitlist 
      ORDER BY timestamp DESC
    `;

    // Get total count
    const totalCount = await sql`SELECT COUNT(*) as count FROM waitlist`;

    return res.status(200).json({
      success: true,
      totalSignups: parseInt(totalCount[0]?.count) || 0,
      emails: waitlistData.map((item, index) => ({
        position: index + 1,
        id: item.id,
        email: item.email,
        timestamp: item.timestamp,
        source: item.source,
        ip: item.ip,
        userAgent: item.user_agent
      }))
    });

  } catch (error) {
    console.error('Admin error:', error);
    return res.status(500).json({ 
      error: 'Something went wrong.' 
    });
  }
}