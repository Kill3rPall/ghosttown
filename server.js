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
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = `${process.env.BASE_URL}/auth/discord/callback`;

// Routes
app.get('/', (req, res) => {
    res.send('Ghost Town Backend is running!');
});

app.get('/auth/discord', (req, res) => {
    const params = new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: 'identify email'
    });
    res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

app.get('/auth/discord/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect('https://kill3rpall.github.io/ghosttown?error=no_code');

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
        
        // Send webhook
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
