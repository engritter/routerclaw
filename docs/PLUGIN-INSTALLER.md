# Plugin e instalador RouterClaw

O repositório reúne o protótipo original, sua documentação e o novo pacote experimental em [`packages/routerclaw`](../packages/routerclaw/README.md). GitHub é onde o código fica guardado; ClawHub é o catálogo em que o pacote poderá ser distribuído. Não são formatos concorrentes.

O pacote inclui o plugin, os comandos `doctor`, `prepare`, `activate`, `status` e `rollback`, e uma adaptação do OpenClaw com hashes fixos. Continua sendo um plugin com adaptação de host: esta versão não foi transformada em uma extensão universal que funciona em qualquer OpenClaw.

O instalador:

1. Confere OpenClaw 2026.11.1 e nove módulos exatos, recusando alterações ou outras versões.
2. Recebe explicitamente o proprietário, agente, conta do Telegram e o identificador de um perfil OAuth existente. Não recebe senhas ou tokens.
3. Prepara uma cópia separada do software e uma configuração proposta privada. Não copia as bases de conversa, memória ou credenciais e não modifica o serviço nessa etapa. A cópia da configuração pode conter segredos já presentes no arquivo original; ela permanece protegida.
4. Na ativação explícita, exige o serviço Linux do próprio usuário, com caminhos de estado e configuração padrão. Valida a configuração, drena o trabalho, guarda o retorno, troca apenas a configuração do plugin e o comando de inicialização do serviço e confere o processo e a saúde.
5. Se a nova inicialização falhar, tenta restaurar a configuração e o serviço anteriores. Se houver alterações concorrentes, preserva-as e registra a necessidade de revisão.

O resultado de uma ativação saudável é `active-awaiting-real-message`. Só uma mensagem real, com classificação, execução e entrega correlacionadas, pode concluir a validação de roteamento daquela instalação. O resultado de `/status` sozinho não comprova isso.

Os 47 testes de referência anteriores permanecem preservados. Os testes adicionais do instalador e a conferência de instalação são registrados separadamente em [evidence/plugin-installer.json](../evidence/plugin-installer.json). Repetir os 47 testes com o plugin empacotado não os transforma em 47 casos novos.

Instruções completas, compatibilidade e limites estão no [manual do pacote](../packages/routerclaw/README.md). O instalador não migra automaticamente o antigo `lab-router-6778` do agente coordenador e não foi aplicado à produção nesta preparação. O código está disponível neste repositório; a publicação no ClawHub ainda depende da análise de segurança do registro.
