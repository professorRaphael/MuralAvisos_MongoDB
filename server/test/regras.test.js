import test from 'node:test';
import assert from 'node:assert/strict';
import { pode, validarAviso } from '../src/regras.js';

test('leitor só lê', () => {
  assert.equal(pode('leitor', 'ler'), true);
  assert.equal(pode('leitor', 'criar'), false);
  assert.equal(pode('leitor', 'excluir'), false);
});

test('editor cria e edita, mas não exclui', () => {
  assert.equal(pode('editor', 'criar'), true);
  assert.equal(pode('editor', 'editar'), true);
  assert.equal(pode('editor', 'excluir'), false);
});

test('administrador pode excluir; perfil desconhecido não tem permissão', () => {
  assert.equal(pode('administrador', 'excluir'), true);
  assert.equal(pode('desconhecido', 'ler'), false);
});

test('aviso válido tem dados normalizados', () => {
  assert.deepEqual(validarAviso({ titulo: '  Reunião ', mensagem: '  Dia 27, às 19h. ' }), {
    valor: { titulo: 'Reunião', mensagem: 'Dia 27, às 19h.' },
  });
});

test('aviso vazio é recusado', () => {
  assert.match(validarAviso({ titulo: '', mensagem: '' }).erro, /título/i);
});
