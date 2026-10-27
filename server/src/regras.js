/** Regras didáticas. A autorização de verdade ocorre SEMPRE na API. */
export const PERMISSOES = Object.freeze({
  leitor: ['ler'],
  editor: ['ler', 'criar', 'editar'],
  administrador: ['ler', 'criar', 'editar', 'excluir'],
});

export function pode(perfil, acao) {
  return (PERMISSOES[perfil] ?? []).includes(acao);
}

export function validarAviso(entrada) {
  const titulo = typeof entrada?.titulo === 'string' ? entrada.titulo.trim() : '';
  const mensagem = typeof entrada?.mensagem === 'string' ? entrada.mensagem.trim() : '';
  if (titulo.length < 3 || titulo.length > 100) {
    return { erro: 'O título deve ter entre 3 e 100 caracteres.' };
  }
  if (mensagem.length < 5 || mensagem.length > 1000) {
    return { erro: 'A mensagem deve ter entre 5 e 1000 caracteres.' };
  }
  return { valor: { titulo, mensagem } };
}
