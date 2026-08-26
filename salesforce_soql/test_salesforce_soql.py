import unittest
from unittest.mock import Mock

from salesforce_soql import (
    ReadOnlyQueryError,
    SalesforceClient,
    normalize_domain,
    validate_read_only_soql,
)


class FakeResponse:
    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status_code = status_code
        self.ok = 200 <= status_code < 400
        self.text = str(payload)

    def json(self):
        return self._payload


class SalesforceSoqlTests(unittest.TestCase):
    def test_normalizes_domain(self):
        self.assertEqual(
            normalize_domain("https://acme.my.salesforce.com/"),
            "https://acme.my.salesforce.com",
        )

    def test_rejects_login_hosts_for_client_credentials(self):
        with self.assertRaisesRegex(Exception, "My Domain"):
            normalize_domain("https://login.salesforce.com")

    def test_accepts_read_only_select(self):
        self.assertEqual(
            validate_read_only_soql("  SELECT Id, Name FROM Account LIMIT 5  "),
            "SELECT Id, Name FROM Account LIMIT 5",
        )

    def test_allows_words_inside_string_literals(self):
        query = "SELECT Id FROM Account WHERE Name = 'DELETE UPDATE'"
        self.assertEqual(validate_read_only_soql(query), query)

    def test_rejects_non_select(self):
        with self.assertRaises(ReadOnlyQueryError):
            validate_read_only_soql("UPDATE Account SET Name = 'x'")

    def test_rejects_multiple_statements(self):
        with self.assertRaises(ReadOnlyQueryError):
            validate_read_only_soql("SELECT Id FROM Account; SELECT Id FROM Contact")

    def test_rejects_for_update(self):
        with self.assertRaises(ReadOnlyQueryError):
            validate_read_only_soql("SELECT Id FROM Account FOR UPDATE")

    def test_query_follows_next_records_url(self):
        session = Mock()
        client = SalesforceClient(
            "https://acme.my.salesforce.com",
            "client-id",
            "client-secret",
            api_version="v60.0",
            session=session,
        )
        client.access_token = "access-token"
        client.instance_url = "https://acme.my.salesforce.com"
        session.get.side_effect = [
            FakeResponse(
                {
                    "totalSize": 2,
                    "done": False,
                    "records": [{"Id": "001"}],
                    "nextRecordsUrl": "/services/data/v60.0/query/next-1",
                }
            ),
            FakeResponse(
                {
                    "done": True,
                    "records": [{"Id": "002"}],
                }
            ),
        ]

        result = client.query("SELECT Id FROM Account", max_records=10)

        self.assertEqual([row["Id"] for row in result.records], ["001", "002"])
        self.assertEqual(result.total_size, 2)
        self.assertTrue(result.done)
        self.assertEqual(session.get.call_count, 2)

    def test_query_respects_max_records(self):
        session = Mock()
        client = SalesforceClient(
            "https://acme.my.salesforce.com",
            "client-id",
            "client-secret",
            session=session,
        )
        client.access_token = "access-token"
        client.instance_url = "https://acme.my.salesforce.com"
        session.get.return_value = FakeResponse(
            {
                "totalSize": 3,
                "done": False,
                "records": [{"Id": "001"}, {"Id": "002"}],
                "nextRecordsUrl": "/services/data/v60.0/query/next-1",
            }
        )

        result = client.query("SELECT Id FROM Account", max_records=1)

        self.assertEqual([row["Id"] for row in result.records], ["001"])
        self.assertFalse(result.done)
        self.assertEqual(session.get.call_count, 1)


if __name__ == "__main__":
    unittest.main()
