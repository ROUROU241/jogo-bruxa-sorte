const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');

// ================== COLOQUE SEU NÚMERO ABAIXO ==================
const DONO = '11920951833'; // EXEMPLO: 5511988887777
const CUSTO_GIRO = 5;
const SALDO_INICIAL = 100;

const PREMIOS = {
  '🧙‍♀️': 250,
  '🔮': 100,
  '✨': 50,
  '🍄': 25,
  '🦇': 15,
  '🕯️': 10
};
const SIMBOLOS = Object.keys(PREMIOS);

let NIVEL = 'normal';
const CHANCES = { facil: 0.40, normal: 0.12, dificil: 0.03 };
const saldos = {};

function getSaldo(usuario) {
  if (!saldos[usuario]) saldos[usuario] = SALDO_INICIAL;
  return saldos[usuario];
}

function girarRolo() {
  return Array(3).fill(0).map(() => SIMBOLOS[Math.floor(Math.random() * SIMBOLOS.length)]);
}

function verificarGanho(rolo) {
  return rolo[0] === rolo[1] && rolo[1] === rolo[2] ? rolo[0] : null;
}

async function iniciarBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, qr } = update;
    if (qr) qrcode.generate(qr, { small: true });
    if (connection === 'close') {
      if (update.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
        iniciarBot();
      }
    }
    if (connection === 'open') {
      console.log('✅ JOGO LIGADO! 🎰');
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;
    
    const texto = msg.message.conversation || msg.message.extendedTextMessage?.text;
    if (!texto) return;
    
    const remetente = msg.key.remoteJid;
    const ehDono = remetente.replace('@s.whatsapp.net', '') === DONO;

    if (texto.trim() === '/girar') {
      const saldo = getSaldo(remetente);
      if (saldo < CUSTO_GIRO) {
        await sock.sendMessage(remetente, { text: `⚠️ Saldo insuficiente! Você tem ${saldo} 💰` });
        return;
      }
      saldos[remetente] -= CUSTO_GIRO;
      const rolo = girarRolo();
      const ganha = Math.random() < CHANCES[NIVEL];
      const premio = ganha ? verificarGanho([rolo[0], rolo[0], rolo[0]]) : null;

      if (!premio) {
        await sock.sendMessage(remetente, { text:
          `🎰 Girando...\n│ ${rolo[0]} │ ${rolo[1]} │ ${rolo[2]} │\n😅 Não foi dessa vez!\nSaldo: ${saldos[remetente]} 💰`
        });
      } else {
        saldos[remetente] += PREMIOS[premio];
        await sock.sendMessage(remetente, { text:
          `🏆 PARABÉNS! ${premio}${premio}${premio}\nGanhou ${PREMIOS[premio]} 💰!\nSaldo: ${saldos[remetente]} 💰 ✅`
        });
      }
      return;
    }

    if (texto.trim() === '/saldo') {
      await sock.sendMessage(remetente, { text: `💼 Seu saldo: ${getSaldo(remetente)} 💰` });
      return;
    }

    if (texto.startsWith('/add ')) {
      if (!ehDono) { await sock.sendMessage(remetente, { text: '🚫 Só o dono! 🔒' }); return; }
      const [_, usuario, valor] = texto.split(' ');
      if (!usuario || !valor) return;
      const id = usuario.replace('@', '');
      saldos[id + '@s.whatsapp.net'] = (saldos[id + '@s.whatsapp.net'] || 0) + Number(valor);
      await sock.sendMessage(remetente, { text: `✅ Adicionado! ${usuario}: ${saldos[id + '@s.whatsapp.net']} 💰` });
      return;
    }

    if (texto.startsWith('/modo ')) {
      if (!ehDono) return;
      const modo = texto.split(' ')[1];
      if (!['facil','normal','dificil'].includes(modo)) return;
      NIVEL = modo;
      await sock.sendMessage(remetente, { text: `✅ Modo ${modo} ativado!` });
      return;
    }
  });
}

iniciarBot().catch(err => console.error(err));
