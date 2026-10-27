import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { API_URL } from "./src/config";

type Perfil = "leitor" | "editor" | "administrador";
type Usuario = { id: string; nome: string; email: string; perfil: Perfil };
type Aviso = {
  id: string;
  titulo: string;
  mensagem: string;
  autor: string;
  criadoEm: string;
};
type Login = { usuario: Usuario; token: string };

const CHAVE_SESSAO = "mural:aula:token";

async function api<T>(
  rota: string,
  token?: string,
  metodo = "GET",
  dados?: object,
): Promise<T> {
  const resposta = await fetch(`${API_URL}${rota}`, {
    method: metodo,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(dados ? { body: JSON.stringify(dados) } : {}),
  });
  const corpo: any = await resposta.json().catch(() => ({}));
  if (!resposta.ok)
    throw new Error(corpo.erro || `Erro HTTP ${resposta.status}`);
  return corpo as T;
}

function Botao({
  titulo,
  onPress,
  secundario = false,
  disabled = false,
}: {
  titulo: string;
  onPress: () => void;
  secundario?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        s.botao,
        secundario && s.botaoSecundario,
        disabled && s.desativado,
      ]}
    >
      <Text style={[s.botaoTexto, secundario && s.textoSecundario]}>
        {titulo}
      </Text>
    </Pressable>
  );
}

export default function App() {
  const [token, setToken] = useState("");
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [idEmEdicao, setIdEmEdicao] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);

  async function listar(tokenAtual: string) {
    setAvisos(await api<Aviso[]>("/api/avisos", tokenAtual));
  }

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const salvo = await SecureStore.getItemAsync(CHAVE_SESSAO);
        if (!salvo) return;
        const perfil = await api<{ usuario: Usuario }>("/api/me", salvo);
        if (!ativo) return;
        const registros = await api<Aviso[]>("/api/avisos", salvo);
        if (!ativo) return;
        setToken(salvo);
        setUsuario(perfil.usuario);
        setAvisos(registros);
      } catch {
        await SecureStore.deleteItemAsync(CHAVE_SESSAO);
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  async function entrar() {
    if (!email.trim() || !senha) {
      Alert.alert("Dados incompletos", "Informe e-mail e senha.");
      return;
    }
    setOcupado(true);
    try {
      const acesso = await api<Login>("/api/login", undefined, "POST", {
        email,
        senha,
      });
      const registros = await api<Aviso[]>("/api/avisos", acesso.token);
      await SecureStore.setItemAsync(CHAVE_SESSAO, acesso.token);
      setToken(acesso.token);
      setUsuario(acesso.usuario);
      setAvisos(registros);
      setSenha("");
    } catch (erro) {
      Alert.alert(
        "Falha no login",
        String(erro instanceof Error ? erro.message : erro),
      );
    } finally {
      setOcupado(false);
    }
  }

  async function sair() {
    await SecureStore.deleteItemAsync(CHAVE_SESSAO);
    setToken("");
    setUsuario(null);
    setAvisos([]);
    limparFormulario();
  }

  function limparFormulario() {
    setIdEmEdicao(null);
    setTitulo("");
    setMensagem("");
  }

  async function salvar() {
    if (titulo.trim().length < 3 || mensagem.trim().length < 5) {
      Alert.alert(
        "Dados inválidos",
        "Informe um título e uma mensagem completos.",
      );
      return;
    }
    setOcupado(true);
    try {
      await api(
        `/api/avisos${idEmEdicao ? `/${idEmEdicao}` : ""}`,
        token,
        idEmEdicao ? "PUT" : "POST",
        { titulo, mensagem },
      );
      limparFormulario();
      await listar(token);
    } catch (erro) {
      Alert.alert(
        "Não foi possível salvar",
        String(erro instanceof Error ? erro.message : erro),
      );
    } finally {
      setOcupado(false);
    }
  }

  function editar(aviso: Aviso) {
    setIdEmEdicao(aviso.id);
    setTitulo(aviso.titulo);
    setMensagem(aviso.mensagem);
  }

  function confirmarExclusao(aviso: Aviso) {
    Alert.alert("Excluir aviso", `Excluir "${aviso.titulo}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => {
          void excluir(aviso.id);
        },
      },
    ]);
  }

  async function excluir(id: string) {
    setOcupado(true);
    try {
      await api(`/api/avisos/${id}`, token, "DELETE");
      if (idEmEdicao === id) limparFormulario();
      await listar(token);
    } catch (erro) {
      Alert.alert(
        "Falha ao excluir",
        String(erro instanceof Error ? erro.message : erro),
      );
    } finally {
      setOcupado(false);
    }
  }

  const podeEditar =
    usuario?.perfil === "editor" || usuario?.perfil === "administrador";
  const podeExcluir = usuario?.perfil === "administrador";

  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.tela}>
        {carregando ? (
          <ActivityIndicator size="large" color="#2563eb" />
        ) : !usuario ? (
          <View style={s.login}>
            <Text style={s.titulo}>Mural da Equipe</Text>
            <Text style={s.auxiliar}>
              Login com permissões definidas na API MongoDB
            </Text>
            <TextInput
              style={s.campo}
              placeholder="E-mail"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={s.campo}
              placeholder="Senha"
              secureTextEntry
              value={senha}
              onChangeText={setSenha}
            />
            <Botao
              titulo="Entrar"
              disabled={ocupado}
              onPress={() => {
                void entrar();
              }}
            />
            <Text style={s.auxiliar}>
              Usuários da aula: admin@aula.test, editor@aula.test e
              leitor@aula.test.
            </Text>
          </View>
        ) : (
          <View style={s.conteudo}>
            <Text style={s.titulo}>Mural da Equipe</Text>
            <Text style={s.auxiliar}>
              {usuario.nome} · {usuario.perfil}
            </Text>
            <Botao
              titulo="Sair"
              secundario
              onPress={() => {
                void sair();
              }}
            />
            {podeEditar && (
              <View style={s.cartao}>
                <Text style={s.subtitulo}>
                  {idEmEdicao ? "Editar aviso" : "Novo aviso"}
                </Text>
                <TextInput
                  style={s.campo}
                  placeholder="Título"
                  value={titulo}
                  onChangeText={setTitulo}
                />
                <TextInput
                  style={[s.campo, s.area]}
                  multiline
                  placeholder="Mensagem"
                  value={mensagem}
                  onChangeText={setMensagem}
                />
                <Botao
                  titulo={idEmEdicao ? "Atualizar" : "Publicar"}
                  disabled={ocupado}
                  onPress={() => {
                    void salvar();
                  }}
                />
                {idEmEdicao && (
                  <Botao
                    titulo="Cancelar edição"
                    secundario
                    onPress={limparFormulario}
                  />
                )}
              </View>
            )}
            <Text style={s.subtitulo}>Avisos publicados</Text>
            <FlatList<Aviso>
              data={avisos}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <Text style={s.auxiliar}>Nenhum aviso cadastrado.</Text>
              }
              renderItem={({ item }) => (
                <View style={s.cartao}>
                  <Text style={s.subtitulo}>{item.titulo}</Text>
                  <Text style={s.corpo}>{item.mensagem}</Text>
                  <Text style={s.auxiliar}>Por {item.autor}</Text>
                  {podeEditar && (
                    <Botao
                      titulo="Editar"
                      secundario
                      onPress={() => editar(item)}
                    />
                  )}
                  {podeExcluir && (
                    <Botao
                      titulo="Excluir"
                      secundario
                      onPress={() => confirmarExclusao(item)}
                    />
                  )}
                </View>
              )}
              refreshing={ocupado}
              onRefresh={() => {
                void listar(token).catch(() =>
                  Alert.alert("Erro", "Falha ao atualizar."),
                );
              }}
              contentContainerStyle={s.lista}
            />
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: "#f0f4f8",
    padding: 16,
    justifyContent: "center",
  },
  login: { gap: 12 },
  conteudo: { flex: 1, gap: 10 },
  titulo: { fontSize: 27, fontWeight: "800", color: "#112244" },
  subtitulo: { fontSize: 17, fontWeight: "700", color: "#152d51" },
  corpo: { fontSize: 15, color: "#334155", marginVertical: 8 },
  auxiliar: { color: "#64748b", fontSize: 13 },
  campo: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 12,
    fontSize: 16,
  },
  area: { minHeight: 80, textAlignVertical: "top" },
  cartao: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    gap: 7,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  botao: {
    padding: 11,
    borderRadius: 9,
    backgroundColor: "#2563eb",
    alignItems: "center",
  },
  botaoSecundario: { backgroundColor: "#e0e7ff" },
  botaoTexto: { fontSize: 14, fontWeight: "700", color: "#fff" },
  textoSecundario: { color: "#1d4ed8" },
  desativado: { opacity: 0.55 },
  lista: { gap: 10, paddingBottom: 24 },
});
