const { getSql, initDb } = require('../lib/db');

module.exports = async function handler(req, res) {
    console.log('Waitlist API called:', {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body
    });

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        console.log('Handling OPTIONS request');
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        console.log('Invalid method:', req.method);
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log('Initializing database...');
        await initDb();
        const sql = getSql();
        console.log('Database initialized successfully');

        const { email } = req.body;

        // Validate email
        if (!email || !isValidEmail(email)) {
            return res.status(400).json({
                error: 'Please provide a valid email address'
            });
        }

        const cleanEmail = email.toLowerCase().trim();

        // Check if email already exists
        const existingUser = await sql`
            SELECT id FROM waitlist WHERE email = ${cleanEmail} LIMIT 1
        `;

        if (existingUser.length > 0) {
            return res.status(409).json({
                error: 'Email already registered'
            });
        }

        // Insert new user
        const newUser = await sql`
            INSERT INTO waitlist (email, source, ip, user_agent)
            VALUES (${cleanEmail}, 'landing_page', ${req.headers['x-forwarded-for'] || 'unknown'}, ${req.headers['user-agent'] || 'unknown'})
            RETURNING id, email, timestamp
        `;

        // Get total count for position
        const totalCount = await sql`SELECT COUNT(*) as count FROM waitlist`;
        console.log('Raw totalCount from DB:', totalCount);
        console.log('First item:', totalCount[0]);
        console.log('Count value:', totalCount[0]?.count);
        
        const position = parseInt(totalCount[0]?.count) || 1;
        console.log('Final position:', position);

        // Log success
        console.log('New waitlist signup:', {
            email: cleanEmail,
            position: position,
            ip: req.headers['x-forwarded-for'] || 'unknown'
        });

        // Send welcome email notification
        try {
            await sendWelcomeEmail(cleanEmail);
        } catch (emailError) {
            console.error('Email sending failed:', emailError);
            // Don't fail the request if email fails
        }

        const response = {
            success: true,
            message: 'Successfully joined the waitlist!',
            position: position,
            id: newUser[0]?.id
        };

        console.log('API Response being sent:', response);
        return res.status(200).json(response);

    } catch (error) {
        console.error('Waitlist error:', error);
        
        // Handle unique constraint violation
        if (error.message && error.message.includes('unique')) {
            return res.status(409).json({
                error: 'Email already registered'
            });
        }

        return res.status(500).json({
            error: 'Something went wrong. Please try again.'
        });
    }
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

async function sendWelcomeEmail(email) {
    // We'll implement this with Resend or similar service
    // For now, just log it
    console.log(`Welcome email would be sent to: ${email}`);

    // TODO: Implement actual email sending
    // const response = await fetch('https://api.resend.com/emails', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     from: 'Aurum Prop Firm <noreply@aurumpropfirm.com>',
    //     to: email,
    //     subject: 'Welcome to Aurum Prop Firm - You\'re on the list!',
    //     html: getWelcomeEmailTemplate()
    //   })
    // });
}