require('dotenv').config();
const express = require('express');
const http = require('http');
const crypto = require('crypto');
const { Server } = require('socket.io');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true }, maxHttpBufferSize: 1e5 });
const PORT = process.env.PORT || 3000;
const HOST_PASSWORD = process.env.HOST_PASSWORD || 'altera-esta-palavra-passe';
const rooms = new Map();
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (_req, res) =>
  res.sendFile(path.join(__dirname, 'index.html'))
);

app.get('/index.html', (_req, res) =>
  res.sendFile(path.join(__dirname, 'index.html'))
);

app.get('/style.css', (_req, res) =>
  res.sendFile(path.join(__dirname, 'style.css'))
);

app.get('/app.js', (_req, res) =>
  res.sendFile(path.join(__dirname, 'app.js'))
);
app.get('/health', (_req,res) => res.json({ok:true}));
app.get('/config', (_req,res) => res.json({ iceServers: [ { urls: 'stun:stun.l.google.com:19302' }, ...(process.env.TURN_URL ? [{urls:process.env.TURN_URL, username:process.env.TURN_USERNAME || '', credential:process.env.TURN_CREDENTIAL || ''}] : []) ] }));
const code = () => crypto.randomBytes(4).toString('base64url').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
function makeCard(mode) {
  if (mode === 90) {
    const nums = Array.from({length:90},(_,i)=>i+1).sort(()=>Math.random()-.5).slice(0,15).sort((a,b)=>a-b);
    return nums;
  }
  const ranges = [[1,15],[16,30],[31,45],[46,60],[61,75]];
  return ranges.map(([lo,hi])=>Array.from({length:hi-lo+1},(_,i)=>lo+i).sort(()=>Math.random()-.5).slice(0,5).sort((a,b)=>a-b));
}
function publicState(room) {
  return { code:room.code, mode:room.mode, pattern:room.pattern, drawn:room.drawn, last:room.drawn.at(-1)||null, players:[...room.players.values()].map(p=>({id:p.id,name:p.name,host:p.host,card:p.card,marked:p.marked,wins:p.wins})), started:room.started, automatic:room.automatic };
}
function emitState(room) { io.to(room.code).emit('state', publicState(room)); }
function sys(room, text) { io.to(room.code).emit('system', {text, time:new Date().toISOString()}); }
function roomFor(socket) { const code=socket.data.room; return code && rooms.get(code); }
function balls(room) { return Array.from({length:room.mode},(_,i)=>i+1); }
function validWin(p, room) {
  const marked = new Set(p.marked.filter(n=>room.drawn.includes(n)));
  if (room.pattern==='full') return p.card.flat ? p.card.flat().every(n=>marked.has(n)) : p.card.every(n=>marked.has(n));
  if (room.mode===90) return p.card.filter(n=>marked.has(n)).length >= (room.pattern==='line'?5:5);
  const card=p.card;
  const lines=[...card,...[0,1,2,3,4].map(c=>card.map(r=>r[c])),card.map((r,i)=>r[i]),card.map((r,i)=>r[4-i])];
  return lines.some(line=>line.every(n=>marked.has(n)));
}
function newRound(room) { room.drawn=[]; room.started=true; room.automatic=false; for(const p of room.players.values()){p.card=makeCard(room.mode);p.marked=[];} }
io.on('connection', socket => {
  socket.on('host:login', ({password}={}, cb=()=>{}) => cb({ok: password===HOST_PASSWORD}));
  socket.on('room:create', ({password,mode=75,pattern='line',name='Anfitrião'}={}, cb=()=>{}) => {
    if(password!==HOST_PASSWORD) return cb({ok:false,error:'Palavra-passe incorreta.'});
    if (![75,90].includes(Number(mode))) mode=75;
    let c; do {c=code();} while(rooms.has(c));
    const room={code:c,hostId:socket.id,mode:Number(mode),pattern:['line','full'].includes(pattern)?pattern:'line',drawn:[],players:new Map(),started:true,automatic:false,created:Date.now(),timer:null};
    room.players.set(socket.id,{id:socket.id,name:String(name).slice(0,24)||'Anfitrião',host:true,card:makeCard(room.mode),marked:[],wins:0});
    rooms.set(c,room); socket.join(c); socket.data.room=c; socket.data.host=true;
    cb({ok:true,code:c,invite:`${process.env.PUBLIC_URL || ''}/?sala=${c}`}); emitState(room); sys(room,'A sala está pronta. Falta só chegar a tua companhia ❤️');
  });
  socket.on('room:join', ({code:c,name='Convidado'}={}, cb=()=>{}) => {
    c=String(c||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6); const room=rooms.get(c);
    if(!room) return cb({ok:false,error:'Não encontrámos essa sala. Confirma o código.'});
    const existing=room.players.get(socket.id);
    if(!existing && room.players.size>=2) return cb({ok:false,error:'Esta sala já está cheia — só cabem duas pessoas. 💗'});
    if(!existing){room.players.set(socket.id,{id:socket.id,name:String(name).trim().slice(0,24)||'Convidado',host:false,card:makeCard(room.mode),marked:[],wins:0});sys(room,`${String(name).trim().slice(0,24)||'O convidado'} entrou na sala.`);}
    socket.join(c); socket.data.room=c; cb({ok:true,code:c}); emitState(room);
  });
  socket.on('room:rejoin', ({code:c,name}={}, cb=()=>{}) => {
    c=String(c||'').toUpperCase(); const room=rooms.get(c); if(!room) return cb({ok:false,error:'A sala já expirou ou foi fechada.'});
    const p=[...room.players.values()].find(x=>x.name===name); if(!p && room.players.size>=2) return cb({ok:false,error:'A sala está cheia.'});
    if(p){const old=p.id; room.players.delete(old); p.id=socket.id; room.players.set(socket.id,p); if(p.host)room.hostId=socket.id;}
    else room.players.set(socket.id,{id:socket.id,name:String(name||'Convidado').slice(0,24),host:false,card:makeCard(room.mode),marked:[],wins:0});
    socket.join(c);socket.data.room=c;emitState(room);cb({ok:true,code:c});
  });
  socket.on('draw', (_data,cb=()=>{}) => {const r=roomFor(socket);if(!r||r.hostId!==socket.id)return cb({ok:false,error:'Só o anfitrião pode tirar bolas.'});const left=balls(r).filter(n=>!r.drawn.includes(n));if(!left.length)return cb({ok:false,error:'Já saíram todas as bolas!'});const n=left[Math.floor(Math.random()*left.length)];r.drawn.push(n);io.to(r.code).emit('ball',n);emitState(r);cb({ok:true,number:n});});
  socket.on('mark', ({number,marked}={},cb=()=>{})=>{const r=roomFor(socket);const p=r&&r.players.get(socket.id);if(!p)return cb({ok:false});const n=Number(number);if(!(Array.isArray(p.card[0]) ? p.card.flat() : p.card).includes(n))return cb({ok:false});if(marked&&!p.marked.includes(n))p.marked.push(n);else if(!marked)p.marked=p.marked.filter(x=>x!==n);emitState(r);cb({ok:true});});
  socket.on('bingo',(_d,cb=()=>{})=>{const r=roomFor(socket),p=r&&r.players.get(socket.id);if(!p)return cb({ok:false,error:'Entra primeiro numa sala.'});if(validWin(p,r)){p.wins++;r.automatic=false;io.to(r.code).emit('winner',{id:p.id,name:p.name,pattern:r.pattern});sys(r,`BINGO! Parabéns, ${p.name}! 🎉`);emitState(r);cb({ok:true});}else{socket.emit('false-bingo',{text:'Ups! Ainda não é bingo. Continua a jogar — a sorte pode estar mesmo aí! 😄'});cb({ok:false});}});
  socket.on('new-round',(_d,cb=()=>{})=>{const r=roomFor(socket);if(!r||r.hostId!==socket.id)return cb({ok:false,error:'Só o anfitrião pode iniciar outra ronda.'});newRound(r);emitState(r);sys(r,'Nova ronda! Boa sorte aos dois. ❤️');cb({ok:true});});
  socket.on('auto-toggle',({enabled,interval=5}={},cb=()=>{})=>{const r=roomFor(socket);if(!r||r.hostId!==socket.id)return cb({ok:false});clearInterval(r.timer);r.timer=null;r.automatic=!!enabled;if(r.automatic){const ms=Math.min(10,Math.max(3,Number(interval)||5))*1000;r.timer=setInterval(()=>{if(!rooms.has(r.code)||!r.automatic)return;const left=balls(r).filter(n=>!r.drawn.includes(n));if(!left.length){r.automatic=false;clearInterval(r.timer);return;}const n=left[Math.floor(Math.random()*left.length)];r.drawn.push(n);io.to(r.code).emit('ball',n);emitState(r);},ms);}emitState(r);cb({ok:true});});
  socket.on('room:close',(_d,cb=()=>{})=>{const r=roomFor(socket);if(!r||r.hostId!==socket.id)return cb({ok:false,error:'Só o anfitrião pode fechar a sala.'});clearInterval(r.timer);io.to(r.code).emit('closed');rooms.delete(r.code);cb({ok:true});});
  socket.on('chat',({text}={},cb=()=>{})=>{const r=roomFor(socket),p=r&&r.players.get(socket.id);text=String(text||'').trim();if(!p||!text||text.length>500)return cb({ok:false});io.to(r.code).emit('chat',{id:socket.id,name:p.name,text,time:new Date().toISOString()});cb({ok:true});});
  socket.on('typing',({typing}={})=>{const r=roomFor(socket),p=r&&r.players.get(socket.id);if(p)socket.to(r.code).emit('typing',{name:p.name,typing:!!typing});});
  socket.on('reaction',({emoji}={})=>{const r=roomFor(socket),p=r&&r.players.get(socket.id);if(p&&['❤️','😂','🎉','😮'].includes(emoji))io.to(r.code).emit('reaction',{emoji,name:p.name});});
  socket.on('signal',({to,description,candidate}={})=>{if(typeof to==='string' && (description||candidate))io.to(to).emit('signal',{from:socket.id,description,candidate});});
  socket.on('disconnect',()=>{const r=roomFor(socket);if(!r)return;const p=r.players.get(socket.id);if(p){sys(r,`${p.name} perdeu a ligação. Pode voltar a entrar com o mesmo convite.`);if(p.host){r.hostDisconnected=Date.now();}emitState(r);} });
});
setInterval(()=>{for(const [c,r] of rooms){if(Date.now()-r.created>6*60*60*1000 || (r.hostDisconnected&&Date.now()-r.hostDisconnected>30*60*1000)){clearInterval(r.timer);io.to(c).emit('closed');rooms.delete(c);}}},60*1000);
server.listen(PORT,()=>console.log(`Bingo a Dois disponível em http://localhost:${PORT}`));
