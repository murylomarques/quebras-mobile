# Salesforce SOQL Explorer

Utilitário de terminal em Python para consultar dados do Salesforce por REST/SOQL. Ele oferece duas formas de uso: execução direta de um `SELECT` e um modo interativo com construtor guiado que consulta os objetos e campos disponíveis na organização.

> **Importante:** este programa é deliberadamente somente leitura. Ele aceita uma única consulta que comece com `SELECT`, rejeita múltiplos comandos e bloqueia operações como `INSERT`, `UPDATE`, `DELETE`, `UPSERT`, `MERGE`, `UNDELETE` e `FOR UPDATE` antes de fazer qualquer chamada de consulta.

## Pré-requisitos

A organização Salesforce precisa ter uma **External Client App** ou Connected App configurada para o fluxo **OAuth 2.0 Client Credentials**, com um usuário de integração e permissão de API. Nesse fluxo, a aplicação troca o client ID e o client secret por um access token em nome do usuário de integração; não é necessário pedir senha ao operador, mas o fluxo não emite refresh token.[1]

Use o **My Domain** da sua organização em `SALESFORCE_DOMAIN`. Para esse fluxo, não use `https://login.salesforce.com` nem `https://test.salesforce.com` como domínio do token.[1]

| Variável | Obrigatória | Exemplo | Finalidade |
| --- | --- | --- | --- |
| `SALESFORCE_DOMAIN` | Sim | `https://empresa.my.salesforce.com` | My Domain da organização |
| `SALESFORCE_CLIENT_ID` | Sim | `3MVG...` | Consumer Key da aplicação |
| `SALESFORCE_CLIENT_SECRET` | Sim | `abc...` | Consumer Secret da aplicação |
| `SALESFORCE_API_VERSION` | Não | `v60.0` | Versão REST; o padrão local é `v60.0` |

## Instalação

No terminal, a partir da raiz deste repositório, execute:

```bash
cd salesforce_soql
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
```

Abra o arquivo `.env` e substitua os valores de exemplo pelos valores reais. O arquivo `.env` está ignorado pelo Git; nunca cole esses valores em código-fonte ou em mensagens públicas.

## Uso rápido

Para abrir o modo interativo:

```bash
python salesforce_soql.py
```

No prompt `soql>`, você pode colar diretamente um `SELECT`, usar `:build` para montar a consulta com ajuda dos metadados do Salesforce, `:objects` para listar objetos, `:fields Account` para listar os campos de `Account` e `:format json` ou `:format csv` para alterar a saída.

Para executar uma consulta sem entrar no modo interativo:

```bash
python salesforce_soql.py --query "SELECT Id, Name FROM Account LIMIT 10"
python salesforce_soql.py --format json --query "SELECT Id, Name FROM Contact LIMIT 10"
```

Para ler a consulta de um arquivo:

```bash
printf '%s\n' "SELECT Id, Name FROM Account WHERE IsActive__c = true LIMIT 100" > consulta.soql
python salesforce_soql.py --file consulta.soql --format csv > resultado.csv
```

O programa pagina os resultados quando o Salesforce devolve `nextRecordsUrl`, respeitando o limite local `--max-records`, que por padrão é `10.000` registros. A API REST do Salesforce disponibiliza o recurso `query` para executar SOQL e pode devolver os resultados em páginas.[2]

## Comandos interativos

| Comando | Resultado |
| --- | --- |
| `:build` | Lista objetos, consulta os campos e monta um `SELECT` com filtro, ordenação e limite |
| `:objects Account` | Lista objetos cujo nome ou rótulo contém `Account` |
| `:fields Account` | Lista os campos, tipos e rótulos do objeto |
| `:run SELECT Id FROM Account LIMIT 5` | Valida e executa uma consulta explícita |
| `:format table` | Mostra resultados em tabela; também há `json` e `csv` |
| `:help` | Mostra a ajuda |
| `:exit` | Encerra o programa |

## Testes

Os testes não fazem chamadas para uma organização real. Eles verificam a normalização do domínio, a validação somente leitura, o bloqueio de múltiplos comandos e a paginação simulada da API:

```bash
python3 -m unittest discover -s . -p 'test_*.py' -v
```

## Estrutura

| Arquivo | Responsabilidade |
| --- | --- |
| `salesforce_soql.py` | Cliente OAuth/REST, validador SOQL, construtor guiado e CLI |
| `test_salesforce_soql.py` | Testes automatizados sem rede |
| `.env.example` | Modelo seguro de configuração |
| `requirements.txt` | Dependência HTTP |

## Referências

[1]: https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_client_credentials_flow.htm&type=5 "Salesforce Help — OAuth 2.0 Client Credentials Flow for Server-to-Server Integration"

[2]: https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/dome_query.htm "Salesforce Developers — Execute a SOQL Query"
