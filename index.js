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
            return "Error";
        } catch (error) {
            console.error("Gemini API Error:", error.message);
            return "Error";
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

// ==========================================
// CONTROL SERVER / BOT GENERATOR DASHBOARD
// ==========================================

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
    </style>
</head>
<body class="min-h-screen flex flex-col items-center justify-center p-4">
    <div class="bg-[#0b0d18] border border-white/10 p-8 rounded-2xl w-full max-w-lg shadow-2xl relative overflow-hidden">
        <div class="absolute inset-0 bg-gradient-to-b from-blue-500/10 to-transparent pointer-events-none"></div>
        <h1 class="text-3xl font-bold mb-2 text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent relative z-10">Bot Generator</h1>
        <p class="text-[#8a8a8f] text-sm text-center mb-6 relative z-10">Deploy a new AI Telegram Bot instantly on Render</p>
        
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

            <div>
                <label class="block text-sm font-medium text-gray-300 mb-1">GitHub Repo URL</label>
                <input type="url" name="githubRepo" required placeholder="https://github.com/YourName/YourRepo" class="w-full bg-[#161824] border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors shadow-inner">
            </div>

            <button type="submit" class="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-3 px-4 rounded-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] mt-4 shadow-lg">
                Deploy Bot 🚀
            </button>
        </form>
    </div>
</body>
</html>
`;

app.get('/', (req, res) => {
    // ওয়েব ব্রাউজারে ফর্ম দেখানো হবে
    res.send(HTML_TEMPLATE);
});

app.post('/deploy', async (req, res) => {
    const { botName, telegramKey, geminiKey, renderKey, githubRepo } = req.body;
    
    if (!botName || !telegramKey || !geminiKey || !renderKey || !githubRepo) {
        return res.status(400).send("<h2 style='color:white; text-align:center;'>All fields are required! <a href='/' style='color:#3b82f6;'>Go Back</a></h2>");
    }

    try {
        // ১. Render API থেকে User/Owner ID নেওয়া
        const ownersRes = await axios.get('https://api.render.com/v1/owners', {
            headers: { 'Authorization': \`Bearer \${renderKey}\` }
        });
        const ownerId = ownersRes.data[0].owner.id;

        // ২. নতুন Web Service তৈরির পে-লোড
        const payload = {
            ownerId: ownerId,
            type: "web_service",
            name: \`\${botName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-bot\`,
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

        // ৩. Render API তে কল করে নতুন সার্ভার তৈরি
        const response = await axios.post('https://api.render.com/v1/services', payload, {
            headers: {
                'Authorization': \`Bearer \${renderKey}\`,
                'Content-Type': 'application/json'
            }
        });

        res.send(\`
            <div style="background-color: #030407; color: white; font-family: sans-serif; text-align: center; padding-top: 50px; min-height: 100vh;">
                <h1 style="color: #4ade80; font-size: 2rem;">✅ Deployment Successful!</h1>
                <p style="margin-top:20px; color:#8a8a8f;">Your bot <strong>\${botName}</strong> is being deployed on Render.</p>
                <div style="background: #0b0d18; border: 1px solid #333; padding: 20px; border-radius: 10px; max-width: 500px; margin: 20px auto;">
                    <p><strong>Service Name:</strong> \${response.data.name}</p>
                    <p><strong>Service URL:</strong> <a href="\${response.data.serviceDetails.url}" style="color: #60a5fa; text-decoration: none;">\${response.data.serviceDetails.url}</a></p>
                </div>
                <p style="color: #fca5a5;">Please wait 2-3 minutes for Render to finish building the server.</p>
                <a href="/" style="display: inline-block; margin-top: 30px; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px; font-weight:bold;">Back to Dashboard</a>
            </div>
        \`);
        
    } catch (error) {
        console.error("Deploy Error:", error.response ? error.response.data : error.message);
        res.status(500).send(\`
            <div style="background-color: #030407; color: white; font-family: sans-serif; text-align: center; padding-top: 50px; min-height: 100vh;">
                <h1 style="color: #f87171; font-size: 2rem;">❌ Deployment Failed!</h1>
                <div style="background: #0b0d18; border: 1px solid #f87171; color: #fca5a5; padding: 20px; border-radius: 10px; max-width: 600px; margin: 20px auto; text-align:left; overflow:auto;">
                    <code>\${error.response ? JSON.stringify(error.response.data, null, 2) : error.message}</code>
                </div>
                <a href="/" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px; font-weight:bold;">Go Back</a>
            </div>
        \`);
    }
});

app.listen(port, () => {
    console.log(\`Web Server running on port \${port}\`);
});
