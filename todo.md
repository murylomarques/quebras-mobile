# Project TODO

- [x] Inicializar projeto mobile com Expo SDK 54 e NativeWind
- [x] Criar design.md com especificações de interface mobile
- [x] Implementar Tela de Identificação do Técnico
- [x] Implementar Tela de Lista de SAs (Ordens de Serviço)
- [x] Implementar Tela de Seleção de Motivos de Quebra
- [x] Implementar Fluxo Guiado para "COP - Endereço não localizado" com coleta demonstrativa de evidência e preparação das validações
- [x] Implementar Tela de Sucesso e registro demonstrativo da solicitação
- [x] Validar compilação TypeScript, testes existentes e preview web do fluxo inicial
- [x] Corrigir erro HTTP 502 do Expo Go e validar conexão via preview Expo ativo
- [x] Incorporar identidade visual DESKTOP (cores vinho/vermelho/amarelo #531110, #ae2e2a, #f4ba44)
- [x] Adicionar animações fluidas e microinterações modernas em React Native Reanimated
- [x] Aplicar marca oficial DESKTOP em todas as telas e cabeçalhos
- [x] Validar compilação TypeScript, lint e estabilidade do Metro Bundler
- [x] Substituir digitação da SA por lista automática de ordens de serviço do técnico (com busca e seleção em 1 toque)
- [x] Implementar captura de evidência com câmera orientada, moldura de enquadramento e confirmação de foto
- [x] Validar compilação TypeScript, lint e preview interativo
- [x] Salvar checkpoint atualizado e entregar o aplicativo reformulado
- [x] Personalizar instruções e enquadramento da câmera de acordo com o motivo de quebra selecionado (ex.: fachada/portão para endereço não localizado, poste/caixa para infraestrutura)
- [x] Substituir identificação por matrícula por credenciamento CSSO (CSSO, Usuário e Senha)
- [x] Ajustar tela de acesso para tratar CSSO como usuário único (apenas campos 'Usuário CSSO' e 'Senha')

- [x] Integrar validação de localização por GPS no fluxo de quebra, com permissão, captura da posição atual e indicação clara de status
- [x] Atualizar apresentação executiva para remover o slide de roadmap e apresentar GPS e Salesforce como capacidades da solução pronta para operação
- [x] Validar compilação TypeScript, lint e estabilidade após as atualizações finais
- [x] Salvar checkpoint final e entregar aplicativo e apresentação atualizados para a diretoria

- [x] Revisar e reconstruir a apresentação garantindo a presença da capa institucional (DESKTOP Quebras)
- [x] Validar visualmente a ordem e o conteúdo dos slides para a diretoria

- [x] Implementar orientação por voz e texto guiada na câmera com instruções contextuais para cada motivo de quebra (ex.: "Encontre o número do imóvel", "Afaste o celular", "Fachada da casa")

- [x] Diagnosticar e corrigir o erro de inicialização do app no Expo após a implementação da orientação por voz
- [x] Validar novamente o carregamento do app e o fluxo da câmera no Expo Go
- [x] Salvar checkpoint da correção do erro do Expo
``` 

- [x] Refinar a câmera assistida para eliminar falas repetitivas aleatórias, introduzir instruções contextuais inteligentes e corrigir o layout comprimido
- [ ] Confirmar o comportamento da captura inteligente em aparelho físico com diferentes condições de iluminação

- [x] Criar tabela break_audits e aplicar migration no banco
- [x] Criar endpoint backend para salvar CSSO, SA, motivo, URL/chave da evidência, latitude, longitude, horário e status
- [x] Integrar o app ao backend com upload da evidência, conclusão da SA, protocolo de auditoria e prevenção de duplicidade
- [x] Corrigir a configuração do Metro/NativeWind e validar bundles web e Android
- [ ] Confirmar o envio real de uma foto e GPS em aparelho físico conectado ao backend
- [x] Salvar checkpoint da integração de auditoria

- [x] Diagnosticar o erro "Unable to transform response from server" ao enviar a evidência
- [x] Corrigir a comunicação do app com o endpoint de auditoria e o upload da foto
- [x] Validar o envio completo e gerar novo QR Code após a correção

- [x] Adicionar suporte a UUIDv7 e extração de metadados da imagem na auditoria de quebras
- [x] Atualizar schema Drizzle, migration, endpoint e cliente mobile para coletar e salvar EXIF e UUIDv7

- [x] Ajustar tabela break_audits para alinhar colunas de metadados de imagem e ID UUIDv7
- [x] Tornar o endpoint submit idempotente (retornar sucesso se a SA já estiver auditada)
- [x] Criar tela de envio bloqueante com animação e indicador "Enviando dados... só um minuto"

- [x] Diagnosticar coluna divergente em break_audits que causa erro 500
- [x] Recriar ou alinhar a tabela break_audits e garantir tratamento idempotente seguro

- [x] Adicionar três SAs mockadas para testes do fluxo completo

- [x] Redesenhar a tela bloqueante de envio com visual DESKTOP moderno, etapas de progresso e estado de sucesso
- [x] Validar a nova animação de envio em TypeScript, lint e preview web
- [x] Salvar checkpoint da melhoria visual da tela de envio

- [x] Limpar auditorias concluídas do ambiente de demonstração e reiniciar a disponibilidade das SAs
- [x] Validar que a consulta por CSSO retorna zero auditorias e que as 7 SAs ficam disponíveis
- [x] Salvar checkpoint do ambiente de demonstração resetado
