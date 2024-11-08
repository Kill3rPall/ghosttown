import express from 'express';
import session from 'express-session';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();

// Enable CORS
app.use(cors({
    origin: 'https://kill3rpall.github.io',
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
const REDIRECT_URI = 'https://ghosttown.up.railway.app/auth/discord/callback';

// Test route to verify server is running
app.get('/', (req, res) => {
    res.send('Ghost Town Backend is running!');
});

// Discord login route - THIS IS THE IMPORTANT PART
app.get('/auth/discord', (req, res) => {
    console.log('Discord auth route hit');
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
        return res.redirect('https://kill3rpall.github.io/ghosttown?error=no_code');
    }

    try {
        const params = new URLSearchParams({
            client_id: DISCORD_CLIENT_ID,
            client_secret: DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code,
            redirect_uri: REDIRECT_URI
        });

        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            body: params,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        const tokens = await tokenResponse.json();

        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${tokens.access_token}`
            }
        });
        const user = await userResponse.json();

        req.session.user = user;
        await sendDiscordWebhook(user, req);
        
        res.redirect('https://kill3rpall.github.io/ghosttown/home.html');
    } catch (error) {
        console.error('Auth Error:', error);
        res.redirect('https://kill3rpall.github.io/ghosttown?error=auth_failed');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
