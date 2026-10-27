# 📢 Mural de Avisos — React Native + MongoDB + Permissões

Projeto de **ensino**, preparado para a disciplina **Programação para Dispositivos Móveis em Android** nos cursos de graduação da Estácio.

A aplicação simula um mural interno de uma equipe: usuários entram com e-mail e senha e recebem diferentes permissões. O aplicativo React Native **não acessa o MongoDB diretamente**: ele conversa por HTTP com uma API Express, que autentica as requisições, controla o acesso e consulta o banco.

> ⚠️ **Didático, não pronto para produção.** A autenticação foi simplificada para sala de aula. Antes de publicar, faltam HTTPS, limitação de tentativas de login, gestão de usuários, observabilidade, recuperação de senha, política de sessão e configuração segura de CORS.

## 🎯 Objetivos de aprendizagem

- Distinguir **autenticação** (quem é você?) de **autorização** (o que pode fazer?).
- Construir uma API REST com Node.js, Express e o driver oficial do MongoDB.
- Usar coleções e operações `find()`, `insertOne()`, `updateOne()` e `deleteOne()`.
- Compreender autenticação com JWT, senhas com hash usando `bcryptjs` e a finalidade do `expo-secure-store`.
- Aprender que esconder um botão **não substitui** verificar permissões no servidor.
- Consumir uma API por `fetch()` e organizar estado em React Native.

## ✅ Funcionalidades e perfis

| Operação | Leitor | Editor | Administrador |
| --- | :---: | :---: | :---: |
| Fazer login e visualizar avisos | ✅ | ✅ | ✅ |
| Publicar avisos | ❌ | ✅ | ✅ |
| Editar avisos | ❌ | ✅ | ✅ |
| Excluir avisos | ❌ | ❌ | ✅ |

As permissões são implementadas em `server/src/regras.js` e **verificadas em todas as rotas protegidas**. O backend busca o usuário pelo ID a cada requisição; a interface não pode se promover a administrador alterando estado local.

## 🛠 Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Aplicativo | React Native, Expo, TypeScript, `fetch()`, `expo-secure-store` |
| API | Node.js 22+, Express, MongoDB Node Driver |
| Segurança didática | bcryptjs para hash de senha, jsonwebtoken (JWT) |
| Persistência | MongoDB local ou MongoDB Atlas |

## 📁 Arquivos fornecidos

```text
MuralAvisos_MongoDB/
├── README.md
├── server/
│   ├── .env.example
│   ├── package.json
│   ├── index.js
│   ├── src/regras.js
│   └── test/regras.test.js
└── mobile/
    ├── App.tsx
    └── src/config.ts
```

`server/` já é um projeto Node. Em `mobile/` estão os arquivos da aula para copiar para um projeto Expo criado com o template `blank-typescript` (não inclui `node_modules` nem a estrutura gerada pelo Expo).

## 🚀 Como executar

### 1. Preparar o MongoDB

Execute um servidor MongoDB local na porta `27017` ou obtenha uma URI do **MongoDB Atlas**. Não coloque a URI do banco no aplicativo React Native.

### 2. Iniciar a API

Na pasta `server/`:

```bash
npm install
```

Copie `.env.example` para `.env` (no PowerShell, `Copy-Item .env.example .env`); ajuste `MONGODB_URI` e **troque** `JWT_SECRET` por uma chave aleatória. Para gerar uma chave:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Depois inicie:

```bash
npm run dev
```

A API fica em `http://localhost:3000`. A primeira inicialização **cria três usuários de demonstração** se eles não existirem:

| E-mail | Perfil | Senha |
| --- | --- | --- |
| `admin@aula.test` | Administrador | Valor de `ADMIN_PASSWORD` no `.env` |
| `editor@aula.test` | Editor | Valor de `EDITOR_PASSWORD` no `.env` |
| `leitor@aula.test` | Leitor | Valor de `LEITOR_PASSWORD` no `.env` |

**Atenção:** a carga inicial usa `upsert` somente para usuários novos. Alterar a senha no `.env` **não modifica senhas de usuários já criados**. Para reiniciar os dados do laboratório, elimine o banco `mural_avisos_aula` em um ambiente de teste e inicie a API novamente. Jamais faça isso em um banco com dados importantes.

### 3. Criar o app Expo

Em outra pasta e outro terminal:

```bash
npx create-expo-app mural-avisos --template blank-typescript
cd mural-avisos
npx expo install expo-secure-store react-native-safe-area-context
```

Copie o arquivo `mobile/App.tsx` deste ZIP para a raiz do projeto Expo, e `mobile/src/config.ts` para `src/config.ts`.

No `src/config.ts`, configure a URL da API:

```ts
// Emulador Android do Android Studio:
export const API_URL = 'http://10.0.2.2:3000';

// Aparelho físico na mesma rede Wi-Fi do computador:
// export const API_URL = 'http://192.168.X.X:3000';
```

Em um aparelho físico, descubra o **IP local do computador** (no Windows: `ipconfig`). A API precisa estar acessível pela rede; o firewall pode exigir permissão. `localhost` no telefone aponta para o próprio telefone, **não** para seu computador.

Execute:

```bash
npx expo start
```

O Expo Go deve conseguir executar este exemplo, pois usamos bibliotecas compatíveis com ele. Para produção, o tráfego deve usar HTTPS. Em redes onde HTTP local não funciona, confira firewall e configuração de rede antes de alterar o código.

## 🔐 Por que esse login é diferente?

1. O usuário digita suas credenciais no app.
2. A API procura o usuário e compara a senha com o hash (`bcrypt.compare`).
3. A API devolve um JWT com expiração de 2 horas.
4. O app guarda **somente o token** no `expo-secure-store`, e não no AsyncStorage.
5. A cada operação protegida, a API valida o token, busca o perfil atual e autoriza ou rejeita a operação (`401` ou `403`).

> O token permite autenticar a sessão; ele não torna o telefone confiável. O controle de acesso verdadeiro está no servidor. O exemplo **não** implementa renovação automática de token, rate limit ou HTTPS local.

### Rotas principais

| Método | Rota | Perfil exigido |
| --- | --- | --- |
| `POST` | `/api/login` | Público, com credenciais |
| `GET` | `/api/me` | Qualquer usuário logado |
| `GET` | `/api/avisos` | Todos os perfis |
| `POST` | `/api/avisos` | Editor, administrador |
| `PUT` | `/api/avisos/:id` | Editor, administrador |
| `DELETE` | `/api/avisos/:id` | Administrador |

**MongoDB**: coleções `usuarios` e `avisos`. Os IDs são `ObjectId`; o app recebe IDs convertidos para texto.

## 🧪 Roteiro de testes

1. Faça login como **leitor**: você deve conseguir visualizar avisos, mas não publicar, editar ou excluir.
2. Faça login como **editor**: publique um aviso e edite o texto; o botão Excluir não aparece.
3. Faça login como **administrador**: remova o aviso.
4. Feche e abra o app: a sessão armazenada deve ser restaurada enquanto o token não expirar.
5. Saia do app pelo botão **Sair** e confirme que o token foi apagado.
6. Faça a experiência mais importante: com o token de editor, tente enviar `DELETE /api/avisos/:id` por Postman ou `curl`. A API deve responder **403**, independentemente da interface.

Para testar as regras puras do backend, rode na pasta `server/`:

```bash
npm test
```

Os testes cobrem a matriz de permissões e a validação do corpo do aviso. **Não são testes de integração com MongoDB nem testes de interface.**

## 📚 Desafios

**Nível 1 — Interface:** destacar o perfil atual, adicionar contagem de avisos, mostrar a data de publicação.

**Nível 2 — API:** adicionar busca por título, paginação e campo de prioridade.

**Nível 3 — Segurança e arquitetura:** permitir que só o autor edite seu aviso, implementar perfis administráveis com trilha de auditoria e escrever testes de integração com banco isolado.

> **Desafio principal:** o editor deve editar **somente avisos criados por ele**, enquanto o administrador continua podendo editar todos. A validação deve ocorrer **na API**, não apenas no React Native.

## ⚠️ Limitações e cuidados

- A API é um projeto de laboratório, sem rate limiting, auditoria e controle robusto de sessões.
- O `cors()` está aberto para facilitar experimentos; ajuste-o antes de uma implantação real.
- As senhas no `.env` são **apenas iniciais de demonstração**. Não use credenciais compartilhadas em ambientes de produção.
- HTTP sem TLS e chaves JWT dentro do código-fonte são inseguros para produção (o exemplo usa `.env`, que não deve ser publicado).
- A instalação depende de Node.js, MongoDB, rede local e compatibilidade das versões do Expo.

## 🔗 Referências

- [Driver oficial do MongoDB](https://www.mongodb.com/docs/drivers/node/current/)
- [Documentação do Express](https://expressjs.com/)
- [Autenticação no Expo](https://docs.expo.dev/guides/authentication/)
- [SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)

---

**Material para fins educacionais — Programação para Dispositivos Móveis em Android**  
**Prof. Raphael M. S. de Jesus — Estácio**
