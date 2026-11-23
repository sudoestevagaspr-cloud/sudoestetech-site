# Sudoeste Tech — Requisitos do Banco de Vagas (v1)

Objetivo: substituir a planilha (Google Sheets) que alimenta o site de vagas por um sistema com banco de dados, em que as empresas cadastram as próprias vagas, com mais organização, segurança, desempenho e profissionalismo.

Escopo da v1: somente vagas. Depois: cursos e eventos. Por último: banco de talentos.

## 1. Atores

- **Administrador (Luan):** acesso total ao sistema. Aprova empresas, cadastra vagas curadas, tira qualquer vaga do ar, suspende empresas e avalia reports.
- **Empresa:** um único login por empresa (mais usuários ficam para o futuro). Cadastra, edita e encerra as próprias vagas.
- **Candidato:** não faz login. Busca, filtra, visualiza vagas, clica para se candidatar e pode reportar uma vaga.

## 2. Cadastro e aprovação de empresas

1. A empresa faz um pré-cadastro com CNPJ, razão social, nome fantasia, e-mail e telefone de contato.
2. O sistema consulta o CNPJ na BrasilAPI e mostra ao admin a razão social e a situação na Receita.
3. O pré-cadastro entra numa fila de aprovação.
4. O admin revisa e liga para a empresa para confirmar que é real.
5. Aprovado: a empresa recebe e-mail com link para criar a própria senha (o link expira; nunca enviar senha por e-mail).
6. Recusado: a empresa recebe e-mail de recusa.

Dados da empresa:

- Editáveis pela empresa: logo (opcional), descrição, site, redes sociais, telefone.
- Travados (só o admin altera): CNPJ e razão social.

## 3. Vagas

### Origem

- **Cadastrada pela empresa:** vai ao ar sem aprovação, tanto no cadastro quanto na edição, pois a empresa já foi verificada.
- **Curada pelo admin:** vagas que o Luan encontra e cadastra. A empresa vira um registro sem login. Se depois essa empresa pedir acesso, basta ativar o login e as vagas antigas ficam ligadas a ela.

### Campos

Obrigatórios: cargo, área principal, nível, contrato, modalidade, cidade, atividades, requisitos, link de candidatura, data de encerramento.

Ajustes de 23/11/2026, no cadastro das primeiras vagas reais:

- Nível, contrato e modalidade aceitam mais de uma opção (ex.: "Júnior ou Pleno", "CLT ou PJ", "Presencial ou Híbrido"). Contrato e modalidade continuam obrigatórios em toda vaga.
- Na vaga curada, o nível pode ficar em branco (a fonte nem sempre informa). Na vaga da empresa, continua obrigatório.
- Na vaga curada, o prazo pode ser "não informado": a vaga continua com uma data de encerramento, escolhida pelo admin, e sai do ar nela, mas o site mostra "Prazo não informado, candidate-se logo" no lugar da data.

Opcionais: áreas secundárias, salário (faixa mínimo/máximo ou "a combinar"), benefícios, PcD (sim/não), como se candidatar (texto de apoio), observação.

Só para vagas curadas: fonte e data de conferência.

Automáticos: id, status, origem, empresa, data de cadastro, data de publicação, data da última confirmação.

Mudanças em relação à planilha atual:

- "empresa" deixa de ser texto e vem do cadastro da empresa.
- "etiquetas" viram áreas (principal + secundárias).
- "tipo" é unificado com "contrato".
- Novo campo "nível".
- "prazo" vira data de encerramento obrigatória.

### Listas fixas (mantidas pelo admin no painel)

- **Contrato:** CLT, PJ, estágio obrigatório, estágio não obrigatório, temporário.
- **Nível:** estágio, trainee, júnior, pleno, sênior, especialista.
- **Modalidade:** presencial, híbrido, remoto.
- **Áreas:** suporte técnico e help desk; infraestrutura e redes; cloud e DevOps; desenvolvimento (item único por enquanto); dados e BI; inteligência artificial; segurança da informação; qualidade e testes (QA); implantação e consultoria de sistemas; produto e gestão; UX/UI design; banco de dados; automação e RPA; comercial e pré-venda técnica.
- **Cidades:** cadastradas pelo admin.

### Áreas da vaga

- Uma área principal obrigatória: aparece em destaque no card e é usada nos relatórios.
- Até duas áreas secundárias opcionais: servem só para a busca.

### Ciclo de vida

Status: ativa, encerrada pela empresa, expirada, removida pelo admin, suspensa (empresa suspensa). Vagas encerradas saem do site, mas ficam guardadas no banco para histórico e relatórios; nunca são apagadas.

- A empresa pode encerrar a vaga a qualquer momento.
- A vaga sai do ar automaticamente na data de encerramento.
- Após 30 dias no ar, o sistema envia e-mail perguntando se a vaga continua aberta, com dois botões de um clique: "continua aberta" e "já foi preenchida" (sem precisar logar).
- Sem resposta, reenvia 2 ou 3 lembretes; sem resposta, a vaga sai do ar.
- Vale o que acontecer primeiro: data de encerramento ou falta de resposta.
- Para vagas curadas, a checagem de 30 dias vai para o admin.

### Candidatura

O site apenas anuncia e direciona. O botão "Candidatar-se" leva ao link externo da empresa (ex.: Gupy, LinkedIn, site próprio). O site não recebe currículo nem guarda dados de candidatos.

## 4. Busca e filtros (candidato)

- Busca por texto: cargo, empresa ou tecnologia.
- Filtros: cidade (com opção "todas"), modalidade, nível, área.
- Regra de cidade: cidade e modalidade são guardadas separadas. "Remoto" existe só no filtro de modalidade. O filtro de cidade vale para vagas presenciais e híbridas; vagas remotas aparecem em qualquer cidade filtrada. Na listagem, a remota aparece como "Remoto — empresa de [cidade]".
- Vaga com mais de uma modalidade (23/11/2026): se uma delas for remota, a vaga aparece em qualquer cidade filtrada. "Remoto — empresa de [cidade]" fica para a vaga só remota; a "Híbrido ou Remoto" mostra a cidade.

## 5. Card e página da vaga

- Logo da empresa no card (opcional). Sem logo: quadrado com as iniciais da empresa na paleta do site.
- Cada vaga tem link próprio e legível (ex.: sudoestetech.com.br/vagas/analista-de-ti-jr-unimed-pato-branco), com prévia de título, empresa e logo ao compartilhar no WhatsApp e no Instagram. Layout a ser revisado para ficar mais responsivo e melhorar a experiência do usuário.

## 6. Painel da empresa

- Cadastrar, editar e encerrar vagas.
- Ver por vaga: visualizações (quantos abriram os detalhes) e cliques para candidatura (quantos clicaram em "Candidatar-se"). Não chamar de "candidaturas", pois a candidatura é externa.
- Editar os dados liberados da empresa e o logo.

## 7. Painel do admin

- Fila de aprovação de empresas.
- Cadastrar vagas curadas.
- Tirar qualquer vaga do ar e suspender empresas. Empresa suspensa: login bloqueado e todas as vagas saem do ar na hora.
- Avaliar reports de vagas.
- Manter as listas fixas (áreas, níveis, contratos, cidades) e os planos. O login do admin exige verificação em duas etapas.

## 8. Reportar vaga

- Botão "reportar vaga" para o candidato.
- O report chega primeiro ao admin. Só se tiver procedência, a empresa é avisada por e-mail.

## 9. Planos e limites

- Tabela de planos no banco, com o limite de vagas ativas como campo. Cada empresa ligada a um plano.
- Plano gratuito: até 2 vagas ativas ao mesmo tempo. Encerrou uma, libera espaço.
- Vagas curadas pelo admin não contam no limite.
- Ao tentar publicar além do limite, a empresa vê só a mensagem: "Você atingiu o limite de 2 vagas ativas. Para anunciar mais vagas, entre em contato pelo e-mail sudoestevagaspr@gmail.com." Nenhum plano, preço ou custo é exibido; o admin conversa caso a caso. O sistema registra quantas vezes cada empresa bateu no limite. Planos pagos serão criados depois, só cadastrando novos planos, sem mexer no código.

### Limite personalizado por empresa

O admin pode liberar mais vagas para uma empresa específica sem mudar o plano dela, pelo painel de admin.

- Campo **limite personalizado** no cadastro da empresa. Vazio: vale o limite do plano. Preenchido (ex.: 5): a empresa pode ter até esse número de vagas ativas.
- Campo opcional **válido até** (data). Ao vencer, a empresa volta ao limite do plano.
- Se a liberação vencer com mais vagas ativas que o limite, as vagas já publicadas continuam no ar até encerrarem; só a publicação de novas vagas fica bloqueada.
- Cada liberação registra quem liberou, quando, o limite, a validade e o motivo (ex.: "acordo por e-mail", "cortesia"), formando um histórico.
- O campo continua valendo para exceções depois que existirem planos pagos.

## 10. E-mails automáticos

Para o admin:

- Nova empresa na fila de aprovação.
- Nova vaga reportada.

Para a empresa:

- Cadastro recebido.
- Cadastro aprovado, com link para criar a senha.
- Cadastro recusado.
- Recuperação de senha.
- Checagem de 30 dias e lembretes.
- Vaga saiu do ar (prazo vencido ou falta de resposta).
- Report procedente sobre a vaga.

## 11. Requisitos não funcionais

- Aparência profissional, sem cara de formulário do Google.
- Segurança: regras de acesso no próprio banco (Row Level Security), para que uma empresa nunca leia ou edite vagas de outra.
- Desempenho e escala: lista de vagas em cache na Cloudflare, consultando o banco só quando algo muda.
- Métricas de visualizações e cliques guardadas somadas por vaga por dia, não cada evento individual.
- Estrutura preparada para o futuro: tabela de usuários separada da de empresas (vários logins por empresa depois); tabelas de cidades, empresas e áreas reaproveitáveis para eventos, cursos e banco de talentos.

### Privacidade e LGPD

- Termos de uso e política de privacidade publicados no site e aceitos no pré-cadastro da empresa.
- A empresa pode pedir a exclusão da conta a qualquer momento.
- Na exclusão, os dados de contato (telefone, e-mail) são apagados; as vagas antigas ficam no histórico só com o nome da empresa.

### Backup

- Exportação automática do banco uma vez por semana, já que o Supabase gratuito não tem backup diário.

### Implantação e testes

- Sem migração automática da planilha: o admin recadastra as vagas atuais como vagas curadas, o que serve de primeiro teste do cadastro.

## 12. Tecnologia

- **Banco, login e arquivos:** Supabase (PostgreSQL, autenticação, armazenamento dos logos, tarefas agendadas), plano gratuito; Pro (US$ 25/mês) quando precisar, principalmente pelo backup diário.
- **Site:** Next.js hospedado na Cloudflare, no domínio sudoestetech.com.br (DNS já na Cloudflare). Vercel descartada porque o plano gratuito não permite uso comercial.
- **E-mails:** serviço transacional como o Resend.
- **Desenvolvimento:** feito inicialmente pelo Claude Code.

## 13. Fora da v1

- Cursos e eventos.
- Banco de talentos.
- Vários logins por empresa.
- Desenvolvimento quebrado em especialidades.
- Planos pagos e vaga em destaque.
