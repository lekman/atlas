# Security

## Reporting a Vulnerability

Report a vulnerability privately through
[GitHub's private vulnerability reporting](https://github.com/lekman/atlas/security/advisories/new).
Please do not open a public issue.

You will get an acknowledgement within a week. A fix, or an explanation of
why something is not a vulnerability, follows as soon as it can.

## What Atlas Holds

Atlas is built to run on your own hardware, reachable only inside your own
private network (a Tailscale tailnet). It records which agents work for
which clients, and the titles of requirements, backlog items, questions and
decisions. It is designed so that client content stays inside the boundary
it came from and crosses only as a short card. See
[Architecture](docs/architecture.md) for the boundary rules.

## In Scope

- Anything that lets data cross a boundary it should not.
- Anything that exposes the server outside the tailnet.
- Secrets or client-identifying content committed to this repository.
- The usual: injection, cross-site scripting in the views, dependency
  vulnerabilities reachable from our code.
