import 'dotenv/config';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import express from 'express';
import jwt from 'jsonwebtoken';
import { MongoClient, ObjectId } from 'mongodb';
import { pode, validarAviso } from './src/regras.js';

const { MONGODB_URI, MONGODB_DB = 'mural_avisos_aula', JWT_SECRET } = process.env;
const PORT = Number(process.env.PORT || 3000);

if (!MONGODB_URI || !JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('Configure MONGODB_URI e JWT_SECRET (mínimo 32 caracteres) no .env.');
}

const client = new MongoClient(MONGODB_URI);
await client.connect();
const db = client.db(MONGODB_DB);
const usuarios = db.collection('usuarios');
const avisos = db.collection('avisos');

await usuarios.createIndex({ email: 1 }, { unique: true });
await avisos.createIndex({ criadoEm: -1 });

// Perfis predefinidos SOMENTE para aula. Cada senha vem do .env.
const DEMOS = [
  ['admin@aula.test', 'Administrador', 'administrador', 'ADMIN_PASSWORD'],
  ['editor@aula.test', 'Editor', 'editor', 'EDITOR_PASSWORD'],
  ['leitor@aula.test', 'Leitor', 'leitor', 'LEITOR_PASSWORD'],
];
for (const [email, nome, perfil, variavel] of DEMOS) {
  const senha = process.env[variavel];
  if (!senha || senha.length < 8) {
    throw new Error(`Configure ${variavel} no .env (mínimo 8 caracteres).`);
  }
  await usuarios.updateOne(
    { email },
    { $setOnInsert: { email, nome, perfil, senhaHash: await bcrypt.hash(senha, 12) } },
    { upsert: true },
  );
}

const app = express();
app.use(cors()); // Apenas para laboratório; em produção, restrinja origens.
app.use(express.json({ limit: '20kb' }));

const publico = (usuario) => ({
  id: String(usuario._id), nome: usuario.nome, email: usuario.email, perfil: usuario.perfil,
});

async function autenticar(req, res, next) {
  try {
    const token = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1];
    if (!token) return res.status(401).json({ erro: 'Faça login para continuar.' });
    const dados = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof dados !== 'object' || !ObjectId.isValid(dados.sub)) {
      return res.status(401).json({ erro: 'Sessão inválida.' });
    }
    // Consulta o banco em cada chamada: o cliente não define seu perfil.
    const usuario = await usuarios.findOne({ _id: new ObjectId(dados.sub) });
    if (!usuario) return res.status(401).json({ erro: 'Usuário não encontrado.' });
    res.locals.usuario = usuario;
    next();
  } catch (erro) {
    if (erro?.name === 'JsonWebTokenError' || erro?.name === 'TokenExpiredError') {
      return res.status(401).json({ erro: 'Sessão inválida ou expirada.' });
    }
    next(erro);
  }
}

function permitir(acao) {
  return (_, res, next) => {
    if (!pode(res.locals.usuario.perfil, acao)) {
      return res.status(403).json({ erro: 'Seu perfil não permite esta operação.' });
    }
    next();
  };
}

app.post('/api/login', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const senha = typeof req.body?.senha === 'string' ? req.body.senha : '';
  if (!email || !senha) return res.status(400).json({ erro: 'Informe e-mail e senha.' });
  const usuario = await usuarios.findOne({ email });
  if (!usuario || !(await bcrypt.compare(senha, usuario.senhaHash))) {
    return res.status(401).json({ erro: 'Credenciais inválidas.' });
  }
  const token = jwt.sign({ sub: String(usuario._id) }, JWT_SECRET, {
    algorithm: 'HS256', expiresIn: '2h',
  });
  res.json({ token, usuario: publico(usuario) });
});

app.get('/api/me', autenticar, (_, res) => {
  res.json({ usuario: publico(res.locals.usuario) });
});

app.get('/api/avisos', autenticar, permitir('ler'), async (_, res) => {
  const lista = await avisos.find({}, { projection: { titulo: 1, mensagem: 1, autor: 1, criadoEm: 1 } })
    .sort({ criadoEm: -1 }).limit(100).toArray();
  res.json(lista.map((a) => ({
    id: String(a._id), titulo: a.titulo,
    mensagem: a.mensagem, autor: a.autor, criadoEm: a.criadoEm
  })));
});

app.post('/api/avisos', autenticar, permitir('criar'), async (req, res) => {
  const entrada = validarAviso(req.body);
  if (entrada.erro) return res.status(400).json({ erro: entrada.erro });
  const documento = { ...entrada.valor, autor: res.locals.usuario.nome, criadoEm: new Date() };
  const resultado = await avisos.insertOne(documento);
  res.status(201).json({ id: String(resultado.insertedId) });
});

app.put('/api/avisos/:id', autenticar, permitir('editar'), async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ erro: 'ID inválido.' });
  const entrada = validarAviso(req.body);
  if (entrada.erro) return res.status(400).json({ erro: entrada.erro });
  const resultado = await avisos.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { ...entrada.valor, atualizadoEm: new Date() } },
  );
  if (!resultado.matchedCount) return res.status(404).json({ erro: 'Aviso não encontrado.' });
  res.json({ ok: true });
});

app.delete('/api/avisos/:id', autenticar, permitir('excluir'), async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ erro: 'ID inválido.' });
  const resultado = await avisos.deleteOne({ _id: new ObjectId(req.params.id) });
  if (!resultado.deletedCount) return res.status(404).json({ erro: 'Aviso não encontrado.' });
  res.json({ ok: true });
});

app.use((err, _, res, _) => {
  console.error(err);
  res.status(500).json({ erro: 'Falha interna do servidor.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API do Mural: http://localhost:${PORT}`);
});
