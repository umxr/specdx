# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.4.x (alpha) | Yes |
| < 0.4.0 | No |

## Reporting a Vulnerability

If you discover a security vulnerability in specdx, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please email **umarg1997@gmail.com** with:

- A description of the vulnerability
- Steps to reproduce the issue
- Any potential impact you have identified

You should receive a response within 72 hours. We will work with you to understand the issue and coordinate a fix before any public disclosure.

## Scope

specdx is a CLI tool that operates on local files. It does not make network requests in its core pipeline (validate, lint, pack, diff, graph, status). The following areas are in scope:

- Command injection via spec file content or config values
- Path traversal in file resolution
- Arbitrary code execution via custom lint rules
- Dependencies with known vulnerabilities

## Out of Scope

- Issues in upstream dependencies that do not affect specdx's usage
- Denial of service via extremely large spec suites (this is a local CLI tool)
