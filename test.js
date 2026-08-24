const axios = require('axios');
const API_KEY = 'AQ.Ab8RN6LU-50G31Ui4QUBrvscX8Dl6gb2-8VAtlzbo16pIdTNzA';

async function testModel(modelName) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`;
    try {
        const response = await axios.post(url, {
            contents: [{ role: "user", parts: [{ text: "Hello" }] }]
        });
        console.log(`[SUCCESS] ${modelName} works!`);
    } catch (error) {
        console.log(`[ERROR] ${modelName} failed: ${error.response ? error.response.status : error.message}`);
    }
}

async function run() {
    await testModel('gemini-1.5-pro');
    await testModel('gemini-1.5-flash');
    await testModel('gemini-3.5-flash');
    await testModel('gemini-1.0-pro');
}

run();
