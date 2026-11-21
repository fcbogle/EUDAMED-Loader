# Official EUDAMED DEVICE.GET reference sample

Retrieved 19 November 2026 from the European Commission Production documentation.
The XML is an unchanged reference template, not an application-generated request
or an accepted registration baseline.

- Documentation: https://webgate.ec.europa.eu/eudamed-help/en/documentation/technical-documentation.html
- Archive: https://webgate.ec.europa.eu/eudamed-help/en/files/EOs%20-%20XML%20samples.zip
- Archive member: `EOs - XML samples/SAMPLE_DTX_UDI_004.01.xml`
- Archive SHA-256: `583d92b7ba59df6d4d66116cfc868fe9fe21d2abc14100d8a7ba6ce3663b7bf5`
- XML SHA-256: `c70c5df1c5597c243dec4521ea781fe6f621992d6200397b09c507f94b26464a`

The sample describes `DEVICE.GET` through `message:PullRequest`, with pageNumber
0, pageSize 10, manufacturer criterion BE-MF-000000002 and state REGISTERED.
Support has advised that pageSize can be increased to 300 through the portal's
Bulk Upload download-request route; this has not yet been tested locally.

Before use, prepare a separate adapted copy. The original contains a literal
schema-version placeholder inside an attribute and undeclared `s:` prefixes.
It is therefore not directly parseable/ready for submission. It also contains
historical example identifiers, timestamp, manufacturer and M2M-specific token/
endpoint placeholders. Confirm requirements for the manual Bulk Upload route
against the service definition and environment schema before adapting these fields.
No submission, application configuration or database change was made to obtain
this reference.
