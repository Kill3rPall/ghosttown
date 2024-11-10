import express from 'express';
import session from 'express-session';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();

// Constants for URLs
const FRONTEND_URL = 'https://ghosttown.up.railway.app';
const BACKEND_URL = 'https://ghosttown.up.railway.app';

// Enable CORS
app.use(cors({
    origin: BACKEND_URL,
    credentials: true
}));

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: true,
        sameSite: 'none'
    }
}));

// Discord OAuth2 configuration
const DISCORD_CLIENT_ID = '742443364091166793';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = `${BACKEND_URL}/auth/discord/callback`;

// Discord login route
app.get('/auth/discord', (req, res) => {
    console.log('Auth route hit');
    const params = new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: 'identify email'
    });

    const discordUrl = `https://discord.com/api/oauth2/authorize?${params}`;
    console.log('Redirecting to:', discordUrl);
    res.redirect(discordUrl);
});

// Discord callback route
app.get('/auth/discord/callback', async (req, res) => {
    const { code } = req.query;
    
    if (!code) {
        console.log('No code received');
        return res.redirect(`${FRONTEND_URL}?error=no_code`);
    }

    try {
        const params = new URLSearchParams({
            client_id: DISCORD_CLIENT_ID,
            client_secret: DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI
        });

        console.log('Exchanging code for token...');
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            body: params,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        if (!tokenResponse.ok) {
            const error = await tokenResponse.text();
            console.error('Token Error:', error);
            return res.redirect(`${FRONTEND_URL}?error=token_error`);
        }

        const tokens = await tokenResponse.json();
        console.log('Token received');

        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${tokens.access_token}`
            }
        });

        if (!userResponse.ok) {
            console.error('User Error:', await userResponse.text());
            return res.redirect(`${FRONTEND_URL}?error=user_error`);
        }

        const user = await userResponse.json();
        console.log('User data received:', user.username);

        req.session.user = user;
        await sendDiscordWebhook(user, req);
        
        res.redirect(`${FRONTEND_URL}/home.html`);
    } catch (error) {
        console.error('Auth Error:', error);
        res.redirect(`${FRONTEND_URL}?error=auth_failed`);
    }
});

// User info endpoint
app.get('/api/user', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    res.json(req.session.user);
});

// Logout endpoint
app.get('/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Test route
app.get('/', (req, res) => {
    res.send('Ghost Town Backend is running!');
});

// Webhook function
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
