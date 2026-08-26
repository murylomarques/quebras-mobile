#!/usr/bin/env python3
"""Salesforce SOQL Explorer: read-only terminal assistant.

This utility uses Salesforce OAuth 2.0 Client Credentials and the REST Query
resource. It intentionally accepts only SELECT statements and never calls
Salesforce mutation endpoints.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import os
import re
import sys
from dataclasses import dataclass
from getpass import getpass
from typing import Any, Iterable
from urllib.parse import urljoin

import requests


DEFAULT_API_VERSION = "v60.0"
DEFAULT_LIMIT = 200
DEFAULT_MAX_RECORDS = 10_000
REQUEST_TIMEOUT = 30


class SalesforceError(RuntimeError):
    """A safe, user-facing Salesforce integration error."""


class ReadOnlyQueryError(ValueError):
    """Raised when input is not a single read-only SELECT query."""


def load_dotenv(path: str = ".env") -> None:
    """Load simple KEY=VALUE entries without overriding process variables."""
    if not os.path.isfile(path):
        return

    try:
        with open(path, "r", encoding="utf-8") as env_file:
            lines = env_file.readlines()
    except OSError as exc:
        raise SalesforceError(f"Não foi possível ler {path}: {exc}") from exc

    for raw_line in lines:
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        if key and key not in os.environ:
            os.environ[key] = value


def normalize_domain(value: str) -> str:
    """Normalize a Salesforce My Domain URL and reject unsupported login hosts."""
    domain = value.strip()
    if not domain:
        raise SalesforceError("SALESFORCE_DOMAIN está vazio.")
    if not re.match(r"^https?://", domain, flags=re.IGNORECASE):
        domain = f"https://{domain}"
    domain = domain.rstrip("/")

    match = re.match(r"^https?://([^/]+)", domain, flags=re.IGNORECASE)
    if not match:
        raise SalesforceError("SALESFORCE_DOMAIN não parece ser uma URL válida.")
    host = match.group(1).lower()
    if host in {"login.salesforce.com", "test.salesforce.com"}:
        raise SalesforceError(
            "O OAuth Client Credentials exige o My Domain da organização, "
            "não login.salesforce.com nem test.salesforce.com."
        )
    return domain


def _strip_literals_and_comments(text: str) -> str:
    """Replace string literals and comments with spaces for safe keyword checks."""
    output: list[str] = []
    index = 0
    length = len(text)
    state = "normal"

    while index < length:
        char = text[index]
        next_char = text[index + 1] if index + 1 < length else ""

        if state == "normal":
            if char == "'":
                state = "single"
                output.append(" ")
            elif char == "-" and next_char == "-":
                state = "line_comment"
                output.extend([" ", " "])
                index += 1
            elif char == "/" and next_char == "*":
                state = "block_comment"
                output.extend([" ", " "])
                index += 1
            else:
                output.append(char)
        elif state == "single":
            if char == "\\" and next_char:
                output.extend([" ", " "])
                index += 1
            elif char == "'":
                # SOQL string escaping can use a doubled apostrophe.
                if next_char == "'":
                    output.extend([" ", " "])
                    index += 1
                else:
                    state = "normal"
                    output.append(" ")
            else:
                output.append(" ")
        elif state == "line_comment":
            if char in "\r\n":
                state = "normal"
                output.append(char)
            else:
                output.append(" ")
        else:  # block_comment
            if char == "*" and next_char == "/":
                output.extend([" ", " "])
                index += 1
                state = "normal"
            else:
                output.append(" ")
        index += 1

    return "".join(output)


def validate_read_only_soql(soql: str) -> str:
    """Validate and normalize a single, read-only Salesforce SOQL statement."""
    if not isinstance(soql, str):
        raise ReadOnlyQueryError("A consulta precisa ser texto.")

    query = soql.strip()
    if not query:
        raise ReadOnlyQueryError("A consulta não pode ficar vazia.")
    if len(query) > 20_000:
        raise ReadOnlyQueryError("A consulta excede o limite local de 20.000 caracteres.")

    sanitized = _strip_literals_and_comments(query)
    if ";" in sanitized:
        raise ReadOnlyQueryError("Somente uma consulta é permitida; remova o ponto e vírgula.")

    if not re.match(r"^\s*SELECT\b", sanitized, flags=re.IGNORECASE):
        raise ReadOnlyQueryError(
            "Apenas consultas SOQL que começam com SELECT são permitidas."
        )

    forbidden = re.search(
        r"\b(?:INSERT|UPDATE|DELETE|UPSERT|MERGE|UNDELETE|CREATE|DROP|ALTER|"
        r"TRUNCATE|EXECUTE|CALL|PATCH|POST|PUT)\b",
        sanitized,
        flags=re.IGNORECASE,
    )
    if forbidden:
        raise ReadOnlyQueryError(
            f"Operação não permitida ({forbidden.group(0).upper()}); este utilitário é somente leitura."
        )

    if re.search(r"\bFOR\s+UPDATE\b", sanitized, flags=re.IGNORECASE):
        raise ReadOnlyQueryError("FOR UPDATE foi bloqueado para manter o utilitário somente leitura.")

    return re.sub(r"\s+", " ", query).strip()


def parse_error(response: requests.Response) -> str:
    """Extract a useful error message without leaking credentials."""
    try:
        payload = response.json()
    except ValueError:
        payload = response.text.strip()

    if isinstance(payload, list):
        parts = []
        for item in payload:
            if isinstance(item, dict):
                code = item.get("errorCode")
                message = item.get("message")
                parts.append(" - ".join(str(part) for part in (code, message) if part))
            else:
                parts.append(str(item))
        detail = "; ".join(part for part in parts if part)
    elif isinstance(payload, dict):
        detail = str(payload.get("error_description") or payload.get("message") or payload)
    else:
        detail = str(payload)

    detail = detail or "resposta vazia"
    return f"HTTP {response.status_code}: {detail}"


@dataclass
class QueryResult:
    records: list[dict[str, Any]]
    total_size: int
    done: bool


class SalesforceClient:
    """Small read-only client for Salesforce OAuth and REST Query."""

    def __init__(
        self,
        domain: str,
        client_id: str,
        client_secret: str,
        api_version: str | None = None,
        timeout: int = REQUEST_TIMEOUT,
        session: requests.Session | None = None,
    ) -> None:
        self.domain = normalize_domain(domain)
        self.client_id = client_id.strip()
        self.client_secret = client_secret.strip()
        if not self.client_id or not self.client_secret:
            raise SalesforceError("Client ID e client secret são obrigatórios.")
        self.api_version = api_version or DEFAULT_API_VERSION
        if not re.fullmatch(r"v\d+\.\d+", self.api_version):
            raise SalesforceError("SALESFORCE_API_VERSION deve ter o formato vXX.0.")
        self.timeout = timeout
        self.session = session or requests.Session()
        self.access_token: str | None = None
        self.instance_url: str | None = None

    def authenticate(self) -> None:
        """Obtain an access token using OAuth Client Credentials."""
        response = self.session.post(
            f"{self.domain}/services/oauth2/token",
            data={
                "grant_type": "client_credentials",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
            },
            timeout=self.timeout,
        )
        if not response.ok:
            raise SalesforceError(
                "Falha ao autenticar no Salesforce. "
                + parse_error(response)
            )

        try:
            payload = response.json()
        except ValueError as exc:
            raise SalesforceError("O Salesforce devolveu uma resposta de autenticação inválida.") from exc

        token = payload.get("access_token")
        instance_url = payload.get("instance_url")
        if not token or not instance_url:
            raise SalesforceError("A resposta OAuth não contém access_token e instance_url.")
        self.access_token = str(token)
        self.instance_url = str(instance_url).rstrip("/")

    def _headers(self) -> dict[str, str]:
        if not self.access_token:
            self.authenticate()
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/json",
        }

    def _api_url(self, path: str) -> str:
        if not self.instance_url:
            self.authenticate()
        assert self.instance_url is not None
        return f"{self.instance_url}/services/data/{self.api_version}{path}"

    def _get(self, url: str, **kwargs: Any) -> requests.Response:
        response = self.session.get(
            url,
            headers=self._headers(),
            timeout=self.timeout,
            **kwargs,
        )
        if response.status_code == 401:
            # Client Credentials has no refresh token; obtain a new short-lived token.
            self.access_token = None
            response = self.session.get(
                url,
                headers=self._headers(),
                timeout=self.timeout,
                **kwargs,
            )
        return response

    def discover_api_version(self) -> str:
        """Return the newest API version exposed by the org, when available."""
        response = self._get(f"{self.instance_url}/services/data/")
        if not response.ok:
            return self.api_version
        try:
            versions = response.json()
        except ValueError:
            return self.api_version
        candidates: list[tuple[int, int, str]] = []
        for item in versions if isinstance(versions, list) else []:
            url = str(item.get("url", "")) if isinstance(item, dict) else ""
            match = re.search(r"/services/data/(v\d+\.\d+)", url)
            if match:
                version = match.group(1)
                major, minor = version[1:].split(".", 1)
                candidates.append((int(major), int(minor), version))
        if candidates:
            return max(candidates)[2]
        return self.api_version

    def list_objects(self, name_filter: str = "") -> list[dict[str, Any]]:
        response = self._get(self._api_url("/sobjects/"))
        if not response.ok:
            raise SalesforceError("Não foi possível listar os objetos. " + parse_error(response))
        payload = response.json()
        objects = payload.get("sobjects", [])
        text = name_filter.strip().lower()
        if text:
            objects = [
                item for item in objects
                if text in str(item.get("name", "")).lower()
                or text in str(item.get("label", "")).lower()
            ]
        return sorted(objects, key=lambda item: str(item.get("name", "")).lower())

    def describe_object(self, object_name: str) -> dict[str, Any]:
        if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]*", object_name.strip()):
            raise SalesforceError("Nome de objeto inválido.")
        response = self._get(self._api_url(f"/sobjects/{object_name.strip()}/describe/"))
        if not response.ok:
            raise SalesforceError("Não foi possível obter os campos. " + parse_error(response))
        return response.json()

    def query(self, soql: str, max_records: int = DEFAULT_MAX_RECORDS) -> QueryResult:
        query = validate_read_only_soql(soql)
        if max_records < 1:
            raise SalesforceError("max_records precisa ser maior que zero.")

        response = self._get(self._api_url("/query/"), params={"q": query})
        if not response.ok:
            raise SalesforceError("A consulta SOQL falhou. " + parse_error(response))

        try:
            payload = response.json()
        except ValueError as exc:
            raise SalesforceError("O Salesforce devolveu uma resposta SOQL inválida.") from exc

        records: list[dict[str, Any]] = list(payload.get("records") or [])
        total_size = int(payload.get("totalSize") or len(records))
        done = bool(payload.get("done", True))
        next_url = payload.get("nextRecordsUrl")

        while next_url and len(records) < max_records:
            next_response = self._get(urljoin(self.instance_url + "/", str(next_url)))
            if not next_response.ok:
                raise SalesforceError("Falha ao buscar a próxima página. " + parse_error(next_response))
            page = next_response.json()
            records.extend(list(page.get("records") or []))
            done = bool(page.get("done", True))
            next_url = page.get("nextRecordsUrl")

        if len(records) > max_records:
            records = records[:max_records]
            done = False
        return QueryResult(records=records, total_size=total_size, done=done)


def flatten_value(value: Any) -> str:
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if value is None:
        return ""
    return str(value)


def print_table(records: Iterable[dict[str, Any]]) -> None:
    rows = list(records)
    if not rows:
        print("Nenhum registro encontrado.")
        return
    columns: list[str] = []
    for row in rows:
        for key in row:
            if key != "attributes" and key not in columns:
                columns.append(key)
    if not columns:
        print("A consulta retornou registros sem campos exibíveis.")
        return

    display_rows = [[flatten_value(row.get(column, "")) for column in columns] for row in rows]
    max_width = 50
    widths = [min(max(len(column), *(len(row[index]) for row in display_rows)), max_width) for index, column in enumerate(columns)]

    def format_cell(value: str, width: int) -> str:
        value = value.replace("\n", " ")
        return value if len(value) <= width else value[: width - 1] + "…"

    header = " | ".join(format_cell(column, widths[index]).ljust(widths[index]) for index, column in enumerate(columns))
    separator = "-+-".join("-" * width for width in widths)
    print(header)
    print(separator)
    for row in display_rows:
        print(" | ".join(format_cell(value, widths[index]).ljust(widths[index]) for index, value in enumerate(row)))


def print_csv(records: Iterable[dict[str, Any]]) -> None:
    rows = list(records)
    columns: list[str] = []
    for row in rows:
        for key in row:
            if key != "attributes" and key not in columns:
                columns.append(key)
    writer = csv.DictWriter(sys.stdout, fieldnames=columns, extrasaction="ignore")
    if columns:
        writer.writeheader()
        for row in rows:
            writer.writerow({key: flatten_value(row.get(key, "")) for key in columns})


def print_result(result: QueryResult, output_format: str) -> None:
    if output_format == "json":
        print(json.dumps(result.records, ensure_ascii=False, indent=2))
    elif output_format == "csv":
        print_csv(result.records)
    else:
        print_table(result.records)
    suffix = "" if result.done else " (resultado limitado pelo limite local)"
    print(f"\nRegistros exibidos: {len(result.records)} | Total informado pelo Salesforce: {result.total_size}{suffix}")


def prompt_nonempty(label: str) -> str:
    while True:
        value = input(label).strip()
        if value:
            return value
        print("Digite um valor ou use :cancel para sair.")


def choose_object(client: SalesforceClient) -> str | None:
    print("Buscando objetos disponíveis...")
    objects = client.list_objects()
    if not objects:
        print("Nenhum objeto encontrado.")
        return None
    print("Digite parte do nome do objeto para filtrar; deixe vazio para mostrar os primeiros 40.")
    filter_text = input("Filtro: ").strip()
    if filter_text:
        objects = client.list_objects(filter_text)
    if not objects:
        print("Nenhum objeto corresponde ao filtro.")
        return None
    for index, item in enumerate(objects[:40], start=1):
        print(f"{index:>3}. {item.get('name')} — {item.get('label', '')}")
    if len(objects) > 40:
        print(f"Mostrando 40 de {len(objects)} objetos. Você também pode digitar o nome diretamente.")
    choice = input("Número ou nome do objeto (vazio cancela): ").strip()
    if not choice or choice.lower() == ":cancel":
        return None
    if choice.isdigit() and 1 <= int(choice) <= min(len(objects), 40):
        return str(objects[int(choice) - 1].get("name"))
    return choice


def build_query(client: SalesforceClient) -> str | None:
    print("\nConstrutor guiado de SOQL — somente leitura")
    object_name = choose_object(client)
    if not object_name:
        return None

    description = client.describe_object(object_name)
    fields = description.get("fields", [])
    field_names = [str(item.get("name")) for item in fields if item.get("name")]
    print(f"\nObjeto: {object_name}")
    print(f"Campos disponíveis: {len(field_names)}")
    print(", ".join(field_names[:80]))
    if len(field_names) > 80:
        print("(A lista foi abreviada; use :fields " + object_name + " para consultar todos.)")

    default_fields = [name for name in ("Id", "Name") if name in field_names]
    if not default_fields:
        default_fields = field_names[:3]
    field_input = input(f"Campos separados por vírgula [{', '.join(default_fields)}]: ").strip()
    selected_fields = field_input or ", ".join(default_fields)
    if not selected_fields:
        raise SalesforceError("Nenhum campo foi informado.")

    where = input("Filtro WHERE sem a palavra WHERE (opcional): ").strip()
    if where.upper().startswith("WHERE "):
        where = where[6:].strip()
    order_by = input("Ordenação, por exemplo CreatedDate DESC (opcional): ").strip()
    limit_input = input(f"Limite de registros [{DEFAULT_LIMIT}]: ").strip()
    limit = DEFAULT_LIMIT
    if limit_input:
        try:
            limit = int(limit_input)
        except ValueError as exc:
            raise SalesforceError("O limite precisa ser um número inteiro.") from exc
        if not 1 <= limit <= 50_000:
            raise SalesforceError("O limite precisa estar entre 1 e 50.000.")

    query = f"SELECT {selected_fields} FROM {object_name}"
    if where:
        query += f" WHERE {where}"
    if order_by:
        query += f" ORDER BY {order_by}"
    query += f" LIMIT {limit}"
    return validate_read_only_soql(query)


def print_help() -> None:
    print(
        """
Comandos disponíveis:
  :build                         Monta um SELECT usando objetos e campos do org.
  :objects [filtro]              Lista objetos disponíveis.
  :fields NomeDoObjeto           Lista campos e tipos de um objeto.
  :run SELECT ...                Valida e executa uma consulta SOQL.
  :format table|json|csv         Define o formato de saída.
  :help                          Mostra esta ajuda.
  :exit                          Encerra o programa.

Você também pode colar diretamente uma consulta que comece com SELECT.
Somente consultas SELECT são aceitas; operações de escrita são bloqueadas.
""".strip()
    )


def interactive(client: SalesforceClient, output_format: str, max_records: int) -> None:
    print("Salesforce SOQL Explorer — modo somente leitura")
    print(f"Organização: {client.domain} | API: {client.api_version}")
    print("Digite :help para ver os comandos disponíveis.")
    current_format = output_format

    while True:
        try:
            line = input("\nsoql> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nEncerrado.")
            return
        if not line:
            continue
        command = line.lower()
        try:
            if command in {":exit", ":quit", ":q"}:
                print("Encerrado.")
                return
            if command == ":help":
                print_help()
                continue
            if command.startswith(":format"):
                value = line.split(maxsplit=1)[1].strip().lower() if len(line.split(maxsplit=1)) > 1 else ""
                if value not in {"table", "json", "csv"}:
                    print("Formato inválido. Use table, json ou csv.")
                else:
                    current_format = value
                    print(f"Formato definido: {current_format}")
                continue
            if command.startswith(":objects"):
                pieces = line.split(maxsplit=1)
                objects = client.list_objects(pieces[1] if len(pieces) > 1 else "")
                for item in objects:
                    print(f"{item.get('name')} — {item.get('label', '')}")
                print(f"Total: {len(objects)}")
                continue
            if command.startswith(":fields"):
                pieces = line.split(maxsplit=1)
                if len(pieces) < 2:
                    print("Uso: :fields NomeDoObjeto")
                    continue
                description = client.describe_object(pieces[1].strip())
                for field in description.get("fields", []):
                    print(f"{field.get('name')} — {field.get('type')} — {field.get('label', '')}")
                continue
            if command == ":build":
                query = build_query(client)
                if not query:
                    continue
                print(f"\nSOQL montado:\n{query}")
                execute = input("Executar agora? [S/n]: ").strip().lower()
                if execute and execute not in {"s", "sim", "y", "yes"}:
                    continue
            elif command.startswith(":run"):
                query = line[4:].strip()
                if not query:
                    print("Uso: :run SELECT ...")
                    continue
            else:
                query = line

            result = client.query(query, max_records=max_records)
            print_result(result, current_format)
        except (SalesforceError, ReadOnlyQueryError) as exc:
            print(f"Erro: {exc}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Explorador de SOQL somente leitura para Salesforce")
    parser.add_argument("--query", help="Executa uma consulta SELECT e encerra")
    parser.add_argument("--file", help="Lê a consulta SELECT de um arquivo UTF-8")
    parser.add_argument("--format", choices=("table", "json", "csv"), default="table", dest="output_format")
    parser.add_argument("--api-version", help="Versão da API, por exemplo v60.0")
    parser.add_argument("--max-records", type=int, default=DEFAULT_MAX_RECORDS)
    return parser


def get_required_env(name: str, prompt: str, secret: bool = False) -> str:
    value = os.getenv(name, "").strip()
    if value:
        return value
    value = getpass(prompt) if secret else input(prompt)
    if not value.strip():
        raise SalesforceError(f"{name} é obrigatório.")
    return value.strip()


def main(argv: list[str] | None = None) -> int:
    load_dotenv()
    parser = build_parser()
    args = parser.parse_args(argv)

    try:
        domain = get_required_env("SALESFORCE_DOMAIN", "Salesforce My Domain: ")
        client_id = get_required_env("SALESFORCE_CLIENT_ID", "Salesforce Client ID: ")
        client_secret = get_required_env("SALESFORCE_CLIENT_SECRET", "Salesforce Client Secret: ", secret=True)
        api_version = args.api_version or os.getenv("SALESFORCE_API_VERSION") or DEFAULT_API_VERSION
        client = SalesforceClient(domain, client_id, client_secret, api_version=api_version)
        client.authenticate()

        if args.file and args.query:
            parser.error("Use --query ou --file, não os dois ao mesmo tempo.")
        if args.file:
            with open(args.file, "r", encoding="utf-8") as query_file:
                query = query_file.read()
            result = client.query(query, max_records=args.max_records)
            print_result(result, args.output_format)
        elif args.query:
            result = client.query(args.query, max_records=args.max_records)
            print_result(result, args.output_format)
        else:
            interactive(client, args.output_format, args.max_records)
        return 0
    except FileNotFoundError as exc:
        print(f"Erro: arquivo não encontrado: {exc.filename}", file=sys.stderr)
        return 2
    except (SalesforceError, ReadOnlyQueryError, requests.RequestException) as exc:
        print(f"Erro: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
