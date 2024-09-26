const { default: makeWASocket, DisconnectReason, useSingleFileAuthState } = require('@adiwajshing/baileys');
const { state, saveState } = useSingleFileAuthState('./auth_info_multi.json');
const pino = require('pino');
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

const startSock = () => {
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
            if (shouldReconnect) {
                startSock();
            }
        } else if (connection === 'open') {
            console.log('opened connection');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const message = messages[0];
            if (!message.message) return;
            if (message.key && message.key.remoteJid == 'status@broadcast') return;
            if (message.message.conversation.startsWith('.ss ')) {
                const url = message.message.conversation.substring(4);
                const response = await fetch(`https://${process.env.VERCEL_URL}/api/screenshot?url=${encodeURIComponent(url)}`);
                const buffer = await response.arrayBuffer();
                await sock.sendMessage(message.key.remoteJid, { image: Buffer.from(buffer), caption: 'Screenshot dari ' + url });
            }
        } catch (error) {
            console.error(error);
        }
    });


    sock.ev.on('creds.update', saveState);

    return sock;
}

startSock();

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
