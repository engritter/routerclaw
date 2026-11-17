> DRAFT / RASCUNHO — Do not submit or publish until Álvaro explicitly authorizes release.

# Apresentação do RouterClaw

Criei e dirigi, na Safety Engenharia, um protótipo de roteamento por mensagem para o OpenClaw: **a conversa continua; o modelo e o esforço mudam conforme a tarefa.**

Uma pergunta curta pode seguir para Luna com esforço baixo. Pedidos normais seguem para Sol/baixo; revisões e anexos para Sol/alto. Astra/alto fica reservado a casos excepcionais. A seleção usa a entrada admitida daquela mensagem e não exige trocar a preferência compartilhada da sessão a cada pedido.

O que temos de concreto: **47 testes isolados aprovados, oito mensagens históricas reais do Telegram concluídas e recebidas e um histórico de validação em VPS isolada**, incluindo consulta com ferramenta, mensagem em fila e arquivo de teste. Encontramos falhas na integração e registramos as correções e os limites, em vez de usar teste local como prova de publicação ou entrega.

Estou abrindo o código de referência e os testes para revisão da comunidade. É um protótipo experimental, não um plugin pronto ou uma contribuição já aceita pelo OpenClaw. Ainda há trabalho em comandos nativos, cobertura de mídia e diagnóstico de contexto. Também não medimos economia de créditos.

**Criação e direção: Álvaro Ritter — Safety Engenharia.** Assistência de engenharia: ferramentas de desenvolvimento assistido por IA. Construído sobre o OpenClaw, com os créditos e a licença do projeto preservados.

Código, arquitetura e evidências: https://github.com/engritter/routerclaw
