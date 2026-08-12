# Design da Interface — Aplicativo de Quebras Técnicas (Mobile)

## 1. Visão Geral e Orientações de Design
O aplicativo foi planejado seguindo rigorosamente os padrões de usabilidade mobile (foco em orientação retrato 9:16 e usabilidade com uma mão única para técnicos em campo). A identidade visual é limpa, profissional e de alto contraste para visibilidade sob luz solar externa.

## 2. Lista de Telas do Aplicativo
1. **Tela de Identificação do Técnico**: Login simples com matrícula/ID e nome do técnico.
2. **Tela de Minhas Ordens (SAs)**: Lista de Service Appointments (SAs) atribuídas ao técnico no dia, com endereços, status e clientes.
3. **Tela de Detalhes da SA e Motivos de Quebra**: Visualização rápida dos dados da SA selecionada e acesso à lista oficial de motivos de quebra.
4. **Tela de Fluxo Guiado ("Endereço não localizado")**: Passo a passo interativo para captura de evidência com timestamp (simulado via geolocalização e foto) e validação automática.
5. **Tela de Confirmação / Sucesso**: Feedback visual imediato da suspensão automática da SA no Salesforce.

## 3. Principais Conteúdos e Funcionalidades por Tela
* **Identificação**: Permite salvar o perfil do técnico localmente no dispositivo para agilizar o acesso diário.
* **Lista de SAs**: Exibe cards com ID da SA, nome do cliente, endereço cadastrado e botão de acesso rápido à quebra.
* **Seleção de Motivo**: Exibe a lista completa de motivos informados pelo negócio (destacando o fluxo ativo de **Endereço não localizado** e mantendo os demais motivos informativos caso sejam selecionados antes de terem regras validadas).
* **Validação Automática**: Compara a geolocalização capturada no local com o endereço da SA para aprovar ou reprovar a quebra antes de enviar ao Salesforce.

## 4. Fluxo Principal do Usuário
1. Técnico abre o app e se identifica.
2. Seleciona a SA pendente na lista do dia.
3. Clica em "Solicitar Quebra" e seleciona "COP - Endereço não localizado".
4. O app solicita a captura de evidência (foto e geolocalização atual).
5. O sistema valida se a distância até o endereço da SA é compatível.
6. A SA é suspensa automaticamente, eliminando o uso de WhatsApp e a intervenção do COP.

## 5. Escolha de Cores e Tipografia
* **Cor Primária**: Azul Corporativo (`#0a7ea4`), transmitindo confiabilidade e clareza técnica.
* **Cor de Fundo**: Branco/Cinza claro no modo claro (`#ffffff` / `#f5f5f5`) e Dark Mode nativo (`#151718`).
* **Cores de Alerta**: Verde (`#22C55E`) para validações bem-sucedidas e Vermelho (`#EF4444`) para bloqueios e divergências de localização.
