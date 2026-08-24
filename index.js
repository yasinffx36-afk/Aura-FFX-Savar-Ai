const express = require('express');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

const isBotMode = !!process.env.BOT_TOKEN; 

if (isBotMode) {
    const TelegramBot = require('node-telegram-bot-api');
    
    const BOT_TOKEN = process.env.BOT_TOKEN;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const BOT_NAME = process.env.BOT_NAME || "YASIN";
    const GEMINI_MODEL = 'gemini-3.5-flash';

    const bot = new TelegramBot(BOT_TOKEN, { polling: true });

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
            return `API Error: No response candidates found.`;
        } catch (error) {
            return `API Error: ${error.response ? (error.response.data.error?.message || error.response.status) : error.message}`;
        }
    }

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
            // silent catch
        }
    });

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
            // silent catch
        }
    });
}

app.get('/', (req, res) => {
    if (isBotMode) {
        res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Status</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
                body { background-color: #030407; font-family: 'Inter', sans-serif; color: white; }
                .glow { box-shadow: 0 0 30px rgba(74, 222, 128, 0.15); }
            </style>
        </head>
        <body class="min-h-screen flex items-center justify-center p-4">
            <div class="bg-[#0b0d18] border border-white/5 p-10 rounded-2xl max-w-md w-full text-center glow relative overflow-hidden">
                <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-emerald-600"></div>
                <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/10 mb-6 relative">
                    <div class="w-6 h-6 rounded-full bg-green-400 animate-ping absolute"></div>
                    <div class="w-6 h-6 rounded-full bg-green-500 relative z-10"></div>
                </div>
                <h1 class="text-3xl font-bold mb-3 tracking-tight text-white/90">Bot is Active</h1>
                <p class="text-gray-400 text-sm leading-relaxed">System is running optimally.</p>
            </div>
        </body>
        </html>
        `);
    } else {
        res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Status</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
                body { background-color: #030407; font-family: 'Inter', sans-serif; color: white; }
                .glow { box-shadow: 0 0 30px rgba(74, 222, 128, 0.15); }
            </style>
        </head>
        <body class="min-h-screen flex items-center justify-center p-4">
            <div class="bg-[#0b0d18] border border-white/5 p-10 rounded-2xl max-w-md w-full text-center glow relative overflow-hidden">
                <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-green-600"></div>
                <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/10 mb-6 relative">
                    <div class="w-6 h-6 rounded-full bg-green-400 animate-ping absolute"></div>
                    <div class="w-6 h-6 rounded-full bg-green-500 relative z-10"></div>
                </div>
                <h1 class="text-3xl font-bold mb-3 tracking-tight text-white/90">Online</h1>
                <p class="text-gray-400 text-sm leading-relaxed">System is running optimally.</p>
            </div>
        </body>
        </html>
        `);
    }
});

const jobQueue = [];
const jobs = {};
let activeDeployments = 0;
const MAX_CONCURRENT_DEPLOYMENTS = 10;

setInterval(async () => {
    if (jobQueue.length > 0 && activeDeployments < MAX_CONCURRENT_DEPLOYMENTS) {
        const jobId = jobQueue.shift();
        if (jobs[jobId] && jobs[jobId].status === 'queued') {
            processJob(jobId);
        }
    }
    
    jobQueue.forEach((id, index) => {
        if (jobs[id] && jobs[id].status === 'queued') {
            jobs[id].position = index + 1;
        }
    });
}, 1000);

async function processJob(jobId) {
    activeDeployments++;
    const job = jobs[jobId];
    job.status = 'processing';

    const { botName, botUsername, telegramKey, geminiKey, renderKey, githubRepo } = job.data;

    try {
        const ownersRes = await axios.get('https://api.render.com/v1/owners', {
            headers: { 'Authorization': `Bearer ${renderKey}` }
        });
        const ownerId = ownersRes.data[0].owner.id;

        const payload = {
            ownerId: ownerId,
            type: "web_service",
            name: botUsername.toLowerCase().replace(/[^a-z0-9-]/g, ''),
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

        let response;
        let suffixSeq = ['3', '6', '3', '6', '3', '6', '3', '6'];
        let suffixIndex = 0;
        let success = false;
        let lastError;

        for (let i = 0; i <= suffixSeq.length; i++) {
            try {
                response = await axios.post('https://api.render.com/v1/services', payload, {
                    headers: {
                        'Authorization': `Bearer ${renderKey}`,
                        'Content-Type': 'application/json'
                    }
                });
                success = true;
                break;
            } catch (error) {
                lastError = error;
                if (error.response && error.response.status === 400 && i < suffixSeq.length) {
                    payload.name += suffixSeq[suffixIndex];
                    suffixIndex++;
                } else {
                    break;
                }
            }
        }

        if (!success) {
            throw lastError;
        }

        job.status = 'completed';
        job.service = { name: response.data.service.name, url: response.data.service.serviceDetails.url };
    } catch (error) {
        job.status = 'failed';
        job.error = error.response ? (error.response.data.message || JSON.stringify(error.response.data)) : error.message;
    } finally {
        activeDeployments--;
    }
}

app.post('/deploy', (req, res) => {
    const botName = req.body.botName?.trim();
    const botUsername = req.body.botUsername?.trim();
    const telegramKey = req.body.telegramKey?.trim();
    const geminiKey = req.body.geminiKey?.trim();
    const renderKey = req.body.renderKey?.trim();
    const githubRepo = 'https://github.com/yasinffx36-afk/Aura-FFX-Savar-Ai.git';
    
    if (!botName || !botUsername || !telegramKey || !geminiKey || !renderKey) {
        return res.status(400).json({ error: "Invalid parameters" });
    }

    const jobId = Date.now().toString() + Math.random().toString(36).substring(2);
    
    jobs[jobId] = {
        id: jobId,
        status: 'queued',
        position: jobQueue.length + 1,
        data: { botName, botUsername, telegramKey, geminiKey, renderKey, githubRepo }
    };
    
    jobQueue.push(jobId);
    
    res.json({ jobId, position: jobs[jobId].position });
});

app.get('/status/:jobId', (req, res) => {
    const job = jobs[req.params.jobId];
    if (!job) {
        return res.status(404).json({ error: "Not found" });
    }
    res.json({
        id: job.id,
        status: job.status,
        position: job.position,
        service: job.service,
        error: job.error
    });
});

app.listen(port);
