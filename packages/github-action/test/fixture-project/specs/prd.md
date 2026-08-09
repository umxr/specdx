---
id: "prd"
type: "prd"
title: "Action Smoke Fixture"
status: "approved"
version: "1.0"
created: "2026-08-01"
updated: "2026-08-09"
authors: ["specdx"]
---

## Problem Statement

The GitHub Action shipped unrunnable for every release before 0.4.0, because no
test ever executed the built entrypoint the way a runner does.

## Goals

Run the committed action bundle against a real spec suite on every push, so a
broken entrypoint fails CI instead of failing a user.

## Non-Goals

This fixture does not exercise the diff path, which needs two refs and a pull
request context.

## Features

- **F1**: Lint a valid spec suite and exit zero.

## Success Criteria

The action step completes successfully, having reported no spec errors.
