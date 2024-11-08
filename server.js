const express = require('express');
const session = require('express-session');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Discord OAuth2 configuration
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = `${process.env.BASE_URL}/auth/discord/callback`;

// Serve static files
app.use(express.static('public'));

// Discord login route
app.get('/auth/discord', (req, res) => {
    const params = new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: 'identify email'
    });
    res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

// Discord callback route
app.get('/auth/discord/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect('/?error=no_code');

    try {
        // Exchange code for access token
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            body: new URLSearchParams({
                client_id: DISCORD_CLIENT_ID,
                client_secret: DISCORD_CLIENT_SECRET,
                code,
                grant_type: 'authorization_code',
                redirect_uri: REDIRECT_URI,
                scope: 'identify email',
            }),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        const tokens = await tokenResponse.json();

        // Get user data
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        });

        const user = await userResponse.json();
        req.session.user = user;
        
        res.redirect('/home.html');
    } catch (error) {
        console.error('Auth Error:', error);
        res.redirect('/?error=auth_failed');
    }
});

// User data API endpoint
app.get('/api/user', (req, res) => {
    if (req.session.user) {
        res.json(req.session.user);
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

// Logout route
app.get('/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if(err) {
            console.error('Logout error:', err);
            return res.redirect('/home.html');
        }
        res.redirect('/index.html'); // Redirect to index.html after logout
    });
});



// Your existing middleware setup
app.use(express.static('public'));
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Add webhook function
async function sendDiscordWebhook(user, req) {
    try {
        const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
        
        const embed = {
            title: '👤 تسجيل دخول جديد',
            color: 0xff4500,
            fields: [
                {
                    name: 'اسم المستخدم',
                    value: user.username,
                    inline: true
                },
                {
                    name: 'معرف المستخدم',
                    value: user.id,
                    inline: true
                },
                {
                    name: 'IP العنوان',
                    value: req.ip,
                    inline: true
                },
                {
                    name: 'المتصفح',
                    value: req.headers['user-agent'],
                    inline: false
                }
            ],
            thumbnail: {
                url: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
            },
            timestamp: new Date(),
            footer: {
                text: 'Ghost Town Login System'
            }
        };

        await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ embeds: [embed] })
        });
    } catch (error) {
        console.error('Webhook Error:', error);
    }
}

// Add this middleware function
function requireAuth(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    next();
}

// Apply the middleware to protected routes
app.get('/api/protected/*', requireAuth);

// Add a route to check auth status
app.get('/api/auth/status', (req, res) => {
    if (req.session.user) {
        res.json({ authenticated: true, user: req.session.user });
    } else {
        res.json({ authenticated: false });
    }
});

// Modify your existing auth callback route
app.get('/auth/discord/callback', async (req, res) => {
    try {
        // Your existing authentication logic...
        
        // After successful authentication, send webhook
        await sendDiscordWebhook(user, req);
        
        // Continue with your existing response...
    } catch (error) {
        console.error('Auth Error:', error);
        res.redirect('/');
    }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
